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
  return { kind: 'sent', npcId, npcName: def.name, gift };
}
