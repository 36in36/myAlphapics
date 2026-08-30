import { useState, useEffect, useCallback, useRef } from 'react';
import { getCountingPool, getMaxCount, getSettings, type CountablePhoto } from './db';

export interface CountTile {
  /** Unique per tile within a round, even when the same photo repeats. */
  id: string;
  label: string;
  url: string;
}

/**
 * Loads the countable photos once and hands out sets of them.
 *
 * Object URLs are created once here and revoked on unmount. The letter games
 * call URL.createObjectURL() inside render, which leaks a URL per frame; this
 * mode has up to ten images on screen at a time, so it can't afford that.
 */
export function useCountingPool() {
  const [pool, setPool] = useState<CountablePhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [maxCount, setMaxCount] = useState(5);
  const [childName, setChildName] = useState('');
  const [ready, setReady] = useState(false);
  const createdRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [photos, max, settings] = await Promise.all([
        getCountingPool(),
        getMaxCount(),
        getSettings(),
      ]);
      if (cancelled) return;

      const map: Record<string, string> = {};
      for (const p of photos) {
        if (p.imageBlob) {
          const url = URL.createObjectURL(p.imageBlob);
          createdRef.current.push(url);
          map[p.key] = url;
        } else {
          map[p.key] = p.imagePath;
        }
      }
      setPool(photos);
      setUrls(map);
      setMaxCount(max);
      setChildName(settings.childName);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      for (const url of createdRef.current) URL.revokeObjectURL(url);
      createdRef.current = [];
    };
  }, []);

  /**
   * n tiles drawn from the pool. Prefers distinct photos so the child is
   * counting a group rather than duplicates of one face — a repeated photo
   * invites "that's the same Grandma" instead of "that's two". Falls back to
   * repeating only when the family has loaded fewer photos than n.
   */
  const pickSet = useCallback(
    (n: number): CountTile[] => {
      if (pool.length === 0) return [];
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const tiles: CountTile[] = [];
      for (let i = 0; i < n; i++) {
        const p = shuffled[i % shuffled.length];
        tiles.push({ id: `${p.key}-${i}`, label: p.label, url: urls[p.key] ?? p.imagePath });
      }
      return tiles;
    },
    [pool, urls]
  );

  return { pool, pickSet, maxCount, childName, ready, hasPhotos: pool.length > 0 };
}
