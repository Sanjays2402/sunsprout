// Barometer — Pip's cart premium item that extends the weather
// forecast HUD from one day ahead to two days ahead.
import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import {
  BAROMETER_INVENTORY_KEY,
  BAROMETER_PRICE,
  barometerBoughtLine,
  hasBarometer,
  weatherDayAfterTomorrow,
} from '../src/game/barometer';
import { rollWeather } from '../src/game/weather';
import { CART_X, CART_Y, buyFromCart } from '../src/game/cart';
import { TimeOfDay } from '../src/game/time';

function freshPlayer(gold = 1000): Player {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = gold;
  return w.player;
}

function openTime(day = 3, season: 0 | 1 | 2 | 3 = 0): TimeOfDay {
  const t = new TimeOfDay();
  t.day = day;
  t.hour = 10;
  t.minute = 0;
  t.season = season;
  return t;
}

describe('hasBarometer', () => {
  it('is false on a fresh player', () => {
    expect(hasBarometer(freshPlayer())).toBe(false);
  });

  it('is true once the inventory has at least one', () => {
    const p = freshPlayer();
    p.inventory[BAROMETER_INVENTORY_KEY] = 1;
    expect(hasBarometer(p)).toBe(true);
  });

  it('is false again if the inventory is forced back to zero', () => {
    const p = freshPlayer();
    p.inventory[BAROMETER_INVENTORY_KEY] = 0;
    expect(hasBarometer(p)).toBe(false);
  });
});

describe('weatherDayAfterTomorrow', () => {
  it('reads from (season, day+2) within a season', () => {
    const t = openTime(3, 1);
    expect(weatherDayAfterTomorrow(t)).toBe(rollWeather(1, 5));
  });

  it('wraps day 6 → day 1 of the next season (6 + 2 = 8 → next-season day 1)', () => {
    const t = openTime(6, 1);
    expect(weatherDayAfterTomorrow(t)).toBe(rollWeather(2, 1));
  });

  it('wraps day 7 → day 2 of the next season (7 + 2 = 9 → next-season day 2)', () => {
    const t = openTime(7, 1);
    expect(weatherDayAfterTomorrow(t)).toBe(rollWeather(2, 2));
  });

  it('wraps season 3 → season 0', () => {
    const t = openTime(6, 3);
    expect(weatherDayAfterTomorrow(t)).toBe(rollWeather(0, 1));
  });
});

describe('barometer cart purchase', () => {
  it('costs BAROMETER_PRICE gold and lands one in the bag', () => {
    const p = freshPlayer(500);
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), BAROMETER_INVENTORY_KEY);
    expect(out.kind).toBe('bought');
    expect(p.gold).toBe(500 - BAROMETER_PRICE);
    expect(p.inventory[BAROMETER_INVENTORY_KEY]).toBe(1);
    expect(hasBarometer(p)).toBe(true);
  });

  it('refuses a re-buy on a player who already owns one', () => {
    const p = freshPlayer(1000);
    p.inventory[BAROMETER_INVENTORY_KEY] = 1;
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), BAROMETER_INVENTORY_KEY);
    expect(out.kind).toBe('already-owned');
    expect(p.gold).toBe(1000);
    expect(p.inventory[BAROMETER_INVENTORY_KEY]).toBe(1);
  });

  it('refuses when the player cannot afford it', () => {
    const p = freshPlayer(BAROMETER_PRICE - 1);
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), BAROMETER_INVENTORY_KEY);
    expect(out.kind).toBe('not-enough-gold');
    expect(p.gold).toBe(BAROMETER_PRICE - 1);
    expect(p.inventory[BAROMETER_INVENTORY_KEY] ?? 0).toBe(0);
  });
});

describe('barometerBoughtLine', () => {
  it('mentions the two-day reach', () => {
    expect(barometerBoughtLine()).toMatch(/two days/i);
  });
});
