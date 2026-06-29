// Almanac section-chip glyph — almanacSectionBusiestKind() finds the
// dominant kind in a THIS WEEK / LATER bucket so the weight chip can lead
// with that kind's glyph, saying WHAT the bucket is mostly made of. Ties
// break by the stable summary order (personal first).

import { describe, it, expect } from 'vitest';
import { almanacSectionBusiestKind, type AlmanacEntry } from '../src/game/almanac';

const entry = (kind: AlmanacEntry['kind']): AlmanacEntry => ({
  daysUntil: 3,
  kind,
  title: kind,
  detail: '',
  season: 0,
  day: 3,
});

describe('almanacSectionBusiestKind', () => {
  it('returns null on an empty section', () => {
    expect(almanacSectionBusiestKind([])).toBeNull();
  });

  it('picks the kind with the most entries', () => {
    const busiest = almanacSectionBusiestKind([
      entry('birthday'),
      entry('birthday'),
      entry('festival'),
    ]);
    expect(busiest).toBe('birthday');
  });

  it('breaks ties by the stable summary order (personal before festival)', () => {
    // One each — the earliest in SUMMARY_KIND_ORDER (personal) wins.
    const busiest = almanacSectionBusiestKind([
      entry('festival'),
      entry('personal'),
    ]);
    expect(busiest).toBe('personal');
  });

  it('breaks a higher-count tie by order too (festival before cart)', () => {
    const busiest = almanacSectionBusiestKind([
      entry('cart'),
      entry('cart'),
      entry('festival'),
      entry('festival'),
    ]);
    expect(busiest).toBe('festival');
  });

  it('returns the sole kind when the section is uniform', () => {
    expect(almanacSectionBusiestKind([entry('tournament')])).toBe('tournament');
  });
});
