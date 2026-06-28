// Crop-journal harvest-bar legend — the n/s/g key the journal header shows
// so the per-row stacked harvest mini-bar reads as tiers, not three
// unlabelled hues. hasHarvestBars() gates the legend on at least one bar
// being on screen; harvestBarLegend() orders the swatches like the bar.

import { describe, it, expect } from 'vitest';
import {
  hasHarvestBars,
  harvestBarLegend,
  harvestBarSegments,
  type CropJournalEntry,
} from '../src/game/crop-journal';

/** Minimal entry factory — only the harvest tiers matter for these tests. */
const mkEntry = (normal: number, silver: number, gold: number): CropJournalEntry => ({
  key: 'wheat',
  name: 'Wheat',
  seedPrice: 2,
  sellPrice: 8,
  growthDays: 4,
  bestSeason: 'Spring',
  sown: 0,
  normal,
  silver,
  gold,
  bestStreak: 0,
  ribbonCount: 0,
});

describe('hasHarvestBars', () => {
  it('is false on a fresh save (nothing harvested anywhere)', () => {
    expect(hasHarvestBars([])).toBe(false);
    expect(hasHarvestBars([mkEntry(0, 0, 0), mkEntry(0, 0, 0)])).toBe(false);
  });

  it('is true once any crop has a single harvest of any tier', () => {
    expect(hasHarvestBars([mkEntry(1, 0, 0)])).toBe(true);
    expect(hasHarvestBars([mkEntry(0, 0, 0), mkEntry(0, 2, 0)])).toBe(true);
    expect(hasHarvestBars([mkEntry(0, 0, 3)])).toBe(true);
  });

  it('agrees with whether a mini-bar would actually draw (total > 0)', () => {
    // The legend exists to key a drawn bar, so hasHarvestBars must be true
    // exactly when harvestBarSegments would return a non-zero total for the
    // busiest crop.
    const entries = [mkEntry(0, 0, 0), mkEntry(5, 1, 0)];
    const max = 6;
    const drewABar = entries.some((e) => harvestBarSegments(e, max, 84).total > 0);
    expect(hasHarvestBars(entries)).toBe(drewABar);

    const empty = [mkEntry(0, 0, 0)];
    const drewNone = empty.some((e) => harvestBarSegments(e, 0, 84).total > 0);
    expect(hasHarvestBars(empty)).toBe(drewNone);
  });
});

describe('harvestBarLegend', () => {
  it('lists the three tiers in the bar stacking order (normal, silver, gold)', () => {
    const legend = harvestBarLegend();
    expect(legend.map((i) => i.tier)).toEqual(['normal', 'silver', 'gold']);
  });

  it('labels each tier with a short non-empty ASCII word', () => {
    for (const item of harvestBarLegend()) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(/^[\x20-\x7E]+$/.test(item.label)).toBe(true);
    }
  });

  it('covers exactly the tiers a stacked bar segments into', () => {
    // The legend keys the normal/silver/gold split harvestBarSegments emits,
    // so its tier set must match the segment fields exactly.
    const segs = harvestBarSegments(mkEntry(4, 2, 1), 7, 80);
    const segmentTiers = (['normal', 'silver', 'gold'] as const).filter(
      (t) => segs[t] >= 0,
    );
    expect(harvestBarLegend().map((i) => i.tier)).toEqual(segmentTiers);
  });
});
