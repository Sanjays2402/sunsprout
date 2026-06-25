// Crop-quality heatmap overlay — a field wash shown while the crop
// journal (`;`) is open. Each crop tile is tinted by its water-streak so
// the player can see, at a glance, which corners of the field are about
// to earn a silver/gold star and which are languishing dry. Riding the
// journal toggle keeps this off a scarce keybind (the digit row is fully
// spent) and is thematically apt: the journal is where the player thinks
// about crop care.
//
// Pure draw layer — all the streak->band logic lives in crop-quality.ts.
// Reduce-motion has no bearing (no animation); the overlay is a static
// tint per frame.

import type { FarmCrop } from '../game/farming';
import { CROPS } from '../game/crops';
import { qualityHeat, HEAT_COLORS, type QualityHeatTier } from '../game/crop-quality';

/** Legend rows, brightest-care first, for the corner key. */
const LEGEND_ORDER: Array<{ tier: QualityHeatTier; label: string }> = [
  { tier: 'gold', label: 'gold star' },
  { tier: 'silver', label: 'silver star' },
  { tier: 'almost', label: 'one day from silver' },
  { tier: 'building', label: 'streak building' },
  { tier: 'dry', label: 'not watered' },
];

/**
 * Draw a tinted square over every crop tile, keyed to its water-streak
 * band. `project` maps a world-space pixel to screen-space (the engine
 * passes camera.worldToScreen). `tileSize` is the world tile size. A
 * compact legend is drawn bottom-left so the colours read.
 *
 * No-op when there are no crops so a bare field shows nothing but the
 * legend hint.
 */
export function drawQualityHeatmap(
  ctx: CanvasRenderingContext2D,
  crops: readonly FarmCrop[],
  project: (wx: number, wy: number) => { sx: number; sy: number },
  tileSize: number,
  canvasH: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  for (const c of crops) {
    const catalog = CROPS[c.crop];
    if (!catalog) continue;
    const heat = qualityHeat(c.waterStreak ?? 0, catalog.growthStages);
    // Top-left world pixel of the tile.
    const wx = c.tx * tileSize;
    const wy = c.ty * tileSize;
    const { sx, sy } = project(wx, wy);
    ctx.globalAlpha = heat.alpha;
    ctx.fillStyle = heat.color;
    ctx.fillRect(sx, sy, tileSize, tileSize);
    // A thin border at full-ish alpha sharpens the tile edge so adjacent
    // same-band crops still read as separate cells.
    ctx.globalAlpha = Math.min(1, heat.alpha + 0.25);
    ctx.strokeStyle = heat.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, tileSize - 1, tileSize - 1);
  }

  ctx.globalAlpha = 1;
  drawLegend(ctx, canvasH);
  ctx.restore();
}

/** Bottom-left colour key so the bands are legible. */
function drawLegend(ctx: CanvasRenderingContext2D, canvasH: number): void {
  const rowH = 16;
  const padX = 10;
  const w = 168;
  const h = LEGEND_ORDER.length * rowH + 26;
  const x = 12;
  // Sit above the hotbar (hotbar is ~60px tall at the bottom).
  const y = canvasH - h - 84;

  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(26, 20, 38, 0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#4a3b6e';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F5C9A0';
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillText('crop care', x + padX, y + 12);

  ctx.font = '10px ui-monospace, monospace';
  for (let i = 0; i < LEGEND_ORDER.length; i++) {
    const row = LEGEND_ORDER[i];
    const ry = y + 26 + i * rowH;
    // Swatch.
    ctx.fillStyle = HEAT_COLORS[row.tier];
    ctx.fillRect(x + padX, ry, 10, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(x + padX + 0.5, ry + 0.5, 9, 9);
    // Label.
    ctx.fillStyle = 'rgba(245, 233, 212, 0.82)';
    ctx.fillText(row.label, x + padX + 18, ry + 5);
  }
}
