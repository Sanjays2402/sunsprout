// Pickaxe upgrades — tier cycle, spend gold, weighted gem bias, persistence.
import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  pickaxeTier,
  pickaxeNextTier,
  pickaxeUpgradeCost,
  upgradePickaxe,
  weightedGemPick,
  PICKAXE_TIERS,
  PICKAXE_UPGRADE_COST,
  PICKAXE_GEM_BIAS,
  pickaxeTierLabel,
} from '../src/game/pickaxe-upgrades';
import { GEM_KEYS } from '../src/game/gems';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('pickaxe tier accessor', () => {
  it('defaults to wood', () => {
    const w = new World();
    expect(pickaxeTier(w.player)).toBe('wood');
  });

  it('pickaxeNextTier walks the catalog in order, returns null at the top', () => {
    expect(pickaxeNextTier('wood')).toBe('copper');
    expect(pickaxeNextTier('copper')).toBe('iron');
    expect(pickaxeNextTier('iron')).toBe('gold');
    expect(pickaxeNextTier('gold')).toBe('diamond');
    expect(pickaxeNextTier('diamond')).toBeNull();
  });
});

describe('upgradePickaxe', () => {
  it('charges the listed cost and bumps the tier', () => {
    const w = new World();
    w.player.gold = 500;
    expect(pickaxeUpgradeCost(w.player)).toBe(PICKAXE_UPGRADE_COST.copper);
    const out = upgradePickaxe(w.player);
    expect(out.kind).toBe('upgraded');
    if (out.kind === 'upgraded') {
      expect(out.from).toBe('wood');
      expect(out.to).toBe('copper');
      expect(out.cost).toBe(PICKAXE_UPGRADE_COST.copper);
    }
    expect(pickaxeTier(w.player)).toBe('copper');
    expect(w.player.gold).toBe(500 - PICKAXE_UPGRADE_COST.copper);
  });

  it('returns not-enough-gold and leaves state untouched', () => {
    const w = new World();
    w.player.gold = 10;
    const out = upgradePickaxe(w.player);
    expect(out.kind).toBe('not-enough-gold');
    expect(pickaxeTier(w.player)).toBe('wood');
    expect(w.player.gold).toBe(10);
  });

  it('reports max-tier once diamond is reached', () => {
    const w = new World();
    (w.player as unknown as { pickaxeTier: string }).pickaxeTier = 'diamond';
    expect(pickaxeUpgradeCost(w.player)).toBeNull();
    const out = upgradePickaxe(w.player);
    expect(out.kind).toBe('max-tier');
  });

  it('walks every tier when given enough gold', () => {
    const w = new World();
    w.player.gold = 100000;
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const out = upgradePickaxe(w.player);
      if (out.kind === 'upgraded') seen.push(out.to);
      else break;
    }
    expect(seen).toEqual(['copper', 'iron', 'gold', 'diamond']);
  });
});

describe('weightedGemPick — tier bias actually shifts the distribution', () => {
  function rollMany(
    player: Player,
    rolls = 4000,
  ): Record<string, number> {
    let seed = 1234;
    const rng = () => {
      // Linear congruential; deterministic per test run.
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const counts: Record<string, number> = { copper: 0, iron: 0, silver: 0, gold: 0, ruby: 0 };
    for (let i = 0; i < rolls; i++) {
      const g = weightedGemPick(player, rng);
      counts[g]++;
    }
    return counts;
  }

  it('wood pickaxe leans heavily toward copper', () => {
    const w = new World();
    const counts = rollMany(w.player);
    // Copper is the catalog's heaviest weight (45) — should dominate.
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(counts.copper / total).toBeGreaterThan(0.35);
    expect(counts.ruby / total).toBeLessThan(0.10);
  });

  it('diamond pickaxe shifts ruby to a sizeable share', () => {
    const w = new World();
    (w.player as unknown as { pickaxeTier: string }).pickaxeTier = 'diamond';
    const counts = rollMany(w.player);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(counts.ruby / total).toBeGreaterThan(0.10);
    // And copper should now be a minority.
    expect(counts.copper / total).toBeLessThan(0.30);
  });

  it('always returns a valid gem key', () => {
    const w = new World();
    for (const tier of PICKAXE_TIERS) {
      (w.player as unknown as { pickaxeTier: string }).pickaxeTier = tier;
      for (let i = 0; i < 50; i++) {
        const gem = weightedGemPick(w.player, () => Math.random());
        expect(GEM_KEYS).toContain(gem);
      }
    }
  });
});

describe('persistence — pickaxe tier survives a snapshot round-trip', () => {
  it('default wood round-trips as undefined', () => {
    const a = fakeGame();
    const snap = serializeGame(a);
    expect(snap.player.pickaxeTier).toBeUndefined();
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(pickaxeTier(b.world.player)).toBe('wood');
  });

  it('an upgraded tier survives the round-trip', () => {
    const a = fakeGame();
    a.world.player.gold = 10000;
    upgradePickaxe(a.world.player); // copper
    upgradePickaxe(a.world.player); // iron
    upgradePickaxe(a.world.player); // gold
    const snap = serializeGame(a);
    expect(snap.player.pickaxeTier).toBe('gold');
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(pickaxeTier(b.world.player)).toBe('gold');
  });
});

describe('PICKAXE_GEM_BIAS catalog', () => {
  it('has a row per tier with every gem key', () => {
    for (const tier of PICKAXE_TIERS) {
      const row = PICKAXE_GEM_BIAS[tier];
      expect(row).toBeDefined();
      for (const g of GEM_KEYS) {
        expect(typeof row[g]).toBe('number');
        expect(row[g]).toBeGreaterThan(0);
      }
    }
  });

  it('higher tiers bias rare gems more than wood', () => {
    expect(PICKAXE_GEM_BIAS.diamond.ruby).toBeGreaterThan(PICKAXE_GEM_BIAS.wood.ruby);
    expect(PICKAXE_GEM_BIAS.diamond.copper).toBeLessThan(PICKAXE_GEM_BIAS.wood.copper);
  });
});

describe('pickaxeTierLabel', () => {
  it('produces a readable label per tier', () => {
    expect(pickaxeTierLabel('wood')).toContain('Wood');
    expect(pickaxeTierLabel('diamond')).toContain('Diamond');
  });
});
