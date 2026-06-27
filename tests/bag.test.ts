// Bag model — categorize the flat inventory into the tabbed bag view.

import { describe, it, expect } from 'vitest';
import {
  classifyBagKey,
  buildBag,
  bagItemsForCategory,
  bagCategoryCounts,
  bagTotalStacks,
  bagTotalValue,
  bagCategoryValue,
  bagSellHint,
  bagSortLabel,
  cycleBagSort,
  BAG_CATEGORIES,
  BAG_SORT_MODES,
} from '../src/game/bag';
import { bagEmptyState, BAG_EMPTY_STATES } from '../src/game/panel-empty';
import type { Player } from '../src/world/world';

function mkPlayer(inventory: Record<string, number>): Player {
  return { inventory, gold: 0 } as unknown as Player;
}

describe('classifyBagKey', () => {
  it('routes a bare crop key to Seeds', () => {
    const row = classifyBagKey('wheat', 8);
    expect(row?.category).toBe('Seeds');
    expect(row?.label).toBe('Wheat Seeds');
  });

  it('routes a normal harvest to Crops with the base sell price', () => {
    const row = classifyBagKey('wheat_harvest', 3);
    expect(row?.category).toBe('Crops');
    expect(row?.label).toBe('Wheat');
    expect(row?.unitValue).toBe(8); // wheat sellPrice
  });

  it('values silver / gold harvests at the quality multiplier', () => {
    const silver = classifyBagKey('wheat_harvest_silver', 1);
    const gold = classifyBagKey('wheat_harvest_gold', 1);
    expect(silver?.unitValue).toBe(Math.round(8 * 1.5)); // 12
    expect(gold?.unitValue).toBe(Math.round(8 * 2)); // 16
    expect(silver?.label).toContain('silver');
    expect(gold?.label).toContain('gold');
  });

  it('routes fish / gems / forage to their tabs with sell prices', () => {
    expect(classifyBagKey('fish-pike', 1)?.category).toBe('Fish');
    expect(classifyBagKey('fish-pike', 1)?.unitValue).toBe(60);
    expect(classifyBagKey('gem-ruby', 1)?.category).toBe('Gems');
    expect(classifyBagKey('gem-ruby', 1)?.unitValue).toBe(140);
    expect(classifyBagKey('forage-berry', 1)?.category).toBe('Forage');
    expect(classifyBagKey('forage-berry', 1)?.unitValue).toBe(6);
  });

  it('routes eggs and dishes to Kitchen', () => {
    expect(classifyBagKey('egg', 2)?.category).toBe('Kitchen');
    expect(classifyBagKey('egg', 2)?.unitValue).toBe(12);
    expect(classifyBagKey('egg-fancy', 1)?.unitValue).toBe(36);
    const dish = classifyBagKey('dish-herb-tea', 1);
    expect(dish?.category).toBe('Kitchen');
    expect(dish?.label).toBe('Sage Tea');
  });

  it('marks premium dishes and prices them at the premium multiplier', () => {
    const reg = classifyBagKey('dish-hearty-stew', 1);
    const prem = classifyBagKey('dish-hearty-stew-premium', 1);
    expect(prem?.label).toContain('premium');
    expect(prem!.unitValue).toBeGreaterThan(reg!.unitValue);
  });

  it('routes known tools / cosmetics to Supplies with friendly labels', () => {
    expect(classifyBagKey('hoe', 1)?.label).toBe('Hoe');
    expect(classifyBagKey('watering-can', 1)?.label).toBe('Watering Can');
    expect(classifyBagKey('hoe', 1)?.category).toBe('Supplies');
  });

  it('title-cases an unknown key into Supplies so nothing is invisible', () => {
    const row = classifyBagKey('greenhouse-kit', 1);
    expect(row?.category).toBe('Supplies');
    expect(row?.label).toBe('Greenhouse Kit');
  });

  it('drops zero / negative stacks', () => {
    expect(classifyBagKey('wheat', 0)).toBeNull();
    expect(classifyBagKey('wheat', -3)).toBeNull();
  });
});

describe('buildBag', () => {
  const player = mkPlayer({
    wheat: 8,
    wheat_harvest: 3,
    wheat_harvest_gold: 1,
    'fish-pike': 2,
    'gem-ruby': 1,
    'gem-copper': 5,
    'forage-berry': 4,
    egg: 2,
    'dish-herb-tea': 1,
    hoe: 1,
    pumpkin: 0, // zero stack — should be filtered
  });

  it('omits zero stacks', () => {
    const keys = buildBag(player).map((r) => r.key);
    expect(keys).not.toContain('pumpkin');
  });

  it('groups by category in the canonical order', () => {
    const cats = buildBag(player).map((r) => r.category);
    // The first row must be a Seeds row, the last a Supplies row.
    expect(cats[0]).toBe('Seeds');
    expect(cats[cats.length - 1]).toBe('Supplies');
    // Categories never interleave — each appears as one contiguous run.
    const order = BAG_CATEGORIES.filter((c) => cats.includes(c));
    const seen: string[] = [];
    for (const c of cats) if (seen[seen.length - 1] !== c) seen.push(c);
    expect(seen).toEqual(order);
  });

  it('sorts within a category by descending count then label', () => {
    const gems = bagItemsForCategory(player, 'Gems');
    // copper (5) before ruby (1).
    expect(gems.map((r) => r.label)).toEqual(['Copper Nugget', 'Cave Ruby']);
  });
});

describe('bag aggregates', () => {
  const player = mkPlayer({
    wheat: 8,
    'fish-pike': 2,
    'gem-ruby': 1,
    hoe: 1,
  });

  it('counts non-zero stacks per category', () => {
    const counts = bagCategoryCounts(player);
    expect(counts.Seeds).toBe(1);
    expect(counts.Fish).toBe(1);
    expect(counts.Gems).toBe(1);
    expect(counts.Supplies).toBe(1);
    expect(counts.Crops).toBe(0);
  });

  it('totals distinct stacks', () => {
    expect(bagTotalStacks(player)).toBe(4);
  });

  it('totals sellable worth as sum of count * unitValue', () => {
    // pike 2*60 + ruby 1*140 = 260; seeds + hoe contribute 0.
    expect(bagTotalValue(player)).toBe(260);
  });

  it('breaks worth down per category', () => {
    // Fish 2*60 = 120; Gems 1*140 = 140; Seeds + Supplies are valueless.
    expect(bagCategoryValue(player, 'Fish')).toBe(120);
    expect(bagCategoryValue(player, 'Gems')).toBe(140);
    expect(bagCategoryValue(player, 'Seeds')).toBe(0);
    expect(bagCategoryValue(player, 'Supplies')).toBe(0);
    // The per-category figures sum to the whole-bag worth.
    const sum = BAG_CATEGORIES.reduce((n, c) => n + bagCategoryValue(player, c), 0);
    expect(sum).toBe(bagTotalValue(player));
  });

  it('points each sellable tab at the right counter; null for the rest', () => {
    expect(bagSellHint('Crops')).toContain('well');
    expect(bagSellHint('Gems')).toContain('well');
    expect(bagSellHint('Forage')).toContain('well');
    expect(bagSellHint('Kitchen')).toContain('inn');
    // Fish don't sell raw — the hint must steer to cooking, not the well.
    expect(bagSellHint('Fish')).toContain('inn');
    expect(bagSellHint('Fish')).not.toContain('well');
    // Seeds + Supplies aren't a sell loop.
    expect(bagSellHint('Seeds')).toBeNull();
    expect(bagSellHint('Supplies')).toBeNull();
  });

  it('handles a totally empty bag without throwing', () => {
    const empty = mkPlayer({});
    expect(bagTotalStacks(empty)).toBe(0);
    expect(bagTotalValue(empty)).toBe(0);
    for (const c of BAG_CATEGORIES) {
      expect(bagItemsForCategory(empty, c)).toEqual([]);
    }
  });
});

describe('bag sort modes', () => {
  it('cycles count -> value -> name -> count', () => {
    expect(cycleBagSort('count')).toBe('value');
    expect(cycleBagSort('value')).toBe('name');
    expect(cycleBagSort('name')).toBe('count');
  });

  it('labels every mode legibly', () => {
    expect(bagSortLabel('count')).toBe('by count');
    expect(bagSortLabel('value')).toBe('by value');
    expect(bagSortLabel('name')).toBe('A-Z');
    // Exhaustive: every catalog mode has a non-empty label.
    for (const m of BAG_SORT_MODES) {
      expect(bagSortLabel(m).length).toBeGreaterThan(0);
    }
  });

  it("defaults buildBag to 'count' so existing callers are unchanged", () => {
    const player = mkPlayer({ 'gem-copper': 5, 'gem-ruby': 1 });
    const defaulted = buildBag(player).map((r) => r.label);
    const explicit = buildBag(player, 'count').map((r) => r.label);
    expect(defaulted).toEqual(explicit);
    // copper (5) before ruby (1) under count.
    expect(defaulted).toEqual(['Copper Nugget', 'Cave Ruby']);
  });

  it('sorts by total worth under value mode', () => {
    // copper 5 * 8 = 40g total; ruby 1 * 140 = 140g total. Value mode
    // puts ruby first even though copper has the bigger stack count.
    const player = mkPlayer({ 'gem-copper': 5, 'gem-ruby': 1 });
    const byValue = bagItemsForCategory(player, 'Gems', 'value').map((r) => r.label);
    expect(byValue).toEqual(['Cave Ruby', 'Copper Nugget']);
  });

  it('sorts A-Z under name mode regardless of count or value', () => {
    const player = mkPlayer({ 'gem-copper': 5, 'gem-ruby': 1, 'gem-iron': 3 });
    const byName = bagItemsForCategory(player, 'Gems', 'name').map((r) => r.label);
    // Cave Ruby, Copper Nugget, Iron Chunk — alphabetical by label.
    expect(byName).toEqual(['Cave Ruby', 'Copper Nugget', 'Iron Chunk']);
  });

  it('keeps category grouping intact under every sort mode', () => {
    const player = mkPlayer({
      wheat: 8,
      'fish-pike': 2,
      'gem-ruby': 1,
      hoe: 1,
    });
    for (const mode of BAG_SORT_MODES) {
      const cats = buildBag(player, mode).map((r) => r.category);
      // First row stays Seeds, last stays Supplies — sort never crosses tabs.
      expect(cats[0]).toBe('Seeds');
      expect(cats[cats.length - 1]).toBe('Supplies');
    }
  });
});

describe('bag empty states', () => {
  it('returns a two-part (message + hint) state for every category', () => {
    for (const c of BAG_CATEGORIES) {
      const s = bagEmptyState(c);
      expect(s.message.trim().length).toBeGreaterThan(0);
      expect(s.hint.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers exactly the seven bag categories (total over BagCategory)', () => {
    expect(Object.keys(BAG_EMPTY_STATES).sort()).toEqual([...BAG_CATEGORIES].sort());
  });

  it('points each gatherable tab at the verb that fills it', () => {
    expect(bagEmptyState('Fish').hint).toContain('F)');
    expect(bagEmptyState('Gems').hint).toContain('M)');
    expect(bagEmptyState('Forage').hint).toContain('Y)');
    expect(bagEmptyState('Seeds').hint).toMatch(/Maple/i);
  });

  it('carries no emoji (game chrome stays monochrome)', () => {
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const c of BAG_CATEGORIES) {
      const s = bagEmptyState(c);
      expect(emoji.test(s.message)).toBe(false);
      expect(emoji.test(s.hint)).toBe(false);
    }
  });
});
