// Greenhouse — placement, auto-water + accelerated growth, persistence.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingHearts } from '../src/game/hearts';
import { startingQuests } from '../src/game/quests';
import { plant, advanceDay, cropAt } from '../src/game/farming';
import {
  GREENHOUSE_GROWTH_BONUS,
  GREENHOUSE_H,
  GREENHOUSE_INVENTORY_KEY,
  GREENHOUSE_PRICE,
  GREENHOUSE_W,
  canPlaceGreenhouse,
  getGreenhouses,
  greenhouseTick,
  greenhouseTileCount,
  isInsideGreenhouse,
  placeGreenhouse,
} from '../src/game/greenhouse';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 8, tomato: 4, pumpkin: 2 };
  w.player.gold = 2000;
  w.player.quests = startingQuests();
  w.player.hearts = startingHearts();
  return w;
}

function fakeGame(): Game {
  const world = fakeWorld();
  const time = new TimeOfDay(6);
  return { world, time } as unknown as Game;
}

const FREE_TX = 10;
const FREE_TY = 14;

describe('greenhouse', () => {
  it('every catalog constant is sane', () => {
    expect(GREENHOUSE_PRICE).toBeGreaterThan(0);
    expect(GREENHOUSE_W).toBeGreaterThan(0);
    expect(GREENHOUSE_H).toBeGreaterThan(0);
    expect(GREENHOUSE_INVENTORY_KEY).toBe('greenhouse-kit');
    expect(GREENHOUSE_GROWTH_BONUS).toBeGreaterThanOrEqual(1);
  });

  it('canPlaceGreenhouse only accepts a clear grass footprint', () => {
    const w = fakeWorld();
    expect(canPlaceGreenhouse(w, FREE_TX, FREE_TY)).toBe(true);
    // Plaza is paths, never grass.
    expect(canPlaceGreenhouse(w, 14, 6)).toBe(false);
    // Out of bounds.
    expect(canPlaceGreenhouse(w, 39, 29)).toBe(false);
  });

  it('placeGreenhouse converts every footprint tile to tilled', () => {
    const w = fakeWorld();
    const g = placeGreenhouse(w, FREE_TX, FREE_TY);
    expect(g).not.toBeNull();
    for (let dy = 0; dy < GREENHOUSE_H; dy++) {
      for (let dx = 0; dx < GREENHOUSE_W; dx++) {
        expect(w.tiles[FREE_TY + dy][FREE_TX + dx].type).toBe('tilled');
      }
    }
  });

  it('placeGreenhouse refuses overlapping footprints', () => {
    const w = fakeWorld();
    expect(placeGreenhouse(w, FREE_TX, FREE_TY)).not.toBeNull();
    expect(placeGreenhouse(w, FREE_TX + 1, FREE_TY)).toBeNull();
  });

  it('isInsideGreenhouse covers the full footprint', () => {
    const w = fakeWorld();
    placeGreenhouse(w, FREE_TX, FREE_TY);
    expect(isInsideGreenhouse(w, FREE_TX, FREE_TY)).toBe(true);
    expect(isInsideGreenhouse(w, FREE_TX + GREENHOUSE_W - 1, FREE_TY + GREENHOUSE_H - 1)).toBe(true);
    expect(isInsideGreenhouse(w, FREE_TX - 1, FREE_TY)).toBe(false);
    expect(isInsideGreenhouse(w, FREE_TX + GREENHOUSE_W, FREE_TY)).toBe(false);
  });

  it('greenhouseTick waters and bumps growth for every crop inside', () => {
    const w = fakeWorld();
    placeGreenhouse(w, FREE_TX, FREE_TY);
    expect(plant(w, FREE_TX, FREE_TY, 'wheat', w.player)).toBe(true);
    expect(plant(w, FREE_TX + 1, FREE_TY + 1, 'tomato', w.player)).toBe(true);
    // Standard day: advanceDay first (un-watered, no growth), then greenhouseTick.
    advanceDay(w);
    const beforeWheat = (cropAt(w, FREE_TX, FREE_TY) as unknown as { stage: number }).stage;
    const beforeTomato = (cropAt(w, FREE_TX + 1, FREE_TY + 1) as unknown as { stage: number }).stage;
    const bumped = greenhouseTick(w);
    expect(bumped).toBe(2);
    const afterWheat = (cropAt(w, FREE_TX, FREE_TY) as unknown as { stage: number }).stage;
    const afterTomato = (cropAt(w, FREE_TX + 1, FREE_TY + 1) as unknown as { stage: number }).stage;
    expect(afterWheat).toBe(beforeWheat + GREENHOUSE_GROWTH_BONUS);
    expect(afterTomato).toBe(beforeTomato + GREENHOUSE_GROWTH_BONUS);
  });

  it('greenhouseTick respects the growth cap', () => {
    const w = fakeWorld();
    placeGreenhouse(w, FREE_TX, FREE_TY);
    plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
    const farm = cropAt(w, FREE_TX, FREE_TY) as unknown as { stage: number };
    farm.stage = 2; // already at the wheat cap (growthStages 3, max idx 2)
    greenhouseTick(w);
    expect((cropAt(w, FREE_TX, FREE_TY) as unknown as { stage: number }).stage).toBe(2);
  });

  it('greenhouseTick is a no-op when no greenhouses are placed', () => {
    const w = fakeWorld();
    expect(greenhouseTick(w)).toBe(0);
  });

  it('greenhouseTick waters but does not bump if no crop is planted', () => {
    const w = fakeWorld();
    placeGreenhouse(w, FREE_TX, FREE_TY);
    expect(greenhouseTick(w)).toBe(0);
  });

  it('greenhouseTileCount scales with placements', () => {
    const w = fakeWorld();
    expect(greenhouseTileCount(w)).toBe(0);
    placeGreenhouse(w, FREE_TX, FREE_TY);
    expect(greenhouseTileCount(w)).toBe(GREENHOUSE_W * GREENHOUSE_H);
  });

  it('a fully chained sleep-like day: watered crop + greenhouse grows TWO stages', () => {
    const w = fakeWorld();
    placeGreenhouse(w, FREE_TX, FREE_TY);
    plant(w, FREE_TX, FREE_TY, 'tomato', w.player);
    const start = (cropAt(w, FREE_TX, FREE_TY) as unknown as { stage: number }).stage;
    // Pre-water so advanceDay grows one stage.
    const farm = cropAt(w, FREE_TX, FREE_TY) as unknown as { stage: number; watered: boolean };
    farm.watered = true;
    advanceDay(w);
    greenhouseTick(w);
    const after = (cropAt(w, FREE_TX, FREE_TY) as unknown as { stage: number }).stage;
    expect(after).toBe(start + 1 + GREENHOUSE_GROWTH_BONUS); // 1 standard + bonus
  });

  it('greenhouses survive a persistence round-trip', () => {
    const a = fakeGame();
    placeGreenhouse(a.world, FREE_TX, FREE_TY);
    placeGreenhouse(a.world, FREE_TX + GREENHOUSE_W + 1, FREE_TY);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getGreenhouses(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const restored = getGreenhouses(b.world);
    expect(restored.length).toBe(2);
    expect(restored[0].tx).toBe(FREE_TX);
  });
});
