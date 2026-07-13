// patterns.ts
// "Today's Vibe" pattern library for Streak Wall.
// Each pattern is a set of relative (row, col) cells within a small bounding box —
// the client positions the box wherever it wants on the real wall grid.
//
// Design intent:
//  - Tile counts 6–11 (early levels / short streaks) get hand-authored icon shapes,
//    so the early game feels distinct and readable at a glance.
//  - Tile counts 12+ (higher levels / longer streaks) are generated procedurally as
//    an expanding diamond mosaic, so the feature scales forever without needing new
//    hand-drawn art every time the tile budget grows.

export interface Pattern {
  name: string;
  width: number;
  height: number;
  cells: [number, number][]; // [row, col]
}

/** Build a Pattern from an ASCII block — 'X' = filled cell, '.' = empty.
 *  Keeps the hand-authored shapes readable in source instead of raw coordinate lists. */
function fromAscii(name: string, rows: string[]): Pattern {
  const cells: [number, number][] = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'X') cells.push([r, c]);
    }
  });
  return { name, width: Math.max(...rows.map(r => r.length)), height: rows.length, cells };
}

// Hand-authored patterns, keyed by exact tile count. Each count can hold more than
// one pattern for variety — the day's pick is randomized among the options.
export const HAND_PATTERNS: Record<number, Pattern[]> = {
  6: [
    fromAscii('Spark', [
      '.X..',
      'XXXX',
      '.X..',
    ]),
  ],
  7: [
    fromAscii('Flag', [
      '..X..',
      '.XXX.',
      '..X..',
      '..X..',
      '..X..',
    ]),
  ],
  8: [
    fromAscii('Gem', [
      '.X.',
      'XXX',
      'XXX',
      '.X.',
    ]),
  ],
  9: [
    fromAscii('Square', [
      'XXX',
      'XXX',
      'XXX',
    ]),
  ],
  10: [
    fromAscii('Bolt', [
      '..XX.',
      '.XX..',
      'XX...',
      '.XX..',
      '.XX..',
    ]),
  ],
  11: [
    fromAscii('Burst', [
      '..X..',
      '.XXX.',
      'XXXXX',
      '..X..',
      '.X...',
    ]),
  ],
};

/** Generates a filled diamond (Manhattan-distance) mosaic containing exactly `n` cells.
 *  Rings grow outward from a center cell: ring 0 = 1 cell, ring k = 4k cells.
 *  Full rings are added while they fit; the final partial ring is trimmed to hit `n`
 *  exactly, so every tile budget — no matter how large the streak/level gets — produces
 *  a clean, fully-specified pattern with no leftover or missing cells. */
export function generateDiamondPattern(n: number): Pattern {
  if (n <= 0) return { name: 'Diamond', width: 1, height: 1, cells: [] };

  const cells: [number, number][] = [[0, 0]]; // center, ring 0
  let remaining = n - 1;
  let ring = 1;

  while (remaining > 0) {
    const ringCells: [number, number][] = [];
    for (let dr = -ring; dr <= ring; dr++) {
      const dc = ring - Math.abs(dr);
      if (dc === 0) {
        ringCells.push([dr, 0]);
      } else {
        ringCells.push([dr, dc], [dr, -dc]);
      }
    }
    // de-dupe (dc=0 case can coincide with itself; harmless but keep clean)
    const seen = new Set<string>();
    const uniqueRing = ringCells.filter(([r, c]) => {
      const key = r + ',' + c;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueRing.length <= remaining) {
      cells.push(...uniqueRing);
      remaining -= uniqueRing.length;
    } else {
      // trim the final ring symmetrically-ish, taking from both ends inward
      cells.push(...uniqueRing.slice(0, remaining));
      remaining = 0;
    }
    ring++;
  }

  // normalize to positive coordinates for a clean bounding box
  const minR = Math.min(...cells.map(c => c[0]));
  const minC = Math.min(...cells.map(c => c[1]));
  const normalized = cells.map(([r, c]) => [r - minR, c - minC] as [number, number]);
  const width = Math.max(...normalized.map(c => c[1])) + 1;
  const height = Math.max(...normalized.map(c => c[0])) + 1;

  return { name: `Diamond-${n}`, width, height, cells: normalized };
}

/** Main entry point: get today's target pattern for a given tile budget.
 *  6–11 tiles: random pick from the hand-authored set for that exact count.
 *  12+ tiles: procedurally generated diamond mosaic.
 *  <6 tiles (shouldn't normally happen, but handled defensively): trims the
 *  smallest hand pattern down to size rather than throwing. */
export function getPatternForTileBudget(tilesPerDay: number): Pattern {
  if (tilesPerDay >= 6 && tilesPerDay <= 11 && HAND_PATTERNS[tilesPerDay]) {
    const options = HAND_PATTERNS[tilesPerDay];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (tilesPerDay > 11) {
    return generateDiamondPattern(tilesPerDay);
  }
  // fallback for unexpectedly small budgets
  const smallest = HAND_PATTERNS[6][0];
  return { ...smallest, cells: smallest.cells.slice(0, Math.max(1, tilesPerDay)) };
}