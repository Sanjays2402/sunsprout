// Roving merchant rumor — Pip drops a deterministic hint each visit
// about the catalog row he plans to feature on his NEXT visit. The
// rumor is computed from (current season + 1) so the player can plan a
// gold pile across the season ahead without having to scrub-save.
//
// Wiring intent:
//   - dawn toast on Pip's visit day appends "Pip says: '<rumor>'"
//   - the cart menu footer shows "Next season's headliner: <label>"
//
// Mechanics intent:
//   - the hint references the SAME catalog Pip would normally sell;
//     no separate "rumor catalog" so players never feel teased into a
//     "look but can't buy" item.
//   - rumors rotate per season — the same season always picks the same
//     row, so reload-scumming a particular visit doesn't change it.
//   - decor rows (`decor-...`) are filtered out — the player has only
//     a few decor pieces and re-headlining the same wallpaper across
//     two consecutive seasons feels stale.
//   - the rumor row may or may not match what Pip's catalog actually
//     "features" — there's no upcharge or limited stock today. The
//     hint is pure flavor + light planning aid.
//
// Pure module: no IO, no canvas. The Game wires the dawn toast tail;
// the CartMenu draws the footer line.

import { CART_CATALOG, SPA_PASS_REFILL_KEY } from './cart';
import type { CartItem } from './cart';

/**
 * Deterministic hash mix of a season index into a [0..N) bucket.
 * Pulled out so tests can assert determinism without re-importing the
 * private constant. Pure 32-bit avalanche.
 */
function rumorHash(season: number): number {
  let h = ((season + 1) * 1903911167) ^ 0xdeadbeef;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Returns the CartItem Pip will tease THIS visit (i.e. the headliner
 * for his next visit, which lands in `season + 1`). Skips decor rows
 * so the same wallpaper doesn't headline two seasons in a row.
 *
 * Empty pool would never happen with the real catalog, but the guard
 * keeps tests happy if a future catalog change ever drops every
 * non-decor row.
 */
export function rumorItemForSeason(season: number): CartItem | null {
  // Pool of non-decor rows. Sort by key so the indexing stays stable
  // regardless of CART_CATALOG declaration order. Filters out the
  // spa-pass-refill row too — that row is gated by canRefillSpaPass()
  // and a fresh-game player who never bought a pass would see Pip
  // headline an item they're not allowed to buy. Decor rows already
  // get the same treatment for the wallpaper-spam reason.
  const pool = CART_CATALOG
    .filter((row) => !row.key.startsWith('decor-') && row.key !== SPA_PASS_REFILL_KEY)
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key));
  if (pool.length === 0) return null;
  const idx = rumorHash((season + 1) % 4) % pool.length;
  return pool[idx];
}

/**
 * The headliner Pip teased on the PREVIOUS visit — i.e. the one he
 * promised to "lead with" this season. Used by the gold-back perk:
 * buying THIS row at the cart pays a 5% rebate because the player
 * showed up for what Pip pre-announced.
 *
 * `season + 3` is congruent to `season - 1` mod 4, which feeds the
 * same `(season + 1) % 4` term used by rumorItemForSeason — keeps
 * the wraparound math single-sourced.
 */
export function currentSeasonHeadliner(season: number): CartItem | null {
  return rumorItemForSeason(season + 3);
}

/** True iff `itemKey` matches the headliner Pip teased last visit. */
export function isCurrentHeadlinerKey(season: number, itemKey: string): boolean {
  const headliner = currentSeasonHeadliner(season);
  return headliner !== null && headliner.key === itemKey;
}

/**
 * Percentage of the buy price refunded when the player buys the
 * headliner. 5% is enough to feel like a reward for paying attention,
 * not enough to make the headliner the only sensible buy each season.
 */
export const RUMOR_REBATE_PCT = 0.05;

/** Gold rebate (rounded down) for a buy of `buyPrice` on the headliner. */
export function rumorRebateAmount(buyPrice: number): number {
  return Math.floor(buyPrice * RUMOR_REBATE_PCT);
}

/**
 * Returns the headliner label Pip wants to tease this visit. Returns
 * an empty string when there's no eligible row.
 */
export function rumorHeadlineLabelFor(season: number): string {
  const row = rumorItemForSeason(season);
  return row ? row.label : '';
}

/**
 * Pretty in-quote rumor line for the dawn toast. Returns an empty
 * string when the pool is empty.
 */
export function rumorToastLine(season: number): string {
  const row = rumorItemForSeason(season);
  if (!row) return '';
  return `Pip says: "Eyes on the ${row.label} next season — I'll lead with it."`;
}

/** Pretty footer line for the cart menu. */
export function rumorFooterLine(season: number): string {
  const row = rumorItemForSeason(season);
  if (!row) return '';
  return `Next visit's headliner: ${row.label}`;
}
