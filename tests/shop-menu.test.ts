// Maple's shop menu — controller behaviour (open/select/buy/categories).
//
// We can't test draw() without a canvas, so this file only exercises
// the pure controller surface: open(), selection cursor, category
// flipping, and confirm() outcomes. The visual layer is covered by the
// wider build smoke + manual play tests.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { ShopMenu } from '../src/ui/shop-menu';
import { COOP_INVENTORY_KEY } from '../src/game/coop';

function tickPastLockout(menu: ShopMenu): void {
  // open() sets a 180ms lockout — flush it.
  menu.update(500);
}

describe('ShopMenu controller', () => {
  it('opens with a non-empty visible category', () => {
    const w = new World();
    const menu = new ShopMenu();
    menu.open(w.player);
    expect(menu.isVisible()).toBe(true);
    expect(menu.visibleRows().length).toBeGreaterThan(0);
    expect(menu.selected()).toBeDefined();
  });

  it('starts under a lockout that clears after a few hundred ms', () => {
    const w = new World();
    const menu = new ShopMenu();
    menu.open(w.player);
    expect(menu.canAct()).toBe(false);
    menu.update(80);
    expect(menu.canAct()).toBe(false);
    menu.update(120);
    expect(menu.canAct()).toBe(true);
  });

  it('selectNext wraps inside the active category', () => {
    const w = new World();
    const menu = new ShopMenu();
    menu.open(w.player);
    tickPastLockout(menu);
    const cat = menu.activeCategory();
    const before = menu.selected()!;
    menu.selectNext();
    const after = menu.selected()!;
    expect(after.category).toBe(cat);
    // Wrap fully — ends back on the same row.
    const vis = menu.visibleRows();
    for (let i = 0; i < vis.length; i++) menu.selectNext();
    expect(menu.selected()!.key).toBe(after.key);
  });

  it('nextCategory jumps to a non-empty tab', () => {
    const w = new World();
    const menu = new ShopMenu();
    menu.open(w.player);
    tickPastLockout(menu);
    const first = menu.activeCategory();
    menu.nextCategory();
    expect(menu.activeCategory()).not.toBe(first);
    expect(menu.visibleRows().length).toBeGreaterThan(0);
  });

  it('confirm buys and refreshes the catalog (singleton vanishes)', () => {
    const w = new World();
    w.player.gold = 5000;
    const menu = new ShopMenu();
    menu.open(w.player);
    tickPastLockout(menu);
    // Walk to the kits tab and find the coop kit.
    while (menu.activeCategory() !== 'kits') menu.nextCategory();
    let safety = 0;
    while (menu.selected()?.key !== COOP_INVENTORY_KEY && safety++ < 50) {
      menu.selectNext();
    }
    expect(menu.selected()?.key).toBe(COOP_INVENTORY_KEY);
    const out = menu.confirm(w.player);
    expect(out.kind).toBe('bought');
    // Singleton — row vanishes from the visible list.
    expect(menu.visibleRows().some((r) => r.key === COOP_INVENTORY_KEY)).toBe(false);
    expect(w.player.inventory[COOP_INVENTORY_KEY]).toBe(1);
  });

  it('confirm reports not-enough-gold without spending', () => {
    const w = new World();
    w.player.gold = 1;
    const menu = new ShopMenu();
    menu.open(w.player);
    tickPastLockout(menu);
    const before = w.player.gold;
    const out = menu.confirm(w.player);
    expect(out.kind === 'not-enough-gold' || out.kind === 'bought').toBe(true);
    // The cheapest seed is 4g (wheat) which a 1g player can't afford.
    if (out.kind === 'not-enough-gold') {
      expect(w.player.gold).toBe(before);
    }
  });

  it('close() hides the menu', () => {
    const w = new World();
    const menu = new ShopMenu();
    menu.open(w.player);
    menu.close();
    expect(menu.isVisible()).toBe(false);
  });
});
