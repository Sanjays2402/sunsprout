// Festivals — calendar dates, banners, and economic multipliers.
import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  FESTIVALS,
  FESTIVAL_KEYS,
  cropSellMultiplier,
  daysUntilFestival,
  festivalBanner,
  festivalCalendar,
  festivalToday,
  isFestivalToday,
  seedBuyMultiplier,
} from '../src/game/festivals';
import { sellAllHarvest } from '../src/game/economy';
import { World } from '../src/world/world';

function timeAt(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = day;
  return t;
}

describe('festivals catalog', () => {
  it('exposes Spring Planting Fair and Fall Harvest Festival', () => {
    expect(FESTIVAL_KEYS).toContain('planting-fair');
    expect(FESTIVAL_KEYS).toContain('harvest-festival');
    expect(FESTIVALS['planting-fair'].season).toBe(0);
    expect(FESTIVALS['planting-fair'].day).toBe(7);
    expect(FESTIVALS['harvest-festival'].season).toBe(2);
    expect(FESTIVALS['harvest-festival'].day).toBe(7);
  });

  it('multipliers are sane (half-price seeds, premium crops)', () => {
    expect(FESTIVALS['planting-fair'].seedBuyMultiplier).toBe(0.5);
    expect(FESTIVALS['planting-fair'].cropSellMultiplier).toBe(1);
    expect(FESTIVALS['harvest-festival'].cropSellMultiplier).toBe(1.5);
    expect(FESTIVALS['harvest-festival'].seedBuyMultiplier).toBe(1);
  });
});

describe('festivalToday and helpers', () => {
  it('returns the Planting Fair on Spring day 7', () => {
    const t = timeAt(0, 7);
    expect(festivalToday(t)?.key).toBe('planting-fair');
    expect(isFestivalToday('planting-fair', t)).toBe(true);
    expect(isFestivalToday('harvest-festival', t)).toBe(false);
  });

  it('returns the Harvest Festival on Fall day 7', () => {
    const t = timeAt(2, 7);
    expect(festivalToday(t)?.key).toBe('harvest-festival');
    expect(isFestivalToday('harvest-festival', t)).toBe(true);
  });

  it('returns null on a quiet day', () => {
    const t = timeAt(1, 3);
    expect(festivalToday(t)).toBeNull();
    expect(festivalBanner(t)).toBeNull();
  });

  it('banner string fires only on festival days', () => {
    expect(festivalBanner(timeAt(0, 7))).toContain('Planting');
    expect(festivalBanner(timeAt(2, 7))).toContain('Harvest');
  });

  it('seed buy multiplier defaults to 1 and drops to 0.5 on the fair', () => {
    expect(seedBuyMultiplier(timeAt(1, 3))).toBe(1);
    expect(seedBuyMultiplier(timeAt(0, 7))).toBe(0.5);
  });

  it('crop sell multiplier defaults to 1 and lifts to 1.5 on harvest day', () => {
    expect(cropSellMultiplier(timeAt(1, 3))).toBe(1);
    expect(cropSellMultiplier(timeAt(2, 7))).toBe(1.5);
  });
});

describe('festival calendar wrap', () => {
  it('daysUntilFestival counts forward and wraps the year', () => {
    expect(daysUntilFestival('planting-fair', timeAt(0, 7))).toBe(0);
    expect(daysUntilFestival('planting-fair', timeAt(0, 6))).toBe(1);
    expect(daysUntilFestival('harvest-festival', timeAt(0, 7))).toBe(7 + 7);
    expect(daysUntilFestival('planting-fair', timeAt(3, 7))).toBe(7);
  });

  it('festivalCalendar sorts by daysUntil', () => {
    const cal = festivalCalendar(timeAt(0, 5));
    expect(cal[0].key).toBe('planting-fair');
    expect(cal[0].daysUntil).toBe(2);
  });
});

describe('festival economy hooks', () => {
  it('sellAllHarvest with festival multiplier scales every bucket', () => {
    const w = new World();
    const p = w.player;
    p.inventory = {};
    p.gold = 0;
    p.inventory.wheat_harvest = 1;        // 8g
    p.inventory.wheat_harvest_silver = 1; // 12g
    p.inventory.wheat_harvest_gold = 1;   // 16g
    const baseEarned = sellAllHarvest(p, 1);
    expect(baseEarned).toBe(8 + 12 + 16);
    // Refill and test the 1.5x festival boost.
    p.inventory.wheat_harvest = 1;
    p.inventory.wheat_harvest_silver = 1;
    p.inventory.wheat_harvest_gold = 1;
    const festBefore = p.gold;
    const festEarned = sellAllHarvest(p, 1.5);
    expect(festEarned).toBe(Math.floor(8 * 1.5) + Math.floor(12 * 1.5) + Math.floor(16 * 1.5));
    expect(p.gold).toBe(festBefore + festEarned);
  });
});
