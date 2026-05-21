// Player economy — gold, seed/harvest inventory keys, and shop transactions.
//
// Inventory keys we care about:
//   wheat / tomato / pumpkin / flower  → seed counts (per crops.ts CROPS keys)
//   <crop>_harvest                      → harvested produce ready to sell
//   watering-can / hoe                  → tools the player always carries
//
// Functions are intentionally tiny and side-effect-only on the Player.
// They return a boolean so quests / UI can react to success/failure.

import type { Player } from '../world/world';
import { CROPS } from './crops';

/** A row in the village shop. Either a seed (buy) or a harvest (sell). */
export interface ShopItem {
  key: string;
  label: string;
  buyPrice: number | null;
  sellPrice: number | null;
}

/** All seeds in the catalog become buyable. Their harvests become sellable. */
export const SHOP_ITEMS: ShopItem[] = (() => {
  const items: ShopItem[] = [];
  for (const key of Object.keys(CROPS)) {
    const crop = CROPS[key];
    items.push({
      key,
      label: `${crop.name} seed`,
      buyPrice: crop.seedPrice,
      sellPrice: null,
    });
    items.push({
      key: `${key}_harvest`,
      label: crop.name,
      buyPrice: null,
      sellPrice: crop.sellPrice,
    });
  }
  return items;
})();

/** Increases inventory[key] by `amount` (default 1). */
export function addItem(
  player: Player,
  key: string,
  amount: number = 1,
): void {
  player.inventory[key] = (player.inventory[key] ?? 0) + amount;
}

/** Removes up to `amount` of item; returns the count actually removed. */
export function removeItem(
  player: Player,
  key: string,
  amount: number = 1,
): number {
  const have = player.inventory[key] ?? 0;
  const taken = Math.min(have, amount);
  player.inventory[key] = have - taken;
  return taken;
}

/** Player has at least `amount` of item. */
export function hasItem(
  player: Player,
  key: string,
  amount: number = 1,
): boolean {
  return (player.inventory[key] ?? 0) >= amount;
}

/**
 * Tries to spend `price` gold and grant one of `itemKey`. Returns true on
 * success, false on insufficient gold (gold + inventory both unchanged).
 */
export function buyItem(
  player: Player,
  itemKey: string,
  price: number,
): boolean {
  if (player.gold < price) return false;
  player.gold -= price;
  addItem(player, itemKey, 1);
  return true;
}

/**
 * Sells one of `itemKey` for `price` gold. Returns true on success
 * (item removed, gold added), false if the player doesn't have one.
 */
export function sellItem(
  player: Player,
  itemKey: string,
  price: number,
): boolean {
  const have = player.inventory[itemKey] ?? 0;
  if (have <= 0) return false;
  player.inventory[itemKey] = have - 1;
  player.gold += price;
  return true;
}

/** Sells every unit of every `_harvest` item the player has. */
export function sellAllHarvest(player: Player): number {
  let earned = 0;
  for (const key of Object.keys(player.inventory)) {
    if (!key.endsWith('_harvest')) continue;
    const cropKey = key.slice(0, -'_harvest'.length);
    const price = CROPS[cropKey]?.sellPrice ?? 0;
    const have = player.inventory[key] ?? 0;
    earned += have * price;
    player.inventory[key] = 0;
  }
  player.gold += earned;
  return earned;
}
