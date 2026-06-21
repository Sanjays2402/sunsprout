// Fishing rod upgrades — tier cycle, spend gold, bite window scaling,
// fish bias, persistence round-trip.
import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  rodTier,
  rodNextTier,
  rodUpgradeCost,
  upgradeRod,
  rodBiteWindowFor,
  weightedFishPick,
  ROD_TIERS,
  ROD_UPGRADE_COST,
  ROD_BITE_WINDOW_SCALE,
  ROD_FISH_BIAS,
  rodTierLabel,
} from '../src/game/rod-upgrades';
import { FISH_KEYS } from '../src/game/fish';
import { FISHING } from '../src/game/fishing';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('rod tier accessor', () => {
  it('defaults to wood', () => {
    const w = new World();
    expect(rodTier(w.player)).toBe('wood');
  });

  it('rodNextTier walks the catalog and tops out at gold', () => {
    expect(rodNextTier('wood')).toBe('copper');
    expect(rodNextTier('copper')).toBe('iron');
    expect(rodNextTier('iron')).toBe('gold');
    expect(rodNextTier('gold')).toBeNull();
  });
});

describe('upgradeRod', () => {
  it('charges the listed cost and bumps the tier', () => {
    const w = new World();
    w.player.gold = 1000;
    expect(rodUpgradeCost(w.player)).toBe(ROD_UPGRADE_COST.copper);
    const out = upgradeRod(w.player);
    expect(out.kind).toBe('upgraded');
    if (out.kind === 'upgraded') {
      expect(out.from).toBe('wood');
      expect(out.to).toBe('copper');
      expect(out.cost).toBe(ROD_UPGRADE_COST.copper);
    }
    expect(rodTier(w.player)).toBe('copper');
    expect(w.player.gold).toBe(1000 - ROD_UPGRADE_COST.copper);
  });

  it('returns not-enough-gold and leaves state untouched', () => {
    const w = new World();
    w.player.gold = 10;
    const out = upgradeRod(w.player);
    expect(out.kind).toBe('not-enough-gold');
    expect(rodTier(w.player)).toBe('wood');
    expect(w.player.gold).toBe(10);
  });

  it('reports max-tier once gold is reached', () => {
    const w = new World();
    (w.player as unknown as { rodTier: string }).rodTier = 'gold';
    expect(rodUpgradeCost(w.player)).toBeNull();
    const out = upgradeRod(w.player);
    expect(out.kind).toBe('max-tier');
  });

  it('walks every tier when given enough gold', () => {
    const w = new World();
    w.player.gold = 100000;
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const out = upgradeRod(w.player);
      if (out.kind === 'upgraded') seen.push(out.to);
      else break;
    }
    expect(seen).toEqual(['copper', 'iron', 'gold']);
  });
});

describe('rodBiteWindowFor', () => {
  it('returns the catalog default for wood', () => {
    const w = new World();
    expect(rodBiteWindowFor(w.player)).toBe(FISHING.biteWindowMs);
  });

  it('scales up by the per-tier multiplier', () => {
    const w = new World();
    (w.player as unknown as { rodTier: string }).rodTier = 'gold';
    expect(rodBiteWindowFor(w.player)).toBe(
      Math.floor(FISHING.biteWindowMs * ROD_BITE_WINDOW_SCALE.gold),
    );
    expect(rodBiteWindowFor(w.player)).toBeGreaterThan(FISHING.biteWindowMs);
  });
});

describe('weightedFishPick — tier bias shifts the distribution', () => {
  function rollMany(player: Player, rolls = 4000): Record<string, number> {
    let seed = 4321;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const counts: Record<string, number> = { minnow: 0, carp: 0, bass: 0, trout: 0, pike: 0 };
    for (let i = 0; i < rolls; i++) {
      const fish = weightedFishPick(player, rng);
      counts[fish]++;
    }
    return counts;
  }

  it('wood rod leans heavily on minnows', () => {
    const w = new World();
    const counts = rollMany(w.player);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(counts.minnow / total).toBeGreaterThan(0.35);
    expect(counts.pike / total).toBeLessThan(0.10);
  });

  it('gold rod gives pike a meaningful share', () => {
    const w = new World();
    (w.player as unknown as { rodTier: string }).rodTier = 'gold';
    const counts = rollMany(w.player);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(counts.pike / total).toBeGreaterThan(0.06);
    expect(counts.minnow / total).toBeLessThan(0.35);
  });

  it('always returns a valid fish key', () => {
    const w = new World();
    for (const tier of ROD_TIERS) {
      (w.player as unknown as { rodTier: string }).rodTier = tier;
      for (let i = 0; i < 50; i++) {
        const fish = weightedFishPick(w.player, () => Math.random());
        expect(FISH_KEYS).toContain(fish);
      }
    }
  });
});

describe('persistence — rod tier survives a snapshot round-trip', () => {
  it('default wood round-trips as undefined', () => {
    const a = fakeGame();
    const snap = serializeGame(a);
    expect(snap.player.rodTier).toBeUndefined();
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(rodTier(b.world.player)).toBe('wood');
  });

  it('an upgraded tier survives the round-trip', () => {
    const a = fakeGame();
    a.world.player.gold = 10000;
    upgradeRod(a.world.player); // copper
    upgradeRod(a.world.player); // iron
    const snap = serializeGame(a);
    expect(snap.player.rodTier).toBe('iron');
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(rodTier(b.world.player)).toBe('iron');
  });
});

describe('ROD_FISH_BIAS catalog', () => {
  it('has a row per tier with every fish key', () => {
    for (const tier of ROD_TIERS) {
      const row = ROD_FISH_BIAS[tier];
      expect(row).toBeDefined();
      for (const f of FISH_KEYS) {
        expect(typeof row[f]).toBe('number');
        expect(row[f]).toBeGreaterThan(0);
      }
    }
  });

  it('higher tiers bias rare fish more than wood', () => {
    expect(ROD_FISH_BIAS.gold.pike).toBeGreaterThan(ROD_FISH_BIAS.wood.pike);
    expect(ROD_FISH_BIAS.gold.minnow).toBeLessThan(ROD_FISH_BIAS.wood.minnow);
  });
});

describe('rodTierLabel', () => {
  it('produces a readable label per tier', () => {
    expect(rodTierLabel('wood')).toContain('Wood');
    expect(rodTierLabel('gold')).toContain('Gold');
  });
});
