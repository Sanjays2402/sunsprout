// Travelling merchant cart — Pip the Peddler.
//
// Once per in-game season Pip rolls his cart into the village square and
// sets up shop for a single day. He sells items the regular Maple shop
// never carries: rare seeds the player can't normally grow, exotic
// cosmetics (placeable lanterns), and a small refill of premium drinks
// the cookbook can't easily produce.
//
// Schedule rule: Pip arrives on day 3 of every season (Spring d3,
// Summer d3, Fall d3, Winter d3). He parks on a fixed tile near the
// village well and stays from 09:00 until 18:00, then leaves at dusk.
//
// All Pip's items are flagged "premium" with a sell price 1.5x what a
// normal vendor charges — the convenience is in availability, not
// discount. Money log entries are tagged so the player can audit how
// much they've spent at the cart.
//
// Pure module: no IO, no canvas. The Game places the cart in render(),
// shows a "Pip is here today" toast at dawn, and opens a small menu
// when the player walks onto an adjacent tile and presses E.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';

/** Cart parking tile (just west of the well so it doesn't block paths). */
export const CART_X = 16;
export const CART_Y = 9;

/** Day of every season Pip visits. */
export const CART_VISIT_DAY = 3;

/** Hours the cart is open. */
export const CART_OPEN_HOUR = 9;
export const CART_CLOSE_HOUR = 18;

/** Approach radius — Chebyshev distance. */
export const CART_INTERACT_RADIUS = 1;

/** A single row in Pip's catalog. */
export interface CartItem {
  /** Inventory key the player receives on purchase. */
  key: string;
  /** Display label in the menu. */
  label: string;
  /** Gold cost. */
  buyPrice: number;
  /** One-line flavour shown under the row. */
  flavor: string;
}

/** Catalog of premium goods. Stable order — keep additions at the end. */
export const CART_CATALOG: CartItem[] = [
  {
    key: 'pumpkin',
    label: 'Pumpkin Seed (rare)',
    buyPrice: 220,
    flavor: 'A Fall heirloom. Big payoff, longer grow.',
  },
  {
    key: 'flower',
    label: 'Flower Seed (premium bouquet quality)',
    buyPrice: 90,
    flavor: 'These bloom a richer red. Hearts give double points.',
  },
  {
    key: 'dish-hot-cocoa',
    label: 'Hot Cocoa (ready-to-drink)',
    buyPrice: 80,
    flavor: 'A flask of cocoa, +35 stamina anytime you press Z.',
  },
  {
    key: 'dish-herb-tea',
    label: 'Sage Tea (ready-to-drink)',
    buyPrice: 35,
    flavor: 'A small flask. +20 stamina, quiet evenings.',
  },
  {
    key: 'cart-lantern',
    label: 'Brass Lantern (cosmetic)',
    buyPrice: 350,
    flavor: 'A trinket for the farmhouse mantle. Counts toward decorator.',
  },
];

/** Returns true on the in-game day Pip rolls into town. */
export function cartVisitToday(time: TimeOfDay): boolean {
  return time.day === CART_VISIT_DAY;
}

/** True iff the cart is parked + open right now. */
export function cartOpen(time: TimeOfDay): boolean {
  if (!cartVisitToday(time)) return false;
  return time.hour >= CART_OPEN_HOUR && time.hour < CART_CLOSE_HOUR;
}

/** True when the player is close enough to interact. */
export function nearCart(px: number, py: number): boolean {
  return (
    Math.abs(px - CART_X) <= CART_INTERACT_RADIUS &&
    Math.abs(py - CART_Y) <= CART_INTERACT_RADIUS
  );
}

/** Outcome of an attempted purchase. */
export type CartBuyOutcome =
  | { kind: 'bought'; item: CartItem; remainingGold: number }
  | { kind: 'closed' }
  | { kind: 'too-far' }
  | { kind: 'unknown-item' }
  | { kind: 'not-enough-gold'; need: number; have: number };

/**
 * Attempt to buy a cart item by key. Validates that Pip is open and
 * the player can afford it, then deducts gold and grants the item.
 */
export function buyFromCart(
  player: Player,
  px: number,
  py: number,
  time: TimeOfDay,
  itemKey: string,
): CartBuyOutcome {
  if (!cartOpen(time)) return { kind: 'closed' };
  if (!nearCart(px, py)) return { kind: 'too-far' };
  const item = CART_CATALOG.find((i) => i.key === itemKey);
  if (!item) return { kind: 'unknown-item' };
  if (player.gold < item.buyPrice) {
    return { kind: 'not-enough-gold', need: item.buyPrice, have: player.gold };
  }
  player.gold -= item.buyPrice;
  player.inventory[item.key] = (player.inventory[item.key] ?? 0) + 1;
  return { kind: 'bought', item, remainingGold: player.gold };
}

/** Pretty label for the dawn arrival toast. */
export function cartArrivalLine(): string {
  return 'Pip the Peddler is in town today (09-18 by the well).';
}
