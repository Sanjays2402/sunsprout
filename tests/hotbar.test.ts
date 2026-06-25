// Hotbar seed-stock warning — seedWarnLevel + seedWarnPulse.

import { describe, it, expect } from 'vitest';
import {
  seedWarnLevel,
  seedWarnPulse,
  seedWarnSteady,
  seedWarnIntensity,
  SEED_LOW_THRESHOLD,
  SEED_PULSE_PERIOD_MS,
  SEED_STEADY_LOW,
  SEED_STEADY_EMPTY,
  SEED_WARN_COLOR,
} from '../src/game/hotbar';

describe('seedWarnLevel', () => {
  it('flags an empty stack', () => {
    expect(seedWarnLevel(0)).toBe('empty');
    expect(seedWarnLevel(-3)).toBe('empty');
  });

  it('flags a stack at or below the low threshold', () => {
    expect(seedWarnLevel(SEED_LOW_THRESHOLD)).toBe('low');
  });

  it('stays quiet for a healthy stack', () => {
    expect(seedWarnLevel(SEED_LOW_THRESHOLD + 1)).toBe('none');
    expect(seedWarnLevel(99)).toBe('none');
  });
});

describe('seedWarnPulse', () => {
  it('is silent when there is no warning', () => {
    expect(seedWarnPulse('none', 0)).toBe(0);
    expect(seedWarnPulse('none', 12345)).toBe(0);
  });

  it('stays within 0..1 across a full period for low + empty', () => {
    for (const level of ['low', 'empty'] as const) {
      for (let ms = 0; ms <= SEED_PULSE_PERIOD_MS * 2; ms += 37) {
        const p = seedWarnPulse(level, ms);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never lets an empty stack fade fully (insistent floor)', () => {
    let min = Infinity;
    for (let ms = 0; ms <= SEED_PULSE_PERIOD_MS; ms += 7) {
      min = Math.min(min, seedWarnPulse('empty', ms));
    }
    // Empty floors at 0.45 -> the dimmest frame is still clearly visible.
    expect(min).toBeGreaterThanOrEqual(0.44);
  });

  it('lets a low stack breathe nearer to zero than empty does', () => {
    let lowMin = Infinity;
    let emptyMin = Infinity;
    for (let ms = 0; ms <= SEED_PULSE_PERIOD_MS * 4; ms += 5) {
      lowMin = Math.min(lowMin, seedWarnPulse('low', ms));
      emptyMin = Math.min(emptyMin, seedWarnPulse('empty', ms));
    }
    expect(lowMin).toBeLessThan(emptyMin);
  });

  it('is deterministic in nowMs (same time -> same pulse)', () => {
    expect(seedWarnPulse('low', 500)).toBe(seedWarnPulse('low', 500));
  });
});

describe('SEED_WARN_COLOR', () => {
  it('is a hex colour with no emoji', () => {
    expect(SEED_WARN_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('seedWarnSteady — reduce-motion intensity', () => {
  it('is silent with no warning', () => {
    expect(seedWarnSteady('none')).toBe(0);
  });

  it('marks low + empty with steady, visible constants', () => {
    expect(seedWarnSteady('low')).toBe(SEED_STEADY_LOW);
    expect(seedWarnSteady('empty')).toBe(SEED_STEADY_EMPTY);
    // Both clearly visible.
    expect(SEED_STEADY_LOW).toBeGreaterThan(0.5);
    expect(SEED_STEADY_EMPTY).toBeGreaterThan(0.5);
  });

  it('keeps empty brighter than low (urgency ordering preserved)', () => {
    expect(seedWarnSteady('empty')).toBeGreaterThan(seedWarnSteady('low'));
  });
});

describe('seedWarnIntensity — motion router', () => {
  it('routes to the animated breathe when motion is on', () => {
    for (const level of ['low', 'empty'] as const) {
      for (const ms of [0, 250, 600]) {
        expect(seedWarnIntensity(level, ms, false)).toBe(seedWarnPulse(level, ms));
      }
    }
  });

  it('routes to the steady value when reduceMotion is on', () => {
    for (const level of ['low', 'empty'] as const) {
      expect(seedWarnIntensity(level, 12345, true)).toBe(seedWarnSteady(level));
    }
  });

  it('is time-invariant under reduceMotion (no animation)', () => {
    const a = seedWarnIntensity('empty', 0, true);
    const b = seedWarnIntensity('empty', SEED_PULSE_PERIOD_MS / 2, true);
    const c = seedWarnIntensity('empty', SEED_PULSE_PERIOD_MS, true);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('stays silent for a healthy slot regardless of motion setting', () => {
    expect(seedWarnIntensity('none', 100, false)).toBe(0);
    expect(seedWarnIntensity('none', 100, true)).toBe(0);
  });
});
