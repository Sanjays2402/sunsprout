// Crop-quality heatmap bands — qualityHeat() maps a water-streak onto a
// readable tint band for the field overlay.

import { describe, it, expect } from 'vitest';
import {
  qualityHeat,
  qualityHeatCounts,
  qualityHeatSummary,
  HEAT_COLORS,
  qualityFromStreak,
  type QualityHeatTier,
  type CropStreakSample,
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

describe('qualityHeatCounts — field tally', () => {
  // Wheat-like growthStages = 3: streak 0 dry, 1 building, 2 almost,
  // 3 silver, 4+ gold.
  const G = 3;
  const s = (waterStreak: number): CropStreakSample => ({ waterStreak, growthStages: G });

  it('returns all-zero for an empty field', () => {
    expect(qualityHeatCounts([])).toEqual({
      dry: 0,
      building: 0,
      almost: 0,
      silver: 0,
      gold: 0,
    });
  });

  it('buckets each crop into its band', () => {
    const counts = qualityHeatCounts([s(0), s(0), s(2), s(3), s(5)]);
    expect(counts.dry).toBe(2);
    expect(counts.almost).toBe(1);
    expect(counts.silver).toBe(1);
    expect(counts.gold).toBe(1);
    expect(counts.building).toBe(0);
  });

  it('sums to the crop count', () => {
    const samples = [s(0), s(1), s(2), s(3), s(4), s(5)];
    const counts = qualityHeatCounts(samples);
    const total = counts.dry + counts.building + counts.almost + counts.silver + counts.gold;
    expect(total).toBe(samples.length);
  });
});

describe('qualityHeatSummary — one-line glance', () => {
  const G = 3;
  const s = (waterStreak: number): CropStreakSample => ({ waterStreak, growthStages: G });

  it('returns empty string for no crops (chip hides itself)', () => {
    expect(qualityHeatSummary([])).toBe('');
  });

  it('leads with what needs the player (dry first, then almost)', () => {
    const line = qualityHeatSummary([s(0), s(0), s(0), s(2)]);
    expect(line).toBe('3 dry, 1 about to silver-star');
  });

  it('omits zero bands entirely', () => {
    const line = qualityHeatSummary([s(5), s(5), s(3)]);
    // Only gold + silver present; silver before gold per urgency order;
    // no "dry"/"building"/"almost" noise.
    expect(line).toBe('1 silver-star, 2 gold-star');
    expect(line).not.toContain('dry');
    expect(line).not.toContain('growing');
  });

  it('orders bands by urgency: dry, almost, building, silver, gold', () => {
    // One crop in every band -> all five phrases present, in urgency order.
    const parts = qualityHeatSummary([s(5), s(3), s(1), s(2), s(0)]).split(', ');
    expect(parts.length).toBe(5);
    // Classify each comma-part by the band it describes and assert the
    // sequence. (Split avoids the "about to silver-star" substring trap.)
    const band = (p: string): string => {
      if (p.includes('dry')) return 'dry';
      if (p.includes('about to')) return 'almost';
      if (p.includes('growing')) return 'building';
      if (p.includes('gold-star')) return 'gold';
      if (p.includes('silver-star')) return 'silver';
      return '?';
    };
    expect(parts.map(band)).toEqual(['dry', 'almost', 'building', 'silver', 'gold']);
  });

  it('uses singular phrasing for a count of one', () => {
    expect(qualityHeatSummary([s(2)])).toBe('1 about to silver-star');
    expect(qualityHeatSummary([s(1)])).toBe('1 growing a streak');
  });

  it('carries no emoji (git-safe app chrome)', () => {
    const line = qualityHeatSummary([s(0), s(3), s(5)]);
    // eslint-disable-next-line no-control-regex
    expect(line).toMatch(/^[\x00-\x7F]*$/);
  });
});
