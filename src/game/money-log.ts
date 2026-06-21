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
