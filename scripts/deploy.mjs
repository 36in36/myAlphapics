/**
 * Copies the built export to the droplet and then checks that it landed.
 *
 *   npm run deploy         build, upload, verify
 *   node scripts/deploy.mjs --dry     print what it would do
 *   node scripts/deploy.mjs --no-verify
 *
 * The verify step is the point. Deploying and checking used to be two separate
 * acts of faith — build on the laptop, copy to the server, then wonder whether
 * the browser is showing the new build or a cached old one. This reads
 * /version.json off the live host and compares its build id to the one just
 * built, so the command either says the deploy landed or says it didn't.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const HOST = 'root@167.71.91.81';
const REMOTE = '/var/www/myalphapics/';
const LIVE = 'https://app.myalphapics.com';

const DRY = process.argv.includes('--dry');
const SKIP_VERIFY = process.argv.includes('--no-verify');

const OUT = path.join(process.cwd(), 'out');
if (!fs.existsSync(OUT)) {
  console.error('No out/ directory. Run `npm run build` first.');
  process.exit(1);
}

let stamp = null;
try {
  stamp = JSON.parse(fs.readFileSync(path.join(OUT, 'version.json'), 'utf8'));
  console.log(`Deploying v${stamp.version} "${stamp.name}"  build ${stamp.buildId}  ${stamp.audioClips} clips`);
  if (stamp.buildId.endsWith('-dirty')) {
    console.log('  note: built from a tree with uncommitted changes');
  }
  if (stamp.audioClips < 262) {
    console.log(`  note: only ${stamp.audioClips} voice clips — run scripts/generate-audio.mjs for the full corpus`);
  }
} catch {
  console.log('Deploying (no version stamp found in out/)');
}

// Explicit paths rather than out/*: cmd.exe doesn't expand globs, so the shell
// form silently fails on Windows, which is where this actually gets run.
const entries = fs.readdirSync(OUT).map((name) => path.join('out', name));
if (entries.length === 0) {
  console.error('out/ is empty — nothing to deploy.');
  process.exit(1);
}

const args = ['-r', ...entries, `${HOST}:${REMOTE}`];

if (DRY) {
  console.log(`\nwould run: scp ${args.join(' ')}`);
  process.exit(0);
}

console.log(`\nscp -r (${entries.length} top-level entries) -> ${HOST}:${REMOTE}`);
const res = spawnSync('scp', args, { stdio: 'inherit' });

if (res.error) {
  console.error(`\nscp failed to start: ${res.error.message}`);
  console.error('Is the OpenSSH client installed and on PATH?');
  process.exit(1);
}
if (res.status !== 0) {
  console.error(`\nscp exited ${res.status} — nothing was verified.`);
  process.exit(res.status ?? 1);
}

if (SKIP_VERIFY || !stamp) {
  console.log('\nUploaded.');
  process.exit(0);
}

// Read the stamp back off the live host. Cache-busted, because a cached answer
// here would defeat the entire purpose.
try {
  const res2 = await fetch(`${LIVE}/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res2.ok) {
    console.log(`\nUploaded, but ${LIVE}/version.json returned ${res2.status}. Check the nginx root.`);
    process.exit(0);
  }
  const live = await res2.json();
  if (live.buildId === stamp.buildId) {
    console.log(`\nLive: v${live.version} build ${live.buildId}. Deploy confirmed.`);
  } else {
    console.log(`\nUploaded, but ${LIVE} reports build ${live.buildId}, expected ${stamp.buildId}.`);
    console.log('Either the copy went to the wrong directory, or something is caching it.');
  }
} catch (e) {
  console.log(`\nUploaded. Could not reach ${LIVE} to verify: ${e.message}`);
}
