// Deep Vein achievement — single-run mining haul ribbon badge.
// Lights up the moment bestRun.count crosses DEEP_VEIN_COUNT OR
// bestRun.gold crosses DEEP_VEIN_GOLD — either dimension on its own
// unlocks the badge so a quantity-grind run (20 copper) and a
// value-grind run (one fat ruby trip) both have a path.
//
// Reads off the existing MineHaulState.bestRun field captured at sleep
// time by resetMineHaul — no new persisted field, no engine wiring
// beyond the catalog row.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  DEEP_VEIN_COUNT,
  DEEP_VEIN_GOLD,
  LIFETIME_MINING_MILESTONE,
  MINING_RUN_GOLD_MILESTONES,
  MINING_RUN_MILESTONES,
  deepVeinMilestoneReached,
  getMineHaul,
  recordMined,
  resetMineHaul,
} from '../src/game/mining-haul';
import { ACHIEVEMENTS, tickAchievements } from '../src/game/achievements';
import type { GemKey } from '../src/game/gems';
import { GEMS } from '../src/game/gems';

function timeAt(day: number): TimeOfDay {
  const t = new TimeOfDay(7);
  // Manually walk the day forward; the simplest path is to fast-forward
  // a fresh clock and then assign — but TimeOfDay accepts a starting
  // day in the constructor. Use that directly.
  return new TimeOfDay(day);
}

describe('DEEP_VEIN constants — tuning sanity', () => {
  it('count threshold is at least 2x the largest mid-run count milestone', () => {
    const maxRunMilestone = MINING_RUN_MILESTONES[MINING_RUN_MILESTONES.length - 1];
    expect(DEEP_VEIN_COUNT).toBeGreaterThanOrEqual(maxRunMilestone * 2);
  });

  it('gold threshold is at least 2x the largest mid-run gold milestone', () => {
    const maxGoldMilestone = MINING_RUN_GOLD_MILESTONES[MINING_RUN_GOLD_MILESTONES.length - 1];
    expect(DEEP_VEIN_GOLD).toBeGreaterThanOrEqual(maxGoldMilestone * 2);
  });

  it('count threshold is below the lifetime-mining milestone — single-run sits BELOW career', () => {
    expect(DEEP_VEIN_COUNT).toBeLessThan(LIFETIME_MINING_MILESTONE);
  });
});

describe('deepVeinMilestoneReached — predicate', () => {
  it('returns false on a fresh save (no bestRun captured yet)', () => {
    const w = new World();
    const state = getMineHaul(w.player);
    expect(state.bestRun).toBeUndefined();
    expect(deepVeinMilestoneReached(state)).toBe(false);
  });

  it('returns false when bestRun is below both thresholds', () => {
    const w = new World();
    const p = w.player;
    // Mine 5 copper (count=5, gold=60) — well below either bar.
    for (let i = 0; i < 5; i++) recordMined(p, 'copper');
    resetMineHaul(p, 3);
    expect(deepVeinMilestoneReached(getMineHaul(p))).toBe(false);
  });

  it('fires on the count dimension at exactly DEEP_VEIN_COUNT copper', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(p, 'copper');
    resetMineHaul(p, 4);
    const state = getMineHaul(p);
    expect(state.bestRun?.count).toBe(DEEP_VEIN_COUNT);
    expect(deepVeinMilestoneReached(state)).toBe(true);
  });

  it('fires on the gold dimension below the count threshold — pure-value grind', () => {
    const w = new World();
    const p = w.player;
    // Pick the priciest gem so we hit DEEP_VEIN_GOLD with the fewest
    // strikes — under DEEP_VEIN_COUNT.
    let priciest: GemKey = 'copper';
    let maxPrice = 0;
    for (const k of Object.keys(GEMS) as GemKey[]) {
      if (GEMS[k].sellPrice > maxPrice) {
        maxPrice = GEMS[k].sellPrice;
        priciest = k;
      }
    }
    const needed = Math.ceil(DEEP_VEIN_GOLD / maxPrice);
    for (let i = 0; i < needed; i++) recordMined(p, priciest);
    resetMineHaul(p, 7);
    const state = getMineHaul(p);
    expect(state.bestRun?.count).toBeLessThan(DEEP_VEIN_COUNT);
    expect(state.bestRun?.gold).toBeGreaterThanOrEqual(DEEP_VEIN_GOLD);
    expect(deepVeinMilestoneReached(state)).toBe(true);
  });

  it('handles split records — best count on one day, best gold on another', () => {
    const w = new World();
    const p = w.player;
    // First run: lots of copper but small gold.
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(p, 'copper');
    resetMineHaul(p, 2);
    // Second run: only a couple of gems but huge gold.
    let priciest: GemKey = 'copper';
    let maxPrice = 0;
    for (const k of Object.keys(GEMS) as GemKey[]) {
      if (GEMS[k].sellPrice > maxPrice) {
        maxPrice = GEMS[k].sellPrice;
        priciest = k;
      }
    }
    const needed = Math.ceil(DEEP_VEIN_GOLD / maxPrice);
    for (let i = 0; i < needed; i++) recordMined(p, priciest);
    resetMineHaul(p, 9);
    const state = getMineHaul(p);
    // Both axes should have been promoted independently.
    expect(state.bestRun?.count).toBe(DEEP_VEIN_COUNT);
    expect(state.bestRun?.countDay).toBe(2);
    expect(state.bestRun?.gold).toBeGreaterThanOrEqual(DEEP_VEIN_GOLD);
    expect(state.bestRun?.goldDay).toBe(9);
    expect(deepVeinMilestoneReached(state)).toBe(true);
  });
});

describe('deep-vein achievement — catalog wiring', () => {
  it('catalog includes a deep-vein row', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'deep-vein');
    expect(def).toBeDefined();
    expect(def?.name).toBe('Deep Vein');
  });

  it('catalog has grown to at least 21 badges this tick', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(21);
  });

  it('hint and done strings reference both thresholds', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'deep-vein')!;
    expect(def.hint).toContain(String(DEEP_VEIN_COUNT));
    expect(def.hint).toContain(String(DEEP_VEIN_GOLD));
    expect(def.done).toContain(String(DEEP_VEIN_COUNT));
    expect(def.done).toContain(String(DEEP_VEIN_GOLD));
  });

  it('tickAchievements grants the badge on the dawn after a qualifying run', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(p, 'copper');
    resetMineHaul(p, 4);
    const earned = tickAchievements(p, w, timeAt(5));
    expect(earned).toContain('deep-vein');
  });

  it('tickAchievements does NOT grant the badge BEFORE bestRun is captured', () => {
    const w = new World();
    const p = w.player;
    // Pile gems into the bag mid-run but DON'T sleep yet.
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(p, 'copper');
    const earned = tickAchievements(p, w, timeAt(4));
    expect(earned).not.toContain('deep-vein');
  });
});
