// Money log — ring buffer, totals, persistence, panel controller.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  MAX_ENTRIES,
  getMoneyLog,
  logGold,
  netChange,
  totalIn,
  totalOut,
  classifyMoneyEntry,
  type MoneyLogEntry,
} from '../src/game/money-log';
import { MoneyLogPanel } from '../src/ui/money-log-panel';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('money-log buffer', () => {
  it('starts empty and ignores zero deltas', () => {
    const w = new World();
    expect(getMoneyLog(w.player)).toEqual([]);
    logGold(w.player, 0, 'nothing', 1);
    expect(getMoneyLog(w.player)).toEqual([]);
  });

  it('newest entries land at the front', () => {
    const w = new World();
    logGold(w.player, 10, 'a', 1);
    logGold(w.player, 20, 'b', 1);
    const log = getMoneyLog(w.player);
    expect(log[0].reason).toBe('b');
    expect(log[1].reason).toBe('a');
  });

  it('caps at MAX_ENTRIES', () => {
    const w = new World();
    for (let i = 0; i < MAX_ENTRIES + 7; i++) {
      logGold(w.player, 1, `e${i}`, 1);
    }
    expect(getMoneyLog(w.player).length).toBe(MAX_ENTRIES);
    // The most recent entry should be e_{MAX+6}.
    expect(getMoneyLog(w.player)[0].reason).toBe(`e${MAX_ENTRIES + 6}`);
  });

  it('totalIn / totalOut / netChange sum correctly', () => {
    const w = new World();
    logGold(w.player, 100, 'well: harvest', 1);
    logGold(w.player, -25, 'shop: bouquet', 1);
    logGold(w.player, 50, 'mining ruby', 2);
    expect(totalIn(w.player)).toBe(150);
    expect(totalOut(w.player)).toBe(25);
    expect(netChange(w.player)).toBe(125);
  });
});

describe('classifyMoneyEntry', () => {
  const mk = (delta: number, reason: string): MoneyLogEntry => ({ delta, reason, day: 1 });

  it('treats every spend (negative delta) as a purchase', () => {
    expect(classifyMoneyEntry(mk(-25, 'shop: bouquet'))).toBe('purchase');
    expect(classifyMoneyEntry(mk(-200, 'bath house: soak'))).toBe('purchase');
    expect(classifyMoneyEntry(mk(-40, 'owl post: Maple'))).toBe('purchase');
    expect(classifyMoneyEntry(mk(-1, 'auto-restock wheat'))).toBe('purchase');
  });

  it('marks counter goods-sales as sales', () => {
    expect(classifyMoneyEntry(mk(100, 'well: harvest'))).toBe('sale');
    expect(classifyMoneyEntry(mk(80, 'well: gems'))).toBe('sale');
    expect(classifyMoneyEntry(mk(60, 'inn: dishes'))).toBe('sale');
    expect(classifyMoneyEntry(mk(12, 'fishing Old Pike'))).toBe('sale');
    expect(classifyMoneyEntry(mk(70, 'mining Gold Nugget'))).toBe('sale');
    expect(classifyMoneyEntry(mk(72, 'cart: breeder trade (x1)'))).toBe('sale');
  });

  it('marks other credits as rewards', () => {
    expect(classifyMoneyEntry(mk(120, 'hangout: Finn'))).toBe('reward');
    expect(classifyMoneyEntry(mk(8, 'farm dog streak'))).toBe('reward');
    expect(classifyMoneyEntry(mk(50, 'quest: First Sprout'))).toBe('reward');
    expect(classifyMoneyEntry(mk(30, 'board: Fetch Quest'))).toBe('reward');
    expect(classifyMoneyEntry(mk(5, 'compost recycle'))).toBe('reward');
  });

  it('does not mistake a cart rebate/streak credit for a breeder-trade sale', () => {
    // Both are positive cart credits, but only the breeder trade is a sale.
    expect(classifyMoneyEntry(mk(3, 'cart: rumor rebate (Brass Lantern)'))).toBe('reward');
    expect(classifyMoneyEntry(mk(5, 'cart: rumor streak (Brass Lantern)'))).toBe('reward');
  });
});

describe('MoneyLogPanel controller', () => {
  it('toggle open + close', () => {
    const m = new MoneyLogPanel();
    expect(m.isVisible()).toBe(false);
    m.toggle();
    expect(m.isVisible()).toBe(true);
    m.toggle();
    expect(m.isVisible()).toBe(false);
  });

  it('respects open lockout', () => {
    const m = new MoneyLogPanel();
    m.open();
    expect(m.canAct()).toBe(false);
    m.update(200);
    expect(m.canAct()).toBe(true);
  });
});

describe('money-log persistence', () => {
  it('survives a snapshot round-trip', () => {
    const a = fakeGame();
    logGold(a.world.player, 100, 'well: harvest', 1);
    logGold(a.world.player, -300, 'shop: chest', 2);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getMoneyLog(b.world.player).length).toBe(0);
    applySnapshot(b, snap);
    const log = getMoneyLog(b.world.player);
    expect(log.length).toBe(2);
    expect(log[0].reason).toBe('shop: chest');
    expect(log[0].delta).toBe(-300);
    expect(log[1].reason).toBe('well: harvest');
  });
});
