// Fishing rod state-machine tests.
import { describe, it, expect } from 'vitest';
import { Rod, FISHING, canCastInto } from '../src/game/fishing';

describe('fishing rod', () => {
  it('starts idle and is not busy', () => {
    const rod = new Rod({ seed: 1 });
    expect(rod.state).toBe('idle');
    expect(rod.isBusy()).toBe(false);
  });

  it('cast() transitions to casting and rolls a deterministic wait', () => {
    const rod = new Rod({ seed: 42 });
    expect(rod.cast()).toBe(true);
    expect(rod.state).toBe('casting');
    expect(rod.waitMs).toBeGreaterThanOrEqual(FISHING.waitMinMs);
    expect(rod.waitMs).toBeLessThanOrEqual(FISHING.waitMaxMs);

    // Same seed → same wait, on a fresh rod.
    const rod2 = new Rod({ seed: 42 });
    rod2.cast();
    expect(rod2.waitMs).toBe(rod.waitMs);
  });

  it('cast() is ignored while busy', () => {
    const rod = new Rod({ seed: 1 });
    rod.cast();
    expect(rod.cast()).toBe(false);
    expect(rod.state).toBe('casting');
  });

  it('ticks through casting → waiting → biting and hooks a fish', () => {
    const rod = new Rod({ seed: 7 });
    rod.cast();
    // Burn the cast animation.
    rod.tick(FISHING.castMs);
    expect(rod.state).toBe('waiting');
    // Burn the random wait (use the rolled value).
    rod.tick(rod.waitMs);
    expect(rod.state).toBe('biting');
    expect(rod.hookedFish).not.toBeNull();
  });

  it('missing the bite window drops back to idle with escaped result', () => {
    const rod = new Rod({ seed: 13 });
    rod.cast();
    rod.tick(FISHING.castMs);
    rod.tick(rod.waitMs);
    expect(rod.state).toBe('biting');
    rod.tick(FISHING.biteWindowMs + 1);
    expect(rod.state).toBe('idle');
    expect(rod.lastResult).toBe('escaped');
    expect(rod.lastCatch).toBeNull();
  });

  it('reel() during BITING moves to reeling and finishes with a catch', () => {
    const rod = new Rod({ seed: 21 });
    rod.cast();
    rod.tick(FISHING.castMs);
    rod.tick(rod.waitMs);
    expect(rod.state).toBe('biting');
    const fish = rod.reel();
    expect(fish).not.toBeNull();
    expect(rod.state).toBe('reeling');
    rod.tick(FISHING.reelMs);
    expect(rod.state).toBe('idle');
    expect(rod.lastResult).toBe('caught');
    expect(rod.lastCatch).toBe(fish);
  });

  it('reel() outside BITING cancels back to idle', () => {
    const rod = new Rod({ seed: 99 });
    rod.cast();
    expect(rod.state).toBe('casting');
    expect(rod.reel()).toBeNull();
    expect(rod.state).toBe('idle');
    expect(rod.lastResult).toBe('escaped');
  });

  it('cancel() forces idle from any state', () => {
    const rod = new Rod({ seed: 5 });
    rod.cast();
    rod.tick(FISHING.castMs);
    expect(rod.state).toBe('waiting');
    rod.cancel();
    expect(rod.state).toBe('idle');
    expect(rod.hookedFish).toBeNull();
  });
});

describe('canCastInto', () => {
  // Tiny stub mimicking the world's tile probe contract.
  const probe = {
    inBounds: (tx: number, ty: number) =>
      tx >= 0 && ty >= 0 && tx < 3 && ty < 3,
    getTile: (tx: number, ty: number) =>
      tx === 1 && ty === 1 ? { type: 'water' } : { type: 'grass' },
  };

  it('accepts an in-bounds water tile', () => {
    expect(canCastInto(probe, 1, 1)).toBe(true);
  });

  it('rejects non-water tiles', () => {
    expect(canCastInto(probe, 0, 0)).toBe(false);
    expect(canCastInto(probe, 2, 2)).toBe(false);
  });

  it('rejects out-of-bounds tiles even if the stub would return water', () => {
    const alwaysWater = {
      inBounds: probe.inBounds,
      getTile: () => ({ type: 'water' }),
    };
    expect(canCastInto(alwaysWater, -1, 1)).toBe(false);
    expect(canCastInto(alwaysWater, 99, 99)).toBe(false);
  });
});
