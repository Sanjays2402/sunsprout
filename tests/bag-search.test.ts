// Bag cross-tab type-to-filter search — pure helpers + panel controller.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  bagSearchResults,
  bagSearchMatchCount,
} from '../src/game/bag';
import { BagPanel } from '../src/ui/bag-panel';

/** A world whose player carries a small, known spread of items. */
function stockedWorld(): World {
  const w = new World();
  w.player.inventory = {
    wheat: 5, // Wheat Seeds (Seeds)
    wheat_harvest: 12, // Wheat (Crops)
    pumpkin_harvest_gold: 1, // Pumpkin (gold) (Crops)
    'gem-ruby': 3, // Cave Ruby (Gems)
    'gem-silver': 2, // Silver Vein (Gems)
    'gem-copper': 5, // Copper Nugget (Gems)
    'fish-pike': 4, // Old Pike (Fish)
    'forage-berry': 6, // Wild Berry (Forage)
  };
  return w;
}

describe('bagSearchResults', () => {
  it('returns [] for an empty / whitespace query (no active search)', () => {
    const w = stockedWorld();
    expect(bagSearchResults(w.player, '')).toEqual([]);
    expect(bagSearchResults(w.player, '   ')).toEqual([]);
  });

  it('matches the human label case-insensitively as a substring', () => {
    const w = stockedWorld();
    const labels = bagSearchResults(w.player, 'whe').map((r) => r.label);
    // Both "Wheat Seeds" and "Wheat" match.
    expect(labels).toContain('Wheat Seeds');
    expect(labels).toContain('Wheat');
    // Uppercase query still matches the "Cave Ruby" label.
    expect(bagSearchResults(w.player, 'RUBY').map((r) => r.label)).toEqual(['Cave Ruby']);
  });

  it('searches across ALL tabs, not just one category', () => {
    const w = stockedWorld();
    // "e" appears in Wheat (Crops), Old Pike (Fish), Wild Berry (Forage),
    // Silver Vein / Copper Nugget (Gems) — multiple distinct tabs.
    const cats = new Set(bagSearchResults(w.player, 'e').map((r) => r.category));
    expect(cats.size).toBeGreaterThan(1);
  });

  it('returns matches in the category-then-sort order of buildBag', () => {
    const w = stockedWorld();
    // "ve" hits two real Gems rows (Silver Vein, Cave Ruby) — under the
    // default count sort the fuller stack (copper x5) isn't matched, so the
    // hits are the two gems with "ve", ordered by count desc then label.
    const veHits = bagSearchResults(w.player, 've').filter((r) => r.category === 'Gems');
    // Silver Vein (x2) and Cave Ruby (x3) both contain "ve"; ruby is fuller.
    expect(veHits.map((r) => r.label)).toEqual(['Cave Ruby', 'Silver Vein']);
  });

  it('returns nothing for a query that matches no label', () => {
    const w = stockedWorld();
    expect(bagSearchResults(w.player, 'zzzzz')).toEqual([]);
    expect(bagSearchMatchCount(w.player, 'zzzzz')).toBe(0);
  });

  it('bagSearchMatchCount agrees with the result length', () => {
    const w = stockedWorld();
    for (const q of ['wh', 'e', 'a', 'ruby', '']) {
      expect(bagSearchMatchCount(w.player, q)).toBe(bagSearchResults(w.player, q).length);
    }
  });
});

describe('BagPanel search controller', () => {
  it('starts unarmed and resets on open', () => {
    const p = new BagPanel();
    p.open();
    p.update(200);
    expect(p.isSearching()).toBe(false);
    expect(p.currentSearch()).toBe('');
  });

  it('toggleSearch arms / disarms and clears the query', () => {
    const p = new BagPanel();
    p.open();
    p.update(200);
    p.toggleSearch();
    expect(p.isSearching()).toBe(true);
    p.typeChar('r');
    p.typeChar('u');
    expect(p.currentSearch()).toBe('ru');
    p.toggleSearch(); // disarm
    expect(p.isSearching()).toBe(false);
    expect(p.currentSearch()).toBe('');
  });

  it('typeChar only accepts single alphanumerics while armed', () => {
    const p = new BagPanel();
    p.open();
    p.update(200);
    // Ignored while not searching.
    expect(p.typeChar('a')).toBe(false);
    p.toggleSearch();
    expect(p.typeChar('a')).toBe(true);
    expect(p.typeChar('1')).toBe(true);
    expect(p.typeChar('enter')).toBe(false); // multi-char key name
    expect(p.typeChar('!')).toBe(false); // punctuation
    expect(p.currentSearch()).toBe('a1');
  });

  it('backspaceSearch trims one char and reports change', () => {
    const p = new BagPanel();
    p.open();
    p.update(200);
    p.toggleSearch();
    p.typeChar('a');
    p.typeChar('b');
    expect(p.backspaceSearch()).toBe(true);
    expect(p.currentSearch()).toBe('a');
    p.backspaceSearch();
    expect(p.backspaceSearch()).toBe(false); // nothing left to delete
  });

  it('clearSearch clears a non-empty query first, then exits search', () => {
    const p = new BagPanel();
    p.open();
    p.update(200);
    p.toggleSearch();
    p.typeChar('x');
    // First clearSearch wipes the query but stays armed.
    expect(p.clearSearch()).toBe(true);
    expect(p.currentSearch()).toBe('');
    expect(p.isSearching()).toBe(true);
    // Second clearSearch exits search mode.
    expect(p.clearSearch()).toBe(true);
    expect(p.isSearching()).toBe(false);
  });

  it('ignores search input while the panel is closed', () => {
    const p = new BagPanel();
    p.toggleSearch();
    expect(p.isSearching()).toBe(false);
    expect(p.typeChar('a')).toBe(false);
  });
});
