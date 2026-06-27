// Recipe codex discovery-filter — all / cooked / ready / undiscovered cycle.

import { describe, it, expect } from 'vitest';
import {
  applyCodexFilter,
  cycleCodexFilter,
  codexFilterLabel,
  CODEX_FILTERS,
  type RecipeCodexFilter,
  type RecipeCodexRow,
  type RecipeDiscovery,
} from '../src/game/cooking-history';
import { RecipeCodex } from '../src/ui/recipe-codex';

/** A minimal synthetic codex row of a given discovery state. */
function rowOf(discovery: RecipeDiscovery, name: string = discovery): RecipeCodexRow {
  return {
    key: name as RecipeCodexRow['key'],
    name,
    flavor: '',
    sellPrice: 10,
    ingredients: [],
    discovery,
    cookedCount: discovery === 'cooked' ? 1 : 0,
    hasPremium: false,
    premiumLine: '',
    premiumSellPrice: 0,
    premiumCookedCount: 0,
    premiumOwned: 0,
  };
}

describe('cycleCodexFilter', () => {
  it('cycles all -> cooked -> ready -> undiscovered -> all', () => {
    expect(cycleCodexFilter('all')).toBe('cooked');
    expect(cycleCodexFilter('cooked')).toBe('ready');
    expect(cycleCodexFilter('ready')).toBe('undiscovered');
    expect(cycleCodexFilter('undiscovered')).toBe('all');
  });

  it('walks the whole cycle and returns to the start', () => {
    let f: RecipeCodexFilter = 'all';
    const seen: RecipeCodexFilter[] = [f];
    for (let i = 0; i < CODEX_FILTERS.length - 1; i++) {
      f = cycleCodexFilter(f);
      seen.push(f);
    }
    expect(seen).toEqual([...CODEX_FILTERS]);
    expect(cycleCodexFilter(f)).toBe('all');
  });
});

describe('codexFilterLabel', () => {
  it('labels every filter with a non-empty ASCII word', () => {
    for (const f of CODEX_FILTERS) {
      const label = codexFilterLabel(f);
      expect(label).toBe(f);
      expect(/^[\x20-\x7E]+$/.test(label)).toBe(true);
    }
  });
});

describe('applyCodexFilter', () => {
  const mixed: RecipeCodexRow[] = [
    rowOf('cooked', 'stew'),
    rowOf('known', 'omelet'),
    rowOf('locked', 'mystery'),
    rowOf('cooked', 'soup'),
  ];

  it("'all' returns every row untouched (as a copy)", () => {
    const out = applyCodexFilter(mixed, 'all');
    expect(out).toEqual(mixed);
    expect(out).not.toBe(mixed); // copy, not the same array ref
  });

  it("'cooked' admits only cooked rows", () => {
    const names = applyCodexFilter(mixed, 'cooked').map((r) => r.name);
    expect(names).toEqual(['stew', 'soup']);
  });

  it("'ready' admits only known (ready-to-cook) rows", () => {
    const names = applyCodexFilter(mixed, 'ready').map((r) => r.name);
    expect(names).toEqual(['omelet']);
  });

  it("'undiscovered' admits only locked rows", () => {
    const names = applyCodexFilter(mixed, 'undiscovered').map((r) => r.name);
    expect(names).toEqual(['mystery']);
  });

  it('preserves catalog order within a filter', () => {
    const ordered = [rowOf('cooked', 'a'), rowOf('cooked', 'b'), rowOf('cooked', 'c')];
    const out = applyCodexFilter(ordered, 'cooked');
    expect(out.map((r) => r.name)).toEqual(['a', 'b', 'c']);
  });

  it('the three non-all filters partition the discovery space', () => {
    // Every discovery state is admitted by exactly one non-all filter.
    const states: RecipeDiscovery[] = ['cooked', 'known', 'locked'];
    for (const s of states) {
      const hits = (['cooked', 'ready', 'undiscovered'] as const).filter(
        (f) => applyCodexFilter([rowOf(s)], f).length === 1,
      );
      expect(hits.length).toBe(1);
    }
  });
});

describe('RecipeCodex filter controller', () => {
  it('starts on all and resets to all on each open', () => {
    const c = new RecipeCodex();
    c.open();
    expect(c.currentFilter()).toBe('all');
    c.update(200);
    c.cycleFilter();
    expect(c.currentFilter()).toBe('cooked');
    c.close();
    c.open();
    expect(c.currentFilter()).toBe('all');
  });

  it('ignores cycleFilter while closed', () => {
    const c = new RecipeCodex();
    c.cycleFilter();
    expect(c.currentFilter()).toBe('all');
  });
});
