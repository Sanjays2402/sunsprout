// Town-board reputation — tier boundaries, multiplier math, bonus split.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  REP_TIERS,
  applyRepBonus,
  completionsToNextTier,
  nextRepTier,
  playerRepTier,
  repBannerLine,
  repTier,
} from '../src/game/board-reputation';
import { BOARD_QUESTS, getBoard } from '../src/game/board';

describe('repTier', () => {
  it('newcomer at 0 completions', () => {
    expect(repTier(0).key).toBe('newcomer');
    expect(repTier(2).key).toBe('newcomer');
  });

  it('regular at 3', () => {
    expect(repTier(3).key).toBe('regular');
    expect(repTier(6).key).toBe('regular');
  });

  it('trusted at 7, pillar at 15, cornerstone at 25', () => {
    expect(repTier(7).key).toBe('trusted');
    expect(repTier(14).key).toBe('trusted');
    expect(repTier(15).key).toBe('pillar');
    expect(repTier(24).key).toBe('pillar');
    expect(repTier(25).key).toBe('cornerstone');
    expect(repTier(100).key).toBe('cornerstone');
  });
});

describe('nextRepTier', () => {
  it('points at the next threshold for each tier', () => {
    expect(nextRepTier(0)?.key).toBe('regular');
    expect(nextRepTier(3)?.key).toBe('trusted');
    expect(nextRepTier(15)?.key).toBe('cornerstone');
  });

  it('returns null at the cap tier', () => {
    expect(nextRepTier(25)).toBeNull();
    expect(nextRepTier(50)).toBeNull();
  });
});

describe('completionsToNextTier', () => {
  it('counts down day by day until the next tier', () => {
    expect(completionsToNextTier(0)).toBe(3);
    expect(completionsToNextTier(2)).toBe(1);
    expect(completionsToNextTier(14)).toBe(1);
  });

  it('returns -1 at the cap', () => {
    expect(completionsToNextTier(25)).toBe(-1);
  });
});

describe('playerRepTier', () => {
  it('reads the player\'s board.completedCount', () => {
    const w = new World();
    expect(playerRepTier(w.player).key).toBe('newcomer');
    const board = getBoard(w.player);
    board.completedCount = 10;
    expect(playerRepTier(w.player).key).toBe('trusted');
  });
});

describe('applyRepBonus', () => {
  const quest = BOARD_QUESTS[0];

  it('newcomer earns no bonus (1.0x)', () => {
    const w = new World();
    const out = applyRepBonus(w.player, quest);
    expect(out.tier.key).toBe('newcomer');
    expect(out.boosted).toBe(quest.rewardGold);
    expect(out.bonus).toBe(0);
  });

  it('trusted earns +30% (rounded)', () => {
    const w = new World();
    getBoard(w.player).completedCount = 7;
    const out = applyRepBonus(w.player, quest);
    expect(out.tier.key).toBe('trusted');
    expect(out.boosted).toBe(Math.round(quest.rewardGold * 1.3));
    expect(out.bonus).toBe(out.boosted - quest.rewardGold);
    expect(out.bonus).toBeGreaterThan(0);
  });

  it('cornerstone earns +75%', () => {
    const w = new World();
    getBoard(w.player).completedCount = 25;
    const out = applyRepBonus(w.player, quest);
    expect(out.tier.key).toBe('cornerstone');
    expect(out.boosted).toBe(Math.round(quest.rewardGold * 1.75));
  });

  it('preserves baseGold on the result for logging', () => {
    const w = new World();
    getBoard(w.player).completedCount = 15;
    const out = applyRepBonus(w.player, quest);
    expect(out.baseGold).toBe(quest.rewardGold);
  });
});

describe('repBannerLine', () => {
  it('reads naturally for a newcomer', () => {
    const w = new World();
    const line = repBannerLine(w.player);
    expect(line).toMatch(/Newcomer/);
    expect(line).toMatch(/3 to Regular/);
  });

  it('includes the reward bonus tag at higher tiers', () => {
    const w = new World();
    getBoard(w.player).completedCount = 7;
    const line = repBannerLine(w.player);
    expect(line).toMatch(/Trusted/);
    expect(line).toMatch(/30%/);
  });

  it('omits the "to next" tag at the cap', () => {
    const w = new World();
    getBoard(w.player).completedCount = 25;
    const line = repBannerLine(w.player);
    expect(line).toMatch(/Cornerstone/);
    expect(line).not.toMatch(/to /);
  });
});

describe('REP_TIERS table sanity', () => {
  it('is ordered ascending by minCount', () => {
    for (let i = 1; i < REP_TIERS.length; i++) {
      expect(REP_TIERS[i].minCount).toBeGreaterThan(REP_TIERS[i - 1].minCount);
    }
  });

  it('multipliers are monotonically increasing', () => {
    for (let i = 1; i < REP_TIERS.length; i++) {
      expect(REP_TIERS[i].multiplier).toBeGreaterThan(REP_TIERS[i - 1].multiplier);
    }
  });
});
