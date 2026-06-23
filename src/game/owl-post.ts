// Owl Post — courier service for sending gifts without crossing the village.
//
// The village owl perches on the farmhouse mailbox. Pay a small fee
// and the owl delivers the player's best-suited gift to the chosen
// candidate. Useful for late-game players who want to grind hearts
// without daily round-trips, and for rainy / stamina-low days.
//
// Pricing: a flat courier fee per send. Cheap enough that the player
// doesn't think twice on a +heart milestone day; expensive enough that
// it can't replace the village walk as the bedrock interaction.
//
// The send respects every existing gifting guardrail: per-day gift
// gate (no repeat to the same candidate today), no-disliked-auto-gift,
// best-available-taste auto-pick. The candidate doesn't have to be on
// camera — the whole point is delivery at distance.
//
// Pure module: no IO, no canvas. The UI lives in ../ui/owl-menu.ts.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { CANDIDATES } from './hearts';
import { attemptAutoGift, type GiftOutcome } from './gifting';

/** Flat courier fee per dispatch. Deducted before the gift is picked. */
export const OWL_POST_FEE = 40;

/** Returns the stable list of candidate ids (alphabetical for menu order). */
export function owlCandidateIds(): string[] {
  return Object.keys(CANDIDATES).sort();
}

/** Outcome of an owl-post dispatch. */
export type OwlPostOutcome =
  | { kind: 'sent'; npcId: string; npcName: string; gift: GiftOutcome }
  | { kind: 'not-enough-gold'; need: number; have: number }
  | { kind: 'not-candidate' }
  | { kind: 'already-today'; npcName: string }
  | { kind: 'no-items'; npcName: string };

/**
 * Dispatch the owl to deliver a gift to `npcId`. Returns a detailed
 * outcome so the UI can surface a precise toast.
 *
 * On success, OWL_POST_FEE is deducted, the best-taste gift is removed
 * from inventory, and the candidate's hearts row is incremented exactly
 * like a face-to-face gift. Failure (no candidate, no inventory, gift
 * already given today) leaves the player's gold untouched.
 */
export function dispatchOwl(
  player: Player,
  npcId: string,
  day: number,
  time?: TimeOfDay,
): OwlPostOutcome {
  const def = CANDIDATES[npcId];
  if (!def) return { kind: 'not-candidate' };
  if (player.gold < OWL_POST_FEE) {
    return { kind: 'not-enough-gold', need: OWL_POST_FEE, have: player.gold };
  }
  // Reuse the existing auto-gift pipeline — same taste ranking, same
  // per-day gate, same heart math. The owl is just a delivery method.
  const gift = attemptAutoGift(player, npcId, day, time);
  if (gift.kind === 'already-today') {
    return { kind: 'already-today', npcName: def.name };
  }
  if (gift.kind === 'no-items') {
    return { kind: 'no-items', npcName: def.name };
  }
  if (gift.kind === 'not-candidate') {
    return { kind: 'not-candidate' };
  }
  // gift.kind === 'gifted' — only NOW do we charge the fee, so a wasted
  // press (already-today / no-items) doesn't drain the player's purse.
  player.gold -= OWL_POST_FEE;
  // Stamp the lifetime owl-post tally so the lore Folk tab can
  // surface "owl posts: N" per recipient and the player can audit
  // their long-distance friendship across the save.
  recordOwlStamp(player, npcId);
  return { kind: 'sent', npcId, npcName: def.name, gift };
}

// ---------------------------------------------------------------------
// Owl post stamp book — lifetime per-NPC tally of owl deliveries the
// player has ever dispatched. Lives on a tiny lazy field
// (player.owlStamps) so we don't widen SaveSnapshot.player at the top
// level (the persistence whitelist already passes objects through).
// Surfaced in the lore Folk tab description so the player gets a
// passive "you've sent N owls to Maple" without needing a dedicated
// panel.
//
// Why a per-NPC map instead of a single counter: the player will care
// about WHICH friendships are owl-driven vs. in-person — Maple lives
// in town, so 0 owls there is normal; a recluse like Pip's brother
// living north of the bridge benefits more from the owl. Per-NPC
// totals make that texture visible at a glance.
// ---------------------------------------------------------------------

/** Per-NPC lifetime count of owl posts dispatched. */
export interface OwlStampBook {
  /** Map of npcId → lifetime owl-posts sent. Missing = 0. */
  counts: Record<string, number>;
}

/** Lazy reader on Player. */
export function getOwlStamps(player: object): OwlStampBook {
  const p = player as { owlStamps?: OwlStampBook };
  if (!p.owlStamps) p.owlStamps = { counts: {} };
  return p.owlStamps;
}

/**
 * Bump the owl-stamp tally for `npcId`. Returns the new total. Called
 * inside dispatchOwl only when the gift actually landed (i.e. the fee
 * was charged), so failed dispatches don't stamp.
 */
export function recordOwlStamp(player: object, npcId: string): number {
  const book = getOwlStamps(player);
  book.counts[npcId] = (book.counts[npcId] ?? 0) + 1;
  return book.counts[npcId];
}

/** Owl post count for one NPC. Missing = 0. */
export function owlStampsFor(player: object, npcId: string): number {
  return getOwlStamps(player).counts[npcId] ?? 0;
}

/** Total owl posts dispatched across every recipient. */
export function totalOwlStamps(player: object): number {
  let n = 0;
  for (const v of Object.values(getOwlStamps(player).counts)) n += v;
  return n;
}

/**
 * Lifetime owl-post milestone for the `fluent-with-the-owl` achievement.
 * Tuned to feel like a real \"the village owl knows your handwriting\"
 * commitment — 25 dispatches is roughly a full season of daily owls,
 * or a couple of late-game gift sprints when the player is racing
 * heart milestones with the village across the bridge.
 *
 * One-liner predicate so the achievements catalog stays a list of
 * read-only checks; no engine-side counter to maintain — the lazy
 * OwlStampBook on Player.owlStamps already accrues from dispatchOwl.
 */
export const OWL_FLUENT_MILESTONE = 25;

/** True iff total lifetime owl dispatches has crossed OWL_FLUENT_MILESTONE. */
export function owlFluentMilestoneReached(player: object): boolean {
  return totalOwlStamps(player) >= OWL_FLUENT_MILESTONE;
}

/**
 * Pretty per-NPC line for the lore Folk tab. Returns the empty string
 * when the player has never sent an owl to this NPC so the Folk row
 * description stays compact for in-person friendships.
 *
 * Wording: "Owl posts: 4."
 */
export function owlStampLine(player: object, npcId: string): string {
  const n = owlStampsFor(player, npcId);
  if (n === 0) return '';
  return `Owl posts: ${n}.`;
}
