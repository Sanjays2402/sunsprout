// Festival banner — a thin centered ribbon for any active festival.
// Mirrors the birthday-banner chrome but uses a cooler teal-stained
// accent so the player can tell the two banners apart at a glance.
// Stacks under the birthday banner when both fire on the same day.

import type { TimeOfDay } from '../game/time';
import { festivalBanner } from '../game/festivals';
import { birthdayBanner } from '../game/birthdays';

const ACCENT = '#9ECDB5';
const TEXT_COLOR = '#1A1426';

/** Draw the festival ribbon if a festival is active today. No-op otherwise. */
export function drawFestivalBanner(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
): void {
  const msg = festivalBanner(time);
  if (!msg) return;
  const padX = 12;
  const h = 18;
  ctx.save();
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const w = ctx.measureText(msg).width + padX * 2;
  const x = Math.floor((canvasW - w) / 2);
  // Sit just below the birthday banner (if any) so they stack cleanly.
  const stacked = birthdayBanner(time) ? 18 : 0;
  const y = 36 + stacked;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(msg, canvasW / 2, y + h / 2);
  ctx.restore();
}
