import { describe, it, expect } from 'vitest';
import {
  cursorPosition,
  gradeStrike,
  gradeBonus,
  gradeLabel,
  SWING,
} from '../src/ui/mining-minigame';
import { MINING } from '../src/game/mining';

describe('mining-minigame cursorPosition', () => {
  it('starts at 0 and ends at 1 across the strike window', () => {
    expect(cursorPosition(0)).toBe(0);
    expect(cursorPosition(MINING.strikeWindowMs)).toBe(1);
  });

  it('is roughly halfway at half the window', () => {
    const half = cursorPosition(MINING.strikeWindowMs / 2);
    expect(half).toBeGreaterThan(0.45);
    expect(half).toBeLessThan(0.55);
  });

  it('clamps negative and overshoot inputs', () => {
    expect(cursorPosition(-100)).toBe(0);
    expect(cursorPosition(MINING.strikeWindowMs * 5)).toBe(1);
  });
});

describe('mining-minigame gradeStrike', () => {
  const z = SWING.defaultZone;

  it('returns perfect inside the gold band', () => {
    expect(gradeStrike((z.start + z.end) / 2)).toBe('perfect');
  });

  it('returns good in the tolerance buffer', () => {
    expect(gradeStrike(z.start - z.tolerance / 2)).toBe('good');
    expect(gradeStrike(z.end + z.tolerance / 2)).toBe('good');
  });

  it('returns clean far from the zone', () => {
    expect(gradeStrike(0)).toBe('clean');
    expect(gradeStrike(1)).toBe('clean');
  });
});

describe('mining-minigame bonus + label', () => {
  it('perfect pays more than good, clean pays nothing', () => {
    expect(gradeBonus('perfect')).toBeGreaterThan(gradeBonus('good'));
    expect(gradeBonus('good')).toBeGreaterThan(0);
    expect(gradeBonus('clean')).toBe(0);
  });

  it('labels are non-empty cozy strings', () => {
    expect(gradeLabel('perfect').length).toBeGreaterThan(0);
    expect(gradeLabel('good').length).toBeGreaterThan(0);
    expect(gradeLabel('clean').length).toBeGreaterThan(0);
  });
});
