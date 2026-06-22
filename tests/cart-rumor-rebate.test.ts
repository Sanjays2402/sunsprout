// Cart rumor reward — buying the headliner Pip teased last visit
// grants a 5% gold-back rebate.
import { describe, it, expect } from 'vitest';
import {
  RUMOR_REBATE_PCT,
  currentSeasonHeadliner,
  isCurrentHeadlinerKey,
  rumorItemForSeason,
  rumorRebateAmount,
} from '../src/game/cart-rumor';
import { CART_CATALOG } from '../src/game/cart';

describe('currentSeasonHeadliner', () => {
  it('returns the item that LAST visit teased (i.e. (season+1) === current_season)', () => {
    // The headliner this season was teased last season:
    //   teased_at = season - 1
    //   rumorItemForSeason(teased_at) === headliner_this_season
    for (let s = 0; s < 4; s++) {
      const prev = (s + 3) % 4;
      const headliner = currentSeasonHeadliner(s);
      expect(headliner).not.toBeNull();
      // Same as the item that "prev" season teased.
      const teasedPrev = rumorItemForSeason(prev);
      expect(headliner!.key).toBe(teasedPrev!.key);
    }
  });

  it('returns a real CART_CATALOG row for every season', () => {
    for (let s = 0; s < 4; s++) {
      const row = currentSeasonHeadliner(s);
      expect(row).not.toBeNull();
      expect(CART_CATALOG.some((r) => r.key === row!.key)).toBe(true);
    }
  });
});

describe('isCurrentHeadlinerKey', () => {
  it('is true for the right key on the right season', () => {
    for (let s = 0; s < 4; s++) {
      const row = currentSeasonHeadliner(s);
      expect(isCurrentHeadlinerKey(s, row!.key)).toBe(true);
    }
  });

  it('is false for an obviously-wrong key', () => {
    for (let s = 0; s < 4; s++) {
      expect(isCurrentHeadlinerKey(s, 'not-a-real-cart-row')).toBe(false);
    }
  });
});

describe('rumorRebateAmount', () => {
  it('is 5% of buy price (RUMOR_REBATE_PCT contract)', () => {
    expect(RUMOR_REBATE_PCT).toBe(0.05);
    expect(rumorRebateAmount(100)).toBe(5);
    expect(rumorRebateAmount(300)).toBe(15);
    expect(rumorRebateAmount(700)).toBe(35);
  });

  it('floors the rebate so tiny buys still play nicely', () => {
    // 19g * 0.05 = 0.95 -> floor 0; we never owe partial gold.
    expect(rumorRebateAmount(19)).toBe(0);
    // 80g * 0.05 = 4 (exact) -> 4
    expect(rumorRebateAmount(80)).toBe(4);
  });

  it('handles 0 cleanly', () => {
    expect(rumorRebateAmount(0)).toBe(0);
  });
});
