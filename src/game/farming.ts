// Farming actions — till, plant, water, harvest, and the per-day growth
// tick. These functions mutate the World's tiles and crops arrays in
// place. They are pure with respect to side effects beyond the World
// instance so they're easy to unit-test.
//
// The world ships a Crop type (`{x, y, kind, stage, growth}`) used by the
// renderer. Our gameplay crops carry the spec-required fields
// (`tx, ty, crop, watered, daysSinceWater`) AND mirror `x/y/kind/stage`
// so the existing renderer keeps drawing them correctly without changes.
// We treat `kind` as an alias of `crop` mapped onto the renderer's
// limited enum where appropriate.

import type { World, Player, Crop as RenderCrop, Tile } from '../world/world';
import { CROPS } from './crops';

/** Gameplay crop instance stored in `world.crops`. */
export interface FarmCrop {
  /** Spec tile coordinates. */
  tx: number;
  ty: number;
  /** Mirror of `tx/ty` so the existing renderer (which reads x/y) keeps working. */
  x: number;
  y: number;
  /** Catalog key (wheat / tomato / pumpkin / flower). */
  crop: string;
  /** Renderer-side legacy alias. */
  kind: RenderCrop['kind'];
  /** Current growth stage (0-indexed, capped at growthStages-1). */
  stage: number;
  /** Set when the player watered the crop today. Reset at end of day. */
  watered: boolean;
  /** Days since the crop was last watered. Reaches >2 → withers (visual only). */
  daysSinceWater: number;
  /** Legacy renderer growth value — kept in lockstep with stage. */
  growth: number;
}

/** Map our crop keys onto the legacy renderer's allowed kinds. */
function legacyKindFor(cropKey: string): RenderCrop['kind'] {
  switch (cropKey) {
    case 'tomato':
      return 'tomato';
    case 'pumpkin':
      // Renderer doesn't yet know pumpkin — re-use carrot's slot.
      return 'carrot';
    case 'flower':
      return 'turnip';
    case 'wheat':
    default:
      return 'potato';
  }
}

/**
 * Tills the given tile if it's grass. No-op for tiles that are already
 * tilled, are water/path/wood/stone, or for out-of-bounds coordinates.
 * Returns true if the tile changed.
 */
export function till(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const tile: Tile = world.tiles[ty][tx];
  if (tile.type !== 'grass') return false;
  world.tiles[ty][tx] = { type: 'tilled', variant: tile.variant };
  return true;
}

/** Whether a tile is tilled and currently has no crop on it. */
export function isPlantableTile(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  if (world.tiles[ty][tx].type !== 'tilled') return false;
  return cropAt(world, tx, ty) === undefined;
}

/** Find a crop at (tx,ty) or undefined. */
export function cropAt(
  world: World,
  tx: number,
  ty: number,
): FarmCrop | undefined {
  for (const c of world.crops as unknown as FarmCrop[]) {
    if (c.tx === tx && c.ty === ty) return c;
  }
  return undefined;
}

/**
 * Attempts to plant a seed of `cropKey` at (tx,ty). The tile must be
 * tilled and empty, and the player must have at least one of that seed
 * in their inventory (key `<cropKey>` — e.g. `wheat`). Returns true on
 * success.
 */
export function plant(
  world: World,
  tx: number,
  ty: number,
  cropKey: string,
  player: Player,
): boolean {
  if (!CROPS[cropKey]) return false;
  if (!isPlantableTile(world, tx, ty)) return false;
  const seedCount = player.inventory[cropKey] ?? 0;
  if (seedCount <= 0) return false;
  player.inventory[cropKey] = seedCount - 1;
  const crop: FarmCrop = {
    tx,
    ty,
    x: tx,
    y: ty,
    crop: cropKey,
    kind: legacyKindFor(cropKey),
    stage: 0,
    watered: false,
    daysSinceWater: 0,
    growth: 0,
  };
  (world.crops as unknown as FarmCrop[]).push(crop);
  return true;
}

/**
 * Marks the crop at (tx,ty) as watered. Returns true if a crop was
 * present and got watered (idempotent — calling twice in one day is
 * fine, only the first call has an effect).
 */
export function water(world: World, tx: number, ty: number): boolean {
  const c = cropAt(world, tx, ty);
  if (!c) return false;
  c.watered = true;
  c.daysSinceWater = 0;
  return true;
}

/**
 * Attempts to harvest a fully-grown crop. On success the crop is removed,
 * the tile is reset to tilled, and the harvest is added to the player's
 * inventory under `<cropKey>_harvest`. Returns true if harvested.
 */
export function harvest(
  world: World,
  tx: number,
  ty: number,
  player: Player,
): boolean {
  const crops = world.crops as unknown as FarmCrop[];
  const idx = crops.findIndex((c) => c.tx === tx && c.ty === ty);
  if (idx === -1) return false;
  const c = crops[idx];
  const catalog = CROPS[c.crop];
  if (!catalog) return false;
  if (c.stage < catalog.growthStages - 1) return false;
  crops.splice(idx, 1);
  // Reset tile to bare tilled soil.
  if (world.inBounds(tx, ty)) {
    const tile = world.tiles[ty][tx];
    world.tiles[ty][tx] = { type: 'tilled', variant: tile.variant };
  }
  const harvestKey = `${c.crop}_harvest`;
  player.inventory[harvestKey] = (player.inventory[harvestKey] ?? 0) + 1;
  return true;
}

/**
 * Advances every crop by one day. Watered crops grow one stage (capped
 * at growthStages-1); un-watered crops gain a daysSinceWater counter
 * but don't grow. Resets `watered` to false for the next day.
 */
export function advanceDay(world: World): void {
  for (const c of world.crops as unknown as FarmCrop[]) {
    const catalog = CROPS[c.crop];
    if (!catalog) continue;
    if (c.watered) {
      if (c.stage < catalog.growthStages - 1) {
        c.stage += 1;
        c.growth = c.stage;
      }
    } else {
      c.daysSinceWater += 1;
    }
    c.watered = false;
  }
}

/** Convenience helper used by Game to figure out the tile in front of the player. */
export function frontTile(player: Player): { tx: number; ty: number } {
  const tx = Math.round(player.x);
  const ty = Math.round(player.y);
  switch (player.facing) {
    case 'up':
      return { tx, ty: ty - 1 };
    case 'down':
      return { tx, ty: ty + 1 };
    case 'left':
      return { tx: tx - 1, ty };
    case 'right':
      return { tx: tx + 1, ty };
  }
}
