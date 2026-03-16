// Adaptive Learning Session Manager
// Stores session state in sessionStorage so it persists across page navigations
// but resets when the browser tab closes (appropriate for a learning session).

import { selectFocusLetters, getMasteryData } from './db';

export type AdaptiveLevel = 'animation' | 'single' | 'choose2' | 'choose3' | 'choose4';

const LEVEL_ORDER: AdaptiveLevel[] = ['animation', 'single', 'choose2', 'choose3', 'choose4'];

const LEVEL_NAMES: Record<AdaptiveLevel, string> = {
  animation: 'Watch & Learn',
  single: 'Press the Letter',
  choose2: 'Pick from Two',
  choose3: 'Pick from Three',
  choose4: 'Pick from Four',
};

const LEVEL_DESCRIPTIONS: Record<AdaptiveLevel, string> = {
  animation: "Let's watch and learn these letters!",
  single: "Now try pressing the right letter!",
  choose2: "Can you pick the right one from two?",
  choose3: "Getting harder — three choices!",
  choose4: "Challenge mode — four choices!",
};

const LEVEL_EMOJI: Record<AdaptiveLevel, string> = {
  animation: '👀',
  single: '👆',
  choose2: '✌️',
  choose3: '🤟',
  choose4: '🖐️',
};

export interface AdaptiveSessionState {
  focusLetters: string[];
  currentLevel: AdaptiveLevel;
  childName: string;
  roundNumber: number; // how many times we've picked new focus letters
  startedAt: number;
}

const STORAGE_KEY = 'adaptiveSession';

export function getAdaptiveSession(): AdaptiveSessionState | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAdaptiveSession(state: AdaptiveSessionState): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearAdaptiveSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function startAdaptiveSession(childName: string): Promise<AdaptiveSessionState> {
  const focusLetters = await selectFocusLetters(childName, 3);
  const state: AdaptiveSessionState = {
    focusLetters,
    currentLevel: 'animation',
    childName,
    roundNumber: 1,
    startedAt: Date.now(),
  };
  saveAdaptiveSession(state);
  return state;
}

export function getGamePathForLevel(level: AdaptiveLevel): string {
  switch (level) {
    case 'animation': return '/play/animation';
    case 'single': return '/play/single';
    case 'choose2': return '/play/choose2';
    case 'choose3': return '/play/choose3';
    case 'choose4': return '/play/choose4';
  }
}

export function getNextLevel(current: AdaptiveLevel): AdaptiveLevel | null {
  const idx = LEVEL_ORDER.indexOf(current);
  if (idx < LEVEL_ORDER.length - 1) return LEVEL_ORDER[idx + 1];
  return null; // completed all levels
}

export function getLevelIndex(level: AdaptiveLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export async function advanceAdaptiveSession(): Promise<{
  state: AdaptiveSessionState;
  action: 'next-level' | 'new-round' | 'complete';
}> {
  const session = getAdaptiveSession();
  if (!session) throw new Error('No adaptive session active');

  const nextLevel = getNextLevel(session.currentLevel);

  if (nextLevel) {
    // Move to next difficulty level with same focus letters
    session.currentLevel = nextLevel;
    saveAdaptiveSession(session);
    return { state: session, action: 'next-level' };
  }

  // Completed all 5 levels — check if focus letters are mastered
  const masteryData = await getMasteryData(session.childName);
  const allMastered = session.focusLetters.every(letter => {
    const m = masteryData.find(d => d.letter === letter);
    return m && m.masteryLevel >= 4;
  });

  if (allMastered) {
    // Pick new focus letters and start over
    const newFocus = await selectFocusLetters(session.childName, 3);
    // Check if we've run out of letters to practice (all mastered)
    const allLettersMastered = masteryData.filter(m => m.masteryLevel >= 4).length >= 26;
    if (allLettersMastered) {
      clearAdaptiveSession();
      return { state: session, action: 'complete' };
    }
    session.focusLetters = newFocus;
    session.currentLevel = 'animation';
    session.roundNumber += 1;
    saveAdaptiveSession(session);
    return { state: session, action: 'new-round' };
  }

  // Not all mastered — session is done for now
  clearAdaptiveSession();
  return { state: session, action: 'complete' };
}

export { LEVEL_ORDER, LEVEL_NAMES, LEVEL_DESCRIPTIONS, LEVEL_EMOJI };
