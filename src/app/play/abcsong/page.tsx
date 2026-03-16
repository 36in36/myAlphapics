'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, initDB, type Letter } from '@/lib/db';
import { playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import GameSwitcher from '@/app/components/GameSwitcher';
import { useChildProfile } from '@/lib/useChildProfile';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Timing in ms for each letter at normal speed, matching the ABC song rhythm
const LETTER_DURATIONS = [
  1000, 900, 700, 600, 600, 600, 600, 800,
  600, 600, 600, 300, 300, 300, 300, 700,
  600, 600, 600, 600, 700, 700, 900, 1000, 1000, 1000,
];

export default function ABCSongGame() {
  const router = useRouter();
  const { getRandomPhoto } = useChildProfile();
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.7);
  const [celebrating, setCelebrating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const cancelledRef = useRef(false);

  function getImageSrc(l: Letter): string {
    if (l.imageBlob) return URL.createObjectURL(l.imageBlob);
    return l.imagePath;
  }

  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(async () => {
      const all = await db.letters.orderBy('letter').toArray();
      setLetters(all);
    });
    return () => {
      cancelledRef.current = true;
      releaseWakeLock();
      cancelTimers();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  function cancelTimers() {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }

  function startSong(playbackSpeed: number) {
    cancelTimers();
    setCelebrating(false);
    setCurrentIndex(-1);
    setIsPlaying(true);

    const audio = new Audio('/sounds/abc_song.mp3');
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;

    audio.play().catch(() => {});

    const initialDelay = 500;
    const t0 = setTimeout(() => {
      if (!cancelledRef.current) setCurrentIndex(0);
    }, initialDelay);
    timersRef.current.push(t0);

    let cumulative = initialDelay;
    for (let i = 0; i < ALPHABET.length - 1; i++) {
      cumulative += Math.round(LETTER_DURATIONS[i] / playbackSpeed);
      const idx = i + 1;
      const t = setTimeout(() => {
        if (!cancelledRef.current) setCurrentIndex(idx);
      }, cumulative);
      timersRef.current.push(t);
    }

    // Celebration at end
    const totalDuration = LETTER_DURATIONS.reduce((a, b) => a + b, 0);
    const adjustedTotal = Math.round(totalDuration / playbackSpeed);
    const celebTimer = setTimeout(() => {
      if (!cancelledRef.current) {
        setCelebrationPhoto(getRandomPhoto());
        setCelebrating(true);
        playCheer();
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
      }
    }, adjustedTotal + initialDelay + 500);
    timersRef.current.push(celebTimer);

    audio.onended = () => {
      if (!cancelledRef.current) {
        setTimeout(() => startSong(playbackSpeed), 3000);
      }
    };
  }

  function changeSpeed(newSpeed: number) {
    setSpeed(newSpeed);
    if (isPlaying) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      startSong(newSpeed);
    }
  }

  const currentLetter = currentIndex >= 0 ? letters.find(l => l.letter === ALPHABET[currentIndex]) : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4 relative">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button onClick={() => { cancelledRef.current = true; router.push('/'); }} className="text-3xl">⬅️</button>
        <GameSwitcher onBeforeSwitch={() => { cancelledRef.current = true; }} />
      </div>

      <h1 className="text-3xl font-extrabold text-blue-600">🎵 ABC Song</h1>

      {/* Speed control */}
      <div className="flex gap-2">
        {[{ s: 0.5, label: '🐢 Slow' }, { s: 0.7, label: '🐰 Normal' }, { s: 1.0, label: '🚀 Fast' }].map(({ s, label }) => (
          <button key={s} onClick={() => changeSpeed(s)}
            className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all ${
              speed === s ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-200 text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {!isPlaying && (
        <button onClick={() => startSong(speed)} className="btn-kid bg-green-500 text-3xl py-6 px-12 animate-pop-in">
          ▶️ Play Song
        </button>
      )}

      {/* Current letter display */}
      {isPlaying && currentLetter && !celebrating && (
        <div className="flex flex-col items-center gap-3 animate-pop-in">
          <span className="text-[8rem] font-extrabold text-blue-500 leading-none animate-rainbow">
            {currentLetter.letter}
          </span>
          <img src={getImageSrc(currentLetter)} alt={currentLetter.word}
            className="w-40 h-40 object-contain rounded-3xl shadow-xl border-4 border-blue-200" />
          <p className="text-2xl font-extrabold text-blue-600">
            {currentLetter.letter} is for {currentLetter.word}
          </p>
        </div>
      )}

      {celebrating && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          {celebrationPhoto && (
            <img src={celebrationPhoto} alt="" className="w-24 h-24 rounded-full border-4 border-yellow-300 shadow-lg animate-bounce-slow" />
          )}
          <div className="text-8xl">🎉🌟🎵</div>
          <p className="text-3xl font-extrabold text-yellow-500">Great singing!</p>
        </div>
      )}

      {/* Alphabet grid */}
      {isPlaying && (
        <div className="grid grid-cols-9 gap-1 mt-2">
          {ALPHABET.map((ch, idx) => (
            <div key={ch} className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-200 ${
              idx === currentIndex ? 'bg-yellow-300 text-blue-700 scale-125 shadow-md' :
              idx < currentIndex ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {ch}
            </div>
          ))}
        </div>
      )}

      {isPlaying && (
        <button onClick={() => {
          cancelTimers();
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
          startSong(speed);
        }} className="text-lg text-blue-500 underline mt-2">🔄 Restart</button>
      )}
    </div>
  );
}
