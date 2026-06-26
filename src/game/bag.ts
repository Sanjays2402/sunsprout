// Bag model — categorize the player's flat inventory into a readable,
// tabbed "what do I own" view.
//
// The player's inventory is a single Record<string, number> that mixes
// everything: seeds (`wheat`), harvests (`wheat_harvest`, `_silver`,
// `_gold`), fish (`fish-pike`), gems (`gem-ruby`), forage (`forage-berry`),
// cooked dishes (`dish-herb-tea`, `dish-..-premium`), eggs (`egg`,
// `egg-fancy`, `egg-breeder`), fertilizer bags, and a long tail of tools /
// kits / tickets / cosmetics. The game had panels for the *meta* (recipes,
// crops, money, lore) but no single screen that answers the plainest
// question — "what's actually in my bag right now?". This module is the
// pure half of that bag panel: it walks the inventory once and sorts every
// non-zero stack into a small set of glanceable categories with a human
// label and a best-effort gold value, so the UI is a thin renderer.
//
// Pure: reads player.inventory + the catalogs, returns plain data. No
// canvas, no mutation. The UI (ui/bag-panel.ts) owns the draw + the tabs.

import type { Player } from '../world/world';
import { CROPS } from './crops';
import { parseHarvestKey, QUALITY_MULTIPLIER, QUALITY_LABEL } from './crop-quality';
import { FISH, type FishKey } from './fish';
import { GEMS, type GemKey } from './gems';
import { FORAGE, type ForageKind } from './forage';
import { RECIPES, premiumSellPrice, type DishKey } from './cooking';
import {
  EGG_INVENTORY_KEY,
  EGG_SELL_PRICE,
  FANCY_EGG_INVENTORY_KEY,
  FANCY_EGG_SELL_PRICE,
  BREEDER_EGG_INVENTORY_KEY,
} from './coop';

/** Bag tab categories, in display order. */
export const BAG_CATEGORIES = [
  'Seeds',
  'Crops',
  'Fish',
  'Gems',
  'Forage',
  'Kitchen',
  'Supplies',
] as const;
export type BagCategory = (typeof BAG_CATEGORIES)[number];

/** A single rolled-up bag row. */
export interface BagItem {
  /** Raw inventory key. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Stack size (always > 0 — zero stacks are filtered out). */
  count: number;
  /** Best-effort gold value of one unit (0 when not sellable / unknown). */
  unitValue: number;
  /** Which tab this row lives under. */
  category: BagCategory;
}

/** Keys that are tools / placeables / cosmetics, surfaced under Supplies. */
const SUPPLY_LABELS: Record<string, string> = {
  hoe: 'Hoe',
  'watering-can': 'Watering Can',
  bouquet: 'Bouquet',
  fertilizer: 'Fertilizer Bag',
  'fertilizer-rare': 'Rare Fertilizer Bag',
  'perfumed-soap': 'Perfumed Soap',
  chicken: 'Chicken',
};

/** Prettify a hyphen/underscore key into Title Case words. */
function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Resolve a dish key (possibly a `-premium` variant) to a label + value. */
function dishRow(key: string, count: number): BagItem | null {
  const isPremium = key.endsWith('-premium');
  const base = isPremium ? key.slice('dish-'.length, -'-premium'.length) : key.slice('dish-'.length);
  const recipe = RECIPES[base as DishKey];
  if (!recipe) {
    // Unknown dish key — still surface it generically so nothing vanishes.
    return { key, label: titleCase(base), count, unitValue: 0, category: 'Kitchen' };
  }
  const value = isPremium ? premiumSellPrice(base as DishKey) : recipe.sellPrice;
  const label = isPremium ? `${recipe.name} (premium)` : recipe.name;
  return { key, label, count, unitValue: value, category: 'Kitchen' };
}

/** Resolve one (key, count) inventory entry into a categorized row, or null. */
export function classifyBagKey(key: string, count: number): BagItem | null {
  if (count <= 0) return null;

  // Seeds — a bare crop key with no suffix.
  if (CROPS[key]) {
    return {
      key,
      label: `${CROPS[key].name} Seeds`,
      count,
      unitValue: 0, // seeds aren't sold back
      category: 'Seeds',
    };
  }

  // Harvested crops (normal / silver / gold buckets).
  const harvest = parseHarvestKey(key);
  if (harvest && CROPS[harvest.cropKey]) {
    const crop = CROPS[harvest.cropKey];
    const value = Math.round(crop.sellPrice * QUALITY_MULTIPLIER[harvest.quality]);
    const star = QUALITY_LABEL[harvest.quality];
    const label = star ? `${crop.name} (${star})` : crop.name;
    return { key, label, count, unitValue: value, category: 'Crops' };
  }

  // Fish.
  if (key.startsWith('fish-')) {
    const fk = key.slice('fish-'.length) as FishKey;
    const def = FISH[fk];
    if (def) return { key, label: def.name, count, unitValue: def.sellPrice, category: 'Fish' };
  }

  // Gems.
  if (key.startsWith('gem-')) {
    const gk = key.slice('gem-'.length) as GemKey;
    const def = GEMS[gk];
    if (def) return { key, label: def.name, count, unitValue: def.sellPrice, category: 'Gems' };
  }

  // Forage.
  if (key.startsWith('forage-')) {
    const fk = key.slice('forage-'.length) as ForageKind;
    const def = FORAGE[fk];
    if (def) return { key, label: def.name, count, unitValue: def.sellPrice, category: 'Forage' };
  }

  // Eggs — kitchen-adjacent produce.
  if (key === EGG_INVENTORY_KEY) {
    return { key, label: 'Egg', count, unitValue: EGG_SELL_PRICE, category: 'Kitchen' };
  }
  if (key === FANCY_EGG_INVENTORY_KEY) {
    return { key, label: 'Fancy Egg', count, unitValue: FANCY_EGG_SELL_PRICE, category: 'Kitchen' };
  }
  if (key === BREEDER_EGG_INVENTORY_KEY) {
    return { key, label: 'Breeder Egg', count, unitValue: 0, category: 'Kitchen' };
  }

  // Cooked dishes.
  if (key.startsWith('dish-')) {
    return dishRow(key, count);
  }

  // Known supplies (tools / placeables / cosmetics) with friendly labels.
  if (SUPPLY_LABELS[key]) {
    return { key, label: SUPPLY_LABELS[key], count, unitValue: 0, category: 'Supplies' };
  }

  // Everything else (kits, tickets, crafted items, sprinklers, ...) lands
  // in Supplies with a title-cased label so nothing the player owns is
  // ever invisible — the bag is a complete mirror of the inventory.
  return { key, label: titleCase(key), count, unitValue: 0, category: 'Supplies' };
}

/**
 * Build the full bag: every non-zero inventory stack as a categorized row.
 * Within a category rows sort by descending count, then label, so the
 * fullest stacks lead and ties read alphabetically. Pure.
 */
export function buildBag(player: Player): BagItem[] {
  const inv = player.inventory ?? {};
  const rows: BagItem[] = [];
  for (const key of Object.keys(inv)) {
    const row = classifyBagKey(key, inv[key] ?? 0);
    if (row) rows.push(row);
  }
  const order: Record<BagCategory, number> = {
    Seeds: 0,
    Crops: 1,
    Fish: 2,
    Gems: 3,
    Forage: 4,
    Kitchen: 5,
    Supplies: 6,
  };
  rows.sort((a, b) => {
    if (a.category !== b.category) return order[a.category] - order[b.category];
    if (a.count !== b.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return rows;
}

/** Rows belonging to a single category, in their sorted order. Pure. */
export function bagItemsForCategory(player: Player, category: BagCategory): BagItem[] {
  return buildBag(player).filter((r) => r.category === category);
}

/** Per-category non-zero stack counts, for the tab-strip sub-labels. Pure. */
export function bagCategoryCounts(player: Player): Record<BagCategory, number> {
  const counts: Record<BagCategory, number> = {
    Seeds: 0,
    Crops: 0,
    Fish: 0,
    Gems: 0,
    Forage: 0,
    Kitchen: 0,
    Supplies: 0,
  };
  for (const row of buildBag(player)) counts[row.category] += 1;
  return counts;
}

/** Total number of distinct non-zero stacks across the whole bag. Pure. */
export function bagTotalStacks(player: Player): number {
  return buildBag(player).length;
}

/**
 * Total sellable worth of the whole bag — sum of count * unitValue across
 * every row that carries a value. A glanceable "your bag is worth ~Ng"
 * figure for the panel header. Pure.
 */
export function bagTotalValue(player: Player): number {
  return buildBag(player).reduce((sum, r) => sum + r.count * r.unitValue, 0);
}
