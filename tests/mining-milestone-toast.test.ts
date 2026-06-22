// Mining run goal toast — when the player crosses 3 / 6 / 10 gems
// this run, surface a celebratory tail on the strike toast. Pure
// helpers: crossedMilestone(prev, next) returns the tier crossed or
// null; milestoneToastLine(state, tier) wraps haulStatusLine in a
// label per tier. The engine layer reads pre/post haulCount around
// recordMined and appends the tail.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  MINING_RUN_MILESTONES,
  crossedMilestone,
  getMineHaul,
  haulCount,
  milestoneToastLine,
  recordMined,
  resetMineHaul,
} from '../src/game/mining-haul';
import type { GemKey } from '../src/game/gems';

describe('crossedMilestone — pure tier detector', () => {
  it('returns null when no milestone was crossed', () => {
    expect(crossedMilestone(0, 0)).toBe(null);
    expect(crossedMilestone(1, 2)).toBe(null);
    expect(crossedMilestone(3, 4)).toBe(null);
    expect(crossedMilestone(6, 9)).toBe(null);
  });

  it('detects each milestone tier on exact landings', () => {
    expect(crossedMilestone(2, 3)).toBe(3);
    expect(crossedMilestone(5, 6)).toBe(6);
    expect(crossedMilestone(9, 10)).toBe(10);
  });

  it('detects each milestone tier on overshoots', () => {
    expect(crossedMilestone(0, 5)).toBe(3);
    expect(crossedMilestone(0, 7)).toBe(6);
    expect(crossedMilestone(0, 12)).toBe(10);
  });

  it('returns the HIGHEST crossed tier when bracketing multiple', () => {
    // 2 -> 11 crosses 3, 6, and 10. The toast should celebrate 10.
    expect(crossedMilestone(2, 11)).toBe(10);
    // 5 -> 11 crosses 6 and 10. The toast should celebrate 10.
    expect(crossedMilestone(5, 11)).toBe(10);
  });

  it('does NOT re-fire when prev is already at or past the tier', () => {
    expect(crossedMilestone(3, 5)).toBe(null);
    expect(crossedMilestone(6, 9)).toBe(null);
    expect(crossedMilestone(10, 15)).toBe(null);
  });

  it('returns null going DOWN (e.g. resetMineHaul) — never spawns a callout', () => {
    expect(crossedMilestone(10, 0)).toBe(null);
    expect(crossedMilestone(8, 2)).toBe(null);
  });

  it('MINING_RUN_MILESTONES is strictly increasing for stable tier matching', () => {
    for (let i = 1; i < MINING_RUN_MILESTONES.length; i++) {
      expect(MINING_RUN_MILESTONES[i]).toBeGreaterThan(MINING_RUN_MILESTONES[i - 1]);
    }
  });
});

describe('milestoneToastLine — pretty wrapper', () => {
  function freshWithCounts(counts: Partial<Record<GemKey, number>>) {
    const w = new World();
    const p = w.player;
    p.inventory = {};
    const state = getMineHaul(p);
    state.counts = { ...counts };
    return state;
  }

  it('empty when no milestone passed', () => {
    const state = freshWithCounts({ copper: 1 });
    expect(milestoneToastLine(state, null)).toBe('');
  });

  it('prefixes with the tier-3 label', () => {
    const state = freshWithCounts({ copper: 3 });
    const line = milestoneToastLine(state, 3);
    expect(line.startsWith('Solid start!')).toBe(true);
    expect(line).toContain('Today\'s haul:');
    expect(line).toContain('3 copper');
  });

  it('prefixes with the tier-6 label', () => {
    const state = freshWithCounts({ copper: 6 });
    const line = milestoneToastLine(state, 6);
    expect(line.startsWith('Run going strong!')).toBe(true);
    expect(line).toContain('6 copper');
  });

  it('prefixes with the tier-10 label', () => {
    const state = freshWithCounts({ copper: 5, ruby: 5 });
    const line = milestoneToastLine(state, 10);
    expect(line.startsWith('Fat haul!')).toBe(true);
    expect(line).toContain('5 copper');
    expect(line).toContain('5 cave ruby');
  });
});

describe('milestone interplay with recordMined / resetMineHaul', () => {
  it('milestone fires once per cross — re-mining same tier post-reset re-fires', () => {
    const w = new World();
    const p = w.player;
    p.inventory = {};
    // Strike copper x3.
    for (let i = 0; i < 3; i++) recordMined(p, 'copper');
    // After 3rd strike, haulCount=3, so the cross from 2->3 fires the
    // 3-tier on that strike.
    expect(haulCount(getMineHaul(p))).toBe(3);
    expect(crossedMilestone(2, 3)).toBe(3);
    // Sleep wipes the run.
    resetMineHaul(p);
    expect(haulCount(getMineHaul(p))).toBe(0);
    // Re-mining gem #3 the next day should re-fire the tier.
    for (let i = 0; i < 3; i++) recordMined(p, 'iron');
    expect(crossedMilestone(2, 3)).toBe(3);
  });

  it('never fires within a single run on a non-crossing bump', () => {
    const w = new World();
    const p = w.player;
    p.inventory = {};
    for (let i = 0; i < 3; i++) recordMined(p, 'copper');
    // 4th strike: pre=3 -> post=4, no milestone (we already passed 3).
    const pre = haulCount(getMineHaul(p));
    recordMined(p, 'copper');
    const post = haulCount(getMineHaul(p));
    expect(crossedMilestone(pre, post)).toBe(null);
  });
});
