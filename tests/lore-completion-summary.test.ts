// Lore completion summary header — discovered/total + percent + tabs-complete.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  loreCompletionSummary,
  loreCompletionSummaryLine,
  loreProgress,
  type LoreCompletionSummary,
} from '../src/game/lore';
import { FISH_KEYS } from '../src/game/fish';
import { GEM_KEYS, gemInventoryKey } from '../src/game/gems';
import { FORAGE_KEYS, forageInventoryKey } from '../src/game/forage';
import { startingHearts } from '../src/game/hearts';

function freshWorld(): World {
  const w = new World();
  w.player.hearts = startingHearts();
  return w;
}

describe('loreCompletionSummary', () => {
  it('a fresh world has zero discovered and a positive total', () => {
    const w = freshWorld();
    const s = loreCompletionSummary(w.player);
    expect(s.discovered).toBe(0);
    expect(s.total).toBeGreaterThan(0);
    expect(s.pct).toBe(0);
    expect(s.tabsComplete).toBe(0);
  });

  it('excludes the Rumors tab from the catalogue totals', () => {
    const w = freshWorld();
    const s = loreCompletionSummary(w.player);
    // The catalogue total equals the sum of every non-Rumors tab's total.
    const catalogueTotal = loreProgress(w.player)
      .filter((p) => p.category !== 'Rumors')
      .reduce((a, p) => a + p.total, 0);
    expect(s.total).toBe(catalogueTotal);
    expect(s.tabsTotal).toBe(loreProgress(w.player).filter((p) => p.category !== 'Rumors').length);
  });

  it('discovered count + percent climb as entries are found', () => {
    const w = freshWorld();
    const before = loreCompletionSummary(w.player);
    w.player.inventory[`fish-${FISH_KEYS[0]}`] = 1;
    w.player.inventory[gemInventoryKey(GEM_KEYS[0])] = 1;
    const after = loreCompletionSummary(w.player);
    expect(after.discovered).toBe(before.discovered + 2);
    expect(after.pct).toBeGreaterThan(before.pct);
    expect(after.pct).toBeLessThan(100);
  });

  it('counts a tab as complete only once every row in it is discovered', () => {
    const w = freshWorld();
    // Discover the whole Forage tab.
    for (const k of FORAGE_KEYS) w.player.inventory[forageInventoryKey(k)] = 1;
    const s = loreCompletionSummary(w.player);
    expect(s.tabsComplete).toBe(1);
    // ... but a single fish doesn't complete the Fish tab (unless it's a
    // one-entry tab, which it isn't).
    w.player.inventory[`fish-${FISH_KEYS[0]}`] = 1;
    expect(loreCompletionSummary(w.player).tabsComplete).toBe(1);
  });
});

describe('loreCompletionSummaryLine', () => {
  const mk = (over: Partial<LoreCompletionSummary>): LoreCompletionSummary => ({
    discovered: 0,
    total: 40,
    pct: 0,
    tabsComplete: 0,
    tabsTotal: 5,
    ...over,
  });

  it("reads 'discovered N/M (P%)' before any tab is complete", () => {
    expect(loreCompletionSummaryLine(mk({ discovered: 18, total: 40, pct: 45 }))).toBe(
      'discovered 18/40 (45%)',
    );
  });

  it('appends a singular tabs-complete tail at exactly one', () => {
    expect(
      loreCompletionSummaryLine(mk({ discovered: 20, total: 40, pct: 50, tabsComplete: 1 })),
    ).toBe('discovered 20/40 (50%)  -  1 tab complete');
  });

  it('appends a plural tabs-complete tail beyond one', () => {
    expect(
      loreCompletionSummaryLine(mk({ discovered: 30, total: 40, pct: 75, tabsComplete: 3 })),
    ).toBe('discovered 30/40 (75%)  -  3 tabs complete');
  });

  it("returns '' when there's nothing to discover", () => {
    expect(loreCompletionSummaryLine(mk({ total: 0 }))).toBe('');
  });

  it('stays ASCII (no emoji in app chrome)', () => {
    const line = loreCompletionSummaryLine(mk({ discovered: 5, total: 40, pct: 12, tabsComplete: 2 }));
    expect(/^[\x20-\x7E]*$/.test(line)).toBe(true);
  });
});
