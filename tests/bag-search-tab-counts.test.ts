// Bag search per-tab match counts — while `/` search is active the tab
// strip swaps its idle stack-count sub-labels for the cross-tab match
// distribution, so the player sees which categories the hits live under.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  bagSearchCategoryCounts,
  bagSearchMatchCount,
  bagSearchResults,
  BAG_CATEGORIES,
} from '../src/game/bag';

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

describe('bagSearchCategoryCounts', () => {
  it('is all-zero for an empty / whitespace query (no active search)', () => {
    const w = stockedWorld();
    for (const q of ['', '   ']) {
      const counts = bagSearchCategoryCounts(w.player, q);
      for (const cat of BAG_CATEGORIES) expect(counts[cat]).toBe(0);
    }
  });

  it('counts every category, zero for tabs with no match', () => {
    const w = stockedWorld();
    // "wheat" matches Wheat Seeds (Seeds) + Wheat (Crops) only.
    const counts = bagSearchCategoryCounts(w.player, 'wheat');
    expect(counts.Seeds).toBe(1);
    expect(counts.Crops).toBe(1);
    expect(counts.Gems).toBe(0);
    expect(counts.Fish).toBe(0);
    expect(counts.Forage).toBe(0);
    // Every category key is present (uniform "Cat N" sub-labels).
    for (const cat of BAG_CATEGORIES) expect(typeof counts[cat]).toBe('number');
  });

  it('concentrates gem hits under the Gems tab', () => {
    const w = stockedWorld();
    // "ve" hits the gem labels Sil-ve-r Vein AND Ca-ve Ruby — both cluster
    // under Gems and nowhere else, so the distribution is Gems-only here.
    const counts = bagSearchCategoryCounts(w.player, 've');
    expect(counts.Gems).toBe(2);
    expect(counts.Seeds).toBe(0);
    expect(counts.Crops).toBe(0);
    expect(counts.Fish).toBe(0);
    expect(counts.Forage).toBe(0);
  });

  it('per-category counts sum to the total cross-tab match count', () => {
    const w = stockedWorld();
    const q = 'e';
    const counts = bagSearchCategoryCounts(w.player, q);
    const sum = BAG_CATEGORIES.reduce((s, c) => s + counts[c], 0);
    expect(sum).toBe(bagSearchMatchCount(w.player, q));
    expect(sum).toBe(bagSearchResults(w.player, q).length);
  });

  it('agrees with the grouped search results per category', () => {
    const w = stockedWorld();
    const q = 'r'; // broad match
    const counts = bagSearchCategoryCounts(w.player, q);
    const grouped: Record<string, number> = {};
    for (const r of bagSearchResults(w.player, q)) {
      grouped[r.category] = (grouped[r.category] ?? 0) + 1;
    }
    for (const cat of BAG_CATEGORIES) {
      expect(counts[cat]).toBe(grouped[cat] ?? 0);
    }
  });
});
