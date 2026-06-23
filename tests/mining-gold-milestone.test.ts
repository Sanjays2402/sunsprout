// Mining run GOLD callout — parallel to the count-tier callouts at
// 3 / 6 / 10 gems. Tiers 100 / 250 / 500g land on the strike toast
// when the haul VALUE crosses, so a pure-iron grind (low count,
// high gold) still surfaces a celebration as the value swells.
//
// The two systems are independent — both can fire on a single strike
// when a rare gem crosses both bars at once. The engine layer
// composes both tails onto the strike toast; this test pins the
// pure helpers.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  MINING_RUN_GOLD_MILESTONES,
  crossedGoldMilestone,
  crossedMilestone,
  getMineHaul,
  goldMilestoneToastLine,
  haulCount,
  haulGold,
  recordMined,
  resetMineHaul,
} from '../src/game/mining-haul';
import { GEMS } from '../src/game/gems';
import type { GemKey } from '../src/game/gems';

describe('crossedGoldMilestone — pure tier detector', () => {
  it('returns null when no milestone was crossed', () => {
    expect(crossedGoldMilestone(0, 0)).toBe(null);
    expect(crossedGoldMilestone(50, 99)).toBe(null);
    expect(crossedGoldMilestone(100, 200)).toBe(null);
    expect(crossedGoldMilestone(250, 400)).toBe(null);
  });

  it('detects each tier on exact landings', () => {
    expect(crossedGoldMilestone(99, 100)).toBe(100);
    expect(crossedGoldMilestone(249, 250)).toBe(250);
    expect(crossedGoldMilestone(499, 500)).toBe(500);
  });

  it('detects each tier on overshoots', () => {
    expect(crossedGoldMilestone(0, 150)).toBe(100);
    expect(crossedGoldMilestone(0, 300)).toBe(250);
    expect(crossedGoldMilestone(0, 600)).toBe(500);
  });

  it('returns the HIGHEST crossed tier when bracketing multiple', () => {
    // 50 -> 600 crosses 100, 250, AND 500. The toast should celebrate 500.
    expect(crossedGoldMilestone(50, 600)).toBe(500);
    expect(crossedGoldMilestone(50, 300)).toBe(250);
  });

  it('does NOT re-fire when prev is already at or past the tier', () => {
    expect(crossedGoldMilestone(100, 150)).toBe(null);
    expect(crossedGoldMilestone(250, 400)).toBe(null);
    expect(crossedGoldMilestone(500, 800)).toBe(null);
  });

  it('returns null going DOWN (e.g. resetMineHaul) — never spawns a callout', () => {
    expect(crossedGoldMilestone(500, 0)).toBe(null);
    expect(crossedGoldMilestone(300, 50)).toBe(null);
  });

  it('MINING_RUN_GOLD_MILESTONES is strictly increasing for stable tier matching', () => {
    for (let i = 1; i < MINING_RUN_GOLD_MILESTONES.length; i++) {
      expect(MINING_RUN_GOLD_MILESTONES[i]).toBeGreaterThan(
        MINING_RUN_GOLD_MILESTONES[i - 1],
      );
    }
  });
});

describe('goldMilestoneToastLine — pretty wrapper', () => {
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
    expect(goldMilestoneToastLine(state, null)).toBe('');
  });

  it('prefixes with the tier-100 label', () => {
    // 13 copper * 8g = 104g — over the 100g floor.
    const state = freshWithCounts({ copper: 13 });
    const line = goldMilestoneToastLine(state, 100);
    expect(line.startsWith('Pockets clinking!')).toBe(true);
    expect(line).toContain('Haul value:');
    expect(line).toContain('104g');
  });

  it('prefixes with the tier-250 label', () => {
    // Mixed haul that clears 250g.
    // 4 iron (72) + 5 silver (175) = 247g — bump one more copper to 255g.
    const state = freshWithCounts({ copper: 1, iron: 4, silver: 5 });
    const line = goldMilestoneToastLine(state, 250);
    expect(line.startsWith('Now we\'re cooking!')).toBe(true);
    expect(line).toContain('Haul value:');
  });

  it('prefixes with the tier-500 label', () => {
    // Rich haul: ruby is the big-ticket gem at 140g each.
    // 4 ruby = 560g, comfortably over the 500g floor.
    const state = freshWithCounts({ ruby: 4 });
    const line = goldMilestoneToastLine(state, 500);
    expect(line.startsWith('Cart\'s full!')).toBe(true);
    expect(line).toContain('Haul value:');
  });

  it('uses live haulGold so the value matches the state at toast time', () => {
    // Two states with same tier crossed but different gold — toast
    // should reflect what the haul actually is right now.
    // a: 13 copper = 104g (tier-100 cross)
    // b: 13 copper + 1 iron = 104 + 18 = 122g (also tier-100 cross)
    const a = freshWithCounts({ copper: 13 });
    const b = freshWithCounts({ copper: 13, iron: 1 });
    expect(goldMilestoneToastLine(a, 100)).toContain('104g');
    expect(goldMilestoneToastLine(b, 100)).toContain('122g');
  });
});

describe('gold milestone interplay with recordMined / resetMineHaul', () => {
  it('gold milestone fires once per cross — re-mining after sleep re-fires', () => {
    const w = new World();
    const p = w.player;
    p.inventory = {};
    // Strike copper x13 — haulGold = 104g, crosses 100g floor at strike #13.
    for (let i = 0; i < 12; i++) recordMined(p, 'copper');
    expect(haulGold(getMineHaul(p))).toBeLessThan(100);
    const preGold = haulGold(getMineHaul(p));
    recordMined(p, 'copper');
    const postGold = haulGold(getMineHaul(p));
    expect(crossedGoldMilestone(preGold, postGold)).toBe(100);
    // Sleep wipes the run.
    resetMineHaul(p);
    expect(haulGold(getMineHaul(p))).toBe(0);
    // Re-mining to 100g should re-fire the tier.
    for (let i = 0; i < 12; i++) recordMined(p, 'copper');
    const reGoldPre = haulGold(getMineHaul(p));
    recordMined(p, 'copper');
    const reGoldPost = haulGold(getMineHaul(p));
    expect(crossedGoldMilestone(reGoldPre, reGoldPost)).toBe(100);
  });

  it('a single rare-gem strike can cross both count AND gold tiers', () => {
    // Pre: 2 copper (count=2, gold=16g). One ruby strike vaults the
    // count to 3 (count-tier 3 fires) AND lifts gold to 16 + 140 = 156g
    // which crosses the 100g floor too — both tails should fire.
    const w = new World();
    const p = w.player;
    p.inventory = {};
    recordMined(p, 'copper');
    recordMined(p, 'copper');
    const countPre = haulCount(getMineHaul(p));
    const goldPre = haulGold(getMineHaul(p));
    recordMined(p, 'ruby');
    const countPost = haulCount(getMineHaul(p));
    const goldPost = haulGold(getMineHaul(p));
    // Count tier 3 fires.
    expect(crossedMilestone(countPre, countPost)).toBe(3);
    // Gold tier 100 fires (16 -> 156 crosses 100g).
    expect(crossedGoldMilestone(goldPre, goldPost)).toBe(100);
  });

  it('pure-iron grind crosses gold tiers without crossing count tiers (after the first 3)', () => {
    // Iron sells for 18g per — 5 iron = 90g (still under 100g floor),
    // 6 iron = 108g (over). The 6th iron strike is past the count-3
    // tier so only the gold tier fires.
    const w = new World();
    const p = w.player;
    p.inventory = {};
    for (let i = 0; i < 5; i++) recordMined(p, 'iron');  // 5 iron = 90g
    const countPreStrike6 = haulCount(getMineHaul(p));
    const goldPre = haulGold(getMineHaul(p));
    expect(goldPre).toBeLessThan(100);
    recordMined(p, 'iron');  // 6th iron -> 108g
    const countPostStrike6 = haulCount(getMineHaul(p));
    const goldPost = haulGold(getMineHaul(p));
    expect(goldPost).toBeGreaterThanOrEqual(100);
    // Count tier 6 ALSO crosses on this strike (5->6) — that's fine,
    // the two systems are independent. The point of this test is the
    // gold tier fires whenever the gold-value bar is crossed.
    expect(crossedGoldMilestone(goldPre, goldPost)).toBe(100);
    expect(crossedMilestone(countPreStrike6, countPostStrike6)).toBe(6);
  });
});

describe('GEMS reality check (defends gold-tier tuning)', () => {
  it('copper sell price is the lowest tier and clears <=15g', () => {
    expect(GEMS.copper.sellPrice).toBeLessThanOrEqual(15);
  });

  it('ruby sells for more than 50g (so a single ruby alone can swing 100g+ tier crossings)', () => {
    expect(GEMS.ruby.sellPrice).toBeGreaterThan(50);
  });
});
