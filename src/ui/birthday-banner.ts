// Birthday banner — a thin centered ribbon at the top of the screen
// shown on any NPC's birthday. Matches the existing HUD palette so it
// reads as "part of the game chrome" not a popup.

import type { TimeOfDay } from '../game/time';
import { birthdayBanner } from '../game/birthdays';

const ACCENT = '#F5C9A0';
const TEXT_COLOR = '#1A1426';

/** Draw the centered birthday ribbon if today is a celebrant's day. No-op otherwise. */
export function drawBirthdayBanner(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
): void {
  const msg = birthdayBanner(time);
  if (!msg) return;
  const padX = 12;
  const h = 18;
  ctx.save();
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const w = ctx.measureText(msg).width + padX * 2;
  const x = Math.floor((canvasW - w) / 2);
  // Sits just under the top status bar.
  const y = 36;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(msg, canvasW / 2, y + h / 2);
  ctx.restore();
}
