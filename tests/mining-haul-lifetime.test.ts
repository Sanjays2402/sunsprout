// Mining-haul lifetime tally — separate counter that never resets on
// sleep, drives the Cave Veteran achievement + lore-panel career line.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  getMineHaul,
  lifetimeHaulCount,
  lifetimeHaulGold,
  lifetimeMiningMilestoneReached,
  recordMined,
  resetMineHaul,
  LIFETIME_MINING_MILESTONE,
} from '../src/game/mining-haul';
import { GEMS, GEM_KEYS, type GemKey } from '../src/game/gems';
import {
  ACHIEVEMENTS,
  tickAchievements,
  isEarned,
} from '../src/game/achievements';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

describe('mining-haul lifetime tally', () => {
  it('starts at zero on a fresh save', () => {
    const w = freshWorld();
    const state = getMineHaul(w.player);
    expect(lifetimeHaulCount(state)).toBe(0);
    expect(lifetimeHaulGold(state)).toBe(0);
    expect(lifetimeMiningMilestoneReached(state)).toBe(false);
  });

  it('recordMined bumps both the run tally and the lifetime tally', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'iron');
    recordMined(w.player, 'iron');
    const state = getMineHaul(w.player);
    expect(state.counts.copper).toBe(1);
    expect(state.counts.iron).toBe(2);
    expect(state.lifetimeCounts?.copper).toBe(1);
    expect(state.lifetimeCounts?.iron).toBe(2);
    expect(lifetimeHaulCount(state)).toBe(3);
  });

  it('resetMineHaul clears the run tally but the lifetime tally survives', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player);
    const state = getMineHaul(w.player);
    expect(state.counts).toEqual({});
    expect(state.lifetimeCounts?.copper).toBe(1);
    expect(state.lifetimeCounts?.ruby).toBe(1);
    expect(lifetimeHaulCount(state)).toBe(2);
    // Second run should accumulate on top of the lifetime tally.
    recordMined(w.player, 'copper');
    expect(lifetimeHaulCount(getMineHaul(w.player))).toBe(3);
  });

  it('lifetimeHaulGold sums by sell-price weight', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'ruby');
    const state = getMineHaul(w.player);
    expect(lifetimeHaulGold(state)).toBe(
      2 * GEMS.copper.sellPrice + GEMS.ruby.sellPrice,
    );
  });

  it('lifetimeMiningMilestoneReached flips at the threshold', () => {
    const w = freshWorld();
    for (let i = 0; i < LIFETIME_MINING_MILESTONE - 1; i++) {
      recordMined(w.player, 'copper');
    }
    expect(lifetimeMiningMilestoneReached(getMineHaul(w.player))).toBe(false);
    recordMined(w.player, 'copper');
    expect(lifetimeMiningMilestoneReached(getMineHaul(w.player))).toBe(true);
  });

  it('older saves with missing lifetimeCounts get a default-empty object', () => {
    const w = freshWorld();
    const p = w.player as unknown as {
      mineHaul?: {
        counts: Partial<Record<GemKey, number>>;
        lastRun: { counts: Partial<Record<GemKey, number>>; gold: number };
      };
    };
    p.mineHaul = { counts: {}, lastRun: { counts: {}, gold: 0 } };
    // No lifetimeCounts → reader fills it in.
    const state = getMineHaul(w.player);
    expect(state.lifetimeCounts).toEqual({});
    recordMined(w.player, 'copper');
    expect(state.lifetimeCounts?.copper).toBe(1);
  });
});

describe('cave-veteran achievement', () => {
  it('catalog includes a Cave Veteran entry whose name + hint reference the threshold', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'cave-veteran');
    expect(def).toBeDefined();
    expect(def?.name).toBe('Cave Veteran');
    expect(def?.hint).toContain(String(LIFETIME_MINING_MILESTONE));
  });

  it('does not unlock below the threshold', () => {
    const w = freshWorld();
    const t = new TimeOfDay(6);
    for (let i = 0; i < LIFETIME_MINING_MILESTONE - 1; i++) {
      recordMined(w.player, 'copper');
    }
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'cave-veteran')).toBe(false);
  });

  it('unlocks once the player crosses LIFETIME_MINING_MILESTONE', () => {
    const w = freshWorld();
    const t = new TimeOfDay(6);
    for (let i = 0; i < LIFETIME_MINING_MILESTONE; i++) {
      recordMined(w.player, 'copper');
    }
    const newly = tickAchievements(w.player, w, t);
    expect(newly).toContain('cave-veteran');
    expect(isEarned(w.player, 'cave-veteran')).toBe(true);
  });

  it('survives a sleep reset — the run resetting does not lose the badge', () => {
    const w = freshWorld();
    const t = new TimeOfDay(6);
    // Pour every gem-key into the lifetime tally evenly across two days.
    let n = 0;
    while (n < LIFETIME_MINING_MILESTONE) {
      const k = GEM_KEYS[n % GEM_KEYS.length];
      recordMined(w.player, k);
      n++;
      if (n === Math.floor(LIFETIME_MINING_MILESTONE / 2)) resetMineHaul(w.player);
    }
    const newly = tickAchievements(w.player, w, t);
    expect(newly).toContain('cave-veteran');
    // A subsequent tickAchievements call must NOT re-grant it (idempotent).
    const repeat = tickAchievements(w.player, w, t);
    expect(repeat).not.toContain('cave-veteran');
  });
});
