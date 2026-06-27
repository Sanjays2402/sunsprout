// Quest log panel — `'` toggles a view of every quest the player has.
//
// Three buckets, in order:
//   - active     : not complete yet; show progress/goal + the next hint.
//   - completed  : done; show the reward earned and "Done" badge.
//   - locked     : not yet seeded (future-proofing — currently none).
//
// The hint line teases the next thing the player should do without
// outright spoiling. E.g. "Plant your first seed" stays as-is until
// completion, then becomes "Reward: 10g". This mirrors the cozy genre
// convention of not over-explaining each quest while still showing
// progress.
//
// Pure module + a controller class for the panel — same shape as
// AchievementsPanel / MoneyLogPanel / SettingsPanel so the engine can
// wire it in with no surprises.

import type { Player } from '../world/world';
import type { Quest, QuestReward } from './quests';

/** Bucket a quest sits in for the panel. */
export type QuestStatus = 'active' | 'completed';

/** Pure summary row used by the panel and tests. */
export interface QuestLogEntry {
  id: string;
  name: string;
  description: string;
  status: QuestStatus;
  /** 0..goal. */
  progress: number;
  /** Always >= 1; surfaces "0/5" until first tick. */
  goal: number;
  /** Pre-formatted reward line ("+10g", "+50g, +3 tomato", etc.). */
  rewardLine: string;
  /** Short hint line shown under the title. */
  hint: string;
}

/**
 * Format a quest's reward block as a single line.
 *   `{gold:50, items:{tomato:3}}` → "+50g, +3 tomato"
 *   `{gold:10}`                   → "+10g"
 *   `{cosmetic:'sunhat'}`         → "+sunhat"
 */
export function formatReward(reward: QuestReward): string {
  const parts: string[] = [];
  if (reward.gold) parts.push(`+${reward.gold}g`);
  if (reward.items) {
    for (const [k, v] of Object.entries(reward.items)) {
      parts.push(`+${v} ${k.replace('_harvest', '')}`);
    }
  }
  if (reward.cosmetic) parts.push(`+${reward.cosmetic}`);
  return parts.length === 0 ? '—' : parts.join(', ');
}

/** A short \"what to do next\" hint per quest description. Falls back to the description. */
export function questHint(q: Quest): string {
  if (q.complete) return 'Done.';
  // Use the existing description as the next-step hint; it already
  // reads as an instruction ("Plant your first seed.").
  return q.description;
}

/** Build the full panel snapshot from the player's quests. */
export function buildQuestLog(player: Player): QuestLogEntry[] {
  const quests = (player.quests as Quest[]) ?? [];
  // Active first, then completed. Within each, preserve catalog order.
  const out: QuestLogEntry[] = [];
  for (const q of quests) {
    if (!q.complete) {
      out.push({
        id: q.id,
        name: q.name,
        description: q.description,
        status: 'active',
        progress: q.progress,
        goal: q.goal,
        rewardLine: formatReward(q.reward),
        hint: questHint(q),
      });
    }
  }
  for (const q of quests) {
    if (q.complete) {
      out.push({
        id: q.id,
        name: q.name,
        description: q.description,
        status: 'completed',
        progress: q.goal,
        goal: q.goal,
        rewardLine: formatReward(q.reward),
        hint: 'Done.',
      });
    }
  }
  return out;
}

/** Totals for the panel header. */
export function questCounts(player: Player): { active: number; completed: number; total: number } {
  const quests = (player.quests as Quest[]) ?? [];
  let active = 0;
  let completed = 0;
  for (const q of quests) {
    if (q.complete) completed++;
    else active++;
  }
  return { active, completed, total: quests.length };
}

/** A glanceable progress digest for the quest-log header. */
export interface QuestProgressSummary {
  /** Whole-percent of quests completed (0..100), 0 when there are none. */
  completedPct: number;
  /**
   * The active quest nearest completion — highest progress/goal fraction,
   * ties broken by FEWER steps remaining, then catalog order. Null when
   * every quest is done (or there are none), so the header can fall back
   * to a plain "all done" note.
   */
  closest: { name: string; progress: number; goal: number } | null;
}

/**
 * Digest the quest board for the header: an overall completion percentage
 * plus the active quest nearest to done, so a player opening the log sees
 * BOTH how far along the whole board is and what they're about to finish —
 * the same "surface the shape" move the almanac count summary makes. Pure:
 * reads only player.quests. The percentage floors to a whole number; the
 * "closest" pick maximises progress/goal (a quest with no goal can't
 * occur — goals are always >= 1), tie-breaks to the one with the fewest
 * remaining steps, then keeps catalog order via a stable scan.
 */
export function questProgressSummary(player: Player): QuestProgressSummary {
  const quests = (player.quests as Quest[]) ?? [];
  const total = quests.length;
  const completed = quests.filter((q) => q.complete).length;
  const completedPct = total === 0 ? 0 : Math.floor((completed / total) * 100);

  let closest: { name: string; progress: number; goal: number } | null = null;
  let bestFrac = -1;
  let bestRemaining = Infinity;
  for (const q of quests) {
    if (q.complete) continue;
    const goal = Math.max(1, q.goal);
    const frac = q.progress / goal;
    const remaining = goal - q.progress;
    // Strictly-greater keeps the first-seen (catalog order) on a tie of
    // fraction; within an equal fraction prefer fewer remaining steps.
    if (frac > bestFrac || (frac === bestFrac && remaining < bestRemaining)) {
      bestFrac = frac;
      bestRemaining = remaining;
      closest = { name: q.name, progress: q.progress, goal: q.goal };
    }
  }
  return { completedPct, closest };
}

/** Earn-state bucket for the panel's section dividers. */
export type QuestSectionKey = 'active' | 'completed';

/** A contiguous run of quest rows under one divider header. */
export interface QuestSection {
  key: QuestSectionKey;
  /** Divider label, e.g. "ACTIVE". */
  header: string;
  rows: QuestLogEntry[];
}

/** Header text per status, in display order. */
const QUEST_SECTION_HEADER: Record<QuestSectionKey, string> = {
  active: 'ACTIVE',
  completed: 'DONE',
};

/**
 * Group quest rows into ACTIVE / DONE sections so the log reads as "what
 * I'm working on / what I've finished" instead of one flat scroll keyed
 * only by a pip colour. Active first (the live work), done last. buildQuestLog
 * already emits active-then-completed in catalog order, so each section
 * keeps that order; empty sections are omitted so a board with no completed
 * quests doesn't show a bare DONE header. Pure — mirrors achievementSections.
 */
export function questLogSections(rows: readonly QuestLogEntry[]): QuestSection[] {
  const order: QuestSectionKey[] = ['active', 'completed'];
  const out: QuestSection[] = [];
  for (const key of order) {
    const status: QuestStatus = key === 'active' ? 'active' : 'completed';
    const group = rows.filter((r) => r.status === status);
    if (group.length > 0) {
      out.push({ key, header: QUEST_SECTION_HEADER[key], rows: group });
    }
  }
  return out;
}

/**
 * Panel-local quest filter so a player on a long board can isolate just
 * the active work (or just review what they've finished) without scanning
 * past the other group. Cycles all -> active -> done, each keeping one
 * QuestStatus (all keeps everything). The quest log is a non-blocking
 * read-while-walking overlay with no a/d nav, so a panel-local `f` cycle
 * is the right shape (mirrors the money-log / almanac / codex filters);
 * the global fishing `f` is guarded against the open panel.
 */
export type QuestFilter = 'all' | 'active' | 'done';

/** Cycle order for the `f` keypress. */
export const QUEST_FILTERS: readonly QuestFilter[] = ['all', 'active', 'done'] as const;

/** Advance to the next filter, wrapping at the end. Pure. */
export function cycleQuestFilter(f: QuestFilter): QuestFilter {
  const i = QUEST_FILTERS.indexOf(f);
  return QUEST_FILTERS[(i + 1) % QUEST_FILTERS.length];
}

/** Short chip label for the active filter. Pure. */
export function questFilterLabel(f: QuestFilter): string {
  return f; // 'all' / 'active' / 'done' read fine as-is.
}

/**
 * Keep only the quest rows matching the active filter, by status. 'all'
 * returns the input untouched (a fresh array for caller safety),
 * preserving the active-then-done order in every case. Pure.
 */
export function applyQuestFilter(
  rows: readonly QuestLogEntry[],
  filter: QuestFilter,
): QuestLogEntry[] {
  if (filter === 'all') return rows.slice();
  const status: QuestStatus = filter === 'active' ? 'active' : 'completed';
  return rows.filter((r) => r.status === status);
}
