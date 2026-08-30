// Numbers Smart Practice session manager.
//
// A sibling of adaptiveSession.ts rather than a shared engine: that module is
// letter-specific down to its query params (`letters=`) and its mastery source,
// and it is a working feature. Keeping the ladders apart means shipping Numbers
// cannot break Letters. Folding the two into one engine with a `subject` field
// is a worthwhile follow-up, not a prerequisite.
//
// Session state lives in sessionStorage so it survives the full page loads
// between games but resets when the tab closes.

import { selectFocusNumbers, getNumberMasteryData, getMaxCount } from './db';

export type NumberLevel = 'countwithme' | 'countalong' | 'howmany2' | 'howmany3';

const LEVEL_ORDER: NumberLevel[] = ['countwithme', 'countalong', 'howmany2', 'howmany3'];

const LEVEL_NAMES: Record<NumberLevel, string> = {
  countwithme: 'Count With Me',
  countalong: 'Count Along',
  howmany2: 'How Many? (2 choices)',
  howmany3: 'How Many? (3 choices)',
};

const LEVEL_DESCRIPTIONS: Record<NumberLevel, string> = {
  countwithme: "Let's watch and count these together!",
  countalong: 'Now tap each one as we count!',
  howmany2: 'Can you pick the right number from two?',
  howmany3: 'Getting harder — three numbers to choose from!',
};

const LEVEL_EMOJI: Record<NumberLevel, string> = {
  countwithme: '👀',
  countalong: '👆',
  howmany2: '✌️',
  howmany3: '🤟',
};

export interface NumbersSessionState {
  focusNumbers: number[];
  currentLevel: NumberLevel;
  childName: string;
  roundNumber: number;
  startedAt: number;
}

const STORAGE_KEY = 'numbersSession';

export function getNumbersSession(): NumbersSessionState | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveNumbersSession(state: NumbersSessionState): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearNumbersSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function startNumbersSession(childName: string): Promise<NumbersSessionState> {
  const maxCount = await getMaxCount();
  const focusNumbers = await selectFocusNumbers(childName, 3, maxCount);
  const state: NumbersSessionState = {
    focusNumbers,
    currentLevel: 'countwithme',
    childName,
    roundNumber: 1,
    startedAt: Date.now(),
  };
  saveNumbersSession(state);
  return state;
}

/** Path plus any level-specific query, ready for the `mode=adaptive` suffix. */
export function getGamePathForLevel(level: NumberLevel): string {
  switch (level) {
    case 'countwithme': return '/play/countwithme';
    case 'countalong': return '/play/countalong';
    case 'howmany2': return '/play/howmany';
    case 'howmany3': return '/play/howmany';
  }
}

export function getChoiceCountForLevel(level: NumberLevel): number | null {
  switch (level) {
    case 'howmany2': return 2;
    case 'howmany3': return 3;
    default: return null;
  }
}

export function getNextLevel(current: NumberLevel): NumberLevel | null {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
}

export function getLevelIndex(level: NumberLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export async function advanceNumbersSession(): Promise<{
  state: NumbersSessionState;
  action: 'next-level' | 'new-round' | 'complete';
}> {
  const session = getNumbersSession();
  if (!session) throw new Error('No numbers session active');

  const nextLevel = getNextLevel(session.currentLevel);
  if (nextLevel) {
    session.currentLevel = nextLevel;
    saveNumbersSession(session);
    return { state: session, action: 'next-level' };
  }

  const maxCount = await getMaxCount();
  const masteryData = await getNumberMasteryData(session.childName);
  const allMastered = session.focusNumbers.every((value) => {
    const m = masteryData.find((d) => d.number === value);
    return m && m.masteryLevel >= 4;
  });

  if (allMastered) {
    const everythingMastered =
      masteryData.filter((m) => m.masteryLevel >= 4 && m.number <= maxCount).length >= maxCount;
    if (everythingMastered) {
      clearNumbersSession();
      return { state: session, action: 'complete' };
    }
    session.focusNumbers = await selectFocusNumbers(session.childName, 3, maxCount);
    session.currentLevel = 'countwithme';
    session.roundNumber += 1;
    saveNumbersSession(session);
    return { state: session, action: 'new-round' };
  }

  clearNumbersSession();
  return { state: session, action: 'complete' };
}

export { LEVEL_ORDER, LEVEL_NAMES, LEVEL_DESCRIPTIONS, LEVEL_EMOJI };
