// Weekday market — deterministic per-(season,day) discount + price math.
import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  MARKET_DISCOUNT_PCT,
  MARKET_DISCOUNT_MULT,
  MARKET_ELIGIBLE_KEYS,
  discountedPrice,
  isMarketDealToday,
  marketBannerLine,
  marketTodayKey,
} from '../src/game/weekday-market';
import { SHOP_ITEMS } from '../src/game/economy';

function t(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const time = new TimeOfDay(8);
  time.day = day;
  time.season = season;
  return time;
}

describe('MARKET_ELIGIBLE_KEYS', () => {
  it('contains every buyable SHOP_ITEMS row + nothing else', () => {
    const expectedSet = new Set(
      SHOP_ITEMS.filter((i) => i.buyPrice != null).map((i) => i.key),
    );
    expect(MARKET_ELIGIBLE_KEYS.length).toBe(expectedSet.size);
    for (const k of MARKET_ELIGIBLE_KEYS) {
      expect(expectedSet.has(k)).toBe(true);
    }
    // No sell-only rows leaked through.
    for (const k of MARKET_ELIGIBLE_KEYS) {
      const row = SHOP_ITEMS.find((i) => i.key === k)!;
      expect(row.buyPrice).not.toBeNull();
    }
  });
});

describe('marketTodayKey', () => {
  it('returns a valid catalog key', () => {
    const k = marketTodayKey(t(0, 1));
    expect(k).not.toBeNull();
    expect(MARKET_ELIGIBLE_KEYS).toContain(k);
  });

  it('is deterministic for the same (season, day)', () => {
    expect(marketTodayKey(t(0, 1))).toBe(marketTodayKey(t(0, 1)));
    expect(marketTodayKey(t(2, 5))).toBe(marketTodayKey(t(2, 5)));
  });

  it('rotates across days within the same season', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      seen.add(marketTodayKey(t(0, d)) ?? '');
    }
    // Realistically a 7-day rotation should hit at least 4 distinct keys.
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('rotates across seasons within the same day', () => {
    const a = marketTodayKey(t(0, 3));
    const b = marketTodayKey(t(1, 3));
    expect(a).not.toBe(b);
  });
});

describe('isMarketDealToday', () => {
  it('matches the marketTodayKey result', () => {
    const time = t(0, 1);
    const key = marketTodayKey(time)!;
    expect(isMarketDealToday(time, key)).toBe(true);
    // Pick a different key — any other eligible key — and expect false.
    const other = MARKET_ELIGIBLE_KEYS.find((k) => k !== key)!;
    expect(isMarketDealToday(time, other)).toBe(false);
  });
});

describe('discountedPrice', () => {
  it('cuts the price by MARKET_DISCOUNT_PCT for the featured key', () => {
    const time = t(0, 1);
    const key = marketTodayKey(time)!;
    const row = SHOP_ITEMS.find((i) => i.key === key)!;
    const base = row.buyPrice!;
    const discounted = discountedPrice(time, key, base);
    expect(discounted).toBe(Math.max(1, Math.ceil(base * MARKET_DISCOUNT_MULT)));
    expect(discounted).toBeLessThan(base);
  });

  it('returns base price untouched for other keys', () => {
    const time = t(0, 1);
    const featured = marketTodayKey(time)!;
    const other = MARKET_ELIGIBLE_KEYS.find((k) => k !== featured)!;
    expect(discountedPrice(time, other, 100)).toBe(100);
  });

  it('clamps at 1g (never zero)', () => {
    const time = t(0, 1);
    const key = marketTodayKey(time)!;
    expect(discountedPrice(time, key, 1)).toBe(1);
  });

  it('mult constant is 1 - pct/100', () => {
    expect(MARKET_DISCOUNT_MULT).toBeCloseTo(1 - MARKET_DISCOUNT_PCT / 100, 5);
  });
});

describe('marketBannerLine', () => {
  it('mentions the discount percentage + the new price', () => {
    const time = t(0, 1);
    const line = marketBannerLine(time);
    expect(line).toMatch(new RegExp(`${MARKET_DISCOUNT_PCT}%`));
    expect(line).toMatch(/Today's deal/);
    expect(line).toMatch(/g/);
  });

  it('returns the same string for the same (season, day)', () => {
    expect(marketBannerLine(t(1, 4))).toBe(marketBannerLine(t(1, 4)));
  });
});
