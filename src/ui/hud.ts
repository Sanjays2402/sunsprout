// HUD: top status bar (day / season / time / gold) and bottom hotbar.
//
// The HUD is rendered in screen space after the world has been drawn,
// so it floats above everything. We deliberately keep the font stack
// to monospace and integer-snap every coordinate so the HUD looks like
// it belongs to a pixel-art game.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import { SEASONS } from '../game/time';
import { CROPS, CROP_KEYS, drawCropSprite } from '../game/crops';
import type { Quest } from '../game/quests';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const ACCENT = '#F5C9A0';
const SLOT_BG = 'rgba(40, 30, 60, 0.92)';
const SLOT_BORDER = '#6b5b8e';
const SLOT_SELECTED = '#F5C9A0';
const COIN_COLOR = '#F0C24A';
const COIN_OUTLINE = '#B89224';

/** Format HH:MM AM/PM. */
function fmtTime(time: TimeOfDay): string {
  const h12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
  const ampm = time.hour < 12 ? 'AM' : 'PM';
  const mm = time.minute.toString().padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

/** Draws the top status bar. */
function drawTopBar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  time: TimeOfDay,
  canvasW: number,
): void {
  const barH = 32;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(0, 0, canvasW, barH);
  ctx.fillStyle = PANEL_BORDER;
  ctx.fillRect(0, barH, canvasW, 1);

  ctx.font = 'bold 14px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';

  // Left: day + season
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'left';
  ctx.fillText(`Day ${time.day} · ${SEASONS[time.season]}`, 12, barH / 2);

  // Center: clock
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.fillText(fmtTime(time), canvasW / 2, barH / 2);

  // Right: gold
  ctx.textAlign = 'right';
  const goldText = `${player.gold}g`;
  const goldX = canvasW - 12;
  // Draw a small coin indicator to the left of the gold number.
  const tw = ctx.measureText(goldText).width;
  const coinX = Math.floor(goldX - tw - 16);
  const coinY = Math.floor(barH / 2);
  ctx.fillStyle = COIN_OUTLINE;
  ctx.beginPath();
  ctx.arc(coinX, coinY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COIN_COLOR;
  ctx.beginPath();
  ctx.arc(coinX, coinY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(goldText, goldX, barH / 2);
}

/** Draws the bottom hotbar with crop slots + watering can. */
function drawHotbar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  canvasW: number,
  canvasH: number,
): void {
  const slotSize = 48;
  const gap = 6;
  const slots = CROP_KEYS.length + 1; // crops + watering can
  const totalW = slots * slotSize + (slots - 1) * gap;
  const startX = Math.floor((canvasW - totalW) / 2);
  const y = canvasH - slotSize - 12;

  const selected = (player as Player & { selectedSlot?: number }).selectedSlot ?? 0;

  for (let i = 0; i < slots; i++) {
    const x = startX + i * (slotSize + gap);
    ctx.fillStyle = SLOT_BG;
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = i === selected ? SLOT_SELECTED : SLOT_BORDER;
    ctx.lineWidth = i === selected ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, slotSize - 1, slotSize - 1);

    if (i < CROP_KEYS.length) {
      // Crop seed slot.
      const cropKey = CROP_KEYS[i];
      const crop = CROPS[cropKey];
      // Draw a small ripe-stage preview centred.
      drawCropSprite(
        ctx,
        x + slotSize / 2,
        y + slotSize - 8,
        cropKey,
        crop.growthStages - 1,
      );
      // Seed count badge.
      const count = player.inventory[cropKey] ?? 0;
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(String(count), x + slotSize - 4, y + 3);
      // Hotkey indicator.
      ctx.fillStyle = ACCENT;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 4, y + 3);
    } else {
      // Watering can slot.
      drawWateringCan(ctx, x + slotSize / 2 - 8, y + slotSize / 2 - 8);
      ctx.fillStyle = ACCENT;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('W', x + 4, y + 3);
    }
  }
}

function drawWateringCan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  // Tiny watering can: 16x16 sprite.
  const body = '#4A7BC8';
  const dark = '#345A9A';
  const trim = '#A2C4EE';
  // Body
  ctx.fillStyle = body;
  ctx.fillRect(x + 3, y + 6, 10, 7);
  // Spout
  ctx.fillStyle = body;
  ctx.fillRect(x + 12, y + 4, 3, 2);
  ctx.fillRect(x + 14, y + 3, 2, 3);
  // Handle
  ctx.fillStyle = dark;
  ctx.fillRect(x + 1, y + 7, 3, 4);
  // Top trim
  ctx.fillStyle = trim;
  ctx.fillRect(x + 3, y + 5, 10, 1);
  // Water droplet hint
  ctx.fillStyle = '#7BB3DA';
  ctx.fillRect(x + 15, y + 7, 1, 1);
}

/** Draws active quests in the top-left, just below the status bar. */
function drawQuestPanel(
  ctx: CanvasRenderingContext2D,
  player: Player,
): void {
  const quests = (player.quests as Quest[]) || [];
  const open = quests.filter((q) => !q.complete);
  if (open.length === 0) return;
  const x = 12;
  const y = 40;
  const w = 230;
  const h = 22 + open.length * 18;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('quests', x + 8, y + 5);
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = TEXT_COLOR;
  for (let i = 0; i < open.length; i++) {
    const q = open[i];
    const line = `${q.name}  (${q.progress}/${q.goal})`;
    ctx.fillText(line, x + 8, y + 20 + i * 18);
  }
}

/** Public entry: draws the whole HUD on top of the world. */
export function drawHUD(
  ctx: CanvasRenderingContext2D,
  player: Player,
  time: TimeOfDay,
  canvasW: number,
  canvasH: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  drawTopBar(ctx, player, time, canvasW);
  drawHotbar(ctx, player, canvasW, canvasH);
  drawQuestPanel(ctx, player);
  ctx.restore();
}
