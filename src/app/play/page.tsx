'use client';

import { useEffect, useState } from 'react';
import { initDB, getSettings, getAllGameStates, type GameState } from '@/lib/db';
import { LETTER_GAMES, NUMBER_GAMES, type GameDef } from '@/lib/games';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Games resume by index; letters show the letter, numbers show the number. */
function resumeLabel(game: GameDef, state: GameState): string {
  return game.category === 'numbers'
    ? String(state.lastLetterIndex + 1)
    : ALPHABET[state.lastLetterIndex] || '?';
}

function formatResume(game: GameDef, state: GameState): string {
  const completionsText = state.completions > 0 ? ` • ${state.completions}× completed` : '';
  return `Left off at: ${resumeLabel(game, state)}${completionsText}`;
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
  const [childName, setChildName] = useState('');
  const [gameStates, setGameStates] = useState<Record<string, GameState>>({});

  useEffect(() => {
    initDB().then(async () => {
      const s = await getSettings();
      setChildName(s.childName);
      const states = await getAllGameStates();
      const map: Record<string, GameState> = {};
      for (const gs of states) map[gs.gameId] = gs;
      setGameStates(map);
    });
  }, []);

  function handlePlay(game: GameDef, restart?: boolean) {
    // Plain navigation, not router.push: RSC navigation is broken in the
    // static export, and a full load is what recreates the AudioContext the
    // tap gate then unlocks.
    window.location.href = restart ? `${game.path}/?start=0` : `${game.path}/`;
  }

  function renderGame(game: GameDef) {
    const state = gameStates[game.gameId];
    const hasProgress = state && !game.noResume && state.lastLetterIndex > 0;

    return (
      <div key={game.path} className={`bg-gradient-to-r ${game.color} overflow-hidden rounded-2xl text-white shadow-lg`}>
        <button
          onClick={() => handlePlay(game)}
          className="w-full transform p-4 text-left transition-all hover:scale-[1.01] active:scale-95"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{game.emoji}</span>
            <div className="flex-1">
              <p className="text-lg font-extrabold">{game.name}</p>
              <p className="text-sm opacity-90">{game.desc}</p>
              {hasProgress && (
                <p className="mt-1 text-xs opacity-80">
                  📍 {formatResume(game, state)} • {timeAgo(state.lastPlayed)}
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
              className="flex-1 py-2 text-sm font-bold opacity-90 transition-all hover:bg-white/10 hover:opacity-100"
            >
              ▶️ Continue from {resumeLabel(game, state)}
            </button>
            <div className="w-px bg-white/20" />
            <button
              onClick={() => handlePlay(game, true)}
              className="flex-1 py-2 text-sm font-bold opacity-90 transition-all hover:bg-white/10 hover:opacity-100"
            >
              🔄 Start over
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg p-4">
      <div className="mb-6 flex items-center gap-4">
        <a href="/" className="text-3xl">⬅️</a>
        <h1 className="text-3xl font-extrabold text-green-600">🎮 Pick a Game!</h1>
      </div>

      {childName && (
        <p className="mb-4 text-center text-lg font-semibold text-blue-600">
          Playing as {childName} 👋
        </p>
      )}

      {/* ── Letters ───────────────────────────────────────────── */}
      <a
        href="/play/adaptive/"
        className="mb-3 block transform rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 p-5 text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">🧠</span>
          <div className="flex-1">
            <p className="text-xl font-extrabold">Smart Practice</p>
            <p className="text-sm opacity-90">Picks the letters you need, then all 5 levels!</p>
          </div>
          <span className="text-2xl">▶️</span>
        </div>
      </a>

      <p className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-400">
        Letter games
      </p>
      <div className="mb-7 flex flex-col gap-3">{LETTER_GAMES.map(renderGame)}</div>

      {/* ── Numbers ───────────────────────────────────────────── */}
      <p className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-400">
        Numbers
      </p>

      <a
        href="/play/numbers/"
        className="mb-3 block transform rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-5 text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">🧮</span>
          <div className="flex-1">
            <p className="text-xl font-extrabold">Numbers Practice</p>
            <p className="text-sm opacity-90">Picks the numbers you need, then all 4 levels!</p>
          </div>
          <span className="text-2xl">▶️</span>
        </div>
      </a>

      <div className="flex flex-col gap-3">{NUMBER_GAMES.map(renderGame)}</div>

      <p className="mt-6 px-1 text-center text-xs text-gray-400">
        Counting uses the photos you already added for letters.{' '}
        <a href="/manage/counting/" className="underline">Set up your own sets</a>
      </p>
    </div>
  );
}
