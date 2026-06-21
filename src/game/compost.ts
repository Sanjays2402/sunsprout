// Compost bin — recycle harvest crops into fertilizer.
//
// Excess wheat/tomato/pumpkin/flower crops sit in the bag taking up
// space; the well sells them at base price but a player late-game has
// silver and gold harvests they'd rather sell instead. The compost
// bin gives those normal-tier crops a second life: deposit any number
// of `<crop>_harvest` keys into the bin and they ferment for
// COMPOST_DAYS days into bags of fertilizer. Applying a fertilizer
// bag to a watered crop bumps its waterStreak by FERTILIZER_STREAK so
// the crop ripens a tier higher at harvest.
//
// Pricing intent: COMPOST_BIN_PRICE (140g) at Maple's shop. The bin
// is a 1-tile placeable so it slots next to the field without taking
// real estate. COMPOST_RATIO of 4 crops per 1 fertilizer keeps the
// player from steamrolling silver-tier with a single planting season:
// they have to choose between selling at the well or recycling.
//
// Pure module: no IO, no canvas. The Game wires placement, deposit
// hotkey, fertilizer apply, and the dawn finish-tick.

import type { World, Tile } from '../world/world';
import type { FarmCrop } from './farming';
import { cropAt } from './farming';
import { CROP_KEYS } from './crops';

/** Inventory key for an unplaced bin from Maple's shop. */
export const COMPOST_BIN_INVENTORY_KEY = 'compost-bin';

/** Maple's price for one bin. */
export const COMPOST_BIN_PRICE = 140;

/** Inventory key for a finished bag of fertilizer. */
export const FERTILIZER_INVENTORY_KEY = 'fertilizer';

/** Days a deposit takes to finish composting into fertilizer. */
export const COMPOST_DAYS = 3;

/** Crops required per finished fertilizer bag. */
export const COMPOST_RATIO = 4;

/** Hard cap of pending compost piles inside one bin. */
export const COMPOST_MAX_BATCHES = 5;

/** Streak bonus a fertilizer bag grants when applied. */
export const FERTILIZER_STREAK = 2;

/** Footprint is 1x1; placement matches sprinkler / chest convention. */

/** One pending batch inside the bin. */
export interface CompostBatch {
  /** How many normal-tier crops are sitting in this pile. */
  crops: number;
  /** Day the batch finishes — yields Math.floor(crops/COMPOST_RATIO) bags. */
  finishOnDay: number;
}

/** One placed bin in the world. */
export interface PlacedCompost {
  tx: number;
  ty: number;
  /** Pending piles. Each was committed on the day deposit happened. */
  batches: CompostBatch[];
}

export interface WorldWithCompost {
  composts?: PlacedCompost[];
}

/** Lazy reader. */
export function getComposts(world: World): PlacedCompost[] {
  const w = world as World & WorldWithCompost;
  if (!w.composts) w.composts = [];
  return w.composts;
}

/** True when (tx,ty) is grass and outside any existing building or bin. */
export function canPlaceCompost(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const tile: Tile = world.tiles[ty][tx];
  if (tile.type !== 'grass') return false;
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return false;
  }
  if (compostAt(world, tx, ty)) return false;
  return true;
}

/** Place a bin. Returns the placed entity or null. */
export function placeCompost(world: World, tx: number, ty: number): PlacedCompost | null {
  if (!canPlaceCompost(world, tx, ty)) return null;
  const c: PlacedCompost = { tx, ty, batches: [] };
  getComposts(world).push(c);
  return c;
}

/** Returns the bin at (tx,ty) or undefined. */
export function compostAt(world: World, tx: number, ty: number): PlacedCompost | undefined {
  return getComposts(world).find((c) => c.tx === tx && c.ty === ty);
}

/** Returns the bin orthogonally or diagonally adjacent to (tx,ty), or undefined. */
export function adjacentCompost(
  world: World,
  tx: number,
  ty: number,
): PlacedCompost | undefined {
  for (const c of getComposts(world)) {
    if (Math.abs(c.tx - tx) <= 1 && Math.abs(c.ty - ty) <= 1) {
      return c;
    }
  }
  return undefined;
}

/** Outcome of a deposit attempt. */
export type DepositOutcome =
  | { kind: 'deposited'; crops: number; finishOnDay: number }
  | { kind: 'no-crops' }
  | { kind: 'bin-full' };

/**
 * Deposit every normal-tier `<crop>_harvest` from the bag into the
 * bin. Silver / gold harvests are LEFT IN THE BAG so the player can
 * sell them at full premium — composting them would be a waste.
 *
 * Returns the count actually deposited. Refuses with 'no-crops' when
 * the bag is dry, 'bin-full' when the bin is already at the batch cap.
 */
export function depositCrops(
  bin: PlacedCompost,
  player: { inventory: Record<string, number> },
  today: number,
): DepositOutcome {
  if (bin.batches.length >= COMPOST_MAX_BATCHES) {
    return { kind: 'bin-full' };
  }
  let total = 0;
  for (const cropKey of CROP_KEYS) {
    const k = `${cropKey}_harvest`;
    const have = player.inventory[k] ?? 0;
    if (have > 0) {
      total += have;
      player.inventory[k] = 0;
    }
  }
  if (total <= 0) return { kind: 'no-crops' };
  const batch: CompostBatch = { crops: total, finishOnDay: today + COMPOST_DAYS - 1 };
  bin.batches.push(batch);
  return { kind: 'deposited', crops: total, finishOnDay: batch.finishOnDay };
}

/**
 * Day-rollover hook. Walk every bin; any batch whose finishOnDay is
 * less than `today` mints floor(crops/COMPOST_RATIO) fertilizer bags
 * into the player's inventory, then removes itself from the bin.
 *
 * Returns the total bags minted across every bin this morning so the
 * caller can post a single toast.
 */
export function compostTick(
  world: World,
  player: { inventory: Record<string, number> },
  today: number,
): number {
  let minted = 0;
  for (const bin of getComposts(world)) {
    const remaining: CompostBatch[] = [];
    for (const b of bin.batches) {
      if (b.finishOnDay < today) {
        const bags = Math.floor(b.crops / COMPOST_RATIO);
        if (bags > 0) {
          player.inventory[FERTILIZER_INVENTORY_KEY] =
            (player.inventory[FERTILIZER_INVENTORY_KEY] ?? 0) + bags;
          minted += bags;
        }
      } else {
        remaining.push(b);
      }
    }
    bin.batches = remaining;
  }
  return minted;
}

/** Outcome of an apply attempt. */
export type ApplyOutcome =
  | { kind: 'applied'; cropKey: string; newStreak: number }
  | { kind: 'no-fertilizer' }
  | { kind: 'no-crop' };

/**
 * Apply one fertilizer bag to the crop at (tx,ty). Returns the new
 * waterStreak so the caller can surface it in a toast. Silently
 * leaves the streak alone if no crop is there.
 */
export function applyFertilizer(
  world: World,
  player: { inventory: Record<string, number> },
  tx: number,
  ty: number,
): ApplyOutcome {
  const have = player.inventory[FERTILIZER_INVENTORY_KEY] ?? 0;
  if (have <= 0) return { kind: 'no-fertilizer' };
  const c = cropAt(world, tx, ty);
  if (!c) return { kind: 'no-crop' };
  const farmCrop = c as unknown as FarmCrop;
  player.inventory[FERTILIZER_INVENTORY_KEY] = have - 1;
  farmCrop.waterStreak = (farmCrop.waterStreak ?? 0) + FERTILIZER_STREAK;
  // The crop is now treated as freshly watered so the dryness counter
  // doesn't ruin the bumped streak overnight.
  farmCrop.daysSinceWater = 0;
  farmCrop.watered = true;
  return { kind: 'applied', cropKey: farmCrop.crop, newStreak: farmCrop.waterStreak };
}

/** Total pending crops across all bins. Used for HUD glance. */
export function pendingCrops(world: World): number {
  let total = 0;
  for (const c of getComposts(world)) {
    for (const b of c.batches) total += b.crops;
  }
  return total;
}

/** Pretty status line for the bin under the player's feet. */
export function compostStatusLine(bin: PlacedCompost, today: number): string {
  if (bin.batches.length === 0) {
    return 'Compost bin is empty. Press F to deposit normal-tier crops.';
  }
  let nearestLeft = Infinity;
  let pendingBags = 0;
  let dryCrops = 0;
  for (const b of bin.batches) {
    const left = b.finishOnDay - today + 1;
    if (left < nearestLeft) nearestLeft = left;
    if (b.finishOnDay < today) {
      pendingBags += Math.floor(b.crops / COMPOST_RATIO);
    } else {
      dryCrops += b.crops;
    }
  }
  if (pendingBags > 0) {
    return `Compost ready: ${pendingBags} bag${pendingBags === 1 ? '' : 's'} hatching at dawn.`;
  }
  return `Composting ${dryCrops} crop${dryCrops === 1 ? '' : 's'} — ${nearestLeft} day${nearestLeft === 1 ? '' : 's'} until first bag.`;
}

// ---------------------------------------------------------------------
// Procedural sprite
// ---------------------------------------------------------------------

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, w), Math.max(1, h));
}

/**
 * Draws a small wooden compost bin centered at (cx, cy). Lid + slats
 * for the woodwork; a brown-green compost layer peeks above the top
 * when batches are inside. A small grass-green sprig pokes out when a
 * bag is ready, otherwise the lid sits closed.
 */
export function drawCompostSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bin: PlacedCompost,
  today: number,
  tileSize: number,
): void {
  const w = tileSize;
  const h = tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 3, y + h - 3, w - 6, 3);
  // Bin body — dark wood with horizontal slats.
  px(ctx, x + 3, y + h * 0.35, w - 6, h * 0.55, '#6E4A28');
  for (let i = 0; i < 3; i++) {
    px(ctx, x + 3, y + h * 0.45 + i * 4, w - 6, 1, '#3A2818');
  }
  // Side posts.
  px(ctx, x + 3, y + h * 0.35, 2, h * 0.55, '#8A6B44');
  px(ctx, x + w - 5, y + h * 0.35, 2, h * 0.55, '#8A6B44');
  // Compost layer peeks above the lid only when batches are inside.
  if (bin.batches.length > 0) {
    px(ctx, x + 4, y + h * 0.32, w - 8, 3, '#5A6A28');
    // Sprig if a bag is ready.
    const ready = bin.batches.some((b) => b.finishOnDay < today);
    if (ready) {
      px(ctx, x + w / 2, y + h * 0.26, 1, 4, '#A8C04A');
      px(ctx, x + w / 2 - 1, y + h * 0.26, 1, 1, '#A8C04A');
      px(ctx, x + w / 2 + 1, y + h * 0.26, 1, 1, '#A8C04A');
    }
  }
  // Lid lip.
  px(ctx, x + 2, y + h * 0.34, w - 4, 2, '#3A2818');
}
