// Ribbon hall — a cosmetic display of the player's tournament ribbons,
// mounted on the farmhouse exterior wall. The friendship tournament
// already awards bronze / silver / gold ribbons into the inventory, but
// they were invisible trophies. This surfaces them: each owned ribbon
// hangs as a small pixel rosette on the wall, so a decorated farmer's
// home visibly shows off their wins.
//
// Pure layout + data here (which rosettes, where, what colour); the
// canvas draw lives in render/ribbon-hall-sprite.ts. The engine reads
// ribbonCounts() and asks for the layout, so the placement maths are
// unit-testable without a rendering context.

import type { Player } from '../world/world';
import { ribbonCounts, type RibbonTier } from './tournament';

/** Palette per ribbon tier — rosette body + a lighter sheen highlight. */
export const RIBBON_TIER_COLOR: Record<RibbonTier, { body: string; sheen: string }> = {
  bronze: { body: '#C77B30', sheen: '#E8A85A' },
  silver: { body: '#B8BCC8', sheen: '#E8ECF4' },
  gold: { body: '#E8B23A', sheen: '#F7E08A' },
};

/** Tiers in display order (best on the left, the place of honour). */
export const RIBBON_DISPLAY_ORDER: RibbonTier[] = ['gold', 'silver', 'bronze'];

/** Max rosettes shown per tier so a long run doesn't paper the wall. */
export const RIBBON_MAX_PER_TIER = 3;

/** A single rosette to draw: its tier, colour, and wall-local offset. */
export interface RibbonMount {
  tier: RibbonTier;
  body: string;
  sheen: string;
  /** Horizontal offset (px) from the hall's left anchor. */
  dx: number;
}

/** Horizontal spacing between mounted rosettes (px). */
export const RIBBON_SPACING = 11;

/**
 * Build the rosette layout from the player's ribbon counts. Tiers are
 * laid out best-first (gold, silver, bronze); each owned ribbon up to
 * RIBBON_MAX_PER_TIER gets a rosette, packed left-to-right with even
 * spacing. Returns an empty array when the player has won nothing, so the
 * caller can skip drawing the hall entirely on a fresh farm.
 *
 * Pure + deterministic — same counts always give the same layout.
 */
export function ribbonHallMounts(player: Player): RibbonMount[] {
  const counts = ribbonCounts(player);
  const mounts: RibbonMount[] = [];
  let slot = 0;
  for (const tier of RIBBON_DISPLAY_ORDER) {
    const n = Math.min(RIBBON_MAX_PER_TIER, counts[tier] ?? 0);
    const c = RIBBON_TIER_COLOR[tier];
    for (let i = 0; i < n; i++) {
      mounts.push({ tier, body: c.body, sheen: c.sheen, dx: slot * RIBBON_SPACING });
      slot++;
    }
  }
  return mounts;
}

/** Total rosettes the hall would show (capped per tier). */
export function ribbonHallCount(player: Player): number {
  return ribbonHallMounts(player).length;
}
