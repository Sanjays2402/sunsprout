// Bag sort-direction indicator — bagSortDirection(mode) tells the chip
// which way the active sort orders rows (descending for count/value,
// alphabetical for name) so the indicator can never disagree with the
// actual row order the sorter produces.

import { describe, it, expect } from 'vitest';
import {
  bagSortDirection,
  bagItemsForCategory,
  BAG_SORT_MODES,
} from '../src/game/bag';
import type { Player } from '../src/world/world';

function mkPlayer(inventory: Record<string, number>): Player {
  return { inventory, gold: 0 } as unknown as Player;
}

describe('bagSortDirection', () => {
  it('reports descending for count and value (biggest first)', () => {
    expect(bagSortDirection('count')).toBe('desc');
    expect(bagSortDirection('value')).toBe('desc');
  });

  it('reports A-Z for the name sort', () => {
    expect(bagSortDirection('name')).toBe('az');
  });

  it('classifies every sort mode (total over BAG_SORT_MODES)', () => {
    for (const mode of BAG_SORT_MODES) {
      const dir = bagSortDirection(mode);
      expect(dir === 'desc' || dir === 'az').toBe(true);
    }
  });

  it('the desc modes really do order rows high -> low', () => {
    // count: copper 5 > ruby 1; value: ruby 140g > copper 40g. In both the
    // first row's sort key is the largest, matching the 'desc' indicator.
    const player = mkPlayer({ 'gem-copper': 5, 'gem-ruby': 1 });
    const byCount = bagItemsForCategory(player, 'Gems', 'count');
    expect(byCount[0].count).toBeGreaterThanOrEqual(byCount[1].count);
    expect(bagSortDirection('count')).toBe('desc');

    const byValue = bagItemsForCategory(player, 'Gems', 'value');
    const worth = (r: { count: number; unitValue: number }) => r.count * r.unitValue;
    expect(worth(byValue[0])).toBeGreaterThanOrEqual(worth(byValue[1]));
    expect(bagSortDirection('value')).toBe('desc');
  });

  it('the az mode really does order labels A -> Z', () => {
    const player = mkPlayer({ 'gem-copper': 5, 'gem-ruby': 1, 'gem-iron': 3 });
    const byName = bagItemsForCategory(player, 'Gems', 'name').map((r) => r.label);
    const ascending = [...byName].sort((a, b) => a.localeCompare(b));
    expect(byName).toEqual(ascending);
    expect(bagSortDirection('name')).toBe('az');
  });
});
