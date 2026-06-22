// Pond fish ribbon — heaviest single-day pending count per species.
// Mirrors the crop-journal ribbon pattern so the player can flex a
// well-stocked pond loop. Recorded at pondTick time when the engine
// passes time; older callers (no time arg) leave the ribbon alone.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  POND_MAX_PENDING,
  POND_MAX_PENDING_RIM,
  POND_RIM_INVENTORY_KEY,
  collectPond,
  getPond,
  pondRibbonFor,
  pondRibbonLine,
  pondStatusLine,
  pondTick,
  recordPondRibbon,
  reseedPond,
  stockPond,
} from '../src/game/fish-pond';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

describe('recordPondRibbon — pure comparator', () => {
  it('sets a fresh record', () => {
    const state = getPond(freshWorld());
    recordPondRibbon(state, 'minnow', 4, { season: 0, day: 2 });
    expect(pondRibbonFor(state, 'minnow')).toEqual({ count: 4, season: 0, day: 2 });
  });

  it('beats the prior record only with a strictly larger count', () => {
    const state = getPond(freshWorld());
    recordPondRibbon(state, 'pike', 3, { season: 1, day: 4 });
    recordPondRibbon(state, 'pike', 3, { season: 2, day: 1 });
    // Equal count -> keeps the OLD record's date.
    expect(pondRibbonFor(state, 'pike')).toEqual({ count: 3, season: 1, day: 4 });
    recordPondRibbon(state, 'pike', 5, { season: 2, day: 3 });
    expect(pondRibbonFor(state, 'pike')).toEqual({ count: 5, season: 2, day: 3 });
  });

  it('ignores zero/negative counts (defensive)', () => {
    const state = getPond(freshWorld());
    recordPondRibbon(state, 'trout', 0, { season: 0, day: 1 });
    recordPondRibbon(state, 'trout', -2, { season: 0, day: 1 });
    expect(pondRibbonFor(state, 'trout')).toBeUndefined();
  });

  it('keys per species independently', () => {
    const state = getPond(freshWorld());
    recordPondRibbon(state, 'minnow', 6, { season: 0, day: 2 });
    recordPondRibbon(state, 'bass', 2, { season: 1, day: 5 });
    expect(pondRibbonFor(state, 'minnow')?.count).toBe(6);
    expect(pondRibbonFor(state, 'bass')?.count).toBe(2);
  });
});

describe('pondTick updates the ribbon only when given time', () => {
  it('legacy 3-arg pondTick leaves the ribbon untouched', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    for (let d = 2; d < 10; d++) pondTick(w, d, w.player);
    expect(getPond(w).ribbons).toBeUndefined();
  });

  it('time-aware pondTick records a new high as pending grows', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    // Minnow yields 2/day. Tick four mornings starting from day 2 ->
    // day 2: pending 2, day 3: pending 4, day 4: pending 6 (cap), day 5: 6.
    pondTick(w, 2, w.player, { season: 0, day: 2 });
    expect(pondRibbonFor(getPond(w), 'minnow')).toEqual({ count: 2, season: 0, day: 2 });
    pondTick(w, 3, w.player, { season: 0, day: 3 });
    pondTick(w, 4, w.player, { season: 0, day: 4 });
    pondTick(w, 5, w.player, { season: 0, day: 5 });
    expect(pondRibbonFor(getPond(w), 'minnow')).toEqual({
      count: POND_MAX_PENDING,
      season: 0,
      day: 4,
    });
  });

  it('rim cap lets the record stretch past the base 6', () => {
    const w = freshWorld();
    w.player.inventory[POND_RIM_INVENTORY_KEY] = 1;
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    for (let d = 2; d < 20; d++) {
      pondTick(w, d, w.player, { season: 1, day: d - 1 });
    }
    expect(getPond(w).pending).toBe(POND_MAX_PENDING_RIM);
    expect(pondRibbonFor(getPond(w), 'minnow')?.count).toBe(POND_MAX_PENDING_RIM);
  });

  it('records a separate ribbon for the swapped species after reseed', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    w.player.inventory['fish-pike'] = 1;
    stockPond(w, w.player);
    pondTick(w, 2, w.player, { season: 0, day: 2 });
    pondTick(w, 3, w.player, { season: 0, day: 3 });
    // Collect to clear pending, then reseed to pike.
    collectPond(w, w.player);
    const out = reseedPond(w, w.player);
    expect(out.kind).toBe('restocked');
    // Pike yields 1/day -> ribbon should creep up over a few days.
    pondTick(w, 4, w.player, { season: 0, day: 4 });
    pondTick(w, 5, w.player, { season: 0, day: 5 });
    expect(pondRibbonFor(getPond(w), 'minnow')?.count).toBeGreaterThan(0);
    expect(pondRibbonFor(getPond(w), 'pike')?.count).toBe(2);
  });
});

describe('pondRibbonLine + status integration', () => {
  it('returns "" when no ribbon yet', () => {
    const state = getPond(freshWorld());
    expect(pondRibbonLine(state, 'carp')).toBe('');
  });

  it('formats a ribbon with the season name', () => {
    const state = getPond(freshWorld());
    recordPondRibbon(state, 'pike', 4, { season: 2, day: 5 });
    expect(pondRibbonLine(state, 'pike')).toBe('ribbon: 4 in a day - Fall d5');
  });

  it('pondStatusLine surfaces the ribbon when the pond holds that species', () => {
    const w = freshWorld();
    w.player.inventory['fish-trout'] = 1;
    stockPond(w, w.player);
    pondTick(w, 2, w.player, { season: 3, day: 2 });
    const line = pondStatusLine(getPond(w), w.player);
    expect(line).toContain('ribbon: 1 in a day - Winter d2');
  });

  it('pondStatusLine still works for callers that don\'t want the rim', () => {
    const w = freshWorld();
    w.player.inventory['fish-bass'] = 1;
    stockPond(w, w.player);
    pondTick(w, 2, undefined, { season: 0, day: 2 });
    const line = pondStatusLine(getPond(w));
    expect(line).toContain('ribbon: 1 in a day - Spring d2');
    expect(line).not.toContain('rim cap');
  });
});
