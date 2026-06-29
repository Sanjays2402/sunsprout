// Money-log savings-low threshold — purseSavingsLow() flags an overspend
// window (kept <= 20% of income) so the thrift gauge's kept-half flips from
// green to loss-red. Mirrors the same split the gauge draws.

import { describe, it, expect } from 'vitest';
import {
  purseSavingsSplit,
  purseSavingsLow,
  SAVINGS_LOW_KEPT,
  type MoneyCategoryTotals,
} from '../src/game/money-log';

const totals = (sales: number, rewards: number, spent: number): MoneyCategoryTotals => ({
  sales,
  rewards,
  spent,
});

describe('purseSavingsLow', () => {
  it('is true when the kept share is at or under the threshold', () => {
    // income 100, spent 90 -> kept 0.1 (<= 0.2).
    const s = purseSavingsSplit(totals(100, 0, 90));
    expect(purseSavingsLow(s)).toBe(true);
  });

  it('is true exactly at the threshold (kept == 20%)', () => {
    // income 100, spent 80 -> kept 0.2 == SAVINGS_LOW_KEPT.
    const s = purseSavingsSplit(totals(80, 20, 80));
    expect(s!.kept).toBeCloseTo(SAVINGS_LOW_KEPT, 5);
    expect(purseSavingsLow(s)).toBe(true);
  });

  it('is false on a thrifty window (kept above the threshold)', () => {
    // income 100, spent 40 -> kept 0.6.
    const s = purseSavingsSplit(totals(80, 20, 40));
    expect(purseSavingsLow(s)).toBe(false);
  });

  it('is true on a total overspend (kept floored at 0)', () => {
    const s = purseSavingsSplit(totals(100, 0, 250));
    expect(s!.kept).toBe(0);
    expect(purseSavingsLow(s)).toBe(true);
  });

  it('is false on a null split (no income to have kept)', () => {
    expect(purseSavingsLow(purseSavingsSplit(totals(0, 0, 50)))).toBe(false);
    expect(purseSavingsLow(null)).toBe(false);
  });
});
