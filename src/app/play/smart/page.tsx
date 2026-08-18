'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, initDB, getSettings, recordProgress, recordLetterAttempt, selectFocusLetters, type Letter } from '@/lib/db';
import { speak } from '@/lib/audio';
import { playPop, playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';

type AdaptiveLevel = 'animation' | 'single' | 'choose2' | 'choose3' | 'choose4';
type Phase = 'loading' | 'intro' | 'levelIntro' | 'letterOnly' | 'showing' | 'hidden' | 'button' | 'choosing' | 'celebrate' | 'wrong' | 'levelComplete' | 'allDone';

const LEVEL_NAMES: Record<AdaptiveLevel, string> = {
  animation: 'Watch & Learn',
  single: 'Press the Letter',
  choose2: 'Choose Between 2',
  choose3: 'Choose Between 3',
  choose4: 'Choose Between 4',
};

const LEVEL_ORDER: AdaptiveLevel[] = ['animation', 'single', 'choose2', 'choose3', 'choose4'];

export default function SmartPracticePage() {
  const router = useRouter();
  const { profileUrls, getRandomPhoto } = useChildProfile();
  const { delay } = useGameSpeed();

  const [phase, setPhase] = useState<Phase>('loading');
  const [allLetters, setAllLetters] = useState<Letter[]>([]);
  const [focusLetters, setFocusLetters] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<AdaptiveLevel>('animation');
  const [childName, setChildName] = useState('');
  const [currentLetterData, setCurrentLetterData] = useState<Letter | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [introPhotos, setIntroPhotos] = useState<string[]>([]);
  const [introPhotoIndex, setIntroPhotoIndex] = useState(0);
  const [animScale, setAnimScale] = useState(0);

  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const startTimeRef = useRef(0);

  function getImageSrc(l: Letter): string {
    if (l.imageBlob) return URL.createObjectURL(l.imageBlob);
    return l.imagePath;
  }

  function getRandomWrongLetters(correct: string, count: number): string[] {
    const others = allLetters.filter(l => l.letter !== correct);
    const shuffled = others.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(l => l.letter);
  }

  // ─── Init ──────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(async () => {
      const s = await getSettings();
      setChildName(s.childName);
      const all = await db.letters.orderBy('letter').toArray();
      setAllLetters(all);

      const focus = await selectFocusLetters(s.childName || '', 3);
      setFocusLetters(focus);
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
  }, []);

  // ─── Auto-start ────────────────────────────────────
  useEffect(() => {
    if (allLetters.length > 0 && focusLetters.length > 0 && !startedRef.current) {
      const t = setTimeout(() => {
        if (!startedRef.current && !cancelledRef.current) {
          startedRef.current = true;
          runIntro();
        }
      }, 500);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLetters, focusLetters, profileUrls]);

  // ─── Intro with photos ─────────────────────────────
  async function runIntro() {
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
            ? `Hi ${childName}! Let's do some smart practice!`
            : "Hi! Let's do some smart practice!";
          await speak(greeting);
          if (cancelledRef.current) return;
          await delay(1500);
        } else {
          await delay(1800);
        }
      }
    } else {
      await speak(childName ? `Hi ${childName}! Let's do some smart practice!` : "Hi! Let's do some smart practice!");
      if (cancelledRef.current) return;
      await delay(2000);
    }
    if (cancelledRef.current) return;

    await speak(`Today we're focusing on the letters: ${focusLetters.join(', ')}`);
    if (cancelledRef.current) return;
    await delay(2000);
    if (cancelledRef.current) return;

    startLevel('animation');
  }

  // ─── Level Management ──────────────────────────────
  async function startLevel(level: AdaptiveLevel) {
    if (cancelledRef.current) return;
    setCurrentLevel(level);
    setFocusIndex(0);
    setPhase('levelIntro');

    await speak(`Level: ${LEVEL_NAMES[level]}!`);
    if (cancelledRef.current) return;
    await delay(1500);
    if (cancelledRef.current) return;

    runLetter(level, 0);
  }

  async function advanceToNextLevel() {
    if (cancelledRef.current) return;
    const idx = LEVEL_ORDER.indexOf(currentLevel);
    if (idx < LEVEL_ORDER.length - 1) {
      startLevel(LEVEL_ORDER[idx + 1]);
    } else {
      // All levels complete!
      setCelebrationPhoto(getRandomPhoto());
      setPhase('allDone');
      playCheer();
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
      await speak(`Amazing work${childName ? `, ${childName}` : ''}! You completed all five levels! You're getting so smart!`);
    }
  }

  // ─── Run a letter through the current level ────────
  async function runLetter(level: AdaptiveLevel, idx: number) {
    if (cancelledRef.current) return;
    const letter = focusLetters[idx];
    const letterData = allLetters.find(l => l.letter === letter) || null;
    setCurrentLetterData(letterData);
    setFocusIndex(idx);

    switch (level) {
      case 'animation':
        await runAnimation(letterData, idx);
        break;
      case 'single':
        await runSingle(letterData, idx);
        break;
      case 'choose2':
      case 'choose3':
      case 'choose4':
        const wrongCount = level === 'choose2' ? 1 : level === 'choose3' ? 2 : 3;
        await runChoose(letterData, idx, wrongCount);
        break;
    }
  }

  // ─── Animation Level ───────────────────────────────
  async function runAnimation(letterData: Letter | null, idx: number) {
    if (!letterData || cancelledRef.current) return;

    setPhase('letterOnly');
    setAnimScale(0);
    await delay(100);
    setAnimScale(1);
    await delay(800);
    if (cancelledRef.current) return;

    await speak(`This is the letter ${letterData.letter}`);
    if (cancelledRef.current) return;
    await delay(1200);
    if (cancelledRef.current) return;

    setPhase('showing');
    await speak(`The letter ${letterData.letter}, is for ${letterData.word}`);
    if (cancelledRef.current) return;

    await recordProgress(childName || '', letterData.letter, 3000);
    await delay(3000);
    if (cancelledRef.current) return;

    // Next focus letter or advance level
    if (idx < focusLetters.length - 1) {
      runLetter('animation', idx + 1);
    } else {
      setCelebrationPhoto(getRandomPhoto());
      setPhase('levelComplete');
      playPop();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.3 } });
      await speak('Great watching! Now let\'s practice!');
      if (cancelledRef.current) return;
      await delay(2000);
      if (cancelledRef.current) return;
      advanceToNextLevel();
    }
  }

  // ─── Single Press Level ────────────────────────────
  async function runSingle(letterData: Letter | null, idx: number) {
    if (!letterData || cancelledRef.current) return;

    setPhase('letterOnly');
    await speak(`This is the letter ${letterData.letter}`);
    if (cancelledRef.current) return;
    await delay(1200);
    if (cancelledRef.current) return;

    setPhase('showing');
    await speak(`The letter ${letterData.letter}, is for ${letterData.word}`);
    if (cancelledRef.current) return;
    await delay(3000);
    if (cancelledRef.current) return;

    setPhase('hidden');
    await delay(1000);
    if (cancelledRef.current) return;

    setPhase('button');
    startTimeRef.current = Date.now();
    await speak(`Can you press the letter ${letterData.letter}?`);
    // Wait for handlePress
  }

  async function handlePress() {
    if (phase !== 'button' || !currentLetterData) return;
    const responseTime = Date.now() - startTimeRef.current;
    await recordLetterAttempt(childName || '', currentLetterData.letter, true, responseTime, 'smart');

    setCelebrationPhoto(getRandomPhoto());
    setPhase('celebrate');
    playPop();
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.3 } });
    await speak(`Excellent! You pressed the letter ${currentLetterData.letter}!`);
    await delay(2000);
    if (cancelledRef.current) return;

    if (focusIndex < focusLetters.length - 1) {
      runLetter('single', focusIndex + 1);
    } else {
      setPhase('levelComplete');
      await speak('Great pressing! Let\'s try something harder!');
      if (cancelledRef.current) return;
      await delay(2000);
      if (cancelledRef.current) return;
      advanceToNextLevel();
    }
  }

  // ─── Choose Level ──────────────────────────────────
  async function runChoose(letterData: Letter | null, idx: number, wrongCount: number) {
    if (!letterData || cancelledRef.current) return;

    setPhase('letterOnly');
    await speak(`This is the letter ${letterData.letter}`);
    if (cancelledRef.current) return;
    await delay(1200);
    if (cancelledRef.current) return;

    setPhase('showing');
    await speak(`The letter ${letterData.letter}, is for ${letterData.word}`);
    if (cancelledRef.current) return;
    await delay(3000);
    if (cancelledRef.current) return;

    setPhase('hidden');
    await delay(1000);
    if (cancelledRef.current) return;

    const wrong = getRandomWrongLetters(letterData.letter, wrongCount);
    const opts = [letterData.letter, ...wrong].sort(() => Math.random() - 0.5);
    setChoices(opts);
    setPhase('choosing');
    startTimeRef.current = Date.now();
    await speak(`Can you find the letter ${letterData.letter}?`);
  }

  async function handleChoice(choice: string) {
    if (phase !== 'choosing' || !currentLetterData) return;
    const responseTime = Date.now() - startTimeRef.current;

    if (choice === currentLetterData.letter) {
      await recordLetterAttempt(childName || '', currentLetterData.letter, true, responseTime, 'smart');
      setCelebrationPhoto(getRandomPhoto());
      setPhase('celebrate');
      playPop();
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.3 } });
      await speak("Excellent! That's correct!");
      await delay(2000);
      if (cancelledRef.current) return;

      if (focusIndex < focusLetters.length - 1) {
        runLetter(currentLevel, focusIndex + 1);
      } else {
        const levelIdx = LEVEL_ORDER.indexOf(currentLevel);
        if (levelIdx < LEVEL_ORDER.length - 1) {
          setPhase('levelComplete');
          await speak('Great job! Let\'s try the next challenge!');
          if (cancelledRef.current) return;
          await delay(2000);
          if (cancelledRef.current) return;
          advanceToNextLevel();
        } else {
          advanceToNextLevel();
        }
      }
    } else {
      await recordLetterAttempt(childName || '', currentLetterData.letter, false, 0, 'smart');
      setPhase('wrong');
      await speak("That's not quite right. Let's try again!");
      await delay(2000);
      if (cancelledRef.current) return;
      const wrongCount = currentLevel === 'choose2' ? 1 : currentLevel === 'choose3' ? 2 : 3;
      runChoose(currentLetterData, focusIndex, wrongCount);
    }
  }

  // ─── Render ────────────────────────────────────────
  if (phase === 'loading') {
    return (<div className="flex items-center justify-center min-h-screen"><div className="text-6xl animate-bounce-slow">🧠</div></div>);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4 relative">
      <div className="absolute top-4 left-4">
        <button onClick={() => { cancelledRef.current = true; router.push('/play'); }} className="text-3xl">⬅️</button>
      </div>

      {/* Level indicator */}
      {phase !== 'intro' && phase !== 'allDone' && (
        <div className="absolute top-4 right-4 text-right">
          <p className="text-xs text-gray-400">Smart Practice</p>
          <p className="text-sm font-bold text-purple-600">{LEVEL_NAMES[currentLevel]}</p>
          <div className="flex gap-1 mt-1 justify-end">
            {LEVEL_ORDER.map((l, i) => (
              <div key={l} className={`w-2 h-2 rounded-full ${
                i <= LEVEL_ORDER.indexOf(currentLevel) ? 'bg-purple-500' : 'bg-gray-200'
              }`} />
            ))}
          </div>
        </div>
      )}

      {/* Focus letters indicator */}
      {phase !== 'intro' && phase !== 'allDone' && (
        <div className="flex gap-3 mb-2">
          {focusLetters.map((l, i) => (
            <div key={l} className={`w-12 h-12 flex items-center justify-center rounded-xl text-2xl font-extrabold transition-all ${
              i === focusIndex ? 'bg-yellow-300 text-blue-700 shadow-lg scale-110' :
              i < focusIndex ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {l}
            </div>
          ))}
        </div>
      )}

      {/* Intro */}
      {phase === 'intro' && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          {introPhotos.length > 0 && (
            <img key={introPhotoIndex} src={introPhotos[introPhotoIndex]} alt=""
              className="w-36 h-36 rounded-full border-4 border-purple-300 shadow-xl animate-pop-in object-cover" />
          )}
          <h1 className="text-3xl font-extrabold text-purple-600 text-center">
            🧠 Smart Practice
          </h1>
          <p className="text-xl text-gray-500 animate-pulse">Personalized learning!</p>
        </div>
      )}

      {/* Level intro */}
      {phase === 'levelIntro' && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <div className="text-6xl">📚</div>
          <h2 className="text-2xl font-extrabold text-purple-600">{LEVEL_NAMES[currentLevel]}</h2>
        </div>
      )}

      {/* Letter only */}
      {phase === 'letterOnly' && currentLetterData && (
        <div className="flex flex-col items-center gap-4 animate-pop-in"
          style={currentLevel === 'animation' ? { transform: `scale(${animScale})`, opacity: animScale, transition: 'all 0.7s ease-out' } : {}}>
          <span className="text-[10rem] font-extrabold text-blue-500 leading-none animate-rainbow">
            {currentLetterData.letter}
          </span>
        </div>
      )}

      {/* Showing */}
      {phase === 'showing' && currentLetterData && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <span className="text-8xl font-extrabold text-blue-500 animate-rainbow">
            {currentLetterData.letter}
          </span>
          <img src={getImageSrc(currentLetterData)} alt={currentLetterData.word}
            className="w-48 h-48 object-contain rounded-3xl shadow-xl border-4 border-blue-200" />
          <p className="text-2xl font-extrabold text-blue-600">
            {currentLetterData.letter} is for {currentLetterData.word}
          </p>
        </div>
      )}

      {/* Hidden */}
      {phase === 'hidden' && (
        <div className="text-6xl text-gray-300 animate-pulse">...</div>
      )}

      {/* Button (single press) */}
      {phase === 'button' && currentLetterData && (
        <div className="animate-pop-in">
          <button onClick={handlePress}
            className="w-48 h-48 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-3xl shadow-2xl flex items-center justify-center transform transition-all hover:scale-105 active:scale-95">
            <span className="text-8xl font-extrabold text-white">{currentLetterData.letter}</span>
          </button>
        </div>
      )}

      {/* Choosing */}
      {phase === 'choosing' && currentLetterData && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          <p className="text-2xl font-bold text-purple-600">Find the letter {currentLetterData.letter}!</p>
          <div className={`flex ${choices.length > 3 ? 'flex-wrap justify-center' : ''} gap-4`}>
            {choices.map((ch) => (
              <button key={ch} onClick={() => handleChoice(ch)}
                className="w-28 h-28 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-3xl shadow-2xl flex items-center justify-center transform transition-all hover:scale-105 active:scale-95">
                <span className="text-5xl font-extrabold text-white">{ch}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Celebrate */}
      {phase === 'celebrate' && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          {celebrationPhoto && (
            <img src={celebrationPhoto} alt="" className="w-20 h-20 rounded-full border-4 border-yellow-300 shadow-lg animate-bounce-slow object-cover" />
          )}
          <div className="text-8xl">🎉</div>
          <p className="text-3xl font-extrabold text-green-500">Excellent!</p>
        </div>
      )}

      {/* Wrong */}
      {phase === 'wrong' && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <div className="text-8xl">🤔</div>
          <p className="text-2xl font-extrabold text-orange-500">Let&apos;s try again!</p>
        </div>
      )}

      {/* Level complete */}
      {phase === 'levelComplete' && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <div className="text-6xl">⭐</div>
          <p className="text-2xl font-extrabold text-yellow-500">Level Complete!</p>
        </div>
      )}

      {/* All done */}
      {phase === 'allDone' && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          {celebrationPhoto && (
            <img src={celebrationPhoto} alt="" className="w-28 h-28 rounded-full border-4 border-yellow-300 shadow-xl animate-bounce-slow object-cover" />
          )}
          <div className="text-8xl">🏆🧠</div>
          <h1 className="text-3xl font-extrabold text-yellow-500 text-center">
            Amazing, {childName || 'superstar'}!
          </h1>
          <p className="text-xl text-gray-600 text-center">
            You mastered all five levels for: <span className="font-extrabold text-purple-600">{focusLetters.join(', ')}</span>
          </p>
          <div className="flex gap-4">
            <button onClick={() => { startedRef.current = false; cancelledRef.current = false; router.push('/play/smart'); }}
              className="btn-kid bg-green-500">🔄 Again</button>
            <button onClick={() => router.push('/play')}
              className="btn-kid bg-blue-500">🎮 Games</button>
          </div>
        </div>
      )}
    </div>
  );
}
