'use client';

interface NumberChoicesProps {
  choices: number[];
  onPick: (value: number) => void;
  disabled?: boolean;
}

export default function NumberChoices({ choices, onPick, disabled = false }: NumberChoicesProps) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {choices.map((value) => (
        <button
          key={value}
          onClick={() => onPick(value)}
          disabled={disabled}
          aria-label={`Number ${value}`}
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-500 shadow-2xl
                     transition-all hover:scale-105 hover:bg-indigo-600 active:scale-95 active:bg-indigo-700
                     disabled:opacity-60 md:h-32 md:w-32"
        >
          <span className="text-5xl font-extrabold text-white md:text-6xl">{value}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Distractors around the right answer. Neighbouring numbers are the useful
 * wrong choices — picking "seven" when the answer is "three" tells you nothing,
 * but picking "four" is the off-by-one a miscount actually produces.
 */
export function buildChoices(answer: number, count: number, maxCount: number): number[] {
  const pool = new Set<number>([answer]);
  let spread = 1;
  while (pool.size < count && spread <= maxCount) {
    for (const candidate of [answer - spread, answer + spread]) {
      if (candidate >= 1 && candidate <= maxCount) pool.add(candidate);
      if (pool.size >= count) break;
    }
    spread++;
  }
  return Array.from(pool).sort(() => Math.random() - 0.5);
}
