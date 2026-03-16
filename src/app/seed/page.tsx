'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, initDB, getSettings } from '@/lib/db';

// Letters John is great at (his name)
const STRONG_LETTERS = ['J', 'O', 'H', 'N'];
// Letters John struggles with
const WEAK_LETTERS = ['M', 'Q', 'W'];
// Everything else — moderate
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MODERATE_LETTERS = ALL_LETTERS.filter(
  l => !STRONG_LETTERS.includes(l) && !WEAK_LETTERS.includes(l)
);

const GAMES = ['single', 'choose2', 'choose3', 'choose4', 'animation'];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number) {
  return Date.now() - days * 86400000 + randomBetween(0, 43200000);
}

function dayStartMs(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function seedData(): Promise<string> {
  await initDB();
  const settings = await getSettings();
  const CHILD_NAME = settings.childName || 'JOHN';

  // Clear existing progress data
  await db.progress.clear();
  await db.letterMastery.clear();
  await db.interactionSessions.clear();

  // --- Exposure / Progress ---
  for (const letter of ALL_LETTERS) {
    let exposureCount: number, totalViewTimeMs: number, interactionLevel: number, lastViewed: number;

    if (STRONG_LETTERS.includes(letter)) {
      exposureCount = randomBetween(25, 40);
      totalViewTimeMs = exposureCount * randomBetween(3000, 5000);
      interactionLevel = 5;
      lastViewed = daysAgo(0); // played today
    } else if (WEAK_LETTERS.includes(letter)) {
      exposureCount = randomBetween(5, 10);
      totalViewTimeMs = exposureCount * randomBetween(4000, 7000);
      interactionLevel = randomBetween(1, 2);
      lastViewed = daysAgo(randomBetween(1, 3));
    } else {
      exposureCount = randomBetween(12, 22);
      totalViewTimeMs = exposureCount * randomBetween(3000, 5000);
      interactionLevel = randomBetween(3, 4);
      lastViewed = daysAgo(randomBetween(0, 2));
    }

    await db.progress.add({
      childName: CHILD_NAME,
      letter,
      exposureCount,
      totalViewTimeMs,
      lastViewed,
      interactionLevel,
    });
  }

  // --- Letter Mastery ---
  for (const letter of ALL_LETTERS) {
    let attempts: number, correctAttempts: number, masteryLevel: number, lastAttempt: number;

    if (STRONG_LETTERS.includes(letter)) {
      attempts = randomBetween(18, 30);
      correctAttempts = attempts - randomBetween(0, 2); // 90-100% accuracy
      masteryLevel = 5;
      lastAttempt = daysAgo(0);
    } else if (WEAK_LETTERS.includes(letter)) {
      attempts = randomBetween(6, 12);
      correctAttempts = randomBetween(2, Math.floor(attempts * 0.4)); // 20-40% accuracy
      masteryLevel = randomBetween(0, 1);
      lastAttempt = daysAgo(randomBetween(1, 3));
    } else {
      attempts = randomBetween(10, 20);
      correctAttempts = Math.floor(attempts * (0.6 + Math.random() * 0.25)); // 60-85%
      masteryLevel = randomBetween(2, 4);
      lastAttempt = daysAgo(randomBetween(0, 2));
    }

    await db.letterMastery.add({
      childName: CHILD_NAME,
      letter,
      attempts,
      correctAttempts,
      lastAttempt,
      masteryLevel,
    });
  }

  // --- Interaction Sessions (7 days of play history) ---
  for (let day = 6; day >= 0; day--) {
    const sessionDate = dayStartMs(day);
    // 1-3 games played per day
    const gamesPlayed = randomBetween(1, 3);
    const pickedGames = [...GAMES].sort(() => Math.random() - 0.5).slice(0, gamesPlayed);

    for (const gameId of pickedGames) {
      const totalAttempts = randomBetween(8, 26);
      // Accuracy improves over time (more recent = better)
      const baseAccuracy = 0.5 + (6 - day) * 0.05 + Math.random() * 0.15;
      const successfulClicks = Math.min(
        Math.floor(totalAttempts * Math.min(baseAccuracy, 0.95)),
        totalAttempts
      );

      await db.interactionSessions.add({
        childName: CHILD_NAME,
        sessionDate,
        gameId,
        successfulClicks,
        totalAttempts,
        averageResponseTimeMs: randomBetween(1500, 4500),
      });
    }
  }

  return CHILD_NAME;
}

export default function SeedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'seeding' | 'done'>('idle');
  const [seededName, setSeededName] = useState('');

  async function handleSeed() {
    setStatus('seeding');
    const name = await seedData();
    setSeededName(name);
    setStatus('done');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 to-pink-300 flex flex-col items-center justify-center p-6 text-center gap-6">
      <div className="text-6xl">🌱</div>
      <h1 className="text-3xl font-bold text-white drop-shadow-lg">Seed Demo Data</h1>
      <p className="text-white/90 max-w-md">
        Populates 7 days of realistic play data for <strong>John</strong>. 
        He&apos;s great at <strong>J, O, H, N</strong> (his name!) but struggling with <strong>M, Q, W</strong>.
      </p>
      <p className="text-white/70 text-sm">⚠️ This clears existing progress data.</p>

      {status === 'idle' && (
        <button
          onClick={handleSeed}
          className="bg-white text-purple-600 font-bold text-xl px-8 py-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Plant the Seeds! 🌱
        </button>
      )}

      {status === 'seeding' && (
        <div className="text-white text-xl animate-pulse">Seeding data...</div>
      )}

      {status === 'done' && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-white text-xl font-bold">✅ Done! Data planted for {seededName}.</div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/reports')}
              className="bg-white text-purple-600 font-bold px-6 py-3 rounded-full shadow-lg hover:scale-105 transition-transform"
            >
              📊 View Reports
            </button>
            <button
              onClick={() => router.push('/play/adaptive')}
              className="bg-white text-green-600 font-bold px-6 py-3 rounded-full shadow-lg hover:scale-105 transition-transform"
            >
              🧠 Smart Practice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
