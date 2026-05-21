// Cooking menu controller — input wiring (open/close/select/confirm).
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { CookingMenu, prettyIngredient } from '../src/ui/cooking-menu';
import { dishInventoryKey, RECIPE_KEYS } from '../src/game/cooking';

function freshPlayer() {
  const w = new World();
  const p = w.player;
  p.inventory = {};
  p.gold = 0;
  return p;
}

describe('cooking-menu', () => {
  it('starts hidden and opens with the first recipe selected', () => {
    const m = new CookingMenu();
    expect(m.isVisible()).toBe(false);
    m.open();
    expect(m.isVisible()).toBe(true);
    expect(m.selectedKey()).toBe(RECIPE_KEYS[0]);
  });

  it('respects the open-lockout so the same key press cannot act', () => {
    const m = new CookingMenu();
    m.open();
    expect(m.canAct()).toBe(false);
    m.update(50);
    expect(m.canAct()).toBe(false);
    m.update(200);
    expect(m.canAct()).toBe(true);
  });

  it('selectPrev / selectNext wrap around the recipe list', () => {
    const m = new CookingMenu();
    m.open();
    m.update(500); // clear lockout
    m.selectPrev();
    expect(m.selectedKey()).toBe(RECIPE_KEYS[RECIPE_KEYS.length - 1]);
    m.selectNext();
    m.selectNext();
    expect(m.selectedKey()).toBe(RECIPE_KEYS[1]);
  });

  it('confirm returns "missing" and does not mutate when ingredients absent', () => {
    const m = new CookingMenu();
    m.open();
    m.update(500);
    const p = freshPlayer();
    // first recipe is hearty-stew which needs wheat+tomato
    const outcome = m.confirm(p);
    expect(outcome.kind).toBe('missing');
    expect(p.inventory[dishInventoryKey('hearty-stew')] ?? 0).toBe(0);
  });

  it('confirm cooks the selected recipe when ingredients present', () => {
    const m = new CookingMenu();
    m.open();
    m.update(500);
    const p = freshPlayer();
    p.inventory.wheat_harvest = 1;
    p.inventory.tomato_harvest = 1;
    const outcome = m.confirm(p);
    expect(outcome.kind).toBe('cooked');
    if (outcome.kind === 'cooked') {
      expect(outcome.recipe).toBe('hearty-stew');
      expect(outcome.name).toBe('Hearty Stew');
    }
    expect(p.inventory[dishInventoryKey('hearty-stew')]).toBe(1);
    expect(p.inventory.wheat_harvest).toBe(0);
    expect(p.inventory.tomato_harvest).toBe(0);
  });

  it('confirm is a no-op when the menu is closed', () => {
    const m = new CookingMenu();
    const p = freshPlayer();
    p.inventory.wheat_harvest = 1;
    p.inventory.tomato_harvest = 1;
    expect(m.confirm(p).kind).toBe('noop');
    expect(p.inventory[dishInventoryKey('hearty-stew')] ?? 0).toBe(0);
  });

  it('close hides the menu and selectedKey still reports a valid key', () => {
    const m = new CookingMenu();
    m.open();
    m.close();
    expect(m.isVisible()).toBe(false);
    // selectedKey shouldn't throw — index is always in-range
    expect(RECIPE_KEYS).toContain(m.selectedKey());
  });

  it('selectPrev / selectNext no-op while the menu is closed', () => {
    const m = new CookingMenu();
    const before = m.selectedKey();
    m.selectNext();
    m.selectPrev();
    expect(m.selectedKey()).toBe(before);
  });

  it('prettyIngredient strips the harvest and fish prefixes', () => {
    expect(prettyIngredient('wheat_harvest')).toBe('wheat');
    expect(prettyIngredient('pumpkin_harvest')).toBe('pumpkin');
    expect(prettyIngredient('fish-minnow')).toBe('minnow');
    expect(prettyIngredient('hoe')).toBe('hoe');
  });
});
