// Mining haul tally — what gems the player has pulled out of the
// cave so far on the current "run".
//
// "Run" here means "since you last slept". The player heads down to
// the cave entrance, strikes ore until they're out of stamina, then
// either drinks a tea or walks home. A tally that resets on sleep
// gives the player a clean ledger of "how productive was today's
// expedition" — useful both for celebrating a fat run (5 rubies in
// a morning!) and for spotting a frustrating one (8 strikes, all
// copper, time to swap pickaxe).
//
// Pure module: no IO, no canvas. The engine bumps the tally on
// every successful strike (via recordMined()) and resets it on
// sleep (via resetMineHaul()). The dawn toast surfaces the prior
// run's totals as a "yesterday's haul:" tail, and the bath-house /
// sleep summary can also read the running totals.
//
// Why a dedicated module rather than a field on Player.inventory:
// inventory is what's IN your bag; the haul tally has to survive a
// well-sell that empties the bag mid-day, so it's its own counter.

import type { Player } from '../world/world';
import type { GemKey } from './gems';
import { GEMS, GEM_KEYS } from './gems';

/** Per-(GemKey) tally of how many of that gem the player has mined this run. */
export interface MineHaulState {
  /**
   * Map of GemKey -> count mined this run. Missing keys mean 0; we
   * store only nonzero entries so a fresh save's tally object stays
   * empty and serialises tightly.
   */
  counts: Partial<Record<GemKey, number>>;
  /**
   * Tally of the PREVIOUS run — captured at sleep time so the dawn
   * toast can read "Yesterday's haul: ...". Reset to a fresh shape
   * (empty counts + 0 gold) on a save that's never slept.
   */
  lastRun: {
    counts: Partial<Record<GemKey, number>>;
    /** Sum of GEMS[k].sellPrice * counts[k] at sleep time. */
    gold: number;
  };
  /**
   * Lifetime per-gem tally — never resets, separate from `counts` so
   * the "what did I mine today" recap stays clean while a parallel
   * career counter accrues. Bumped alongside `counts` on every
   * recordMined call. Optional because older saves predate it; the
   * lazy reader fills it on first read.
   */
  lifetimeCounts?: Partial<Record<GemKey, number>>;
}

/** Threshold for the lifetime-mining achievement / "Rockhound II". */
export const LIFETIME_MINING_MILESTONE = 100;

/** Lazy reader on the Player. */
export function getMineHaul(player: Player): MineHaulState {
  const p = player as Player & { mineHaul?: MineHaulState };
  if (!p.mineHaul) {
    p.mineHaul = { counts: {}, lastRun: { counts: {}, gold: 0 }, lifetimeCounts: {} };
  }
  // Older saves predate the lifetime field — backfill so reads are safe.
  if (!p.mineHaul.lifetimeCounts) p.mineHaul.lifetimeCounts = {};
  return p.mineHaul;
}

/**
 * Bump the haul tally by one for `gem`. Called from the engine's
 * mining strike branch right after a strike lands and the inventory
 * is credited. Bumps BOTH the current-run count and the lifetime
 * counter so the career milestone never has to be reconstructed.
 */
export function recordMined(player: Player, gem: GemKey): void {
  const state = getMineHaul(player);
  state.counts[gem] = (state.counts[gem] ?? 0) + 1;
  state.lifetimeCounts = state.lifetimeCounts ?? {};
  state.lifetimeCounts[gem] = (state.lifetimeCounts[gem] ?? 0) + 1;
}

/**
 * Total gems mined this run, across all gem types.
 */
export function haulCount(state: MineHaulState): number {
  let n = 0;
  for (const k of GEM_KEYS) n += state.counts[k] ?? 0;
  return n;
}

/**
 * Sum of GEMS[k].sellPrice * count for every gem in the haul. Pure
 * read — doesn't care whether the player has actually sold the haul
 * or is still carrying it, so the number on the toast matches the
 * "what could you get for this" calculation the player makes in their
 * head.
 */
export function haulGold(state: MineHaulState): number {
  let g = 0;
  for (const k of GEM_KEYS) g += (state.counts[k] ?? 0) * GEMS[k].sellPrice;
  return g;
}

/**
 * Lifetime total gems mined across the player's career, across all
 * gem types. Backed by lifetimeCounts which is bumped on every
 * recordMined call.
 */
export function lifetimeHaulCount(state: MineHaulState): number {
  const life = state.lifetimeCounts ?? {};
  let n = 0;
  for (const k of GEM_KEYS) n += life[k] ?? 0;
  return n;
}

/**
 * Lifetime gem-sell value: sum of GEMS[k].sellPrice * lifetimeCounts[k].
 * Useful for an "all-time-haul" tag in the lore panel without storing
 * a redundant gold field.
 */
export function lifetimeHaulGold(state: MineHaulState): number {
  const life = state.lifetimeCounts ?? {};
  let g = 0;
  for (const k of GEM_KEYS) g += (life[k] ?? 0) * GEMS[k].sellPrice;
  return g;
}

/**
 * True iff the lifetime tally has crossed the LIFETIME_MINING_MILESTONE
 * threshold. Wired into the achievements catalog.
 */
export function lifetimeMiningMilestoneReached(state: MineHaulState): boolean {
  return lifetimeHaulCount(state) >= LIFETIME_MINING_MILESTONE;
}

/**
 * Snapshot the current run into lastRun and clear the running
 * tally. Called from the sleep path so "yesterday's haul" reads
 * the run the player just slept off, not the one they're starting.
 *
 * Returns the previous run's totals as a convenience to callers that
 * want to surface a "you mined N gems for Xg yesterday" toast right
 * after sleep without a second helper call.
 */
export function resetMineHaul(player: Player): {
  counts: Partial<Record<GemKey, number>>;
  gold: number;
  total: number;
} {
  const state = getMineHaul(player);
  const counts = { ...state.counts };
  const gold = haulGold(state);
  const total = haulCount(state);
  state.lastRun = { counts, gold };
  state.counts = {};
  return { counts, gold, total };
}

/**
 * Pretty status line for the dawn toast. Returns the empty string
 * when the player didn't mine anything yesterday so the dawn toast
 * stays uncluttered on quiet days.
 *
 * Wording: "Yesterday's haul: 3 copper, 1 ruby (worth 164g)."
 */
export function haulYesterdayLine(state: MineHaulState): string {
  const { counts, gold } = state.lastRun;
  let total = 0;
  for (const k of GEM_KEYS) total += counts[k] ?? 0;
  if (total === 0) return '';
  const parts: string[] = [];
  // Walk GEM_KEYS in catalog order so the line reads consistently.
  for (const k of GEM_KEYS) {
    const c = counts[k] ?? 0;
    if (c > 0) parts.push(`${c} ${GEMS[k].name.toLowerCase()}`);
  }
  return `Yesterday's mine haul: ${parts.join(', ')} (worth ${gold}g).`;
}

/**
 * Pretty status line for the running haul — shown when the player
 * presses E at the cave entrance to peek at the day so far. Empty
 * when nothing has been mined yet.
 */
export function haulStatusLine(state: MineHaulState): string {
  const total = haulCount(state);
  if (total === 0) return 'Today\'s haul is empty. Strike some ore.';
  const gold = haulGold(state);
  const parts: string[] = [];
  for (const k of GEM_KEYS) {
    const c = state.counts[k] ?? 0;
    if (c > 0) parts.push(`${c} ${GEMS[k].name.toLowerCase()}`);
  }
  return `Today's haul: ${parts.join(', ')} (worth ${gold}g).`;
}

// ---------------------------------------------------------------------
// Mid-run milestone callouts — when the player crosses an interesting
// total gem count this run, surface a fleeting toast so the player
// gets celebratory feedback without having to walk back to the dawn
// recap. Pure helpers; the engine layer reads previous-count and
// current-count and asks `crossedMilestone(prev, next)` for the
// matching tier, then surfaces a toast.
//
// Why tiered rather than a generic "every 5 gems": the gem economy
// rewards rare gems much more than copper. The tiers are tuned around
// the median per-gem sell price so 3 / 6 / 10 maps to "starting to
// score", "solid morning", "outright fat run". The toast uses
// haulStatusLine() so the player sees the SPECIFIC composition that
// just crossed the bar.
// ---------------------------------------------------------------------

/** Tier thresholds — counts (not gold). Stable order, smallest first. */
export const MINING_RUN_MILESTONES = [3, 6, 10] as const;
export type MiningRunMilestone = (typeof MINING_RUN_MILESTONES)[number];

/** Per-tier label injected into the toast. */
const MILESTONE_LABEL: Record<MiningRunMilestone, string> = {
  3: 'Solid start',
  6: 'Run going strong',
  10: 'Fat haul',
};

/**
 * True iff (prev, next) brackets one of MINING_RUN_MILESTONES — i.e.
 * the player has just crossed a milestone count this strike. Returns
 * the crossed tier or null. When multiple tiers are crossed in a
 * single bump (impossible with the existing +1-per-strike loop but
 * defended for safety), returns the HIGHEST crossed tier.
 *
 * Pure — doesn't read state, doesn't bump counts.
 */
export function crossedMilestone(prev: number, next: number): MiningRunMilestone | null {
  let hit: MiningRunMilestone | null = null;
  for (const tier of MINING_RUN_MILESTONES) {
    if (prev < tier && next >= tier) hit = tier;
  }
  return hit;
}

/**
 * Pretty toast for a milestone cross. Pairs the label with the
 * current haul status line so the player sees both "Run going
 * strong!" and "today's haul: 4 copper, 2 ruby (worth 218g)" in
 * one message. Returns the empty string when no milestone crossed.
 */
export function milestoneToastLine(
  state: MineHaulState,
  milestone: MiningRunMilestone | null,
): string {
  if (milestone === null) return '';
  const status = haulStatusLine(state);
  return `${MILESTONE_LABEL[milestone]}! ${status}`;
}

// ---------------------------------------------------------------------
// Mid-run GOLD milestone callouts — pair the count milestones above
// with a parallel gold-value tier so a pure-iron grind (low count,
// high gold) still surfaces a celebration as the haul value swells.
//
// Why the gold pair: the count milestones are great for "I'm still
// in the cave, gimme dopamine" — but a player striking iron after
// iron after iron can spend a long stretch under 3 gems while the
// gold value runs past 200g. The gold callout closes that gap so
// "fat haul, ALL of it copper" and "fat haul, two cave rubies"
// both light up the strike toast.
//
// The two milestone systems are independent — a single strike CAN
// cross both the count tier AND the gold tier in the same bump
// (rare gem on the 6th-gem strike). The engine layer composes both
// tails onto the strike toast; the gold tail follows the count tail
// so display order matches "count first, value second".
//
// Tiers tuned around the median per-gem sell value (copper=12g) so
// 100g lands roughly when the count tier 6 fires for a balanced
// haul; 250g lands when the haul is rich with iron/silver; 500g
// captures the late-game "ruby spike" most pure-quantity haul
// graphs never reach.
// ---------------------------------------------------------------------

/** Tier thresholds — haul gold value. Stable order, smallest first. */
export const MINING_RUN_GOLD_MILESTONES = [100, 250, 500] as const;
export type MiningRunGoldMilestone = (typeof MINING_RUN_GOLD_MILESTONES)[number];

/** Per-tier label injected into the gold-milestone toast. */
const GOLD_MILESTONE_LABEL: Record<MiningRunGoldMilestone, string> = {
  100: 'Pockets clinking',
  250: 'Now we\'re cooking',
  500: 'Cart\'s full',
};

/**
 * True iff (prev, next) brackets one of MINING_RUN_GOLD_MILESTONES — i.e.
 * the player has just crossed a gold-value milestone this strike. Returns
 * the crossed tier or null. When multiple tiers are crossed in a single
 * bump (rare gem lifts the value over two tiers at once), returns the
 * HIGHEST crossed tier so the celebration matches the biggest leap.
 *
 * Pure — doesn't read state, doesn't bump counts.
 */
export function crossedGoldMilestone(
  prev: number,
  next: number,
): MiningRunGoldMilestone | null {
  let hit: MiningRunGoldMilestone | null = null;
  for (const tier of MINING_RUN_GOLD_MILESTONES) {
    if (prev < tier && next >= tier) hit = tier;
  }
  return hit;
}

/**
 * Pretty toast for a gold milestone cross. Pairs the label with the
 * current haul gold value so the player sees both "Pockets clinking!"
 * and "haul value: 124g" in one message. Returns the empty string
 * when no tier crossed.
 *
 * Wording is deliberately distinct from the count tiers ("solid
 * start" / "fat haul") so when both fire at once the player sees
 * two clearly different celebrations rather than redundant phrasing.
 */
export function goldMilestoneToastLine(
  state: MineHaulState,
  milestone: MiningRunGoldMilestone | null,
): string {
  if (milestone === null) return '';
  const gold = haulGold(state);
  return `${GOLD_MILESTONE_LABEL[milestone]}! Haul value: ${gold}g.`;
}
