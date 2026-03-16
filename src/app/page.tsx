'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { initDB, getSettings, isActivated } from '@/lib/db';
import ActivationGate from '@/app/components/ActivationGate';
import IOSInstallBanner from '@/app/components/IOSInstallBanner';

export default function Home() {
  const [childName, setChildName] = useState('');
  const [ready, setReady] = useState(false);
  const [activated, setActivated] = useState(false);
  const [checkingActivation, setCheckingActivation] = useState(true);

  useEffect(() => {
    initDB().then(async () => {
      const s = await getSettings();
      setChildName(s.childName);
      const active = await isActivated();
      setActivated(active);
      setCheckingActivation(false);
      setReady(true);
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  if (!ready || checkingActivation) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-4xl animate-bounce-slow">🔤</div>
    </div>
  );

  if (!activated) return (
    <ActivationGate onActivated={() => setActivated(true)} />
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
      <div className="animate-pop-in">
        <Image
          src="/images/myalphapics.jpg"
          alt="MyAlphaPics"
          width={560}
          height={560}
          className="rounded-3xl shadow-2xl"
          priority
        />
      </div>

      {childName && (
        <p className="text-xl text-blue-600 font-semibold animate-slide-up">
          Hi, {childName}! 👋
        </p>
      )}

      <IOSInstallBanner />

      <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up">
        <a href="/play/adaptive/" className="btn-kid bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-center text-xl shadow-lg">
          🧠 Smart Practice
        </a>
        <a href="/play/" className="btn-kid bg-green-500 text-center">
          🎮 Play Game
        </a>
        <a href="/manage/" className="btn-kid bg-blue-500 text-center">
          📸 Management
        </a>
        <a href="/settings/" className="btn-kid bg-purple-500 text-center">
          ⚙️ Settings
        </a>
        <a href="/reports/" className="btn-kid bg-orange-500 text-center">
          📊 Reports
        </a>
      </div>
    </div>
  );
}
