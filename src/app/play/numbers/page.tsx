'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initDB, getSettings } from '@/lib/db';
import {
  getNumbersSession,
  startNumbersSession,
  advanceNumbersSession,
  clearNumbersSession,
  getGamePathForLevel,
  getChoiceCountForLevel,
  getLevelIndex,
  LEVEL_NAMES,
  LEVEL_DESCRIPTIONS,
  LEVEL_EMOJI,
  LEVEL_ORDER,
  type NumbersSessionState,
} from '@/lib/numbersSession';
import { useChildProfile } from '@/lib/useChildProfile';

type PagePhase = 'loading' | 'start' | 'transition' | 'new-round' | 'complete';

/**
 * Numbers Smart Practice — the counting equivalent of the letters ladder.
 *
 * Four levels, always starting with the watch mode: cardinality is learned by
 * seeing someone else count before it can be produced, so the child never has
 * to answer before they have been shown.
 */
export default function NumbersPracticePage() {
  const router = useRouter();
  const { getRandomPhoto } = useChildProfile();
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [session, setSession] = useState<NumbersSessionState | null>(null);
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    initDB().then(async () => {
      const existing = getNumbersSession();
      if (!existing) {
        setPhase('start');
        return;
      }
      // Coming back from a game — move the ladder on one rung.
      setReturning(true);
      try {
        const result = await advanceNumbersSession();
        setSession(result.state);
        setCelebrationPhoto(getRandomPhoto());
        setPhase(result.action === 'next-level' ? 'transition'
          : result.action === 'new-round' ? 'new-round'
          : 'complete');
      } catch {
        clearNumbersSession();
        setPhase('start');
      }
    }).catch(() => setPhase('start'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = useCallback(async () => {
    clearNumbersSession();
    await initDB();
    const s = await getSettings();
    const newSession = await startNumbersSession(s.childName || 'Learner');
    setSession(newSession);
    setPhase('transition');
  }, []);

  const handleGoToGame = useCallback(() => {
    if (!session) return;
    const path = getGamePathForLevel(session.currentLevel);
    const numbers = session.focusNumbers.join(',');
    const choices = getChoiceCountForLevel(session.currentLevel);
    const choicesParam = choices ? `&choices=${choices}` : '';
    router.push(`${path}?mode=adaptive&numbers=${numbers}${choicesParam}`);
  }, [session, router]);

  const handleQuit = useCallback(() => {
    clearNumbersSession();
    router.push('/');
  }, [router]);

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-bounce-slow text-6xl">🧮</div>
      </div>
    );
  }

  if (phase === 'start') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-400 via-orange-300 to-yellow-200 p-6 text-center">
        <div className="mb-4 text-6xl">🧮</div>
        <h1 className="mb-4 text-4xl font-bold text-white drop-shadow-lg">Numbers Practice</h1>
        <p className="mb-2 max-w-md text-xl text-white/90">
          I&apos;ll pick 3 numbers that need the most practice, then work through 4 levels together!
        </p>
        <div className="mb-8 max-w-sm rounded-2xl bg-white/30 p-4 backdrop-blur-sm">
          <div className="space-y-2 text-left">
            {LEVEL_ORDER.map((level, i) => (
              <div key={level} className="flex items-center gap-2 font-medium text-white">
                <span className="text-lg">{LEVEL_EMOJI[level]}</span>
                <span className="text-sm">Level {i + 1}: {LEVEL_NAMES[level]}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={handleStart}
          className="rounded-full bg-white px-10 py-4 text-2xl font-bold text-orange-600 shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Let&apos;s Go! 🚀
        </button>
        <button onClick={() => router.push('/')} className="mt-4 text-lg text-white/70 underline">
          Back to Home
        </button>
      </div>
    );
  }

  if (phase === 'transition' && session) {
    const levelIdx = getLevelIndex(session.currentLevel);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-400 via-orange-400 to-rose-500 p-6 text-center">
        {returning && celebrationPhoto && (
          <img src={celebrationPhoto} alt="" className="mb-4 h-24 w-24 animate-bounce rounded-full border-4 border-white object-cover shadow-lg" />
        )}
        <div className="mb-4 text-5xl">{LEVEL_EMOJI[session.currentLevel]}</div>
        <div className="mb-2 text-sm font-medium text-white/70">
          Level {levelIdx + 1} of {LEVEL_ORDER.length}
          {session.roundNumber > 1 ? ` • Round ${session.roundNumber}` : ''}
        </div>
        <h2 className="mb-2 text-3xl font-bold text-white drop-shadow-lg">
          {LEVEL_NAMES[session.currentLevel]}
        </h2>
        <p className="mb-6 text-lg text-white/90">{LEVEL_DESCRIPTIONS[session.currentLevel]}</p>

        <div className="mb-8 flex gap-3">
          {session.focusNumbers.map((value) => (
            <div key={value} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-orange-600 shadow-lg">
              {value}
            </div>
          ))}
        </div>

        <div className="mb-8 flex gap-2">
          {LEVEL_ORDER.map((level, i) => (
            <div
              key={level}
              className={`h-4 w-4 rounded-full transition-all ${
                i < levelIdx ? 'scale-100 bg-green-400'
                  : i === levelIdx ? 'scale-125 animate-pulse bg-white'
                  : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleGoToGame}
          className="rounded-full bg-white px-8 py-3 text-xl font-bold text-orange-600 shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Start! ▶️
        </button>
        <button onClick={handleQuit} className="mt-4 text-sm text-white/50 underline">End Session</button>
      </div>
    );
  }

  if (phase === 'new-round' && session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-400 via-emerald-400 to-teal-500 p-6 text-center">
        {celebrationPhoto && (
          <img src={celebrationPhoto} alt="" className="mb-4 h-28 w-28 rounded-full border-4 border-white object-cover shadow-lg" />
        )}
        <div className="mb-4 text-6xl">🌟</div>
        <h2 className="mb-2 text-3xl font-bold text-white drop-shadow-lg">Numbers Mastered!</h2>
        <p className="mb-6 text-lg text-white/90">Amazing! Time for 3 new numbers.</p>
        <div className="mb-8 flex gap-3">
          {session.focusNumbers.map((value) => (
            <div key={value} className="flex h-16 w-16 animate-bounce items-center justify-center rounded-2xl bg-white text-3xl font-bold text-emerald-600 shadow-lg">
              {value}
            </div>
          ))}
        </div>
        <button
          onClick={handleGoToGame}
          className="rounded-full bg-white px-8 py-3 text-xl font-bold text-emerald-600 shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Keep Going! 🚀
        </button>
        <button onClick={handleQuit} className="mt-4 text-sm text-white/50 underline">End Session</button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-yellow-300 via-amber-300 to-orange-400 p-6 text-center">
      {celebrationPhoto && (
        <img src={celebrationPhoto} alt="" className="mb-4 h-28 w-28 rounded-full border-4 border-white object-cover shadow-lg" />
      )}
      <div className="mb-4 text-7xl">🏆</div>
      <h2 className="mb-2 text-3xl font-bold text-white drop-shadow-lg">Great session!</h2>
      <p className="mb-8 max-w-sm text-lg text-white/90">
        Come back and practice again soon — I&apos;ll pick the numbers that need it most.
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleStart}
          className="rounded-full bg-white px-8 py-3 text-xl font-bold text-orange-600 shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Go Again 🔄
        </button>
        <button
          onClick={() => router.push('/')}
          className="rounded-full bg-white/30 px-8 py-3 text-xl font-bold text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
        >
          🏠 Home
        </button>
      </div>
    </div>
  );
}
