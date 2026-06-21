// Cooking history — tracks how many times the player has cooked each
// dish. The recipe codex (`R`) reads this to surface "known" vs.
// "locked" recipes. We keep it as a tiny side-module rather than
// bolting onto cooking.ts so the catalog stays a pure data table.
//
// A recipe is:
//   cooked     → the player has ever cooked it (cookCounts > 0)
//   known      → cooked OR currently has every ingredient to cook it now
//   locked     → otherwise
//
// The cookCounts map is JSON-safe and rides on Player via a lazy getter
// so saves / reloads survive (persistence.ts whitelist passes it
// through because it's just a numeric record).

import type { Player } from '../world/world';
import { RECIPES, RECIPE_KEYS, canCook, type DishKey } from './cooking';

/** Discovery state for a single recipe. */
export type RecipeDiscovery = 'cooked' | 'known' | 'locked';

/** Lazy accessor — creates a fresh empty record on first use. */
export function getCookCounts(player: Player): Record<string, number> {
  const p = player as Player & { cookCounts?: Record<string, number> };
  if (!p.cookCounts) p.cookCounts = {};
  return p.cookCounts;
}

/** Records that the player just cooked one of `key`. Returns the new total. */
export function recordCook(player: Player, key: DishKey): number {
  const counts = getCookCounts(player);
  counts[key] = (counts[key] ?? 0) + 1;
  return counts[key];
}

/** How many times the player has ever cooked `key`. */
export function cookedCount(player: Player, key: DishKey): number {
  return getCookCounts(player)[key] ?? 0;
}

/** Classify a recipe for the codex panel. */
export function discoveryOf(player: Player, key: DishKey): RecipeDiscovery {
  if (cookedCount(player, key) > 0) return 'cooked';
  if (canCook(player, key)) return 'known';
  return 'locked';
}

/** Count of recipes the player has ever cooked. */
export function recipesCooked(player: Player): number {
  let n = 0;
  for (const k of RECIPE_KEYS) if (cookedCount(player, k) > 0) n++;
  return n;
}

/** Total dishes the player has ever cooked. */
export function totalDishesCooked(player: Player): number {
  let n = 0;
  for (const k of RECIPE_KEYS) n += cookedCount(player, k);
  return n;
}

/** Pure summary row — useful for the codex panel + unit tests. */
export interface RecipeCodexRow {
  key: DishKey;
  name: string;
  flavor: string;
  sellPrice: number;
  ingredients: Array<{ key: string; count: number; have: number }>;
  discovery: RecipeDiscovery;
  cookedCount: number;
}

/** Snapshot every recipe in catalog order. */
export function buildCodex(player: Player): RecipeCodexRow[] {
  return RECIPE_KEYS.map((key) => {
    const r = RECIPES[key];
    return {
      key,
      name: r.name,
      flavor: r.flavor,
      sellPrice: r.sellPrice,
      ingredients: r.ingredients.map((ing) => ({
        key: ing.key,
        count: ing.count,
        have: player.inventory[ing.key] ?? 0,
      })),
      discovery: discoveryOf(player, key),
      cookedCount: cookedCount(player, key),
    };
  });
}
