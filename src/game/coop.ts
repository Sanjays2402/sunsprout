// Animal coop + chickens — buy a coop, raise chickens, collect eggs.
//
// The coop is a placeable structure that goes on grass next to the
// farmhouse (the player picks a spot, like a sprinkler). Inside the
// coop the player keeps up to MAX_CHICKENS_PER_COOP chickens; each
// chicken lays one egg at day rollover, dropped into the coop's
// internal eggs cache.
//
// Collect eggs by standing next to the coop and pressing E (the
// existing "interact" key in game.ts). Eggs go into the player's
// inventory under the EGG_INVENTORY_KEY for the recipe / sell loops.
//
// Pure module: no DOM, no rendering side effects in tick logic. A
// drawCoopSprite + drawChickenSprite helper paint the procedural art.

import type { World } from '../world/world';

/** Inventory key for a collected egg. */
export const EGG_INVENTORY_KEY = 'egg';

/** Inventory key for an unplaced coop. */
export const COOP_INVENTORY_KEY = 'coop';

/** Gold cost of a coop kit from the shop. */
export const COOP_PRICE = 600;

/** Sell price of one egg at the well. */
export const EGG_SELL_PRICE = 12;

/** Sell price of one (sad) hen — used if the player wants to clear a coop. */
export const CHICKEN_SELL_PRICE = 80;

/** Buy price of a single chicken from Maple. */
export const CHICKEN_PRICE = 200;

/** Hard cap so a single coop can't run away with the day-rollover cost. */
export const MAX_CHICKENS_PER_COOP = 4;

/** Footprint of a coop in tiles (width x height). */
export const COOP_W = 2;
export const COOP_H = 2;

/** One placed coop in the world. */
export interface PlacedCoop {
  /** Tile-space top-left coordinate. */
  tx: number;
  ty: number;
  /** Number of chickens currently inside. */
  chickens: number;
  /** Eggs sitting inside the coop, waiting to be collected. */
  eggs: number;
}

export interface WorldWithCoops {
  coops?: PlacedCoop[];
}

/** Lazy-init reader. */
export function getCoops(world: World): PlacedCoop[] {
  const w = world as World & WorldWithCoops;
  if (!w.coops) w.coops = [];
  return w.coops;
}

/** True when (tx,ty) is a clear grass tile of the right footprint. */
export function canPlaceCoop(world: World, tx: number, ty: number): boolean {
  // Every tile in the footprint must be plain grass and not occupied
  // by an existing coop or building.
  for (let dy = 0; dy < COOP_H; dy++) {
    for (let dx = 0; dx < COOP_W; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!world.inBounds(x, y)) return false;
      const t = world.tiles[y][x];
      if (t.type !== 'grass') return false;
      // Skip into a building?
      for (const b of world.buildings) {
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return false;
      }
    }
  }
  // No overlapping coop already.
  for (const c of getCoops(world)) {
    if (overlaps({ tx: c.tx, ty: c.ty }, { tx, ty })) return false;
  }
  return true;
}

function overlaps(
  a: { tx: number; ty: number },
  b: { tx: number; ty: number },
): boolean {
  return (
    a.tx < b.tx + COOP_W &&
    a.tx + COOP_W > b.tx &&
    a.ty < b.ty + COOP_H &&
    a.ty + COOP_H > b.ty
  );
}

/** Place a coop. Returns the new PlacedCoop or null when blocked. */
export function placeCoop(world: World, tx: number, ty: number): PlacedCoop | null {
  if (!canPlaceCoop(world, tx, ty)) return null;
  const coop: PlacedCoop = { tx, ty, chickens: 0, eggs: 0 };
  getCoops(world).push(coop);
  return coop;
}

/** Returns the coop whose footprint covers (tx,ty), or undefined. */
export function coopAt(world: World, tx: number, ty: number): PlacedCoop | undefined {
  for (const c of getCoops(world)) {
    if (tx >= c.tx && tx < c.tx + COOP_W && ty >= c.ty && ty < c.ty + COOP_H) {
      return c;
    }
  }
  return undefined;
}

/** True when (tx,ty) is orthogonally adjacent to any coop. */
export function isAdjacentToCoop(world: World, tx: number, ty: number): boolean {
  for (const c of getCoops(world)) {
    if (
      tx >= c.tx - 1 &&
      tx <= c.tx + COOP_W &&
      ty >= c.ty - 1 &&
      ty <= c.ty + COOP_H
    ) {
      // Exclude tiles already inside the footprint — adjacency only.
      const inside = tx >= c.tx && tx < c.tx + COOP_W && ty >= c.ty && ty < c.ty + COOP_H;
      if (!inside) return true;
    }
  }
  return false;
}

/** Returns the first coop next to (tx,ty), or undefined. */
export function adjacentCoop(world: World, tx: number, ty: number): PlacedCoop | undefined {
  for (const c of getCoops(world)) {
    if (
      tx >= c.tx - 1 &&
      tx <= c.tx + COOP_W &&
      ty >= c.ty - 1 &&
      ty <= c.ty + COOP_H
    ) {
      const inside = tx >= c.tx && tx < c.tx + COOP_W && ty >= c.ty && ty < c.ty + COOP_H;
      if (!inside) return c;
    }
  }
  return undefined;
}

/** Adds a chicken to `coop`. Returns true on success, false at cap. */
export function addChicken(coop: PlacedCoop): boolean {
  if (coop.chickens >= MAX_CHICKENS_PER_COOP) return false;
  coop.chickens += 1;
  return true;
}

/**
 * Day-rollover hook. Every chicken in every coop drops one egg into
 * its coop's eggs cache. Returns total eggs produced this morning.
 */
export function coopTick(world: World): number {
  let produced = 0;
  for (const c of getCoops(world)) {
    c.eggs += c.chickens;
    produced += c.chickens;
  }
  return produced;
}

/**
 * Collect every egg in `coop` into the player's inventory. Returns
 * the number actually collected.
 */
export function collectEggs(
  coop: PlacedCoop,
  player: { inventory: Record<string, number> },
): number {
  const n = coop.eggs;
  if (n <= 0) return 0;
  coop.eggs = 0;
  player.inventory[EGG_INVENTORY_KEY] = (player.inventory[EGG_INVENTORY_KEY] ?? 0) + n;
  return n;
}

/** Total egg count across every coop in the world (for stats / quests). */
export function totalEggsWaiting(world: World): number {
  let total = 0;
  for (const c of getCoops(world)) total += c.eggs;
  return total;
}

/** Sells every egg in the player's inventory. Returns gold earned. */
export function sellAllEggs(player: { inventory: Record<string, number>; gold: number }): number {
  const have = player.inventory[EGG_INVENTORY_KEY] ?? 0;
  if (have <= 0) return 0;
  const earned = have * EGG_SELL_PRICE;
  player.inventory[EGG_INVENTORY_KEY] = 0;
  player.gold += earned;
  return earned;
}

// ---------------------------------------------------------------------
// Procedural sprites
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
 * Draw a 2x2 tile coop centered at the screen pixel (cx, cy) — which
 * the caller derives from the coop's tile origin. Small wooden roof
 * + opening + chicken peeking out if any are inside.
 */
export function drawCoopSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  coop: PlacedCoop,
  tileSize: number,
): void {
  const w = COOP_W * tileSize;
  const h = COOP_H * tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 2, y + h - 2, w - 4, 3);
  // Wall.
  px(ctx, x + 4, y + h * 0.4, w - 8, h * 0.6, '#C49A6A');
  // Base shadow.
  px(ctx, x + 4, y + h - 4, w - 8, 3, '#8A6B44');
  // Roof — chunky pixel triangle.
  const roofH = Math.floor(h * 0.5);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const inset = Math.floor(t * (w / 2 - 4));
    const stripY = y + h * 0.4 - i * Math.ceil(roofH / 4);
    px(
      ctx,
      x + inset,
      stripY,
      w - inset * 2,
      Math.ceil(roofH / 4),
      i === 3 ? '#7A4530' : '#B85A3D',
    );
  }
  // Doorway opening.
  px(ctx, x + w / 2 - 4, y + h - 12, 8, 10, '#2A1F12');
  // Door arch.
  px(ctx, x + w / 2 - 4, y + h - 12, 8, 1, '#5A3818');
  // Tiny window with golden glow on each side.
  px(ctx, x + 8, y + h * 0.5, 4, 4, '#FFE4A0');
  px(ctx, x + w - 12, y + h * 0.5, 4, 4, '#FFE4A0');
  // Peeking chicken if any are inside.
  if (coop.chickens > 0) {
    drawChickenSprite(ctx, x + w / 2, y + h - 4);
  }
  // Egg counter badge above the roof when collectible eggs are waiting.
  if (coop.eggs > 0) {
    const text = `${coop.eggs}`;
    ctx.save();
    ctx.font = 'bold 9px ui-monospace, monospace';
    const tw = ctx.measureText(text).width + 8;
    const bx = x + w / 2 - tw / 2;
    const by = y - 12;
    px(ctx, bx, by, tw, 12, '#F5E9D4');
    ctx.fillStyle = '#1A1426';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, by + 6);
    ctx.restore();
  }
}

/** Tiny chicken sprite — peeks out of the coop doorway. */
export function drawChickenSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  // Body.
  px(ctx, x - 3, y - 4, 6, 4, '#F8F0E0');
  // Tail.
  px(ctx, x + 3, y - 5, 2, 2, '#F8F0E0');
  // Head.
  px(ctx, x - 4, y - 6, 3, 3, '#F8F0E0');
  // Comb.
  px(ctx, x - 3, y - 8, 2, 1, '#D8322A');
  // Beak.
  px(ctx, x - 5, y - 5, 1, 1, '#F0A828');
  // Eye.
  px(ctx, x - 3, y - 5, 1, 1, '#1A1426');
}
