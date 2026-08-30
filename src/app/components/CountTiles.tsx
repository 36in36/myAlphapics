'use client';

import type { CountTile } from '@/lib/useCountingPool';

interface CountTilesProps {
  tiles: CountTile[];
  /** Tile ids already counted, in the order they were counted. */
  counted: string[];
  /** Tile index the app is pointing at while it counts for the child. */
  highlight?: number | null;
  onTap?: (tile: CountTile, index: number) => void;
  /** Hide the photos but keep the layout — used for flash rounds. */
  hidden?: boolean;
  size?: 'normal' | 'small';
}

/** Tighter grids as the set grows, so ten tiles still fit a phone screen. */
function columnsFor(n: number): string {
  if (n <= 2) return 'grid-cols-2';
  if (n <= 4) return 'grid-cols-2';
  if (n <= 6) return 'grid-cols-3';
  if (n <= 9) return 'grid-cols-3';
  return 'grid-cols-4';
}

function tileSize(n: number, size: 'normal' | 'small'): string {
  if (size === 'small') return 'w-16 h-16 md:w-20 md:h-20';
  if (n <= 3) return 'w-28 h-28 md:w-36 md:h-36';
  if (n <= 6) return 'w-24 h-24 md:w-28 md:h-28';
  return 'w-20 h-20 md:w-24 md:h-24';
}

export default function CountTiles({
  tiles,
  counted,
  highlight = null,
  onTap,
  hidden = false,
  size = 'normal',
}: CountTilesProps) {
  const n = tiles.length;
  const interactive = Boolean(onTap);

  return (
    <div className={`grid ${columnsFor(n)} gap-3 md:gap-4 place-items-center`}>
      {tiles.map((tile, i) => {
        const order = counted.indexOf(tile.id);
        const isCounted = order >= 0;
        const isHighlighted = highlight === i;

        const Wrapper = interactive ? 'button' : 'div';

        return (
          <Wrapper
            key={tile.id}
            {...(interactive
              ? {
                  onClick: () => onTap?.(tile, i),
                  disabled: isCounted,
                  'aria-label': isCounted ? `${tile.label}, counted ${order + 1}` : `Count ${tile.label}`,
                }
              : {})}
            className={`relative rounded-2xl border-4 bg-white/70 shadow-md transition-all duration-200
              ${tileSize(n, size)}
              ${isHighlighted ? 'scale-110 border-amber-400 shadow-xl ring-4 ring-amber-200' : ''}
              ${isCounted && !isHighlighted ? 'border-green-400 scale-95' : ''}
              ${!isCounted && !isHighlighted ? 'border-blue-200' : ''}
              ${interactive && !isCounted ? 'hover:scale-105 active:scale-95 cursor-pointer' : ''}
              ${interactive && isCounted ? 'cursor-default' : ''}`}
          >
            <img
              src={tile.url}
              alt={hidden ? '' : tile.label}
              className={`h-full w-full rounded-xl object-cover transition-opacity duration-150
                ${hidden ? 'opacity-0' : 'opacity-100'}
                ${isCounted ? 'opacity-70' : ''}`}
            />

            {isCounted && !hidden && (
              <span
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full
                           bg-green-500 text-base font-extrabold text-white shadow-lg animate-pop-in"
              >
                {order + 1}
              </span>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}
