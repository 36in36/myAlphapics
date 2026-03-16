let popAudio: HTMLAudioElement | null = null;
let cheerAudio: HTMLAudioElement | null = null;

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
