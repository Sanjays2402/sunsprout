// Money-log savings-rate caption — purseSavingsCaption() distils the totals
// footer's gross figures (sales + rewards income vs spent) into one read:
// "kept N% of income" / "spent N% of income" / "spent it all" / "kept all
// income", so the player sees if the window was thrifty without dividing.

import { describe, it, expect } from 'vitest';
import { purseSavingsCaption, type MoneyCategoryTotals } from '../src/game/money-log';

const t = (sales: number, rewards: number, spent: number): MoneyCategoryTotals => ({ sales, rewards, spent });

describe('purseSavingsCaption', () => {
  it('returns "" when no income came in', () => {
    expect(purseSavingsCaption(t(0, 0, 0))).toBe('');
    expect(purseSavingsCaption(t(0, 0, 50))).toBe('');
  });

  it('reads "kept all income" when nothing was spent', () => {
    expect(purseSavingsCaption(t(100, 0, 0))).toBe('kept all income');
  });

  it('reads the kept fraction of income', () => {
    // income 200, spent 130 -> kept 35%.
    expect(purseSavingsCaption(t(150, 50, 130))).toBe('kept 35% of income');
  });

  it('reads "spent it all" when spend exactly equals income', () => {
    expect(purseSavingsCaption(t(80, 20, 100))).toBe('spent it all');
  });

  it('reads the overspend fraction past 100%', () => {
    // income 100, spent 150 -> spent 150% of income.
    expect(purseSavingsCaption(t(100, 0, 150))).toBe('spent 150% of income');
  });

  it('counts rewards toward income too', () => {
    // income 200 (all rewards), spent 100 -> kept 50%.
    expect(purseSavingsCaption(t(0, 200, 100))).toBe('kept 50% of income');
  });
});
