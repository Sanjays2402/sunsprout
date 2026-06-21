// Winter quiet-season pass — outdoor crops freeze, greenhouse still grows,
// hot cocoa joins the recipe book.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  freezeOutdoorCrops,
  isFrozenSeason,
  winterFlavorLine,
  WINTER_SEASON_INDEX,
} from '../src/game/winter';
import { plant, till, water, advanceDay } from '../src/game/farming';
import { placeGreenhouse, greenhouseTick } from '../src/game/greenhouse';
import { RECIPES, RECIPE_KEYS, canCook } from '../src/game/cooking';
import { addItem } from '../src/game/economy';

describe('isFrozenSeason', () => {
  it('is true only when season=3 (Winter)', () => {
    for (const season of [0, 1, 2, 3] as const) {
      const t = new TimeOfDay(6);
      t.season = season;
      expect(isFrozenSeason(t)).toBe(season === WINTER_SEASON_INDEX);
    }
  });
});

describe('freezeOutdoorCrops', () => {
  it('un-waters every outdoor crop and zeros their streak', () => {
    const w = new World();
    // Till and plant two crops outdoors.
    till(w, 19, 22);
    till(w, 20, 22);
    w.player.inventory.wheat = 5;
    plant(w, 19, 22, 'wheat', w.player);
    plant(w, 20, 22, 'wheat', w.player);
    water(w, 19, 22);
    water(w, 20, 22);
    // Build up a streak first.
    advanceDay(w);
    water(w, 19, 22);
    water(w, 20, 22);
    advanceDay(w);
    const frozen = freezeOutdoorCrops(w);
    expect(frozen).toBe(0); // already un-watered by advanceDay
    // Re-water and check the freeze does its job.
    water(w, 19, 22);
    water(w, 20, 22);
    const frozen2 = freezeOutdoorCrops(w);
    expect(frozen2).toBe(2);
    const crops = w.crops as unknown as Array<{ watered: boolean; waterStreak?: number }>;
    expect(crops[0].watered).toBe(false);
    expect(crops[1].watered).toBe(false);
    expect(crops[0].waterStreak).toBe(0);
    expect(crops[1].waterStreak).toBe(0);
  });

  it('leaves greenhouse crops untouched', () => {
    const w = new World();
    // Place a greenhouse on a clear grass patch (matches greenhouse.test.ts).
    const g = placeGreenhouse(w, 10, 14);
    expect(g).not.toBeNull();
    // Plant inside the greenhouse footprint.
    w.player.inventory.wheat = 2;
    plant(w, 10, 14, 'wheat', w.player);
    plant(w, 11, 14, 'wheat', w.player);
    water(w, 10, 14);
    water(w, 11, 14);
    // Greenhouse re-asserts water, then freeze is a no-op for inside crops.
    greenhouseTick(w);
    const frozen = freezeOutdoorCrops(w);
    expect(frozen).toBe(0);
    const crops = w.crops as unknown as Array<{ watered: boolean }>;
    expect(crops.every((c) => c.watered)).toBe(true);
  });
});

describe('winter day rollover — growth halts outside, continues inside', () => {
  it('outdoor wheat does not grow during winter', () => {
    const w = new World();
    till(w, 19, 22);
    w.player.inventory.wheat = 1;
    plant(w, 19, 22, 'wheat', w.player);
    const crop = w.crops[0] as unknown as { stage: number; watered: boolean };
    expect(crop.stage).toBe(0);
    water(w, 19, 22);
    // Simulate the engine: it's winter, freeze before advanceDay.
    freezeOutdoorCrops(w);
    advanceDay(w);
    expect(crop.stage).toBe(0); // didn't grow
  });

  it('greenhouse wheat keeps growing during winter', () => {
    const w = new World();
    placeGreenhouse(w, 10, 14);
    w.player.inventory.wheat = 1;
    plant(w, 10, 14, 'wheat', w.player);
    const crop = w.crops[0] as unknown as { stage: number };
    expect(crop.stage).toBe(0);
    water(w, 10, 14);
    // Engine order: rain/sprinkler -> freeze (no-op inside) -> advanceDay
    // -> greenhouseTick.
    freezeOutdoorCrops(w);
    advanceDay(w);
    greenhouseTick(w);
    expect(crop.stage).toBe(2); // +1 from advanceDay (watered) +1 bonus
  });
});

describe('hot cocoa recipe', () => {
  it('appears in the catalog and is cookable with eggs + wheat', () => {
    expect(RECIPES['hot-cocoa']).toBeDefined();
    expect(RECIPE_KEYS).toContain('hot-cocoa');
    const w = new World();
    addItem(w.player, 'egg', 2);
    addItem(w.player, 'wheat_harvest', 1);
    expect(canCook(w.player, 'hot-cocoa')).toBe(true);
  });

  it('hot cocoa sells for more than its raw ingredients', () => {
    const r = RECIPES['hot-cocoa'];
    // 2 eggs * 12 + 1 wheat * 8 = 32 raw, dish must beat that.
    expect(r.sellPrice).toBeGreaterThan(32);
  });
});

describe('winterFlavorLine', () => {
  it('reports the count when crops actually froze', () => {
    expect(winterFlavorLine(3)).toContain('3 crops');
    expect(winterFlavorLine(1)).toContain('1 crop');
    expect(winterFlavorLine(1)).not.toContain('1 crops');
  });
  it('falls back to a quiet line when nothing froze', () => {
    expect(winterFlavorLine(0)).toContain('quiet');
  });
});
