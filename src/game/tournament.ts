// Friendship tournament — a seasonal village competition.
//
// Once per season on day 6 (the day before each festival), the village
// hosts a friendly contest at the well. The kind rotates with the
// season:
//
//   Spring -> Flower Show       (count `flower_harvest`)
//   Summer -> Fishing Derby     (count every `fish-*` in the bag)
//   Fall   -> Harvest Weigh-In  (count every `_harvest`)
//   Winter -> Cooking Cook-Off  (count every `dish-*`)
//
// The contest runs 14:00-18:00. The player walks to the well in that
// window and presses E to ENTER — the count is read RIGHT THEN (the
// items stay in their bag, that's a feature, not a bug). The score
// is compared to fixed thresholds:
//
//   Bronze (>=  3)  → +100g + bronze ribbon
//   Silver (>=  8)  → +250g + silver ribbon
//   Gold   (>= 18)  → +500g + gold ribbon
//
// A player can enter ONCE per tournament. Re-entering the same season
// shows a "you already won X" toast instead of paying twice.
//
// Pure module: no IO, no canvas. The engine wires the E-press at the
// well + a dawn toast on day 6 announcing the day's event.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { CROPS, CROP_KEYS } from './crops';
import { FISH_KEYS } from './fish';
import { RECIPE_KEYS, dishInventoryKey } from './cooking';

/** Day of the season the tournament runs. */
export const TOURNAMENT_DAY = 6;
/** Hours the contest is open at the well. */
export const TOURNAMENT_OPEN_HOUR = 14;
export const TOURNAMENT_CLOSE_HOUR = 18;

/** Tournament kinds keyed by season index. */
export const TOURNAMENT_KINDS = ['flower-show', 'fishing-derby', 'harvest-weigh-in', 'cook-off'] as const;
export type TournamentKind = (typeof TOURNAMENT_KINDS)[number];

/** Pretty label per kind for toasts and the future panel. */
export const TOURNAMENT_LABELS: Record<TournamentKind, string> = {
  'flower-show': 'Spring Flower Show',
  'fishing-derby': 'Summer Fishing Derby',
  'harvest-weigh-in': 'Fall Harvest Weigh-In',
  'cook-off': 'Winter Cooking Cook-Off',
};

/** Inventory key of the trophy ribbon for each tier. */
export const RIBBONS = {
  bronze: 'ribbon-bronze',
  silver: 'ribbon-silver',
  gold: 'ribbon-gold',
} as const;

export type RibbonTier = keyof typeof RIBBONS;

/** Thresholds the player must clear for each tier. Tuned cozy. */
export const TIER_THRESHOLD: Record<RibbonTier, number> = {
  bronze: 3,
  silver: 8,
  gold: 18,
};

/** Gold paid per tier. */
export const TIER_GOLD: Record<RibbonTier, number> = {
  bronze: 100,
  silver: 250,
  gold: 500,
};

/** Per-Player record of past entries. */
export interface TournamentState {
  /** Map: `${season}-${kind}` -> { day, tier, score }. */
  entries: Record<string, { day: number; tier: RibbonTier | 'none'; score: number }>;
}

/** Lazy reader. */
export function getTournament(player: Player): TournamentState {
  const p = player as Player & { tournament?: TournamentState };
  if (!p.tournament) p.tournament = { entries: {} };
  return p.tournament;
}

/** Pick the day's tournament kind from the season index. */
export function tournamentKindToday(time: TimeOfDay): TournamentKind | null {
  if (time.day !== TOURNAMENT_DAY) return null;
  return TOURNAMENT_KINDS[time.season];
}

/** True when the contest is currently open at the well. */
export function tournamentOpen(time: TimeOfDay): boolean {
  if (tournamentKindToday(time) === null) return false;
  return time.hour >= TOURNAMENT_OPEN_HOUR && time.hour < TOURNAMENT_CLOSE_HOUR;
}

/** Stable key used in the entries map. */
function entryKey(season: number, kind: TournamentKind): string {
  return `${season}-${kind}`;
}

/** True iff the player already entered this season's contest. */
export function alreadyEntered(player: Player, time: TimeOfDay): boolean {
  const kind = tournamentKindToday(time);
  if (!kind) return false;
  return entryKey(time.season, kind) in getTournament(player).entries;
}

/** Sum the player's inventory across the keys relevant to the given kind. */
export function scoreFor(player: Player, kind: TournamentKind): number {
  let n = 0;
  if (kind === 'flower-show') {
    n += player.inventory['flower_harvest'] ?? 0;
    n += player.inventory['flower_harvest_silver'] ?? 0;
    n += player.inventory['flower_harvest_gold'] ?? 0;
  } else if (kind === 'fishing-derby') {
    for (const fk of FISH_KEYS) {
      n += player.inventory[`fish-${fk}`] ?? 0;
    }
  } else if (kind === 'harvest-weigh-in') {
    for (const ck of CROP_KEYS) {
      if (!CROPS[ck]) continue;
      n += player.inventory[`${ck}_harvest`] ?? 0;
      n += player.inventory[`${ck}_harvest_silver`] ?? 0;
      n += player.inventory[`${ck}_harvest_gold`] ?? 0;
    }
  } else if (kind === 'cook-off') {
    for (const rk of RECIPE_KEYS) {
      n += player.inventory[dishInventoryKey(rk)] ?? 0;
    }
  }
  return n;
}

/** Highest tier the score earns, or 'none' if below bronze. */
export function tierFor(score: number): RibbonTier | 'none' {
  if (score >= TIER_THRESHOLD.gold) return 'gold';
  if (score >= TIER_THRESHOLD.silver) return 'silver';
  if (score >= TIER_THRESHOLD.bronze) return 'bronze';
  return 'none';
}

/** Outcome of an enter() call. */
export type TournamentOutcome =
  | { kind: 'won'; tier: RibbonTier; score: number; gold: number; ribbon: string; label: string }
  | { kind: 'entered-no-prize'; score: number; label: string }
  | { kind: 'already-entered'; tier: RibbonTier | 'none'; score: number; label: string }
  | { kind: 'not-open' };

/**
 * Enter today's tournament. Reads the relevant score, computes the
 * tier, drops the ribbon + gold into the player's bag, and records
 * the entry so a re-press returns 'already-entered'.
 */
export function enterTournament(player: Player, time: TimeOfDay): TournamentOutcome {
  if (!tournamentOpen(time)) return { kind: 'not-open' };
  const kind = tournamentKindToday(time)!;
  const label = TOURNAMENT_LABELS[kind];
  if (alreadyEntered(player, time)) {
    const prev = getTournament(player).entries[entryKey(time.season, kind)];
    return { kind: 'already-entered', tier: prev.tier, score: prev.score, label };
  }
  const score = scoreFor(player, kind);
  const tier = tierFor(score);
  const state = getTournament(player);
  state.entries[entryKey(time.season, kind)] = { day: time.day, tier, score };
  if (tier === 'none') {
    return { kind: 'entered-no-prize', score, label };
  }
  const ribbon = RIBBONS[tier];
  const gold = TIER_GOLD[tier];
  player.gold += gold;
  player.inventory[ribbon] = (player.inventory[ribbon] ?? 0) + 1;
  return { kind: 'won', tier, score, gold, ribbon, label };
}

/** Total ribbons earned across the whole run, by tier. */
export function ribbonCounts(player: Player): Record<RibbonTier, number> {
  return {
    bronze: player.inventory[RIBBONS.bronze] ?? 0,
    silver: player.inventory[RIBBONS.silver] ?? 0,
    gold: player.inventory[RIBBONS.gold] ?? 0,
  };
}

/** A one-line dawn announcement on tournament day. */
export function tournamentDawnLine(time: TimeOfDay): string | null {
  const kind = tournamentKindToday(time);
  if (!kind) return null;
  return `${TOURNAMENT_LABELS[kind]} at the well ${TOURNAMENT_OPEN_HOUR}-${TOURNAMENT_CLOSE_HOUR}h!`;
}
