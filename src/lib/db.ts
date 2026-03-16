import Dexie, { type Table } from 'dexie';

export interface Letter {
  id?: number;
  letter: string;
  word: string;
  imagePath: string;
  imageBlob?: Blob;
}

export interface Settings {
  id?: number;
  childName: string;
  gameMode: number;
  profileImages?: Blob[];
  gameSpeed?: number;
  wordBank?: string[];
  activated?: boolean;
  activationCode?: string;
}

export interface Progress {
  id?: number;
  childName: string;
  letter: string;
  exposureCount: number;
  totalViewTimeMs: number;
  lastViewed: number;
  interactionLevel: number;
}

export interface LetterMastery {
  id?: number;
  childName: string;
  letter: string;
  attempts: number;
  correctAttempts: number;
  lastAttempt: number;
  masteryLevel: number; // 0-5
}

export interface InteractionSession {
  id?: number;
  childName: string;
  sessionDate: number;
  gameId: string;
  successfulClicks: number;
  totalAttempts: number;
  averageResponseTimeMs: number;
}

export interface Session {
  id?: number;
  childName: string;
  gameMode: number;
  startTime: number;
  endTime?: number;
  lettersCompleted: number;
  alphabetCompletions: number;
}

export interface GameState {
  gameId: string;
  lastLetterIndex: number;
  lastPlayed: number;
  completions: number;
}

class MyAlphaPicsDB extends Dexie {
  letters!: Table<Letter>;
  settings!: Table<Settings>;
  progress!: Table<Progress>;
  sessions!: Table<Session>;
  gameState!: Table<GameState>;
  letterMastery!: Table<LetterMastery>;
  interactionSessions!: Table<InteractionSession>;

  constructor() {
    super('MyAlphaPicsDB');
    this.version(1).stores({
      letters: '++id, letter',
      settings: '++id',
      progress: '++id, [childName+letter]',
      sessions: '++id, childName',
    });
    this.version(2).stores({
      letters: '++id, letter',
      settings: '++id',
      progress: '++id, [childName+letter]',
      sessions: '++id, childName',
      gameState: 'gameId',
    });
    this.version(3).stores({
      letters: '++id, letter',
      settings: '++id',
      progress: '++id, [childName+letter]',
      sessions: '++id, childName',
      gameState: 'gameId',
      letterMastery: '++id, [childName+letter]',
      interactionSessions: '++id, childName, sessionDate',
    });
  }
}

export const db = new MyAlphaPicsDB();

const DEFAULT_LETTERS: { letter: string; word: string }[] = [
  { letter: 'A', word: 'Apple' }, { letter: 'B', word: 'Ball' },
  { letter: 'C', word: 'Cat' }, { letter: 'D', word: 'Dog' },
  { letter: 'E', word: 'Egg' }, { letter: 'F', word: 'Fish' },
  { letter: 'G', word: 'Goat' }, { letter: 'H', word: 'Hat' },
  { letter: 'I', word: 'Ice' }, { letter: 'J', word: 'Jet' },
  { letter: 'K', word: 'Kite' }, { letter: 'L', word: 'Lion' },
  { letter: 'M', word: 'Moon' }, { letter: 'N', word: 'Nest' },
  { letter: 'O', word: 'Owl' }, { letter: 'P', word: 'Pig' },
  { letter: 'Q', word: 'Queen' }, { letter: 'R', word: 'Rabbit' },
  { letter: 'S', word: 'Sun' }, { letter: 'T', word: 'Tree' },
  { letter: 'U', word: 'Umbrella' }, { letter: 'V', word: 'Violin' },
  { letter: 'W', word: 'Wagon' }, { letter: 'X', word: 'X-ray' },
  { letter: 'Y', word: 'Yo-yo' }, { letter: 'Z', word: 'Zebra' },
];

// ─── Activation ────────────────────────────────────────
export async function isActivated(): Promise<boolean> {
  const s = await getSettings();
  return s.activated === true;
}

export async function activateApp(code: string): Promise<{ valid: boolean; message: string }> {
  try {
    const res = await fetch('https://myalphapics.com/api/verify_code.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.valid) {
      await saveSettings({ activated: true, activationCode: code });
    }
    return { valid: data.valid, message: data.message };
  } catch {
    return { valid: false, message: 'Unable to connect. Please check your internet connection and try again.' };
  }
}

// ─── Init ──────────────────────────────────────────────
export async function initDB() {
  const count = await db.letters.count();
  if (count === 0) {
    await db.letters.bulkAdd(
      DEFAULT_LETTERS.map((d) => ({
        ...d,
        imagePath: `/images/${d.letter.toLowerCase()}.png`,
      }))
    );
  }
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({ childName: '', gameMode: 4 });
  }
}

// ─── Settings ──────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  const s = await db.settings.toCollection().first();
  return s || { childName: '', gameMode: 4 };
}

export async function saveSettings(settings: Partial<Settings>) {
  const existing = await db.settings.toCollection().first();
  if (existing?.id) {
    await db.settings.update(existing.id, settings);
  } else {
    await db.settings.add({ childName: '', gameMode: 4, ...settings });
  }
}

// ─── Game State (resume) ──────────────────────────────
export async function getGameState(gameId: string): Promise<GameState | undefined> {
  return db.gameState.get(gameId);
}

export async function saveGameState(gameId: string, lastLetterIndex: number, completions?: number) {
  const existing = await db.gameState.get(gameId);
  if (existing) {
    await db.gameState.update(gameId, {
      lastLetterIndex,
      lastPlayed: Date.now(),
      ...(completions !== undefined ? { completions } : {}),
    });
  } else {
    await db.gameState.put({
      gameId,
      lastLetterIndex,
      lastPlayed: Date.now(),
      completions: completions ?? 0,
    });
  }
}

export async function getAllGameStates(): Promise<GameState[]> {
  return db.gameState.toArray();
}

// ─── Exposure Tracking (Tier 1) ────────────────────────
export async function recordProgress(childName: string, letter: string, viewTimeMs: number) {
  const existing = await db.progress.where({ childName, letter }).first();
  if (existing?.id) {
    await db.progress.update(existing.id, {
      exposureCount: existing.exposureCount + 1,
      totalViewTimeMs: existing.totalViewTimeMs + viewTimeMs,
      lastViewed: Date.now(),
      interactionLevel: Math.min(existing.interactionLevel + 1, 5),
    });
  } else {
    await db.progress.add({
      childName,
      letter,
      exposureCount: 1,
      totalViewTimeMs: viewTimeMs,
      lastViewed: Date.now(),
      interactionLevel: 1,
    });
  }
}

// ─── Mastery Tracking (Tier 3) ─────────────────────────
export async function recordLetterAttempt(
  childName: string,
  letter: string,
  correct: boolean,
  responseTimeMs: number,
  gameId: string
) {
  // Update mastery
  const existing = await db.letterMastery.where({ childName, letter }).first();
  const now = Date.now();

  if (existing?.id) {
    const attempts = existing.attempts + 1;
    const correctAttempts = existing.correctAttempts + (correct ? 1 : 0);
    const accuracy = correctAttempts / attempts;
    const masteryLevel = Math.min(Math.floor(accuracy * 5), 5);

    await db.letterMastery.update(existing.id, {
      attempts,
      correctAttempts,
      lastAttempt: now,
      masteryLevel,
    });
  } else {
    await db.letterMastery.add({
      childName,
      letter,
      attempts: 1,
      correctAttempts: correct ? 1 : 0,
      lastAttempt: now,
      masteryLevel: correct ? 1 : 0,
    });
  }

  // Update interaction session for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const sessions = await db.interactionSessions
    .where({ childName })
    .filter(s => s.sessionDate === todayMs && s.gameId === gameId)
    .toArray();

  const session = sessions[0];

  if (session?.id) {
    const newTotal = session.totalAttempts + 1;
    const newSuccessful = session.successfulClicks + (correct ? 1 : 0);
    const newAvg = Math.round(
      ((session.averageResponseTimeMs * session.totalAttempts) + responseTimeMs) / newTotal
    );

    await db.interactionSessions.update(session.id, {
      totalAttempts: newTotal,
      successfulClicks: newSuccessful,
      averageResponseTimeMs: newAvg,
    });
  } else {
    await db.interactionSessions.add({
      childName,
      sessionDate: todayMs,
      gameId,
      successfulClicks: correct ? 1 : 0,
      totalAttempts: 1,
      averageResponseTimeMs: responseTimeMs,
    });
  }

  // Also record exposure
  await recordProgress(childName, letter, responseTimeMs);
}

// ─── Reporting Queries ─────────────────────────────────
export async function getExposureData(childName: string): Promise<Progress[]> {
  return db.progress.where({ childName }).toArray();
}

export async function getMasteryData(childName: string): Promise<LetterMastery[]> {
  return db.letterMastery.where({ childName }).toArray();
}

export async function getInteractionHistory(childName: string, limit = 7): Promise<InteractionSession[]> {
  return db.interactionSessions
    .where({ childName })
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getComprehensiveReport(childName: string) {
  const [exposureData, masteryData, interactionHistory] = await Promise.all([
    getExposureData(childName),
    getMasteryData(childName),
    getInteractionHistory(childName),
  ]);

  const totalAttempts = masteryData.reduce((s, m) => s + m.attempts, 0);
  const totalCorrect = masteryData.reduce((s, m) => s + m.correctAttempts, 0);
  const overallAccuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;
  const lettersStarted = masteryData.filter(m => m.attempts > 0).length;
  const lettersMastered = masteryData.filter(m => m.masteryLevel >= 4).length;

  return {
    exposureData,
    masteryData,
    interactionHistory,
    overallAccuracy,
    lettersStarted,
    lettersMastered,
  };
}

// ─── Adaptive Letter Selection ─────────────────────────
export async function selectFocusLetters(childName: string, count = 3): Promise<string[]> {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const masteryData = await getMasteryData(childName);
  const exposureData = await getExposureData(childName);

  // Build a score for each letter (lower = needs more practice)
  const letterScores = ALPHABET.map(letter => {
    const mastery = masteryData.find(m => m.letter === letter);
    const exposure = exposureData.find(e => e.letter === letter);

    const masteryLevel = mastery?.masteryLevel ?? 0;
    const exposureCount = exposure?.exposureCount ?? 0;
    const lastAttempt = mastery?.lastAttempt ?? 0;

    // Score: mastery weight + exposure weight + recency weight
    // Lower score = higher priority for practice
    const score = (masteryLevel * 10) + (Math.min(exposureCount, 10)) + 
      (lastAttempt > 0 ? Math.min((Date.now() - lastAttempt) / 86400000, 5) * -1 : -5);

    return { letter, score, masteryLevel };
  });

  // Sort by score ascending (lowest mastery first)
  letterScores.sort((a, b) => a.score - b.score);

  // Pick the top N letters that need the most practice
  return letterScores.slice(0, count).map(l => l.letter);
}
