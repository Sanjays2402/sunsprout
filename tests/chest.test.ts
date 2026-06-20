// Chests — placement, deposit/withdraw, persistence, menu controller.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  CHEST_INVENTORY_KEY,
  CHEST_PRICE,
  adjacentChest,
  canPlaceChest,
  chestAt,
  chestTotal,
  depositItem,
  ensureStarterChest,
  getChests,
  listChestItems,
  placeChest,
  withdrawItem,
} from '../src/game/chest';
import { ChestMenu } from '../src/ui/chest-menu';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  w.player.inventory = { wheat_harvest: 3, tomato_harvest_gold: 1, copper: 2 };
  w.player.gold = 2000;
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

const FREE_TX = 10;
const FREE_TY = 14;

describe('chest catalog', () => {
  it('CHEST_PRICE is a real number and inventory key matches', () => {
    expect(CHEST_PRICE).toBeGreaterThan(0);
    expect(CHEST_INVENTORY_KEY).toBe('chest-kit');
  });
});

describe('chest placement', () => {
  it('canPlaceChest accepts grass and rejects buildings / out-of-bounds', () => {
    const w = new World();
    expect(canPlaceChest(w, FREE_TX, FREE_TY)).toBe(true);
    expect(canPlaceChest(w, 19, 18)).toBe(false); // farmhouse footprint
    expect(canPlaceChest(w, 39, 29)).toBe(true);  // edge grass tile
    expect(canPlaceChest(w, 100, 100)).toBe(false); // out of bounds
  });

  it('placeChest creates a chest with a unique id', () => {
    const w = new World();
    const a = placeChest(w, FREE_TX, FREE_TY);
    const b = placeChest(w, FREE_TX + 1, FREE_TY);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.id).not.toBe(b!.id);
    expect(getChests(w).length).toBe(2);
  });

  it('placeChest refuses double-stacking', () => {
    const w = new World();
    placeChest(w, FREE_TX, FREE_TY);
    expect(placeChest(w, FREE_TX, FREE_TY)).toBeNull();
  });

  it('ensureStarterChest is idempotent — first call places, repeats no-op', () => {
    const w = new World();
    const first = ensureStarterChest(w);
    const second = ensureStarterChest(w);
    expect(first.id).toBe('cellar');
    expect(second).toBe(first);
    expect(getChests(w).length).toBe(1);
  });

  it('adjacentChest finds a chest within Chebyshev radius 1', () => {
    const w = new World();
    placeChest(w, FREE_TX, FREE_TY);
    expect(adjacentChest(w, FREE_TX, FREE_TY)?.tx).toBe(FREE_TX);
    expect(adjacentChest(w, FREE_TX + 1, FREE_TY)?.tx).toBe(FREE_TX);
    expect(adjacentChest(w, FREE_TX + 2, FREE_TY)).toBeUndefined();
  });

  it('chestAt looks up an exact tile match', () => {
    const w = new World();
    placeChest(w, FREE_TX, FREE_TY);
    expect(chestAt(w, FREE_TX, FREE_TY)).toBeDefined();
    expect(chestAt(w, FREE_TX + 1, FREE_TY)).toBeUndefined();
  });
});

describe('deposit / withdraw', () => {
  it('depositItem moves up to the count requested', () => {
    const g = fakeGame();
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    const moved = depositItem(chest, g.world.player, 'wheat_harvest', 5);
    expect(moved).toBe(3); // player only had 3
    expect(chest.items.wheat_harvest).toBe(3);
    expect(g.world.player.inventory.wheat_harvest).toBe(0);
  });

  it('withdrawItem reverses a deposit', () => {
    const g = fakeGame();
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    depositItem(chest, g.world.player, 'wheat_harvest', 2);
    const back = withdrawItem(chest, g.world.player, 'wheat_harvest', 1);
    expect(back).toBe(1);
    expect(chest.items.wheat_harvest).toBe(1);
    expect(g.world.player.inventory.wheat_harvest).toBe(2);
  });

  it('listChestItems returns sorted (key, count) pairs', () => {
    const g = fakeGame();
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    depositItem(chest, g.world.player, 'wheat_harvest', 1);
    depositItem(chest, g.world.player, 'tomato_harvest_gold', 1);
    const list = listChestItems(chest);
    expect(list.length).toBe(2);
    expect(list[0].key).toBe('tomato_harvest_gold'); // alpha-sort
  });

  it('chestTotal sums every item count', () => {
    const g = fakeGame();
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    depositItem(chest, g.world.player, 'wheat_harvest', 3);
    depositItem(chest, g.world.player, 'copper', 2);
    expect(chestTotal(chest)).toBe(5);
  });
});

describe('chest menu controller', () => {
  it('open / close manage visibility + selection', () => {
    const g = fakeGame();
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    depositItem(chest, g.world.player, 'wheat_harvest', 1);
    const menu = new ChestMenu();
    expect(menu.isVisible()).toBe(false);
    menu.open(chest);
    expect(menu.isVisible()).toBe(true);
    expect(menu.currentChest()?.id).toBe(chest.id);
    menu.close();
    expect(menu.isVisible()).toBe(false);
    expect(menu.currentChest()).toBeNull();
  });

  it('selectNext / selectPrev wrap', () => {
    const g = fakeGame();
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    depositItem(chest, g.world.player, 'wheat_harvest', 1);
    depositItem(chest, g.world.player, 'tomato_harvest_gold', 1);
    const menu = new ChestMenu();
    menu.open(chest);
    menu.update(200); // clear lockout
    const first = menu.selectedRow()?.key;
    menu.selectNext();
    const second = menu.selectedRow()?.key;
    expect(first).not.toBe(second);
    menu.selectNext();
    expect(menu.selectedRow()?.key).toBe(first);
  });

  it('withdrawOne transfers one item back to the player', () => {
    const g = fakeGame();
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    depositItem(chest, g.world.player, 'wheat_harvest', 2);
    const menu = new ChestMenu();
    menu.open(chest);
    const out = menu.withdrawOne(g.world.player);
    expect(out.kind).toBe('withdrew');
    expect(chest.items.wheat_harvest).toBe(1);
    expect(g.world.player.inventory.wheat_harvest).toBe(2);
  });

  it('depositAllHarvest moves every harvest tier into the chest', () => {
    const g = fakeGame();
    const p = g.world.player;
    p.inventory.wheat_harvest_silver = 2;
    const chest = placeChest(g.world, FREE_TX, FREE_TY)!;
    const menu = new ChestMenu();
    menu.open(chest);
    const out = menu.depositAllHarvest(p);
    expect(out.kind).toBe('deposited');
    expect(chest.items.wheat_harvest).toBe(3);
    expect(chest.items.tomato_harvest_gold).toBe(1);
    expect(chest.items.wheat_harvest_silver).toBe(2);
    // copper is NOT a harvest bucket and should not move.
    expect(chest.items.copper ?? 0).toBe(0);
    expect(p.inventory.copper).toBe(2);
  });
});

describe('chest persistence', () => {
  it('chest + items survive a snapshot round-trip', () => {
    const a = fakeGame();
    ensureStarterChest(a.world);
    const extra = placeChest(a.world, FREE_TX, FREE_TY)!;
    depositItem(extra, a.world.player, 'wheat_harvest', 2);
    depositItem(extra, a.world.player, 'tomato_harvest_gold', 1);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getChests(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const restored = getChests(b.world);
    expect(restored.length).toBe(2);
    const restoredExtra = restored.find((c) => c.tx === FREE_TX)!;
    expect(restoredExtra.items.wheat_harvest).toBe(2);
    expect(restoredExtra.items.tomato_harvest_gold).toBe(1);
  });
});
