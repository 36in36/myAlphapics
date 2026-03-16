'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initDB, getSettings, getAllGameStates, type GameState } from '@/lib/db';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const GAMES = [
  { gameId: 'animation', path: '/play/animation', emoji: '🎬', name: 'Letter Animation', desc: 'Watch letters come alive!', color: 'from-pink-400 to-red-400' },
  { gameId: 'namegame', path: '/play/namegame', emoji: '📝', name: 'Name Game', desc: 'Learn letters in your name!', color: 'from-purple-400 to-indigo-400', noResume: true },
  { gameId: 'single', path: '/play/single', emoji: '👆', name: 'Press the Letter', desc: 'Press the letter you hear!', color: 'from-blue-400 to-cyan-400' },
  { gameId: 'choose2', path: '/play/choose2', emoji: '2️⃣', name: 'Choose Between 2', desc: 'Pick the right letter!', color: 'from-green-400 to-emerald-400' },
  { gameId: 'choose3', path: '/play/choose3', emoji: '3️⃣', name: 'Choose Between 3', desc: 'A bit more challenge!', color: 'from-yellow-400 to-orange-400' },
  { gameId: 'choose4', path: '/play/choose4', emoji: '4️⃣', name: 'Choose Between 4', desc: 'Can you find it?', color: 'from-orange-400 to-red-400' },
  { gameId: 'abcsong', path: '/play/abcsong', emoji: '🎵', name: 'ABC Song', desc: 'Sing along!', color: 'from-teal-400 to-blue-400', noResume: true },
  { gameId: 'words', path: '/play/words', emoji: '📖', name: 'Word Learning', desc: 'Learn words for each letter!', color: 'from-violet-400 to-purple-400', noResume: true },
];

function formatResume(state: GameState): string {
  const letter = ALPHABET[state.lastLetterIndex] || '?';
  const completionsText = state.completions > 0 ? ` • ${state.completions}× completed` : '';
  return `Left off at: ${letter}${completionsText}`;
}

function timeAgo(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PlayPage() {
  const router = useRouter();
  const [childName, setChildName] = useState('');
  const [gameStates, setGameStates] = useState<Record<string, GameState>>({});

  useEffect(() => {
    initDB().then(async () => {
      const s = await getSettings();
      setChildName(s.childName);
      const states = await getAllGameStates();
      const map: Record<string, GameState> = {};
      for (const gs of states) {
        map[gs.gameId] = gs;
      }
      setGameStates(map);
    });
  }, []);

  function handlePlay(game: typeof GAMES[0], restart?: boolean) {
    const url = restart ? `${game.path}/?start=0` : `${game.path}/`;
    window.location.href = url;
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a href="/" className="text-3xl">⬅️</a>
        <h1 className="text-3xl font-extrabold text-green-600">🎮 Pick a Game!</h1>
      </div>

      {childName && (
        <p className="text-center text-lg text-blue-600 font-semibold mb-4">
          Playing as {childName} 👋
        </p>
      )}

      {/* Smart Practice - featured */}
      <a
        href="/play/adaptive/"
        className="block bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-2xl p-5 shadow-xl text-white transform transition-all hover:scale-[1.02] active:scale-95 mb-2"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">🧠</span>
          <div className="flex-1">
            <p className="font-extrabold text-xl">Smart Practice</p>
            <p className="text-sm opacity-90">AI picks letters you need to practice, then guides you through all 5 levels!</p>
          </div>
          <span className="text-2xl">▶️</span>
        </div>
      </a>

      <p className="text-sm text-gray-400 font-semibold px-1">Or pick a game:</p>

      <div className="flex flex-col gap-3">
        {GAMES.map((game) => {
          const state = gameStates[game.gameId];
          const hasProgress = state && !game.noResume && state.lastLetterIndex > 0;

          return (
            <div key={game.path} className={`bg-gradient-to-r ${game.color} rounded-2xl shadow-lg text-white overflow-hidden`}>
              <button
                onClick={() => handlePlay(game)}
                className="w-full p-4 text-left transform transition-all hover:scale-[1.01] active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{game.emoji}</span>
                  <div className="flex-1">
                    <p className="font-extrabold text-lg">{game.name}</p>
                    <p className="text-sm opacity-90">{game.desc}</p>
                    {hasProgress && (
                      <p className="text-xs opacity-80 mt-1">
                        📍 {formatResume(state)} • {timeAgo(state.lastPlayed)}
                      </p>
                    )}
                  </div>
                  <span className="text-2xl">▶️</span>
                </div>
              </button>

              {hasProgress && (
                <div className="flex border-t border-white/20">
                  <button
                    onClick={() => handlePlay(game)}
                    className="flex-1 py-2 text-sm font-bold opacity-90 hover:opacity-100 hover:bg-white/10 transition-all"
                  >
                    ▶️ Continue from {ALPHABET[state.lastLetterIndex]}
                  </button>
                  <div className="w-px bg-white/20" />
                  <button
                    onClick={() => handlePlay(game, true)}
                    className="flex-1 py-2 text-sm font-bold opacity-90 hover:opacity-100 hover:bg-white/10 transition-all"
                  >
                    🔄 Start from A
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
