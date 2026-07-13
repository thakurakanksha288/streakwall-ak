// colorDifficulty.ts
// Generates the paint palette shown to the player, with distinguishability controlled
// by a single `difficulty` knob (0 = easiest, 1 = hardest).
//
// Design: at difficulty 0, hues are spread evenly around the full color wheel with
// generous saturation/lightness variety — easy to tell every swatch apart at a glance.
// As difficulty rises toward 1, hues are squeezed into a narrow band and lightness/
// saturation variation shrinks too, so swatches converge toward near-identical shades.
// This is the actual difficulty lever — not a cosmetic one — so it should be driven by
// the player's level/streak, not randomized independently of progression.

export interface PaletteColor {
  hex: string;
  h: number;
  s: number;
  l: number;
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Simple deterministic PRNG so the day's palette is stable for a given seed
 *  (e.g. derive the seed from the daily grid id, so everyone sees the same palette
 *  that day rather than it re-randomizing on every reload). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Generates `count` palette colors at the given difficulty (0–1).
 * difficulty=0  -> hues spread across ~300°, generous S/L variation (easy to tell apart)
 * difficulty=1  -> hues squeezed into ~14°, minimal S/L variation (hard to tell apart)
 */
export function generatePalette(count: number, difficulty: number, seed = 1): PaletteColor[] {
  const d = Math.max(0, Math.min(1, difficulty));
  const rand = mulberry32(seed);

  const hueSpread = lerp(300, 14, d);     // full rainbow -> near-single hue
  const baseHue = rand() * 360;
  const satBase = lerp(70, 48, d);
  const satJitter = lerp(20, 4, d);
  const lightBase = lerp(55, 50, d);
  const lightJitter = lerp(18, 4, d);

  const colors: PaletteColor[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const h = baseHue + (t - 0.5) * hueSpread;
    const s = satBase + (rand() - 0.5) * satJitter;
    const l = lightBase + (rand() - 0.5) * lightJitter;
    colors.push({ hex: hslToHex(h, s, l), h: ((h % 360) + 360) % 360, s, l });
  }
  return colors;
}

/** Maps a player's level to a difficulty value (0–1). Tune the ramp here —
 *  currently reaches max difficulty by level 20 and holds there. */
export function difficultyForLevel(level: number, maxLevel = 20): number {
  return Math.max(0, Math.min(1, (level - 1) / (maxLevel - 1)));
}

/** Rough perceptual distance between two colors in HSL space — useful for tests/tuning,
 *  not for rendering. Weights hue heavily since that's the primary way people
 *  distinguish paint colors at a glance. */
export function colorDistance(a: PaletteColor, b: PaletteColor): number {
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  const ds = a.s - b.s;
  const dl = a.l - b.l;
  return Math.sqrt(dh * dh * 2 + ds * ds + dl * dl);
}