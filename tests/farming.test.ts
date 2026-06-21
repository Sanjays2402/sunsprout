// Farming logic — till / plant / harvest / advanceDay.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  till,
  plant,
  water,
  harvest,
  advanceDay,
} from '../src/game/farming';
import { CROPS } from '../src/game/crops';

function freshWorld() {
  const w = new World();
  const p = w.player;
  // Reset to a clean grass tile near spawn so till() will succeed.
  // (19, 13) is the spawn; (19, 14) is a path tile, so try (10, 13) which
  // should be plain grass.
  p.inventory = { wheat: 5, tomato: 2 };
  p.gold = 50;
  return w;
}

describe('farming', () => {
  it('till() turns a grass tile into tilled soil', () => {
    const w = freshWorld();
    // Find any grass tile.
    let gx = -1;
    let gy = -1;
    outer: for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        if (w.tiles[y][x].type === 'grass') {
          gx = x;
          gy = y;
          break outer;
        }
      }
    }
    expect(gx).toBeGreaterThan(-1);
    expect(till(w, gx, gy)).toBe(true);
    expect(w.tiles[gy][gx].type).toBe('tilled');
  });

  it('plant() decrements the seed and creates a crop entry', () => {
    const w = freshWorld();
    const p = w.player;
    // The world already has an 8x6 tilled patch centred around (19,22).
    expect(w.tiles[22][19].type).toBe('tilled');
    const beforeSeeds = p.inventory.wheat;
    const beforeCrops = w.crops.length;
    expect(plant(w, 19, 22, 'wheat', p)).toBe(true);
    expect(p.inventory.wheat).toBe(beforeSeeds - 1);
    expect(w.crops.length).toBe(beforeCrops + 1);
  });

  it('plant() fails on un-tilled tiles or with no seeds', () => {
    const w = freshWorld();
    const p = w.player;
    // grass tile, not tilled
    expect(plant(w, 0, 0, 'wheat', p)).toBe(false);
    // tilled but no seeds of "pumpkin"
    expect(plant(w, 20, 22, 'pumpkin', p)).toBe(false);
  });

  it('harvest() at full growth adds to inventory and frees the tile', () => {
    const w = freshWorld();
    const p = w.player;
    expect(plant(w, 19, 22, 'wheat', p)).toBe(true);
    // Water + advance enough days to fully grow.
    const stages = CROPS.wheat.growthStages;
    for (let i = 0; i < stages + 2; i++) {
      water(w, 19, 22);
      advanceDay(w);
    }
    const before = p.inventory.wheat_harvest ?? 0;
    const beforeStar = (p.inventory.wheat_harvest_silver ?? 0) + (p.inventory.wheat_harvest_gold ?? 0);
    const quality = harvest(w, 19, 22, p);
    expect(quality).not.toBeNull();
    // Either the normal bucket OR a star bucket must have grown by 1.
    const afterTotal =
      (p.inventory.wheat_harvest ?? 0) +
      (p.inventory.wheat_harvest_silver ?? 0) +
      (p.inventory.wheat_harvest_gold ?? 0);
    expect(afterTotal).toBe(before + beforeStar + 1);
  });
});
