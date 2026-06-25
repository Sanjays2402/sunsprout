// Crop-quality heatmap bands — qualityHeat() maps a water-streak onto a
// readable tint band for the field overlay.

import { describe, it, expect } from 'vitest';
import {
  qualityHeat,
  HEAT_COLORS,
  qualityFromStreak,
  type QualityHeatTier,
} from '../src/game/crop-quality';

describe('qualityHeat — band selection', () => {
  // Use wheat-like growthStages = 3 for the worked examples.
  const G = 3;

  it('streak 0 reads as dry (no streak, will not star)', () => {
    const h = qualityHeat(0, G);
    expect(h.tier).toBe('dry');
    expect(h.quality).toBe('normal');
    expect(h.color).toBe(HEAT_COLORS.dry);
  });

  it('a mid streak below the silver threshold reads as building', () => {
    // streak 1 with G=3: below growthStages-1 (==2) -> building.
    const h = qualityHeat(1, G);
    expect(h.tier).toBe('building');
    expect(h.quality).toBe('normal');
  });

  it('one watered day from silver reads as almost', () => {
    // streak == growthStages - 1 == 2 -> almost.
    const h = qualityHeat(G - 1, G);
    expect(h.tier).toBe('almost');
    expect(h.quality).toBe('normal');
  });

  it('hitting the silver threshold reads as silver', () => {
    const h = qualityHeat(G, G);
    expect(h.tier).toBe('silver');
    expect(h.quality).toBe('silver');
    expect(h.color).toBe(HEAT_COLORS.silver);
  });

  it('past the gold threshold reads as gold', () => {
    const h = qualityHeat(G + 1, G);
    expect(h.tier).toBe('gold');
    expect(h.quality).toBe('gold');
    expect(h.color).toBe(HEAT_COLORS.gold);
  });
});

describe('qualityHeat — invariants', () => {
  it('tier always agrees with qualityFromStreak', () => {
    for (let g = 2; g <= 5; g++) {
      for (let s = 0; s <= g + 2; s++) {
        const h = qualityHeat(s, g);
        expect(h.quality).toBe(qualityFromStreak(s, g));
        // A starred quality must map to a starred band and vice-versa.
        if (h.quality === 'gold') expect(h.tier).toBe('gold');
        if (h.quality === 'silver') expect(h.tier).toBe('silver');
        if (h.quality === 'normal') {
          expect(['dry', 'building', 'almost']).toContain(h.tier);
        }
      }
    }
  });

  it('alpha is a sane 0..1 value for every streak', () => {
    for (let g = 2; g <= 5; g++) {
      for (let s = 0; s <= g + 3; s++) {
        const a = qualityHeat(s, g).alpha;
        expect(a).toBeGreaterThan(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it('building alpha climbs as the streak approaches silver', () => {
    // For a longer crop, a deeper building streak should tint warmer.
    const g = 5;
    const low = qualityHeat(1, g);
    const high = qualityHeat(3, g);
    expect(low.tier).toBe('building');
    expect(high.tier).toBe('building');
    expect(high.alpha).toBeGreaterThan(low.alpha);
  });

  it('clamps a negative streak to the dry band', () => {
    const h = qualityHeat(-2, 3);
    expect(h.tier).toBe('dry');
  });

  it('every HEAT_COLORS entry is a hex colour', () => {
    const tiers: QualityHeatTier[] = ['dry', 'building', 'almost', 'silver', 'gold'];
    for (const tier of tiers) {
      expect(HEAT_COLORS[tier]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
