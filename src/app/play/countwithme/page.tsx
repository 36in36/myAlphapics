'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initDB, getGameState, saveGameState } from '@/lib/db';
import { speak } from '@/lib/audio';
import { playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import GameSwitcher from '@/app/components/GameSwitcher';
import Celebration from '@/app/components/Celebration';
import CountTiles from '@/app/components/CountTiles';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';
import { useCountingPool, type CountTile } from '@/lib/useCountingPool';
import { shouldCelebrate, personalize, type CelebrationCheck } from '@/lib/celebrationSchedule';
import {
  countBeat, cardinalRecap, countGreeting, COUNT_PROMPTS,
} from '@/lib/countingPhrases';

type Phase = 'loading' | 'intro' | 'watching' | 'total' | 'celebrate' | 'complete';

export default function CountWithMePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CountWithMe />
    </Suspense>
  );
}

/**
 * The watch-and-learn mode for counting.
 *
 * A child who cannot yet count can still watch someone else do it, and hearing
 * the total repeated after the count ("Three! There are three.") is what teaches
 * that the last number counted is how many there are. That recap line is the
 * point of this screen; everything else is scaffolding around it.
 */
function CountWithMe() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { delay } = useGameSpeed();
  const { getRandomPhoto } = useChildProfile();
  const { pickSet, maxCount, childName, ready } = useCountingPool();

  const [numbers, setNumbers] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [tiles, setTiles] = useState<CountTile[]>([]);
  const [counted, setCounted] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [completions, setCompletions] = useState(0);
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationCheck | null>(null);
  const [sinceCelebration, setSinceCelebration] = useState(0);
  const [sinceFull, setSinceFull] = useState(0);

  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const startIndexRef = useRef(0);
  const adaptiveRef = useRef(false);
  // runSequence is memoized, so calling advance() directly would capture the
  // index and celebration counters from the render that built it, and the game
  // would replay the same number forever. Go through a ref refreshed each render.
  const advanceRef = useRef<() => void>(() => {});

  const current = numbers[index];

  const runSequence = useCallback(async (n: number) => {
    if (cancelledRef.current) return;

    const set = pickSet(n);
    setTiles(set);
    setCounted([]);
    setHighlight(null);
    setPhase('watching');

    await speak(COUNT_PROMPTS.watchMe);
    if (cancelledRef.current) return;
    await delay(700);
    if (cancelledRef.current) return;

    // One beat per tile. The highlight moves with the voice so the child sees
    // one number attached to one thing — the one-to-one correspondence idea.
    for (let i = 0; i < set.length; i++) {
      if (cancelledRef.current) return;
      setHighlight(i);
      setCounted(set.slice(0, i + 1).map((t) => t.id));
      await speak(countBeat(i + 1));
      if (cancelledRef.current) return;
      await delay(450);
    }

    if (cancelledRef.current) return;
    setHighlight(null);
    setPhase('total');
    await delay(300);
    if (cancelledRef.current) return;
    await speak(cardinalRecap(n));
    if (cancelledRef.current) return;
    await delay(1400);
    if (cancelledRef.current) return;

    advanceRef.current();
  }, [pickSet, delay]);

  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(async () => {
      const mode = searchParams.get('mode');
      adaptiveRef.current = mode === 'adaptive';

      const numbersParam = searchParams.get('numbers');
      const list = numbersParam
        ? numbersParam.split(',').map(Number).filter((n) => n >= 1 && n <= 10)
        : Array.from({ length: maxCount }, (_, i) => i + 1);
      setNumbers(list);

      if (adaptiveRef.current) {
        startIndexRef.current = 0;
        setIndex(0);
        return;
      }
      const startParam = searchParams.get('start');
      let resume = 0;
      if (startParam !== null) {
        resume = parseInt(startParam) || 0;
      } else {
        const gs = await getGameState('countwithme');
        if (gs && gs.lastLetterIndex > 0 && gs.lastLetterIndex < list.length) {
          resume = gs.lastLetterIndex;
        }
      }
      startIndexRef.current = resume;
      setIndex(resume);
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, maxCount]);

  async function runIntro() {
    if (adaptiveRef.current) {
      runSequence(numbers[startIndexRef.current]);
      return;
    }
    setPhase('intro');
    await speak(countGreeting(childName));
    if (cancelledRef.current) return;
    await delay(1400);
    if (cancelledRef.current) return;
    runSequence(numbers[startIndexRef.current]);
  }

  useEffect(() => {
    if (ready && numbers.length > 0 && !startedRef.current) {
      const t = setTimeout(() => {
        if (!startedRef.current && !cancelledRef.current) {
          startedRef.current = true;
          runIntro();
        }
      }, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, numbers]);

  // Keyed on `step`, not `index`. A round that wraps back to the first number
  // leaves index at 0, so an index-keyed effect never fires (and React bails out
  // of the re-render entirely when the value is unchanged) — the game counted
  // one pass and then silently stopped. step always increments.
  //
  // Deliberately no `phase !== .complete.` guard: the finished screen is where
  // Play Again lives, and step only moves when something means to start a round.
  useEffect(() => {
    if (step === 0) return;
    if (numbers.length === 0 || !startedRef.current) return;
    runSequence(numbers[index]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function advance() {
    const newSince = sinceCelebration + 1;
    const newSinceFull = sinceFull + 1;
    const celebration = shouldCelebrate(index, numbers.length, newSince, newSinceFull);

    if (celebration.type !== 'none') {
      setCelebrationPhoto(getRandomPhoto());
      setCelebrationData(celebration);
      setSinceFull(celebration.type === 'full' ? 0 : newSinceFull);
      setSinceCelebration(0);
      setPhase('celebrate');
      return;
    }
    setSinceCelebration(newSince);
    setSinceFull(newSinceFull);
    nextNumber();
  }
  advanceRef.current = advance;

  async function nextNumber() {
    const nextIndex = (index + 1) % numbers.length;
    let newCompletions = completions;

    if (nextIndex === 0) {
      if (adaptiveRef.current) {
        router.push('/play/numbers');
        return;
      }
      newCompletions = completions + 1;
      setCompletions(newCompletions);
      if (newCompletions >= 2) {
        await saveGameState('countwithme', 0, newCompletions);
        setCelebrationPhoto(getRandomPhoto());
        setPhase('complete');
        playCheer();
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
        await speak(COUNT_PROMPTS.allDone);
        return;
      }
      await speak(COUNT_PROMPTS.keepGoing);
      await delay(1500);
      if (cancelledRef.current) return;
    }

    if (!adaptiveRef.current) await saveGameState('countwithme', nextIndex, newCompletions);
    setIndex(nextIndex);
    setStep((s) => s + 1);
  }

  function handleCelebrationComplete() {
    if (cancelledRef.current) return;
    setCelebrationData(null);
    nextNumber();
  }

  if (phase === 'loading' || !ready || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-bounce-slow text-6xl">🔢</div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
        {celebrationPhoto && (
          <img src={celebrationPhoto} alt="" className="h-24 w-24 animate-bounce-slow rounded-full border-4 border-yellow-300 shadow-lg" />
        )}
        <div className="animate-bounce-slow text-8xl">🏆</div>
        <h1 className="text-center text-4xl font-extrabold text-amber-500">You counted them all!</h1>
        <div className="text-6xl">⭐⭐⭐</div>
        <div className="flex gap-4">
          <button onClick={() => { setCompletions(0); setIndex(0); setStep((s) => s + 1); }} className="btn-kid bg-green-500">🔄 Play Again</button>
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
        {adaptiveRef.current
          ? `${index + 1} of ${numbers.length}`
          : `Round ${completions + 1}/2 • ${index + 1}/${numbers.length}`}
      </div>

      {phase === 'intro' && (
        <div className="flex animate-pop-in flex-col items-center gap-6">
          <div className="text-8xl">👀</div>
          <h1 className="text-center text-3xl font-extrabold text-amber-600">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="animate-pulse text-xl text-gray-500">Let&apos;s count together!</p>
        </div>
      )}

      {(phase === 'watching' || phase === 'total') && (
        <>
          <p className="text-2xl font-bold text-amber-600">
            {phase === 'total' ? 'How many?' : 'Watch me count!'}
          </p>
          <CountTiles tiles={tiles} counted={counted} highlight={highlight} />
          <div className="flex h-24 items-center justify-center">
            {phase === 'total' ? (
              <div className="flex animate-pop-in flex-col items-center">
                <span className="text-8xl font-extrabold leading-none text-amber-500">{current}</span>
                <span className="text-xl font-bold text-gray-500">There are {current}!</span>
              </div>
            ) : (
              highlight !== null && (
                <span key={highlight} className="animate-pop-in text-7xl font-extrabold text-amber-500">
                  {highlight + 1}
                </span>
              )
            )}
          </div>
        </>
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
