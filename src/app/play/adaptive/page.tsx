'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initDB, getSettings, selectFocusLetters } from '@/lib/db';
import {
  getAdaptiveSession,
  startAdaptiveSession,
  advanceAdaptiveSession,
  getGamePathForLevel,
  clearAdaptiveSession,
  getLevelIndex,
  LEVEL_NAMES,
  LEVEL_DESCRIPTIONS,
  LEVEL_EMOJI,
  LEVEL_ORDER,
  type AdaptiveSessionState,
} from '@/lib/adaptiveSession';
import { useChildProfile } from '@/lib/useChildProfile';

type PagePhase = 'loading' | 'start' | 'transition' | 'new-round' | 'complete' | 'all-mastered';

export default function AdaptiveLearningPage() {
  const router = useRouter();
  const { getRandomPhoto } = useChildProfile();
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [session, setSession] = useState<AdaptiveSessionState | null>(null);
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    console.log('[Adaptive] Page mounted, initializing DB...');
    initDB().then(async () => {
      console.log('[Adaptive] DB initialized');
      // Check if we're returning from a game (session exists with state)
      const existing = getAdaptiveSession();
      console.log('[Adaptive] Existing session:', existing);
      if (existing) {
        // We're coming back from a game — advance to next level
        setReturning(true);
        try {
          const result = await advanceAdaptiveSession();
          setSession(result.state);
          setCelebrationPhoto(getRandomPhoto());

          switch (result.action) {
            case 'next-level':
              setPhase('transition');
              break;
            case 'new-round':
              setPhase('new-round');
              break;
            case 'complete':
              setPhase('complete');
              break;
          }
        } catch (err) {
          console.error('[Adaptive] advanceAdaptiveSession error:', err);
          clearAdaptiveSession();
          setPhase('start');
        }
      } else {
        console.log('[Adaptive] No existing session, showing start screen');
        setPhase('start');
      }
    }).catch(err => {
      console.error('[Adaptive] initDB failed:', err);
      setPhase('start');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = useCallback(async () => {
    try {
      // Clear any stale session before starting fresh
      clearAdaptiveSession();
      await initDB();
      const s = await getSettings();
      const childName = s.childName || 'Learner';
      console.log('[Adaptive] Starting session for:', childName);
      const focusCheck = await selectFocusLetters(childName, 3);
      console.log('[Adaptive] Focus letters:', focusCheck);
      const newSession = await startAdaptiveSession(childName);
      console.log('[Adaptive] Session started:', newSession);
      setSession(newSession);
      setPhase('transition');
    } catch (err) {
      console.error('[Adaptive] handleStart error:', err);
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  const handleGoToGame = useCallback(() => {
    if (!session) return;
    const path = getGamePathForLevel(session.currentLevel);
    const letters = session.focusLetters.join(',');
    router.push(`${path}?mode=adaptive&letters=${letters}`);
  }, [session, router]);

  const handleQuit = useCallback(() => {
    clearAdaptiveSession();
    router.push('/');
  }, [router]);

  // Start screen
  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-400 via-pink-300 to-yellow-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🧠</div>
        <h1 className="text-4xl font-bold text-white drop-shadow-lg mb-4">
          Adaptive Learning
        </h1>
        <p className="text-xl text-white/90 mb-2 max-w-md">
          I&apos;ll pick 3 letters that need the most practice, then guide you through 5 levels of learning!
        </p>
        <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-4 mb-8 max-w-sm">
          <div className="space-y-2 text-left">
            {LEVEL_ORDER.map((level, i) => (
              <div key={level} className="flex items-center gap-2 text-white font-medium">
                <span className="text-lg">{LEVEL_EMOJI[level]}</span>
                <span className="text-sm">Level {i + 1}: {LEVEL_NAMES[level]}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={handleStart}
          className="bg-white text-purple-600 font-bold text-2xl px-10 py-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Let&apos;s Go! 🚀
        </button>
        <button
          onClick={() => router.push('/')}
          className="mt-4 text-white/70 text-lg underline"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Transition screen between levels
  if (phase === 'transition' && session) {
    const levelIdx = getLevelIndex(session.currentLevel);
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-500 flex flex-col items-center justify-center p-6 text-center">
        {returning && celebrationPhoto && (
          <img
            src={celebrationPhoto}
            alt="Great job!"
            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg mb-4 animate-bounce"
          />
        )}
        <div className="text-5xl mb-4">{LEVEL_EMOJI[session.currentLevel]}</div>
        <div className="text-sm text-white/70 mb-2 font-medium">
          Level {levelIdx + 1} of 5 {session.roundNumber > 1 ? `• Round ${session.roundNumber}` : ''}
        </div>
        <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
          {LEVEL_NAMES[session.currentLevel]}
        </h2>
        <p className="text-lg text-white/90 mb-6">
          {LEVEL_DESCRIPTIONS[session.currentLevel]}
        </p>
        <div className="flex gap-3 mb-8">
          {session.focusLetters.map(letter => (
            <div
              key={letter}
              className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl font-bold text-indigo-600 shadow-lg"
            >
              {letter}
            </div>
          ))}
        </div>
        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {LEVEL_ORDER.map((level, i) => (
            <div
              key={level}
              className={`w-4 h-4 rounded-full transition-all ${
                i < levelIdx ? 'bg-green-400 scale-100' :
                i === levelIdx ? 'bg-white scale-125 animate-pulse' :
                'bg-white/30'
              }`}
            />
          ))}
        </div>
        <button
          onClick={handleGoToGame}
          className="bg-white text-indigo-600 font-bold text-xl px-8 py-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Start! ▶️
        </button>
        <button
          onClick={handleQuit}
          className="mt-4 text-white/50 text-sm underline"
        >
          End Session
        </button>
      </div>
    );
  }

  // New round — mastered all 3 letters, picking new ones
  if (phase === 'new-round' && session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-400 via-emerald-400 to-teal-500 flex flex-col items-center justify-center p-6 text-center">
        {celebrationPhoto && (
          <img
            src={celebrationPhoto}
            alt="Amazing!"
            className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg mb-4"
          />
        )}
        <div className="text-6xl mb-4">🌟</div>
        <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
          Letters Mastered!
        </h2>
        <p className="text-lg text-white/90 mb-6">
          Amazing! Time for 3 new letters to learn!
        </p>
        <div className="flex gap-3 mb-8">
          {session.focusLetters.map(letter => (
            <div
              key={letter}
              className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl font-bold text-emerald-600 shadow-lg animate-bounce"
            >
              {letter}
            </div>
          ))}
        </div>
        <button
          onClick={handleGoToGame}
          className="bg-white text-emerald-600 font-bold text-xl px-8 py-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Keep Going! 🚀
        </button>
        <button
          onClick={handleQuit}
          className="mt-4 text-white/50 text-sm underline"
        >
          Done for Now
        </button>
      </div>
    );
  }

  // Session complete
  if (phase === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-300 via-orange-300 to-pink-400 flex flex-col items-center justify-center p-6 text-center">
        {celebrationPhoto && (
          <img
            src={celebrationPhoto}
            alt="Champion!"
            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg mb-4"
          />
        )}
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
          Great Practice!
        </h2>
        <p className="text-lg text-white/90 mb-8">
          You did an amazing job today! Keep practicing to master all your letters!
        </p>
        <button
          onClick={() => router.push('/reports')}
          className="bg-white text-orange-600 font-bold text-xl px-8 py-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform mb-3"
        >
          See Progress 📊
        </button>
        <button
          onClick={() => router.push('/')}
          className="text-white/70 text-lg underline"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Loading
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 to-pink-300 flex items-center justify-center">
      <div className="text-white text-2xl animate-pulse">Loading...</div>
    </div>
  );
}
