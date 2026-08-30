/**
 * Canonical phrase text for the Numbers modes.
 *
 * Same contract as src/lib/phrases.ts: these strings must match the call sites
 * character for character, because audioKey() is a sha1 of the normalized text.
 * A single character of drift sends playback to the server for a clip that will
 * never match, and the game goes silent.
 *
 * scripts/generate-audio.mjs mirrors every builder in this file. If you change
 * a phrase here, change it there and re-run the generator.
 */

/** Index 0 is unused so NUMBER_WORDS[3] === 'three'. */
export const NUMBER_WORDS = [
  '', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
];

export const MAX_NUMBER = 10;

/** Default highest number a session counts to. Parents can raise it to 10. */
export const DEFAULT_MAX_COUNT = 5;

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** Spoken on each tap/step of a count. The child's tap supplies the rhythm. */
export function countBeat(n: number): string {
  return `${cap(NUMBER_WORDS[n])}.`;
}

/**
 * The cardinality recap — the pedagogically load-bearing line. Saying the total
 * again after the count is what teaches that the last word counted is "how many".
 */
export function cardinalRecap(n: number): string {
  return n === 1
    ? 'One! There is one.'
    : `${cap(NUMBER_WORDS[n])}! There are ${NUMBER_WORDS[n]}.`;
}

/**
 * A whole count as one clip, so "watch me count" has real counting prosody.
 * Never spliced from single words — same rule as the letter phrases.
 */
export function countSequence(n: number): string {
  const words = NUMBER_WORDS.slice(1, n + 1);
  return `${cap(words.join(', '))}.`;
}

export function numberIntro(n: number): string {
  return `This is the number ${NUMBER_WORDS[n]}`;
}

export function findNumber(n: number): string {
  return `Can you find the number ${NUMBER_WORDS[n]}?`;
}

export function pressedNumber(n: number): string {
  return `You pressed the number ${NUMBER_WORDS[n]}!`;
}

/** Fixed prompts — no user data, so all of these are bundled. */
export const COUNT_PROMPTS = {
  watchMe: 'Watch me count!',
  letsCount: "Let's count!",
  tapEach: 'Tap each one to count.',
  nowYouTry: 'Now you try!',
  howMany: 'How many?',
  howManyAreThere: 'How many are there?',
  lookFast: 'Look fast! How many?',
  countThePhoto: 'Can you count them in the picture?',
  greeting: "Hi! Let's count!",
  correct: "That's correct!",
  wrong: "That's not quite right. Let's try again!",
  allDone: 'Congratulations! You counted them all! You are amazing!',
  keepGoing: "Great counting! Let's keep going!",
} as const;

/** Personalized greeting — parent-authored name, so this resolves via the server. */
export function countGreeting(childName: string): string {
  const name = childName.trim();
  return name ? `Hi ${name}! Let's count!` : COUNT_PROMPTS.greeting;
}

/** Every name-bearing Numbers phrase, for prefetch when the name is saved. */
export function numberNamePhrases(childName: string): string[] {
  const name = childName.trim();
  if (!name) return [];
  return [`Hi ${name}! Let's count!`, `Hi ${name}! Let's practice numbers!`];
}

export const NUMBER_LEVEL_ANNOUNCE = [
  'Level: Count With Me!',
  'Level: Count Along!',
  'Level: How Many?!',
  'Level: Find the Number!',
];

/**
 * The complete set of Numbers phrases that ship in public/audio/.
 * Mirrored by countingCorpus() in scripts/generate-audio.mjs.
 */
export function bundledCountingPhrases(): string[] {
  const out: string[] = [];
  for (let n = 1; n <= MAX_NUMBER; n++) {
    out.push(countBeat(n));
    out.push(cardinalRecap(n));
    out.push(countSequence(n));
    out.push(numberIntro(n));
    out.push(findNumber(n));
    out.push(pressedNumber(n));
  }
  out.push(...Object.values(COUNT_PROMPTS));
  out.push(...NUMBER_LEVEL_ANNOUNCE);
  return out;
}
