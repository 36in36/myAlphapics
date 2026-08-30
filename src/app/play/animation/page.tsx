'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, initDB, getSettings, recordProgress, getGameState, saveGameState, type Letter } from '@/lib/db';
import { speak } from '@/lib/audio';
import { playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import GameSwitcher from '@/app/components/GameSwitcher';
import Celebration from '@/app/components/Celebration';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';
import { shouldCelebrate, personalize, type CelebrationCheck } from '@/lib/celebrationSchedule';

type Phase = 'loading' | 'intro' | 'animating' | 'showing' | 'celebrate';

export default function AnimationGamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AnimationGame />
    </Suspense>
  );
}

function AnimationGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profileUrls, getRandomPhoto } = useChildProfile();
  const { delay } = useGameSpeed();
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationCheck | null>(null);
  const [introPhotos, setIntroPhotos] = useState<string[]>([]);
  const [introPhotoIndex, setIntroPhotoIndex] = useState(0);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [childName, setChildName] = useState('');
  const [lettersSinceCelebration, setLettersSinceCelebration] = useState(0);
  const [lettersSinceFull, setLettersSinceFull] = useState(0);
  const [animScale, setAnimScale] = useState(0);
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const startIndexRef = useRef(0);
  const adaptiveRef = useRef(false);

  const current = letters[index];

  function getImageSrc(l: Letter): string {
    if (l.imageBlob) return URL.createObjectURL(l.imageBlob);
    return l.imagePath;
  }

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
          const gs = await getGameState('animation');
          if (gs && gs.lastLetterIndex > 0 && gs.lastLetterIndex < all.length) {
            resumeIdx = gs.lastLetterIndex;
          }
        }
        startIndexRef.current = resumeIdx;
        setIndex(resumeIdx);
      }
      setPhase('loading');
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start when letters and profile are ready
  useEffect(() => {
    if (letters.length > 0 && !startedRef.current) {
      const t = setTimeout(() => {
        if (!startedRef.current && !cancelledRef.current) {
          startedRef.current = true;
          handleStart();
        }
      }, 500);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, profileUrls]);

  const runLetter = useCallback(async (letter: Letter, celebCount: number) => {
    if (cancelledRef.current) return;

    // Animate letter sliding in
    setPhase('animating');
    setAnimScale(0);
    await delay(100);
    setAnimScale(1);
    await delay(800);
    if (cancelledRef.current) return;

    // Name the letter first
    await speak(`This is the letter ${letter.letter}`);
    if (cancelledRef.current) return;
    await delay(1200);
    if (cancelledRef.current) return;

    // Now show with image and word
    setPhase('showing');
    await speak(`The letter ${letter.letter}, is for ${letter.word}`);
    if (cancelledRef.current) return;

    await recordProgress(childName, letter.letter, 3000);

    // Wait then advance
    await delay(3000);
    if (cancelledRef.current) return;

    const newCelebCount = celebCount + 1;
    const letterIdx = letters.indexOf(letter);
    const newSinceFull = lettersSinceFull + 1;
    const celebration = shouldCelebrate(letterIdx, letters.length, newCelebCount, newSinceFull);

    if (celebration.type !== 'none') {
      setCelebrationPhoto(getRandomPhoto());
      setCelebrationData(celebration);
      setLettersSinceFull(celebration.type === 'full' ? 0 : newSinceFull);
      setPhase('celebrate');
      setLettersSinceCelebration(0);
      // Celebration component handles timing via onComplete
      return;
    }

    setLettersSinceCelebration(newCelebCount);
    setLettersSinceFull(newSinceFull);
    const nextIdx = (letterIdx + 1) % letters.length;
    if (adaptiveRef.current && nextIdx === 0) {
      router.push('/play/adaptive');
      return;
    }
    if (!adaptiveRef.current) {
      await saveGameState('animation', nextIdx);
    }
    setIndex(nextIdx);
    runLetter(letters[nextIdx], newCelebCount);
  }, [letters, delay]);

  const handleCelebrationComplete = useCallback(async () => {
    if (cancelledRef.current) return;
    const nextIdx = (index + 1) % letters.length;
    if (adaptiveRef.current && nextIdx === 0) {
      router.push('/play/adaptive');
      return;
    }
    if (!adaptiveRef.current) {
      await saveGameState('animation', nextIdx, nextIdx === 0 ? 0 : undefined);
    }
    setIndex(nextIdx);
    runLetter(letters[nextIdx], 0);
  }, [index, letters, router, runLetter]);

  async function handleStart() {
    if (letters.length === 0) return;

    // In adaptive mode, skip intro
    if (adaptiveRef.current) {
      runLetter(letters[startIndexRef.current], 0);
      return;
    }

    // Pick up to 3 random photos for the intro
    const picks: string[] = [];
    if (profileUrls.length > 0) {
      const shuffled = [...profileUrls].sort(() => Math.random() - 0.5);
      picks.push(...shuffled.slice(0, Math.min(3, shuffled.length)));
    }
    setIntroPhotos(picks);
    setPhase('intro');

    if (picks.length > 0) {
      // Show each photo deliberately, one at a time
      for (let i = 0; i < picks.length; i++) {
        if (cancelledRef.current) return;
        setIntroPhotoIndex(i);
        if (i === 0) {
          // First photo appears with the greeting
          const greeting = childName
            ? `Hi ${childName}! I'm excited to show you the ABCs!`
            : "Hi! I'm excited to show you the ABCs!";
          await speak(greeting);
          if (cancelledRef.current) return;
          await delay(1500);
        } else {
          // Subsequent photos get a moment each
          await delay(1800);
        }
      }
    } else {
      // No photos — just do the greeting
      const greeting = childName
        ? `Hi ${childName}! I'm excited to show you the ABCs!`
        : "Hi! I'm excited to show you the ABCs!";
      await speak(greeting);
      if (cancelledRef.current) return;
      await delay(2000);
    }

    if (cancelledRef.current) return;
    runLetter(letters[startIndexRef.current], 0);
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-6xl animate-bounce-slow">🔤</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4 relative">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button onClick={() => { cancelledRef.current = true; router.push(adaptiveRef.current ? '/play/adaptive' : '/'); }} className="text-3xl">
          ⬅️
        </button>
        {!adaptiveRef.current && <GameSwitcher onBeforeSwitch={() => { cancelledRef.current = true; }} />}
      </div>

      {adaptiveRef.current && (
        <div className="absolute top-4 right-4 text-sm text-gray-400">
          Letter {index + 1} of {letters.length}
        </div>
      )}

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
          <p className="text-xl text-gray-500 animate-pulse">Get ready to learn your ABCs!</p>
        </div>
      )}

      {phase === 'animating' && current && (
        <div
          className="flex flex-col items-center gap-4 transition-all duration-700 ease-out"
          style={{ transform: `scale(${animScale})`, opacity: animScale }}
        >
          <span className="text-[12rem] font-extrabold text-blue-500 leading-none animate-rainbow">
            {current.letter}
          </span>
        </div>
      )}

      {phase === 'showing' && current && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <span className="text-8xl font-extrabold text-blue-500 animate-rainbow">
            {current.letter}
          </span>
          <img
            src={getImageSrc(current)}
            alt={current.word}
            className="w-52 h-52 object-contain rounded-3xl shadow-xl border-4 border-blue-200"
          />
          <p className="text-3xl font-extrabold text-blue-600">
            {current.letter} is for {current.word}
          </p>
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
    </div>
  );
}
