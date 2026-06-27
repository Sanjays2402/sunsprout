// Almanac kind-filter — all / village / birthdays / personal cycle.

import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  buildAlmanac,
  applyAlmanacFilter,
  nextAlmanacFilter,
  almanacFilterLabel,
  ALMANAC_FILTERS,
  type AlmanacEntry,
  type AlmanacFilter,
  type AlmanacKind,
} from '../src/game/almanac';
import { AlmanacPanel } from '../src/ui/almanac-panel';

/** A minimal synthetic entry of a given kind. */
function entryOf(kind: AlmanacKind, daysUntil = 1): AlmanacEntry {
  return { daysUntil, kind, title: kind, detail: '', season: 0, day: 1 };
}

describe('nextAlmanacFilter', () => {
  it('cycles all -> village -> birthdays -> personal -> all', () => {
    expect(nextAlmanacFilter('all')).toBe('village');
    expect(nextAlmanacFilter('village')).toBe('birthdays');
    expect(nextAlmanacFilter('birthdays')).toBe('personal');
    expect(nextAlmanacFilter('personal')).toBe('all');
  });

  it('walks the whole cycle and returns to the start', () => {
    let f: AlmanacFilter = 'all';
    const seen: AlmanacFilter[] = [f];
    for (let i = 0; i < ALMANAC_FILTERS.length - 1; i++) {
      f = nextAlmanacFilter(f);
      seen.push(f);
    }
    expect(seen).toEqual([...ALMANAC_FILTERS]);
    // One more wraps home.
    expect(nextAlmanacFilter(f)).toBe('all');
  });
});

describe('almanacFilterLabel', () => {
  it('labels every filter with a non-empty ASCII word', () => {
    for (const f of ALMANAC_FILTERS) {
      const label = almanacFilterLabel(f);
      expect(label.length).toBeGreaterThan(0);
      expect(/^[\x20-\x7E]+$/.test(label)).toBe(true);
    }
  });
});

describe('applyAlmanacFilter', () => {
  const mixed: AlmanacEntry[] = [
    entryOf('festival'),
    entryOf('birthday'),
    entryOf('cart'),
    entryOf('tournament'),
    entryOf('personal'),
  ];

  it("'all' returns every entry untouched (as a copy)", () => {
    const out = applyAlmanacFilter(mixed, 'all');
    expect(out).toEqual(mixed);
    expect(out).not.toBe(mixed); // copy, not the same array ref
  });

  it("'village' admits festivals, cart, and tournament only", () => {
    const kinds = applyAlmanacFilter(mixed, 'village').map((e) => e.kind).sort();
    expect(kinds).toEqual(['cart', 'festival', 'tournament']);
  });

  it("'birthdays' admits only birthdays", () => {
    const kinds = applyAlmanacFilter(mixed, 'birthdays').map((e) => e.kind);
    expect(kinds).toEqual(['birthday']);
  });

  it("'personal' admits only personal commitments", () => {
    const kinds = applyAlmanacFilter(mixed, 'personal').map((e) => e.kind);
    expect(kinds).toEqual(['personal']);
  });

  it('every kind is covered by exactly one non-all filter', () => {
    // The three non-all filters partition the kind space — no kind is
    // dropped, none is double-counted.
    const allKinds: AlmanacKind[] = ['festival', 'birthday', 'cart', 'tournament', 'personal'];
    for (const k of allKinds) {
      const hits = (['village', 'birthdays', 'personal'] as const).filter((f) =>
        applyAlmanacFilter([entryOf(k)], f).length === 1,
      );
      expect(hits.length).toBe(1);
    }
  });

  it('preserves the soonest-first input order within a filter', () => {
    const ordered = [entryOf('festival', 1), entryOf('cart', 3), entryOf('tournament', 5)];
    const out = applyAlmanacFilter(ordered, 'village');
    expect(out.map((e) => e.daysUntil)).toEqual([1, 3, 5]);
  });

  it('a real almanac filtered by village never contains a birthday or personal row', () => {
    const t = new TimeOfDay(8);
    const village = applyAlmanacFilter(buildAlmanac(t), 'village');
    expect(village.every((e) => e.kind !== 'birthday' && e.kind !== 'personal')).toBe(true);
  });
});

describe('AlmanacPanel filter controller', () => {
  it('starts on all and resets to all on each open', () => {
    const p = new AlmanacPanel();
    p.open();
    expect(p.currentFilter()).toBe('all');
    p.update(200);
    p.cycleFilter();
    expect(p.currentFilter()).toBe('village');
    p.close();
    p.open();
    expect(p.currentFilter()).toBe('all');
  });

  it('ignores cycleFilter while closed', () => {
    const p = new AlmanacPanel();
    p.cycleFilter();
    expect(p.currentFilter()).toBe('all');
  });
});
