/**
 * Writes public/version.json so a deployed build can identify itself.
 *
 *   node scripts/stamp-version.mjs
 *
 * npm runs this automatically before `next build` (the "prebuild" script), so
 * every export carries a stamp without anyone remembering to do it.
 *
 * The point is diagnosis: opening https://app.myalphapics.com/version.json
 * answers "is the new build actually on the server?" without launching the app,
 * clearing a cache, or trusting the service worker.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const VERSION_TS = path.join(ROOT, 'src', 'lib', 'version.ts');
const SW = path.join(ROOT, 'public', 'sw.js');
const AUDIO_MANIFEST = path.join(ROOT, 'public', 'audio', 'manifest.json');
const OUT = path.join(ROOT, 'public', 'version.json');

/** Read a string constant out of a TS file without needing to compile it. */
function readConst(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`));
  return match ? match[1] : 'unknown';
}

const versionSrc = fs.readFileSync(VERSION_TS, 'utf8');
const version = readConst(versionSrc, 'APP_VERSION');
const name = readConst(versionSrc, 'VERSION_NAME');

let buildId = 'nogit';
try {
  buildId = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  // A dirty tree means the deployed files don't match the commit. Say so,
  // rather than stamping a SHA that quietly isn't the whole truth.
  const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (dirty) buildId += '-dirty';
} catch {
  /* not a git checkout — the stamp is still useful without a SHA */
}

let cacheName = 'unknown';
try {
  cacheName = readConst(fs.readFileSync(SW, 'utf8'), 'CACHE_NAME');
} catch {
  /* no service worker */
}

let audioClips = 0;
try {
  audioClips = JSON.parse(fs.readFileSync(AUDIO_MANIFEST, 'utf8')).length;
} catch {
  /* corpus never generated — 0 is the honest answer, and a useful one */
}

const stamp = { version, name, buildId, builtAt: new Date().toISOString(), cacheName, audioClips };

fs.writeFileSync(OUT, JSON.stringify(stamp, null, 2) + '\n');
console.log(`stamped v${version} (${name})  build ${buildId}  ${audioClips} clips  cache ${cacheName}`);
