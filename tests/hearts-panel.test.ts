// Slice 4 of v0.5.0 — hearts panel summary helper.
import { describe, it, expect } from 'vitest';
import { heartsSummary } from '../src/ui/hearts-panel';
import { CANDIDATES, MAX_HEARTS, startingHearts, giveGift } from '../src/game/hearts';

describe('heartsSummary', () => {
  it('returns one row per candidate, all at 0 hearts by default', () => {
    const rows = heartsSummary(startingHearts());
    expect(rows.length).toBe(Object.keys(CANDIDATES).length);
    for (const r of rows) {
      expect(r.hearts).toBe(0);
      expect(r.max).toBe(MAX_HEARTS);
      expect(r.name).toBeTruthy();
    }
  });

  it('reflects accumulated gift points as whole hearts', () => {
    const s = startingHearts();
    // Push maple over 1 whole heart: HEART_POINTS=250; loved=80, so 4 gifts on
    // different days = 320 pts → 1 heart.
    giveGift(s, 'maple', 'ruby', 1);
    giveGift(s, 'maple', 'ruby', 2);
    giveGift(s, 'maple', 'ruby', 3);
    giveGift(s, 'maple', 'ruby', 4);
    const rows = heartsSummary(s);
    const maple = rows.find((r) => r.id === 'maple')!;
    expect(maple.hearts).toBe(1);
  });

  it('treats missing state as all-zero rows', () => {
    const rows = heartsSummary(undefined);
    for (const r of rows) expect(r.hearts).toBe(0);
  });
});
