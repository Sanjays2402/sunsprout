// Pond stone-rim upgrade — Pip's cart sells a 450g singleton that
// widens the pond's pending-fish cap from 6 to 10. Pondtick + status
// line both honor the new cap when the player has the rim.
import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import {
  POND_MAX_PENDING,
  POND_MAX_PENDING_RIM,
  POND_RIM_INVENTORY_KEY,
  POND_RIM_PRICE,
  getPond,
  hasPondRim,
  pondMaxFor,
  pondStatusLine,
  pondTick,
  stockPond,
} from '../src/game/fish-pond';
import { CART_CATALOG, CART_X, CART_Y, buyFromCart } from '../src/game/cart';
import { TimeOfDay } from '../src/game/time';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function freshPlayer(gold = 1000): Player {
  const w = freshWorld();
  w.player.gold = gold;
  return w.player;
}

function openTime(): TimeOfDay {
  const t = new TimeOfDay();
  t.day = 3;
  t.hour = 10;
  t.minute = 0;
  t.season = 0;
  return t;
}

describe('hasPondRim ownership flag', () => {
  it('is false on a fresh player', () => {
    expect(hasPondRim(freshPlayer())).toBe(false);
  });

  it('is true once the inventory has at least one', () => {
    const p = freshPlayer();
    p.inventory[POND_RIM_INVENTORY_KEY] = 1;
    expect(hasPondRim(p)).toBe(true);
  });
});

describe('pondMaxFor — capacity sourcing', () => {
  it('returns POND_MAX_PENDING when no player is passed', () => {
    expect(pondMaxFor()).toBe(POND_MAX_PENDING);
    expect(POND_MAX_PENDING).toBe(6);
  });

  it('returns POND_MAX_PENDING for a player without the rim', () => {
    expect(pondMaxFor(freshPlayer())).toBe(POND_MAX_PENDING);
  });

  it('returns POND_MAX_PENDING_RIM for a player with the rim', () => {
    const p = freshPlayer();
    p.inventory[POND_RIM_INVENTORY_KEY] = 1;
    expect(pondMaxFor(p)).toBe(POND_MAX_PENDING_RIM);
    expect(POND_MAX_PENDING_RIM).toBe(10);
  });
});

describe('pondTick respects the rim cap', () => {
  it('caps at 6 without the rim', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    // Minnow yields 2/day -> 5 ticks to overflow.
    for (let d = 2; d < 15; d++) pondTick(w, d);
    expect(getPond(w).pending).toBe(POND_MAX_PENDING);
  });

  it('caps at 10 once the rim is installed', () => {
    const w = freshWorld();
    w.player.inventory[POND_RIM_INVENTORY_KEY] = 1;
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    for (let d = 2; d < 20; d++) pondTick(w, d, w.player);
    expect(getPond(w).pending).toBe(POND_MAX_PENDING_RIM);
  });

  it('legacy 2-arg pondTick still caps at the base 6', () => {
    // Calls that don't know about the rim should not accidentally bump
    // the cap. Critical for old tests / external integrations.
    const w = freshWorld();
    w.player.inventory[POND_RIM_INVENTORY_KEY] = 1;
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    for (let d = 2; d < 20; d++) pondTick(w, d); // no player arg
    expect(getPond(w).pending).toBe(POND_MAX_PENDING);
  });
});

describe('pondStatusLine surfaces the rim tag', () => {
  it('adds "rim cap 10" when the player owns the rim and the pond is stocked', () => {
    const w = freshWorld();
    w.player.inventory[POND_RIM_INVENTORY_KEY] = 1;
    w.player.inventory['fish-pike'] = 1;
    stockPond(w, w.player);
    const line = pondStatusLine(getPond(w), w.player);
    expect(line).toContain('rim cap 10');
  });

  it('omits the rim tag when the player does not own the rim', () => {
    const w = freshWorld();
    w.player.inventory['fish-pike'] = 1;
    stockPond(w, w.player);
    const line = pondStatusLine(getPond(w), w.player);
    expect(line).not.toContain('rim cap');
  });

  it('legacy 1-arg pondStatusLine works (no rim tag)', () => {
    const w = freshWorld();
    w.player.inventory['fish-pike'] = 1;
    stockPond(w, w.player);
    const line = pondStatusLine(getPond(w));
    expect(line).not.toContain('rim cap');
  });
});

describe('cart catalog row + singleton guard', () => {
  it('exposes the Stone-Rim Pond Kit at POND_RIM_PRICE', () => {
    const row = CART_CATALOG.find((r) => r.key === POND_RIM_INVENTORY_KEY);
    expect(row).toBeDefined();
    expect(row!.buyPrice).toBe(POND_RIM_PRICE);
    expect(row!.label.toLowerCase()).toContain('pond');
  });

  it('buyFromCart grants the rim and deducts the price', () => {
    const p = freshPlayer(POND_RIM_PRICE + 50);
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), POND_RIM_INVENTORY_KEY);
    expect(out.kind).toBe('bought');
    expect(p.gold).toBe(50);
    expect(p.inventory[POND_RIM_INVENTORY_KEY]).toBe(1);
    expect(hasPondRim(p)).toBe(true);
  });

  it('refuses a re-buy of the rim (singleton)', () => {
    const p = freshPlayer(2_000);
    p.inventory[POND_RIM_INVENTORY_KEY] = 1;
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), POND_RIM_INVENTORY_KEY);
    expect(out.kind).toBe('already-owned');
    expect(p.gold).toBe(2_000);
    expect(p.inventory[POND_RIM_INVENTORY_KEY]).toBe(1);
  });
});
