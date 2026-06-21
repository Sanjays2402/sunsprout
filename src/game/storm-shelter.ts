// Storm shelter — protect a small cluster of crops from the seasonal
// storm without needing a full greenhouse.
//
// The seasonal storm (storm.ts) docks one waterStreak point from every
// outdoor crop on impact. A greenhouse is the headline shelter, but a
// greenhouse is a late-game purchase: 3x3 footprint plus 1800g. Storm
// shelters give the early-to-mid-game player a cheaper, smaller-scope
// alternative: a single tile that protects a Chebyshev-radius-1
// (3x3) cluster of crops from the next storm only. After the shelter
// absorbs a storm it's spent and the player has to craft another.
//
// Design intent:
//   - Bench recipe: 400g + 1 iron — comparable to a scarecrow's tier.
//   - 1-tile placeable that sits on grass or tilled soil. Sprite is a
//     small wooden lean-to with a slate roof.
//   - On storm impact, every shelter that covers (Chebyshev radius 1)
//     at least one outdoor crop is consumed (removed from the world)
//     AND every crop in its footprint gets its waterStreak left intact.
//   - Crops inside a greenhouse are still safe via greenhouseTick; the
//     shelter is a separate path that runs BEFORE the streak deduction
//     in storm.ts.
//
// Pure module: no IO, no canvas (we ship a procedural sprite helper).
// The Game wires placement on the `8` key and storm.ts queries this
// module before docking the streak.

import type { World, Tile } from '../world/world';

/** Crafted-kit inventory key (unplaced shelter). */
export const STORM_SHELTER_INVENTORY_KEY = 'craft-shelter';

/** Chebyshev radius the shelter covers when standing alone. */
export const SHELTER_RADIUS = 1;

/**
 * Chebyshev radius the shelter covers when paired with a partner
 * shelter within SHELTER_PAIR_RANGE. Two shelters paired = each one's
 * coverage widens from a 3x3 to a 5x5. Both still get consumed when
 * the storm hits.
 */
export const SHELTER_RADIUS_PAIRED = 2;

/**
 * Two shelters within this Chebyshev distance form a "pair" and each
 * one's coverage widens to SHELTER_RADIUS_PAIRED. Anything farther
 * apart falls back to the SHELTER_RADIUS single-coverage footprint.
 */
export const SHELTER_PAIR_RANGE = 2;

/** One placed shelter in the world. */
export interface PlacedShelter {
  tx: number;
  ty: number;
}

export interface WorldWithShelters {
  shelters?: PlacedShelter[];
}

/** Lazy reader. */
export function getShelters(world: World): PlacedShelter[] {
  const w = world as World & WorldWithShelters;
  if (!w.shelters) w.shelters = [];
  return w.shelters;
}

/** True when (tx,ty) is grass / tilled and free of overlapping shelters. */
export function canPlaceShelter(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const tile: Tile = world.tiles[ty][tx];
  if (tile.type !== 'grass' && tile.type !== 'tilled') return false;
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return false;
  }
  for (const s of getShelters(world)) {
    if (s.tx === tx && s.ty === ty) return false;
  }
  return true;
}

/** Place a shelter. Returns the placed entity or null. */
export function placeShelter(world: World, tx: number, ty: number): PlacedShelter | null {
  if (!canPlaceShelter(world, tx, ty)) return null;
  const s: PlacedShelter = { tx, ty };
  getShelters(world).push(s);
  return s;
}

/**
 * Returns the effective Chebyshev radius for `shelter`, taking into
 * account any partner shelter sitting within SHELTER_PAIR_RANGE. A
 * shelter with at least one neighbour in range covers the wider
 * SHELTER_RADIUS_PAIRED footprint; an isolated shelter falls back to
 * SHELTER_RADIUS.
 */
export function effectiveRadius(world: World, shelter: PlacedShelter): number {
  const shelters = getShelters(world);
  for (const other of shelters) {
    if (other === shelter) continue;
    if (other.tx === shelter.tx && other.ty === shelter.ty) continue;
    if (
      Math.abs(other.tx - shelter.tx) <= SHELTER_PAIR_RANGE &&
      Math.abs(other.ty - shelter.ty) <= SHELTER_PAIR_RANGE
    ) {
      return SHELTER_RADIUS_PAIRED;
    }
  }
  return SHELTER_RADIUS;
}

/** True iff `shelter` has at least one partner within SHELTER_PAIR_RANGE. */
export function isPaired(world: World, shelter: PlacedShelter): boolean {
  return effectiveRadius(world, shelter) === SHELTER_RADIUS_PAIRED;
}

/** True iff (tx,ty) is within the effective radius of any placed shelter. */
export function isUnderShelter(world: World, tx: number, ty: number): boolean {
  const shelters = getShelters(world);
  for (const s of shelters) {
    const r = effectiveRadius(world, s);
    if (Math.abs(s.tx - tx) <= r && Math.abs(s.ty - ty) <= r) {
      return true;
    }
  }
  return false;
}

/**
 * Consume every shelter that absorbed a storm. We pass the set of
 * sheltered crop positions so the caller can decide which shelters
 * "did work" — only the ones that actually covered a crop are spent.
 *
 * `coveredCropTiles` is the deduplicated list of (tx,ty) crops the
 * caller would have docked. Returns the count of shelters consumed.
 *
 * Honours pairing: a paired shelter covers SHELTER_RADIUS_PAIRED so
 * a crop two tiles away counts as covered by it.
 */
export function consumeShelteringShelters(
  world: World,
  coveredCropTiles: Array<{ tx: number; ty: number }>,
): number {
  if (coveredCropTiles.length === 0) return 0;
  const shelters = getShelters(world);
  // Snapshot effective radii BEFORE we start removing shelters — otherwise
  // removing one half of a pair could shrink the partner's coverage mid-loop.
  const radii: number[] = shelters.map((s) => effectiveRadius(world, s));
  const used: Set<number> = new Set();
  for (const c of coveredCropTiles) {
    for (let i = 0; i < shelters.length; i++) {
      const s = shelters[i];
      const r = radii[i];
      if (Math.abs(s.tx - c.tx) <= r && Math.abs(s.ty - c.ty) <= r) {
        used.add(i);
      }
    }
  }
  if (used.size === 0) return 0;
  // Filter out used shelters. Iterate descending so splice indices stay valid.
  const keep: PlacedShelter[] = [];
  for (let i = 0; i < shelters.length; i++) {
    if (!used.has(i)) keep.push(shelters[i]);
  }
  shelters.length = 0;
  for (const k of keep) shelters.push(k);
  return used.size;
}

/** Total shelters currently placed. Surface for HUD glance. */
export function shelterCount(world: World): number {
  return getShelters(world).length;
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
 * Draws a small lean-to shelter sprite centred at (cx, cy). Two
 * wooden uprights, a tilted slate roof, and a small chimneyless cap.
 * Designed to read as "rain cover" without dominating the tile.
 *
 * When `paired` is true the storm-cloud glyph on the roof is replaced
 * with a wider double-arc so the player can see at a glance that this
 * shelter is in pair-coverage range of another.
 */
export function drawShelterSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tileSize: number,
  paired: boolean = false,
): void {
  const w = tileSize;
  const h = tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 3, y + h - 3, w - 6, 3);
  // Uprights.
  px(ctx, x + 4, y + h * 0.5, 2, h * 0.4, '#5A3818');
  px(ctx, x + w - 6, y + h * 0.5, 2, h * 0.4, '#5A3818');
  // Slanted slate roof (tilted right).
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const inset = Math.floor(t * (w / 2 - 3));
    const stripY = y + h * 0.5 - i * 3;
    px(ctx, x + inset + 2, stripY, w - 4 - inset, 2, i === 0 ? '#3A2D44' : '#5C4870');
  }
  // Back wall slats.
  px(ctx, x + 6, y + h * 0.62, w - 12, 4, '#7A4E2A');
  for (let i = 0; i < 3; i++) {
    px(ctx, x + 6, y + h * 0.62 + i * 2, w - 12, 1, '#3A2818');
  }
  // Roof glyph — single storm cloud, or a wider paired-arc when this
  // shelter is in pair range of another.
  if (paired) {
    // Two cloud puffs side by side + a small connector — tiny pair sigil.
    px(ctx, x + w / 2 - 4, y + h * 0.36, 3, 2, 'rgba(245,233,212,0.9)');
    px(ctx, x + w / 2 + 1, y + h * 0.36, 3, 2, 'rgba(245,233,212,0.9)');
    px(ctx, x + w / 2 - 1, y + h * 0.38, 2, 1, 'rgba(245,233,212,0.9)');
  } else {
    // Storm cloud glyph on the roof — single pixel cluster.
    px(ctx, x + w / 2 - 2, y + h * 0.36, 4, 2, 'rgba(245,233,212,0.9)');
    px(ctx, x + w / 2 - 1, y + h * 0.34, 2, 1, 'rgba(245,233,212,0.9)');
  }
}
