// Crop sway — gentle wind offset for grown crop canopies.

import { describe, it, expect } from 'vitest';
import {
  cropSwayOffset,
  swayAmplitude,
  SWAY_PERIOD_MS,
} from '../src/game/crop-sway';

describe('swayAmplitude', () => {
  it('does not sway seeds or sprouts', () => {
    expect(swayAmplitude(0)).toBe(0);
    expect(swayAmplitude(1)).toBe(0);
  });

  it('sways mid crops a little and ripe crops the most', () => {
    expect(swayAmplitude(2)).toBeGreaterThan(0);
    expect(swayAmplitude(3)).toBeGreaterThan(swayAmplitude(2));
  });

  it('keeps the canopy lean sub-2px so the pixel art never tears', () => {
    expect(swayAmplitude(2)).toBeLessThan(2);
    expect(swayAmplitude(3)).toBeLessThan(2);
  });
});

describe('cropSwayOffset', () => {
  it('returns 0 under reduce-motion regardless of stage / time', () => {
    for (const stage of [0, 1, 2, 3]) {
      for (const ms of [0, 500, 1400, 9999]) {
        expect(cropSwayOffset(3, 4, stage, ms, true)).toBe(0);
      }
    }
  });

  it('returns 0 for un-grown stages even with motion on', () => {
    expect(cropSwayOffset(3, 4, 0, 700, false)).toBe(0);
    expect(cropSwayOffset(3, 4, 1, 700, false)).toBe(0);
  });

  it('is deterministic for a given (tile, stage, time)', () => {
    const a = cropSwayOffset(5, 6, 3, 1234, false);
    const b = cropSwayOffset(5, 6, 3, 1234, false);
    expect(a).toBe(b);
  });

  it('stays within the stage amplitude envelope', () => {
    for (let ms = 0; ms <= SWAY_PERIOD_MS; ms += 50) {
      const o = cropSwayOffset(2, 3, 3, ms, false);
      expect(Math.abs(o)).toBeLessThanOrEqual(swayAmplitude(3) + 1e-9);
    }
  });

  it('neighbouring tiles sway out of phase (the field ripples)', () => {
    // At a fixed time, two adjacent tiles should generally differ — the
    // per-tile phase offset is what keeps the field from marching in
    // lockstep. Find at least one moment where they diverge.
    let diverged = false;
    for (let ms = 0; ms < SWAY_PERIOD_MS && !diverged; ms += 40) {
      const a = cropSwayOffset(4, 4, 3, ms, false);
      const b = cropSwayOffset(5, 4, 3, ms, false);
      if (Math.abs(a - b) > 0.05) diverged = true;
    }
    expect(diverged).toBe(true);
  });

  it('completes a full cycle over SWAY_PERIOD_MS (periodic)', () => {
    const start = cropSwayOffset(1, 1, 3, 0, false);
    const oneCycle = cropSwayOffset(1, 1, 3, SWAY_PERIOD_MS, false);
    expect(oneCycle).toBeCloseTo(start, 5);
  });
});
