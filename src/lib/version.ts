/**
 * App version, so "did my deploy actually land?" has an answer.
 *
 * Bump APP_VERSION by hand when shipping something worth telling apart.
 * Everything else — build id, timestamp, clip count — is stamped into
 * public/version.json by scripts/stamp-version.mjs, which npm runs
 * automatically before `next build`.
 */
export const APP_VERSION = '1.1.3';
export const VERSION_NAME = 'Numbers';

export interface BuildInfo {
  version: string;
  name: string;
  /** Short git SHA of the commit that was built. */
  buildId: string;
  builtAt: string;
  /** What the deployed service worker calls its cache. */
  cacheName: string;
  /** Bundled speech clips in this build — 0 means the corpus was never generated. */
  audioClips: number;
}

/**
 * Reads the deployed build stamp.
 *
 * `cache: 'no-store'` matters: a stale answer here is worse than no answer,
 * and this file exists precisely for the times the cache is the suspect.
 * public/sw.js also excludes it from the cache-first path.
 */
export async function fetchBuildInfo(): Promise<BuildInfo | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as BuildInfo;
  } catch {
    return null;
  }
}

export function formatBuiltAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
