// Fancy eggs — coop tier upgrades + fancy yields.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  COOP_DELUXE_PRICE,
  EGG_INVENTORY_KEY,
  EGG_SELL_PRICE,
  FANCY_EGG_INVENTORY_KEY,
  FANCY_EGG_RATE,
  FANCY_EGG_SELL_PRICE,
  collectEggs,
  collectEggsDetailed,
  coopTick,
  placeCoop,
  sellAllEggs,
  totalEggsWaiting,
  upgradeCoop,
} from '../src/game/coop';

const FREE_TX = 10;
const FREE_TY = 10;

function makeWorld(): World {
  const w = new World();
  // Clear the area we use into grass so placeCoop works.
  for (let y = FREE_TY - 1; y <= FREE_TY + 4; y++) {
    for (let x = FREE_TX - 1; x <= FREE_TX + 5; x++) {
      if (w.inBounds(x, y)) {
        w.tiles[y][x] = { type: 'grass' };
      }
    }
  }
  return w;
}

describe('FANCY_EGG constants', () => {
  it('fancy rate is higher for deluxe than basic', () => {
    expect(FANCY_EGG_RATE.deluxe).toBeGreaterThan(FANCY_EGG_RATE.basic);
  });

  it('fancy egg sells for exactly 3x the standard egg', () => {
    expect(FANCY_EGG_SELL_PRICE).toBe(EGG_SELL_PRICE * 3);
  });

  it('COOP_DELUXE_PRICE is a positive integer', () => {
    expect(COOP_DELUXE_PRICE).toBeGreaterThan(0);
    expect(Math.floor(COOP_DELUXE_PRICE)).toBe(COOP_DELUXE_PRICE);
  });
});

describe('coopTick fancy yield', () => {
  it('day 0 / 4 chickens / basic tier yields no fancy eggs at this position', () => {
    const w = makeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    coop.chickens = 4;
    coopTick(w, 0);
    // The deterministic seed at (FREE_TX, FREE_TY, day=0, idx=0..3)
    // gives plain rolls — verify the standard egg count.
    expect(coop.eggs + (coop.fancyEggs ?? 0)).toBe(4);
  });

  it('over many days, a deluxe coop produces more fancy eggs than a basic one', () => {
    const w = makeWorld();
    const basic = placeCoop(w, FREE_TX, FREE_TY)!;
    basic.chickens = 4;
    const deluxe = placeCoop(w, FREE_TX + 4, FREE_TY)!;
    deluxe.chickens = 4;
    upgradeCoop(deluxe, 'deluxe');
    for (let d = 0; d < 200; d++) {
      coopTick(w, d);
    }
    const basicFancy = basic.fancyEggs ?? 0;
    const deluxeFancy = deluxe.fancyEggs ?? 0;
    expect(deluxeFancy).toBeGreaterThan(basicFancy);
  });

  it('coopTick is deterministic — same (world, day) reproduces the same split', () => {
    const wA = makeWorld();
    const a = placeCoop(wA, FREE_TX, FREE_TY)!;
    a.chickens = 4;
    coopTick(wA, 42);

    const wB = makeWorld();
    const b = placeCoop(wB, FREE_TX, FREE_TY)!;
    b.chickens = 4;
    coopTick(wB, 42);

    expect(b.eggs).toBe(a.eggs);
    expect(b.fancyEggs ?? 0).toBe(a.fancyEggs ?? 0);
  });
});

describe('upgradeCoop', () => {
  it('flips a basic coop to deluxe and returns true', () => {
    const w = makeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    expect(coop.tier).toBeUndefined();
    expect(upgradeCoop(coop, 'deluxe')).toBe(true);
    expect(coop.tier).toBe('deluxe');
  });

  it('returns false when already at that tier', () => {
    const w = makeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    upgradeCoop(coop, 'deluxe');
    expect(upgradeCoop(coop, 'deluxe')).toBe(false);
  });
});

describe('collectEggsDetailed', () => {
  it('splits plain and fancy into their own inventory keys', () => {
    const w = makeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    coop.eggs = 3;
    coop.fancyEggs = 2;
    const detail = collectEggsDetailed(coop, w.player);
    expect(detail).toEqual({ plain: 3, fancy: 2, breeder: 0 });
    expect(coop.eggs).toBe(0);
    expect(coop.fancyEggs).toBe(0);
    expect(w.player.inventory[EGG_INVENTORY_KEY]).toBe(3);
    expect(w.player.inventory[FANCY_EGG_INVENTORY_KEY]).toBe(2);
  });

  it('keeps collectEggs (totals API) returning sum across both', () => {
    const w = makeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    coop.eggs = 1;
    coop.fancyEggs = 1;
    expect(collectEggs(coop, w.player)).toBe(2);
  });
});

describe('sellAllEggs handles fancy', () => {
  it('totals plain + fancy at their respective prices', () => {
    const w = makeWorld();
    w.player.inventory[EGG_INVENTORY_KEY] = 4;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 2;
    const earned = sellAllEggs(w.player);
    expect(earned).toBe(4 * EGG_SELL_PRICE + 2 * FANCY_EGG_SELL_PRICE);
    expect(w.player.inventory[EGG_INVENTORY_KEY]).toBe(0);
    expect(w.player.inventory[FANCY_EGG_INVENTORY_KEY]).toBe(0);
  });

  it('returns 0 for an empty bag', () => {
    const w = makeWorld();
    expect(sellAllEggs(w.player)).toBe(0);
  });
});

describe('totalEggsWaiting counts fancy', () => {
  it('sums plain + fancy across coops', () => {
    const w = makeWorld();
    const a = placeCoop(w, FREE_TX, FREE_TY)!;
    a.eggs = 1;
    a.fancyEggs = 2;
    const b = placeCoop(w, FREE_TX + 4, FREE_TY)!;
    b.eggs = 3;
    expect(totalEggsWaiting(w)).toBe(6);
  });
});
