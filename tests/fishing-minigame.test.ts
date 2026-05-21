// Fishing minigame — pure math layer tests.
import { describe, it, expect } from 'vitest';
import {
  MINIGAME,
  cursorPosition,
  gradeBonus,
  gradeLabel,
  gradeReel,
  type TimingZone,
} from '../src/ui/fishing-minigame';

describe('cursorPosition', () => {
  const period = 1000;

  it('starts at 0 at t=0', () => {
    expect(cursorPosition(0, period)).toBe(0);
  });

  it('hits 1 at the half-period peak', () => {
    expect(cursorPosition(period / 2, period)).toBeCloseTo(1, 5);
  });

  it('returns to 0 at the end of the period', () => {
    expect(cursorPosition(period, period)).toBeCloseTo(0, 5);
  });

  it('is a triangle wave: equal speed on both halves', () => {
    // Quarter-period samples should be symmetric around the peak.
    const up = cursorPosition(period * 0.25, period);
    const down = cursorPosition(period * 0.75, period);
    expect(up).toBeCloseTo(down, 5);
    expect(up).toBeCloseTo(0.5, 5);
  });

  it('wraps cleanly across multiple periods', () => {
    expect(cursorPosition(period * 2.5, period)).toBeCloseTo(1, 5);
    expect(cursorPosition(period * 7, period)).toBeCloseTo(0, 5);
  });

  it('is safe with zero/negative period', () => {
    expect(cursorPosition(100, 0)).toBe(0);
  });
});

describe('gradeReel', () => {
  const zone: TimingZone = { start: 0.4, end: 0.6, tolerance: 0.1 };

  it('returns "perfect" inside the green band (inclusive)', () => {
    expect(gradeReel(0.4, zone)).toBe('perfect');
    expect(gradeReel(0.5, zone)).toBe('perfect');
    expect(gradeReel(0.6, zone)).toBe('perfect');
  });

  it('returns "good" within tolerance of the band', () => {
    expect(gradeReel(0.32, zone)).toBe('good');
    expect(gradeReel(0.68, zone)).toBe('good');
  });

  it('returns "miss" outside the tolerance', () => {
    expect(gradeReel(0.05, zone)).toBe('miss');
    expect(gradeReel(0.95, zone)).toBe('miss');
  });

  it('uses the default zone when none is supplied', () => {
    // The default zone is centred near 0.5 so cursor=0.5 should be a clean perfect.
    expect(gradeReel(0.5)).toBe('perfect');
    expect(gradeReel(0)).toBe('miss');
  });
});

describe('gradeBonus / gradeLabel', () => {
  it('rewards perfect more than good, and miss is zero', () => {
    expect(gradeBonus('perfect')).toBe(MINIGAME.perfectBonusGold);
    expect(gradeBonus('good')).toBe(MINIGAME.goodBonusGold);
    expect(gradeBonus('miss')).toBe(0);
    expect(gradeBonus('perfect')).toBeGreaterThan(gradeBonus('good'));
  });

  it('labels are non-empty cozy strings', () => {
    expect(gradeLabel('perfect').length).toBeGreaterThan(0);
    expect(gradeLabel('good').length).toBeGreaterThan(0);
    expect(gradeLabel('miss').length).toBeGreaterThan(0);
  });
});
