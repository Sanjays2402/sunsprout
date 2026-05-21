// Cooking — recipe catalog + `cook()` consumption flow.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  canCook,
  cook,
  dishInventoryKey,
  dishesValue,
  ingredientsValue,
  rawSellValue,
  RECIPES,
  RECIPE_KEYS,
  sellAllDishes,
} from '../src/game/cooking';

function freshPlayer() {
  const w = new World();
  const p = w.player;
  p.inventory = {};
  p.gold = 0;
  return p;
}

describe('cooking', () => {
  it('every recipe sells for strictly more than its raw ingredients', () => {
    for (const key of RECIPE_KEYS) {
      const r = RECIPES[key];
      expect(r.sellPrice).toBeGreaterThan(ingredientsValue(r));
    }
  });

  it('rawSellValue recognises harvest and fish keys, ignores unknowns', () => {
    expect(rawSellValue('wheat_harvest')).toBe(8);
    expect(rawSellValue('pumpkin_harvest')).toBe(80);
    expect(rawSellValue('fish-minnow')).toBe(5);
    expect(rawSellValue('fish-pike')).toBe(60);
    expect(rawSellValue('something-weird')).toBe(0);
    expect(rawSellValue('hoe')).toBe(0);
  });

  it('canCook reports true only when every ingredient is present', () => {
    const p = freshPlayer();
    expect(canCook(p, 'hearty-stew')).toBe(false);
    p.inventory.wheat_harvest = 1;
    expect(canCook(p, 'hearty-stew')).toBe(false);
    p.inventory.tomato_harvest = 1;
    expect(canCook(p, 'hearty-stew')).toBe(true);
  });

  it('cook consumes ingredients and grants exactly one dish on success', () => {
    const p = freshPlayer();
    p.inventory.wheat_harvest = 2;
    p.inventory.tomato_harvest = 1;
    expect(cook(p, 'hearty-stew')).toBe(true);
    expect(p.inventory.wheat_harvest).toBe(1);
    expect(p.inventory.tomato_harvest).toBe(0);
    expect(p.inventory[dishInventoryKey('hearty-stew')]).toBe(1);
  });

  it('cook fails with insufficient ingredients and leaves inventory untouched', () => {
    const p = freshPlayer();
    p.inventory.wheat_harvest = 1;
    // tomato missing
    const snapshot = { ...p.inventory };
    expect(cook(p, 'hearty-stew')).toBe(false);
    expect(p.inventory).toEqual(snapshot);
    expect(p.inventory[dishInventoryKey('hearty-stew')]).toBeUndefined();
  });

  it('cook stacks multiple dishes across repeat calls', () => {
    const p = freshPlayer();
    p.inventory.pumpkin_harvest = 3;
    expect(cook(p, 'pumpkin-soup')).toBe(true);
    expect(cook(p, 'pumpkin-soup')).toBe(true);
    expect(p.inventory.pumpkin_harvest).toBe(1);
    expect(p.inventory[dishInventoryKey('pumpkin-soup')]).toBe(2);
  });

  it('cook rejects unknown recipe keys', () => {
    const p = freshPlayer();
    // Bogus key cast through `as never` — we want the runtime guard tested.
    expect(cook(p, 'not-a-recipe' as never)).toBe(false);
  });

  it('dishesValue sums sell prices across the dish inventory', () => {
    const p = freshPlayer();
    p.inventory[dishInventoryKey('hearty-stew')] = 2;
    p.inventory[dishInventoryKey('pumpkin-soup')] = 1;
    // 2 * 50 + 1 * 110
    expect(dishesValue(p)).toBe(210);
  });

  it('feast recipe requires one of every staple harvest', () => {
    const feast = RECIPES['sunsprout-feast'];
    const required = feast.ingredients.map((i) => i.key).sort();
    expect(required).toEqual([
      'flower_harvest',
      'pumpkin_harvest',
      'tomato_harvest',
      'wheat_harvest',
    ]);
  });

  it('sellAllDishes zeros every dish and pays the catalog total', () => {
    const p = freshPlayer();
    p.gold = 10;
    p.inventory[dishInventoryKey('hearty-stew')] = 2; // 2 * 50
    p.inventory[dishInventoryKey('pumpkin-soup')] = 1; // 1 * 110
    p.inventory[dishInventoryKey('fish-chowder')] = 3; // 3 * 25
    // A non-dish entry that must survive untouched.
    p.inventory.wheat_harvest = 4;
    const earned = sellAllDishes(p);
    expect(earned).toBe(2 * 50 + 1 * 110 + 3 * 25);
    expect(p.gold).toBe(10 + earned);
    for (const key of RECIPE_KEYS) {
      expect(p.inventory[dishInventoryKey(key)] ?? 0).toBe(0);
    }
    expect(p.inventory.wheat_harvest).toBe(4);
  });

  it('sellAllDishes returns 0 and does not touch gold when nothing to sell', () => {
    const p = freshPlayer();
    p.gold = 42;
    expect(sellAllDishes(p)).toBe(0);
    expect(p.gold).toBe(42);
  });
});
