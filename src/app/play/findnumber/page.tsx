'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initDB, getGameState, saveGameState, recordNumberAttempt } from '@/lib/db';
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
import {
  numberIntro, findNumber, pressedNumber, countGreeting, COUNT_PROMPTS,
} from '@/lib/countingPhrases';

type Phase = 'loading' | 'intro' | 'showing' | 'hidden' | 'choosing' | 'wrong' | 'celebrate' | 'complete';

export default function FindNumberPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <FindNumber />
    </Suspense>
  );
}

/**
 * Numeral recognition — the glyph "4", not the quantity.
 *
 * Structurally the same as the letter games: show the symbol with its meaning,
 * hide it, then ask for it. Developmentally it's the least important of the
 * Numbers modes, which is why it sits after counting rather than before it.
 */
function FindNumber() {
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
  const [choices, setChoices] = useState<number[]>([]);
  const [completions, setCompletions] = useState(0);
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationCheck | null>(null);
  const [sinceCelebration, setSinceCelebration] = useState(0);
  const [sinceFull, setSinceFull] = useState(0);

  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const startIndexRef = useRef(0);
  const adaptiveRef = useRef(false);
  const startTimeRef = useRef(0);
  const choiceCountRef = useRef(3);

  const current = numbers[index];

  const runSequence = useCallback(async (n: number) => {
    if (cancelledRef.current) return;
    setTiles(pickSet(n));
    setPhase('showing');
    await speak(numberIntro(n));
    if (cancelledRef.current) return;
    await delay(2400);
    if (cancelledRef.current) return;

    setPhase('hidden');
    await delay(800);
    if (cancelledRef.current) return;

    setChoices(buildChoices(n, choiceCountRef.current, Math.max(maxCount, n + 1)));
    setPhase('choosing');
    startTimeRef.current = Date.now();
    await speak(findNumber(n));
  }, [pickSet, delay, maxCount]);

  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(async () => {
      adaptiveRef.current = searchParams.get('mode') === 'adaptive';
      choiceCountRef.current = Math.min(Math.max(parseInt(searchParams.get('choices') ?? '3') || 3, 2), 4);

      const numbersParam = searchParams.get('numbers');
      const list = numbersParam
        ? numbersParam.split(',').map(Number).filter((n) => n >= 1 && n <= 10)
        : Array.from({ length: maxCount }, (_, i) => i + 1);
      setNumbers(list);

      if (adaptiveRef.current) { startIndexRef.current = 0; setIndex(0); return; }

      const startParam = searchParams.get('start');
      let resume = 0;
      if (startParam !== null) {
        resume = parseInt(startParam) || 0;
      } else {
        const gs = await getGameState('findnumber');
        if (gs && gs.lastLetterIndex > 0 && gs.lastLetterIndex < list.length) resume = gs.lastLetterIndex;
      }
      startIndexRef.current = resume;
      setIndex(resume);
    });
    return () => { cancelledRef.current = true; releaseWakeLock(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, maxCount]);

  async function runIntro() {
    if (adaptiveRef.current) { runSequence(numbers[startIndexRef.current]); return; }
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
        if (!startedRef.current && !cancelledRef.current) { startedRef.current = true; runIntro(); }
      }, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, numbers]);

  // Keyed on `step`, not `index`. A round that wraps back to the first number
  // leaves index at 0, so an index-keyed effect never fires (and React bails out
  // of the re-render entirely when the value is unchanged) — the game counted
  // one pass and then silently stopped. step always increments.
  useEffect(() => {
    if (step === 0) return;
    if (numbers.length === 0 || !startedRef.current || phase === 'complete') return;
    runSequence(numbers[index]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function handlePick(value: number) {
    if (phase !== 'choosing') return;
    const responseTime = Date.now() - startTimeRef.current;
    const correct = value === current;
    await recordNumberAttempt(childName, current, correct, correct ? responseTime : 0, 'findnumber');

    if (correct) {
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

      playPop();
      confetti({ particleCount: 40, spread: 40, origin: { y: 0.3 } });
      await speak(pressedNumber(current));
      if (cancelledRef.current) return;
      await delay(1200);
      if (cancelledRef.current) return;
      setSinceCelebration(newSince);
      setSinceFull(newSinceFull);
      nextNumber();
      return;
    }

    setPhase('wrong');
    await speak(COUNT_PROMPTS.wrong);
    if (cancelledRef.current) return;
    await delay(1600);
    if (cancelledRef.current) return;
    runSequence(current);
  }

  async function nextNumber() {
    const nextIndex = (index + 1) % numbers.length;
    let newCompletions = completions;

    if (nextIndex === 0) {
      if (adaptiveRef.current) { router.push('/play/numbers'); return; }
      newCompletions = completions + 1;
      setCompletions(newCompletions);
      if (newCompletions >= 2) {
        await saveGameState('findnumber', 0, newCompletions);
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
    if (!adaptiveRef.current) await saveGameState('findnumber', nextIndex, newCompletions);
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
        <div className="animate-bounce-slow text-6xl">🔟</div>
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
        <h1 className="text-center text-4xl font-extrabold text-fuchsia-500">You found every number!</h1>
        <div className="text-6xl">⭐⭐⭐</div>
        <div className="flex gap-4">
          <button onClick={() => { setCompletions(0); setIndex(0); setStep((s) => s + 1); }} className="btn-kid bg-green-500">🔄 Play Again</button>
          <button onClick={() => router.push('/')} className="btn-kid bg-blue-500">🏠 Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 p-6">
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
          <div className="text-8xl">🔟</div>
          <h1 className="text-center text-3xl font-extrabold text-fuchsia-600">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="animate-pulse text-xl text-gray-500">Can you find the numbers?</p>
        </div>
      )}

      {phase === 'showing' && (
        <div className="flex animate-pop-in flex-col items-center gap-5">
          <span className="animate-rainbow text-[9rem] font-extrabold leading-none text-fuchsia-500">{current}</span>
          <CountTiles tiles={tiles} counted={[]} size="small" />
          <p className="text-2xl font-extrabold text-fuchsia-600">This is the number {current}</p>
        </div>
      )}

      {phase === 'hidden' && <div className="animate-pulse text-6xl text-gray-300">...</div>}

      {phase === 'choosing' && (
        <div className="flex animate-pop-in flex-col items-center gap-6">
          <p className="text-2xl font-bold text-purple-600">Find the number {current}!</p>
          <NumberChoices choices={choices} onPick={handlePick} />
        </div>
      )}

      {phase === 'wrong' && (
        <div className="flex animate-pop-in flex-col items-center gap-4">
          <div className="text-8xl">🤔</div>
          <p className="text-2xl font-extrabold text-orange-500">Let&apos;s try again!</p>
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
