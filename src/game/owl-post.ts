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
  | {
      kind: 'sent';
      npcId: string;
      npcName: string;
      gift: GiftOutcome;
      /**
       * Active letter-chain length AFTER this dispatch (always >= 1
       * because the just-landed send counts as today's link). 1 on a
       * fresh streak or after a break; ramps as the player mails the
       * same recipient on consecutive days.
       */
      chainLength: number;
      /**
       * Heart-point multiplier the chain applied to this send. 1 means
       * no bonus (single-day streak); >1 means the chain crossed a
       * tier and the gift carried bonus points. Always matches
       * `chainBonusMultiplier(chainLength)`.
       */
      chainMultiplier: number;
    }
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
  // Snapshot the chain length the player would land at BEFORE the
  // gift is attempted — we need to know the bonus multiplier to pass
  // into attemptAutoGift so the heart-points award reflects the chain.
  // The chain is only ACTUALLY bumped after the gift lands (so a
  // failed dispatch never advances the streak).
  const pendingChainLength = previewChainLength(player, npcId, day);
  const chainMult = chainBonusMultiplier(pendingChainLength);
  // Reuse the existing auto-gift pipeline — same taste ranking, same
  // per-day gate, same heart math. The owl is just a delivery method.
  // The chain multiplier rides as the extraMultiplier on top of any
  // birthday bonus so a chain-7 send on a birthday still earns the
  // 8x birthday * 1.3x chain compounded points.
  const gift = attemptAutoGift(player, npcId, day, time, chainMult);
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
  // Advance the active letter chain — same npcId + next day extends
  // the streak, anything else resets it to 1. We bump AFTER the gift
  // lands so a failed send (no-items / already-today / not-candidate)
  // never advances the streak. The returned length is what we
  // surface on the outcome so the toast can read "letter chain x N".
  const chainLength = recordOwlChain(player, npcId, day);
  return {
    kind: 'sent',
    npcId,
    npcName: def.name,
    gift,
    chainLength,
    chainMultiplier: chainMult,
  };
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
  /**
   * Active letter-chain state — the most recent NPC the player has
   * been mailing CONSECUTIVE days. Reset whenever the player skips a
   * day OR mails a different recipient. Optional so older saves
   * backfill cleanly via the lazy reader.
   *
   * `npcId` = which NPC is the active streak target; null means no
   * active chain. `length` = how many consecutive days the chain has
   * landed (always >= 1 when npcId is non-null). `lastDay` = the day
   * of the most recent dispatch in the chain; the chain breaks the
   * moment `currentDay > lastDay + 1`.
   */
  chain?: {
    npcId: string | null;
    length: number;
    lastDay: number;
  };
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

// ---------------------------------------------------------------------
// Owl-post letter chain — consecutive-day bonus for mailing the SAME
// recipient day after day. The chain tracks the most recent NPC the
// player has been mailing and ramps a small heart-points multiplier
// on each successive landed send. A chain breaks the moment the
// player skips a day OR switches recipients; the multiplier resets to
// 1x on the next send.
//
// Tier table (length AFTER the just-landed send -> heart multiplier):
//   1            1.00x   no bonus on a fresh streak
//   2..3         1.10x   "starting to feel like a routine"
//   4..6         1.20x   "the owl knows the door"
//   7+           1.30x   "favorite pen pal" — top tier
//
// Tuning intent: the cap (1.3x) is below the courtship-bouquet's
// universal-love bonus so a real in-person grind still outpaces a
// pure owl strategy. The 7-day cliff for the top tier ladders cleanly
// with a one-week commitment — anyone who bothers mailing daily for
// a full week earns the routine premium.
// ---------------------------------------------------------------------

/**
 * Chain-tier thresholds (length, multiplier). Stored in ascending
 * length so the lookup walks left-to-right and the highest matching
 * tier wins. `length` here is the chain length AFTER the just-landed
 * send (so `length=1` is the floor — the first send of a chain is
 * still that chain's first link).
 */
export const OWL_CHAIN_TIERS: ReadonlyArray<{ length: number; multiplier: number }> = [
  { length: 1, multiplier: 1.0 },
  { length: 2, multiplier: 1.1 },
  { length: 4, multiplier: 1.2 },
  { length: 7, multiplier: 1.3 },
];

/**
 * Returns the heart-point multiplier for a chain of length `length`.
 * Returns 1.0 for non-positive lengths so a freshly-broken chain or
 * a fresh save reads as "no bonus". Pure read.
 */
export function chainBonusMultiplier(length: number): number {
  if (length <= 0) return 1;
  let mult = 1;
  for (const tier of OWL_CHAIN_TIERS) {
    if (length >= tier.length) mult = tier.multiplier;
  }
  return mult;
}

/** Lazy reader for the active chain state. Always returns a fresh
 * "no chain" object when the book has never recorded one so the
 * caller doesn't have to guard. Mutating the returned object also
 * mutates the underlying book (the reader returns the live ref). */
export function getOwlChain(player: object): {
  npcId: string | null;
  length: number;
  lastDay: number;
} {
  const book = getOwlStamps(player);
  if (!book.chain) {
    book.chain = { npcId: null, length: 0, lastDay: -1 };
  }
  return book.chain;
}

/**
 * The chain length the player would land at IF they sent an owl to
 * `npcId` on `day`. Does NOT mutate state — useful for surfacing the
 * pending chain length in the owl menu before the player confirms.
 *
 * Rules:
 *   - Active chain on same npcId + day == lastDay+1  ->  length + 1
 *   - Active chain on same npcId + day == lastDay    ->  length (already today, no bump)
 *   - Active chain on different npcId                ->  1 (new chain)
 *   - Active chain on same npcId + skipped a day     ->  1 (chain breaks)
 *   - No active chain                                ->  1 (fresh start)
 */
export function previewChainLength(
  player: object,
  npcId: string,
  day: number,
): number {
  const chain = getOwlChain(player);
  if (chain.npcId === npcId) {
    if (day === chain.lastDay) return chain.length;
    if (day === chain.lastDay + 1) return chain.length + 1;
  }
  return 1;
}

/**
 * Returns the active chain length when the active chain target is
 * `npcId`. Returns 0 when no chain is active OR the chain target is
 * a different NPC. Used by the lore Folk row chain-indicator tail —
 * surfaces only when the player is actively riding a chain with the
 * one we're describing.
 *
 * Pure read; doesn't bump or break the chain.
 */
export function activeChainLength(player: object, npcId: string): number {
  const chain = getOwlChain(player);
  return chain.npcId === npcId ? chain.length : 0;
}

/**
 * Bump the chain on a confirmed dispatch. Returns the chain length
 * AFTER the bump (always >= 1). Idempotent on same-day re-call: a
 * second send on the same day to the same NPC (which can't actually
 * happen via dispatchOwl thanks to the per-day gate, but defending
 * against it keeps the contract clean) leaves the length unchanged.
 *
 * Side effect: writes into `OwlStampBook.chain`. Called from
 * dispatchOwl right after the lifetime stamp.
 */
export function recordOwlChain(
  player: object,
  npcId: string,
  day: number,
): number {
  const chain = getOwlChain(player);
  if (chain.npcId === npcId) {
    if (day === chain.lastDay) return chain.length;
    if (day === chain.lastDay + 1) {
      chain.length += 1;
      chain.lastDay = day;
      return chain.length;
    }
  }
  // Either new recipient, or skipped a day, or fresh save — start
  // (or reset) the chain at length 1.
  chain.npcId = npcId;
  chain.length = 1;
  chain.lastDay = day;
  return 1;
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

// ---------------------------------------------------------------------
// Owl fluency tier badge color — a tiny colored chip the lore Folk
// row can draw alongside the textual fluency label. Mirrors the
// tournament ribbon palette (bronze / silver / gold) so the player
// reads "this is a fluency rank" at a glance without having to parse
// the tier label every time. The color comes from a pure helper so
// the panel UI doesn't grow an owl-post import — it just calls
// owlFluencyTierColor(player, npcId) and uses the returned hex
// (or null when no tier reached).
//
// Color choices intentionally pin to the tournament-ribbon family
// (warm metallic palette) so the lore panel reads as a coherent
// visual language across separate per-NPC progression systems.
// ---------------------------------------------------------------------

/**
 * Per-tier display color. Matches the tournament-ribbon hex family
 * so the lore panel's per-NPC fluency tag reads in the same visual
 * language as the player's ribbon counters elsewhere.
 *
 * Tiers map by tier label so the constant set automatically picks
 * up any future addition / rename to OWL_FLUENCY_TIERS without a
 * second source of truth.
 */
export const OWL_FLUENCY_TIER_COLOR: Record<string, string> = {
  'occasional pen pal': '#B87333', // bronze — warm copper
  'regular pen pal':    '#C0C0C0', // silver — cool steel
  'favorite courier':   '#F0C24A', // gold   — warm amber
};

/**
 * Returns the tier-color hex for the player's fluency with `npcId`,
 * or null when the player hasn't crossed the first tier (so the
 * panel UI can skip the chip draw entirely without a guard).
 *
 * Pure read — doesn't bump stamps, doesn't mutate state. Returns
 * null on missing-tier (rather than empty string) so the call site
 * has a clean falsy gate without the empty-string + nullish-coalesce
 * dance.
 */
export function owlFluencyTierColor(player: object, npcId: string): string | null {
  const tier = owlFluencyTier(player, npcId);
  if (tier === '') return null;
  return OWL_FLUENCY_TIER_COLOR[tier] ?? null;
}
