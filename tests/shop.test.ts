// Maple's shop UI bridge — buildShopRows + buyShopItem.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  buildShopRows,
  buyShopItem,
  SHOP_CATEGORIES,
  shopCategoryLabel,
  type ShopRow,
} from '../src/game/shop';
import { CHEST_INVENTORY_KEY } from '../src/game/chest';
import { COOP_INVENTORY_KEY } from '../src/game/coop';
import { GREENHOUSE_INVENTORY_KEY } from '../src/game/greenhouse';
import { AUTO_RESTOCK_KEY } from '../src/game/auto-restock';
import { EXTRACTOR_INVENTORY_KEY } from '../src/game/seed-extractor';
import { DOG_TICKET_KEY } from '../src/game/farm-dog';
import { CAT_TICKET_KEY } from '../src/game/farm-cat';

describe('SHOP_CATEGORIES', () => {
  it('has stable labels', () => {
    expect(SHOP_CATEGORIES).toEqual(['seeds', 'kits', 'tickets', 'misc']);
    for (const c of SHOP_CATEGORIES) {
      expect(shopCategoryLabel(c).length).toBeGreaterThan(0);
    }
  });
});

describe('buildShopRows', () => {
  it('returns only rows with a buy price', () => {
    const w = new World();
    const rows = buildShopRows(w.player);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.price).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });

  it('contains every flagship kit at least once for a clean player', () => {
    const w = new World();
    const rows = buildShopRows(w.player);
    const keys = new Set(rows.map((r) => r.key));
    expect(keys.has(COOP_INVENTORY_KEY)).toBe(true);
    expect(keys.has(GREENHOUSE_INVENTORY_KEY)).toBe(true);
    expect(keys.has(AUTO_RESTOCK_KEY)).toBe(true);
    expect(keys.has(EXTRACTOR_INVENTORY_KEY)).toBe(true);
    expect(keys.has(DOG_TICKET_KEY)).toBe(true);
    expect(keys.has(CAT_TICKET_KEY)).toBe(true);
  });

  it('hides a singleton kit once the player owns one', () => {
    const w = new World();
    w.player.inventory[COOP_INVENTORY_KEY] = 1;
    const rows = buildShopRows(w.player);
    expect(rows.some((r) => r.key === COOP_INVENTORY_KEY)).toBe(false);
  });

  it('keeps non-singletons (chest kits) listed even when owned', () => {
    const w = new World();
    w.player.inventory[CHEST_INVENTORY_KEY] = 2;
    const rows = buildShopRows(w.player);
    expect(rows.some((r) => r.key === CHEST_INVENTORY_KEY)).toBe(true);
  });

  it('sorts by category then ascending price', () => {
    const w = new World();
    const rows = buildShopRows(w.player);
    const catOrder = new Map<string, number>();
    SHOP_CATEGORIES.forEach((c, i) => catOrder.set(c, i));
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      const ca = catOrder.get(a.category)!;
      const cb = catOrder.get(b.category)!;
      expect(ca).toBeLessThanOrEqual(cb);
      if (ca === cb) expect(a.price).toBeLessThanOrEqual(b.price);
    }
  });
});

describe('buyShopItem', () => {
  it('deducts gold and grants the item on success', () => {
    const w = new World();
    w.player.gold = 5000;
    const rows = buildShopRows(w.player);
    const coop = rows.find((r) => r.key === COOP_INVENTORY_KEY)!;
    const out = buyShopItem(w.player, rows, coop.key);
    expect(out.kind).toBe('bought');
    if (out.kind === 'bought') {
      expect(out.row.key).toBe(COOP_INVENTORY_KEY);
      expect(out.remainingGold).toBe(5000 - coop.price);
    }
    expect(w.player.inventory[COOP_INVENTORY_KEY]).toBe(1);
  });

  it('refuses when the player cannot afford it', () => {
    const w = new World();
    w.player.gold = 10;
    const rows = buildShopRows(w.player);
    const coop = rows.find((r) => r.key === COOP_INVENTORY_KEY)!;
    const out = buyShopItem(w.player, rows, coop.key);
    expect(out.kind).toBe('not-enough-gold');
    expect(w.player.gold).toBe(10);
    expect(w.player.inventory[COOP_INVENTORY_KEY] ?? 0).toBe(0);
  });

  it('returns already-owned when buying a second singleton kit', () => {
    const w = new World();
    w.player.gold = 9999;
    w.player.inventory[COOP_INVENTORY_KEY] = 1;
    // Manually craft a row so we can still attempt the purchase.
    const row: ShopRow = {
      key: COOP_INVENTORY_KEY,
      label: 'Chicken Coop',
      price: 600,
      basePrice: 600,
      isDeal: false,
      category: 'kits',
      flavor: '',
    };
    const out = buyShopItem(w.player, [row], COOP_INVENTORY_KEY);
    expect(out.kind).toBe('already-owned');
    expect(w.player.gold).toBe(9999);
  });

  it('returns unknown-item for keys not in the supplied rows', () => {
    const w = new World();
    w.player.gold = 99;
    const out = buyShopItem(w.player, [], 'bogus');
    expect(out.kind).toBe('unknown-item');
  });
});
