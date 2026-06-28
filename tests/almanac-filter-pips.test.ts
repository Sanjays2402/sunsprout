// Almanac filter preview pips — the per-kind colour swatches drawn beside
// the filter chip previewing WHAT each filter admits. almanacFilterKinds()
// returns the admitted kinds in the panel's stable rail order, and must
// agree exactly with applyAlmanacFilter's membership so the pips never lie.

import { describe, it, expect } from 'vitest';
import {
  almanacFilterKinds,
  applyAlmanacFilter,
  ALMANAC_FILTERS,
  type AlmanacEntry,
  type AlmanacFilter,
  type AlmanacKind,
} from '../src/game/almanac';

const ALL_KINDS: AlmanacKind[] = ['personal', 'festival', 'tournament', 'cart', 'birthday'];

function entryOf(kind: AlmanacKind): AlmanacEntry {
  return { daysUntil: 1, kind, title: kind, detail: '', season: 0, day: 1 };
}

describe('almanacFilterKinds', () => {
  it("'all' previews every kind in the stable summary order", () => {
    // SUMMARY_KIND_ORDER is personal, festival, tournament, cart, birthday.
    expect(almanacFilterKinds('all')).toEqual([
      'personal',
      'festival',
      'tournament',
      'cart',
      'birthday',
    ]);
  });

  it("'village' previews festival, tournament, cart (in rail order)", () => {
    expect(almanacFilterKinds('village')).toEqual(['festival', 'tournament', 'cart']);
  });

  it("'birthdays' previews only the birthday kind", () => {
    expect(almanacFilterKinds('birthdays')).toEqual(['birthday']);
  });

  it("'personal' previews only the personal kind", () => {
    expect(almanacFilterKinds('personal')).toEqual(['personal']);
  });

  it('returns a non-empty pip set for every filter', () => {
    for (const f of ALMANAC_FILTERS) {
      expect(almanacFilterKinds(f).length).toBeGreaterThan(0);
    }
  });

  it('matches applyAlmanacFilter membership exactly for every filter', () => {
    // For each filter, the kinds it previews are precisely the kinds whose
    // single-entry almanac survives that filter — so the pips can never
    // claim to show a kind the filter actually drops, or hide one it keeps.
    const mixed: AlmanacEntry[] = ALL_KINDS.map(entryOf);
    for (const f of ALMANAC_FILTERS) {
      const previewed = new Set(almanacFilterKinds(f));
      const kept = new Set(applyAlmanacFilter(mixed, f).map((e) => e.kind));
      expect([...previewed].sort()).toEqual([...kept].sort());
    }
  });

  it('previews a stable subset of the all-set for narrowing filters', () => {
    const all = almanacFilterKinds('all');
    for (const f of ['village', 'birthdays', 'personal'] as AlmanacFilter[]) {
      for (const k of almanacFilterKinds(f)) {
        expect(all).toContain(k);
      }
    }
  });
});
