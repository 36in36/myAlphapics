'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { speak } from '@/lib/audio';
import { playPop, playCheer } from '@/lib/sounds';

export interface CelebrationProps {
  /** 'mini' = quick burst, 'full' = big show with photo + name */
  type: 'mini' | 'full';
  /** Child's photo URL (from useChildProfile) */
  photo: string | null;
  /** Child's name */
  childName: string;
  /** Text to speak (already personalized) */
  phrase: string;
  /** Called when celebration animation is done */
  onComplete: () => void;
  /** How long to show (ms). Mini default 2500, Full default 4000 */
  durationMs?: number;
}

export default function Celebration({
  type,
  photo,
  childName,
  phrase,
  onComplete,
  durationMs,
}: CelebrationProps) {
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    // Minimum time the celebration stays on screen. The real length is however
    // long the sound + phrase actually take, which is usually longer.
    const minDuration = durationMs ?? (type === 'full' ? 4000 : 2500);
    const startedAt = Date.now();
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    (async () => {
      // Sound and phrase are sequenced, not simultaneous. Previously both
      // started at once and the 7s cheer ran on over the following letters.
      if (type === 'full') {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
        setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.3, x: 0.3 } }), 300);
        setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.3, x: 0.7 } }), 600);
        await playCheer();
      } else {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.4 } });
        await playPop();
      }
      if (cancelled) return;

      // Awaited, so the next letter can no longer cut the phrase off mid-word:
      // speak() cancels whatever is currently playing when it starts.
      await speak(phrase);
      if (cancelled) return;

      await wait(600);                       // a beat before moving on
      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed < minDuration) await wait(minDuration - elapsed);
      if (!cancelled) onComplete();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (type === 'full') {
    return (
      <div className="flex flex-col items-center gap-4 animate-pop-in">
        {photo && (
          <img
            src={photo}
            alt={childName || ''}
            className="w-32 h-32 rounded-full object-cover border-4 border-yellow-300 shadow-xl animate-bounce-slow"
            style={{
              boxShadow: '0 0 30px rgba(250, 204, 21, 0.5), 0 0 60px rgba(250, 204, 21, 0.2)',
            }}
          />
        )}
        <div className="text-7xl">🎉⭐🌈</div>
        {childName && (
          <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 text-center animate-pulse">
            {childName}!
          </p>
        )}
        <p className="text-2xl font-bold text-yellow-500 text-center max-w-sm">
          {phrase}
        </p>
      </div>
    );
  }

  // Mini celebration
  return (
    <div className="flex flex-col items-center gap-3 animate-pop-in">
      {photo && (
        <img
          src={photo}
          alt={childName || ''}
          className="w-20 h-20 rounded-full object-cover border-4 border-yellow-300 shadow-lg animate-bounce"
        />
      )}
      <div className="text-6xl">🎉</div>
      <p className="text-2xl font-extrabold text-green-500 text-center">
        {phrase}
      </p>
    </div>
  );
}
