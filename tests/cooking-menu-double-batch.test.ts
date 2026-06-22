// Cooking menu double-batch path — Shift+Enter at the cooking menu
// fires cookDoubleBatch on stamina teas (2x ingredients -> 3 dishes).
// The menu's confirm() takes an optional mode='double' that routes
// to the batch path; widened CookOutcome carries mode + yield so the
// game layer can word the toast and bump cookCounts by the yield.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { CookingMenu } from '../src/ui/cooking-menu';
import {
  dishInventoryKey,
  RECIPE_KEYS,
  STAMINA_TEA_KEYS,
  DOUBLE_BATCH_DISH_YIELD,
  DOUBLE_BATCH_INGREDIENT_MULT,
  RECIPES,
  type DishKey,
} from '../src/game/cooking';

function freshPlayer() {
  const w = new World();
  const p = w.player;
  p.inventory = {};
  p.gold = 0;
  return p;
}

/** Open the menu and clear the open-lockout so confirm() actually fires. */
function openReady(): CookingMenu {
  const m = new CookingMenu();
  m.open();
  m.update(500);
  return m;
}

/** Walk the selection to land on `key`. */
function selectKey(m: CookingMenu, key: DishKey): void {
  while (m.selectedKey() !== key) m.selectNext();
}

describe('cooking-menu double-batch — mode routing', () => {
  it('confirm() defaults to single mode (backwards compatible)', () => {
    const m = openReady();
    const p = freshPlayer();
    p.inventory.wheat_harvest = 1;
    p.inventory.tomato_harvest = 1;
    const out = m.confirm(p);
    expect(out.kind).toBe('cooked');
    if (out.kind === 'cooked') {
      expect(out.mode).toBe('single');
      expect(out.yield).toBe(1);
    }
    expect(p.inventory[dishInventoryKey('hearty-stew')]).toBe(1);
  });

  it('refuses double-batch on a non-stamina-tea recipe with not-eligible-double', () => {
    const m = openReady();
    const p = freshPlayer();
    p.inventory.wheat_harvest = 5;
    p.inventory.tomato_harvest = 5;
    // selected is hearty-stew (first recipe); a regular recipe never
    // accepts the batch path.
    const out = m.confirm(p, 'double');
    expect(out.kind).toBe('not-eligible-double');
    if (out.kind === 'not-eligible-double') {
      expect(out.recipe).toBe('hearty-stew');
      expect(out.name).toBe('Hearty Stew');
    }
    // ingredients untouched — refusal is clean.
    expect(p.inventory.wheat_harvest).toBe(5);
    expect(p.inventory.tomato_harvest).toBe(5);
  });

  it('double-batch on a stamina tea consumes 2x ingredients and mints 3 dishes', () => {
    const m = openReady();
    selectKey(m, 'berry-tonic');
    const p = freshPlayer();
    const tonic = RECIPES['berry-tonic'];
    // Stock exactly the doubled requirement so we can assert the
    // post-cook inventory is zero.
    for (const ing of tonic.ingredients) {
      p.inventory[ing.key] = ing.count * DOUBLE_BATCH_INGREDIENT_MULT;
    }
    const out = m.confirm(p, 'double');
    expect(out.kind).toBe('cooked');
    if (out.kind === 'cooked') {
      expect(out.mode).toBe('double');
      expect(out.yield).toBe(DOUBLE_BATCH_DISH_YIELD);
      expect(out.recipe).toBe('berry-tonic');
    }
    expect(p.inventory[dishInventoryKey('berry-tonic')]).toBe(DOUBLE_BATCH_DISH_YIELD);
    for (const ing of tonic.ingredients) {
      expect(p.inventory[ing.key]).toBe(0);
    }
  });

  it('double-batch on a stamina tea WITHOUT enough ingredients returns "missing" tagged with mode=double', () => {
    const m = openReady();
    selectKey(m, 'berry-tonic');
    const p = freshPlayer();
    const tonic = RECIPES['berry-tonic'];
    // Stock only the SINGLE-cook requirement — enough for a regular
    // cook but short on the double-batch multiplier.
    for (const ing of tonic.ingredients) {
      p.inventory[ing.key] = ing.count;
    }
    const out = m.confirm(p, 'double');
    expect(out.kind).toBe('missing');
    if (out.kind === 'missing') {
      expect(out.mode).toBe('double');
      expect(out.recipe).toBe('berry-tonic');
    }
    // No dishes minted, ingredients untouched.
    expect(p.inventory[dishInventoryKey('berry-tonic')] ?? 0).toBe(0);
    for (const ing of tonic.ingredients) {
      expect(p.inventory[ing.key]).toBe(ing.count);
    }
  });

  it('every stamina tea is eligible for the double-batch path', () => {
    for (const teaKey of STAMINA_TEA_KEYS) {
      const m = openReady();
      selectKey(m, teaKey);
      const p = freshPlayer();
      const recipe = RECIPES[teaKey];
      for (const ing of recipe.ingredients) {
        p.inventory[ing.key] = ing.count * DOUBLE_BATCH_INGREDIENT_MULT;
      }
      const out = m.confirm(p, 'double');
      expect(out.kind, `expected ${teaKey} to cook double-batch`).toBe('cooked');
      if (out.kind === 'cooked') {
        expect(out.mode).toBe('double');
        expect(out.yield).toBe(DOUBLE_BATCH_DISH_YIELD);
      }
      expect(p.inventory[dishInventoryKey(teaKey)]).toBe(DOUBLE_BATCH_DISH_YIELD);
    }
  });

  it('every non-stamina-tea recipe is refused with not-eligible-double', () => {
    for (const key of RECIPE_KEYS) {
      if (STAMINA_TEA_KEYS.has(key)) continue;
      const m = openReady();
      selectKey(m, key);
      const p = freshPlayer();
      const recipe = RECIPES[key];
      for (const ing of recipe.ingredients) {
        p.inventory[ing.key] = ing.count * 5;
      }
      const out = m.confirm(p, 'double');
      expect(out.kind, `expected ${key} to refuse double-batch`).toBe('not-eligible-double');
      // Inventory untouched.
      for (const ing of recipe.ingredients) {
        expect(p.inventory[ing.key]).toBe(ing.count * 5);
      }
    }
  });

  it('single-mode missing tag carries mode=single (separate from double-mode missing)', () => {
    const m = openReady();
    const p = freshPlayer();
    // No wheat / tomato — first recipe (hearty-stew) fails canCook.
    const out = m.confirm(p, 'single');
    expect(out.kind).toBe('missing');
    if (out.kind === 'missing') expect(out.mode).toBe('single');
  });

  it('closed-menu confirm is still a noop in both modes', () => {
    const m = new CookingMenu();
    const p = freshPlayer();
    expect(m.confirm(p, 'single').kind).toBe('noop');
    expect(m.confirm(p, 'double').kind).toBe('noop');
  });
});
