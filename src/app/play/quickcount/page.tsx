'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initDB, recordNumberAttempt } from '@/lib/db';
import { speak } from '@/lib/audio';
import { playPop, playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import GameSwitcher from '@/app/components/GameSwitcher';
import Celebration from '@/app/components/Celebration';
import CountTiles from '@/app/components/CountTiles';
import NumberChoices, { buildChoices } from '@/app/components/NumberChoices';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';
import { useCountingPool, type CountTile } from '@/lib/useCountingPool';
import { shouldCelebrate, personalize, type CelebrationCheck } from '@/lib/celebrationSchedule';
import { cardinalRecap, countGreeting, COUNT_PROMPTS } from '@/lib/countingPhrases';

type Phase = 'loading' | 'intro' | 'ready' | 'flash' | 'choosing' | 'reveal' | 'celebrate' | 'complete';

/** Subitizing is instant recognition, not fast counting. Above four it stops
 *  being perceptual for a preschooler, so this mode never goes higher. */
const SUBITIZE_MAX = 4;
const ROUNDS = 10;
const FLASH_MS = 1100;

export default function QuickCountPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <QuickCount />
    </Suspense>
  );
}

/**
 * Flash rounds: see a small set, then say how many — without time to count.
 *
 * This is the one thing a screen does that a book cannot, and it targets the
 * route to small-number meaning that runs alongside counting rather than
 * through it.
 */
function QuickCount() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { delay } = useGameSpeed();
  const { getRandomPhoto } = useChildProfile();
  const { pickSet, childName, ready } = useCountingPool();

  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState(1);
  const [phase, setPhase] = useState<Phase>('loading');
  const [tiles, setTiles] = useState<CountTile[]>([]);
  const [choices, setChoices] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationCheck | null>(null);
  const [sinceCelebration, setSinceCelebration] = useState(0);
  const [sinceFull, setSinceFull] = useState(0);

  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const adaptiveRef = useRef(false);
  const startTimeRef = useRef(0);

  const runRound = useCallback(async () => {
    if (cancelledRef.current) return;
    const n = 1 + Math.floor(Math.random() * SUBITIZE_MAX);
    setAnswer(n);
    setTiles(pickSet(n));
    setPhase('ready');

    // Prompt first, then flash. Speaking over the flash would give the child
    // less than the intended look at the set.
    await speak(COUNT_PROMPTS.lookFast);
    if (cancelledRef.current) return;
    await delay(500);
    if (cancelledRef.current) return;

    setPhase('flash');
    // Deliberately not scaled by the speed setting: the exposure has to be too
    // short to count, or this becomes the same mode as How Many?.
    await new Promise<void>((r) => setTimeout(r, FLASH_MS));
    if (cancelledRef.current) return;

    setChoices(buildChoices(n, 3, SUBITIZE_MAX));
    setPhase('choosing');
    startTimeRef.current = Date.now();
    await speak(COUNT_PROMPTS.howMany);
  }, [pickSet, delay]);

  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(() => {
      adaptiveRef.current = searchParams.get('mode') === 'adaptive';
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || startedRef.current) return;
    const t = setTimeout(async () => {
      if (startedRef.current || cancelledRef.current) return;
      startedRef.current = true;
      if (adaptiveRef.current) { runRound(); return; }
      setPhase('intro');
      await speak(countGreeting(childName));
      if (cancelledRef.current) return;
      await delay(1400);
      if (cancelledRef.current) return;
      runRound();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function handlePick(value: number) {
    if (phase !== 'choosing') return;
    const responseTime = Date.now() - startTimeRef.current;
    const correct = value === answer;
    await recordNumberAttempt(childName, answer, correct, correct ? responseTime : 0, 'quickcount');

    // Either way the set comes back into view with its total spoken — a wrong
    // guess is only useful if the child gets to see what was actually there.
    setPhase('reveal');
    if (correct) {
      setCorrectCount((c) => c + 1);
      playPop();
      confetti({ particleCount: 40, spread: 40, origin: { y: 0.3 } });
      await speak(COUNT_PROMPTS.correct);
    } else {
      await speak(COUNT_PROMPTS.wrong);
    }
    if (cancelledRef.current) return;
    await delay(500);
    if (cancelledRef.current) return;
    await speak(cardinalRecap(answer));
    if (cancelledRef.current) return;
    await delay(1000);
    if (cancelledRef.current) return;

    const newSince = sinceCelebration + 1;
    const newSinceFull = sinceFull + 1;
    const celebration = shouldCelebrate(round, ROUNDS, newSince, newSinceFull);
    if (celebration.type !== 'none' && round < ROUNDS - 1) {
      setCelebrationPhoto(getRandomPhoto());
      setCelebrationData(celebration);
      setSinceFull(celebration.type === 'full' ? 0 : newSinceFull);
      setSinceCelebration(0);
      setPhase('celebrate');
      return;
    }
    setSinceCelebration(newSince);
    setSinceFull(newSinceFull);
    nextRound();
  }

  async function nextRound() {
    const next = round + 1;
    if (next >= ROUNDS) {
      if (adaptiveRef.current) { router.push('/play/numbers'); return; }
      setCelebrationPhoto(getRandomPhoto());
      setPhase('complete');
      playCheer();
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
      await speak(COUNT_PROMPTS.allDone);
      return;
    }
    setRound(next);
    runRound();
  }

  function handleCelebrationComplete() {
    if (cancelledRef.current) return;
    setCelebrationData(null);
    nextRound();
  }

  if (phase === 'loading' || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-bounce-slow text-6xl">⚡</div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        {celebrationPhoto && (
          <img src={celebrationPhoto} alt="" className="h-24 w-24 animate-bounce-slow rounded-full border-4 border-yellow-300 shadow-lg" />
        )}
        <div className="animate-bounce-slow text-8xl">⚡</div>
        <h1 className="text-center text-4xl font-extrabold text-amber-500">Quick eyes!</h1>
        <p className="text-2xl font-bold text-gray-500">{correctCount} out of {ROUNDS}</p>
        <div className="flex gap-4">
          <button
            onClick={() => { setRound(0); setCorrectCount(0); startedRef.current = false; runRound(); }}
            className="btn-kid bg-green-500"
          >
            🔄 Play Again
          </button>
          <button onClick={() => router.push('/')} className="btn-kid bg-blue-500">🏠 Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <button onClick={() => { cancelledRef.current = true; router.push(adaptiveRef.current ? '/play/numbers' : '/'); }} className="text-3xl">⬅️</button>
        {!adaptiveRef.current && <GameSwitcher onBeforeSwitch={() => { cancelledRef.current = true; }} />}
      </div>
      <div className="absolute right-4 top-4 text-sm text-gray-400">
        Round {Math.min(round + 1, ROUNDS)}/{ROUNDS} • {correctCount} right
      </div>

      {phase === 'intro' && (
        <div className="flex animate-pop-in flex-col items-center gap-6">
          <div className="text-8xl">⚡</div>
          <h1 className="text-center text-3xl font-extrabold text-amber-600">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="animate-pulse text-xl text-gray-500">Look fast and tell me how many!</p>
        </div>
      )}

      {phase === 'ready' && (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-pulse text-8xl">👀</div>
          <p className="text-2xl font-extrabold text-amber-600">Get ready...</p>
        </div>
      )}

      {(phase === 'flash' || phase === 'reveal') && (
        <>
          <CountTiles tiles={tiles} counted={[]} />
          {phase === 'reveal' && (
            <div className="flex animate-pop-in flex-col items-center">
              <span className="text-8xl font-extrabold leading-none text-amber-500">{answer}</span>
              <span className="text-xl font-bold text-gray-500">There {answer === 1 ? 'was' : 'were'} {answer}!</span>
            </div>
          )}
        </>
      )}

      {phase === 'choosing' && (
        <div className="flex animate-pop-in flex-col items-center gap-8">
          <p className="text-3xl font-extrabold text-amber-600">How many?</p>
          <NumberChoices choices={choices} onPick={handlePick} />
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
