'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, initDB, getSettings, recordProgress, type Letter } from '@/lib/db';
import { speak } from '@/lib/tts';
import { playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import GameSwitcher from '@/app/components/GameSwitcher';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';

type Phase = 'loading' | 'intro' | 'wordIntro' | 'letter' | 'celebrate' | 'complete';

export default function WordLearningGame() {
  const router = useRouter();
  const { profileUrls, getRandomPhoto } = useChildProfile();
  const { delay } = useGameSpeed();
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [wordList, setWordList] = useState<string[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [currentLetterData, setCurrentLetterData] = useState<Letter | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [childName, setChildName] = useState('');
  const [introPhotos, setIntroPhotos] = useState<string[]>([]);
  const [introPhotoIndex, setIntroPhotoIndex] = useState(0);
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);

  const currentWord = wordList[wordIndex] || '';

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
      const all = await db.letters.orderBy('letter').toArray();
      setLetters(all);

      // Use word bank if available, otherwise use the default alphabet words
      if (s.wordBank && s.wordBank.length > 0) {
        setWordList(s.wordBank);
      } else {
        setWordList(all.map(l => l.word.toUpperCase()));
      }
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
  }, []);

  const runWord = useCallback(async (word: string, allLetters: Letter[]) => {
    if (cancelledRef.current) return;

    // Announce the word
    setPhase('wordIntro');
    setCurrentStep(-1);
    setCurrentLetterData(null);
    await speak(`Let's learn the letters in the word: ${word}`);
    if (cancelledRef.current) return;
    await delay(2000);
    if (cancelledRef.current) return;

    // Walk through each letter
    for (let i = 0; i < word.length; i++) {
      if (cancelledRef.current) return;
      const char = word[i].toUpperCase();
      const letterData = allLetters.find(l => l.letter === char);

      setCurrentStep(i);
      setCurrentLetterData(letterData || null);
      setPhase('letter');

      if (letterData) {
        const positions = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
        const position = positions[i] || `${i + 1}th`;

        // Show just the letter
        await speak(`This is the letter ${char}. It's the ${position} letter in ${word}.`);
        if (cancelledRef.current) return;
        await delay(1200);
        if (cancelledRef.current) return;

        // Show the image and word association
        await speak(`The letter ${char}, is for ${letterData.word}`);
        await delay(3000);
        if (cancelledRef.current) return;

        await recordProgress(word, char, 5000);
      } else {
        await speak(`The character ${char}`);
        await delay(2000);
      }
      if (cancelledRef.current) return;
    }

    // Word complete celebration
    setCurrentStep(-1);
    setCelebrationPhoto(getRandomPhoto());
    setPhase('celebrate');
    playCheer();
    confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
    await speak(`Great job! You learned all the letters in ${word}!`);
    if (cancelledRef.current) return;
    await delay(3000);
    if (cancelledRef.current) return;

    // Move to next word
    setWordIndex(prev => {
      const next = (prev + 1) % wordList.length;
      return next;
    });
  }, [delay, wordList, getRandomPhoto]);

  // Run intro then start first word
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
            ? `Hi ${childName}! Let's learn some words!`
            : "Hi! Let's learn some words!";
          await speak(greeting);
          if (cancelledRef.current) return;
          await delay(1500);
        } else {
          await delay(1800);
        }
      }
    } else {
      const greeting = childName
        ? `Hi ${childName}! Let's learn some words!`
        : "Hi! Let's learn some words!";
      await speak(greeting);
      if (cancelledRef.current) return;
      await delay(2000);
    }
    if (cancelledRef.current) return;
    runWord(wordList[0], letters);
  }

  // Auto-start
  useEffect(() => {
    if (letters.length > 0 && wordList.length > 0 && !startedRef.current) {
      const t = setTimeout(() => {
        if (!startedRef.current && !cancelledRef.current) {
          startedRef.current = true;
          runIntro();
        }
      }, 500);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, wordList, profileUrls]);

  // When wordIndex changes (after first word), run next word
  useEffect(() => {
    if (startedRef.current && wordIndex > 0 && letters.length > 0 && wordList.length > 0) {
      runWord(wordList[wordIndex], letters);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordIndex]);

  if (phase === 'loading') {
    return (<div className="flex items-center justify-center min-h-screen"><div className="text-6xl animate-bounce-slow">🔤</div></div>);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4 relative">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button onClick={() => { cancelledRef.current = true; router.push('/'); }} className="text-3xl">⬅️</button>
        <GameSwitcher onBeforeSwitch={() => { cancelledRef.current = true; }} />
      </div>
      <div className="absolute top-4 right-4 text-sm text-gray-400">
        Word {wordIndex + 1}/{wordList.length}
      </div>

      {/* Intro */}
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
          <h1 className="text-3xl font-extrabold text-purple-600 text-center">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="text-xl text-gray-500 animate-pulse">Let&apos;s learn some words!</p>
        </div>
      )}

      {/* Word intro - show the full word */}
      {phase === 'wordIntro' && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          <p className="text-xl text-gray-500">Let&apos;s learn the letters in...</p>
          <h1 className="text-5xl font-extrabold text-purple-600 tracking-wider">{currentWord}</h1>
        </div>
      )}

      {/* Letter display with word progress */}
      {(phase === 'letter' || phase === 'celebrate') && (
        <div className="flex gap-2 mb-4">
          {currentWord.split('').map((ch, idx) => (
            <div key={idx} className={`w-12 h-12 flex items-center justify-center rounded-xl text-2xl font-extrabold ${
              idx === currentStep ? 'bg-yellow-300 text-blue-700 shadow-lg scale-110' :
              idx < currentStep ? 'bg-green-200 text-green-700' :
              phase === 'celebrate' ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'
            } transition-all duration-300`}>
              {ch.toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Current letter detail */}
      {phase === 'letter' && currentLetterData && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <span className="text-[8rem] font-extrabold text-blue-500 leading-none animate-rainbow">
            {currentLetterData.letter}
          </span>
          <img src={getImageSrc(currentLetterData)} alt={currentLetterData.word}
            className="w-48 h-48 object-contain rounded-3xl shadow-xl border-4 border-blue-200" />
          <p className="text-2xl font-extrabold text-blue-600">
            {currentLetterData.letter} is for {currentLetterData.word}
          </p>
        </div>
      )}

      {phase === 'letter' && !currentLetterData && currentStep >= 0 && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <span className="text-[8rem] font-extrabold text-blue-500 leading-none">
            {currentWord[currentStep]?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Celebration */}
      {phase === 'celebrate' && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          {celebrationPhoto && (
            <img src={celebrationPhoto} alt="" className="w-24 h-24 rounded-full border-4 border-yellow-300 shadow-lg animate-bounce-slow object-cover" />
          )}
          <div className="text-8xl">🎉🌟</div>
          <h1 className="text-3xl font-extrabold text-yellow-500 text-center">
            Great job!
          </h1>
          <p className="text-xl text-gray-600 text-center">
            You learned all the letters in <span className="font-extrabold text-purple-600">{currentWord}</span>!
          </p>
        </div>
      )}
    </div>
  );
}
