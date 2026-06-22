// Breeder egg cookbook tie-in — breeder eggs can stand in for a
// regular egg in egg-bearing recipes, producing a premium variant
// at 1.5x the base sell price.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  RECIPES,
  RECIPE_KEYS,
  PREMIUM_SELL_MULTIPLIER,
  canCook,
  canCookPremium,
  cook,
  cookPremium,
  dishInventoryKey,
  premiumDishInventoryKey,
  premiumSellPrice,
  recipeHasEgg,
  sellAllDishes,
  premiumDishesValue,
  premiumCookLine,
  type DishKey,
} from '../src/game/cooking';
import { BREEDER_EGG_INVENTORY_KEY } from '../src/game/coop';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

/** Cheap fixture: top the player up with every ingredient any recipe needs. */
function stockEverything(w: World, breeder = 0, regularEgg = 5): void {
  w.player.inventory = {
    wheat_harvest: 10,
    tomato_harvest: 10,
    pumpkin_harvest: 10,
    flower_harvest: 10,
    egg: regularEgg,
    'fish-minnow': 5,
    'forage-mushroom': 5,
    'forage-berry': 5,
    'forage-herb': 5,
  };
  if (breeder > 0) {
    w.player.inventory[BREEDER_EGG_INVENTORY_KEY] = breeder;
  }
}

describe('premium cooking — recipe shape predicate', () => {
  it('recipeHasEgg is true for omelet/custard/skillet/tart/cocoa/sunflower-elixir', () => {
    const eggRecipes: DishKey[] = [
      'farm-omelet',
      'pumpkin-custard',
      'mushroom-skillet',
      'berry-tart',
      'hot-cocoa',
      'sunflower-elixir',
    ];
    for (const k of eggRecipes) expect(recipeHasEgg(RECIPES[k])).toBe(true);
  });

  it('recipeHasEgg is false for sage tea / berry tonic / hearty stew (no eggs)', () => {
    expect(recipeHasEgg(RECIPES['herb-tea'])).toBe(false);
    expect(recipeHasEgg(RECIPES['berry-tonic'])).toBe(false);
    expect(recipeHasEgg(RECIPES['hearty-stew'])).toBe(false);
  });
});

describe('premiumDishInventoryKey + premiumSellPrice', () => {
  it('key suffix never collides with the regular dish key', () => {
    for (const k of RECIPE_KEYS) {
      expect(premiumDishInventoryKey(k)).not.toBe(dishInventoryKey(k));
      expect(premiumDishInventoryKey(k).startsWith('dish-')).toBe(true);
      expect(premiumDishInventoryKey(k).endsWith('-premium')).toBe(true);
    }
  });

  it('premiumSellPrice is exactly 1.5x base (rounded)', () => {
    for (const k of RECIPE_KEYS) {
      expect(premiumSellPrice(k)).toBe(
        Math.round(RECIPES[k].sellPrice * PREMIUM_SELL_MULTIPLIER),
      );
    }
  });

  it('premium multiplier stays at 1.5x (intent: conservative markup)', () => {
    expect(PREMIUM_SELL_MULTIPLIER).toBe(1.5);
  });
});

describe('canCookPremium', () => {
  it('refuses recipes without an egg ingredient', () => {
    const w = freshWorld();
    stockEverything(w, 5);
    expect(canCookPremium(w.player, 'herb-tea')).toBe(false);
    expect(canCookPremium(w.player, 'hearty-stew')).toBe(false);
  });

  it('refuses when the player has no breeder egg', () => {
    const w = freshWorld();
    stockEverything(w, 0);
    expect(canCook(w.player, 'farm-omelet')).toBe(true);
    expect(canCookPremium(w.player, 'farm-omelet')).toBe(false);
  });

  it('refuses when the player lacks the OTHER ingredients', () => {
    const w = freshWorld();
    w.player.inventory = { [BREEDER_EGG_INVENTORY_KEY]: 1 };
    expect(canCookPremium(w.player, 'farm-omelet')).toBe(false);
  });

  it('refuses on multi-egg recipe when the player has the breeder egg but not enough regular eggs', () => {
    const w = freshWorld();
    // pumpkin-custard needs 3 eggs. With one breeder + 1 regular = 2 < 3.
    stockEverything(w, 1, 1);
    expect(canCookPremium(w.player, 'pumpkin-custard')).toBe(false);
  });

  it('allows the swap on single-egg recipe (sunflower-elixir needs 1 egg)', () => {
    const w = freshWorld();
    stockEverything(w, 1, 0); // No regular eggs at all.
    expect(canCookPremium(w.player, 'sunflower-elixir')).toBe(true);
  });

  it('allows the swap on multi-egg recipe when (regular + 1 breeder) ≥ count', () => {
    const w = freshWorld();
    stockEverything(w, 1, 2); // pumpkin-custard needs 3 eggs total.
    expect(canCookPremium(w.player, 'pumpkin-custard')).toBe(true);
  });
});

describe('cookPremium', () => {
  it('consumes one breeder egg + (count-1) regular eggs + every other ingredient', () => {
    const w = freshWorld();
    stockEverything(w, 1, 5);
    const ok = cookPremium(w.player, 'farm-omelet');
    expect(ok).toBe(true);
    // farm-omelet: 2 eggs + 1 tomato. Swap = 1 breeder + 1 regular egg + 1 tomato.
    expect(w.player.inventory[BREEDER_EGG_INVENTORY_KEY]).toBe(0);
    expect(w.player.inventory.egg).toBe(4);
    expect(w.player.inventory.tomato_harvest).toBe(9);
  });

  it('mints the premium dish in `dish-<key>-premium`', () => {
    const w = freshWorld();
    stockEverything(w, 1, 5);
    cookPremium(w.player, 'farm-omelet');
    expect(w.player.inventory['dish-farm-omelet-premium']).toBe(1);
    // Regular dish key untouched.
    expect(w.player.inventory['dish-farm-omelet'] ?? 0).toBe(0);
  });

  it('returns false + no mutation when conditions are unmet', () => {
    const w = freshWorld();
    stockEverything(w, 0, 5);
    const before = JSON.stringify(w.player.inventory);
    const ok = cookPremium(w.player, 'farm-omelet');
    expect(ok).toBe(false);
    expect(JSON.stringify(w.player.inventory)).toBe(before);
  });

  it('refuses on egg-less recipes (Sage Tea cannot be premiumised)', () => {
    const w = freshWorld();
    stockEverything(w, 5, 5);
    const ok = cookPremium(w.player, 'herb-tea');
    expect(ok).toBe(false);
    // Inventory untouched.
    expect(w.player.inventory[BREEDER_EGG_INVENTORY_KEY]).toBe(5);
    expect(w.player.inventory['forage-herb']).toBe(5);
  });
});

describe('sellAllDishes — premium variants are bundled', () => {
  it('zeros both the regular and premium keys + credits gold for both', () => {
    const w = freshWorld();
    stockEverything(w, 2, 6);
    cook(w.player, 'farm-omelet'); // regular dish
    cookPremium(w.player, 'farm-omelet'); // premium dish
    cookPremium(w.player, 'mushroom-skillet'); // another premium dish
    const earned = sellAllDishes(w.player);
    const expected =
      RECIPES['farm-omelet'].sellPrice +
      premiumSellPrice('farm-omelet') +
      premiumSellPrice('mushroom-skillet');
    expect(earned).toBe(expected);
    expect(w.player.gold).toBe(expected);
    expect(w.player.inventory['dish-farm-omelet'] ?? 0).toBe(0);
    expect(w.player.inventory['dish-farm-omelet-premium'] ?? 0).toBe(0);
    expect(w.player.inventory['dish-mushroom-skillet-premium'] ?? 0).toBe(0);
  });
});

describe('premiumDishesValue helper', () => {
  it('sums the premium dish stack by premiumSellPrice', () => {
    const w = freshWorld();
    w.player.inventory['dish-farm-omelet-premium'] = 2;
    w.player.inventory['dish-mushroom-skillet-premium'] = 1;
    const expected =
      2 * premiumSellPrice('farm-omelet') + premiumSellPrice('mushroom-skillet');
    expect(premiumDishesValue(w.player)).toBe(expected);
  });
});

describe('premiumCookLine formatter (codex panel hook)', () => {
  it('formats an "Xg (+Yg)" line for egg recipes', () => {
    const line = premiumCookLine('farm-omelet');
    expect(line).toContain(String(premiumSellPrice('farm-omelet')));
    expect(line).toContain('breeder egg');
    expect(line).toMatch(/\+\d+g/);
  });

  it('returns an empty string for non-egg recipes', () => {
    expect(premiumCookLine('herb-tea')).toBe('');
    expect(premiumCookLine('hearty-stew')).toBe('');
  });
});
