// Pond species rotation — swap the stocked species by collecting all,
// then pressing > with a different fish in the bag.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  collectPond,
  getPond,
  interactPond,
  pondStatusLine,
  pondTick,
  reseedPond,
  stockPond,
} from '../src/game/fish-pond';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

/** Tile adjacent to the pond (pond is at x:[2,5], y:[18,21]; (6, 19) sits east). */
const PX = 6;
const PY = 19;

describe('reseedPond', () => {
  it('refuses to reseed when the pond is empty (falls through to stockPond)', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    const out = reseedPond(w, w.player);
    expect(out.kind).toBe('stocked');
    if (out.kind === 'stocked') expect(out.species).toBe('minnow');
  });

  it('refuses to reseed when fish are still pending — returns nothing-pending', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    pondTick(w, 2);
    expect(getPond(w).pending).toBeGreaterThan(0);
    w.player.inventory['fish-pike'] = 1;
    const out = reseedPond(w, w.player);
    expect(out.kind).toBe('nothing-pending');
  });

  it('refuses with empty-no-fish when no DIFFERENT species is in the bag', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 3;
    stockPond(w, w.player);
    // Collect to clear pending — actually we never produced any here so
    // pending is already 0. Bag still only has minnows.
    const out = reseedPond(w, w.player);
    expect(out.kind).toBe('empty-no-fish');
    // The pond's species should remain unchanged.
    expect(getPond(w).species).toBe('minnow');
  });

  it('swaps species to the most-abundant DIFFERENT fish in the bag', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    // Bag the player carries now also contains pike (with more) + carp.
    w.player.inventory['fish-pike'] = 5;
    w.player.inventory['fish-carp'] = 2;
    const out = reseedPond(w, w.player);
    expect(out.kind).toBe('restocked');
    if (out.kind === 'restocked') {
      expect(out.from).toBe('minnow');
      expect(out.to).toBe('pike');
    }
    expect(getPond(w).species).toBe('pike');
    expect(getPond(w).pending).toBe(0);
    // Pike seed fish was consumed.
    expect(w.player.inventory['fish-pike']).toBe(4);
    // Other species untouched.
    expect(w.player.inventory['fish-carp']).toBe(2);
  });

  it('does NOT consume the existing species as the swap seed', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 5;
    stockPond(w, w.player);
    // After stocking, 4 minnows remain in bag.
    expect(w.player.inventory['fish-minnow']).toBe(4);
    // Add a pike — should be the only viable swap candidate.
    w.player.inventory['fish-pike'] = 1;
    const out = reseedPond(w, w.player);
    expect(out.kind).toBe('restocked');
    // Minnow bag must NOT have changed (we did not seed with minnow).
    expect(w.player.inventory['fish-minnow']).toBe(4);
    expect(w.player.inventory['fish-pike']).toBe(0);
  });
});

describe('interactPond with rotation', () => {
  it('press `>` near a stocked-but-empty pond with a different fish triggers a swap', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    interactPond(w, w.player, PX, PY); // stock with minnow
    expect(getPond(w).species).toBe('minnow');
    // Player has a trout in the bag now.
    w.player.inventory['fish-trout'] = 1;
    const out = interactPond(w, w.player, PX, PY);
    expect(out.kind).toBe('restocked');
    if (out.kind === 'restocked') {
      expect(out.from).toBe('minnow');
      expect(out.to).toBe('trout');
    }
    expect(getPond(w).species).toBe('trout');
  });

  it('press `>` near a stocked-but-empty pond with NO different fish still nothings-pending', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 3;
    interactPond(w, w.player, PX, PY);
    // Still only minnows in the bag.
    const out = interactPond(w, w.player, PX, PY);
    expect(out.kind).toBe('nothing-pending');
  });
});

describe('rotation lifecycle', () => {
  it('a swap produces the new species on the NEXT dawn tick', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    pondTick(w, 2);
    collectPond(w, w.player);
    // Player decides to rotate to pike.
    w.player.inventory['fish-pike'] = 1;
    const swap = reseedPond(w, w.player);
    expect(swap.kind).toBe('restocked');
    // Dawn day 3 should fire and yield pike.
    pondTick(w, 3);
    const pond = getPond(w);
    expect(pond.species).toBe('pike');
    expect(pond.pending).toBeGreaterThan(0);
  });
});

describe('status hint mentions rotation', () => {
  it('stocked-but-empty status mentions the swap path', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    const line = pondStatusLine(getPond(w));
    expect(line).toMatch(/swap/i);
  });
});
