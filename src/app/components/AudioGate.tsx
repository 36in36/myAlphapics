'use client';

import { useEffect, useState } from 'react';
import { setAudioGateHandler, unlockAudio } from '@/lib/audio';

/**
 * Full-screen tap gate that unlocks audio playback.
 *
 * iOS creates every AudioContext suspended and a fresh one is created on every
 * page load (static export means full page loads between screens), so a real
 * user gesture is required on each game screen before anything can be spoken.
 *
 * Appears automatically: speak() signals this component when audio is still
 * locked, so pages that never speak never show it.
 */
export default function AudioGate() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAudioGateHandler(() => setShow(true));
    return () => setAudioGateHandler(null);
  }, []);

  if (!show) return null;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    await unlockAudio();
    setShow(false);
  };

  return (
    <div
      onClick={start}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-sky-50/95 backdrop-blur-sm p-8"
    >
      <button
        onClick={start}
        disabled={busy}
        aria-label="Tap to start the sound"
        className="flex h-44 w-44 items-center justify-center rounded-full bg-blue-500 text-7xl
                   shadow-xl transition-transform active:scale-95 disabled:opacity-70
                   animate-pulse"
      >
        {busy ? '⏳' : '🔊'}
      </button>
      <p className="text-3xl font-extrabold text-blue-600">
        {busy ? 'Starting…' : 'Tap to Start'}
      </p>
      <p className="text-center text-base font-semibold text-slate-500">
        Make sure your sound is turned on!
      </p>
    </div>
  );
}
