// Crop-journal sown pip — sownPipState() classifies a crop's lifetime
// progress (never sown / sown-but-unreaped / has-harvested) so the panel
// can lead the "sown N" tally with a tinted pip, matching the field-status
// + streak pip language.

import { describe, it, expect } from 'vitest';
import { sownPipState, type CropJournalEntry } from '../src/game/crop-journal';

const entry = (
  sown: number,
  normal: number,
  silver: number,
  gold: number,
): CropJournalEntry => ({
  key: 'wheat',
  name: 'Wheat',
  seedPrice: 5,
  sellPrice: 12,
  growthDays: 4,
  bestSeason: 'Spring',
  sown,
  normal,
  silver,
  gold,
  bestStreak: 0,
  ribbonCount: 0,
});

describe('sownPipState', () => {
  it('is "none" on a never-touched crop', () => {
    expect(sownPipState(entry(0, 0, 0, 0))).toBe('none');
  });

  it('is "sown" once planted but nothing reaped', () => {
    expect(sownPipState(entry(3, 0, 0, 0))).toBe('sown');
  });

  it('is "harvested" as soon as any tier has produced', () => {
    expect(sownPipState(entry(3, 1, 0, 0))).toBe('harvested');
    expect(sownPipState(entry(3, 0, 1, 0))).toBe('harvested');
    expect(sownPipState(entry(3, 0, 0, 1))).toBe('harvested');
  });

  it('prefers harvested even if the sown count is somehow zero', () => {
    // Defensive: a harvest implies progress regardless of the sown figure.
    expect(sownPipState(entry(0, 2, 0, 0))).toBe('harvested');
  });
});
