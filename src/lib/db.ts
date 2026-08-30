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
  /** Highest number the Numbers modes count to. 5 by default, 10 once ready. */
  maxCount?: number;
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

/** Mirrors LetterMastery for the Numbers modes. Kept in its own table so the
 *  letter reports stay letter-only. */
export interface NumberMastery {
  id?: number;
  childName: string;
  number: number;
  attempts: number;
  correctAttempts: number;
  lastAttempt: number;
  masteryLevel: number; // 0-5
}

/** A named set of countable photos, e.g. "Our Family". Optional — the Numbers
 *  modes fall back to photos the parent already loaded for letters. */
export interface CountGroup {
  id?: number;
  name: string;
  createdAt: number;
}

export interface CountItem {
  id?: number;
  groupId: number;
  label: string;
  imagePath: string;
  imageBlob?: Blob;
}

/** A single real photo with countable things marked on it, for Photo Count.
 *  Regions are normalized 0-1 coordinates so they survive any display size. */
export interface CountScene {
  id?: number;
  name: string;
  imageBlob: Blob;
  regions: { x: number; y: number }[];
  createdAt: number;
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

export interface AudioClip {
  key: string;        // sha1 of the normalized phrase
  text: string;       // kept for cache inspection / debugging
  blob: Blob;
  created: number;
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
  audioCache!: Table<AudioClip>;
  numberMastery!: Table<NumberMastery>;
  countGroups!: Table<CountGroup>;
  countItems!: Table<CountItem>;
  countScenes!: Table<CountScene>;

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
    this.version(4).stores({
      letters: '++id, letter',
      settings: '++id',
      progress: '++id, [childName+letter]',
      sessions: '++id, childName',
      gameState: 'gameId',
      letterMastery: '++id, [childName+letter]',
      interactionSessions: '++id, childName, sessionDate',
      audioCache: 'key',
    });
    // v5 adds the Numbers modes. Purely additive — no store changes shape, so
    // Dexie needs no upgrade function and no existing data is touched.
    this.version(5).stores({
      letters: '++id, letter',
      settings: '++id',
      progress: '++id, [childName+letter]',
      sessions: '++id, childName',
      gameState: 'gameId',
      letterMastery: '++id, [childName+letter]',
      interactionSessions: '++id, childName, sessionDate',
      audioCache: 'key',
      numberMastery: '++id, [childName+number]',
      countGroups: '++id, name',
      countItems: '++id, groupId',
      countScenes: '++id',
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

// ---- Audio clip cache -------------------------------------------------
// Server-generated phrases (custom letter words, child name, word bank) are
// stored here so they play offline forever after the first fetch.

export async function getCachedAudio(key: string): Promise<Blob | null> {
  const row = await db.audioCache.get(key);
  return row ? row.blob : null;
}

export async function putCachedAudio(key: string, text: string, blob: Blob): Promise<void> {
  await db.audioCache.put({ key, text, blob, created: Date.now() });
}

// ---- Numbers modes ----------------------------------------------------
// Counting needs a pool of countable things. Parents already loaded photos for
// letters, so the pool is derived from those rather than asking them to do the
// work twice; curated groups are opt-in on top.

export interface CountablePhoto {
  /** Stable identity for React keys and for avoiding repeats within a round. */
  key: string;
  label: string;
  imagePath: string;
  imageBlob?: Blob;
}

/** The bundled clipart the letters game ships with, used when a family has
 *  loaded no photos yet. Counting works on a fresh install this way. */
const FALLBACK_COUNTABLES = ['B', 'C', 'D', 'F', 'G', 'L', 'P', 'R', 'S', 'T'];

/**
 * Photos the child can count, best source first:
 *   1. curated count groups, if the parent made any
 *   2. letters the parent gave a custom photo — the people they actually know
 *   3. the child's own profile photos
 *   4. bundled clipart, so the mode is never empty
 */
export async function getCountingPool(): Promise<CountablePhoto[]> {
  const curated = await db.countItems.toArray();
  if (curated.length >= 2) {
    return curated.map((it) => ({
      key: `item-${it.id}`,
      label: it.label,
      imagePath: it.imagePath,
      imageBlob: it.imageBlob,
    }));
  }

  const pool: CountablePhoto[] = [];

  const letters = await db.letters.orderBy('letter').toArray();
  for (const l of letters) {
    if (l.imageBlob && l.imagePath === '__custom__') {
      pool.push({ key: `letter-${l.letter}`, label: l.word, imagePath: l.imagePath, imageBlob: l.imageBlob });
    }
  }

  const settings = await getSettings();
  (settings.profileImages ?? []).forEach((blob, i) => {
    pool.push({
      key: `profile-${i}`,
      label: settings.childName || 'Me',
      imagePath: '__custom__',
      imageBlob: blob,
    });
  });

  if (pool.length >= 2) return pool;

  // Nothing loaded yet — fall back to the clipart that ships with the app.
  const byLetter = new Map(letters.map((l) => [l.letter, l]));
  for (const letter of FALLBACK_COUNTABLES) {
    const l = byLetter.get(letter);
    if (l) pool.push({ key: `default-${letter}`, label: l.word, imagePath: l.imagePath });
  }
  return pool;
}

/** How high this child counts. Defaults to 5; cardinality is built on small sets. */
export async function getMaxCount(): Promise<number> {
  const s = await getSettings();
  const n = s.maxCount ?? 5;
  return Math.min(Math.max(n, 3), 10);
}

// ─── Count groups & items (parent-curated sets) ────────
export async function getCountGroups(): Promise<CountGroup[]> {
  return db.countGroups.orderBy('name').toArray();
}

export async function addCountGroup(name: string): Promise<number> {
  return (await db.countGroups.add({ name, createdAt: Date.now() })) as number;
}

export async function deleteCountGroup(groupId: number): Promise<void> {
  await db.countItems.where({ groupId }).delete();
  await db.countGroups.delete(groupId);
}

export async function getCountItems(groupId: number): Promise<CountItem[]> {
  return db.countItems.where({ groupId }).toArray();
}

export async function addCountItem(groupId: number, label: string, imageBlob: Blob): Promise<void> {
  await db.countItems.add({ groupId, label, imagePath: '__custom__', imageBlob });
}

export async function deleteCountItem(id: number): Promise<void> {
  await db.countItems.delete(id);
}

// ─── Count scenes (one photo, countable things marked on it) ────────
export async function getCountScenes(): Promise<CountScene[]> {
  return db.countScenes.toArray();
}

export async function addCountScene(
  name: string,
  imageBlob: Blob,
  regions: { x: number; y: number }[]
): Promise<void> {
  await db.countScenes.add({ name, imageBlob, regions, createdAt: Date.now() });
}

export async function deleteCountScene(id: number): Promise<void> {
  await db.countScenes.delete(id);
}

// ─── Number mastery ────────────────────────────────────
// Only the modes that ask a question record mastery. Count Along, Count With Me
// and Photo Count are procedural practice: the child cannot get them "wrong", so
// scoring them would inflate mastery to 5 and Smart Practice would stop offering
// numbers the child still can't identify. Those modes record exposure instead.

/** Daily interaction rollup only — no mastery signal. */
export async function recordNumberExposure(
  childName: string,
  gameId: string,
  responseTimeMs: number
) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const sessions = await db.interactionSessions
    .where({ childName })
    .filter((s) => s.sessionDate === todayMs && s.gameId === gameId)
    .toArray();
  const session = sessions[0];

  if (session?.id) {
    const newTotal = session.totalAttempts + 1;
    const newAvg = Math.round(
      ((session.averageResponseTimeMs * session.totalAttempts) + responseTimeMs) / newTotal
    );
    await db.interactionSessions.update(session.id, {
      totalAttempts: newTotal,
      successfulClicks: session.successfulClicks + 1,
      averageResponseTimeMs: newAvg,
    });
  } else {
    await db.interactionSessions.add({
      childName,
      sessionDate: todayMs,
      gameId,
      successfulClicks: 1,
      totalAttempts: 1,
      averageResponseTimeMs: responseTimeMs,
    });
  }
}

export async function recordNumberAttempt(
  childName: string,
  value: number,
  correct: boolean,
  responseTimeMs: number,
  gameId: string
) {
  const existing = await db.numberMastery.where({ childName, number: value }).first();
  const now = Date.now();

  if (existing?.id) {
    const attempts = existing.attempts + 1;
    const correctAttempts = existing.correctAttempts + (correct ? 1 : 0);
    const masteryLevel = Math.min(Math.floor((correctAttempts / attempts) * 5), 5);
    await db.numberMastery.update(existing.id, { attempts, correctAttempts, lastAttempt: now, masteryLevel });
  } else {
    await db.numberMastery.add({
      childName,
      number: value,
      attempts: 1,
      correctAttempts: correct ? 1 : 0,
      lastAttempt: now,
      masteryLevel: correct ? 1 : 0,
    });
  }

  // Daily interaction rollup, shared with the letter games.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const sessions = await db.interactionSessions
    .where({ childName })
    .filter((s) => s.sessionDate === todayMs && s.gameId === gameId)
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
}

export async function getNumberMasteryData(childName: string): Promise<NumberMastery[]> {
  return db.numberMastery.where({ childName }).toArray();
}

/** Mirrors selectFocusLetters: lowest mastery and least recently practised first. */
export async function selectFocusNumbers(
  childName: string,
  count = 3,
  maxCount = 5
): Promise<number[]> {
  const masteryData = await getNumberMasteryData(childName);
  const all = Array.from({ length: maxCount }, (_, i) => i + 1);

  const scored = all.map((value) => {
    const mastery = masteryData.find((m) => m.number === value);
    const masteryLevel = mastery?.masteryLevel ?? 0;
    const attempts = mastery?.attempts ?? 0;
    const lastAttempt = mastery?.lastAttempt ?? 0;
    const score = (masteryLevel * 10) + Math.min(attempts, 10) +
      (lastAttempt > 0 ? Math.min((Date.now() - lastAttempt) / 86400000, 5) * -1 : -5);
    return { value, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, Math.min(count, all.length)).map((s) => s.value);
}
