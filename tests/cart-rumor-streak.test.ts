// Rumor streak — buying 3+ headliners in a row stacks a 5g/step
// discount on the current headliner buy (capped at 15g). The streak
// is derived purely from rumorHistory.entries[].bought; no extra
// persistence shape. Discount only applies when the buy matches THIS
// season's headliner, and only when the streak (computed BEFORE
// recording the buy) is >= RUMOR_STREAK_MIN.

import { describe, it, expect } from 'vitest';
import {
  RUMOR_STREAK_MIN,
  RUMOR_STREAK_DISCOUNT_STEP,
  RUMOR_STREAK_MAX_STEPS,
  buyRumorStreakDiscount,
  currentSeasonHeadliner,
  getRumorHistory,
  isCurrentHeadlinerKey,
  recordRumorBuy,
  recordRumorVisit,
  rumorItemForSeason,
  rumorStreakCount,
  rumorStreakDiscount,
  rumorStreakLine,
} from '../src/game/cart-rumor';

function freshPlayer(): object {
  return { inventory: {}, gold: 0 };
}

/**
 * Drive a season's headliner visit + record the buy stamp. Pass
 * `buy=false` to leave it as skipped. We pass an explicit itemKey to
 * recordRumorBuy so a season-with-no-buy still records as a visit
 * but isn't stamped bought.
 */
function visitAndBuy(player: object, season: number, buy: boolean): void {
  recordRumorVisit(player, season);
  if (!buy) return;
  const headliner = currentSeasonHeadliner(season);
  if (!headliner) throw new Error('no headliner in test fixture');
  recordRumorBuy(player, season, headliner.key);
}

describe('rumorStreakCount — pure walk back from end', () => {
  it('returns 0 on a fresh player', () => {
    expect(rumorStreakCount(freshPlayer())).toBe(0);
  });

  it('returns 0 when the latest entry is skipped', () => {
    const p = freshPlayer();
    visitAndBuy(p, 0, true);
    visitAndBuy(p, 1, false);
    expect(rumorStreakCount(p)).toBe(0);
  });

  it('counts trailing bought entries until the first skip', () => {
    const p = freshPlayer();
    visitAndBuy(p, 0, false); // skipped
    visitAndBuy(p, 1, true);
    visitAndBuy(p, 2, true);
    visitAndBuy(p, 3, true);
    expect(rumorStreakCount(p)).toBe(3);
  });

  it('full bought history returns the entry count', () => {
    const p = freshPlayer();
    visitAndBuy(p, 0, true);
    visitAndBuy(p, 1, true);
    visitAndBuy(p, 2, true);
    visitAndBuy(p, 3, true);
    expect(rumorStreakCount(p)).toBe(4);
  });
});

describe('rumorStreakDiscount — pure math', () => {
  it('returns 0 below the streak floor', () => {
    for (let s = 0; s < RUMOR_STREAK_MIN; s++) {
      expect(rumorStreakDiscount(100, s)).toBe(0);
    }
  });

  it('grants RUMOR_STREAK_DISCOUNT_STEP at the floor', () => {
    expect(rumorStreakDiscount(100, RUMOR_STREAK_MIN)).toBe(RUMOR_STREAK_DISCOUNT_STEP);
  });

  it('scales linearly past the floor up to the step cap', () => {
    expect(rumorStreakDiscount(100, RUMOR_STREAK_MIN + 1)).toBe(RUMOR_STREAK_DISCOUNT_STEP * 2);
    // At MIN + 2 we should already be at the step cap (MAX_STEPS=2),
    // so the discount equals the plateau, not 3 steps.
    const cap = RUMOR_STREAK_MAX_STEPS * RUMOR_STREAK_DISCOUNT_STEP;
    expect(rumorStreakDiscount(100, RUMOR_STREAK_MIN + 2)).toBe(cap);
  });

  it('plateaus at RUMOR_STREAK_MAX_STEPS * RUMOR_STREAK_DISCOUNT_STEP', () => {
    const cap = RUMOR_STREAK_MAX_STEPS * RUMOR_STREAK_DISCOUNT_STEP;
    expect(rumorStreakDiscount(100, RUMOR_STREAK_MIN + RUMOR_STREAK_MAX_STEPS)).toBe(cap);
    expect(rumorStreakDiscount(100, RUMOR_STREAK_MIN + RUMOR_STREAK_MAX_STEPS + 5)).toBe(cap);
    expect(rumorStreakDiscount(100, 99)).toBe(cap);
  });

  it('never returns more than buyPrice', () => {
    expect(rumorStreakDiscount(3, 99)).toBe(3);
    expect(rumorStreakDiscount(0, 99)).toBe(0);
  });
});

describe('buyRumorStreakDiscount — wires headliner gate + streak floor', () => {
  it('returns 0 when the bought row is NOT this season\'s headliner', () => {
    const p = freshPlayer();
    // Build a streak so the floor is cleared.
    visitAndBuy(p, 0, true);
    visitAndBuy(p, 1, true);
    visitAndBuy(p, 2, true);
    // Pretend we're buying a non-headliner row in season 3.
    const headliner = currentSeasonHeadliner(3);
    expect(headliner).toBeTruthy();
    const otherKey = headliner!.key === 'compost-bin' ? 'pumpkin' : 'compost-bin';
    expect(buyRumorStreakDiscount(p, 3, otherKey, 200)).toBe(0);
  });

  it('returns 0 when the player buys the headliner but streak < floor', () => {
    const p = freshPlayer();
    // Only one bought-in-a-row.
    visitAndBuy(p, 0, true);
    const headliner = currentSeasonHeadliner(1);
    expect(headliner).toBeTruthy();
    expect(buyRumorStreakDiscount(p, 1, headliner!.key, 200)).toBe(0);
  });

  it('grants the discount when the player buys the headliner AND streak >= floor', () => {
    const p = freshPlayer();
    visitAndBuy(p, 0, true);
    visitAndBuy(p, 1, true);
    visitAndBuy(p, 2, true);
    const headliner = currentSeasonHeadliner(3);
    expect(headliner).toBeTruthy();
    const disc = buyRumorStreakDiscount(p, 3, headliner!.key, 200);
    expect(disc).toBe(RUMOR_STREAK_DISCOUNT_STEP);
  });

  it('a fresh skipped headliner resets the count to 0 (no discount)', () => {
    const p = freshPlayer();
    // Three bought.
    visitAndBuy(p, 0, true);
    visitAndBuy(p, 1, true);
    visitAndBuy(p, 2, true);
    // Then a skip resets the chain.
    visitAndBuy(p, 3, false);
    const headliner = currentSeasonHeadliner(0);
    expect(headliner).toBeTruthy();
    expect(buyRumorStreakDiscount(p, 0, headliner!.key, 200)).toBe(0);
  });
});

describe('rumorStreakLine — UI string', () => {
  it('empty at streak=0', () => {
    expect(rumorStreakLine(freshPlayer())).toBe('');
  });

  it('shows the unlock progress under the floor', () => {
    const p = freshPlayer();
    visitAndBuy(p, 0, true);
    const line = rumorStreakLine(p);
    expect(line).toContain('streak: 1 bought');
    expect(line).toContain('to unlock');
  });

  it('shows the active discount once the floor is cleared', () => {
    const p = freshPlayer();
    visitAndBuy(p, 0, true);
    visitAndBuy(p, 1, true);
    visitAndBuy(p, 2, true);
    const line = rumorStreakLine(p);
    expect(line).toContain('streak: 3 bought');
    expect(line).toContain(`-${RUMOR_STREAK_DISCOUNT_STEP}g`);
  });

  it('reports the capped discount at high streaks', () => {
    const p = freshPlayer();
    for (let s = 0; s < RUMOR_STREAK_MIN + RUMOR_STREAK_MAX_STEPS + 2; s++) {
      visitAndBuy(p, s, true);
    }
    const cap = RUMOR_STREAK_MAX_STEPS * RUMOR_STREAK_DISCOUNT_STEP;
    expect(rumorStreakLine(p)).toContain(`-${cap}g`);
  });
});

describe('rumorStreakCount end-to-end with rumorItemForSeason determinism', () => {
  it('two non-decor, non-refill catalog rows can both be headliners across the cycle (sanity)', () => {
    // The rumor pool excludes decor + spa-pass-refill so the streak
    // path is a real game scenario, not theoretical.
    const seenKeys = new Set<string>();
    for (let s = 0; s < 16; s++) {
      const r = rumorItemForSeason(s);
      if (r) seenKeys.add(r.key);
    }
    expect(seenKeys.size).toBeGreaterThan(1);
    for (const k of seenKeys) {
      expect(k.startsWith('decor-')).toBe(false);
    }
  });

  it('the rumor history ring buffer doesn\'t break the streak walk', () => {
    // The history is capped at 4 entries; buying 5 in a row means the
    // first one falls off the front, and the streak count should
    // still reflect the trailing 4 trues.
    const p = freshPlayer();
    for (let s = 0; s < 5; s++) {
      visitAndBuy(p, s, true);
    }
    expect(getRumorHistory(p).entries.length).toBeLessThanOrEqual(4);
    expect(rumorStreakCount(p)).toBe(getRumorHistory(p).entries.length);
  });
});
