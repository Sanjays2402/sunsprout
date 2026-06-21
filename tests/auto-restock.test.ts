// Auto-restock seed kit — ownership flag, last-seed memo, dawn top-up,
// persistence round-trip.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  AUTO_RESTOCK_KEY,
  AUTO_RESTOCK_PRICE,
  AUTO_RESTOCK_TARGET,
  dawnRestock,
  getRestock,
  hasKit,
  recordLastSeed,
} from '../src/game/auto-restock';
import { SHOP_ITEMS, buyItem } from '../src/game/economy';
import { CROPS } from '../src/game/crops';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('shop catalog', () => {
  it('lists the auto-restock kit at AUTO_RESTOCK_PRICE', () => {
    const row = SHOP_ITEMS.find((s) => s.key === AUTO_RESTOCK_KEY);
    expect(row).toBeDefined();
    expect(row?.buyPrice).toBe(AUTO_RESTOCK_PRICE);
    expect(row?.sellPrice).toBeNull();
  });
});

describe('ownership', () => {
  it('default state has no kit and no remembered seed', () => {
    const w = new World();
    expect(hasKit(w.player)).toBe(false);
    expect(getRestock(w.player).lastSeed).toBeNull();
  });

  it('buying the kit costs AUTO_RESTOCK_PRICE and flips hasKit', () => {
    const w = new World();
    w.player.gold = AUTO_RESTOCK_PRICE + 100;
    expect(buyItem(w.player, AUTO_RESTOCK_KEY, AUTO_RESTOCK_PRICE)).toBe(true);
    expect(w.player.gold).toBe(100);
    expect(hasKit(w.player)).toBe(true);
  });
});

describe('recordLastSeed', () => {
  it('remembers the most recent crop key', () => {
    const w = new World();
    recordLastSeed(w.player, 'wheat');
    expect(getRestock(w.player).lastSeed).toBe('wheat');
    recordLastSeed(w.player, 'pumpkin');
    expect(getRestock(w.player).lastSeed).toBe('pumpkin');
  });
});

describe('dawnRestock', () => {
  function setup(): World {
    const w = new World();
    w.player.inventory[AUTO_RESTOCK_KEY] = 1;
    return w;
  }

  it('returns no-kit when the player does not own one', () => {
    const w = new World();
    recordLastSeed(w.player, 'wheat');
    const out = dawnRestock(w.player);
    expect(out.kind).toBe('no-kit');
  });

  it('returns no-last-seed when nothing has been planted yet', () => {
    const w = setup();
    const out = dawnRestock(w.player);
    expect(out.kind).toBe('no-last-seed');
  });

  it('returns already-stocked when the bag is at or above target', () => {
    const w = setup();
    recordLastSeed(w.player, 'wheat');
    w.player.inventory.wheat = AUTO_RESTOCK_TARGET + 2;
    const out = dawnRestock(w.player);
    expect(out.kind).toBe('already-stocked');
  });

  it('returns no-gold when the wallet is empty', () => {
    const w = setup();
    recordLastSeed(w.player, 'wheat');
    w.player.inventory.wheat = 0;
    w.player.gold = 0;
    const out = dawnRestock(w.player);
    expect(out.kind).toBe('no-gold');
    expect(w.player.inventory.wheat).toBe(0);
  });

  it('buys exactly enough seeds to reach AUTO_RESTOCK_TARGET', () => {
    const w = setup();
    recordLastSeed(w.player, 'wheat');
    w.player.inventory.wheat = 1;
    w.player.gold = 1000;
    const beforeGold = w.player.gold;
    const out = dawnRestock(w.player);
    expect(out.kind).toBe('restocked');
    if (out.kind === 'restocked') {
      expect(out.cropKey).toBe('wheat');
      expect(out.bought).toBe(AUTO_RESTOCK_TARGET - 1);
    }
    expect(w.player.inventory.wheat).toBe(AUTO_RESTOCK_TARGET);
    expect(w.player.gold).toBe(beforeGold - (AUTO_RESTOCK_TARGET - 1) * CROPS.wheat.seedPrice);
  });

  it('buys as many as the wallet allows when funds are tight', () => {
    const w = setup();
    recordLastSeed(w.player, 'pumpkin');
    const need = AUTO_RESTOCK_TARGET;
    const canAfford = 2;
    w.player.inventory.pumpkin = 0;
    w.player.gold = canAfford * CROPS.pumpkin.seedPrice;
    void need;
    const out = dawnRestock(w.player);
    expect(out.kind).toBe('restocked');
    if (out.kind === 'restocked') {
      expect(out.bought).toBe(canAfford);
    }
    expect(w.player.inventory.pumpkin).toBe(canAfford);
    expect(w.player.gold).toBe(0);
  });
});

describe('persistence — restock memo survives a snapshot round-trip', () => {
  it('default round-trips', () => {
    const a = fakeGame();
    recordLastSeed(a.world.player, 'tomato');
    a.world.player.inventory[AUTO_RESTOCK_KEY] = 1;
    const snap = serializeGame(a);
    expect(snap.player.restock?.lastSeed).toBe('tomato');
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(getRestock(b.world.player).lastSeed).toBe('tomato');
    expect(hasKit(b.world.player)).toBe(true);
  });

  it('older saves without a restock entry default to null', () => {
    const a = fakeGame();
    const snap = serializeGame(a);
    delete (snap.player as { restock?: unknown }).restock;
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(getRestock(b.world.player).lastSeed).toBeNull();
  });
});
