// Panel empty-states — one shared vocabulary for "there's nothing here yet"
// across the game's info panels.
//
// Several panels could render zero rows (a filtered lore list, a fresh
// save's money log / quest board) but handled it inconsistently: the
// money log + quest log each hard-coded a bare one-liner with no hint at
// how to fill the list, and the lore panel drew NOTHING at all when a
// Rumors filter matched no entries — an empty void that reads as broken.
//
// This module owns a small registry of calm two-part empty states (a
// message + a "here's how to populate it" hint) so every panel speaks the
// same reassuring language, and a couple of pure resolvers for the panels
// whose empty state depends on context (the lore Rumors tab + its filter).
// The thin widget (ui/empty-state.ts) centres the two lines in a panel.
//
// Pure: type-only imports, no canvas, no engine state.

import type { LoreCategory, RumorFilter } from './lore';

/** A calm empty state: what's missing + a nudge toward filling it. */
export interface EmptyState {
  /** The "nothing here yet" line. */
  message: string;
  /** A short hint at how to populate the list (may be ''). */
  hint: string;
}

/** Named, reusable empty states keyed by a stable panel id. */
export const PANEL_EMPTY_STATES = {
  moneyLog: {
    message: 'No coin movement yet.',
    hint: 'Sell crops at the well or cook at the inn.',
  },
  questLog: {
    message: 'No quests on the board.',
    hint: 'Read the village notice board by the well.',
  },
} as const satisfies Record<string, EmptyState>;

/**
 * Empty state for the lore panel's Rumors tab, which is the only lore tab
 * that can render zero rows (the catalogued tabs always show locked ???
 * rows). Wording depends on the active filter so a player who filtered to
 * "bought" with nothing bought sees why the list is empty, not a void.
 * Returns null for tabs/filters that can never be empty so the caller only
 * draws the empty state when it's meaningful.
 */
export function loreEmptyState(
  tab: LoreCategory,
  filter: RumorFilter,
  rowCount: number,
): EmptyState | null {
  if (rowCount > 0) return null;
  if (tab !== 'Rumors') {
    // Non-Rumors tabs always carry catalog rows; defensively give a calm
    // line anyway so a future empty tab never renders blank.
    return { message: 'Nothing discovered here yet.', hint: 'Explore the village to fill this page.' };
  }
  switch (filter) {
    case 'bought':
      return {
        message: 'No headliners bought yet.',
        hint: "Buy what Pip teases to grow this list.",
      };
    case 'skipped':
      return {
        message: 'No skipped headliners.',
        hint: "Every rumor you've seen got bought.",
      };
    case 'all':
    default:
      return {
        message: 'No rumors heard yet.',
        hint: "Wait for Pip's cart to roll into the square.",
      };
  }
}
