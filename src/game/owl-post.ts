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

/**
 * Per-NPC fluency tier discount on the owl-post fee. The owl learns
 * the route — every time you send a courier to the same recipient,
 * the next dispatch costs a little less. The discount is keyed off
 * the per-NPC fluency tier so it ladders cleanly with the lore Folk
 * tab label:
 *   - 0..4 stamps      no discount (full 40g)
 *   - 5..14 stamps     10% off  -> 36g
 *   - 15..24 stamps    20% off  -> 32g
 *   - >=25 stamps      30% off  -> 28g
 * Tuning intent: every tier is a noticeable but modest cut; the
 * favorite-courier tier never goes below ~70% of the original so
 * the owl economy stays anchored. The discount auto-rounds UP so a
 * pricing math change can't accidentally drive the fee to 0.
 */
export const OWL_POST_TIER_DISCOUNT_PCT: Record<string, number> = {
  'occasional pen pal': 10,
  'regular pen pal': 20,
  'favorite courier': 30,
};

/**
 * Returns the actual fee for dispatching an owl to `npcId` — the base
 * OWL_POST_FEE minus the per-NPC fluency-tier discount. Pure read:
 * doesn't bump stamps or take gold, just computes the price.
 *
 * Rounded UP so the discount can never push the fee below 1g.
 */
export function owlPostFeeFor(player: object, npcId: string): number {
  const tier = owlFluencyTier(player, npcId);
  const pct = OWL_POST_TIER_DISCOUNT_PCT[tier] ?? 0;
  if (pct <= 0) return OWL_POST_FEE;
  return Math.max(1, Math.ceil(OWL_POST_FEE * (1 - pct / 100)));
}

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
 * On success, the per-NPC fee (`owlPostFeeFor`) is deducted, the
 * best-taste gift is removed from inventory, and the candidate's
 * hearts row is incremented exactly like a face-to-face gift. The fee
 * tiers down based on lifetime owl stamps to this recipient so a
 * fluent courier path costs less per send than a fresh one.
 *
 * Failure (no candidate, no inventory, gift already given today)
 * leaves the player's gold untouched. The fee is computed BEFORE the
 * gold check so an under-fee player gets accurate `need` / `have` on
 * the outcome.
 */
export function dispatchOwl(
  player: Player,
  npcId: string,
  day: number,
  time?: TimeOfDay,
): OwlPostOutcome {
  const def = CANDIDATES[npcId];
  if (!def) return { kind: 'not-candidate' };
  const fee = owlPostFeeFor(player, npcId);
  if (player.gold < fee) {
    return { kind: 'not-enough-gold', need: fee, have: player.gold };
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
  // Use the tier-discounted fee so a favorite courier path pays the
  // reduced rate. Recompute right before the deduction so the same
  // value the gold-check used is the value charged.
  player.gold -= fee;
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

// ---------------------------------------------------------------------
// Per-NPC fluency tiers — qualitative tag based on how many owl posts
// the player has ever dispatched to one recipient. Surfaced on the
// lore Folk row description so the player can see at a glance which
// friendships are owl-heavy ("favorite courier") vs. casually-mailed
// ("occasional pen pal").
//
// Tiers parallel the catalog-wide OWL_FLUENT_MILESTONE achievement
// without duplicating its grant logic: this is just a label on the
// row, not an unlock. The "favorite" tier deliberately matches the
// global fluency milestone (25) so a fluent-with-the-owl badge run
// also lights up at least one per-NPC favorite tag.
// ---------------------------------------------------------------------

/** Per-NPC stamp thresholds, smallest first. Stable order. */
export const OWL_FLUENCY_TIERS = [
  { min: 5, label: 'occasional pen pal' },
  { min: 15, label: 'regular pen pal' },
  { min: OWL_FLUENT_MILESTONE, label: 'favorite courier' },
] as const;

/**
 * Returns the highest tier label whose `min` is <= the player's owl
 * stamps to this NPC. Returns the empty string when the player hasn't
 * crossed the first tier so the Folk row stays clean for casual
 * single-owl friendships.
 *
 * Pure read — doesn't bump stamps.
 */
export function owlFluencyTier(player: object, npcId: string): string {
  const n = owlStampsFor(player, npcId);
  let label = '';
  for (const tier of OWL_FLUENCY_TIERS) {
    if (n >= tier.min) label = tier.label;
  }
  return label;
}

/**
 * Pretty per-NPC line for the lore Folk tab. Returns the empty string
 * when the player has never sent an owl to this NPC so the Folk row
 * description stays compact for in-person friendships.
 *
 * Wording:
 *   - 0 stamps:              ""
 *   - 1..4 stamps:           "Owl posts: 3."
 *   - 5..14 stamps:          "Owl posts: 7 (occasional pen pal)."
 *   - 15..24 stamps:         "Owl posts: 18 (regular pen pal)."
 *   - >=25 stamps:           "Owl posts: 42 (favorite courier)."
 *
 * The tier label is appended ONLY when the player has crossed a tier;
 * a casual pen-friend (1-4 stamps) keeps the plain count line so the
 * tag doesn't broadcast \"barely sent any\" on every Folk row that has
 * one owl on record. The tier tag plays the same role here that the
 * compost-master journal nudge plays for the compost ledger — a
 * passive, per-recipient \"how owl-fluent are you with THIS one\"
 * label on top of the global \"fluent-with-the-owl\" badge.
 */
export function owlStampLine(player: object, npcId: string): string {
  const n = owlStampsFor(player, npcId);
  if (n === 0) return '';
  const tier = owlFluencyTier(player, npcId);
  if (tier === '') return `Owl posts: ${n}.`;
  return `Owl posts: ${n} (${tier}).`;
}

/**
 * Pretty fee chip for the owl-menu — shows the per-NPC cost on each
 * row so the player can SEE the tier discount before pressing Enter.
 * Pulled out as a pure helper so the menu UI doesn't have to know
 * about the tier-discount math.
 *
 * Wording:
 *   - no stamps / no discount:   "40g"
 *   - any discounted tier:       "32g (-8g, regular)"
 *
 * The savings tag uses the SHORT tier label without the "pen pal" /
 * "courier" suffix so the chip stays compact in the owl-menu's
 * limited per-row real estate. The full tier label is already on
 * the Folk lore row description, so duplicating the suffix here
 * would just clutter the menu without adding new information.
 */
export function owlPostFeeChip(player: object, npcId: string): string {
  const fee = owlPostFeeFor(player, npcId);
  const savings = OWL_POST_FEE - fee;
  if (savings <= 0) return `${OWL_POST_FEE}g`;
  const tier = owlFluencyTier(player, npcId);
  // Compress the tier label to the leading word (occasional/regular/favorite)
  // so the chip stays narrow in the menu row.
  const shortTier = tier.split(' ')[0] || tier;
  return `${fee}g (-${savings}g, ${shortTier})`;
}
