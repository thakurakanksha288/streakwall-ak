// pattern-scoring.ts
// Two jobs:
//  1. Place the small pattern (from patterns.ts) onto the real, much larger wall grid,
//     so we have a concrete set of absolute target cells for the day.
//  2. Score paint actions against that target set — completion tracking is a plain
//     set-intersection between "painted cells" and "target cells", not image/pixel
//     comparison, since we already know exact grid coordinates on both sides.

import { Pattern } from './patterns';

export interface PlacedPattern {
  targetCells: Set<string>; // "row,col" keys, in the wall grid's own coordinate space
  originRow: number;
  originCol: number;
}

const key = (r: number, c: number) => `${r},${c}`;

/** Simple deterministic PRNG (same family as colorDifficulty.ts) so a given day's
 *  seed always places the pattern in the same spot for every player. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Places `pattern` onto a gridW x gridH wall, roughly centered with a small seeded
 *  jitter so the target isn't in the exact same spot every single day. */
export function placePattern(pattern: Pattern, gridW: number, gridH: number, seed: number): PlacedPattern {
  const rand = mulberry32(seed);
  const maxOriginRow = Math.max(0, gridH - pattern.height);
  const maxOriginCol = Math.max(0, gridW - pattern.width);
  const originRow = Math.floor(rand() * (maxOriginRow + 1));
  const originCol = Math.floor(rand() * (maxOriginCol + 1));

  const targetCells = new Set<string>();
  for (const [r, c] of pattern.cells) {
    targetCells.add(key(originRow + r, originCol + c));
  }
  return { targetCells, originRow, originCol };
}

export interface CompletionStatus {
  matched: number;
  total: number;
  percent: number; // 0–100
  isComplete: boolean;
}

/** Pure set-intersection between currently-painted cells and the target set.
 *  Because decayed tiles are removed from `paintedCells` upstream, completion
 *  can go back down if the community lets a target tile fade — that's intentional:
 *  the shape has to be kept painted, not just hit once. */
export function computeCompletion(paintedCells: Set<string>, targetCells: Set<string>): CompletionStatus {
  let matched = 0;
  for (const cell of targetCells) {
    if (paintedCells.has(cell)) matched++;
  }
  const total = targetCells.size;
  return {
    matched,
    total,
    percent: total === 0 ? 0 : Math.round((matched / total) * 100),
    isComplete: total > 0 && matched === total,
  };
}

// ---- Scoring ----
export const XP_RULES = {
  basePaint: 5,        // any paint action, on or off target
  targetHitBonus: 15,   // painting a cell that's part of today's target pattern (on top of base)
  completionBonus: 50,  // one-time, awarded to whoever paints the tile that completes the pattern
};

export interface PaintScoreResult {
  xpAwarded: number;
  hitTarget: boolean;
  completedPattern: boolean;
}

/**
 * Call this at the moment a tile is painted, after updating paintedCells to include
 * the new tile, so `completionAfter` reflects the paint that just happened.
 */
export function scorePaint(
  cellKeyPainted: string,
  targetCells: Set<string>,
  completionBefore: CompletionStatus,
  completionAfter: CompletionStatus
): PaintScoreResult {
  const hitTarget = targetCells.has(cellKeyPainted);
  const completedPattern = !completionBefore.isComplete && completionAfter.isComplete;

  let xp = XP_RULES.basePaint;
  if (hitTarget) xp += XP_RULES.targetHitBonus;
  if (completedPattern) xp += XP_RULES.completionBonus;

  return { xpAwarded: xp, hitTarget, completedPattern };
}