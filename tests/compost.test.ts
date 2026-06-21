// Compost bin — deposit + fertilizer minting + apply mechanics.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  COMPOST_BIN_INVENTORY_KEY,
  COMPOST_BIN_PRICE,
  COMPOST_DAYS,
  COMPOST_MAX_BATCHES,
  COMPOST_RATIO,
  FERTILIZER_INVENTORY_KEY,
  FERTILIZER_STREAK,
  adjacentCompost,
  applyFertilizer,
  canPlaceCompost,
  compostAt,
  compostStatusLine,
  compostTick,
  depositCrops,
  getComposts,
  pendingCrops,
  placeCompost,
} from '../src/game/compost';
import { plant, till, water } from '../src/game/farming';
import type { FarmCrop } from '../src/game/farming';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';
import { SHOP_ITEMS } from '../src/game/economy';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function fakeGame(): Game {
  return { world: freshWorld(), time: new TimeOfDay(6) } as unknown as Game;
}

/** Open grass tile we know is clear in the default map. */
const FREE_TX = 10;
const FREE_TY = 14;

describe('placement', () => {
  it('refuses non-grass tiles', () => {
    const w = freshWorld();
    expect(canPlaceCompost(w, 14, 6)).toBe(false);
  });

  it('accepts a clear grass tile', () => {
    const w = freshWorld();
    expect(canPlaceCompost(w, FREE_TX, FREE_TY)).toBe(true);
  });

  it('refuses overlapping bins', () => {
    const w = freshWorld();
    placeCompost(w, FREE_TX, FREE_TY);
    expect(canPlaceCompost(w, FREE_TX, FREE_TY)).toBe(false);
  });

  it('returns the placed bin via compostAt + adjacentCompost', () => {
    const w = freshWorld();
    placeCompost(w, FREE_TX, FREE_TY);
    expect(compostAt(w, FREE_TX, FREE_TY)).toBeDefined();
    expect(adjacentCompost(w, FREE_TX, FREE_TY + 1)).toBeDefined();
    expect(adjacentCompost(w, FREE_TX + 5, FREE_TY)).toBeUndefined();
  });
});

describe('depositCrops', () => {
  it('returns no-crops when the bag is dry', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    expect(depositCrops(bin, w.player, 1).kind).toBe('no-crops');
  });

  it('sweeps every normal-tier harvest from the bag', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = 3;
    w.player.inventory['tomato_harvest'] = 2;
    const out = depositCrops(bin, w.player, 1);
    expect(out.kind).toBe('deposited');
    if (out.kind === 'deposited') expect(out.crops).toBe(5);
    expect(w.player.inventory['wheat_harvest']).toBe(0);
    expect(w.player.inventory['tomato_harvest']).toBe(0);
    expect(bin.batches.length).toBe(1);
    expect(bin.batches[0].crops).toBe(5);
  });

  it('leaves silver/gold star harvests in the bag', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = 4;
    w.player.inventory['wheat_harvest_silver'] = 2;
    w.player.inventory['wheat_harvest_gold'] = 1;
    depositCrops(bin, w.player, 1);
    expect(w.player.inventory['wheat_harvest']).toBe(0);
    expect(w.player.inventory['wheat_harvest_silver']).toBe(2);
    expect(w.player.inventory['wheat_harvest_gold']).toBe(1);
  });

  it('refuses when the bin is at the batch cap', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    for (let i = 0; i < COMPOST_MAX_BATCHES; i++) {
      w.player.inventory['wheat_harvest'] = 1;
      depositCrops(bin, w.player, i + 1);
    }
    w.player.inventory['wheat_harvest'] = 1;
    const out = depositCrops(bin, w.player, COMPOST_MAX_BATCHES + 1);
    expect(out.kind).toBe('bin-full');
    expect(w.player.inventory['wheat_harvest']).toBe(1);
  });
});

describe('compostTick', () => {
  it('does nothing while batches are still composting', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = COMPOST_RATIO;
    depositCrops(bin, w.player, 1);
    for (let d = 2; d <= 1 + COMPOST_DAYS - 1; d++) {
      expect(compostTick(w, w.player, d)).toBe(0);
    }
    expect(bin.batches.length).toBe(1);
  });

  it('mints floor(crops / COMPOST_RATIO) bags once the timer lapses', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    // 9 crops at ratio 4 -> 2 bags + 1 wasted crop.
    w.player.inventory['wheat_harvest'] = COMPOST_RATIO * 2 + 1;
    depositCrops(bin, w.player, 1);
    // Season 1 has rare day 6 — batch finishOnDay=3 is NOT rare so the
    // bags land in the regular fertilizer key.
    expect(compostTick(w, w.player, 1 + COMPOST_DAYS, 1)).toBe(2);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(2);
    expect(bin.batches.length).toBe(0);
  });

  it('skips batches that yield 0 bags (less than COMPOST_RATIO crops)', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = COMPOST_RATIO - 1;
    depositCrops(bin, w.player, 1);
    expect(compostTick(w, w.player, 1 + COMPOST_DAYS, 1)).toBe(0);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY] ?? 0).toBe(0);
  });
});

describe('applyFertilizer', () => {
  it('refuses when the bag has no bags', () => {
    const w = freshWorld();
    till(w, FREE_TX, FREE_TY);
    w.player.inventory['wheat'] = 1;
    plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('no-fertilizer');
  });

  it('refuses when no crop sits at the target tile', () => {
    const w = freshWorld();
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('no-crop');
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(1);
  });

  it('bumps the crop streak by FERTILIZER_STREAK and consumes a bag', () => {
    const w = freshWorld();
    till(w, FREE_TX, FREE_TY);
    w.player.inventory['wheat'] = 1;
    plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
    water(w, FREE_TX, FREE_TY);
    const crop = (w.crops as unknown as FarmCrop[]).find(
      (c) => c.tx === FREE_TX && c.ty === FREE_TY,
    )!;
    const before = crop.waterStreak ?? 0;
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 2;
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('applied');
    expect(crop.waterStreak).toBe(before + FERTILIZER_STREAK);
    expect(crop.daysSinceWater).toBe(0);
    expect(crop.watered).toBe(true);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(1);
  });
});

describe('pendingCrops + status', () => {
  it('counts pending crops across multiple bins', () => {
    const w = freshWorld();
    const a = placeCompost(w, FREE_TX, FREE_TY)!;
    const b = placeCompost(w, FREE_TX + 5, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = 4;
    depositCrops(a, w.player, 1);
    w.player.inventory['tomato_harvest'] = 6;
    depositCrops(b, w.player, 1);
    expect(pendingCrops(w)).toBe(10);
  });

  it('status flips to ready-bags once the timer lapses', () => {
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = COMPOST_RATIO;
    depositCrops(bin, w.player, 1);
    expect(compostStatusLine(bin, 1)).toMatch(/Composting/);
    expect(compostStatusLine(bin, 1 + COMPOST_DAYS)).toMatch(/ready/i);
  });
});

describe('persistence', () => {
  it('bins and batches survive a serialize+apply round trip', () => {
    const a = fakeGame();
    const bin = placeCompost(a.world, FREE_TX, FREE_TY)!;
    a.world.player.inventory['wheat_harvest'] = 6;
    depositCrops(bin, a.world.player, 3);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getComposts(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const restored = getComposts(b.world);
    expect(restored.length).toBe(1);
    expect(restored[0].batches[0].crops).toBe(6);
  });
});

describe('shop catalog', () => {
  it('exposes the compost bin as a buyable kit at the right price', () => {
    const row = SHOP_ITEMS.find((i) => i.key === COMPOST_BIN_INVENTORY_KEY);
    expect(row).toBeDefined();
    expect(row!.buyPrice).toBe(COMPOST_BIN_PRICE);
  });
});
