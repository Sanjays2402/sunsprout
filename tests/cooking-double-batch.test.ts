// Stamina-tea double-batch — at the inn, the player can cook a
// double-batch of any stamina-restoring tea by paying 2x ingredients
// to yield 3x dishes. Bonus only applies to teas in STAMINA_TEA_KEYS.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  RECIPES,
  RECIPE_KEYS,
  DOUBLE_BATCH_INGREDIENT_MULT,
  DOUBLE_BATCH_DISH_YIELD,
  STAMINA_TEA_KEYS,
  canCook,
  canCookDoubleBatch,
  cook,
  cookDoubleBatch,
  dishInventoryKey,
  doubleBatchLine,
  isStaminaTea,
  type DishKey,
} from '../src/game/cooking';
import { STAMINA_RESTORE } from '../src/game/stamina';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function stockForRecipe(w: World, key: DishKey, mult = 2): void {
  const r = RECIPES[key];
  for (const ing of r.ingredients) {
    w.player.inventory[ing.key] = (w.player.inventory[ing.key] ?? 0) + ing.count * mult;
  }
}

describe('stamina-tea eligibility', () => {
  it('STAMINA_TEA_KEYS contains exactly the five stamina-restoring drinks', () => {
    expect(STAMINA_TEA_KEYS.has('herb-tea')).toBe(true);
    expect(STAMINA_TEA_KEYS.has('hot-cocoa')).toBe(true);
    expect(STAMINA_TEA_KEYS.has('berry-tonic')).toBe(true);
    expect(STAMINA_TEA_KEYS.has('mushroom-broth')).toBe(true);
    expect(STAMINA_TEA_KEYS.has('sunflower-elixir')).toBe(true);
    expect(STAMINA_TEA_KEYS.size).toBe(5);
  });

  it('stays in sync with STAMINA_RESTORE keys (one source of truth)', () => {
    // Every STAMINA_RESTORE key maps to a recipe in STAMINA_TEA_KEYS.
    for (const key of Object.keys(STAMINA_RESTORE)) {
      const dishKey = key.replace(/^dish-/, '') as DishKey;
      expect(STAMINA_TEA_KEYS.has(dishKey)).toBe(true);
    }
    // And every STAMINA_TEA_KEYS entry has a STAMINA_RESTORE row.
    for (const dishKey of STAMINA_TEA_KEYS) {
      expect(STAMINA_RESTORE[`dish-${dishKey}`]).toBeGreaterThan(0);
    }
  });

  it('isStaminaTea is true for the five tea keys, false for everything else', () => {
    for (const k of RECIPE_KEYS) {
      expect(isStaminaTea(k)).toBe(STAMINA_TEA_KEYS.has(k));
    }
  });
});

describe('canCookDoubleBatch', () => {
  it('refuses non-tea recipes', () => {
    const w = freshWorld();
    stockForRecipe(w, 'farm-omelet', 5);
    expect(canCook(w.player, 'farm-omelet')).toBe(true);
    expect(canCookDoubleBatch(w.player, 'farm-omelet')).toBe(false);
  });

  it('refuses when the player has only 1x ingredients (regular cook is fine, double is not)', () => {
    const w = freshWorld();
    stockForRecipe(w, 'herb-tea', 1);
    expect(canCook(w.player, 'herb-tea')).toBe(true);
    expect(canCookDoubleBatch(w.player, 'herb-tea')).toBe(false);
  });

  it('allows the double batch when the player has 2x ingredients', () => {
    const w = freshWorld();
    stockForRecipe(w, 'herb-tea', 2);
    expect(canCookDoubleBatch(w.player, 'herb-tea')).toBe(true);
  });

  it('allows the double batch on multi-ingredient teas (berry-tonic / mushroom-broth)', () => {
    const w = freshWorld();
    stockForRecipe(w, 'berry-tonic', 2);
    expect(canCookDoubleBatch(w.player, 'berry-tonic')).toBe(true);
    stockForRecipe(w, 'mushroom-broth', 2);
    expect(canCookDoubleBatch(w.player, 'mushroom-broth')).toBe(true);
  });
});

describe('cookDoubleBatch', () => {
  it('consumes 2x ingredients and mints 3x dishes in the same dish key', () => {
    const w = freshWorld();
    stockForRecipe(w, 'herb-tea', 2); // herb-tea: 2 herb sprigs base; we set 4.
    const ok = cookDoubleBatch(w.player, 'herb-tea');
    expect(ok).toBe(true);
    expect(w.player.inventory['forage-herb'] ?? 0).toBe(0); // 4 - 4 = 0
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(DOUBLE_BATCH_DISH_YIELD);
  });

  it('the bonus dish piles into the same dish-<key> slot (drinkBest stays unaware)', () => {
    const w = freshWorld();
    stockForRecipe(w, 'hot-cocoa', 2);
    const ok = cookDoubleBatch(w.player, 'hot-cocoa');
    expect(ok).toBe(true);
    expect(w.player.inventory['dish-hot-cocoa']).toBe(DOUBLE_BATCH_DISH_YIELD);
    // No premium / no parallel key minted.
    expect(w.player.inventory['dish-hot-cocoa-premium'] ?? 0).toBe(0);
    expect(w.player.inventory['dish-hot-cocoa-batch'] ?? 0).toBe(0);
  });

  it('returns false + no mutation when conditions are unmet', () => {
    const w = freshWorld();
    stockForRecipe(w, 'herb-tea', 1); // only 1x
    const before = JSON.stringify(w.player.inventory);
    const ok = cookDoubleBatch(w.player, 'herb-tea');
    expect(ok).toBe(false);
    expect(JSON.stringify(w.player.inventory)).toBe(before);
  });

  it('refuses on non-tea recipes', () => {
    const w = freshWorld();
    stockForRecipe(w, 'farm-omelet', 5);
    const ok = cookDoubleBatch(w.player, 'farm-omelet');
    expect(ok).toBe(false);
    // Stock untouched.
    expect(w.player.inventory['egg']).toBe(10);
    expect(w.player.inventory['tomato_harvest']).toBe(5);
  });

  it('three regular cooks would have consumed MORE than one double batch', () => {
    const w = freshWorld();
    stockForRecipe(w, 'herb-tea', 3); // 3 regular cooks need 3x ingredients.
    // Burn the regular path.
    cook(w.player, 'herb-tea');
    cook(w.player, 'herb-tea');
    cook(w.player, 'herb-tea');
    const regularDishes = w.player.inventory['dish-herb-tea'];
    expect(regularDishes).toBe(3);
    // Reset cleanly, then run a double batch off only 2x ingredients.
    w.player.inventory = {};
    w.player.inventory['dish-herb-tea'] = 0;
    stockForRecipe(w, 'herb-tea', 2);
    const ok = cookDoubleBatch(w.player, 'herb-tea');
    expect(ok).toBe(true);
    expect(w.player.inventory['dish-herb-tea']).toBe(3);
    // The double batch arrives at 3 dishes for 2x ingredient cost vs 3x — savings real.
  });

  it('allows back-to-back double batches when the player has stocked 4x ingredients', () => {
    const w = freshWorld();
    stockForRecipe(w, 'mushroom-broth', 4);
    expect(cookDoubleBatch(w.player, 'mushroom-broth')).toBe(true);
    expect(cookDoubleBatch(w.player, 'mushroom-broth')).toBe(true);
    expect(w.player.inventory['dish-mushroom-broth']).toBe(2 * DOUBLE_BATCH_DISH_YIELD);
  });
});

describe('doubleBatchLine formatter (codex hook)', () => {
  it('formats the savings line for stamina teas', () => {
    const line = doubleBatchLine('berry-tonic');
    expect(line).toContain(`${DOUBLE_BATCH_INGREDIENT_MULT}x ingredients`);
    expect(line).toContain(`${DOUBLE_BATCH_DISH_YIELD} dishes`);
    expect(line).toContain('saves');
  });

  it('returns an empty string for non-tea recipes', () => {
    expect(doubleBatchLine('farm-omelet')).toBe('');
    expect(doubleBatchLine('hearty-stew')).toBe('');
    expect(doubleBatchLine('pumpkin-soup')).toBe('');
  });
});

describe('multiplier sanity', () => {
  it('the double-batch is a strict savings (3 dishes for 2x cost beats 3x cost)', () => {
    expect(DOUBLE_BATCH_DISH_YIELD).toBeGreaterThan(DOUBLE_BATCH_INGREDIENT_MULT);
  });
});
