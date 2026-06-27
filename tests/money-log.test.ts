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
  moneyCategoryTotals,
  moneyLogDayGroups,
  groupMoneyEntriesByDay,
  applyMoneyFilter,
  cycleMoneyFilter,
  moneyFilterLabel,
  MONEY_FILTERS,
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

describe('moneyCategoryTotals', () => {
  it('buckets the log into sales / rewards / spent', () => {
    const w = new World();
    logGold(w.player, 100, 'well: harvest', 1); // sale
    logGold(w.player, 60, 'inn: dishes', 1); // sale
    logGold(w.player, 120, 'hangout: Finn', 2); // reward
    logGold(w.player, -25, 'shop: bouquet', 2); // spent
    logGold(w.player, -200, 'bath house: soak', 3); // spent
    const t = moneyCategoryTotals(w.player);
    expect(t.sales).toBe(160);
    expect(t.rewards).toBe(120);
    expect(t.spent).toBe(225);
  });

  it('keeps the invariant sales+rewards==totalIn and spent==totalOut', () => {
    const w = new World();
    logGold(w.player, 70, 'mining Gold Nugget', 1); // sale
    logGold(w.player, 30, 'board: Fetch Quest', 1); // reward
    logGold(w.player, 5, 'compost recycle', 2); // reward
    logGold(w.player, -300, 'shop: chest', 2); // spent
    const t = moneyCategoryTotals(w.player);
    expect(t.sales + t.rewards).toBe(totalIn(w.player));
    expect(t.spent).toBe(totalOut(w.player));
  });

  it('returns zeros for an empty log', () => {
    const w = new World();
    expect(moneyCategoryTotals(w.player)).toEqual({ sales: 0, rewards: 0, spent: 0 });
  });

  it('does not count a cart rebate/streak credit as a sale', () => {
    const w = new World();
    logGold(w.player, 5, 'cart: rumor rebate (Brass Lantern)', 1);
    const t = moneyCategoryTotals(w.player);
    expect(t.rewards).toBe(5);
    expect(t.sales).toBe(0);
  });
});

describe('moneyLogDayGroups', () => {
  function mkPlayer() {
    return new World().player;
  }

  it('returns an empty list for an empty log', () => {
    expect(moneyLogDayGroups(mkPlayer())).toEqual([]);
  });

  it('groups consecutive same-day rows into one run with its net', () => {
    const p = mkPlayer();
    logGold(p, 100, 'well: harvest', 1);
    logGold(p, -25, 'shop: bouquet', 1);
    logGold(p, 50, 'mining ruby', 2);
    const groups = moneyLogDayGroups(p);
    // Newest-first: day 2 group leads, day 1 group follows.
    expect(groups.map((g) => g.day)).toEqual([2, 1]);
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[0].net).toBe(50);
    expect(groups[1].entries).toHaveLength(2);
    expect(groups[1].net).toBe(75); // 100 - 25
  });

  it('preserves the newest-first row order inside a group', () => {
    const p = mkPlayer();
    logGold(p, 10, 'a', 3);
    logGold(p, 20, 'b', 3);
    const groups = moneyLogDayGroups(p);
    expect(groups).toHaveLength(1);
    // b was logged last so it sits at the front of the group.
    expect(groups[0].entries.map((e) => e.reason)).toEqual(['b', 'a']);
  });

  it('every entry lands in exactly one group, in log order', () => {
    const p = mkPlayer();
    logGold(p, 5, 'one', 1);
    logGold(p, 6, 'two', 2);
    logGold(p, 7, 'three', 2);
    logGold(p, 8, 'four', 4);
    const groups = moneyLogDayGroups(p);
    const flat = groups.flatMap((g) => g.entries);
    expect(flat).toEqual(getMoneyLog(p));
    // Three distinct days -> three groups.
    expect(groups.map((g) => g.day)).toEqual([4, 2, 1]);
  });

  it('starts a new group if the same day reappears non-contiguously', () => {
    // Defensive: if days ever interleave, the run-splitter must not merge
    // the two day-N runs into one group.
    const p = mkPlayer();
    const log = getMoneyLog(p);
    // Hand-build a non-contiguous order: day 1, day 2, day 1.
    log.unshift({ delta: 1, reason: 'x', day: 1 });
    log.unshift({ delta: 2, reason: 'y', day: 2 });
    log.unshift({ delta: 3, reason: 'z', day: 1 });
    const groups = moneyLogDayGroups(p);
    expect(groups.map((g) => g.day)).toEqual([1, 2, 1]);
    expect(groups.map((g) => g.entries.length)).toEqual([1, 1, 1]);
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

  it('cycles the filter while open and resets it on open', () => {
    const m = new MoneyLogPanel();
    m.open();
    expect(m.currentFilter()).toBe('all');
    m.cycleFilter();
    expect(m.currentFilter()).toBe('sales');
    m.cycleFilter();
    expect(m.currentFilter()).toBe('rewards');
    // Re-opening resets to 'all'.
    m.close();
    m.open();
    expect(m.currentFilter()).toBe('all');
  });

  it('ignores cycleFilter when closed', () => {
    const m = new MoneyLogPanel();
    m.cycleFilter();
    expect(m.currentFilter()).toBe('all');
  });
});

describe('groupMoneyEntriesByDay', () => {
  it('matches moneyLogDayGroups on the full log (delegation)', () => {
    const w = new World();
    logGold(w.player, 100, 'well: harvest', 1);
    logGold(w.player, -25, 'shop: bouquet', 1);
    logGold(w.player, 50, 'mining ruby', 2);
    const viaPlayer = moneyLogDayGroups(w.player);
    const viaCore = groupMoneyEntriesByDay(getMoneyLog(w.player));
    expect(viaCore).toEqual(viaPlayer);
  });

  it('groups an arbitrary filtered slice', () => {
    const entries: MoneyLogEntry[] = [
      { delta: 50, reason: 'mining ruby', day: 2 },
      { delta: 100, reason: 'well: harvest', day: 1 },
    ];
    const groups = groupMoneyEntriesByDay(entries);
    expect(groups.map((g) => g.day)).toEqual([2, 1]);
    expect(groups[0].net).toBe(50);
    expect(groups[1].net).toBe(100);
  });

  it('returns an empty list for no entries', () => {
    expect(groupMoneyEntriesByDay([])).toEqual([]);
  });
});

describe('money-log filter', () => {
  const mk = (delta: number, reason: string, day = 1): MoneyLogEntry => ({ delta, reason, day });

  it('cycles all -> sales -> rewards -> spending -> all', () => {
    expect(MONEY_FILTERS).toEqual(['all', 'sales', 'rewards', 'spending']);
    expect(cycleMoneyFilter('all')).toBe('sales');
    expect(cycleMoneyFilter('sales')).toBe('rewards');
    expect(cycleMoneyFilter('rewards')).toBe('spending');
    expect(cycleMoneyFilter('spending')).toBe('all');
  });

  it('labels read plainly and stay ASCII', () => {
    for (const f of MONEY_FILTERS) {
      const label = moneyFilterLabel(f);
      expect(label).toBe(f);
      expect(/^[\x20-\x7E]*$/.test(label)).toBe(true);
    }
  });

  it("'all' returns every row (as a fresh array)", () => {
    const rows = [mk(100, 'well: harvest'), mk(-25, 'shop: bouquet')];
    const out = applyMoneyFilter(rows, 'all');
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows); // copy, not the same ref
  });

  it('isolates each classifyMoneyEntry bucket', () => {
    const rows = [
      mk(100, 'well: harvest'), // sale
      mk(120, 'hangout: Finn'), // reward
      mk(-25, 'shop: bouquet'), // purchase
      mk(60, 'inn: dishes'), // sale
    ];
    expect(applyMoneyFilter(rows, 'sales').map((r) => r.reason)).toEqual([
      'well: harvest',
      'inn: dishes',
    ]);
    expect(applyMoneyFilter(rows, 'rewards').map((r) => r.reason)).toEqual(['hangout: Finn']);
    expect(applyMoneyFilter(rows, 'spending').map((r) => r.reason)).toEqual(['shop: bouquet']);
  });

  it('agrees with classifyMoneyEntry for every row it keeps', () => {
    const rows = [
      mk(70, 'mining Gold Nugget'),
      mk(5, 'cart: rumor rebate (Brass Lantern)'),
      mk(-300, 'shop: chest'),
    ];
    for (const f of ['sales', 'rewards', 'spending'] as const) {
      const cat = f === 'sales' ? 'sale' : f === 'rewards' ? 'reward' : 'purchase';
      for (const r of applyMoneyFilter(rows, f)) {
        expect(classifyMoneyEntry(r)).toBe(cat);
      }
    }
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
