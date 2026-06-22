// Pond overflow dawn warning — surfaces a nag when tomorrow's yield
// would push pending fish over the cap, so the player has a chance
// to grab the catch before it's lost. Forward-looking on purpose:
// the warning fires the dawn BEFORE the overflow, not the dawn after.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  POND_MAX_PENDING,
  POND_MAX_PENDING_RIM,
  POND_RIM_INVENTORY_KEY,
  POND_YIELD_PER_DAY,
  getPond,
  pondOverflowWarning,
  pondWouldOverflowTomorrow,
  stockPond,
} from '../src/game/fish-pond';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

describe('pondWouldOverflowTomorrow — predicate', () => {
  it('returns false for an empty pond', () => {
    const w = freshWorld();
    expect(pondWouldOverflowTomorrow(getPond(w))).toBe(false);
  });

  it('returns false when stocked but nothing pending', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    expect(state.pending).toBe(0);
    expect(pondWouldOverflowTomorrow(state)).toBe(false);
  });

  it('returns false when pending is below cap with room for tomorrow', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    state.pending = 2; // minnow yields 2/day -> tomorrow lands at 4, cap is 6
    expect(pondWouldOverflowTomorrow(state)).toBe(false);
    expect(pondOverflowWarning(state)).toBe('');
  });

  it('returns true when tomorrow would push over the cap', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    // Base cap is 6, minnow yields 2/day. pending=5 -> tomorrow lands at 7 -> overflow by 1.
    state.pending = 5;
    expect(pondWouldOverflowTomorrow(state)).toBe(true);
  });

  it('returns false when pending is ALREADY at cap (warning already passed)', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    state.pending = POND_MAX_PENDING;
    expect(pondWouldOverflowTomorrow(state)).toBe(false);
  });

  it('honors the stone-rim cap when the player owns it', () => {
    const w = freshWorld();
    w.player.inventory['fish-pike'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    state.pending = 6; // would overflow base-cap=6, but rim-cap=10 has room
    w.player.inventory[POND_RIM_INVENTORY_KEY] = 1;
    expect(pondWouldOverflowTomorrow(state, w.player)).toBe(false);
    // Push pending right up to the rim's edge.
    state.pending = POND_MAX_PENDING_RIM - 1;
    // Pike yields 1/day, so pending=9 + 1 = 10 = cap — exactly at cap, no overflow.
    expect(pondWouldOverflowTomorrow(state, w.player)).toBe(false);
    state.pending = POND_MAX_PENDING_RIM; // already at rim cap
    expect(pondWouldOverflowTomorrow(state, w.player)).toBe(false);
  });

  it('catches the boundary case at cap - yield + 1 for high-yield species', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    const yieldPerDay = POND_YIELD_PER_DAY['minnow'];
    expect(yieldPerDay).toBe(2);
    // pending = cap - yield -> tomorrow lands EXACTLY at cap -> no overflow
    state.pending = POND_MAX_PENDING - yieldPerDay;
    expect(pondWouldOverflowTomorrow(state)).toBe(false);
    // pending = cap - yield + 1 -> tomorrow over by 1
    state.pending = POND_MAX_PENDING - yieldPerDay + 1;
    expect(pondWouldOverflowTomorrow(state)).toBe(true);
  });
});

describe('pondOverflowWarning — human-readable line', () => {
  it('returns an empty string when no nag is due', () => {
    const w = freshWorld();
    expect(pondOverflowWarning(getPond(w))).toBe('');
  });

  it('names the species, current pending, cap, and exact lost count', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    state.pending = 5; // cap 6, minnow yields 2 -> overflow by 1
    const line = pondOverflowWarning(state, w.player);
    expect(line).toContain('Minnow');
    expect(line).toContain('5/6');
    expect(line).toContain('lose 1');
  });

  it('reports the rim cap when the player owns the stone rim', () => {
    const w = freshWorld();
    w.player.inventory['fish-pike'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    w.player.inventory[POND_RIM_INVENTORY_KEY] = 1;
    state.pending = 10; // at rim cap, no warning
    expect(pondOverflowWarning(state, w.player)).toBe('');
    state.pending = 9; // pending=9 + yield=1 = 10 = cap -> no overflow
    expect(pondOverflowWarning(state, w.player)).toBe('');
  });

  it('plural overflow for a high-yield species at the right pending', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const state = getPond(w);
    // cap 6, yield 2. pending=6 already at cap -> no warning (already lost)
    state.pending = 6;
    expect(pondOverflowWarning(state)).toBe('');
  });
});
