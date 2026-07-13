// pixelTreeScene.ts
// Procedurally generates the "pixel tree at sunset" scene as a flat list of
// colored blocks on a grid — ground, trunk, canopy, and edge particles.
// Deliberately split from the canvas-drawing code (see renderPixelTreeScene)
// so the generation logic itself can be verified in plain Node, without a
// browser/canvas dependency.

export interface Block {
  col: number;
  row: number;
  color: string;
}

export interface SceneConfig {
  cols: number;
  rows: number;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(arr: T[], rand: () => number) => arr[Math.floor(rand() * arr.length)];

const PALETTE = {
  blueMed: ['#3E7CB1', '#4886BD', '#3670A0'],
  blueLight: ['#6FD1E8', '#7FDCEF', '#5FC3DE'],
  green: ['#4C7A3D', '#5E8E4A', '#3F6B33'],
  leaf: ['#6B8E4E', '#8FA84D', '#A6B85C', '#7C6A3A', '#A97D3E', '#C08A3E', '#8B5E3C'],
  trunk: ['#8B5E3C', '#7A4E30', '#6B4226', '#9B6B3F'],
  particleBlue: ['#3E7CB1', '#274A6B', '#5FA8D3'],
  particleWarm: ['#D9752E', '#B0432A', '#8B4A2B', '#E08A3C'],
};

/** Generates every colored ground/tree/particle block for a cols x rows grid.
 *  Sun is intentionally excluded — it's drawn as a smooth gradient circle by
 *  the canvas renderer, not built from blocks. */
export function generateSceneBlocks(cols: number, rows: number, seed = 1): Block[] {
  const rand = mulberry32(seed);
  const blocks: Block[] = [];
  const occupied = new Set<string>();
  const place = (col: number, row: number, color: string) => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const key = `${col},${row}`;
    if (occupied.has(key)) return;
    occupied.add(key);
    blocks.push({ col, row, color });
  };

  // ---- Ground: 2 rows medium blue, 1 row light cyan, 2 rows muted green ----
  const groundTopRow = rows - 5;
  for (let c = 0; c < cols; c++) {
    place(c, groundTopRow, pick(PALETTE.blueMed, rand));
    place(c, groundTopRow + 1, pick(PALETTE.blueMed, rand));
    place(c, groundTopRow + 2, pick(PALETTE.blueLight, rand));
    place(c, groundTopRow + 3, pick(PALETTE.green, rand));
    place(c, groundTopRow + 4, pick(PALETTE.green, rand));
  }

  // ---- Trunk: tapering column, base ~5 wide -> top ~2 wide ----
  const centerCol = Math.floor(cols / 2);
  const trunkHeight = Math.max(6, Math.floor(rows * 0.32));
  const trunkTopRow = groundTopRow - trunkHeight;
  for (let i = 0; i < trunkHeight; i++) {
    const row = groundTopRow - 1 - i;
    const t = i / trunkHeight; // 0 at base, 1 at top
    const halfWidth = Math.max(1, Math.round((5 - 3 * t) / 2));
    for (let dc = -halfWidth; dc <= halfWidth; dc++) {
      place(centerCol + dc, row, pick(PALETTE.trunk, rand));
    }
  }

  // ---- Canopy: elliptical density fill, denser at center, sparser toward edge ----
  const canopyCenterRow = trunkTopRow - Math.floor(rows * 0.06);
  const canopyRadiusX = Math.floor(cols * 0.22);
  const canopyRadiusY = Math.floor(rows * 0.24);
  for (let row = canopyCenterRow - canopyRadiusY; row <= canopyCenterRow + canopyRadiusY; row++) {
    for (let col = centerCol - canopyRadiusX; col <= centerCol + canopyRadiusX; col++) {
      const nx = (col - centerCol) / canopyRadiusX;
      const ny = (row - canopyCenterRow) / canopyRadiusY;
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist > 1) continue;
      // density falls off toward the edge of the ellipse -> sparser canopy rim
      const density = 1 - dist * dist;
      if (rand() < density * 0.85 + 0.05) {
        place(col, row, pick(PALETTE.leaf, rand));
      }
    }
  }

  // ---- Flyaway leaves: sparse isolated pixels just outside the canopy ellipse ----
  const flyawayCount = Math.floor(cols * 0.9);
  for (let i = 0; i < flyawayCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 1.05 + rand() * 0.6; // just outside the ellipse (dist > 1) out to +0.6 further
    const col = Math.round(centerCol + Math.cos(angle) * canopyRadiusX * dist);
    const row = Math.round(canopyCenterRow + Math.sin(angle) * canopyRadiusY * dist);
    if (row >= groundTopRow) continue; // don't scatter leaves into the ground
    if (rand() < 0.5) place(col, row, pick(PALETTE.leaf, rand));
  }

  // ---- Edge particles: scattered single pixels, denser near the edges ----
  const edgeBandCols = Math.floor(cols * 0.14);
  const particleRowsMax = groundTopRow;
  for (let col = 0; col < edgeBandCols; col++) {
    const edgeFalloff = 1 - col / edgeBandCols; // denser right at the edge
    for (let row = 0; row < particleRowsMax; row++) {
      if (rand() < edgeFalloff * 0.12) place(col, row, pick(PALETTE.particleBlue, rand));
    }
  }
  for (let col = cols - edgeBandCols; col < cols; col++) {
    const edgeFalloff = 1 - (cols - 1 - col) / edgeBandCols;
    for (let row = 0; row < particleRowsMax; row++) {
      if (rand() < edgeFalloff * 0.12) place(col, row, pick(PALETTE.particleWarm, rand));
    }
  }

  return blocks;
}

/** Sun position/size, expressed in the same normalized (0–1) space as the
 *  canvas so the renderer can place it in pixel coordinates. Positioned
 *  behind the upper trunk/canopy, slightly right of center. */
export function getSunSpec(cols: number, rows: number) {
  return {
    centerCol: Math.floor(cols * 0.52),
    centerRow: Math.floor(rows * 0.3),
    radiusCols: cols * 0.09,
  };
}

/** Draws the full scene onto a 2D canvas context: background, sun (behind
 *  everything), then every generated ground/tree/particle block on top —
 *  matching the reference image's layering (tree overlaps the sun). */
export function renderPixelTreeScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed = 1
): void {
  const blockSize = 10;
  const cols = Math.floor(width / blockSize);
  const rows = Math.floor(height / blockSize);

  // background
  ctx.fillStyle = '#0B1320';
  ctx.fillRect(0, 0, width, height);

  // sun — smooth gradient circle with soft glow, drawn before the tree so
  // the pixel blocks visually sit on top of it
  const sun = getSunSpec(cols, rows);
  const sunX = sun.centerCol * blockSize;
  const sunY = sun.centerRow * blockSize;
  const sunR = sun.radiusCols * blockSize;

  ctx.save();
  ctx.shadowColor = 'rgba(255, 118, 0, 0.55)';
  ctx.shadowBlur = sunR * 1.4;
  const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
  gradient.addColorStop(0, '#FFAE19');
  gradient.addColorStop(1, '#FF7600');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ground, trunk, canopy, particles
  const blocks = generateSceneBlocks(cols, rows, seed);
  ctx.strokeStyle = '#050910';
  ctx.lineWidth = 1;
  for (const b of blocks) {
    const x = b.col * blockSize;
    const y = b.row * blockSize;
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, blockSize, blockSize);
    ctx.strokeRect(x + 0.5, y + 0.5, blockSize - 1, blockSize - 1);
  }
}