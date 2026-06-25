// Hotbar seed-stock warning — seedWarnLevel + seedWarnPulse.

import { describe, it, expect } from 'vitest';
import {
  seedWarnLevel,
  seedWarnPulse,
  SEED_LOW_THRESHOLD,
  SEED_PULSE_PERIOD_MS,
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
