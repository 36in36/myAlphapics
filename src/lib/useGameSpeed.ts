import { useState, useEffect, useCallback } from 'react';
import { getSettings } from '@/lib/db';

/**
 * Returns a `delay` function that scales milliseconds by the user's speed setting.
 * Relaxed = 1.5x, Normal = 1.0x, Quick = 0.7x
 */
export function useGameSpeed() {
  const [multiplier, setMultiplier] = useState(1.0);

  useEffect(() => {
    getSettings().then((s) => {
      setMultiplier(s.gameSpeed ?? 1.0);
    });
  }, []);

  const delay = useCallback(
    (ms: number) => new Promise<void>((r) => setTimeout(r, ms * multiplier)),
    [multiplier]
  );

  return { multiplier, delay };
}
