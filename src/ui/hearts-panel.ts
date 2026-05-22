// Hearts panel — slice 4 of v0.5.0 marriage candidates.
//
// A toggleable HUD overlay (key `H`) that lists every candidate, the
// player's current heart total, and a small intro hint at level 1+. The
// panel is rendered top-right so it doesn't fight the quest panel.
//
// The drawing is pure: it pulls everything it needs from Player.hearts
// and CANDIDATES, no engine-side state besides the `visible` flag held
// in game.ts.

import type { Player } from '../world/world';
import {
  CANDIDATES,
  MAX_HEARTS,
  getHearts,
  type HeartsState,
} from '../game/hearts';

const PANEL_BG = 'rgba(26, 20, 38, 0.92)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const ACCENT = '#F5C9A0';
const HEART_FULL = '#E25C7A';
const HEART_EMPTY = '#3a2a4a';

/** Pure summary helper — used by both the panel and unit tests. */
export interface HeartsRow {
  id: string;
  name: string;
  hearts: number;
  max: number;
}

export function heartsSummary(state: HeartsState | undefined): HeartsRow[] {
  const out: HeartsRow[] = [];
  for (const id of Object.keys(CANDIDATES)) {
    const def = CANDIDATES[id];
    out.push({
      id,
      name: def.name,
      hearts: state ? getHearts(state, id) : 0,
      max: MAX_HEARTS,
    });
  }
  return out;
}

/** Draw a single pixel heart at (x,y), filled or empty. */
function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  filled: boolean,
): void {
  ctx.fillStyle = filled ? HEART_FULL : HEART_EMPTY;
  // 7x6 chubby heart shape.
  const pixels = [
    [1, 0], [2, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4],
    [3, 5],
  ];
  for (const [px, py] of pixels) ctx.fillRect(x + px, y + py, 1, 1);
}

export function drawHeartsPanel(
  ctx: CanvasRenderingContext2D,
  player: Player,
  canvasW: number,
  visible: boolean,
): void {
  if (!visible) return;
  const rows = heartsSummary(player.hearts);
  if (rows.length === 0) return;

  const w = 240;
  const lineH = 22;
  const h = 30 + rows.length * lineH;
  const x = canvasW - w - 12;
  const y = 40;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('hearts  (H)', x + 8, y + 6);

  ctx.font = '11px ui-monospace, monospace';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ry = y + 24 + i * lineH;
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(row.name, x + 8, ry);
    // Hearts strip right-aligned: 10 small hearts, ~8px apart.
    const stripX = x + w - 8 - row.max * 8;
    for (let hi = 0; hi < row.max; hi++) {
      drawHeart(ctx, stripX + hi * 8, ry + 2, hi < row.hearts);
    }
  }
  ctx.restore();
}
