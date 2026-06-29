// Almanac per-section chips — almanacSectionChip() labels the THIS WEEK /
// LATER dividers ("3 this week", "4 later") once 2+ events stack, mirroring
// the TODAY chip so every divider reads its weight without counting rows.

import { describe, it, expect } from 'vitest';
import { almanacSectionChip } from '../src/game/almanac';

describe('almanacSectionChip', () => {
  it('labels THIS WEEK with "N this week" at 2+', () => {
    expect(almanacSectionChip('week', 3)).toBe('3 this week');
    expect(almanacSectionChip('week', 2)).toBe('2 this week');
  });

  it('labels LATER with "N later" at 2+', () => {
    expect(almanacSectionChip('later', 4)).toBe('4 later');
  });

  it('stays quiet below 2 rows', () => {
    expect(almanacSectionChip('week', 1)).toBe('');
    expect(almanacSectionChip('later', 0)).toBe('');
  });

  it('does not label TODAY (it keeps its own chip wording)', () => {
    expect(almanacSectionChip('today', 5)).toBe('');
  });
});
