// Stamina low-energy warning — staminaWarnLevel + staminaWarnPulse +
// staminaWarnSteady + staminaWarnIntensity, the pure model behind the HUD
// stamina bar's warning border. Thresholds are tied to the ACTION COSTS
// (not a fraction of max) so a bath-house max buff doesn't shift the line.

import { describe, it, expect } from 'vitest';
import {
  staminaWarnLevel,
  staminaWarnPulse,
  staminaWarnSteady,
  staminaWarnIntensity,
  staminaWarnColor,
  STAMINA_CRIT_THRESHOLD,
  STAMINA_LOW_THRESHOLD,
  STAMINA_PULSE_PERIOD_MS,
  STAMINA_STEADY_LOW,
  STAMINA_STEADY_CRIT,
  STAMINA_WARN_LOW_COLOR,
  STAMINA_WARN_CRIT_COLOR,
  STAMINA_COST,
  type StaminaState,
} from '../src/game/stamina';

const st = (current: number, max = 100): StaminaState => ({
  current,
  max,
  lastRefillDay: 1,
});

describe('staminaWarnLevel', () => {
  it('flags crit below the costliest action cost (a mine swing)', () => {
    expect(STAMINA_CRIT_THRESHOLD).toBe(STAMINA_COST.mine);
    expect(staminaWarnLevel(st(STAMINA_CRIT_THRESHOLD - 1))).toBe('crit');
    expect(staminaWarnLevel(st(0))).toBe('crit');
  });

  it('flags low between the crit and low thresholds', () => {
    expect(staminaWarnLevel(st(STAMINA_CRIT_THRESHOLD))).toBe('low');
    expect(staminaWarnLevel(st(STAMINA_LOW_THRESHOLD - 1))).toBe('low');
  });

  it('stays quiet at or above the low threshold', () => {
    expect(staminaWarnLevel(st(STAMINA_LOW_THRESHOLD))).toBe('none');
    expect(staminaWarnLevel(st(100))).toBe('none');
  });

  it('keys off the absolute value, not the fraction of max (bath buff safe)', () => {
    // With a lifted cap (130) a full-ish pool is a big absolute number, so
    // a healthy 80/130 still reads 'none' even though it's under 2/3 full.
    expect(staminaWarnLevel(st(80, 130))).toBe('none');
    // And an absolute-low pool reads crit regardless of the lifted cap.
    expect(staminaWarnLevel(st(4, 130))).toBe('crit');
  });
});

describe('staminaWarnPulse', () => {
  it('is silent with no warning', () => {
    expect(staminaWarnPulse('none', 0)).toBe(0);
    expect(staminaWarnPulse('none', 9999)).toBe(0);
  });

  it('stays within 0..1 across a full period for low + crit', () => {
    for (const level of ['low', 'crit'] as const) {
      for (let ms = 0; ms <= STAMINA_PULSE_PERIOD_MS * 2; ms += 31) {
        const p = staminaWarnPulse(level, ms);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never lets crit fade fully (insistent floor)', () => {
    let min = Infinity;
    for (let ms = 0; ms <= STAMINA_PULSE_PERIOD_MS; ms += 5) {
      min = Math.min(min, staminaWarnPulse('crit', ms));
    }
    expect(min).toBeGreaterThanOrEqual(0.49);
  });

  it('lets low breathe nearer to zero than crit does', () => {
    let lowMin = Infinity;
    let critMin = Infinity;
    for (let ms = 0; ms <= STAMINA_PULSE_PERIOD_MS * 4; ms += 5) {
      lowMin = Math.min(lowMin, staminaWarnPulse('low', ms));
      critMin = Math.min(critMin, staminaWarnPulse('crit', ms));
    }
    expect(lowMin).toBeLessThan(critMin);
  });

  it('is deterministic in nowMs', () => {
    expect(staminaWarnPulse('low', 500)).toBe(staminaWarnPulse('low', 500));
  });
});

describe('staminaWarnSteady — reduce-motion intensity', () => {
  it('is silent with no warning', () => {
    expect(staminaWarnSteady('none')).toBe(0);
  });

  it('marks low + crit with steady, visible constants', () => {
    expect(staminaWarnSteady('low')).toBe(STAMINA_STEADY_LOW);
    expect(staminaWarnSteady('crit')).toBe(STAMINA_STEADY_CRIT);
    expect(STAMINA_STEADY_LOW).toBeGreaterThan(0.5);
    expect(STAMINA_STEADY_CRIT).toBeGreaterThan(0.5);
  });

  it('keeps crit brighter than low (urgency ordering preserved)', () => {
    expect(staminaWarnSteady('crit')).toBeGreaterThan(staminaWarnSteady('low'));
  });
});

describe('staminaWarnIntensity — motion router', () => {
  it('routes to the breathe when motion is on', () => {
    for (const level of ['low', 'crit'] as const) {
      for (const ms of [0, 300, 700]) {
        expect(staminaWarnIntensity(level, ms, false)).toBe(staminaWarnPulse(level, ms));
      }
    }
  });

  it('routes to the steady value under reduceMotion', () => {
    for (const level of ['low', 'crit'] as const) {
      expect(staminaWarnIntensity(level, 9999, true)).toBe(staminaWarnSteady(level));
    }
  });

  it('is time-invariant under reduceMotion', () => {
    const a = staminaWarnIntensity('crit', 0, true);
    const b = staminaWarnIntensity('crit', STAMINA_PULSE_PERIOD_MS / 2, true);
    expect(a).toBe(b);
  });

  it('stays silent for a healthy pool regardless of motion', () => {
    expect(staminaWarnIntensity('none', 100, false)).toBe(0);
    expect(staminaWarnIntensity('none', 100, true)).toBe(0);
  });
});

describe('staminaWarnColor', () => {
  it('is amber for low, red for crit, both hex with no emoji', () => {
    expect(staminaWarnColor('low')).toBe(STAMINA_WARN_LOW_COLOR);
    expect(staminaWarnColor('crit')).toBe(STAMINA_WARN_CRIT_COLOR);
    expect(STAMINA_WARN_LOW_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(STAMINA_WARN_CRIT_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
