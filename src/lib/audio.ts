/**
 * Pre-generated audio playback, replacing speechSynthesis.
 *
 * Why: speechSynthesis is silently dead in iOS PWA standalone mode — verified
 * on-device, onstart never fires. See VOICE.md for the full test results.
 *
 * Every phrase resolves through one key (sha1 of the normalized text) against
 * three tiers: bundled file -> IndexedDB blob -> server generation.
 */
import { BUNDLED } from './audioManifest';
import { getCachedAudio, putCachedAudio, getSettings } from './db';

const TTS_ENDPOINT = 'https://myalphapics.com/api/tts.php';

let ctx: AudioContext | null = null;
let unlocked = false;
let unlockResolve: (() => void) | null = null;
const unlockPromise = new Promise<void>((r) => { unlockResolve = r; });

let gateListener: (() => void) | null = null;
const decodedCache = new Map<string, AudioBuffer>();
let currentSource: AudioBufferSourceNode | null = null;

const normalize = (t: string) => t.trim().replace(/\s+/g, ' ');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Function call resets TS narrowing — state genuinely changes across an await.
const isRunning = (c: AudioContext) => c.state === 'running';

export async function audioKey(text: string): Promise<string> {
  const data = new TextEncoder().encode(normalize(text));
  const digest = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

/** AudioGate registers here; speak() calls it when audio is still locked. */
export function setAudioGateHandler(fn: (() => void) | null): void {
  gateListener = fn;
}

/**
 * Must be called from inside a real user gesture handler.
 * iOS creates every AudioContext suspended, and a fresh one is created on every
 * page load — so this runs once per game screen, from the tap gate.
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (!ctx) {
      const AC = window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    // Silent buffer started inside the gesture — the proven iOS unlock.
    const silent = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);

    // resume() never rejects on iOS — it hangs until a gesture arrives. Race it.
    await Promise.race([ctx.resume().catch(() => {}), wait(1000)]);

    if (isRunning(ctx)) unlocked = true;
  } catch {
    /* fall through */
  }
  // Release waiters either way. If the unlock failed, speak() below bails out
  // on the context state — the game continues silently rather than freezing.
  unlockResolve?.();
  return unlocked;
}

export function cancelSpeech(): void {
  if (currentSource) {
    try { currentSource.stop(); } catch { /* already stopped */ }
    currentSource = null;
  }
}

async function decode(bytes: ArrayBuffer): Promise<AudioBuffer | null> {
  if (!ctx) return null;
  try {
    return await new Promise<AudioBuffer>((resolve, reject) => {
      const maybe = ctx!.decodeAudioData(bytes.slice(0), resolve, reject);
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
    });
  } catch {
    return null;
  }
}

async function fetchFromServer(phrase: string, key: string): Promise<ArrayBuffer | null> {
  try {
    const settings = await getSettings();
    const res = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: phrase, code: settings?.activationCode ?? '' }),
    });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 512) return null;   // JSON error body, not audio
    await putCachedAudio(key, phrase, new Blob([bytes], { type: 'audio/mpeg' }));
    return bytes;
  } catch {
    return null;
  }
}

async function loadBytes(phrase: string, key: string): Promise<ArrayBuffer | null> {
  if (BUNDLED.has(key)) {
    try {
      const res = await fetch(`/audio/${key}.mp3`);
      if (res.ok) return await res.arrayBuffer();
    } catch { /* fall through to the next tier */ }
  }
  const cached = await getCachedAudio(key);
  if (cached) return await cached.arrayBuffer();
  return fetchFromServer(phrase, key);
}

async function getBuffer(phrase: string): Promise<AudioBuffer | null> {
  const key = await audioKey(phrase);
  const hit = decodedCache.get(key);
  if (hit) return hit;
  const bytes = await loadBytes(phrase, key);
  if (!bytes) return null;
  const buf = await decode(bytes);
  if (buf) decodedCache.set(key, buf);
  return buf;
}

/**
 * Drop-in replacement for the old speechSynthesis speak().
 * Resolves when playback finishes, so existing `await speak(...)` sequences
 * keep their pacing.
 */
export async function speak(text: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const phrase = normalize(text);
  if (!phrase) return;

  if (!unlocked) gateListener?.();

  // Blocks until the tap gate unlocks audio. Deliberate: game intro sequences
  // pause here rather than racing ahead silently.
  await unlockPromise;
  const c = ctx;
  if (!c) return;

  // Backgrounding can re-suspend the context. Try briefly, then give up —
  // never leave a play request queued (it would fire later, over the top of
  // whatever is playing then). See VOICE.md "resume() does not reject".
  if (!isRunning(c)) {
    await Promise.race([c.resume().catch(() => {}), wait(500)]);
    if (!isRunning(c)) return;
  }

  const buf = await getBuffer(phrase);
  if (!buf) return;

  cancelSpeech();
  await new Promise<void>((resolve) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    currentSource = src;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (currentSource === src) currentSource = null;
      resolve();
    };
    src.onended = finish;
    try {
      src.start(0);
    } catch {
      finish();
      return;
    }
    setTimeout(finish, buf.duration * 1000 + 1000);   // safety net
  });
}

// Returning from the background can leave the context suspended. Best effort —
// deliberately not awaited, since resume() may never settle without a gesture.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* needs a fresh gesture */ });
    }
  });
}
