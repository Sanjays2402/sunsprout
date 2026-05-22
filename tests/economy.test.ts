// Economy: buy / sell with gold checks.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { buyItem, sellItem, addItem, sellAllGems } from '../src/game/economy';
import { GEMS, gemInventoryKey } from '../src/game/gems';

function freshPlayer() {
  const w = new World();
  const p = w.player;
  p.inventory = {};
  p.gold = 30;
  return p;
}

describe('economy', () => {
  it('buyItem reduces gold and adds the item', () => {
    const p = freshPlayer();
    expect(buyItem(p, 'wheat', 2)).toBe(true);
    expect(p.gold).toBe(28);
    expect(p.inventory.wheat).toBe(1);
  });

  it('buyItem fails when gold is insufficient (no state change)', () => {
    const p = freshPlayer();
    expect(buyItem(p, 'pumpkin', 100)).toBe(false);
    expect(p.gold).toBe(30);
    expect(p.inventory.pumpkin).toBeUndefined();
  });

  it('sellItem adds gold and removes one item', () => {
    const p = freshPlayer();
    addItem(p, 'wheat_harvest', 3);
    expect(sellItem(p, 'wheat_harvest', 8)).toBe(true);
    expect(p.gold).toBe(38);
    expect(p.inventory.wheat_harvest).toBe(2);
  });

  it('sellItem fails when nothing to sell', () => {
    const p = freshPlayer();
    expect(sellItem(p, 'pumpkin_harvest', 80)).toBe(false);
    expect(p.gold).toBe(30);
  });

  it('sellAllGems converts every gem in inventory to gold at catalog price', () => {
    const p = freshPlayer();
    p.inventory[gemInventoryKey('copper')] = 2;
    p.inventory[gemInventoryKey('gold')] = 1;
    const expected = 2 * GEMS.copper.sellPrice + 1 * GEMS.gold.sellPrice;
    const earned = sellAllGems(p);
    expect(earned).toBe(expected);
    expect(p.gold).toBe(30 + expected);
    expect(p.inventory[gemInventoryKey('copper')]).toBe(0);
    expect(p.inventory[gemInventoryKey('gold')]).toBe(0);
  });

  it('sellAllGems is a no-op when the pouch is empty', () => {
    const p = freshPlayer();
    expect(sellAllGems(p)).toBe(0);
    expect(p.gold).toBe(30);
  });
});
