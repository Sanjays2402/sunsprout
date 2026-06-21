// Egg + forage recipe tier — pricing rules, ingredient correctness, cook flow.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { startingHearts } from '../src/game/hearts';
import { startingQuests } from '../src/game/quests';
import {
  RECIPES,
  RECIPE_KEYS,
  canCook,
  cook,
  dishInventoryKey,
  ingredientsValue,
  rawSellValue,
  sellAllDishes,
} from '../src/game/cooking';
import { EGG_SELL_PRICE } from '../src/game/coop';
import { FORAGE } from '../src/game/forage';

function fakeWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  w.player.quests = startingQuests();
  w.player.hearts = startingHearts();
  return w;
}

const NEW_RECIPES = [
  'farm-omelet',
  'pumpkin-custard',
  'mushroom-skillet',
  'berry-tart',
  'herb-tea',
] as const;

describe('egg + forage recipes', () => {
  it('every new recipe is registered with a non-empty flavor', () => {
    for (const k of NEW_RECIPES) {
      expect(RECIPES[k]).toBeDefined();
      expect(RECIPES[k].name.length).toBeGreaterThan(0);
      expect(RECIPES[k].flavor.length).toBeGreaterThan(0);
      expect(RECIPES[k].sellPrice).toBeGreaterThan(0);
    }
  });

  it('every new recipe is included in RECIPE_KEYS', () => {
    for (const k of NEW_RECIPES) {
      expect(RECIPE_KEYS).toContain(k);
    }
  });

  it('rawSellValue knows about eggs and forage', () => {
    expect(rawSellValue('egg')).toBe(EGG_SELL_PRICE);
    expect(rawSellValue('forage-berry')).toBe(FORAGE.berry.sellPrice);
    expect(rawSellValue('forage-mushroom')).toBe(FORAGE.mushroom.sellPrice);
    expect(rawSellValue('forage-herb')).toBe(FORAGE.herb.sellPrice);
  });

  it('every new recipe sells for more than its raw ingredient sum (markup invariant)', () => {
    for (const k of NEW_RECIPES) {
      const r = RECIPES[k];
      const raw = ingredientsValue(r);
      expect(r.sellPrice).toBeGreaterThan(raw);
    }
  });

  it('farm-omelet consumes 2 eggs + 1 tomato and yields one dish', () => {
    const w = fakeWorld();
    w.player.inventory['egg'] = 2;
    w.player.inventory['tomato_harvest'] = 1;
    expect(canCook(w.player, 'farm-omelet')).toBe(true);
    expect(cook(w.player, 'farm-omelet')).toBe(true);
    expect(w.player.inventory['egg']).toBe(0);
    expect(w.player.inventory['tomato_harvest']).toBe(0);
    expect(w.player.inventory[dishInventoryKey('farm-omelet')]).toBe(1);
  });

  it('cook refuses when an ingredient is missing', () => {
    const w = fakeWorld();
    w.player.inventory['egg'] = 1; // need 2
    w.player.inventory['tomato_harvest'] = 1;
    expect(canCook(w.player, 'farm-omelet')).toBe(false);
    expect(cook(w.player, 'farm-omelet')).toBe(false);
    expect(w.player.inventory['egg']).toBe(1);
    expect(w.player.inventory['tomato_harvest']).toBe(1);
  });

  it('pumpkin-custard consumes 3 eggs and 1 pumpkin', () => {
    const w = fakeWorld();
    w.player.inventory['egg'] = 3;
    w.player.inventory['pumpkin_harvest'] = 1;
    expect(cook(w.player, 'pumpkin-custard')).toBe(true);
    expect(w.player.inventory['egg']).toBe(0);
    expect(w.player.inventory['pumpkin_harvest']).toBe(0);
  });

  it('mushroom-skillet uses two mushrooms and two eggs', () => {
    const w = fakeWorld();
    w.player.inventory['egg'] = 2;
    w.player.inventory['forage-mushroom'] = 2;
    expect(cook(w.player, 'mushroom-skillet')).toBe(true);
    expect(w.player.inventory['forage-mushroom']).toBe(0);
  });

  it('berry-tart uses 3 berries + wheat + 1 egg', () => {
    const w = fakeWorld();
    w.player.inventory['egg'] = 1;
    w.player.inventory['wheat_harvest'] = 1;
    w.player.inventory['forage-berry'] = 3;
    expect(cook(w.player, 'berry-tart')).toBe(true);
    expect(w.player.inventory['forage-berry']).toBe(0);
  });

  it('herb-tea only needs two sage sprigs', () => {
    const w = fakeWorld();
    w.player.inventory['forage-herb'] = 2;
    expect(canCook(w.player, 'herb-tea')).toBe(true);
    expect(cook(w.player, 'herb-tea')).toBe(true);
  });

  it('sellAllDishes prices the new recipes correctly at the inn', () => {
    const w = fakeWorld();
    w.player.inventory[dishInventoryKey('farm-omelet')] = 1;
    w.player.inventory[dishInventoryKey('herb-tea')] = 2;
    const earned = sellAllDishes(w.player);
    expect(earned).toBe(RECIPES['farm-omelet'].sellPrice + 2 * RECIPES['herb-tea'].sellPrice);
    expect(w.player.gold).toBe(earned);
  });

  it('every recipe markup is at least +14g (no trivially-priced dish)', () => {
    for (const k of NEW_RECIPES) {
      const r = RECIPES[k];
      const markup = r.sellPrice - ingredientsValue(r);
      expect(markup).toBeGreaterThanOrEqual(14);
    }
  });
});
