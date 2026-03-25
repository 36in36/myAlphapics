let popAudio: HTMLAudioElement | null = null;
let cheerAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

// iOS requires audio to be played from a user gesture the first time.
// Pre-load and unlock on first interaction.
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  
  // Create and "play" with volume 0 to unlock the audio context
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

if (typeof document !== 'undefined') {
  ['click', 'touchstart', 'touchend', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, unlockAudio, { once: true, capture: true });
  });
}

export function playPop() {
  if (typeof window === 'undefined') return;
  if (!popAudio) popAudio = new Audio('/sounds/pop.mp3');
  popAudio.currentTime = 0;
  popAudio.play().catch(() => {});
}

export function playCheer() {
  if (typeof window === 'undefined') return;
  if (!cheerAudio) cheerAudio = new Audio('/sounds/cheering.mp3');
  cheerAudio.currentTime = 0;
  cheerAudio.play().catch(() => {});
}
