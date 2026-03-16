let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {}
}

export function releaseWakeLock() {
  wakeLock?.release();
  wakeLock = null;
}
