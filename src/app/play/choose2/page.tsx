'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, initDB, getSettings, recordProgress, recordLetterAttempt, getGameState, saveGameState, type Letter } from '@/lib/db';
import { speak } from '@/lib/audio';
import { playPop, playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import GameSwitcher from '@/app/components/GameSwitcher';
import Celebration from '@/app/components/Celebration';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';
import { shouldCelebrate, personalize, type CelebrationCheck } from '@/lib/celebrationSchedule';

type Phase = 'loading' | 'intro' | 'letterOnly' | 'showing' | 'hidden' | 'choosing' | 'celebrate' | 'wrong' | 'complete';

export default function Choose2GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Choose2Game />
    </Suspense>
  );
}

function Choose2Game() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profileUrls, getRandomPhoto } = useChildProfile();
  const { delay } = useGameSpeed();
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationCheck | null>(null);
  const [lettersSinceCelebration, setLettersSinceCelebration] = useState(0);
  const [lettersSinceFull, setLettersSinceFull] = useState(0);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [choices, setChoices] = useState<string[]>([]);
  const [completions, setCompletions] = useState(0);
  const [childName, setChildName] = useState('');
  const startTimeRef = useRef(0);
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const startIndexRef = useRef(0);
  const adaptiveRef = useRef(false);
  const allLettersRef = useRef<Letter[]>([]);
  const [introPhotos, setIntroPhotos] = useState<string[]>([]);
  const [introPhotoIndex, setIntroPhotoIndex] = useState(0);

  const current = letters[index];

  function getImageSrc(l: Letter): string {
    if (l.imageBlob) return URL.createObjectURL(l.imageBlob);
    return l.imagePath;
  }

  function getRandomWrongLetters(correct: string, count: number, allLetters: Letter[]): string[] {
    const others = allLetters.filter(l => l.letter !== correct);
    const shuffled = others.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(l => l.letter);
  }

  const runSequence = useCallback(async (letter: Letter, sourceLetters: Letter[]) => {
    if (cancelledRef.current) return;

    // Show just the letter first
    setPhase('letterOnly');
    await speak(`This is the letter ${letter.letter}`);
    if (cancelledRef.current) return;
    await delay(1200);
    if (cancelledRef.current) return;

    // Now show letter + image + word
    setPhase('showing');
    await speak(`The letter ${letter.letter}, is for ${letter.word}`);
    if (cancelledRef.current) return;
    await delay(3000);
    if (cancelledRef.current) return;

    setPhase('hidden');
    await delay(1000);
    if (cancelledRef.current) return;

    const choicePool = allLettersRef.current.length > 0 ? allLettersRef.current : sourceLetters;
    const wrong = getRandomWrongLetters(letter.letter, 1, choicePool);
    const opts = [letter.letter, ...wrong].sort(() => Math.random() - 0.5);
    setChoices(opts);
    setPhase('choosing');
    startTimeRef.current = Date.now();
    await speak(`Can you find the letter ${letter.letter}?`);
  }, [delay]);

  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(async () => {
      const s = await getSettings();
      setChildName(s.childName);

      const mode = searchParams.get('mode');
      const lettersParam = searchParams.get('letters');
      const isAdaptive = mode === 'adaptive';

      let all = await db.letters.orderBy('letter').toArray();
      const allLettersForChoices = all;
      allLettersRef.current = allLettersForChoices;

      if (lettersParam) {
        const focus = lettersParam.split(',');
        all = all.filter(l => focus.includes(l.letter));
      }
      setLetters(all);

      if (isAdaptive) {
        adaptiveRef.current = true;
        startIndexRef.current = 0;
        setIndex(0);
      } else {
        const startParam = searchParams.get('start');
        let resumeIdx = 0;
        if (startParam !== null) {
          resumeIdx = parseInt(startParam) || 0;
        } else {
          const gs = await getGameState('choose2');
          if (gs && gs.lastLetterIndex > 0 && gs.lastLetterIndex < all.length) {
            resumeIdx = gs.lastLetterIndex;
          }
        }
        startIndexRef.current = resumeIdx;
        setIndex(resumeIdx);
      }
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
  }, []);

  // Intro with child photos then start
  async function runIntro() {
    // In adaptive mode, skip intro
    if (adaptiveRef.current) {
      runSequence(letters[startIndexRef.current], letters);
      return;
    }

    setPhase('intro');
    const picks: string[] = [];
    if (profileUrls.length > 0) {
      const shuffled = [...profileUrls].sort(() => Math.random() - 0.5);
      picks.push(...shuffled.slice(0, Math.min(3, shuffled.length)));
    }
    setIntroPhotos(picks);

    if (picks.length > 0) {
      for (let i = 0; i < picks.length; i++) {
        if (cancelledRef.current) return;
        setIntroPhotoIndex(i);
        if (i === 0) {
          const greeting = childName
            ? `Hi ${childName}! Can you find the right letters?`
            : "Hi! Can you find the right letters?";
          await speak(greeting);
          if (cancelledRef.current) return;
          await delay(1500);
        } else {
          await delay(1800);
        }
      }
    } else {
      const greeting = childName
        ? `Hi ${childName}! Can you find the right letters?`
        : "Hi! Can you find the right letters?";
      await speak(greeting);
      if (cancelledRef.current) return;
      await delay(2000);
    }
    if (cancelledRef.current) return;
    runSequence(letters[startIndexRef.current], letters);
  }

  // Start when letters and profile are ready
  useEffect(() => {
    if (letters.length > 0 && !startedRef.current) {
      const t = setTimeout(() => {
        if (!startedRef.current && !cancelledRef.current) {
          startedRef.current = true;
          runIntro();
        }
      }, 500);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, profileUrls]);

  // Advance to next letter after first load
  useEffect(() => {
    if (letters.length > 0 && startedRef.current && index > 0 && phase !== 'complete') {
      runSequence(letters[index], letters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  async function advanceToNextChoose2() {
    const nextIndex = (index + 1) % letters.length;
    let newCompletions = completions;
    if (nextIndex === 0) {
      if (adaptiveRef.current) {
        router.push('/play/adaptive');
        return;
      }
      newCompletions = completions + 1;
      setCompletions(newCompletions);
      if (newCompletions >= 3) {
        await saveGameState('choose2', 0, newCompletions);
        setCelebrationPhoto(getRandomPhoto());
        setPhase('complete');
        playCheer();
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
        await speak('Congratulations! You completed all three rounds! You are amazing!');
        return;
      }
      await speak("Great job! Let's go through the alphabet again!");
      await delay(2000);
    }
    if (!adaptiveRef.current) {
      await saveGameState('choose2', nextIndex, newCompletions);
    }
    setIndex(nextIndex);
  }

  function handleCelebrationComplete() {
    if (cancelledRef.current) return;
    setLettersSinceCelebration(0);
    advanceToNextChoose2();
  }

  async function handleChoice(choice: string) {
    if (phase !== 'choosing') return;

    const responseTime = Date.now() - startTimeRef.current;

    if (choice === current.letter) {
      await recordLetterAttempt(childName, current.letter, true, responseTime, 'choose2');

      const newSinceLast = lettersSinceCelebration + 1;
      const newSinceFull = lettersSinceFull + 1;
      const celebration = shouldCelebrate(index, letters.length, newSinceLast, newSinceFull);

      if (celebration.type !== 'none') {
        setCelebrationPhoto(getRandomPhoto());
        setCelebrationData(celebration);
      setLettersSinceFull(celebration.type === 'full' ? 0 : newSinceFull);
        setLettersSinceCelebration(0);
        setPhase('celebrate');
        return;
      }

      // Quick feedback, no full celebration
      playPop();
      confetti({ particleCount: 40, spread: 40, origin: { y: 0.3 } });
      await speak("That's correct!");
      await delay(1500);
      if (cancelledRef.current) return;

      setLettersSinceCelebration(newSinceLast);
      setLettersSinceFull(newSinceFull);
      advanceToNextChoose2();
    } else {
      setPhase('wrong');
      await recordLetterAttempt(childName, current.letter, false, 0, 'choose2');
      await speak("That's not quite right. Let's try again!");
      await delay(2000);
      if (cancelledRef.current) return;
      runSequence(current, letters);
    }
  }

  if (phase === 'loading' || !current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-6xl animate-bounce-slow">🔤</div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        {celebrationPhoto && (
          <img src={celebrationPhoto} alt="" className="w-24 h-24 rounded-full border-4 border-yellow-300 shadow-lg animate-bounce-slow" />
        )}
        <div className="text-8xl animate-bounce-slow">🏆</div>
        <h1 className="text-4xl font-extrabold text-center text-yellow-500">Congratulations!</h1>
        <p className="text-xl text-center text-gray-600">You completed all three rounds! You&apos;re amazing!</p>
        <div className="text-6xl">⭐⭐⭐</div>
        <div className="flex gap-4">
          <button onClick={() => { setCompletions(0); setIndex(0); }} className="btn-kid bg-green-500">🔄 Play Again</button>
          <button onClick={() => router.push('/')} className="btn-kid bg-blue-500">🏠 Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4 relative">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button onClick={() => { cancelledRef.current = true; router.push(adaptiveRef.current ? '/play/adaptive' : '/'); }} className="text-3xl">⬅️</button>
        {!adaptiveRef.current && <GameSwitcher onBeforeSwitch={() => { cancelledRef.current = true; }} />}
      </div>
      <div className="absolute top-4 right-4 text-sm text-gray-400">
        {adaptiveRef.current
          ? `Letter ${index + 1} of ${letters.length}`
          : `Round ${completions + 1}/3 • Letter ${index + 1}/${letters.length}`
        }
      </div>

      {/* Intro phase */}
      {phase === 'intro' && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          {introPhotos.length > 0 && (
            <img
              key={introPhotoIndex}
              src={introPhotos[introPhotoIndex]}
              alt=""
              className="w-36 h-36 rounded-full border-4 border-blue-300 shadow-xl animate-pop-in object-cover"
            />
          )}
          <h1 className="text-3xl font-extrabold text-blue-600 text-center">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="text-xl text-gray-500 animate-pulse">Can you find the right letters?</p>
        </div>
      )}

      {/* Letter only phase */}
      {phase === 'letterOnly' && current && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <span className="text-[10rem] font-extrabold text-blue-500 leading-none animate-rainbow">
            {current.letter}
          </span>
        </div>
      )}

      {phase === 'showing' && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <img src={getImageSrc(current)} alt={current.word} className="w-64 h-64 object-contain rounded-3xl shadow-xl border-4 border-blue-200" />
          <p className="text-3xl font-extrabold text-blue-600">{current.letter} is for {current.word}</p>
        </div>
      )}

      {phase === 'hidden' && (
        <div className="text-6xl text-gray-300 animate-pulse">...</div>
      )}

      {phase === 'choosing' && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          <p className="text-2xl font-bold text-purple-600">Find the letter {current.letter}!</p>
          <div className="flex gap-6">
            {choices.map((ch) => (
              <button key={ch} onClick={() => handleChoice(ch)}
                className="w-32 h-32 md:w-40 md:h-40 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-3xl shadow-2xl flex items-center justify-center transform transition-all hover:scale-105 active:scale-95">
                <span className="text-6xl md:text-7xl font-extrabold text-white">{ch}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'celebrate' && celebrationData && (
        <Celebration
          type={celebrationData.type as 'mini' | 'full'}
          photo={celebrationPhoto}
          childName={childName}
          phrase={personalize(celebrationData.phrase, childName)}
          onComplete={handleCelebrationComplete}
        />
      )}

      {phase === 'wrong' && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <div className="text-8xl">🤔</div>
          <p className="text-2xl font-extrabold text-orange-500">Let&apos;s try again!</p>
        </div>
      )}
    </div>
  );
}
