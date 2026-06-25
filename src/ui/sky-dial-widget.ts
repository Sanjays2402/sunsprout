// Sky dial widget — a small sun/moon arc tucked under the top status bar
// next to the centered clock. It renders the celestial body climbing a
// horizon-to-horizon arc so the player can read "how much daylight is
// left" at a glance, with a phase caption ("Midday", "Dusk", "Night")
// and an "Nh left" readout during the day.
//
// Matches the HUD palette and integer-snaps every coordinate. Pure
// drawing layer — all the placement math comes from sky-dial.ts.

import type { TimeOfDay } from '../game/time';
import { skyDialState, daylightMinutesLeft, skyWeatherStyle } from '../game/sky-dial';
import { weatherToday } from '../game/weather';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const SUBTLE = '#9D8FB8';
const ARC_DAY = 'rgba(245, 201, 160, 0.40)';
const ARC_NIGHT = 'rgba(150, 170, 220, 0.35)';
const SUN_CORE = '#F7D070';
const SUN_RAY = '#F5B94A';
const MOON_CORE = '#E8ECF5';
const MOON_SHADOW = '#9FB0D0';
const CLOUD_LIGHT = '#C7CDDA';
const CLOUD_DARK = '#8C93A6';
const CLOUD_STORM = '#6A7186';

const WIDTH = 132;
const HEIGHT = 40;

/**
 * Draws the sky dial. Anchored top-right, stacked just below the weather
 * strip so it shares the right-hand HUD column and never collides with the
 * centred clock or the birthday/festival banners. `canvasW` right-aligns it.
 */
export function drawSkyDial(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
): void {
  const state = skyDialState(time.hour, time.minute);
  // Right-aligned, one row below the weather strip (strip sits at y=40,
  // height 22). 4px gap keeps the two cards visually distinct.
  const x = canvasW - WIDTH - 12;
  const y = 66;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Frame.
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, WIDTH, HEIGHT);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, WIDTH - 1, HEIGHT - 1);

  // Arc geometry: a shallow dome inside the frame. The body rides it by
  // arcT (0 left horizon -> 1 right horizon), lifted by its altitude.
  const padX = 14;
  const baseY = y + HEIGHT - 14; // horizon line
  const arcLeft = x + padX;
  const arcRight = x + WIDTH - padX;
  const arcSpan = arcRight - arcLeft;
  const arcHeight = 16;

  // Horizon line.
  ctx.strokeStyle = state.isDay ? ARC_DAY : ARC_NIGHT;
  ctx.beginPath();
  ctx.moveTo(arcLeft, baseY + 0.5);
  ctx.lineTo(arcRight, baseY + 0.5);
  ctx.stroke();

  // Dotted arc the body travels along.
  ctx.fillStyle = state.isDay ? ARC_DAY : ARC_NIGHT;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const px = arcLeft + t * arcSpan;
    const py = baseY - Math.sin(t * Math.PI) * arcHeight;
    ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
  }

  // Body position.
  const bx = Math.floor(arcLeft + state.arcT * arcSpan);
  const by = Math.floor(baseY - state.altitude * arcHeight);
  // Weather tie-in: rain / storm dim + grey the body and tuck a small
  // cloud over it so the dial reads the sky, not just the clock.
  const weather = skyWeatherStyle(weatherToday(time));
  ctx.save();
  if (weather.dimmed) ctx.globalAlpha = 0.5;
  if (state.body === 'sun') {
    drawSun(ctx, bx, by);
  } else {
    drawMoon(ctx, bx, by);
  }
  ctx.restore();
  if (weather.cloud) {
    drawCloud(ctx, bx, by, weather.storm);
  }

  // Caption: phase word + daylight-left readout.
  ctx.font = 'bold 9px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = SUBTLE;
  ctx.fillText(state.phaseLabel, x + 8, y + 5);

  if (state.isDay) {
    const minsLeft = daylightMinutesLeft(time.hour, time.minute);
    const hrs = Math.floor(minsLeft / 60);
    const mins = minsLeft % 60;
    const txt = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
    ctx.textAlign = 'right';
    ctx.fillStyle = SUBTLE;
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(txt, x + WIDTH - 8, y + 5);
  }

  ctx.restore();
}

/** Tiny radiant sun glyph centred on (cx, cy). */
function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Rays.
  ctx.fillStyle = SUN_RAY;
  ctx.fillRect(cx - 1, cy - 6, 2, 3);
  ctx.fillRect(cx - 1, cy + 4, 2, 3);
  ctx.fillRect(cx - 6, cy - 1, 3, 2);
  ctx.fillRect(cx + 4, cy - 1, 3, 2);
  // Core.
  ctx.fillStyle = SUN_CORE;
  ctx.fillRect(cx - 3, cy - 2, 6, 5);
  ctx.fillRect(cx - 2, cy - 3, 4, 7);
}

/** Tiny crescent moon glyph centred on (cx, cy). */
function drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Full disc.
  ctx.fillStyle = MOON_CORE;
  ctx.fillRect(cx - 3, cy - 2, 6, 5);
  ctx.fillRect(cx - 2, cy - 3, 4, 7);
  // Shadow bite to make it a crescent.
  ctx.fillStyle = MOON_SHADOW;
  ctx.fillRect(cx, cy - 3, 3, 7);
  ctx.fillRect(cx + 1, cy - 2, 2, 5);
}

/**
 * Small overcast puff tucked over the body so a rainy / stormy day reads
 * at a glance. Offset down-right of the body centre so the dimmed sun /
 * moon still peeks out behind it. Storms get a darker, heavier cloud.
 */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  storm: boolean,
): void {
  const base = storm ? CLOUD_STORM : CLOUD_DARK;
  const top = storm ? CLOUD_DARK : CLOUD_LIGHT;
  // Cloud body — a couple of stacked puffs, offset slightly down-right so
  // the dimmed body still peeks out behind it.
  const ox = cx + 1;
  const oy = cy + 1;
  ctx.fillStyle = base;
  ctx.fillRect(ox - 5, oy + 1, 11, 3);
  ctx.fillRect(ox - 3, oy - 1, 8, 3);
  ctx.fillStyle = top;
  ctx.fillRect(ox - 3, oy - 1, 7, 2);
  ctx.fillRect(ox - 1, oy - 2, 4, 2);
}
