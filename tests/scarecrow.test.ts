// Scarecrow — placement, coverage, quality boost, persistence.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  SCARECROW_INVENTORY_KEY,
  SCARECROW_RADIUS,
  getScarecrows,
  isCovered,
  placeScarecrow,
  removeScarecrow,
  scarecrowAt,
  scarecrowBoost,
} from '../src/game/scarecrow';

function grassTile(w: World, tx: number, ty: number): void {
  w.tiles[ty][tx] = { type: 'grass' };
}

describe('placeScarecrow', () => {
  it('plants on a grass tile and tracks the placement', () => {
    const w = new World();
    grassTile(w, 5, 5);
    expect(placeScarecrow(w, 5, 5)).toBe(true);
    expect(getScarecrows(w).length).toBe(1);
    expect(scarecrowAt(w, 5, 5)).toBeDefined();
  });

  it('refuses non-grass tiles', () => {
    const w = new World();
    w.tiles[5][5] = { type: 'tilled' };
    expect(placeScarecrow(w, 5, 5)).toBe(false);
    expect(getScarecrows(w).length).toBe(0);
  });

  it('refuses out-of-bounds coordinates', () => {
    const w = new World();
    expect(placeScarecrow(w, -1, 5)).toBe(false);
    expect(placeScarecrow(w, 5, -1)).toBe(false);
    expect(placeScarecrow(w, 999, 5)).toBe(false);
  });

  it('refuses double-stack on the same tile', () => {
    const w = new World();
    grassTile(w, 6, 7);
    expect(placeScarecrow(w, 6, 7)).toBe(true);
    expect(placeScarecrow(w, 6, 7)).toBe(false);
    expect(getScarecrows(w).length).toBe(1);
  });
});

describe('removeScarecrow', () => {
  it('removes a placed scarecrow', () => {
    const w = new World();
    grassTile(w, 2, 2);
    placeScarecrow(w, 2, 2);
    expect(removeScarecrow(w, 2, 2)).toBe(true);
    expect(getScarecrows(w).length).toBe(0);
  });

  it('returns false when nothing is there', () => {
    const w = new World();
    expect(removeScarecrow(w, 1, 1)).toBe(false);
  });
});

describe('isCovered + radius', () => {
  it('covers tiles within SCARECROW_RADIUS Chebyshev', () => {
    const w = new World();
    grassTile(w, 10, 10);
    placeScarecrow(w, 10, 10);
    expect(isCovered(w, 10, 10)).toBe(true);
    expect(isCovered(w, 10 + SCARECROW_RADIUS, 10)).toBe(true);
    expect(isCovered(w, 10, 10 + SCARECROW_RADIUS)).toBe(true);
    expect(isCovered(w, 10 - SCARECROW_RADIUS, 10 + SCARECROW_RADIUS)).toBe(true);
  });

  it('does not cover tiles past the radius', () => {
    const w = new World();
    grassTile(w, 10, 10);
    placeScarecrow(w, 10, 10);
    expect(isCovered(w, 10 + SCARECROW_RADIUS + 1, 10)).toBe(false);
    expect(isCovered(w, 10, 10 - SCARECROW_RADIUS - 1)).toBe(false);
  });

  it('reports uncovered when no scarecrow has been placed', () => {
    const w = new World();
    expect(isCovered(w, 5, 5)).toBe(false);
  });
});

describe('scarecrowBoost', () => {
  it('does not change quality when uncovered', () => {
    const w = new World();
    expect(scarecrowBoost(w, 1, 1, 'normal')).toBe('normal');
    expect(scarecrowBoost(w, 1, 1, 'silver')).toBe('silver');
    expect(scarecrowBoost(w, 1, 1, 'gold')).toBe('gold');
  });

  it('bumps normal -> silver and silver -> gold when covered', () => {
    const w = new World();
    grassTile(w, 8, 8);
    placeScarecrow(w, 8, 8);
    expect(scarecrowBoost(w, 8, 8, 'normal')).toBe('silver');
    expect(scarecrowBoost(w, 8, 8, 'silver')).toBe('gold');
  });

  it('caps at gold (no higher tier exists)', () => {
    const w = new World();
    grassTile(w, 8, 8);
    placeScarecrow(w, 8, 8);
    expect(scarecrowBoost(w, 8, 8, 'gold')).toBe('gold');
  });
});

describe('inventory key matches the craft recipe', () => {
  it('is craft-scarecrow', () => {
    expect(SCARECROW_INVENTORY_KEY).toBe('craft-scarecrow');
  });
});

// Integration with farming.harvest() — ensures the boost actually
// reaches the inventory bucket.
import { plant, water, advanceDay, harvest } from '../src/game/farming';
import { CROPS } from '../src/game/crops';

describe('scarecrow integration with harvest()', () => {
  it('an unwatered wheat next to a scarecrow harvests as silver', () => {
    const w = new World();
    w.player.inventory = { wheat: 6 };
    // Tilled patch starts at (19,22). Place a scarecrow on an adjacent
    // grass tile so the radius covers (19,22).
    const grassX = 19;
    const grassY = 21;
    w.tiles[grassY][grassX] = { type: 'grass' };
    placeScarecrow(w, grassX, grassY);
    plant(w, 19, 22, 'wheat', w.player);
    // Force-ripe without watering — quality from streak would be normal.
    const c = w.crops[0] as unknown as { stage: number; watered: boolean; waterStreak: number };
    c.stage = CROPS.wheat.growthStages - 1;
    const q = harvest(w, 19, 22, w.player);
    expect(q).toBe('silver');
    expect(w.player.inventory.wheat_harvest_silver ?? 0).toBe(1);
  });

  it('a silver-tier wheat next to a scarecrow harvests as gold', () => {
    const w = new World();
    w.player.inventory = { wheat: 6 };
    w.tiles[21][19] = { type: 'grass' };
    placeScarecrow(w, 19, 21);
    plant(w, 19, 22, 'wheat', w.player);
    // Earn silver naturally (3 watered days for wheat).
    for (let i = 0; i < CROPS.wheat.growthStages; i++) {
      water(w, 19, 22);
      advanceDay(w);
    }
    const q = harvest(w, 19, 22, w.player);
    expect(q).toBe('gold');
    expect(w.player.inventory.wheat_harvest_gold ?? 0).toBe(1);
  });

  it('crops outside the radius are not affected', () => {
    const w = new World();
    w.player.inventory = { wheat: 6 };
    w.tiles[0][0] = { type: 'grass' };
    placeScarecrow(w, 0, 0);
    plant(w, 19, 22, 'wheat', w.player);
    const c = w.crops[0] as unknown as { stage: number };
    c.stage = CROPS.wheat.growthStages - 1;
    const q = harvest(w, 19, 22, w.player);
    expect(q).toBe('normal');
  });
});
