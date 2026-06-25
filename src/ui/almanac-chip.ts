// Almanac HUD chip — a tiny one-line pill that surfaces the almanac's
// top row ("Tomorrow: Maple's birthday") directly on the HUD so the
// player sees the most imminent event without opening the `0` planner.
//
// Only renders when an event lands Today or Tomorrow; quieter stretches
// show nothing so the HUD stays uncluttered. Sits in the right-hand HUD
// column, stacked just below the sky dial, sharing its panel chrome. A
// left colour-rail tints the chip by event kind (matching the almanac
// panel's KIND_STYLE) so a glance reads the category.
//
// Pure draw layer — all the "what's next" logic lives in almanac.ts.

import type { TimeOfDay } from '../game/time';
import { almanacHighlight, highlightChipText, type AlmanacKind } from '../game/almanac';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const TODAY = '#A3D77A';

/** Per-kind rail colour — mirrors the almanac panel's KIND_STYLE. */
const KIND_COLOR: Record<AlmanacKind, string> = {
  festival: '#9ECDB5',
  birthday: '#F5C9A0',
  cart: '#C8923A',
  tournament: '#C8A0E8',
};

const HEIGHT = 20;
/** Top of the chip — below the sky dial (y=66, h=40 => bottom 106). */
const TOP_Y = 110;

/**
 * Draws the almanac highlight chip, right-aligned under the sky dial.
 * No-op when nothing is due Today/Tomorrow. `canvasW` right-aligns it.
 */
export function drawAlmanacChip(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
): void {
  const hit = almanacHighlight(time, 1);
  if (!hit) return;

  const text = highlightChipText(hit);
  const rail = KIND_COLOR[hit.kind];
  const isToday = hit.daysUntil <= 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.font = 'bold 10px ui-monospace, monospace';
  const padL = 12; // text inset (leaves room for the rail)
  const padR = 10;
  const w = Math.ceil(ctx.measureText(text).width) + padL + padR;
  const x = canvasW - w - 12;
  const y = TOP_Y;

  // Frame.
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, HEIGHT);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, HEIGHT - 1);

  // Left colour rail keyed to the event kind.
  ctx.fillStyle = rail;
  ctx.fillRect(x + 3, y + 4, 3, HEIGHT - 8);

  // Text — "Today" highlighted green, "Tomorrow" in the warm body colour.
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = isToday ? TODAY : TEXT_COLOR;
  ctx.fillText(text, x + padL, y + HEIGHT / 2 + 0.5);

  ctx.restore();
}
