/**
 * Celebration scheduling with front-loaded frequency curve.
 * 
 * Letters 1-5:   celebrate every 2-3 letters (high reinforcement)
 * Letters 6-15:  celebrate every 4-5 letters
 * Letters 16-26: celebrate every 6-8 letters
 * 
 * Plus always celebrate at the very end (letter 26 or last in set).
 */

export type CelebrationType = 'none' | 'mini' | 'full';

export interface CelebrationCheck {
  type: CelebrationType;
  phrase: string;
}

const MINI_PHRASES = [
  "Great job, NAME!",
  "You're doing awesome, NAME!",
  "Way to go, NAME!",
  "Keep it up, NAME!",
  "Fantastic, NAME!",
  "You're a star, NAME!",
  "Super work, NAME!",
  "Nice job, NAME!",
];

const FULL_PHRASES = [
  "Wow NAME, you're amazing! Look how far you've come!",
  "Incredible work NAME! You're becoming an alphabet expert!",
  "NAME, you're a superstar! Keep shining!",
  "What a champion, NAME! You're doing so well!",
];

const FINAL_PHRASES = [
  "You did it, NAME! You finished all the letters! Amazing!",
  "Congratulations NAME! You're an alphabet superstar!",
  "NAME, you completed everything! That's incredible!",
];

/**
 * The counting games praise the same way, minus the three phrases that name
 * the alphabet. A child counting photos does not want to hear that they
 * finished all the letters. Everything here that is already subject-neutral is
 * the same string as its letters counterpart on purpose — same sha1, same
 * bundled clip, nothing extra to generate.
 *
 * The replacements are also worded to match the praise patterns already
 * whitelisted in server/tts.php, so a child whose name is set still hears them
 * without a cPanel change. Check that file before adding another.
 */
const NUMBER_FULL_PHRASES = [
  "Wow NAME, you're amazing! Look how far you've come!",
  "Incredible work NAME! You're becoming a counting star!",
  "NAME, you're a superstar! Keep shining!",
  "What a champion, NAME! You're doing so well!",
];

const NUMBER_FINAL_PHRASES = [
  "Wow NAME! You counted every one! Amazing!",
  "Congratulations NAME! You're a counting superstar!",
  "NAME, you completed everything! That's incredible!",
];

/** Which praise vocabulary a game draws on. Mini praise is shared. */
export type CelebrationSubject = 'letters' | 'numbers';

/** Minimum letters between full (cheering) celebrations. */
export const FULL_CELEBRATION_GAP = 8;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Determine whether to celebrate after completing an item.
 *
 * @param itemIndex - 0-based index of the letter or number just completed
 * @param totalItems - total items in this session/game
 * @param sinceLast - how many items since last celebration
 * @param sinceFull - items since the last full celebration; drives cheer spacing
 * @param subject - which praise vocabulary to draw on; defaults to letters
 * @returns CelebrationCheck with type and phrase
 */
export function shouldCelebrate(
  itemIndex: number,
  totalItems: number,
  sinceLast: number,
  sinceFull = 0,
  subject: CelebrationSubject = 'letters'
): CelebrationCheck {
  const fullPhrases = subject === 'numbers' ? NUMBER_FULL_PHRASES : FULL_PHRASES;
  const finalPhrases = subject === 'numbers' ? NUMBER_FINAL_PHRASES : FINAL_PHRASES;
  const letterNumber = itemIndex + 1; // 1-based
  const isLast = letterNumber === totalItems;

  // Always do a full celebration at the end
  if (isLast) {
    return { type: 'full', phrase: pickRandom(finalPhrases) };
  }

  // Milestone: halfway point gets a full celebration
  const halfway = Math.floor(totalItems / 2);
  if (letterNumber === halfway && sinceLast >= 2) {
    return { type: 'full', phrase: pickRandom(fullPhrases) };
  }

  // Frequency curve based on position
  let threshold: number;
  if (letterNumber <= 5) {
    threshold = 2; // every 2-3 letters early on
  } else if (letterNumber <= 15) {
    threshold = 4; // every 4-5 letters in the middle
  } else {
    threshold = 6; // every 6-8 letters near the end
  }

  if (sinceLast >= threshold) {
    // Cheering used to land only at the halfway and final letters, so a short
    // session never reached it. Promote a celebration to 'full' once enough
    // letters have passed since the last cheer — spacing by letters rather
    // than by celebration count keeps the gaps even as the mini cadence thins
    // out, and avoids a cheer landing right next to the finale.
    if (sinceFull >= FULL_CELEBRATION_GAP && letterNumber < totalItems - 2) {
      return { type: 'full', phrase: pickRandom(fullPhrases) };
    }
    return { type: 'mini', phrase: pickRandom(MINI_PHRASES) };
  }

  return { type: 'none', phrase: '' };
}

/**
 * Fill in the child's name in a celebration phrase.
 */
export function personalize(phrase: string, childName: string): string {
  const name = childName || 'friend';
  const filled = phrase.replace(/NAME/g, name);
  // NAME is sentence-initial in several templates, so the fallback would read
  // "friend, you completed everything!". Capitalising is a no-op for real names.
  return filled.charAt(0).toUpperCase() + filled.slice(1);
}
