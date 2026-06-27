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

/**
 * Per-category totals across the whole logged window, derived through
 * classifyMoneyEntry so the breakdown always agrees with the per-row
 * colour rail. `sales` + `rewards` are positive inflows by category;
 * `spent` is the absolute outflow (always >= 0). The three are disjoint
 * and sum back to the gross flow: sales + rewards == totalIn, spent ==
 * totalOut. Pure — reads only the log.
 */
export interface MoneyCategoryTotals {
  sales: number;
  rewards: number;
  spent: number;
}

export function moneyCategoryTotals(player: Player): MoneyCategoryTotals {
  const totals: MoneyCategoryTotals = { sales: 0, rewards: 0, spent: 0 };
  for (const e of getMoneyLog(player)) {
    const cat = classifyMoneyEntry(e);
    if (cat === 'purchase') totals.spent += Math.abs(e.delta);
    else if (cat === 'sale') totals.sales += e.delta;
    else totals.rewards += e.delta;
  }
  return totals;
}

/**
 * A run of consecutive same-day ledger rows, for the panel's day dividers.
 * `net` is the signed sum of the run's deltas so the divider can carry a
 * tiny per-day subtotal ("Day 4   +85g").
 */
export interface MoneyLogDayGroup {
  day: number;
  net: number;
  entries: MoneyLogEntry[];
}

/**
 * Group the (newest-first) ledger into runs of consecutive same-day rows
 * so the panel can draw a small "Day N" divider above each run and the
 * ledger reads as dated buckets instead of one flat list. Because the log
 * is appended in chronological order (newest unshifted to the front) and
 * trimmed from the back, same-day rows are always contiguous, so a simple
 * consecutive-run split is correct — and stays robust if days ever
 * interleave (it just starts a new group). Each group carries its signed
 * net so the divider can show a per-day subtotal. Pure — reads only the
 * log; preserves the newest-first order.
 */
export function moneyLogDayGroups(player: Player): MoneyLogDayGroup[] {
  return groupMoneyEntriesByDay(getMoneyLog(player));
}

/**
 * Group an arbitrary (newest-first) entry list into consecutive same-day
 * runs — the reusable core behind moneyLogDayGroups, split out so the
 * panel can group a FILTERED slice of the ledger without the run-split
 * logic being duplicated. Pure; preserves input order.
 */
export function groupMoneyEntriesByDay(
  entries: readonly MoneyLogEntry[],
): MoneyLogDayGroup[] {
  const groups: MoneyLogDayGroup[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.day === e.day) {
      last.entries.push(e);
      last.net += e.delta;
    } else {
      groups.push({ day: e.day, net: e.delta, entries: [e] });
    }
  }
  return groups;
}

/**
 * Panel-local ledger filter so the player can answer "where did my gold
 * GO this week" without scanning a mixed list. Cycles all -> sales ->
 * rewards -> spending, each isolating one classifyMoneyEntry bucket (all
 * shows everything). The Q panel is non-blocking but has no movement
 * verbs, so a panel-local `f` cycle is safe (the global fishing `f` is
 * still guarded against it like the lore / almanac filters).
 */
export type MoneyFilter = 'all' | 'sales' | 'rewards' | 'spending';

/** Cycle order for the `f` keypress. */
export const MONEY_FILTERS: readonly MoneyFilter[] = [
  'all',
  'sales',
  'rewards',
  'spending',
] as const;

/** Advance to the next filter, wrapping at the end. Pure. */
export function cycleMoneyFilter(f: MoneyFilter): MoneyFilter {
  const i = MONEY_FILTERS.indexOf(f);
  return MONEY_FILTERS[(i + 1) % MONEY_FILTERS.length];
}

/** Short chip label for the active filter. Pure. */
export function moneyFilterLabel(f: MoneyFilter): string {
  return f; // 'all' / 'sales' / 'rewards' / 'spending' read fine as-is.
}

/** Map a filter to the classifyMoneyEntry category it isolates, or null for 'all'. */
function filterCategory(f: MoneyFilter): MoneyCategory | null {
  switch (f) {
    case 'sales':
      return 'sale';
    case 'rewards':
      return 'reward';
    case 'spending':
      return 'purchase';
    case 'all':
      return null;
  }
}

/**
 * Filter a ledger slice to the rows matching the active filter, classified
 * through classifyMoneyEntry so it always agrees with the per-row colour
 * rail. 'all' returns the input untouched (a new array for caller safety).
 * Pure.
 */
export function applyMoneyFilter(
  entries: readonly MoneyLogEntry[],
  filter: MoneyFilter,
): MoneyLogEntry[] {
  const cat = filterCategory(filter);
  if (cat === null) return entries.slice();
  return entries.filter((e) => classifyMoneyEntry(e) === cat);
}
