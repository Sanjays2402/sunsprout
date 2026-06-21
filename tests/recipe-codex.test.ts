// Recipe codex — cooking-history bookkeeping + codex builder + UI controller.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  buildCodex,
  cookedCount,
  discoveryOf,
  getCookCounts,
  recipesCooked,
  recordCook,
  totalDishesCooked,
} from '../src/game/cooking-history';
import { cook, RECIPES, RECIPE_KEYS } from '../src/game/cooking';
import { RecipeCodex } from '../src/ui/recipe-codex';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import { TimeOfDay } from '../src/game/time';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('cooking-history', () => {
  it('getCookCounts lazily creates an empty record', () => {
    const w = new World();
    const c = getCookCounts(w.player);
    expect(c).toEqual({});
    // Idempotent — second call returns the same object.
    expect(getCookCounts(w.player)).toBe(c);
  });

  it('recordCook bumps the count and totals reflect it', () => {
    const w = new World();
    recordCook(w.player, 'hearty-stew');
    recordCook(w.player, 'hearty-stew');
    recordCook(w.player, 'pumpkin-soup');
    expect(cookedCount(w.player, 'hearty-stew')).toBe(2);
    expect(cookedCount(w.player, 'pumpkin-soup')).toBe(1);
    expect(recipesCooked(w.player)).toBe(2);
    expect(totalDishesCooked(w.player)).toBe(3);
  });

  it('discoveryOf returns locked / known / cooked correctly', () => {
    const w = new World();
    const p = w.player;
    p.inventory = {};
    expect(discoveryOf(p, 'hearty-stew')).toBe('locked');
    p.inventory.wheat_harvest = 1;
    p.inventory.tomato_harvest = 1;
    expect(discoveryOf(p, 'hearty-stew')).toBe('known');
    recordCook(p, 'hearty-stew');
    expect(discoveryOf(p, 'hearty-stew')).toBe('cooked');
  });

  it('cook() does NOT record automatically — game layer drives recordCook', () => {
    // This is intentional: cooking.ts stays a pure side-effect-only data layer.
    // Game.ts calls recordCook on a successful confirm so the codex stays
    // independent of test/unit cook() callers.
    const w = new World();
    const p = w.player;
    p.inventory = { wheat_harvest: 1, tomato_harvest: 1 };
    cook(p, 'hearty-stew');
    expect(cookedCount(p, 'hearty-stew')).toBe(0);
  });
});

describe('buildCodex', () => {
  it('returns one row per recipe in catalog order with discovery state', () => {
    const w = new World();
    const p = w.player;
    p.inventory = { wheat_harvest: 1, tomato_harvest: 1 };
    recordCook(p, 'pumpkin-soup');
    const rows = buildCodex(p);
    expect(rows.length).toBe(RECIPE_KEYS.length);
    expect(rows[0].key).toBe(RECIPE_KEYS[0]);
    const stew = rows.find((r) => r.key === 'hearty-stew')!;
    expect(stew.discovery).toBe('known');
    const soup = rows.find((r) => r.key === 'pumpkin-soup')!;
    expect(soup.discovery).toBe('cooked');
    expect(soup.cookedCount).toBe(1);
    const chowder = rows.find((r) => r.key === 'fish-chowder')!;
    expect(chowder.discovery).toBe('locked');
    // Ingredient have-counts surface from the bag.
    expect(stew.ingredients[0].have).toBe(1);
    expect(stew.ingredients[0].count).toBe(1);
    // Recipe metadata flows through.
    expect(stew.name).toBe(RECIPES['hearty-stew'].name);
    expect(stew.sellPrice).toBe(RECIPES['hearty-stew'].sellPrice);
  });
});

describe('RecipeCodex controller', () => {
  it('starts hidden, toggles open/closed', () => {
    const codex = new RecipeCodex();
    expect(codex.isVisible()).toBe(false);
    codex.toggle();
    expect(codex.isVisible()).toBe(true);
    codex.toggle();
    expect(codex.isVisible()).toBe(false);
  });

  it('respects the open-lockout', () => {
    const codex = new RecipeCodex();
    codex.open();
    expect(codex.canAct()).toBe(false);
    codex.update(80);
    expect(codex.canAct()).toBe(false);
    codex.update(200);
    expect(codex.canAct()).toBe(true);
  });

  it('close() snaps shut immediately', () => {
    const codex = new RecipeCodex();
    codex.open();
    codex.close();
    expect(codex.isVisible()).toBe(false);
  });
});

describe('cooking-history persistence', () => {
  it('cookCounts survive a snapshot round-trip', () => {
    const a = fakeGame();
    recordCook(a.world.player, 'hearty-stew');
    recordCook(a.world.player, 'hearty-stew');
    recordCook(a.world.player, 'pumpkin-soup');
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(cookedCount(b.world.player, 'hearty-stew')).toBe(0);
    applySnapshot(b, snap);
    expect(cookedCount(b.world.player, 'hearty-stew')).toBe(2);
    expect(cookedCount(b.world.player, 'pumpkin-soup')).toBe(1);
  });
});
