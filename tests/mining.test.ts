// Mining pickaxe + gem catalog tests.
//
// Mirrors `fishing.test.ts` deliberately — the two modules share shape,
// so the tests act as a regression spec for both. Slice 1: pure state
// machine + weighted gem roll + `canStrikeInto` probe. No UI or world
// coupling is exercised yet — those land in later v0.4.0 slices.
import { describe, it, expect } from 'vitest';
import { Pickaxe, MINING, canStrikeInto } from '../src/game/mining';
import { GEMS, GEM_KEYS, pickGem, gemInventoryKey } from '../src/game/gems';

describe('pickaxe', () => {
  it('starts idle and is not busy', () => {
    const pick = new Pickaxe({ seed: 1 });
    expect(pick.state).toBe('idle');
    expect(pick.isBusy()).toBe(false);
    expect(pick.lastDrop).toBeNull();
  });

  it('swing() transitions to swinging and is ignored while busy', () => {
    const pick = new Pickaxe({ seed: 2 });
    expect(pick.swing()).toBe(true);
    expect(pick.state).toBe('swinging');
    expect(pick.swing()).toBe(false);
    expect(pick.state).toBe('swinging');
  });

  it('ticks through swinging → striking on the swing window', () => {
    const pick = new Pickaxe({ seed: 3 });
    pick.swing();
    expect(pick.state).toBe('swinging');
    const changed = pick.tick(MINING.swingMs);
    expect(changed).toBe(true);
    expect(pick.state).toBe('striking');
  });

  it('missing the strike window glances back to idle with missed result', () => {
    const pick = new Pickaxe({ seed: 4 });
    pick.swing();
    pick.tick(MINING.swingMs);
    expect(pick.state).toBe('striking');
    pick.tick(MINING.strikeWindowMs + 1);
    expect(pick.state).toBe('idle');
    expect(pick.lastResult).toBe('missed');
    expect(pick.lastDrop).toBeNull();
  });

  it('strike() during STRIKING returns a gem and resets to idle', () => {
    const pick = new Pickaxe({ seed: 5 });
    pick.swing();
    pick.tick(MINING.swingMs);
    expect(pick.state).toBe('striking');
    const gem = pick.strike();
    expect(gem).not.toBeNull();
    expect(GEM_KEYS).toContain(gem!);
    expect(pick.state).toBe('idle');
    expect(pick.lastResult).toBe('struck');
    expect(pick.lastDrop).toBe(gem);
  });

  it('strike() outside STRIKING cancels back to idle as a misclick', () => {
    const pick = new Pickaxe({ seed: 6 });
    pick.swing();
    expect(pick.state).toBe('swinging');
    expect(pick.strike()).toBeNull();
    expect(pick.state).toBe('idle');
    expect(pick.lastResult).toBe('missed');
  });

  it('cancel() forces idle from any state', () => {
    const pick = new Pickaxe({ seed: 7 });
    pick.swing();
    pick.tick(MINING.swingMs);
    expect(pick.state).toBe('striking');
    pick.cancel();
    expect(pick.state).toBe('idle');
  });

  it('same seed → same gem drop on a clean strike (deterministic)', () => {
    const a = new Pickaxe({ seed: 12345 });
    a.swing();
    a.tick(MINING.swingMs);
    const gemA = a.strike();

    const b = new Pickaxe({ seed: 12345 });
    b.swing();
    b.tick(MINING.swingMs);
    const gemB = b.strike();

    expect(gemA).toBe(gemB);
  });
});

describe('gem catalog', () => {
  it('every gem has a name, positive price, positive weight, and hex colour', () => {
    for (const key of GEM_KEYS) {
      const g = GEMS[key];
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.sellPrice).toBeGreaterThan(0);
      expect(g.weight).toBeGreaterThan(0);
      expect(g.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('pickGem() always returns a known key', () => {
    // Probe several edge-case rng outputs to make sure we never fall off.
    const rngs = [() => 0, () => 0.0001, () => 0.5, () => 0.9999];
    for (const rng of rngs) {
      const k = pickGem(rng);
      expect(GEM_KEYS).toContain(k);
    }
  });

  it('weighted roll skews toward common gems over many trials', () => {
    // Deterministic-ish: sweep 0..1 in 1000 steps and count copper hits.
    // Copper has the highest weight, so it should dominate.
    let copper = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const u = (i + 0.5) / trials;
      if (pickGem(() => u) === 'copper') copper++;
    }
    const expected = GEMS.copper.weight /
      GEM_KEYS.reduce((s, k) => s + GEMS[k].weight, 0);
    // Allow generous tolerance — this is a smoke test, not a stats lab.
    expect(copper / trials).toBeGreaterThan(expected - 0.05);
    expect(copper / trials).toBeLessThan(expected + 0.05);
  });

  it('gemInventoryKey() prefixes with `gem-` to stay disjoint from other namespaces', () => {
    expect(gemInventoryKey('copper')).toBe('gem-copper');
    expect(gemInventoryKey('ruby')).toBe('gem-ruby');
  });
  it('clean strike + gemInventoryKey writes into a fresh inventory record', () => {
    // Mirrors how engine/game.ts wires the M-key: on a clean strike, the
    // returned gem key is shoved into `player.inventory[gemInventoryKey(gem)]`
    // and incremented. This guards the wiring contract end-to-end.
    const pick = new Pickaxe({ seed: 42 });
    const inventory: Record<string, number> = {};
    pick.swing();
    pick.tick(MINING.swingMs);
    const gem = pick.strike();
    expect(gem).not.toBeNull();
    const key = gemInventoryKey(gem!);
    inventory[key] = (inventory[key] ?? 0) + 1;
    expect(inventory[key]).toBe(1);
    expect(key.startsWith('gem-')).toBe(true);
  });
});

describe('canStrikeInto', () => {
  // Tiny stub mimicking the world's tile probe contract — same shape as
  // the fishing test stub, just with stone in the centre.
  const probe = {
    inBounds: (tx: number, ty: number) =>
      tx >= 0 && ty >= 0 && tx < 3 && ty < 3,
    getTile: (tx: number, ty: number) =>
      tx === 1 && ty === 1 ? { type: 'stone' } : { type: 'grass' },
  };

  it('accepts an in-bounds stone tile', () => {
    expect(canStrikeInto(probe, 1, 1)).toBe(true);
  });

  it('rejects non-stone tiles', () => {
    expect(canStrikeInto(probe, 0, 0)).toBe(false);
    expect(canStrikeInto(probe, 2, 2)).toBe(false);
  });

  it('rejects out-of-bounds tiles even when the stub returns stone', () => {
    const alwaysStone = {
      inBounds: probe.inBounds,
      getTile: () => ({ type: 'stone' }),
    };
    expect(canStrikeInto(alwaysStone, -1, 1)).toBe(false);
    expect(canStrikeInto(alwaysStone, 99, 99)).toBe(false);
  });
});
