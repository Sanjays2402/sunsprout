// Crop quality tiers — pure helpers + harvest integration.
import { describe, it, expect } from 'vitest';
import {
  QUALITY_MULTIPLIER,
  QUALITY_SUFFIX,
  harvestKey,
  parseHarvestKey,
  qualityFromStreak,
  qualityGlyph,
} from '../src/game/crop-quality';
import { World } from '../src/world/world';
import { advanceDay, plant, water, harvest } from '../src/game/farming';
import { CROPS } from '../src/game/crops';
import { sellAllHarvest } from '../src/game/economy';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 6, tomato: 4 };
  w.player.gold = 0;
  return w;
}

describe('crop-quality helpers', () => {
  it('multiplier table is the canonical 1 / 1.5 / 2', () => {
    expect(QUALITY_MULTIPLIER.normal).toBe(1);
    expect(QUALITY_MULTIPLIER.silver).toBe(1.5);
    expect(QUALITY_MULTIPLIER.gold).toBe(2);
  });

  it('streak < growthStages → normal', () => {
    expect(qualityFromStreak(0, 3)).toBe('normal');
    expect(qualityFromStreak(2, 3)).toBe('normal');
  });

  it('streak == growthStages → silver', () => {
    expect(qualityFromStreak(3, 3)).toBe('silver');
    expect(qualityFromStreak(4, 4)).toBe('silver');
  });

  it('streak >= growthStages + 1 → gold', () => {
    expect(qualityFromStreak(4, 3)).toBe('gold');
    expect(qualityFromStreak(99, 3)).toBe('gold');
  });

  it('harvestKey + parseHarvestKey round-trip every tier', () => {
    for (const q of ['normal', 'silver', 'gold'] as const) {
      const key = harvestKey('wheat', q);
      const parsed = parseHarvestKey(key);
      expect(parsed).not.toBeNull();
      expect(parsed!.cropKey).toBe('wheat');
      expect(parsed!.quality).toBe(q);
      expect(key.endsWith(QUALITY_SUFFIX[q])).toBe(true);
    }
  });

  it('parseHarvestKey returns null for non-harvest keys', () => {
    expect(parseHarvestKey('wheat')).toBeNull();
    expect(parseHarvestKey('chicken')).toBeNull();
    expect(parseHarvestKey('dish-omelet')).toBeNull();
  });

  it('qualityGlyph is monochrome (no emoji)', () => {
    // Spec: \"no emoji in app chrome (monochrome glyphs).\"
    expect(qualityGlyph('gold')).toBe('**');
    expect(qualityGlyph('silver')).toBe('*');
    expect(qualityGlyph('normal')).toBe('');
  });
});

describe('crop-quality + farming integration', () => {
  it('harvest() of an un-watered ripening returns normal tier', () => {
    const w = freshWorld();
    // Tilled patch starts at (19,22).
    plant(w, 19, 22, 'wheat', w.player);
    // Force-ripe by setting stage to max without ever watering.
    const c = w.crops[0] as unknown as { stage: number; watered: boolean; waterStreak: number };
    c.stage = CROPS.wheat.growthStages - 1;
    const q = harvest(w, 19, 22, w.player);
    expect(q).toBe('normal');
    expect(w.player.inventory.wheat_harvest ?? 0).toBe(1);
  });

  it('a fully-watered wheat ripens to a silver star (streak == growthStages)', () => {
    const w = freshWorld();
    plant(w, 19, 22, 'wheat', w.player);
    // Wheat = 3 stages. Three waters → stage 2 (ripe), streak 3 == growthStages → silver.
    for (let i = 0; i < CROPS.wheat.growthStages; i++) {
      water(w, 19, 22);
      advanceDay(w);
    }
    const q = harvest(w, 19, 22, w.player);
    expect(q).toBe('silver');
    expect(w.player.inventory.wheat_harvest_silver ?? 0).toBe(1);
  });

  it('an extra-watered day past ripening lifts the crop to gold', () => {
    const w = freshWorld();
    plant(w, 19, 22, 'wheat', w.player);
    // Water and advance ONE extra day after ripening to hit growthStages + 1 streak.
    for (let i = 0; i < CROPS.wheat.growthStages + 1; i++) {
      water(w, 19, 22);
      advanceDay(w);
    }
    const q = harvest(w, 19, 22, w.player);
    expect(q).toBe('gold');
    expect(w.player.inventory.wheat_harvest_gold ?? 0).toBe(1);
  });

  it('skipping a single water day breaks the streak — drops back to normal', () => {
    const w = freshWorld();
    plant(w, 19, 22, 'wheat', w.player);
    // Water, water, SKIP, water — streak ends at 1 (< 3 growth stages).
    water(w, 19, 22);
    advanceDay(w);
    water(w, 19, 22);
    advanceDay(w);
    advanceDay(w); // skip water — streak resets
    water(w, 19, 22);
    advanceDay(w);
    // Stage may be max by now from the 3 watered ticks; force-ripen if not yet.
    const c = w.crops[0] as unknown as { stage: number };
    if (c.stage < CROPS.wheat.growthStages - 1) c.stage = CROPS.wheat.growthStages - 1;
    const q = harvest(w, 19, 22, w.player);
    expect(q).toBe('normal');
  });

  it('sellAllHarvest pays the tier multiplier for each bucket', () => {
    const w = freshWorld();
    const p = w.player;
    p.inventory.wheat_harvest = 1;        // 8g
    p.inventory.wheat_harvest_silver = 1; // 12g (floor 8 * 1.5)
    p.inventory.wheat_harvest_gold = 1;   // 16g (8 * 2)
    p.gold = 0;
    const earned = sellAllHarvest(p);
    expect(earned).toBe(8 + 12 + 16);
    expect(p.gold).toBe(8 + 12 + 16);
    expect(p.inventory.wheat_harvest).toBe(0);
    expect(p.inventory.wheat_harvest_silver).toBe(0);
    expect(p.inventory.wheat_harvest_gold).toBe(0);
  });
});
