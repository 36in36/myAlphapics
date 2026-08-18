/**
 * Generates the static audio corpus with ElevenLabs (Jessica).
 *
 *   node scripts/generate-audio.mjs [--dry]
 *
 * Idempotent: existing clips are skipped, so re-runs after adding phrases
 * only generate what is new. Writes:
 *   public/audio/<sha1>.mp3
 *   src/lib/audioManifest.ts   (bundled key set — no network lookup at runtime)
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DRY = process.argv.includes('--dry');
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = 'cgSgspJ2msm6clMCkdW9';          // Jessica — playful, bright, warm
const MODEL = 'eleven_multilingual_v2';
const FORMAT = process.env.AUDIO_FORMAT || 'mp3_44100_64';
const SETTINGS = { stability: 0.45, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true };

const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');
const MANIFEST = path.join(process.cwd(), 'src', 'lib', 'audioManifest.ts');

/* Mirrors DEFAULT_LETTERS in src/lib/db.ts */
const LETTERS = [
  ['A','Apple'],['B','Ball'],['C','Cat'],['D','Dog'],['E','Egg'],['F','Fish'],
  ['G','Goat'],['H','Hat'],['I','Ice'],['J','Jet'],['K','Kite'],['L','Lion'],
  ['M','Moon'],['N','Nest'],['O','Owl'],['P','Pig'],['Q','Queen'],['R','Rabbit'],
  ['S','Sun'],['T','Tree'],['U','Umbrella'],['V','Violin'],['W','Wagon'],
  ['X','X-ray'],['Y','Yo-yo'],['Z','Zebra'],
];

const LEVELS = ['Watch & Learn','Press the Letter','Choose Between 2','Choose Between 3','Choose Between 4'];

function corpus() {
  const out = [];
  for (const [L, word] of LETTERS) {
    out.push(`This is the letter ${L}`);
    out.push(`The letter ${L}, is for ${word}`);
    out.push(`Can you find the letter ${L}?`);
    out.push(`Can you press the letter ${L}?`);
    out.push(`You pressed the letter ${L}!`);
    out.push(`Excellent! You pressed the letter ${L}!`);
  }
  out.push("Hi! I'm excited to show you the ABCs!");
  out.push("Hi! Let's do some smart practice!");
  out.push("That's correct!");
  out.push("Excellent! That's correct!");
  out.push("That's not quite right. Let's try again!");
  out.push('Congratulations! You completed all three rounds! You are amazing!');
  out.push("Great job! Let's go through the alphabet again!");
  out.push("Let's do it again!");
  out.push("Great watching! Now let's practice!");
  out.push("Great pressing! Let's try something harder!");
  out.push("Great job! Let's try the next challenge!");
  for (const l of LEVELS) out.push(`Level: ${l}!`);

  // Default-state celebration phrases. personalize() substitutes 'superstar'
  // when no child name is set, which is every user until they set one.
  const PRAISE = [
    'Great job, NAME!',
    "You're doing awesome, NAME!",
    'Way to go, NAME!',
    'Keep it up, NAME!',
    'Fantastic, NAME!',
    "You're a star, NAME!",
    'Super work, NAME!',
    'Nice job, NAME!',
    "Wow NAME, you're amazing! Look how far you've come!",
    "Incredible work NAME! You're becoming an alphabet expert!",
    "NAME, you're a superstar! Keep shining!",
    "What a champion, NAME! You're doing so well!",
    'You did it, NAME! You finished all the letters! Amazing!',
    "Congratulations NAME! You're an alphabet superstar!",
    "NAME, you completed everything! That's incredible!",
  ];
  // Must mirror personalize() in src/lib/celebrationSchedule.ts exactly.
  const personalize = (t) => {
    const filled = t.replace(/NAME/g, 'friend');
    return filled.charAt(0).toUpperCase() + filled.slice(1);
  };
  for (const t of PRAISE) out.push(personalize(t));

  out.push("Amazing work! You completed all five levels! You're getting so smart!");
  return out;
}

const normalize = (t) => t.trim().replace(/\s+/g, ' ');
const audioKey = (t) => crypto.createHash('sha1').update(normalize(t), 'utf8').digest('hex');

async function generate(text, key) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: normalize(text), model_id: MODEL, voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

const phrases = corpus();
const keys = phrases.map(audioKey);

if (DRY) {
  const chars = phrases.reduce((n, p) => n + normalize(p).length, 0);
  console.log(`${phrases.length} phrases, ${chars} characters`);
  phrases.slice(0, 5).forEach((p, i) => console.log(`  ${keys[i].slice(0, 8)}  ${p}`));
  console.log('  ...');
  process.exit(0);
}

if (!KEY) { console.error('ELEVENLABS_API_KEY not set'); process.exit(1); }
fs.mkdirSync(AUDIO_DIR, { recursive: true });

let made = 0, skipped = 0, chars = 0, failed = 0;
for (let i = 0; i < phrases.length; i++) {
  const text = phrases[i], key = keys[i];
  const file = path.join(AUDIO_DIR, `${key}.mp3`);
  if (fs.existsSync(file)) { skipped++; continue; }
  try {
    const buf = await generate(text, key);
    fs.writeFileSync(file, buf);
    made++; chars += normalize(text).length;
    console.log(`[${i + 1}/${phrases.length}] ${key.slice(0, 8)} ${buf.length}b  ${text.slice(0, 46)}`);
  } catch (e) {
    failed++;
    console.error(`[${i + 1}/${phrases.length}] FAILED  ${text.slice(0, 46)} -> ${e.message}`);
  }
}

// Remove clips no longer in the corpus (e.g. after a phrase is reworded), so
// public/audio always mirrors exactly what the manifest claims.
const wanted = new Set(keys.map((k) => `${k}.mp3`));
let pruned = 0;
for (const f of fs.readdirSync(AUDIO_DIR)) {
  if (f.endsWith('.mp3') && !wanted.has(f)) { fs.unlinkSync(path.join(AUDIO_DIR, f)); pruned++; }
}

const present = keys.filter((k) => fs.existsSync(path.join(AUDIO_DIR, `${k}.mp3`)));

// Key list for the service worker to warm the offline cache (it cannot import TS).
fs.writeFileSync(path.join(AUDIO_DIR, 'manifest.json'), JSON.stringify(present));
fs.writeFileSync(MANIFEST,
  '// GENERATED by scripts/generate-audio.mjs — do not edit by hand.\n' +
  '// sha1 keys of every phrase shipped in public/audio/.\n' +
  'export const BUNDLED: ReadonlySet<string> = new Set([\n' +
  present.map((k) => `  '${k}',`).join('\n') +
  '\n]);\n');

console.log(`\ngenerated ${made}, skipped ${skipped}, pruned ${pruned}, failed ${failed}, bundled ${present.length}`);
console.log(`characters billed this run: ${chars}`);
