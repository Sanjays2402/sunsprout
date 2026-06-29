// Almanac TODAY count chip — almanacTodayCount() tallies same-day events and
// almanacTodayChip() surfaces "N today" only once 2+ stack, so a busy day
// reads its weight without counting rows.

import { describe, it, expect } from 'vitest';
import { almanacTodayCount, almanacTodayChip, type AlmanacEntry } from '../src/game/almanac';

const e = (daysUntil: number): AlmanacEntry => ({
  daysUntil,
  kind: 'birthday',
  title: 'X',
  detail: '',
  season: 0,
  day: 1,
});

describe('almanacTodayCount', () => {
  it('counts only events landing today (daysUntil <= 0)', () => {
    expect(almanacTodayCount([e(0), e(0), e(1), e(5)])).toBe(2);
    expect(almanacTodayCount([e(1), e(2)])).toBe(0);
    expect(almanacTodayCount([])).toBe(0);
  });
});

describe('almanacTodayChip', () => {
  it('shows N today only when 2+ events stack', () => {
    expect(almanacTodayChip(0)).toBe('');
    expect(almanacTodayChip(1)).toBe('');
    expect(almanacTodayChip(2)).toBe('2 today');
    expect(almanacTodayChip(3)).toBe('3 today');
  });

  it('agrees with the count over an entry list', () => {
    const list = [e(0), e(0), e(0), e(4)];
    expect(almanacTodayChip(almanacTodayCount(list))).toBe('3 today');
  });
});
