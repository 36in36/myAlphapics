'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const GAMES = [
  { id: 'animation', name: '🎬 Animation', path: '/play/animation' },
  { id: 'namegame', name: '📝 Name Game', path: '/play/namegame' },
  { id: 'single', name: '👆 Press Letter', path: '/play/single' },
  { id: 'choose2', name: '2️⃣ Choose 2', path: '/play/choose2' },
  { id: 'choose3', name: '3️⃣ Choose 3', path: '/play/choose3' },
  { id: 'choose4', name: '4️⃣ Choose 4', path: '/play/choose4' },
  { id: 'abcsong', name: '🎵 ABC Song', path: '/play/abcsong' },
  { id: 'words', name: '📖 Words', path: '/play/words' },
];

interface GameSwitcherProps {
  onBeforeSwitch?: () => void;
}

export default function GameSwitcher({ onBeforeSwitch }: GameSwitcherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(path: string) {
    if (path === pathname) {
      setOpen(false);
      return;
    }
    onBeforeSwitch?.();
    setOpen(false);
    router.push(path);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-2xl bg-white/80 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform"
        title="Switch Game"
      >
        🎮
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl p-5 shadow-2xl max-w-sm w-full mx-4 animate-pop-in"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold text-purple-600 text-center mb-4">🎮 Switch Game</h2>
            <div className="flex flex-col gap-2">
              {GAMES.map((g) => {
                const active = pathname === g.path;
                return (
                  <button
                    key={g.id}
                    onClick={() => switchTo(g.path)}
                    className={`p-3 rounded-2xl text-left text-lg font-bold transition-all ${
                      active
                        ? 'bg-green-100 border-2 border-green-400 text-green-700'
                        : 'bg-gray-50 border-2 border-transparent hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {g.name} {active && '✅'}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setOpen(false)}
              className="mt-4 w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-bold text-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
