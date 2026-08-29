/**
 * Canonical phrase text for everything the app speaks that contains user data.
 *
 * These strings must match the call sites in src/app/play/* exactly — a single
 * character of drift changes the sha1 and sends playback to the server for a
 * clip that will never match. Kept here so prefetching and playback cannot
 * disagree.
 */

/** Mirrors the positions array in src/app/play/namegame/page.tsx */
export const POSITIONS = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

const position = (i: number) => POSITIONS[i] || `${i + 1}th`;

/** Mirrors personalize() in src/lib/celebrationSchedule.ts */
function personalize(template: string, name: string): string {
  const filled = template.replace(/NAME/g, name || 'friend');
  return filled.charAt(0).toUpperCase() + filled.slice(1);
}

const PRAISE_TEMPLATES = [
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

/** Every phrase that embeds the child's name, including per-letter Name Game lines. */
export function namePhrases(childName: string): string[] {
  const name = childName.trim();
  if (!name) return [];

  const out = [
    `Hi ${name}! I'm excited to show you the ABCs!`,
    `Hi ${name}! Let's do some smart practice!`,
    `Hi ${name}! Let's learn the letters in your name!`,
    `Your name is ${name}`,
    `${name}, now you know all the letters in your name! You're doing a great job!`,
    `Amazing work, ${name}! You completed all five levels! You're getting so smart!`,
  ];

  // Name Game walks the letters of the name, announcing each position.
  const chars = name.toUpperCase().split('');
  chars.forEach((char, i) => {
    if (/[A-Z]/.test(char)) {
      out.push(`This is the letter ${char}. It's the ${position(i)} letter in your name.`);
    } else {
      out.push(`The character ${char}`);
    }
  });

  for (const t of PRAISE_TEMPLATES) out.push(personalize(t, name));
  return out;
}

/** Spoken when a parent gives a letter a custom word (e.g. "G is for Grandma"). */
export function letterWordPhrases(letter: string, word: string): string[] {
  if (!word.trim()) return [];
  return [`The letter ${letter}, is for ${word.trim()}`];
}

/** Spoken by the Word Learning game for a custom word-bank entry. */
export function wordBankPhrases(word: string): string[] {
  const w = word.trim();
  if (!w) return [];
  const out = [`Let's learn the letters in the word: ${w}`];
  w.toUpperCase().split('').forEach((char, i) => {
    if (/[A-Z]/.test(char)) {
      out.push(`This is the letter ${char}. It's the ${position(i)} letter in ${w}.`);
    }
  });
  return out;
}
