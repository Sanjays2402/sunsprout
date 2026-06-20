// Weather HUD strip — a small pill in the top status bar showing
// "Today: <weather>  /  Tomorrow: <weather>". Matches the existing
// HUD palette (PANEL_BG / PANEL_BORDER / monospace) and sits flush
// under the top status bar.

import type { TimeOfDay } from '../game/time';
import { weatherToday, weatherTomorrow, WEATHER } from '../game/weather';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const SUBTLE = '#9D8FB8';

/**
 * Renders the strip aligned to the top-right, just below the status
 * bar. Returns void; the HUD layer composes it on every frame.
 */
export function drawWeatherStrip(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
): void {
  const today = weatherToday(time);
  const tomorrow = weatherTomorrow(time);
  const w = 220;
  const h = 22;
  const x = canvasW - w - 12;
  const y = 40;

  ctx.save();
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.font = '11px ui-monospace, monospace';
  ctx.textBaseline = 'middle';

  // "Today:" label + colored pill + "Next:" + colored pill.
  ctx.textAlign = 'left';
  ctx.fillStyle = SUBTLE;
  ctx.fillText('Today', x + 6, y + h / 2);
  drawWeatherPill(ctx, x + 42, y + 4, WEATHER[today].label, WEATHER[today].color);

  ctx.fillStyle = SUBTLE;
  ctx.fillText('Next', x + 116, y + h / 2);
  drawWeatherPill(ctx, x + 148, y + 4, WEATHER[tomorrow].label, WEATHER[tomorrow].color);

  ctx.restore();
  void TEXT_COLOR;
}

function drawWeatherPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
): void {
  const pillH = 14;
  const padX = 6;
  ctx.font = 'bold 10px ui-monospace, monospace';
  const w = ctx.measureText(label).width + padX * 2;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, pillH);
  ctx.fillStyle = '#1A1426';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + padX, y + pillH / 2);
}

/**
 * Renders a cheap procedural rain overlay on top of the world. Diagonal
 * pixel streaks at a low density so the framerate doesn't suffer on
 * smaller machines. Storm pulses brighter.
 */
export function drawRainOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  intense: boolean,
  nowMs: number,
): void {
  const count = intense ? 110 : 60;
  const speed = intense ? 0.4 : 0.2;
  ctx.save();
  ctx.fillStyle = intense ? 'rgba(180, 200, 240, 0.55)' : 'rgba(180, 200, 240, 0.35)';
  for (let i = 0; i < count; i++) {
    // Pseudo-random position per drop, animated by nowMs.
    const seed = i * 73.13;
    const baseX = (seed * 91) % (canvasW + 40);
    const baseY = ((seed * 47 + nowMs * speed) % (canvasH + 40));
    const x = Math.floor(baseX) - 20;
    const y = Math.floor(baseY) - 20;
    // Each drop is a 1px wide, 4-6px tall diagonal streak.
    ctx.fillRect(x, y, 1, intense ? 6 : 4);
  }
  if (intense) {
    // Faint blue tint over the whole scene during storms.
    ctx.fillStyle = 'rgba(30, 40, 80, 0.12)';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  ctx.restore();
}
