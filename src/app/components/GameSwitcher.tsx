'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LETTER_GAMES, NUMBER_GAMES, categoryForPath, type GameDef } from '@/lib/games';

interface GameSwitcherProps {
  onBeforeSwitch?: () => void;
}

export default function GameSwitcher({ onBeforeSwitch }: GameSwitcherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Open on the list the child is already in. Fourteen games in one column is a
  // scroll; the other subject is one tap away behind the toggle.
  const [tab, setTab] = useState(() => categoryForPath(pathname));
  const games = tab === 'numbers' ? NUMBER_GAMES : LETTER_GAMES;

  function switchTo(path: string) {
    if (path === pathname) {
      setOpen(false);
      return;
    }
    onBeforeSwitch?.();
    setOpen(false);
    router.push(path);
  }

  function renderGame(g: GameDef) {
    const active = pathname === g.path || pathname === `${g.path}/`;
    return (
      <button
        key={g.gameId}
        onClick={() => switchTo(g.path)}
        className={`rounded-2xl p-3 text-left text-lg font-bold transition-all ${
          active
            ? 'border-2 border-green-400 bg-green-100 text-green-700'
            : 'border-2 border-transparent bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
        }`}
      >
        {g.emoji} {g.shortName} {active && '✅'}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-2xl shadow-md backdrop-blur transition-transform hover:scale-110 active:scale-95"
        title="Switch Game"
      >
        🎮
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-sm animate-pop-in rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-center text-xl font-extrabold text-purple-600">🎮 Switch Game</h2>

            <div className="mb-3 flex gap-2 rounded-2xl bg-gray-100 p-1">
              <button
                onClick={() => setTab('letters')}
                className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${
                  tab === 'letters' ? 'bg-white text-purple-600 shadow' : 'text-gray-400'
                }`}
              >
                🔤 Letters
              </button>
              <button
                onClick={() => setTab('numbers')}
                className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${
                  tab === 'numbers' ? 'bg-white text-orange-600 shadow' : 'text-gray-400'
                }`}
              >
                🔢 Numbers
              </button>
            </div>

            <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
              {games.map(renderGame)}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-2xl bg-gray-100 py-3 text-lg font-bold text-gray-500 transition-colors hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
