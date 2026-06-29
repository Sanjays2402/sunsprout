// Money-log savings split — purseSavingsSplit() turns the kept/spent totals
// into kept-vs-spent fractions so the panel can draw the thrift caption as a
// mini-gauge. Floors kept at 0 and caps spent at 1 on an over-budget window.

import { describe, it, expect } from 'vitest';
import { purseSavingsSplit, type MoneyCategoryTotals } from '../src/game/money-log';

const totals = (sales: number, rewards: number, spent: number): MoneyCategoryTotals => ({
  sales,
  rewards,
  spent,
});

describe('purseSavingsSplit', () => {
  it('splits income into kept vs spent', () => {
    const s = purseSavingsSplit(totals(80, 20, 40));
    expect(s).not.toBeNull();
    expect(s!.spent).toBeCloseTo(0.4, 5);
    expect(s!.kept).toBeCloseTo(0.6, 5);
  });

  it('caps spent at 1 / floors kept at 0 when overspent', () => {
    const s = purseSavingsSplit(totals(100, 0, 250));
    expect(s!.spent).toBe(1);
    expect(s!.kept).toBe(0);
  });

  it('is all-kept when nothing was spent', () => {
    const s = purseSavingsSplit(totals(60, 40, 0));
    expect(s!.kept).toBe(1);
    expect(s!.spent).toBe(0);
  });

  it('is null when there is no income to split', () => {
    expect(purseSavingsSplit(totals(0, 0, 50))).toBeNull();
  });
});
