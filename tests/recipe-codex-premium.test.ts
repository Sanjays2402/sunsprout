// Recipe codex premium section — egg-bearing recipe rows now carry
// the premium swap line, a per-recipe premium tally, and the codex
// header surfaces totalPremiumDishesCooked when the player has cooked
// at least one premium variant. Persistence carries `premiumCookCounts`
// through reload.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  buildCodex,
  getPremiumCookCounts,
  premiumCookedCount,
  recordCook,
  recordPremiumCook,
  totalPremiumDishesCooked,
} from '../src/game/cooking-history';
import {
  RECIPES,
  RECIPE_KEYS,
  cookPremium,
  premiumCookLine,
  premiumDishInventoryKey,
  premiumSellPrice,
  recipeHasEgg,
  type DishKey,
} from '../src/game/cooking';
import { BREEDER_EGG_INVENTORY_KEY } from '../src/game/coop';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import { TimeOfDay } from '../src/game/time';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('premium cook tally — lazy accessor', () => {
  it('getPremiumCookCounts lazily creates an empty record', () => {
    const w = new World();
    const c = getPremiumCookCounts(w.player);
    expect(c).toEqual({});
    expect(getPremiumCookCounts(w.player)).toBe(c);
  });

  it('recordPremiumCook bumps the count independently of regular cookCounts', () => {
    const w = new World();
    recordCook(w.player, 'farm-omelet');
    recordPremiumCook(w.player, 'farm-omelet');
    recordPremiumCook(w.player, 'farm-omelet');
    recordPremiumCook(w.player, 'pumpkin-custard');
    expect(premiumCookedCount(w.player, 'farm-omelet')).toBe(2);
    expect(premiumCookedCount(w.player, 'pumpkin-custard')).toBe(1);
    expect(totalPremiumDishesCooked(w.player)).toBe(3);
  });

  it('cookPremium does NOT auto-record — the game layer drives the tally', () => {
    // Mirrors the cooking.ts/recordCook contract — the helper is exposed
    // for the next batch's inn-toggle wiring; it's not auto-fired inside
    // the pure cooking module.
    const w = new World();
    w.player.inventory = {
      egg: 5,
      tomato_harvest: 1,
      [BREEDER_EGG_INVENTORY_KEY]: 1,
    };
    cookPremium(w.player, 'farm-omelet');
    expect(premiumCookedCount(w.player, 'farm-omelet')).toBe(0);
  });
});

describe('buildCodex — premium fields populate for egg-bearing rows', () => {
  it('every row carries hasPremium / premiumLine / premiumSellPrice / premiumCookedCount / premiumOwned', () => {
    const w = new World();
    const rows = buildCodex(w.player);
    expect(rows.length).toBe(RECIPE_KEYS.length);
    for (const r of rows) {
      expect(typeof r.hasPremium).toBe('boolean');
      expect(typeof r.premiumLine).toBe('string');
      expect(typeof r.premiumSellPrice).toBe('number');
      expect(typeof r.premiumCookedCount).toBe('number');
      expect(typeof r.premiumOwned).toBe('number');
    }
  });

  it('hasPremium mirrors recipeHasEgg exactly', () => {
    const w = new World();
    const rows = buildCodex(w.player);
    for (const r of rows) {
      expect(r.hasPremium).toBe(recipeHasEgg(RECIPES[r.key]));
    }
  });

  it('premiumLine matches premiumCookLine for egg rows, empty for the rest', () => {
    const w = new World();
    const rows = buildCodex(w.player);
    for (const r of rows) {
      if (r.hasPremium) {
        expect(r.premiumLine).toBe(premiumCookLine(r.key));
        expect(r.premiumLine.length).toBeGreaterThan(0);
      } else {
        expect(r.premiumLine).toBe('');
      }
    }
  });

  it('premiumSellPrice matches premiumSellPrice() helper for egg rows, 0 for the rest', () => {
    const w = new World();
    const rows = buildCodex(w.player);
    for (const r of rows) {
      if (r.hasPremium) {
        expect(r.premiumSellPrice).toBe(premiumSellPrice(r.key));
      } else {
        expect(r.premiumSellPrice).toBe(0);
      }
    }
  });

  it('premiumOwned reads from the dish-<key>-premium inventory slot', () => {
    const w = new World();
    w.player.inventory = {
      [premiumDishInventoryKey('farm-omelet')]: 3,
      [premiumDishInventoryKey('pumpkin-custard')]: 1,
    };
    const rows = buildCodex(w.player);
    const omelet = rows.find((r) => r.key === 'farm-omelet')!;
    const custard = rows.find((r) => r.key === 'pumpkin-custard')!;
    const stew = rows.find((r) => r.key === 'hearty-stew')!;
    expect(omelet.premiumOwned).toBe(3);
    expect(custard.premiumOwned).toBe(1);
    expect(stew.premiumOwned).toBe(0);
  });

  it('premiumCookedCount reads from premiumCookCounts independently of cookCounts', () => {
    const w = new World();
    recordCook(w.player, 'farm-omelet');
    recordPremiumCook(w.player, 'farm-omelet');
    recordPremiumCook(w.player, 'farm-omelet');
    const rows = buildCodex(w.player);
    const omelet = rows.find((r) => r.key === 'farm-omelet')!;
    expect(omelet.cookedCount).toBe(1);
    expect(omelet.premiumCookedCount).toBe(2);
  });

  it('totalPremiumDishesCooked aggregates across every premium recipe', () => {
    const w = new World();
    const eggRecipes: DishKey[] = [
      'farm-omelet',
      'pumpkin-custard',
      'mushroom-skillet',
      'berry-tart',
      'hot-cocoa',
      'sunflower-elixir',
    ];
    for (const k of eggRecipes) recordPremiumCook(w.player, k);
    recordPremiumCook(w.player, 'farm-omelet');
    expect(totalPremiumDishesCooked(w.player)).toBe(eggRecipes.length + 1);
  });
});

describe('premium cook persistence', () => {
  it('round-trips premiumCookCounts through serializeGame + applySnapshot', () => {
    const g = fakeGame();
    recordPremiumCook(g.world.player, 'farm-omelet');
    recordPremiumCook(g.world.player, 'farm-omelet');
    recordPremiumCook(g.world.player, 'pumpkin-custard');
    const snap = serializeGame(g);
    expect(snap.player.premiumCookCounts).toEqual({
      'farm-omelet': 2,
      'pumpkin-custard': 1,
    });
    const g2 = fakeGame();
    expect(applySnapshot(g2, snap)).toBe(true);
    expect(premiumCookedCount(g2.world.player, 'farm-omelet')).toBe(2);
    expect(premiumCookedCount(g2.world.player, 'pumpkin-custard')).toBe(1);
    expect(totalPremiumDishesCooked(g2.world.player)).toBe(3);
  });

  it('snapshot omits premiumCookCounts when the player has never premium-cooked', () => {
    const g = fakeGame();
    const snap = serializeGame(g);
    expect(snap.player.premiumCookCounts).toBeUndefined();
  });
});
