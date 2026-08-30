const isIOS = typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
   (window.navigator as any).standalone === true);

let popAudio: HTMLAudioElement | null = null;
let cheerAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

// AudioContext-based playback for iOS PWA
let audioContext: AudioContext | null = null;
const audioBuffers: Map<string, AudioBuffer> = new Map();

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AC();
    return audioContext;
  } catch {
    return null;
  }
}

async function loadBuffer(path: string): Promise<AudioBuffer | null> {
  if (audioBuffers.has(path)) return audioBuffers.get(path)!;
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    const response = await fetch(path);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBuffers.set(path, audioBuffer);
    return audioBuffer;
  } catch {
    return null;
  }
}

/**
 * Plays a buffer, optionally trimmed to maxSeconds with a short fade-out so
 * the cut is not abrupt. Returns the seconds it will actually sound for, so
 * callers can sequence speech after it instead of over it.
 */
function playBuffer(buffer: AudioBuffer, maxSeconds?: number): number {
  const ctx = getAudioContext();
  if (!ctx) return 0;
  if (ctx.state === 'suspended') ctx.resume();

  const dur = maxSeconds ? Math.min(maxSeconds, buffer.duration) : buffer.duration;
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  if (dur < buffer.duration) {
    const fade = Math.min(0.4, dur / 2);
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(1, t0);
    gain.gain.setValueAtTime(1, t0 + dur - fade);
    gain.gain.linearRampToValueAtTime(0, t0 + dur);
    source.connect(gain);
    gain.connect(ctx.destination);
  } else {
    source.connect(ctx.destination);
  }

  source.start(0, 0, dur);
  return dur;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Fade an HTMLAudioElement out and stop it — the non-AudioContext fallback. */
async function fadeOutAndStop(el: HTMLAudioElement, fadeMs = 400) {
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    el.volume = Math.max(0, 1 - i / steps);
    await wait(fadeMs / steps);
  }
  try { el.pause(); el.currentTime = 0; } catch { /* already stopped */ }
  el.volume = 1;
}

// iOS requires audio to be played from a user gesture the first time.
// Pre-load and unlock on first interaction.
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const ctx = getAudioContext();
  if (ctx) {
    // Play silent buffer to unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Preload sound files into AudioContext buffers
  loadBuffer('/sounds/pop.mp3');
  loadBuffer('/sounds/cheering.mp3');

  // Also set up HTMLAudioElement as fallback for non-iOS PWA
  if (!isIOS || !isStandalone) {
    try {
      if (!popAudio) popAudio = new Audio('/sounds/pop.mp3');
      if (!cheerAudio) cheerAudio = new Audio('/sounds/cheering.mp3');
      popAudio.volume = 0;
      popAudio.play().then(() => {
        popAudio!.pause();
        popAudio!.currentTime = 0;
        popAudio!.volume = 1;
      }).catch(() => {});
    } catch {}
  }
}

if (typeof document !== 'undefined') {
  if (isIOS && isStandalone) {
    // Persistent listeners — iOS PWA loses unlock between interactions
    ['click', 'touchstart', 'touchend', 'keydown'].forEach((evt) => {
      document.addEventListener(evt, () => {
        if (!audioUnlocked) unlockAudio();
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume();
      }, { capture: true });
    });
  } else {
    ['click', 'touchstart', 'touchend', 'keydown'].forEach((evt) => {
      document.addEventListener(evt, unlockAudio, { once: true, capture: true });
    });
  }
}

/** Resolves when the sound has finished, so callers can speak after it. */
export async function playPop() {
  if (typeof window === 'undefined') return;
  if (isIOS && isStandalone) {
    const buffer = await loadBuffer('/sounds/pop.mp3');
    if (buffer) { await wait(playBuffer(buffer) * 1000); return; }
  }
  if (!popAudio) popAudio = new Audio('/sounds/pop.mp3');
  popAudio.currentTime = 0;
  popAudio.play().catch(() => {});
  await wait(350);
}

/**
 * cheering.mp3 is 7.1s long. Played in full it ran underneath the spoken
 * celebration phrase and on into the next letter, so it is trimmed here and
 * awaited — the phrase now follows the cheer instead of fighting it.
 */
export const CHEER_SECONDS = 2.2;

export async function playCheer(maxSeconds = CHEER_SECONDS) {
  if (typeof window === 'undefined') return;
  if (isIOS && isStandalone) {
    const buffer = await loadBuffer('/sounds/cheering.mp3');
    if (buffer) { await wait(playBuffer(buffer, maxSeconds) * 1000); return; }
  }
  if (!cheerAudio) cheerAudio = new Audio('/sounds/cheering.mp3');
  cheerAudio.currentTime = 0;
  cheerAudio.volume = 1;
  cheerAudio.play().catch(() => {});
  await wait(Math.max(0, maxSeconds * 1000 - 400));
  await fadeOutAndStop(cheerAudio);
}
