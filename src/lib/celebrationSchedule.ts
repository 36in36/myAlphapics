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

/** Minimum letters between full (cheering) celebrations. */
export const FULL_CELEBRATION_GAP = 8;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Determine whether to celebrate after completing a letter.
 * 
 * @param letterIndex - 0-based index of the letter just completed
 * @param totalLetters - total letters in this session/game
 * @param lettersSinceLast - how many letters since last celebration
 * @param lettersSinceFull - letters since the last full celebration; drives cheer spacing
 * @returns CelebrationCheck with type and phrase
 */
export function shouldCelebrate(
  letterIndex: number,
  totalLetters: number,
  lettersSinceLast: number,
  lettersSinceFull = 0
): CelebrationCheck {
  const letterNumber = letterIndex + 1; // 1-based
  const isLast = letterNumber === totalLetters;

  // Always do a full celebration at the end
  if (isLast) {
    return { type: 'full', phrase: pickRandom(FINAL_PHRASES) };
  }

  // Milestone: halfway point gets a full celebration
  const halfway = Math.floor(totalLetters / 2);
  if (letterNumber === halfway && lettersSinceLast >= 2) {
    return { type: 'full', phrase: pickRandom(FULL_PHRASES) };
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

  if (lettersSinceLast >= threshold) {
    // Cheering used to land only at the halfway and final letters, so a short
    // session never reached it. Promote a celebration to 'full' once enough
    // letters have passed since the last cheer — spacing by letters rather
    // than by celebration count keeps the gaps even as the mini cadence thins
    // out, and avoids a cheer landing right next to the finale.
    if (lettersSinceFull >= FULL_CELEBRATION_GAP && letterNumber < totalLetters - 2) {
      return { type: 'full', phrase: pickRandom(FULL_PHRASES) };
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
