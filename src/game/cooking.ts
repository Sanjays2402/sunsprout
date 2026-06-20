// Cooking — recipe catalog + the pure `cook()` function.
//
// This is slice 1 of the v0.3.0 cooking pot. We keep it self-contained,
// like fishing.ts did before its world wiring: the module owns the
// recipe data and a single mutation entry point (`cook`) that consumes
// ingredients from the player's inventory and grants a dish.
//
// Dishes are stored on the player as `dish-<key>` inventory entries so
// they don't collide with the existing `<crop>_harvest` / `fish-<key>`
// namespaces. The inn UI (next tick) will surface them; the well sell
// loop in economy.ts already only touches `_harvest` keys, so dishes
// stay safely "inn-only" currency until we explicitly hook them up.
//
// Pricing rule: every dish sells for STRICTLY MORE than the sum of its
// raw ingredient sell prices — that's the whole point of cooking. The
// markup is tuned per recipe so simple stews are reliably profitable
// without making the late-game pumpkin feast trivially OP.

import type { Player } from '../world/world';
import { CROPS } from './crops';
import { FISH, type FishKey } from './fish';
import { FORAGE } from './forage';
import { EGG_SELL_PRICE } from './coop';

/** Identifier keys for every dish the player can produce. */
export type DishKey =
  | 'hearty-stew'
  | 'pumpkin-soup'
  | 'fish-chowder'
  | 'veggie-medley'
  | 'sunsprout-feast'
  | 'farm-omelet'
  | 'pumpkin-custard'
  | 'mushroom-skillet'
  | 'berry-tart'
  | 'herb-tea';

/** One required ingredient line: an inventory key + how many to consume. */
export interface Ingredient {
  /** Inventory key the player must have (e.g. `wheat_harvest`, `fish-minnow`). */
  key: string;
  /** How many units to consume. */
  count: number;
}

/** Static recipe definition. */
export interface Recipe {
  /** Stable key — also doubles as `dish-<key>` in the player inventory. */
  key: DishKey;
  /** Human-readable name shown in the cooking menu / HUD toasts. */
  name: string;
  /** Short flavour line shown on the recipe card. */
  flavor: string;
  /** Required ingredients (all must be present in the player's inventory). */
  ingredients: Ingredient[];
  /** Gold earned when sold at the inn. */
  sellPrice: number;
}

/**
 * Catalog of starter recipes. Ordered roughly by complexity / unlock — the
 * inn UI will render them in this order. Numbers are tuned so each dish is
 * at least ~30% more valuable than the sum of its ingredients raw.
 */
export const RECIPES: Record<DishKey, Recipe> = {
  'hearty-stew': {
    key: 'hearty-stew',
    name: 'Hearty Stew',
    flavor: 'Wheat + tomato simmered low. The classic.',
    ingredients: [
      { key: 'wheat_harvest', count: 1 },
      { key: 'tomato_harvest', count: 1 },
    ],
    sellPrice: 50, // raw: 8 + 25 = 33 → +17 markup
  },
  'pumpkin-soup': {
    key: 'pumpkin-soup',
    name: 'Pumpkin Soup',
    flavor: 'A single ripe pumpkin, slow-roasted with cream.',
    ingredients: [{ key: 'pumpkin_harvest', count: 1 }],
    sellPrice: 110, // raw: 80 → +30 markup
  },
  'fish-chowder': {
    key: 'fish-chowder',
    name: 'River Chowder',
    flavor: 'Pond minnow + a heel of wheat bread.',
    ingredients: [
      { key: 'fish-minnow', count: 1 },
      { key: 'wheat_harvest', count: 1 },
    ],
    sellPrice: 25, // raw: 5 + 8 = 13 → +12 markup
  },
  'veggie-medley': {
    key: 'veggie-medley',
    name: 'Garden Medley',
    flavor: 'Everything from the field, tossed in butter.',
    ingredients: [
      { key: 'wheat_harvest', count: 1 },
      { key: 'tomato_harvest', count: 1 },
      { key: 'flower_harvest', count: 1 },
    ],
    sellPrice: 70, // raw: 8 + 25 + 15 = 48 → +22 markup
  },
  'sunsprout-feast': {
    key: 'sunsprout-feast',
    name: 'Sunsprout Feast',
    flavor: 'One of everything from the farm. A celebration.',
    ingredients: [
      { key: 'wheat_harvest', count: 1 },
      { key: 'tomato_harvest', count: 1 },
      { key: 'pumpkin_harvest', count: 1 },
      { key: 'flower_harvest', count: 1 },
    ],
    sellPrice: 200, // raw: 128 → +72 markup
  },
  // ---- Egg + forage tier (post-coop, post-forage) ----
  'farm-omelet': {
    key: 'farm-omelet',
    name: 'Farm Omelet',
    flavor: 'Two fresh eggs folded over a ripe tomato.',
    ingredients: [
      { key: 'egg', count: 2 },
      { key: 'tomato_harvest', count: 1 },
    ],
    sellPrice: 80, // raw: 12*2 + 25 = 49 → +31 markup
  },
  'pumpkin-custard': {
    key: 'pumpkin-custard',
    name: 'Pumpkin Custard',
    flavor: 'Slow-baked pumpkin with three sweet eggs.',
    ingredients: [
      { key: 'egg', count: 3 },
      { key: 'pumpkin_harvest', count: 1 },
    ],
    sellPrice: 180, // raw: 12*3 + 80 = 116 → +64 markup
  },
  'mushroom-skillet': {
    key: 'mushroom-skillet',
    name: 'Mushroom Skillet',
    flavor: 'Forest mushrooms sizzled with two farm-fresh eggs.',
    ingredients: [
      { key: 'egg', count: 2 },
      { key: 'forage-mushroom', count: 2 },
    ],
    sellPrice: 75, // raw: 24 + 18 = 42 → +33 markup
  },
  'berry-tart': {
    key: 'berry-tart',
    name: 'Berry Tart',
    flavor: 'Wild berries on a wheat-flour crust. Glossy red.',
    ingredients: [
      { key: 'forage-berry', count: 3 },
      { key: 'wheat_harvest', count: 1 },
      { key: 'egg', count: 1 },
    ],
    sellPrice: 65, // raw: 18 + 8 + 12 = 38 → +27 markup
  },
  'herb-tea': {
    key: 'herb-tea',
    name: 'Sage Tea',
    flavor: 'Two sprigs steeped in well water. Quiet evenings.',
    ingredients: [{ key: 'forage-herb', count: 2 }],
    sellPrice: 22, // raw: 8 → +14 markup
  },
};

/** All recipe keys in catalog order — useful for the future cooking menu. */
export const RECIPE_KEYS: DishKey[] = Object.keys(RECIPES) as DishKey[];

/**
 * Inventory key under which a finished dish is stored. The leading `dish-`
 * prefix keeps it disjoint from harvest / seed / fish keys.
 */
export function dishInventoryKey(key: DishKey): string {
  return `dish-${key}`;
}

/**
 * Sums up the raw sell value of a recipe's ingredients — using CROPS for
 * `_harvest` keys and FISH for `fish-<key>` entries. Anything we don't
 * recognise is treated as zero, on the principle that future recipes can
 * include items (eggs, milk) without breaking the math.
 */
export function ingredientsValue(recipe: Recipe): number {
  let total = 0;
  for (const ing of recipe.ingredients) {
    total += rawSellValue(ing.key) * ing.count;
  }
  return total;
}

/** Best-effort raw sell value lookup for a single inventory key. */
export function rawSellValue(key: string): number {
  if (key.endsWith('_harvest')) {
    const cropKey = key.slice(0, -'_harvest'.length);
    return CROPS[cropKey]?.sellPrice ?? 0;
  }
  if (key.startsWith('fish-')) {
    const fishKey = key.slice('fish-'.length) as FishKey;
    return FISH[fishKey]?.sellPrice ?? 0;
  }
  if (key.startsWith('forage-')) {
    const kind = key.slice('forage-'.length) as keyof typeof FORAGE;
    return FORAGE[kind]?.sellPrice ?? 0;
  }
  if (key === 'egg') return EGG_SELL_PRICE;
  return 0;
}

/** Whether the player has every ingredient a recipe requires. */
export function canCook(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return false;
  for (const ing of recipe.ingredients) {
    if ((player.inventory[ing.key] ?? 0) < ing.count) return false;
  }
  return true;
}

/**
 * Attempts to cook `recipeKey`. On success consumes every ingredient and
 * increments `dish-<recipeKey>` in the player's inventory by 1, returning
 * true. On failure (missing ingredients, unknown key) the player state is
 * left untouched and the function returns false.
 *
 * The function is intentionally side-effect-only on the Player so the
 * future inn-cooking UI can drive it straight from a keystroke without
 * threading extra context.
 */
export function cook(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return false;
  if (!canCook(player, recipeKey)) return false;
  for (const ing of recipe.ingredients) {
    player.inventory[ing.key] = (player.inventory[ing.key] ?? 0) - ing.count;
  }
  const dishKey = dishInventoryKey(recipeKey);
  player.inventory[dishKey] = (player.inventory[dishKey] ?? 0) + 1;
  return true;
}

/** Convenience: total gold value of every dish in the inventory. */
export function dishesValue(player: Player): number {
  let total = 0;
  for (const recipeKey of RECIPE_KEYS) {
    const have = player.inventory[dishInventoryKey(recipeKey)] ?? 0;
    total += have * RECIPES[recipeKey].sellPrice;
  }
  return total;
}

/**
 * Sells every dish in the player's inventory, mirroring `sellAllHarvest`
 * but for the inn rather than the well. Adds the total to `player.gold`,
 * zeros every `dish-<key>` entry, and returns the total gold earned so
 * the caller can surface it in a toast.
 *
 * Returns 0 when the player has no dishes — the caller is responsible
 * for showing a "nothing to sell" message in that case.
 */
export function sellAllDishes(player: Player): number {
  let earned = 0;
  for (const recipeKey of RECIPE_KEYS) {
    const key = dishInventoryKey(recipeKey);
    const have = player.inventory[key] ?? 0;
    if (have <= 0) continue;
    earned += have * RECIPES[recipeKey].sellPrice;
    player.inventory[key] = 0;
  }
  player.gold += earned;
  return earned;
}
