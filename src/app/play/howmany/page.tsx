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
import { countBeat, cardinalRecap, countGreeting, COUNT_PROMPTS } from '@/lib/countingPhrases';

type Phase = 'loading' | 'intro' | 'looking' | 'choosing' | 'showing' | 'celebrate' | 'complete';

export default function HowManyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <HowMany />
    </Suspense>
  );
}

/**
 * The assessment step: the child looks at a set and picks the number.
 *
 * Distractors are neighbours of the right answer, because an off-by-one is what
 * a real miscount produces. A wrong answer doesn't just say "try again" — the
 * app counts the set out loud, which is the correction that actually teaches.
 */
function HowMany() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { delay } = useGameSpeed();
  const { getRandomPhoto } = useChildProfile();
  const { pickSet, maxCount, childName, ready } = useCountingPool();

  const [numbers, setNumbers] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [tiles, setTiles] = useState<CountTile[]>([]);
  const [counted, setCounted] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);
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
    setCounted([]);
    setHighlight(null);
    setPhase('looking');

    await speak(COUNT_PROMPTS.howManyAreThere);
    if (cancelledRef.current) return;
    await delay(900);
    if (cancelledRef.current) return;

    setChoices(buildChoices(n, choiceCountRef.current, Math.max(maxCount, n + 1)));
    setPhase('choosing');
    startTimeRef.current = Date.now();
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
        const gs = await getGameState('howmany');
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

  useEffect(() => {
    if (numbers.length > 0 && startedRef.current && index > 0 && phase !== 'complete') {
      runSequence(numbers[index]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  /** Count the set out loud for the child — the remediation after a wrong pick. */
  async function countItOut() {
    setPhase('showing');
    setCounted([]);
    await speak(COUNT_PROMPTS.watchMe);
    if (cancelledRef.current) return;
    for (let i = 0; i < tiles.length; i++) {
      if (cancelledRef.current) return;
      setHighlight(i);
      setCounted(tiles.slice(0, i + 1).map((t) => t.id));
      await speak(countBeat(i + 1));
      if (cancelledRef.current) return;
      await delay(400);
    }
    if (cancelledRef.current) return;
    setHighlight(null);
    await speak(cardinalRecap(tiles.length));
    if (cancelledRef.current) return;
    await delay(1200);
  }

  async function handlePick(value: number) {
    if (phase !== 'choosing') return;
    const responseTime = Date.now() - startTimeRef.current;
    const correct = value === current;

    await recordNumberAttempt(childName, current, correct, correct ? responseTime : 0, 'howmany');

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
      await speak(COUNT_PROMPTS.correct);
      if (cancelledRef.current) return;
      await delay(1200);
      if (cancelledRef.current) return;
      setSinceCelebration(newSince);
      setSinceFull(newSinceFull);
      nextNumber();
      return;
    }

    await speak(COUNT_PROMPTS.wrong);
    if (cancelledRef.current) return;
    await delay(600);
    if (cancelledRef.current) return;
    await countItOut();
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
        await saveGameState('howmany', 0, newCompletions);
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
    if (!adaptiveRef.current) await saveGameState('howmany', nextIndex, newCompletions);
    setIndex(nextIndex);
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
        <h1 className="text-center text-4xl font-extrabold text-indigo-500">You know your numbers!</h1>
        <div className="text-6xl">⭐⭐⭐</div>
        <div className="flex gap-4">
          <button onClick={() => { setCompletions(0); setIndex(0); startedRef.current = false; }} className="btn-kid bg-green-500">🔄 Play Again</button>
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
          <div className="text-8xl">🔢</div>
          <h1 className="text-center text-3xl font-extrabold text-indigo-600">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="animate-pulse text-xl text-gray-500">How many can you see?</p>
        </div>
      )}

      {(phase === 'looking' || phase === 'choosing' || phase === 'showing') && (
        <>
          <p className="text-2xl font-bold text-indigo-600">
            {phase === 'showing' ? "Let's count them together!" : 'How many are there?'}
          </p>
          <CountTiles tiles={tiles} counted={counted} highlight={highlight} />
          {phase === 'choosing' && (
            <div className="animate-pop-in">
              <NumberChoices choices={choices} onPick={handlePick} />
            </div>
          )}
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
