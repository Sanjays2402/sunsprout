// Minimap action pings — minimapPings() derives "act here now" markers
// from the same predicates the rest of the game uses.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { minimapPings, WELL_PING_X, WELL_PING_Y } from '../src/game/minimap';
import { BOARD_X, BOARD_Y, refreshBoard } from '../src/game/board';
import { CART_X, CART_Y } from '../src/game/cart';
import type { Player } from '../src/world/world';
import type { TimeOfDay } from '../src/game/time';

function t(season: number, day: number, hour: number): TimeOfDay {
  return { season, day, hour, minute: 0 } as TimeOfDay;
}

describe('minimapPings', () => {
  it('is empty on a calm day with nothing to do', () => {
    const w = new World();
    // Spring day 1, mid-morning: no cart (day 3), no tournament (day 6),
    // and a fresh player can't turn in the weekly quest.
    const pings = minimapPings(w.player, t(0, 1, 10));
    expect(pings).toEqual([]);
  });

  it('pings the board when the weekly quest can be turned in', () => {
    const w = new World();
    const p = w.player;
    // Spring's quest is the wheat mill order (10 wheat_harvest).
    const quest = refreshBoard(p, t(0, 1, 10));
    p.inventory[quest.requireKey] = quest.requireCount;
    const pings = minimapPings(p, t(0, 1, 10));
    const board = pings.find((x) => x.tx === BOARD_X && x.ty === BOARD_Y);
    expect(board).toBeTruthy();
    expect(board!.reason).toMatch(/quest/i);
  });

  it('pings the cart while Pip is parked + open', () => {
    const w = new World();
    // Cart visits day 3, open 9-18.
    const pings = minimapPings(w.player, t(0, 3, 12));
    const cart = pings.find((x) => x.tx === CART_X && x.ty === CART_Y);
    expect(cart).toBeTruthy();
  });

  it('does not ping the cart outside its open hours', () => {
    const w = new World();
    const pings = minimapPings(w.player, t(0, 3, 20));
    expect(pings.find((x) => x.tx === CART_X && x.ty === CART_Y)).toBeUndefined();
  });

  it('pings the well during tournament hours before the player enters', () => {
    const w = new World();
    // Tournament runs day 6, 14-18.
    const pings = minimapPings(w.player, t(0, 6, 15));
    const well = pings.find((x) => x.tx === WELL_PING_X && x.ty === WELL_PING_Y);
    expect(well).toBeTruthy();
    expect(well!.reason).toMatch(/tournament/i);
  });

  it('every ping carries a colour and a non-empty reason', () => {
    const w = new World();
    const p = w.player;
    const quest = refreshBoard(p, t(0, 3, 12));
    p.inventory[quest.requireKey] = quest.requireCount;
    // Day 3 noon: cart open + quest ready -> at least two pings.
    const pings = minimapPings(p, t(0, 3, 12));
    expect(pings.length).toBeGreaterThanOrEqual(2);
    for (const ping of pings) {
      expect(ping.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ping.reason.length).toBeGreaterThan(0);
      // No emoji in chrome text.
      expect(ping.reason).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it('keeps every ping inside the world bounds', () => {
    const w = new World();
    const p = w.player;
    const quest = refreshBoard(p, t(0, 3, 15));
    p.inventory[quest.requireKey] = quest.requireCount;
    const pings = minimapPings(p, t(0, 3, 15));
    for (const ping of pings) {
      expect(ping.tx).toBeGreaterThanOrEqual(0);
      expect(ping.tx).toBeLessThan(w.width);
      expect(ping.ty).toBeGreaterThanOrEqual(0);
      expect(ping.ty).toBeLessThan(w.height);
    }
  });
});
