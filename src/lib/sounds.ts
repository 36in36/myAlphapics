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

function playBuffer(buffer: AudioBuffer) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
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

export async function playPop() {
  if (typeof window === 'undefined') return;
  if (isIOS && isStandalone) {
    const buffer = await loadBuffer('/sounds/pop.mp3');
    if (buffer) { playBuffer(buffer); return; }
  }
  // Fallback to HTMLAudioElement
  if (!popAudio) popAudio = new Audio('/sounds/pop.mp3');
  popAudio.currentTime = 0;
  popAudio.play().catch(() => {});
}

export async function playCheer() {
  if (typeof window === 'undefined') return;
  if (isIOS && isStandalone) {
    const buffer = await loadBuffer('/sounds/cheering.mp3');
    if (buffer) { playBuffer(buffer); return; }
  }
  if (!cheerAudio) cheerAudio = new Audio('/sounds/cheering.mp3');
  cheerAudio.currentTime = 0;
  cheerAudio.play().catch(() => {});
}
