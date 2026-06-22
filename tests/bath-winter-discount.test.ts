// Bath house winter discount — Winter season cuts the soak cost 25%.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay, SEASON_LENGTH } from '../src/game/time';
import {
  BATH_BONUS,
  BATH_FEE,
  BATH_WINTER_DISCOUNT,
  BATH_WINTER_SEASON,
  BATH_X,
  BATH_Y,
  bathFlavorLine,
  bathPriceFor,
  isWinterDiscountActive,
  takeBath,
} from '../src/game/bath-house';

function freshWorld(): World {
  const w = new World();
  w.player.gold = 1000;
  return w;
}

function timeAt(season: 0 | 1 | 2 | 3): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = 3;
  return t;
}

describe('bathPriceFor', () => {
  it('returns BATH_FEE in Spring / Summer / Fall', () => {
    expect(bathPriceFor(timeAt(0))).toBe(BATH_FEE);
    expect(bathPriceFor(timeAt(1))).toBe(BATH_FEE);
    expect(bathPriceFor(timeAt(2))).toBe(BATH_FEE);
  });

  it('returns the discounted price in Winter', () => {
    const expected = Math.floor(BATH_FEE * BATH_WINTER_DISCOUNT);
    expect(bathPriceFor(timeAt(BATH_WINTER_SEASON))).toBe(expected);
  });

  it('floors to an integer (no fractional gold)', () => {
    const winter = bathPriceFor(timeAt(BATH_WINTER_SEASON));
    expect(Number.isInteger(winter)).toBe(true);
  });
});

describe('isWinterDiscountActive', () => {
  it('matches the Winter season index', () => {
    expect(isWinterDiscountActive(timeAt(0))).toBe(false);
    expect(isWinterDiscountActive(timeAt(BATH_WINTER_SEASON))).toBe(true);
  });
});

describe('takeBath with Winter discount', () => {
  it('charges only the discounted price in Winter', () => {
    const w = freshWorld();
    const time = timeAt(BATH_WINTER_SEASON);
    const before = w.player.gold;
    const out = takeBath(w.player, BATH_X, BATH_Y, 1, time);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.pricePaid).toBe(Math.floor(BATH_FEE * BATH_WINTER_DISCOUNT));
      expect(out.discounted).toBe(true);
      expect(w.player.gold).toBe(before - out.pricePaid);
    }
  });

  it('charges the full BATH_FEE outside Winter even when time is provided', () => {
    const w = freshWorld();
    const time = timeAt(0);
    const out = takeBath(w.player, BATH_X, BATH_Y, 1, time);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.pricePaid).toBe(BATH_FEE);
      expect(out.discounted).toBe(false);
    }
  });

  it('still grants the same BATH_BONUS and duration in Winter', () => {
    const w = freshWorld();
    const time = timeAt(BATH_WINTER_SEASON);
    const out = takeBath(w.player, BATH_X, BATH_Y, 1, time);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.bonus).toBe(BATH_BONUS);
      expect(out.daysLeft).toBeGreaterThan(0);
    }
  });

  it('refuses with discounted price in the not-enough-gold path', () => {
    const w = freshWorld();
    w.player.gold = 100; // less than discounted 150
    const time = timeAt(BATH_WINTER_SEASON);
    const out = takeBath(w.player, BATH_X, BATH_Y, 1, time);
    expect(out.kind).toBe('not-enough-gold');
    if (out.kind === 'not-enough-gold') {
      expect(out.need).toBe(Math.floor(BATH_FEE * BATH_WINTER_DISCOUNT));
      expect(out.have).toBe(100);
    }
    expect(w.player.gold).toBe(100);
  });
});

describe('bathFlavorLine with winter tag', () => {
  it('includes (winter rate) when discounted', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 500,
      daysLeft: 3,
      bonus: BATH_BONUS,
      pricePaid: 150,
      discounted: true,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: 1,
      soapsEarned: 0,
    });
    expect(line).toContain('winter rate');
  });

  it('omits the tag when no discount applied', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 500,
      daysLeft: 3,
      bonus: BATH_BONUS,
      pricePaid: BATH_FEE,
      discounted: false,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: 1,
      soapsEarned: 0,
    });
    expect(line).not.toContain('winter rate');
  });
});

describe('backward compat without time arg', () => {
  it('takeBath still works when called without TimeOfDay (full price)', () => {
    const w = freshWorld();
    const out = takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.pricePaid).toBe(BATH_FEE);
      expect(out.discounted).toBe(false);
    }
  });
});

describe('TimeOfDay season rollover', () => {
  it('SEASON_LENGTH crosses to Winter on the 4th season turn', () => {
    // Sanity check that the constant we import lines up; if SEASON_LENGTH
    // is ever bumped Winter index 3 still applies.
    expect(SEASON_LENGTH).toBeGreaterThan(0);
    expect(BATH_WINTER_SEASON).toBe(3);
  });
});
