// Almanac per-kind count summary — the "2 birthdays, 1 festival ... in view"
// header that surfaces the shape of the fortnight at a glance.

import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  buildAlmanac,
  almanacCountParts,
  almanacCountSummary,
  type AlmanacEntry,
  type AlmanacKind,
} from '../src/game/almanac';

/** A minimal synthetic entry of a given kind. */
function entryOf(kind: AlmanacKind, daysUntil = 1): AlmanacEntry {
  return { daysUntil, kind, title: kind, detail: '', season: 0, day: 1 };
}

/** A clock parked at a given season/day. */
function clockAt(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = day;
  return t;
}

describe('almanacCountParts', () => {
  it('returns nothing for an empty list', () => {
    expect(almanacCountParts([])).toEqual([]);
  });

  it('tallies one part per kind that appears, omitting zero kinds', () => {
    const parts = almanacCountParts([
      entryOf('birthday'),
      entryOf('birthday'),
      entryOf('festival'),
    ]);
    expect(parts.map((p) => p.kind)).toEqual(['festival', 'birthday']);
    expect(parts.map((p) => p.count)).toEqual([1, 2]);
  });

  it('pluralises the noun on counts other than one', () => {
    const parts = almanacCountParts([
      entryOf('birthday'),
      entryOf('birthday'),
      entryOf('cart'),
    ]);
    const byKind = Object.fromEntries(parts.map((p) => [p.kind, p.text]));
    expect(byKind.birthday).toBe('2 birthdays');
    expect(byKind.cart).toBe('1 cart visit');
  });

  it('orders parts by the stable summary order, not input order', () => {
    // Feed them out of order — output must follow personal/festival/
    // tournament/cart/birthday regardless.
    const parts = almanacCountParts([
      entryOf('birthday'),
      entryOf('personal'),
      entryOf('cart'),
      entryOf('festival'),
      entryOf('tournament'),
    ]);
    expect(parts.map((p) => p.kind)).toEqual([
      'personal',
      'festival',
      'tournament',
      'cart',
      'birthday',
    ]);
  });
});

describe('almanacCountSummary', () => {
  it('is empty for an empty list', () => {
    expect(almanacCountSummary([])).toBe('');
  });

  it('joins the parts with commas and a trailing "in view"', () => {
    const summary = almanacCountSummary([
      entryOf('birthday'),
      entryOf('birthday'),
      entryOf('festival'),
    ]);
    expect(summary).toBe('1 festival, 2 birthdays in view');
  });

  it('carries no emoji (game chrome stays monochrome)', () => {
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const summary = almanacCountSummary([entryOf('cart'), entryOf('personal')]);
    expect(emoji.test(summary)).toBe(false);
  });

  it('part counts sum to the number of entries from a real almanac', () => {
    const entries = buildAlmanac(clockAt(0, 1));
    const parts = almanacCountParts(entries);
    const summed = parts.reduce((n, p) => n + p.count, 0);
    expect(summed).toBe(entries.length);
  });
});
