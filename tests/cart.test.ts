// Travelling merchant cart — Pip's schedule, purchases, arrival toast.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  CART_CATALOG,
  CART_OPEN_HOUR,
  CART_CLOSE_HOUR,
  CART_VISIT_DAY,
  CART_X,
  CART_Y,
  buyFromCart,
  cartArrivalLine,
  cartOpen,
  cartVisitToday,
  nearCart,
} from '../src/game/cart';

function timeAt(day: number, hour: number, season: 0 | 1 | 2 | 3 = 0): TimeOfDay {
  const t = new TimeOfDay(hour);
  t.day = day;
  t.season = season;
  return t;
}

describe('cart schedule', () => {
  it('cartVisitToday is true on day CART_VISIT_DAY', () => {
    expect(cartVisitToday(timeAt(CART_VISIT_DAY, 10))).toBe(true);
    expect(cartVisitToday(timeAt(CART_VISIT_DAY, 10, 2))).toBe(true);
    expect(cartVisitToday(timeAt(CART_VISIT_DAY + 1, 10))).toBe(false);
  });

  it('cartOpen tracks the hour window', () => {
    expect(cartOpen(timeAt(CART_VISIT_DAY, CART_OPEN_HOUR))).toBe(true);
    expect(cartOpen(timeAt(CART_VISIT_DAY, CART_CLOSE_HOUR - 1))).toBe(true);
    expect(cartOpen(timeAt(CART_VISIT_DAY, CART_CLOSE_HOUR))).toBe(false);
    expect(cartOpen(timeAt(CART_VISIT_DAY, CART_OPEN_HOUR - 1))).toBe(false);
  });

  it('cartOpen is false on non-visit days', () => {
    expect(cartOpen(timeAt(1, 12))).toBe(false);
    expect(cartOpen(timeAt(7, 12))).toBe(false);
  });
});

describe('nearCart', () => {
  it('true within Chebyshev radius 1', () => {
    expect(nearCart(CART_X, CART_Y)).toBe(true);
    expect(nearCart(CART_X + 1, CART_Y)).toBe(true);
    expect(nearCart(CART_X - 1, CART_Y + 1)).toBe(true);
  });

  it('false beyond the radius', () => {
    expect(nearCart(CART_X + 3, CART_Y)).toBe(false);
    expect(nearCart(CART_X, CART_Y - 3)).toBe(false);
  });
});

describe('CART_CATALOG', () => {
  it('every row has a positive price + readable label', () => {
    expect(CART_CATALOG.length).toBeGreaterThan(0);
    for (const item of CART_CATALOG) {
      expect(item.buyPrice).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.key.length).toBeGreaterThan(0);
    }
  });

  it('includes premium drink keys that match the stamina restore catalog', () => {
    const keys = CART_CATALOG.map((i) => i.key);
    expect(keys).toContain('dish-hot-cocoa');
    expect(keys).toContain('dish-herb-tea');
  });
});

describe('buyFromCart', () => {
  it('refuses when the cart is closed', () => {
    const w = new World();
    w.player.gold = 1000;
    const t = timeAt(1, 12); // not the visit day
    const out = buyFromCart(w.player, CART_X, CART_Y, t, 'flower');
    expect(out.kind).toBe('closed');
    expect(w.player.gold).toBe(1000);
  });

  it('refuses when the player is too far', () => {
    const w = new World();
    w.player.gold = 1000;
    const t = timeAt(CART_VISIT_DAY, 12);
    const out = buyFromCart(w.player, 1, 1, t, 'flower');
    expect(out.kind).toBe('too-far');
  });

  it('refuses an unknown item key', () => {
    const w = new World();
    w.player.gold = 1000;
    const t = timeAt(CART_VISIT_DAY, 12);
    const out = buyFromCart(w.player, CART_X, CART_Y, t, 'banana-tree');
    expect(out.kind).toBe('unknown-item');
  });

  it('refuses when the player cannot afford it', () => {
    const w = new World();
    w.player.gold = 10;
    const t = timeAt(CART_VISIT_DAY, 12);
    const out = buyFromCart(w.player, CART_X, CART_Y, t, 'flower');
    expect(out.kind).toBe('not-enough-gold');
    if (out.kind === 'not-enough-gold') {
      expect(out.need).toBeGreaterThan(0);
      expect(out.have).toBe(10);
    }
    expect(w.player.gold).toBe(10);
  });

  it('grants the item and deducts gold on success', () => {
    const w = new World();
    w.player.gold = 1000;
    const t = timeAt(CART_VISIT_DAY, 12);
    const flower = CART_CATALOG.find((i) => i.key === 'flower')!;
    const out = buyFromCart(w.player, CART_X, CART_Y, t, 'flower');
    expect(out.kind).toBe('bought');
    expect(w.player.gold).toBe(1000 - flower.buyPrice);
    expect(w.player.inventory.flower).toBe(1);
  });

  it('stacks repeat purchases', () => {
    const w = new World();
    w.player.gold = 10000;
    const t = timeAt(CART_VISIT_DAY, 12);
    buyFromCart(w.player, CART_X, CART_Y, t, 'flower');
    buyFromCart(w.player, CART_X, CART_Y, t, 'flower');
    buyFromCart(w.player, CART_X, CART_Y, t, 'flower');
    expect(w.player.inventory.flower).toBe(3);
  });
});

describe('cartArrivalLine', () => {
  it('mentions the hour window', () => {
    expect(cartArrivalLine()).toContain('09');
    expect(cartArrivalLine()).toContain('18');
  });
});
