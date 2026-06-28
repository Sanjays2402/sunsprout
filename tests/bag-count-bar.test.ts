// Bag row count-bar — maxBagRowCount() finds the fullest stack in the shown
// slice and bagCountBarWidth() scales each row's fill against it, so the bag
// rows carry a tiny relative-quantity gauge under the x{count} figure.

import { describe, it, expect } from 'vitest';
import {
  maxBagRowCount,
  bagCountBarWidth,
  bagItemsForCategory,
  type BagItem,
} from '../src/game/bag';
import { World } from '../src/world/world';

function item(count: number): BagItem {
  return { key: 'k', label: 'X', count, unitValue: 0, category: 'Supplies' };
}

describe('maxBagRowCount', () => {
  it('is 0 for an empty list (no bars drawn)', () => {
    expect(maxBagRowCount([])).toBe(0);
  });

  it('returns the largest stack count across the rows', () => {
    expect(maxBagRowCount([item(3), item(30), item(12)])).toBe(30);
  });

  it('reads the rows handed in, so it scales to the visible slice', () => {
    const w = new World();
    w.player.inventory = { wheat_harvest: 5, tomato_harvest: 20 };
    const crops = bagItemsForCategory(w.player, 'Crops');
    // The fullest crop stack drives the denominator for that tab.
    expect(maxBagRowCount(crops)).toBe(20);
  });
});

describe('bagCountBarWidth', () => {
  it('is 0 when there is nothing to scale against / empty row / no width', () => {
    expect(bagCountBarWidth(5, 0, 40)).toBe(0);
    expect(bagCountBarWidth(0, 40, 40)).toBe(0);
    expect(bagCountBarWidth(5, 40, 0)).toBe(0);
  });

  it('fills the whole track for the fullest stack', () => {
    expect(bagCountBarWidth(40, 40, 40)).toBe(40);
  });

  it('scales proportionally for a partial stack', () => {
    // 30 of a 60 max over a 40px track = half = 20px.
    expect(bagCountBarWidth(30, 60, 40)).toBe(20);
  });

  it('guarantees a non-zero stack at least 1px', () => {
    // 1 of 1000 would floor to 0px, but must show a sliver.
    expect(bagCountBarWidth(1, 1000, 40)).toBe(1);
  });

  it('clamps a count above the max so it cannot overflow the track', () => {
    expect(bagCountBarWidth(99, 40, 40)).toBe(40);
  });

  it('never exceeds the full width across a varied range', () => {
    for (let c = 1; c <= 50; c++) {
      const w = bagCountBarWidth(c, 50, 30);
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(30);
    }
  });
});
