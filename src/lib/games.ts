/**
 * Single registry for every play mode.
 *
 * The game picker (src/app/play/page.tsx) and the in-game switcher
 * (src/app/components/GameSwitcher.tsx) used to hold separate copies of this
 * list, which drifted. Both now read from here.
 */

export type GameCategory = 'letters' | 'numbers';

export interface GameDef {
  gameId: string;
  path: string;
  emoji: string;
  /** Full name, shown in the picker. */
  name: string;
  /** Short name for the in-game switcher, where space is tight. */
  shortName: string;
  desc: string;
  /** Tailwind gradient stops for the picker card. */
  color: string;
  category: GameCategory;
  /** Games that always start from the beginning don't show resume controls. */
  noResume?: boolean;
}

export const GAMES: GameDef[] = [
  // ── Letters ───────────────────────────────────────────────────────────
  {
    gameId: 'animation', path: '/play/animation', emoji: '🎬',
    name: 'Letter Animation', shortName: 'Animation',
    desc: 'Watch letters come alive!',
    color: 'from-pink-400 to-red-400', category: 'letters',
  },
  {
    gameId: 'namegame', path: '/play/namegame', emoji: '📝',
    name: 'Name Game', shortName: 'Name Game',
    desc: 'Learn letters in your name!',
    color: 'from-purple-400 to-indigo-400', category: 'letters', noResume: true,
  },
  {
    gameId: 'single', path: '/play/single', emoji: '👆',
    name: 'Press the Letter', shortName: 'Press Letter',
    desc: 'Press the letter you hear!',
    color: 'from-blue-400 to-cyan-400', category: 'letters',
  },
  // Digit emoji deliberately avoided here: with Numbers modes in the same
  // picker, a 3️⃣ badge on a letter game reads as "three" to a child.
  {
    gameId: 'choose2', path: '/play/choose2', emoji: '✌️',
    name: 'Choose Between 2', shortName: 'Choose 2',
    desc: 'Pick the right letter!',
    color: 'from-green-400 to-emerald-400', category: 'letters',
  },
  {
    gameId: 'choose3', path: '/play/choose3', emoji: '🤟',
    name: 'Choose Between 3', shortName: 'Choose 3',
    desc: 'A bit more challenge!',
    color: 'from-yellow-400 to-orange-400', category: 'letters',
  },
  {
    gameId: 'choose4', path: '/play/choose4', emoji: '🖐️',
    name: 'Choose Between 4', shortName: 'Choose 4',
    desc: 'Can you find it?',
    color: 'from-orange-400 to-red-400', category: 'letters',
  },
  {
    gameId: 'abcsong', path: '/play/abcsong', emoji: '🎵',
    name: 'ABC Song', shortName: 'ABC Song',
    desc: 'Sing along!',
    color: 'from-teal-400 to-blue-400', category: 'letters', noResume: true,
  },
  {
    gameId: 'words', path: '/play/words', emoji: '📖',
    name: 'Word Learning', shortName: 'Words',
    desc: 'Learn words for each letter!',
    color: 'from-violet-400 to-purple-400', category: 'letters', noResume: true,
  },

  // ── Numbers ───────────────────────────────────────────────────────────
  {
    gameId: 'countwithme', path: '/play/countwithme', emoji: '👀',
    name: 'Count With Me', shortName: 'Count With Me',
    desc: 'Watch and count together!',
    color: 'from-amber-400 to-orange-400', category: 'numbers',
  },
  {
    gameId: 'countalong', path: '/play/countalong', emoji: '👆',
    name: 'Count Along', shortName: 'Count Along',
    desc: 'Tap each one to count!',
    color: 'from-lime-400 to-green-400', category: 'numbers',
  },
  {
    gameId: 'howmany', path: '/play/howmany', emoji: '🔢',
    name: 'How Many?', shortName: 'How Many?',
    desc: 'Count them, then pick the number!',
    color: 'from-sky-400 to-indigo-400', category: 'numbers',
  },
  {
    gameId: 'findnumber', path: '/play/findnumber', emoji: '🔟',
    name: 'Find the Number', shortName: 'Find Number',
    desc: 'Press the number you hear!',
    color: 'from-fuchsia-400 to-pink-400', category: 'numbers',
  },
  {
    gameId: 'quickcount', path: '/play/quickcount', emoji: '⚡',
    name: 'Quick Count', shortName: 'Quick Count',
    desc: 'How many? Look fast!',
    color: 'from-yellow-400 to-amber-500', category: 'numbers', noResume: true,
  },
  {
    gameId: 'countphoto', path: '/play/countphoto', emoji: '🖼️',
    name: 'Photo Count', shortName: 'Photo Count',
    desc: 'Count what you see in your photo!',
    color: 'from-rose-400 to-red-400', category: 'numbers', noResume: true,
  },
];

export const LETTER_GAMES = GAMES.filter((g) => g.category === 'letters');
export const NUMBER_GAMES = GAMES.filter((g) => g.category === 'numbers');

export function getGame(gameId: string): GameDef | undefined {
  return GAMES.find((g) => g.gameId === gameId);
}

/** Which switcher list an in-game screen belongs to, keyed by pathname. */
export function categoryForPath(pathname: string): GameCategory {
  const hit = GAMES.find((g) => pathname.startsWith(g.path));
  return hit?.category ?? 'letters';
}
