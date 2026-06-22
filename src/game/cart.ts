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
import { DECOR_CATALOG, buyDecor, ownsDecor, type DecorBuyOutcome } from './decor';
import {
  SPA_PASS_INVENTORY_KEY,
  SPA_PASS_PRICE,
  SPA_PASS_PUNCHES,
  SPA_PASS_REFILL_PRICE,
  getBath,
  getSpaPass,
} from './bath-house';
import { BAROMETER_INVENTORY_KEY, BAROMETER_PRICE } from './barometer';
import { BREEDER_EGG_INVENTORY_KEY, FANCY_EGG_SELL_PRICE } from './coop';
import { POND_MAX_PENDING_RIM, POND_RIM_INVENTORY_KEY, POND_RIM_PRICE } from './fish-pond';

/** Synthetic CART_CATALOG key for the spa-pass refill row. Not stored
 *  in the player's inventory — purchasing it credits punches directly
 *  via SPA_PASS_PUNCHES on the spa-pass pool. */
export const SPA_PASS_REFILL_KEY = 'spa-pass-refill';

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
  {
    key: SPA_PASS_INVENTORY_KEY,
    label: 'Spa Pass (punch card)',
    buyPrice: SPA_PASS_PRICE,
    flavor: `${SPA_PASS_PUNCHES} free soaks at the bath house. Auto-redeems on first use.`,
  },
  {
    key: SPA_PASS_REFILL_KEY,
    label: 'Spa Pass Refill',
    buyPrice: SPA_PASS_REFILL_PRICE,
    flavor: `${SPA_PASS_PUNCHES} more punches on your spa pass. Cheaper than a fresh card — only sells once your pass is empty.`,
  },
  {
    key: BAROMETER_INVENTORY_KEY,
    label: 'Brass Barometer',
    buyPrice: BAROMETER_PRICE,
    flavor: 'Mount on the porch. Forecast strip reaches two days ahead.',
  },
  {
    key: POND_RIM_INVENTORY_KEY,
    label: 'Stone-Rim Pond Kit',
    buyPrice: POND_RIM_PRICE,
    flavor: `Lay stones around the pond. Pending fish cap rises to ${POND_MAX_PENDING_RIM}.`,
  },
  // Decor pieces — buyable wallpaper + floor packs that retint the
  // farmhouse exterior. Each row mirrors a DECOR_CATALOG entry so the
  // cart UI lists them alongside Pip's other premium goods.
  ...DECOR_CATALOG.map((d) => ({
    key: `decor-${d.key}`,
    label: `${d.label} (decor)`,
    buyPrice: d.price,
    flavor: d.flavor,
  })),
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
  | { kind: 'refilled'; item: CartItem; remainingGold: number; punches: number }
  | { kind: 'refill-not-eligible'; reason: 'no-pass' | 'still-has-punches' }
  | { kind: 'already-owned'; item: CartItem }
  | { kind: 'closed' }
  | { kind: 'too-far' }
  | { kind: 'unknown-item' }
  | { kind: 'not-enough-gold'; need: number; have: number };

/**
 * True iff the player has redeemed a spa pass before AND is currently
 * out of punches. The refill is intentionally gated by these BOTH so:
 *   - a fresh-game player can't skip the loyalty-card price by buying
 *     the cheaper refill straight off the bat;
 *   - a player who still has punches can't double-stack and end up
 *     with >SPA_PASS_PUNCHES uncommitted soaks (the punches pool
 *     would tolerate it, but visually a fresh refill on top of an
 *     unused card reads as accidental over-spend).
 *
 * "Has redeemed a pass before" is detected by checking the bath
 * state's totalSoaks AND that the player has no unredeemed pass in
 * the bag — equivalent to "has actually used the bath house and the
 * bag is bare". A bath state with at least one paid-with-pass soak
 * is the stronger signal but more fragile across reload, so we use
 * the looser "has soaked at all" check.
 */
export function canRefillSpaPass(player: Player): boolean {
  const bag = player.inventory[SPA_PASS_INVENTORY_KEY] ?? 0;
  if (bag > 0) return false;
  if (getSpaPass(player).punchesLeft > 0) return false;
  const bath = getBath(player);
  return (bath.totalSoaks ?? 0) > 0;
}

/**
 * Attempt to buy a cart item by key. Validates that Pip is open and
 * the player can afford it, then deducts gold and grants the item.
 *
 * Items whose key starts with `decor-` are routed through the decor
 * module instead of the bag — they unlock a piece of farmhouse
 * cosmetics and auto-apply it.
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
  // Barometer is a singleton — short-circuit a re-buy.
  if (itemKey === BAROMETER_INVENTORY_KEY && (player.inventory[BAROMETER_INVENTORY_KEY] ?? 0) > 0) {
    return { kind: 'already-owned', item };
  }
  // Stone-rim pond kit is a singleton — short-circuit a re-buy.
  if (itemKey === POND_RIM_INVENTORY_KEY && (player.inventory[POND_RIM_INVENTORY_KEY] ?? 0) > 0) {
    return { kind: 'already-owned', item };
  }
  // Spa pass refill — special-case path. Credits punches directly
  // into the spa-pass pool (no inventory key), gated by canRefillSpaPass
  // so a fresh-game player can't shortcut the full loyalty-card price.
  if (itemKey === SPA_PASS_REFILL_KEY) {
    const bag = player.inventory[SPA_PASS_INVENTORY_KEY] ?? 0;
    const pool = getSpaPass(player);
    const bath = getBath(player);
    if (bag > 0 || pool.punchesLeft > 0) {
      return { kind: 'refill-not-eligible', reason: 'still-has-punches' };
    }
    if ((bath.totalSoaks ?? 0) <= 0) {
      return { kind: 'refill-not-eligible', reason: 'no-pass' };
    }
    player.gold -= item.buyPrice;
    pool.punchesLeft += SPA_PASS_PUNCHES;
    return {
      kind: 'refilled',
      item,
      remainingGold: player.gold,
      punches: pool.punchesLeft,
    };
  }
  if (itemKey.startsWith('decor-')) {
    const decorKey = itemKey.slice('decor-'.length);
    // Already owned -> short-circuit so the player doesn't accidentally
    // double-spend on the same wallpaper.
    if (ownsDecor(player, decorKey)) {
      return { kind: 'already-owned', item };
    }
    const out: DecorBuyOutcome = buyDecor(player, decorKey);
    if (out.kind === 'bought') {
      return { kind: 'bought', item, remainingGold: out.remainingGold };
    }
    if (out.kind === 'not-enough-gold') {
      return { kind: 'not-enough-gold', need: out.need, have: out.have };
    }
    return { kind: 'unknown-item' };
  }
  player.gold -= item.buyPrice;
  player.inventory[item.key] = (player.inventory[item.key] ?? 0) + 1;
  return { kind: 'bought', item, remainingGold: player.gold };
}

/** Pretty label for the dawn arrival toast. */
export function cartArrivalLine(): string {
  return 'Pip the Peddler is in town today (09-18 by the well).';
}

// ---------------------------------------------------------------------
// Breeder egg trade-in — Pip pays double the fancy-egg sell price for
// any breeder eggs the player walks up to the cart with. Triggers
// automatically on cart-menu open so the player never has to learn a
// new keybind, and it stays revertible by paying out 0 + a no-op toast
// when no eggs are on hand.
// ---------------------------------------------------------------------

/**
 * Multiplier on FANCY_EGG_SELL_PRICE Pip pays per breeder egg.
 *
 * Sets the cart trade-in to 2x the well's fancy-egg sell price. Tuned
 * to feel rewarding without dwarfing the hatchery path (a breeder
 * hatches a guaranteed heritage chick — that's still a stronger
 * long-run play than the gold).
 */
export const BREEDER_TRADEIN_MULTIPLIER = 2;

/** Per-egg gold Pip pays at the cart trade-in. */
export const BREEDER_TRADEIN_PRICE = FANCY_EGG_SELL_PRICE * BREEDER_TRADEIN_MULTIPLIER;

/** Outcome of a trade-in attempt. */
export type BreederTradeInOutcome =
  | { kind: 'traded'; eggs: number; gold: number; remainingGold: number }
  | { kind: 'none' }
  | { kind: 'closed' }
  | { kind: 'too-far' };

/**
 * Try to trade every breeder egg in the player's bag to Pip for
 * BREEDER_TRADEIN_PRICE gold each. Gated by cart-open + adjacency
 * exactly like buyFromCart so the trade can't happen off-hours or
 * from across the village.
 *
 * Returns 'none' when the bag is empty — the cart-menu open hook
 * checks this first so a no-op trade doesn't toast.
 */
export function tradeBreederEggs(
  player: Player,
  px: number,
  py: number,
  time: TimeOfDay,
): BreederTradeInOutcome {
  if (!cartOpen(time)) return { kind: 'closed' };
  if (!nearCart(px, py)) return { kind: 'too-far' };
  const have = player.inventory[BREEDER_EGG_INVENTORY_KEY] ?? 0;
  if (have <= 0) return { kind: 'none' };
  const gold = have * BREEDER_TRADEIN_PRICE;
  player.inventory[BREEDER_EGG_INVENTORY_KEY] = 0;
  player.gold += gold;
  return { kind: 'traded', eggs: have, gold, remainingGold: player.gold };
}

/** Pretty toast for the trade-in confirmation. */
export function breederTradeInLine(out: Extract<BreederTradeInOutcome, { kind: 'traded' }>): string {
  return `Pip eyes the breeder egg${out.eggs === 1 ? '' : 's'} — pays you ${out.gold}g for ${out.eggs}.`;
}
