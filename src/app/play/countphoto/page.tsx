'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initDB, getCountScenes, recordNumberExposure, getSettings, type CountScene } from '@/lib/db';
import { speak } from '@/lib/audio';
import { playPop, playCheer } from '@/lib/sounds';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import confetti from 'canvas-confetti';
import GameSwitcher from '@/app/components/GameSwitcher';
import Celebration from '@/app/components/Celebration';
import { useChildProfile } from '@/lib/useChildProfile';
import { useGameSpeed } from '@/lib/useGameSpeed';
import { shouldCelebrate, personalize, type CelebrationCheck } from '@/lib/celebrationSchedule';
import { countBeat, cardinalRecap, countGreeting, COUNT_PROMPTS } from '@/lib/countingPhrases';

type Phase = 'loading' | 'empty' | 'intro' | 'counting' | 'total' | 'celebrate' | 'complete';

interface LoadedScene {
  scene: CountScene;
  url: string;
}

export default function CountPhotoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CountPhoto />
    </Suspense>
  );
}

/**
 * Counting the things inside one real photo — "how many cousins?"
 *
 * The most authentic version of the idea and the only one that needs setup:
 * a parent marks where the countable things are, in /manage/counting. Without
 * that the app cannot know whether the person in the background counts.
 */
function CountPhoto() {
  const router = useRouter();
  const { delay } = useGameSpeed();
  const { getRandomPhoto } = useChildProfile();

  const [scenes, setScenes] = useState<LoadedScene[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [tapped, setTapped] = useState<number[]>([]);
  const [childName, setChildName] = useState('');
  const [celebrationPhoto, setCelebrationPhoto] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationCheck | null>(null);
  const [sinceCelebration, setSinceCelebration] = useState(0);
  const [sinceFull, setSinceFull] = useState(0);

  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastTapRef = useRef(0);
  const urlsRef = useRef<string[]>([]);

  const currentScene = scenes[index];

  useEffect(() => {
    cancelledRef.current = false;
    requestWakeLock();
    initDB().then(async () => {
      const [rows, settings] = await Promise.all([getCountScenes(), getSettings()]);
      if (cancelledRef.current) return;
      setChildName(settings.childName);

      const usable = rows.filter((s) => s.regions.length > 0);
      if (usable.length === 0) {
        setPhase('empty');
        return;
      }
      const loaded = usable.map((scene) => {
        const url = URL.createObjectURL(scene.imageBlob);
        urlsRef.current.push(url);
        return { scene, url };
      });
      setScenes(loaded.sort(() => Math.random() - 0.5));
    });
    return () => {
      cancelledRef.current = true;
      releaseWakeLock();
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current = [];
    };
  }, []);

  const runScene = useCallback(async () => {
    if (cancelledRef.current) return;
    setTapped([]);
    setPhase('counting');
    startTimeRef.current = Date.now();
    await speak(COUNT_PROMPTS.countThePhoto);
    if (cancelledRef.current) return;
    await delay(400);
    if (cancelledRef.current) return;
    await speak(COUNT_PROMPTS.tapEach);
  }, [delay]);

  useEffect(() => {
    if (scenes.length === 0 || startedRef.current) return;
    const t = setTimeout(async () => {
      if (startedRef.current || cancelledRef.current) return;
      startedRef.current = true;
      setPhase('intro');
      await speak(countGreeting(childName));
      if (cancelledRef.current) return;
      await delay(1400);
      if (cancelledRef.current) return;
      runScene();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  useEffect(() => {
    if (scenes.length > 0 && startedRef.current && index > 0 && phase !== 'complete') {
      runScene();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  async function handleTapRegion(regionIndex: number) {
    if (phase !== 'counting' || !currentScene) return;
    if (tapped.includes(regionIndex)) return;

    const now = Date.now();
    if (now - lastTapRef.current < 250) return;
    lastTapRef.current = now;

    const next = [...tapped, regionIndex];
    setTapped(next);
    playPop();
    await speak(countBeat(next.length));
    if (cancelledRef.current) return;

    const total = currentScene.scene.regions.length;
    if (next.length === total) {
      setPhase('total');
      await recordNumberExposure(childName, 'countphoto', Date.now() - startTimeRef.current);
      await delay(400);
      if (cancelledRef.current) return;
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.35 } });
      await speak(cardinalRecap(total));
      if (cancelledRef.current) return;
      await delay(1400);
      if (cancelledRef.current) return;

      const newSince = sinceCelebration + 1;
      const newSinceFull = sinceFull + 1;
      const celebration = shouldCelebrate(index, scenes.length, newSince, newSinceFull);
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
      nextScene();
    }
  }

  async function nextScene() {
    const nextIndex = index + 1;
    if (nextIndex >= scenes.length) {
      setCelebrationPhoto(getRandomPhoto());
      setPhase('complete');
      playCheer();
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
      await speak(COUNT_PROMPTS.allDone);
      return;
    }
    setIndex(nextIndex);
  }

  function handleCelebrationComplete() {
    if (cancelledRef.current) return;
    setCelebrationData(null);
    nextScene();
  }

  if (phase === 'empty') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-7xl">🖼️</div>
        <h1 className="text-3xl font-extrabold text-rose-600">No photos to count yet</h1>
        <p className="max-w-sm text-lg text-gray-500">
          Pick a family photo and tap each person or thing in it. Then {childName || 'your child'} can
          count them here.
        </p>
        <div className="flex gap-3">
          <a href="/manage/counting/" className="btn-kid bg-rose-500">📸 Set one up</a>
          <a href="/play/" className="btn-kid bg-blue-500">🎮 Other games</a>
        </div>
      </div>
    );
  }

  if (phase === 'loading' || !currentScene) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-bounce-slow text-6xl">🖼️</div>
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
        <h1 className="text-center text-4xl font-extrabold text-rose-500">You counted every picture!</h1>
        <div className="text-6xl">⭐⭐⭐</div>
        <div className="flex gap-4">
          <button onClick={() => { setIndex(0); startedRef.current = false; setPhase('counting'); runScene(); }} className="btn-kid bg-green-500">🔄 Play Again</button>
          <button onClick={() => router.push('/')} className="btn-kid bg-blue-500">🏠 Menu</button>
        </div>
      </div>
    );
  }

  const total = currentScene.scene.regions.length;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 p-4">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <button onClick={() => { cancelledRef.current = true; router.push('/'); }} className="text-3xl">⬅️</button>
        <GameSwitcher onBeforeSwitch={() => { cancelledRef.current = true; }} />
      </div>
      <div className="absolute right-4 top-4 z-10 text-sm text-gray-400">
        Photo {index + 1}/{scenes.length}
      </div>

      {phase === 'intro' && (
        <div className="flex animate-pop-in flex-col items-center gap-6">
          <div className="text-8xl">🖼️</div>
          <h1 className="text-center text-3xl font-extrabold text-rose-600">
            {childName ? `Hi, ${childName}! 👋` : 'Hi there! 👋'}
          </h1>
          <p className="animate-pulse text-xl text-gray-500">Let&apos;s count what&apos;s in the picture!</p>
        </div>
      )}

      {(phase === 'counting' || phase === 'total') && (
        <>
          <p className="text-2xl font-bold text-rose-600">
            {phase === 'total' ? `There are ${total}!` : 'Tap each one to count!'}
          </p>

          <div className="relative inline-block max-w-full">
            <img
              src={currentScene.url}
              alt={currentScene.scene.name}
              className="block max-h-[55vh] w-auto max-w-full rounded-3xl border-4 border-rose-200 shadow-xl"
            />
            {currentScene.scene.regions.map((region, i) => {
              const order = tapped.indexOf(i);
              const isTapped = order >= 0;
              return (
                <button
                  key={i}
                  onClick={() => handleTapRegion(i)}
                  disabled={isTapped || phase !== 'counting'}
                  aria-label={isTapped ? `Counted ${order + 1}` : `Count item ${i + 1}`}
                  style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%` }}
                  className={`absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-4
                    transition-all duration-200
                    ${isTapped
                      ? 'border-green-400 bg-green-500/80 scale-100'
                      : 'border-white bg-white/25 backdrop-blur-[2px] animate-pulse hover:scale-110 active:scale-95'}`}
                >
                  {isTapped && (
                    <span className="text-2xl font-extrabold text-white drop-shadow">{order + 1}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex h-20 items-center justify-center">
            {tapped.length > 0 && (
              <span key={tapped.length} className="animate-pop-in text-7xl font-extrabold leading-none text-rose-500">
                {tapped.length}
              </span>
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
