// Pulper — lifetime fertilizer-bag-apply achievement.
//
// The badge lights up once compostLedger.lifetimeBagsApplied >=
// PULPER_MILESTONE_BAGS (500). Mirrors the cave-veteran /
// compost-master / breeders-bowl / fluent-with-the-owl shape: the
// CompostLedgerState already accrues lifetimeBagsApplied from
// applyFertilizer, so the achievement is a one-line predicate over
// the existing ledger.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  PULPER_MILESTONE_BAGS,
  pulperMilestoneReached,
  recordApplied,
  getCompostLedger,
  COMPOST_RECYCLE_REGULAR,
  COMPOST_RECYCLE_RARE,
} from '../src/game/compost';
import {
  ACHIEVEMENTS,
  isEarned,
  tickAchievements,
} from '../src/game/achievements';

describe('pulperMilestoneReached predicate', () => {
  it('false on a fresh player with no bags applied', () => {
    const w = new World();
    expect(pulperMilestoneReached(w.player)).toBe(false);
  });

  it('false at MILESTONE - 1, true at MILESTONE', () => {
    const w = new World();
    for (let i = 0; i < PULPER_MILESTONE_BAGS - 1; i++) {
      recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    }
    expect(pulperMilestoneReached(w.player)).toBe(false);
    recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    expect(pulperMilestoneReached(w.player)).toBe(true);
  });

  it('counts every bag-apply regardless of regular vs rare', () => {
    const w = new World();
    // Mix regular + rare across the milestone — both bumps the bag
    // counter by exactly 1, only the recycled-gold field differs.
    for (let i = 0; i < 250; i++) recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    for (let i = 0; i < 250; i++) recordApplied(w.player, COMPOST_RECYCLE_RARE);
    expect(getCompostLedger(w.player).lifetimeBagsApplied).toBe(PULPER_MILESTONE_BAGS);
    expect(pulperMilestoneReached(w.player)).toBe(true);
  });
});

describe('pulper in the achievements catalog', () => {
  it('catalog includes the pulper entry', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'pulper');
    expect(def).toBeTruthy();
    expect(def?.name).toBe('Pulper');
    // Both teaser and done-text must mention the milestone.
    expect(def?.hint).toContain(String(PULPER_MILESTONE_BAGS));
    expect(def?.done).toContain(String(PULPER_MILESTONE_BAGS));
  });

  it('tickAchievements grants the badge once the threshold is crossed', () => {
    const w = new World();
    const time = new TimeOfDay(7);
    // Below threshold — not granted.
    for (let i = 0; i < PULPER_MILESTONE_BAGS - 1; i++) {
      recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    }
    let newly = tickAchievements(w.player, w, time);
    expect(newly).not.toContain('pulper');
    expect(isEarned(w.player, 'pulper')).toBe(false);
    // Crossing the threshold flips the badge on.
    recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    newly = tickAchievements(w.player, w, time);
    expect(newly).toContain('pulper');
    expect(isEarned(w.player, 'pulper')).toBe(true);
  });

  it('catalog size now includes pulper (20+ badges)', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'pulper')).toBe(true);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
  });

  it('pulper is positioned after fluent-with-the-owl in display order', () => {
    const pulperIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'pulper');
    const owlIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'fluent-with-the-owl');
    expect(pulperIdx).toBeGreaterThan(owlIdx);
  });
});
