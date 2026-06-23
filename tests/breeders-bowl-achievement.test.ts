// Breeder's Bowl — lifetime premium-dish achievement.
//
// The badge lights up once totalPremiumDishesCooked >= BREEDERS_BOWL_MILESTONE
// (25). Mirrors the cave-veteran / compost-master shape: a lazy counter
// already exists on the player (premiumCookCounts via recordPremiumCook),
// the achievement is a one-line predicate over its sum.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  BREEDERS_BOWL_MILESTONE,
  breedersBowlMilestoneReached,
  recordPremiumCook,
  totalPremiumDishesCooked,
} from '../src/game/cooking-history';
import {
  ACHIEVEMENTS,
  isEarned,
  tickAchievements,
} from '../src/game/achievements';

describe('breedersBowlMilestoneReached predicate', () => {
  it('false on a fresh player with no premium cooks', () => {
    const w = new World();
    expect(breedersBowlMilestoneReached(w.player)).toBe(false);
  });

  it('false at MILESTONE - 1, true at MILESTONE', () => {
    const w = new World();
    for (let i = 0; i < BREEDERS_BOWL_MILESTONE - 1; i++) {
      recordPremiumCook(w.player, 'farm-omelet');
    }
    expect(breedersBowlMilestoneReached(w.player)).toBe(false);
    recordPremiumCook(w.player, 'farm-omelet');
    expect(breedersBowlMilestoneReached(w.player)).toBe(true);
  });

  it('aggregates across multiple recipe keys', () => {
    const w = new World();
    // Split the milestone across several premium recipes.
    for (let i = 0; i < 10; i++) recordPremiumCook(w.player, 'farm-omelet');
    for (let i = 0; i < 10; i++) recordPremiumCook(w.player, 'pumpkin-custard');
    for (let i = 0; i < 5; i++) recordPremiumCook(w.player, 'berry-tart');
    expect(totalPremiumDishesCooked(w.player)).toBe(BREEDERS_BOWL_MILESTONE);
    expect(breedersBowlMilestoneReached(w.player)).toBe(true);
  });
});

describe('breeders-bowl in the achievements catalog', () => {
  it('catalog includes the breeders-bowl entry', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'breeders-bowl');
    expect(def).toBeTruthy();
    expect(def?.name).toBe("Breeder's Bowl");
    // Both teaser and done-text must mention the milestone.
    expect(def?.hint).toContain(String(BREEDERS_BOWL_MILESTONE));
    expect(def?.done).toContain(String(BREEDERS_BOWL_MILESTONE));
  });

  it('tickAchievements grants the badge once the threshold is crossed', () => {
    const w = new World();
    const time = new TimeOfDay(7);
    // Below threshold — not granted.
    for (let i = 0; i < BREEDERS_BOWL_MILESTONE - 1; i++) {
      recordPremiumCook(w.player, 'farm-omelet');
    }
    let newly = tickAchievements(w.player, w, time);
    expect(newly).not.toContain('breeders-bowl');
    expect(isEarned(w.player, 'breeders-bowl')).toBe(false);
    // Crossing the threshold flips the badge on.
    recordPremiumCook(w.player, 'farm-omelet');
    newly = tickAchievements(w.player, w, time);
    expect(newly).toContain('breeders-bowl');
    expect(isEarned(w.player, 'breeders-bowl')).toBe(true);
  });

  it('catalog size grew by 1 (now 19 badges; breeders-bowl was 18, fluent-with-the-owl is 19)', () => {
    // Anchor on the presence of breeders-bowl rather than a strict
    // length so a follow-on badge in the same tick (pulper, etc.)
    // doesn\'t force a fragile count update here.
    expect(ACHIEVEMENTS.some((a) => a.id === 'breeders-bowl')).toBe(true);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(19);
  });
});
