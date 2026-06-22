// Lore / bestiary panel — backtick (`) toggles the village discovery
// log. Each row is one entry in one of FOUR categories:
//
//   fish    — caught at least one of in the rod's `lastCatch` history
//             (we use the inventory `fish-<key>` count as the gate)
//   gems    — mined at least one (inventory `gem-<key>` count > 0)
//   forage  — picked at least one (inventory `forage-<key>` > 0)
//   crops   — sown at least once according to the journal
//   folk    — every NPC the player has chatted to (hearts row exists)
//
// Auto-discovery: rows light up whenever the underlying tally goes
// non-zero. There's no separate "save" of unlock state — we derive
// every panel render from the live counts so the bestiary always
// reflects current truth, and older saves with no codex history still
// surface their inventory naturally.
//
// Pure module — no IO, no canvas. The panel UI lives in ui/lore-panel.ts.

import type { Player } from '../world/world';
import { FISH, FISH_KEYS, type FishKey } from './fish';
import { GEMS, GEM_KEYS, gemInventoryKey, gemRarity, type GemKey } from './gems';
import { FORAGE, FORAGE_KEYS, forageInventoryKey } from './forage';
import { CROPS } from './crops';
import { CANDIDATES, getHearts } from './hearts';
import { buildJournal } from './crop-journal';
import { getRumorHistory, type RumorHistoryEntry } from './cart-rumor';
import { getMineHaul, lifetimeHaulCount, lifetimeHaulGold } from './mining-haul';

/** Category labels — listed in panel display order. */
export const LORE_CATEGORIES = ['Fish', 'Gems', 'Forage', 'Crops', 'Folk', 'Rumors'] as const;
export type LoreCategory = (typeof LORE_CATEGORIES)[number];

/** One row in the lore panel. */
export interface LoreRow {
  category: LoreCategory;
  id: string;
  name: string;
  /** True iff the player has discovered this entry. */
  discovered: boolean;
  /** One-liner shown beneath the name (shown when discovered). */
  description: string;
  /** Short locked teaser shown until discovery. */
  teaser: string;
  /** Optional count for inventory-backed entries. */
  count?: number;
}

/** Per-category teaser to fill in locked rows. */
function teaserFor(category: LoreCategory): string {
  switch (category) {
    case 'Fish':   return 'Cast a line into the pond.';
    case 'Gems':   return 'Mine the stone outcrop.';
    case 'Forage': return 'Wander the grass at dawn.';
    case 'Crops':  return 'Plant a seed and tend it.';
    case 'Folk':   return 'Greet someone in the village.';
    case 'Rumors': return 'Wait for Pip to roll into the village square.';
  }
}

/** Season-index → human label for the rumors tab. */
const RUMOR_SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** True iff the player has caught at least one of `key`. */
function fishDiscovered(player: Player, key: FishKey): boolean {
  return (player.inventory[`fish-${key}`] ?? 0) > 0;
}

/** True iff the player has mined at least one of `key`. */
function gemDiscovered(player: Player, key: GemKey): boolean {
  return (player.inventory[gemInventoryKey(key)] ?? 0) > 0;
}

/** True iff the player has picked at least one of `key`. */
function forageDiscovered(player: Player, key: keyof typeof FORAGE): boolean {
  return (player.inventory[forageInventoryKey(key)] ?? 0) > 0;
}

/** Build the full lore catalogue, calling the discovery predicates. */
export function buildLoreRows(player: Player): LoreRow[] {
  const out: LoreRow[] = [];
  // Fish.
  for (const key of FISH_KEYS) {
    const def = FISH[key];
    const count = player.inventory[`fish-${key}`] ?? 0;
    out.push({
      category: 'Fish',
      id: key,
      name: def.name,
      discovered: fishDiscovered(player, key),
      description: `Sells for ${def.sellPrice}g. Catalogue weight ${def.weight}.`,
      teaser: teaserFor('Fish'),
      count,
    });
  }
  // Gems.
  for (const key of GEM_KEYS) {
    const def = GEMS[key];
    const count = player.inventory[gemInventoryKey(key)] ?? 0;
    out.push({
      category: 'Gems',
      id: key,
      name: def.name,
      discovered: gemDiscovered(player, key),
      description: `${gemRarity(key)} - sells for ${def.sellPrice}g.`,
      teaser: teaserFor('Gems'),
      count,
    });
  }
  // Forage.
  for (const key of FORAGE_KEYS) {
    const def = FORAGE[key];
    const count = player.inventory[forageInventoryKey(key)] ?? 0;
    out.push({
      category: 'Forage',
      id: key,
      name: def.name,
      discovered: forageDiscovered(player, key),
      description: `Sells for ${def.sellPrice}g. Wild grass spawn.`,
      teaser: teaserFor('Forage'),
      count,
    });
  }
  // Crops — derive discovery from the journal sown count.
  const journal = buildJournal(player);
  for (const r of journal) {
    const def = CROPS[r.key];
    if (!def) continue;
    out.push({
      category: 'Crops',
      id: r.key,
      name: def.name,
      discovered: r.sown > 0,
      description: `Grown ${r.normal + r.silver + r.gold} times; best streak ${r.bestStreak}.`,
      teaser: teaserFor('Crops'),
      count: r.normal + r.silver + r.gold,
    });
  }
  // Folk — every candidate the player has even one chat point with.
  if (player.hearts) {
    for (const id of Object.keys(CANDIDATES)) {
      const def = CANDIDATES[id];
      const hearts = getHearts(player.hearts, id);
      const row = player.hearts[id];
      const seen = (row?.points ?? 0) > 0 || (row?.lastTalkDay ?? -1) >= 0;
      const lovesPretty = def.loved
        .slice(0, 2)
        .map((k) => k.replace('_harvest', '').replace('fish-', ''))
        .join(', ');
      out.push({
        category: 'Folk',
        id,
        name: def.name,
        discovered: seen,
        description: `Hearts ${hearts}/10. Loves ${lovesPretty}.`,
        teaser: teaserFor('Folk'),
        count: hearts,
      });
    }
  }
  // Rumors — every entry in the rumor history ring buffer.
  // Newest at top so a glance reads "what just happened" first.
  // We treat each entry as "discovered" because Pip has explicitly
  // teased it — even a skipped headliner is something the player
  // saw. The bought/skipped state lands in the description so the
  // panel doubles as a ledger of "what did I follow through on".
  const rumorEntries = getRumorHistory(player).entries;
  for (let i = rumorEntries.length - 1; i >= 0; i--) {
    const entry: RumorHistoryEntry = rumorEntries[i];
    const seasonName = RUMOR_SEASON_NAMES[Math.abs(entry.season) % 4] ?? 'Spring';
    const stamp = entry.bought ? 'bought' : 'skipped';
    out.push({
      category: 'Rumors',
      id: `${entry.season}-${entry.itemKey}-${i}`,
      name: `${seasonName} - ${entry.label}`,
      discovered: true,
      description: `${entry.buyPrice}g headliner Pip teased - ${stamp}.`,
      teaser: teaserFor('Rumors'),
      count: entry.bought ? 1 : 0,
    });
  }
  return out;
}

/** Count of discovered rows per category. */
export interface LoreProgress {
  category: LoreCategory;
  discovered: number;
  total: number;
}

export function loreProgress(player: Player): LoreProgress[] {
  const rows = buildLoreRows(player);
  const buckets: Record<LoreCategory, LoreProgress> = {
    Fish: { category: 'Fish', discovered: 0, total: 0 },
    Gems: { category: 'Gems', discovered: 0, total: 0 },
    Forage: { category: 'Forage', discovered: 0, total: 0 },
    Crops: { category: 'Crops', discovered: 0, total: 0 },
    Folk: { category: 'Folk', discovered: 0, total: 0 },
    Rumors: { category: 'Rumors', discovered: 0, total: 0 },
  };
  for (const r of rows) {
    buckets[r.category].total += 1;
    if (r.discovered) buckets[r.category].discovered += 1;
  }
  return LORE_CATEGORIES.map((c) => buckets[c]);
}

/** Overall percentage of discoveries (0..1).
 *
 * The Rumors tab is excluded from the completion math because rumor
 * entries are a visit LOG, not a discovery catalogue — a player who
 * has never opened a rumor still has a perfectly complete bestiary
 * in spirit, and we don't want a skipped headliner to drag the
 * "discovered" percentage around as Pip rolls through. The tab still
 * surfaces its own per-tab progress count.
 */
export function loreCompletion(player: Player): number {
  const rows = buildLoreRows(player).filter((r) => r.category !== 'Rumors');
  if (rows.length === 0) return 0;
  const discovered = rows.filter((r) => r.discovered).length;
  return discovered / rows.length;
}

/**
 * Per-tab footer line — currently surfaces the lifetime mining career
 * recap inside the Gems tab. Returns the empty string for tabs that
 * have nothing extra to say so the panel can render nothing without
 * a guard.
 *
 * Wording (Gems):
 *   "career: 142 gems / 3,820g"  when the player has mined anything
 *   "career: 0 gems"             when the lifetime ledger is empty
 *
 * Pulled out as a pure formatter so the lore-panel UI doesn't grow
 * a mining-haul import just to draw a footer.
 */
export function loreTabFooter(player: Player, category: LoreCategory): string {
  if (category !== 'Gems') return '';
  const state = getMineHaul(player);
  const count = lifetimeHaulCount(state);
  const gold = lifetimeHaulGold(state);
  if (count === 0) return 'career: 0 gems';
  // Pretty-format the gold with thousands separators so big-haul saves
  // read cleanly without scientific shorthand.
  const goldStr = gold.toLocaleString('en-US');
  return `career: ${count} gem${count === 1 ? '' : 's'} / ${goldStr}g`;
}
