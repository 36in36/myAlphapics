'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, initDB, getSettings, recordProgress, type Letter } from '@/lib/db';
import { speak } from '@/lib/audio';
import { playPop, playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import GameSwitcher from '@/app/components/GameSwitcher';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';

type Phase = 'loading' | 'needName' | 'intro' | 'letter' | 'celebrate' | 'complete';

export default function NameGame() {
  const router = useRouter();
  const { profileUrls, getRandomPhoto } = useChildProfile();
  const { delay } = useGameSpeed();
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [introPhotos, setIntroPhotos] = useState<string[]>([]);
  const [introPhotoIndex, setIntroPhotoIndex] = useState(0);
  const startedRef = useRef(false);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [childName, setChildName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentStep, setCurrentStep] = useState(-1);
  const [currentLetterData, setCurrentLetterData] = useState<Letter | null>(null);
  const cancelledRef = useRef(false);

  function getImageSrc(l: Letter): string {
    if (l.imageBlob) return URL.createObjectURL(l.imageBlob);
    return l.imagePath;
  }

  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(async () => {
      const s = await getSettings();
      const all = await db.letters.orderBy('letter').toArray();
      setLetters(all);
      if (s.childName) {
        setChildName(s.childName);
        setPhase('intro');
      } else {
        setPhase('needName');
      }
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
  }, []);

  const runGame = useCallback(async (name: string, allLetters: Letter[]) => {
    if (cancelledRef.current) return;

    // --- Intro with child photos ---
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
          await speak(`Hi ${name}! Let's learn the letters in your name!`);
          if (cancelledRef.current) return;
          await delay(1500);
        } else {
          await delay(1800);
        }
      }
    } else {
      await speak(`Hi ${name}! Let's learn the letters in your name!`);
      if (cancelledRef.current) return;
      await delay(2000);
    }
    if (cancelledRef.current) return;

    await speak(`Your name is ${name}`);
    await delay(2000);
    if (cancelledRef.current) return;

    // --- Letter sequence ---
    for (let i = 0; i < name.length; i++) {
      if (cancelledRef.current) return;
      const char = name[i].toUpperCase();
      const letterData = allLetters.find(l => l.letter === char);

      setCurrentStep(i);
      setCurrentLetterData(letterData || null);
      setPhase('letter');

      if (letterData) {
        const positions = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        const position = positions[i] || `${i + 1}th`;

        // Show just the letter first
        await speak(`This is the letter ${char}. It's the ${position} letter in your name.`);
        if (cancelledRef.current) return;
        await delay(1200);
        if (cancelledRef.current) return;

        // Now show the image and word
        await speak(`The letter ${char}, is for ${letterData.word}`);
        await delay(3000);
        if (cancelledRef.current) return;

        await recordProgress(name, char, 5000);
      } else {
        await speak(`The character ${char}`);
        await delay(2000);
      }
      if (cancelledRef.current) return;
    }

    // Celebration
    setCurrentStep(-1);
    setCelebrationPhoto(getRandomPhoto());
    setPhase('complete');
    playCheer();
    confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
    await speak(`${name}, now you know all the letters in your name! You're doing a great job!`);
    if (cancelledRef.current) return;

    // Pause then loop
    await delay(4000);
    if (cancelledRef.current) return;
    await speak(`Let's do it again!`);
    await delay(1500);
    if (cancelledRef.current) return;

    // Restart the game
    setCurrentStep(-1);
    setCurrentLetterData(null);
    runGame(name, allLetters);
  }, [delay, profileUrls]);

  useEffect(() => {
    if (phase === 'intro' && childName && letters.length > 0 && !startedRef.current) {
      // Small delay to let profileUrls load
      const t = setTimeout(() => {
        if (!startedRef.current && !cancelledRef.current) {
          startedRef.current = true;
          runGame(childName, letters);
        }
      }, 500);
      return () => clearTimeout(t);
    }
  }, [phase, childName, letters, runGame, profileUrls]);

  function handleSetName() {
    if (nameInput.trim()) {
      setChildName(nameInput.trim());
      setPhase('intro');
    }
  }

  if (phase === 'loading') {
    return (<div className="flex items-center justify-center min-h-screen"><div className="text-6xl animate-bounce-slow">🔤</div></div>);
  }

  if (phase === 'needName') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <button onClick={() => router.push('/')} className="text-3xl">⬅️</button>
          <GameSwitcher />
        </div>
        <h1 className="text-3xl font-extrabold text-purple-600">What&apos;s your name?</h1>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Enter name..."
          className="p-4 text-3xl rounded-2xl border-4 border-blue-300 focus:border-blue-500 outline-none text-center w-72"
          onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
        />
        <button onClick={handleSetName} className="btn-kid bg-green-500">▶️ Start!</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4 relative">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button onClick={() => { cancelledRef.current = true; router.push('/'); }} className="text-3xl">⬅️</button>
        <GameSwitcher onBeforeSwitch={() => { cancelledRef.current = true; }} />
      </div>

      {/* Intro phase with child photos */}
      {phase === 'intro' && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          {introPhotos.length > 0 && (
            <img
              key={introPhotoIndex}
              src={introPhotos[introPhotoIndex]}
              alt=""
              className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-blue-300 shadow-xl animate-pop-in object-cover"
            />
          )}
          <h1 className="text-3xl font-extrabold text-purple-600 text-center">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="text-xl text-gray-500 animate-pulse">Let&apos;s learn the letters in your name!</p>
        </div>
      )}

      {/* Name display with highlighted current letter */}
      <div className="flex gap-2 mb-4">
        {childName.split('').map((ch, idx) => (
          <div key={idx} className={`w-14 h-14 flex items-center justify-center rounded-xl text-3xl font-extrabold ${
            idx === currentStep ? 'bg-yellow-300 text-blue-700 shadow-lg scale-110' : 
            idx < currentStep ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'
          } transition-all duration-300`}>
            {ch.toUpperCase()}
          </div>
        ))}
      </div>

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
            {childName[currentStep]?.toUpperCase()}
          </span>
        </div>
      )}

      {phase === 'complete' && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          {celebrationPhoto && (
            <img src={celebrationPhoto} alt="" className="w-56 h-56 sm:w-64 sm:h-64 rounded-full border-4 border-yellow-300 shadow-lg animate-bounce-slow" />
          )}
          <div className="text-8xl">🎉🌟</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-yellow-500 text-center">
            Great job, {childName}!
          </h1>
          <p className="text-xl text-gray-600 text-center">You know all the letters in your name!</p>
          <div className="flex gap-4">
            <button onClick={() => { setCurrentStep(-1); startedRef.current = false; setPhase('intro'); }} className="btn-kid bg-green-500">🔄 Again</button>
            <button onClick={() => router.push('/')} className="btn-kid bg-blue-500">🏠 Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
