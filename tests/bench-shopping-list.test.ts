// Bench shopping-list hint — surfaces the exact gap on dimmed rows
// of the carpenter's bench so the player knows whether to chase gold
// or chase gems. Pure module, no UI assertions; the menu draw layer
// simply calls recipeShoppingList(player, recipe) and renders the
// returned string when canCraft() is false.

import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import {
  BENCH_RECIPES,
  canCraft,
  recipeShoppingList,
  type BenchRecipe,
} from '../src/game/bench';
import { gemInventoryKey } from '../src/game/gems';

function freshPlayer(gold = 0): Player {
  const w = new World();
  w.player.gold = gold;
  w.player.inventory = {};
  return w.player;
}

// Pick a recipe with predictable cost numbers for the assertions.
function recipeByKey(key: string): BenchRecipe {
  const r = BENCH_RECIPES.find((row) => row.key === key);
  if (!r) throw new Error(`recipe ${key} missing`);
  return r;
}

describe('recipeShoppingList — returns "" when craftable', () => {
  it('returns empty string when the player has enough gold + gems', () => {
    const recipe = recipeByKey('craft-scarecrow');
    const p = freshPlayer(recipe.gold + 100);
    p.inventory[gemInventoryKey(recipe.gem.key)] = recipe.gem.count + 1;
    expect(canCraft(p, recipe)).toBe(true);
    expect(recipeShoppingList(p, recipe)).toBe('');
  });
});

describe('recipeShoppingList — names the gold gap precisely', () => {
  it('reports the exact gold deficit alone when gems are covered', () => {
    const recipe = recipeByKey('craft-scarecrow'); // 300g + 1 iron
    const p = freshPlayer(120);
    p.inventory[gemInventoryKey(recipe.gem.key)] = recipe.gem.count;
    expect(canCraft(p, recipe)).toBe(false);
    expect(recipeShoppingList(p, recipe)).toBe('need 180g more');
  });

  it('reports the gold gap even when the player has more than the gem need', () => {
    const recipe = recipeByKey('craft-coop-deluxe'); // 700g + 2 iron
    const p = freshPlayer(699);
    p.inventory[gemInventoryKey(recipe.gem.key)] = 5;
    expect(recipeShoppingList(p, recipe)).toBe('need 1g more');
  });
});

describe('recipeShoppingList — names the gem gap with singular/plural', () => {
  it('reports the gem shortage in singular when short by one', () => {
    const recipe = recipeByKey('craft-coop-deluxe'); // 2 iron
    const p = freshPlayer(recipe.gold + 100);
    p.inventory[gemInventoryKey(recipe.gem.key)] = 1; // short by 1
    const hint = recipeShoppingList(p, recipe);
    // Iron's display name comes from GEMS['iron'].name — just assert
    // the shape so a future rename of the gem doesn't break the test.
    expect(hint).toMatch(/^need 1 more Iron \w+$/);
    expect(hint).not.toContain('s,');
    expect(hint.endsWith('s')).toBe(false);
  });

  it('reports the gem shortage in plural when short by more than one', () => {
    const recipe = recipeByKey('craft-coop-deluxe'); // 2 iron
    const p = freshPlayer(recipe.gold + 100);
    p.inventory[gemInventoryKey(recipe.gem.key)] = 0;
    const hint = recipeShoppingList(p, recipe);
    expect(hint).toMatch(/^need 2 more Iron \w+s$/);
  });
});

describe('recipeShoppingList — surfaces BOTH gaps together', () => {
  it('joins gold + gem shortages with ", " in that order', () => {
    const recipe = recipeByKey('craft-shelter'); // 400g + 1 iron
    const p = freshPlayer(50);
    p.inventory[gemInventoryKey(recipe.gem.key)] = 0;
    const hint = recipeShoppingList(p, recipe);
    expect(hint.startsWith('need 350g more, need 1 more Iron ')).toBe(true);
    expect(hint.indexOf('g more')).toBeLessThan(hint.indexOf('Iron'));
  });
});

describe('recipeShoppingList — every catalog recipe is checkable on a fresh player', () => {
  it('returns a non-empty hint for every recipe when the bag is empty', () => {
    const p = freshPlayer(0);
    for (const recipe of BENCH_RECIPES) {
      const hint = recipeShoppingList(p, recipe);
      // Every catalog recipe costs gold > 0, so a fresh player
      // should always see at least the gold gap.
      expect(hint.length).toBeGreaterThan(0);
      expect(hint).toContain(`${recipe.gold}g more`);
    }
  });
});
