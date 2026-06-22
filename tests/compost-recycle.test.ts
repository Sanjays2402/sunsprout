// Compost recycle ("compost compost") — applying a fertilizer bag
// returns 1g (regular) / 3g (rare) of recycled gold via the bag's
// hessian + stray grains. Small but real.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  FERTILIZER_INVENTORY_KEY,
  RARE_FERTILIZER_INVENTORY_KEY,
  FERTILIZER_STREAK,
  RARE_FERTILIZER_STREAK,
  COMPOST_RECYCLE_REGULAR,
  COMPOST_RECYCLE_RARE,
  applyFertilizer,
} from '../src/game/compost';
import { plant, till, water } from '../src/game/farming';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 100;
  return w;
}

const FREE_TX = 10;
const FREE_TY = 14;

function plantWheat(w: World): void {
  till(w, FREE_TX, FREE_TY);
  w.player.inventory['wheat'] = 1;
  plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
  water(w, FREE_TX, FREE_TY);
}

describe('compost recycle constants', () => {
  it('rare bags recycle strictly more than regular bags', () => {
    expect(COMPOST_RECYCLE_RARE).toBeGreaterThan(COMPOST_RECYCLE_REGULAR);
  });

  it('both recycle amounts are positive (the loop never zero-pays)', () => {
    expect(COMPOST_RECYCLE_REGULAR).toBeGreaterThan(0);
    expect(COMPOST_RECYCLE_RARE).toBeGreaterThan(0);
  });

  it('both recycle amounts stay small (not a viable gold farm)', () => {
    expect(COMPOST_RECYCLE_REGULAR).toBeLessThan(5);
    expect(COMPOST_RECYCLE_RARE).toBeLessThan(10);
  });
});

describe('applyFertilizer — recycle on consumption', () => {
  it('returns recycledGold=1 when a regular bag is consumed', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('applied');
    if (out.kind === 'applied') {
      expect(out.recycledGold).toBe(COMPOST_RECYCLE_REGULAR);
      expect(out.rare).toBe(false);
      expect(out.bonus).toBe(FERTILIZER_STREAK);
    }
  });

  it('returns recycledGold=3 when a rare bag is consumed', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 1;
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('applied');
    if (out.kind === 'applied') {
      expect(out.recycledGold).toBe(COMPOST_RECYCLE_RARE);
      expect(out.rare).toBe(true);
      expect(out.bonus).toBe(RARE_FERTILIZER_STREAK);
    }
  });

  it('credits the recycle directly to player.gold', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    const before = w.player.gold;
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(w.player.gold).toBe(before + COMPOST_RECYCLE_REGULAR);
  });

  it('rare bag credits the higher recycle amount to gold', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 1;
    const before = w.player.gold;
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(w.player.gold).toBe(before + COMPOST_RECYCLE_RARE);
  });

  it('does not credit gold when the apply fails (no crop)', () => {
    const w = freshWorld();
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    const before = w.player.gold;
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('no-crop');
    expect(w.player.gold).toBe(before);
    // Bag should still be in inventory — the bag is only consumed on a real apply.
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(1);
  });

  it('does not credit gold when both bags are empty', () => {
    const w = freshWorld();
    plantWheat(w);
    const before = w.player.gold;
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('no-fertilizer');
    expect(w.player.gold).toBe(before);
  });

  it('multiple applies stack the recycle', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 3;
    const before = w.player.gold;
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(w.player.gold).toBe(before + 3 * COMPOST_RECYCLE_REGULAR);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(0);
  });

  it('mixed bag pool: rare consumed first, then regular — recycle amounts match', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 1;
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    const before = w.player.gold;
    // First apply uses the rare bag (preference).
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    // Second apply uses the regular bag.
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(w.player.gold).toBe(before + COMPOST_RECYCLE_RARE + COMPOST_RECYCLE_REGULAR);
  });

  it('does not require a gold field on the player (legacy callers stay valid)', () => {
    // Synthetic player object — no .gold — must not crash.
    const w = freshWorld();
    plantWheat(w);
    const fakePlayer: { inventory: Record<string, number> } = {
      inventory: { [FERTILIZER_INVENTORY_KEY]: 1 },
    };
    const out = applyFertilizer(w, fakePlayer, FREE_TX, FREE_TY);
    expect(out.kind).toBe('applied');
    if (out.kind === 'applied') {
      expect(out.recycledGold).toBe(COMPOST_RECYCLE_REGULAR);
    }
  });
});
