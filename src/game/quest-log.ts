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
