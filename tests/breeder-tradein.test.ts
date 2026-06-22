// Breeder egg trade-in — Pip pays 2x the fancy-egg sell price for every
// breeder egg in the bag when the player walks up to the cart and opens
// the menu (the trade fires automatically before the menu opens).
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BREEDER_TRADEIN_MULTIPLIER,
  BREEDER_TRADEIN_PRICE,
  CART_X,
  CART_Y,
  breederTradeInLine,
  tradeBreederEggs,
} from '../src/game/cart';
import { BREEDER_EGG_INVENTORY_KEY, FANCY_EGG_SELL_PRICE } from '../src/game/coop';
import { TimeOfDay } from '../src/game/time';

function openTime(): TimeOfDay {
  const t = new TimeOfDay();
  t.day = 3;
  t.hour = 10;
  t.minute = 0;
  t.season = 0;
  return t;
}

function closedTime(): TimeOfDay {
  const t = new TimeOfDay();
  // Day 4 — Pip already left.
  t.day = 4;
  t.hour = 10;
  return t;
}

function freshPlayer(gold = 0): World {
  const w = new World();
  w.player.gold = gold;
  w.player.inventory = {};
  return w;
}

describe('BREEDER_TRADEIN_PRICE pricing', () => {
  it('is 2x the fancy-egg sell price (matches the trade-in spec)', () => {
    expect(BREEDER_TRADEIN_MULTIPLIER).toBe(2);
    expect(BREEDER_TRADEIN_PRICE).toBe(FANCY_EGG_SELL_PRICE * 2);
  });
});

describe('tradeBreederEggs', () => {
  it('returns "none" when the player has no breeder eggs', () => {
    const w = freshPlayer(100);
    const out = tradeBreederEggs(w.player, CART_X, CART_Y, openTime());
    expect(out.kind).toBe('none');
    expect(w.player.gold).toBe(100);
  });

  it('pays BREEDER_TRADEIN_PRICE per egg and zeroes the bag', () => {
    const w = freshPlayer(50);
    w.player.inventory[BREEDER_EGG_INVENTORY_KEY] = 3;
    const out = tradeBreederEggs(w.player, CART_X, CART_Y, openTime());
    expect(out.kind).toBe('traded');
    if (out.kind === 'traded') {
      expect(out.eggs).toBe(3);
      expect(out.gold).toBe(3 * BREEDER_TRADEIN_PRICE);
      expect(out.remainingGold).toBe(50 + 3 * BREEDER_TRADEIN_PRICE);
    }
    expect(w.player.inventory[BREEDER_EGG_INVENTORY_KEY]).toBe(0);
    expect(w.player.gold).toBe(50 + 3 * BREEDER_TRADEIN_PRICE);
  });

  it('refuses when the cart is closed (Pip is not visiting today)', () => {
    const w = freshPlayer();
    w.player.inventory[BREEDER_EGG_INVENTORY_KEY] = 1;
    const out = tradeBreederEggs(w.player, CART_X, CART_Y, closedTime());
    expect(out.kind).toBe('closed');
    expect(w.player.inventory[BREEDER_EGG_INVENTORY_KEY]).toBe(1);
    expect(w.player.gold).toBe(0);
  });

  it('refuses when the player is not near the cart', () => {
    const w = freshPlayer();
    w.player.inventory[BREEDER_EGG_INVENTORY_KEY] = 1;
    // 10 tiles north of the cart.
    const out = tradeBreederEggs(w.player, CART_X, CART_Y - 10, openTime());
    expect(out.kind).toBe('too-far');
    expect(w.player.inventory[BREEDER_EGG_INVENTORY_KEY]).toBe(1);
    expect(w.player.gold).toBe(0);
  });
});

describe('breederTradeInLine flavor', () => {
  it('singular form for one egg', () => {
    const line = breederTradeInLine({ kind: 'traded', eggs: 1, gold: BREEDER_TRADEIN_PRICE, remainingGold: 0 });
    expect(line).toContain('breeder egg');
    expect(line).not.toContain('breeder eggs');
    expect(line).toContain(String(BREEDER_TRADEIN_PRICE));
  });

  it('plural form for multiple eggs', () => {
    const line = breederTradeInLine({ kind: 'traded', eggs: 4, gold: 4 * BREEDER_TRADEIN_PRICE, remainingGold: 0 });
    expect(line).toContain('breeder eggs');
    expect(line).toContain(String(4 * BREEDER_TRADEIN_PRICE));
  });
});
