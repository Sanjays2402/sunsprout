// Fish pond — stocking, daily yield, collect, idempotency, edge cases.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  POND_MAX_PENDING,
  POND_YIELD_PER_DAY,
  collectPond,
  getPond,
  interactPond,
  isPondTile,
  nearPond,
  pondBounds,
  pondStatusLine,
  pondTick,
  stockPond,
} from '../src/game/fish-pond';

function freshWorld(): World {
  const w = new World();
  w.player.gold = 100;
  w.player.inventory = { ...w.player.inventory };
  return w;
}

describe('pondBounds + isPondTile', () => {
  it('reports water tiles inside the carved pond', () => {
    const w = freshWorld();
    const b = pondBounds(w);
    expect(isPondTile(w, b.x0, b.y0)).toBe(true);
    expect(isPondTile(w, b.x1, b.y1)).toBe(true);
  });

  it('rejects tiles outside the pond footprint', () => {
    const w = freshWorld();
    expect(isPondTile(w, 0, 0)).toBe(false);
    expect(isPondTile(w, 10, 10)).toBe(false);
  });
});

describe('nearPond', () => {
  it('is true adjacent to a pond water tile', () => {
    const w = freshWorld();
    const b = pondBounds(w);
    // The tile directly east of the eastern pond edge is grass and adjacent.
    expect(nearPond(w, b.x1 + 1, b.y0)).toBe(true);
  });

  it('is false far from the pond', () => {
    const w = freshWorld();
    expect(nearPond(w, 30, 5)).toBe(false);
  });
});

describe('stockPond', () => {
  it('refuses when the player has no fish', () => {
    const w = freshWorld();
    const out = stockPond(w, w.player);
    expect(out.kind).toBe('empty-no-fish');
    expect(getPond(w).species).toBe(null);
  });

  it('seeds the pond with the most-abundant fish + consumes one', () => {
    const w = freshWorld();
    w.player.inventory['fish-trout'] = 1;
    w.player.inventory['fish-minnow'] = 3;
    const out = stockPond(w, w.player);
    expect(out.kind).toBe('stocked');
    if (out.kind === 'stocked') expect(out.species).toBe('minnow');
    expect(w.player.inventory['fish-minnow']).toBe(2);
    expect(getPond(w).species).toBe('minnow');
  });

  it('no-ops when the pond is already stocked', () => {
    const w = freshWorld();
    w.player.inventory['fish-trout'] = 1;
    stockPond(w, w.player);
    w.player.inventory['fish-bass'] = 1;
    const out = stockPond(w, w.player);
    expect(out.kind).toBe('nothing-pending');
    if (out.kind === 'nothing-pending') expect(out.species).toBe('trout');
    expect(w.player.inventory['fish-bass']).toBe(1); // not consumed
  });
});

describe('pondTick', () => {
  it('adds POND_YIELD_PER_DAY of the stocked species at dawn', () => {
    const w = freshWorld();
    w.player.inventory['fish-trout'] = 1;
    stockPond(w, w.player);
    const added = pondTick(w, 2);
    expect(added).toBe(POND_YIELD_PER_DAY.trout);
    expect(getPond(w).pending).toBe(POND_YIELD_PER_DAY.trout);
  });

  it('is idempotent per-day (lastYieldDay guards)', () => {
    const w = freshWorld();
    w.player.inventory['fish-trout'] = 1;
    stockPond(w, w.player);
    pondTick(w, 2);
    expect(pondTick(w, 2)).toBe(0);
  });

  it('does nothing when the pond is empty', () => {
    const w = freshWorld();
    expect(pondTick(w, 1)).toBe(0);
  });

  it('caps pending at POND_MAX_PENDING', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 1;
    stockPond(w, w.player);
    // Minnow yields 2/day -> POND_MAX_PENDING / 2 + 2 ticks to overflow.
    for (let d = 2; d < 2 + 20; d++) pondTick(w, d);
    expect(getPond(w).pending).toBeLessThanOrEqual(POND_MAX_PENDING);
    expect(getPond(w).pending).toBe(POND_MAX_PENDING);
  });
});

describe('collectPond', () => {
  it('grants pending fish into the bag', () => {
    const w = freshWorld();
    w.player.inventory['fish-bass'] = 1;
    stockPond(w, w.player);
    pondTick(w, 2);
    const before = w.player.inventory['fish-bass'] ?? 0;
    const out = collectPond(w, w.player);
    expect(out.kind).toBe('collected');
    if (out.kind === 'collected') {
      expect(w.player.inventory['fish-bass']).toBe(before + out.count);
    }
    expect(getPond(w).pending).toBe(0);
  });

  it('returns nothing-pending when stocked but empty', () => {
    const w = freshWorld();
    w.player.inventory['fish-bass'] = 1;
    stockPond(w, w.player);
    const out = collectPond(w, w.player);
    expect(out.kind).toBe('nothing-pending');
  });

  it('returns empty-no-fish on an unstocked pond', () => {
    const w = freshWorld();
    const out = collectPond(w, w.player);
    expect(out.kind).toBe('empty-no-fish');
  });
});

describe('interactPond routing', () => {
  it('too-far when the player is nowhere near', () => {
    const w = freshWorld();
    expect(interactPond(w, w.player, 30, 5).kind).toBe('too-far');
  });

  it('stocks on first press, collects on next-day press', () => {
    const w = freshWorld();
    const b = pondBounds(w);
    w.player.inventory['fish-pike'] = 1;
    const first = interactPond(w, w.player, b.x1 + 1, b.y0);
    expect(first.kind).toBe('stocked');
    pondTick(w, 2);
    const second = interactPond(w, w.player, b.x1 + 1, b.y0);
    expect(second.kind).toBe('collected');
    if (second.kind === 'collected') {
      expect(second.species).toBe('pike');
      expect(second.count).toBe(POND_YIELD_PER_DAY.pike);
    }
  });

  it('reports nothing-pending mid-day after collecting', () => {
    const w = freshWorld();
    const b = pondBounds(w);
    w.player.inventory['fish-carp'] = 1;
    interactPond(w, w.player, b.x1 + 1, b.y0);
    pondTick(w, 2);
    interactPond(w, w.player, b.x1 + 1, b.y0);
    const out = interactPond(w, w.player, b.x1 + 1, b.y0);
    expect(out.kind).toBe('nothing-pending');
  });
});

describe('pondStatusLine', () => {
  it('handles each state branch', () => {
    expect(pondStatusLine({ species: null, pending: 0, lastYieldDay: -1 })).toMatch(/empty/);
    expect(pondStatusLine({ species: 'trout', pending: 0, lastYieldDay: 1 })).toMatch(/tomorrow/);
    expect(pondStatusLine({ species: 'trout', pending: 2, lastYieldDay: 1 })).toMatch(/2 /);
  });
});
