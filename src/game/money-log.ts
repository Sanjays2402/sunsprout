// Money log — a small ring-buffer of the player's most recent gold deltas.
//
// The player's bank account never had any audit trail before. This module
// lets the engine layer record "I just paid you 12g for two wheats" or
// "I just charged you 200g for a bouquet" so the player can open the
// money log (`Q`) and see where the day's coin came from.
//
// We store at most `MAX_ENTRIES` rows in a ring buffer on the Player so
// the log stays tiny in saves. Each row is a JSON-safe object — no
// dates, no Map shenanigans.

import type { Player } from '../world/world';

/** Cap so the log never balloons in old saves. */
export const MAX_ENTRIES = 20;

/** One row in the log. Reason is a short tag the UI can colour-code. */
export interface MoneyLogEntry {
  delta: number;
  reason: string;
  /** In-game day the delta posted. */
  day: number;
}

/** Lazy accessor — creates an empty log on first read. */
export function getMoneyLog(player: Player): MoneyLogEntry[] {
  const p = player as Player & { moneyLog?: MoneyLogEntry[] };
  if (!p.moneyLog) p.moneyLog = [];
  return p.moneyLog;
}

/**
 * Record a delta. Positive numbers are credits (you earned), negative
 * are debits (you spent). Zero-amount calls are no-ops.
 *
 * The newest entry sits at the FRONT of the array so UI rendering is
 * trivial (no extra reverse pass). When the log grows past MAX_ENTRIES
 * we trim from the back.
 */
export function logGold(player: Player, delta: number, reason: string, day: number): void {
  if (delta === 0) return;
  const log = getMoneyLog(player);
  log.unshift({ delta, reason, day });
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
}

/** Total inflow recorded in the log (positive deltas summed). */
export function totalIn(player: Player): number {
  return getMoneyLog(player).reduce((s, e) => s + Math.max(0, e.delta), 0);
}

/** Total outflow recorded in the log (absolute of negative deltas). */
export function totalOut(player: Player): number {
  return getMoneyLog(player).reduce((s, e) => s + Math.max(0, -e.delta), 0);
}

/** Net change recorded in the log. */
export function netChange(player: Player): number {
  return totalIn(player) - totalOut(player);
}

/**
 * Coarse category for a ledger row, used by the money-log panel to draw a
 * per-row colour rail so a busy ledger scans by hue the way the toast
 * stack does. Three buckets:
 *   - `purchase`: money leaving the purse (shop buys, upgrades, soaks,
 *     owl fees, auto-restock). Every spend in the current economy posts a
 *     negative delta, so the sign alone identifies it unambiguously.
 *   - `sale`: a direct goods-sale at a counter (the well, the inn) or the
 *     fishing / mining grade bonus / cart breeder trade-in — income you
 *     earned by handing over produce.
 *   - `reward`: any other credit — streak tips, spouse/hangout gifts,
 *     board + tournament + quest payouts, compost recycle, rumor rebates.
 */
export type MoneyCategory = 'sale' | 'purchase' | 'reward';

/**
 * Reason prefixes that mark a positive delta as a direct goods-sale
 * rather than a reward. Anchored at the start so e.g. "cart: rumor rebate"
 * (a reward) doesn't get swept in by a loose "cart" match — only the
 * literal "cart: breeder trade" sale-back is a sale.
 */
const SALE_REASON_PATTERNS: readonly RegExp[] = [
  /^well:/,
  /^inn:/,
  /^fishing /,
  /^mining /,
  /^cart: breeder trade/,
];

/**
 * Classify a single ledger entry into its colour-rail bucket. Pure: reads
 * only the entry's signed delta + reason text, no player state.
 */
export function classifyMoneyEntry(entry: MoneyLogEntry): MoneyCategory {
  // Money out is always a purchase/spend in the current economy.
  if (entry.delta < 0) return 'purchase';
  // Money in: a counter goods-sale, else a reward/tip/payout.
  for (const re of SALE_REASON_PATTERNS) {
    if (re.test(entry.reason)) return 'sale';
  }
  return 'reward';
}
