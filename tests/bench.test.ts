// Carpenter's bench — recipe catalog, gating, craft mechanics.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BENCH_RECIPES,
  BENCH_X,
  BENCH_Y,
  canCraft,
  craftAtBench,
  nearBench,
  recipeCostLine,
} from '../src/game/bench';
import { gemInventoryKey } from '../src/game/gems';

describe('BENCH_RECIPES', () => {
  it('every recipe has positive gold, gem cost, and a readable label', () => {
    expect(BENCH_RECIPES.length).toBeGreaterThan(0);
    for (const r of BENCH_RECIPES) {
      expect(r.gold).toBeGreaterThan(0);
      expect(r.gem.count).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.key.startsWith('craft-')).toBe(true);
    }
  });

  it('catalog headlines a scarecrow recipe', () => {
    const keys = BENCH_RECIPES.map((r) => r.key);
    expect(keys).toContain('craft-scarecrow');
  });
});

describe('nearBench', () => {
  it('true within Chebyshev radius 1', () => {
    expect(nearBench(BENCH_X, BENCH_Y)).toBe(true);
    expect(nearBench(BENCH_X + 1, BENCH_Y)).toBe(true);
    expect(nearBench(BENCH_X - 1, BENCH_Y + 1)).toBe(true);
  });

  it('false past the radius', () => {
    expect(nearBench(BENCH_X + 2, BENCH_Y)).toBe(false);
    expect(nearBench(BENCH_X, BENCH_Y - 3)).toBe(false);
  });
});

describe('canCraft', () => {
  it('returns false when gold is short', () => {
    const w = new World();
    w.player.gold = 0;
    expect(canCraft(w.player, BENCH_RECIPES[0])).toBe(false);
  });

  it('returns false when gems are short even if gold is enough', () => {
    const w = new World();
    w.player.gold = 99999;
    expect(canCraft(w.player, BENCH_RECIPES[0])).toBe(false);
  });

  it('returns true when both gold and gems are sufficient', () => {
    const w = new World();
    const r = BENCH_RECIPES[0];
    w.player.gold = r.gold + 100;
    w.player.inventory[gemInventoryKey(r.gem.key)] = r.gem.count;
    expect(canCraft(w.player, r)).toBe(true);
  });
});

describe('craftAtBench', () => {
  it('deducts gold + gems and grants the craft on success', () => {
    const w = new World();
    const r = BENCH_RECIPES[0];
    w.player.gold = r.gold + 50;
    w.player.inventory[gemInventoryKey(r.gem.key)] = r.gem.count + 1;
    const out = craftAtBench(w.player, r.key);
    expect(out.kind).toBe('crafted');
    if (out.kind === 'crafted') {
      expect(out.recipe.key).toBe(r.key);
      expect(out.remainingGold).toBe(50);
    }
    expect(w.player.gold).toBe(50);
    expect(w.player.inventory[gemInventoryKey(r.gem.key)]).toBe(1);
    expect(w.player.inventory[r.key]).toBe(1);
  });

  it('refuses on not-enough-gold without spending anything', () => {
    const w = new World();
    const r = BENCH_RECIPES[0];
    w.player.gold = 0;
    w.player.inventory[gemInventoryKey(r.gem.key)] = 10;
    const out = craftAtBench(w.player, r.key);
    expect(out.kind).toBe('not-enough-gold');
    expect(w.player.inventory[gemInventoryKey(r.gem.key)]).toBe(10);
    expect(w.player.inventory[r.key] ?? 0).toBe(0);
  });

  it('refuses on not-enough-gems without spending gold', () => {
    const w = new World();
    const r = BENCH_RECIPES[0];
    w.player.gold = 99999;
    w.player.inventory[gemInventoryKey(r.gem.key)] = 0;
    const before = w.player.gold;
    const out = craftAtBench(w.player, r.key);
    expect(out.kind).toBe('not-enough-gems');
    expect(w.player.gold).toBe(before);
    expect(w.player.inventory[r.key] ?? 0).toBe(0);
  });

  it('returns unknown-recipe for an unrecognised key', () => {
    const w = new World();
    w.player.gold = 1000;
    const out = craftAtBench(w.player, 'craft-bogus');
    expect(out.kind).toBe('unknown-recipe');
  });
});

describe('recipeCostLine', () => {
  it('formats as "Xg + N Gem Name"', () => {
    const line = recipeCostLine(BENCH_RECIPES[0]);
    expect(line).toMatch(/\d+g \+ \d+ /);
  });
});
