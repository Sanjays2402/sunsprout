// Confetti — celebratory burst on festival / birthday dawn.

import { describe, it, expect } from 'vitest';
import {
  confettiParticles,
  celebrationDayKey,
  CONFETTI_DURATION_MS,
  CONFETTI_COUNT,
  CONFETTI_COLORS,
} from '../src/game/confetti';
import type { TimeOfDay } from '../src/game/time';
import { festivalToday } from '../src/game/festivals';
import { birthdayCelebrant } from '../src/game/birthdays';

function t(season: number, day: number, hour = 6): TimeOfDay {
  return { season, day, hour, minute: 0 } as TimeOfDay;
}

const W = 800;
const H = 600;

describe('confettiParticles', () => {
  it('is empty before the burst and after it ends', () => {
    expect(confettiParticles(-10, W, H)).toEqual([]);
    expect(confettiParticles(CONFETTI_DURATION_MS + 1, W, H)).toEqual([]);
  });

  it('produces pieces during the burst, never more than the cap', () => {
    const mid = confettiParticles(CONFETTI_DURATION_MS / 2, W, H);
    expect(mid.length).toBeGreaterThan(0);
    expect(mid.length).toBeLessThanOrEqual(CONFETTI_COUNT);
  });

  it('is deterministic for a given (time, canvas)', () => {
    const a = confettiParticles(900, W, H);
    const b = confettiParticles(900, W, H);
    expect(a).toEqual(b);
  });

  it('keeps every piece inside the horizontal canvas bounds', () => {
    for (let ms = 0; ms <= CONFETTI_DURATION_MS; ms += 100) {
      for (const p of confettiParticles(ms, W, H)) {
        // Drift can carry a piece slightly past its spawn column; allow the
        // max drift envelope (~16px) of slack on each edge.
        expect(p.x).toBeGreaterThan(-20);
        expect(p.x).toBeLessThan(W + 20);
        expect(p.y).toBeLessThanOrEqual(H);
      }
    }
  });

  it('uses only the festive palette and small pixel sizes', () => {
    for (const p of confettiParticles(700, W, H)) {
      expect(CONFETTI_COLORS).toContain(p.color);
      expect(p.size).toBeGreaterThanOrEqual(2);
      expect(p.size).toBeLessThanOrEqual(3);
    }
  });

  it('fades out: alpha is full early and lower near the end', () => {
    const early = confettiParticles(200, W, H);
    const late = confettiParticles(CONFETTI_DURATION_MS - 100, W, H);
    const earlyAlpha = Math.max(...early.map((p) => p.alpha));
    const lateAlpha = Math.max(0, ...late.map((p) => p.alpha));
    expect(earlyAlpha).toBeCloseTo(1, 5);
    expect(lateAlpha).toBeLessThan(1);
  });

  it('pieces fall downward as the burst progresses', () => {
    // Track one specific piece by matching it across two frames is fiddly;
    // instead assert the average Y rises (pieces descend) over time.
    const avgY = (ms: number) => {
      const ps = confettiParticles(ms, W, H);
      return ps.reduce((s, p) => s + p.y, 0) / Math.max(1, ps.length);
    };
    expect(avgY(1600)).toBeGreaterThan(avgY(700));
  });
});

describe('celebrationDayKey', () => {
  it('returns a festival key on a festival day', () => {
    // Find a festival day from the source of truth.
    let found = false;
    for (let s = 0; s < 4 && !found; s++) {
      for (let d = 1; d <= 7 && !found; d++) {
        const time = t(s, d);
        if (festivalToday(time)) {
          expect(celebrationDayKey(time)).toBe(`fest-${s}-${d}`);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('returns a birthday key on an NPC birthday', () => {
    let found = false;
    for (let s = 0; s < 4 && !found; s++) {
      for (let d = 1; d <= 7 && !found; d++) {
        const time = t(s, d);
        const npc = birthdayCelebrant(time);
        if (npc && !festivalToday(time)) {
          expect(celebrationDayKey(time)).toBe(`bday-${npc}-${s}-${d}`);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('returns null on an ordinary day', () => {
    let sawNull = false;
    for (let s = 0; s < 4 && !sawNull; s++) {
      for (let d = 1; d <= 7 && !sawNull; d++) {
        const time = t(s, d);
        if (!festivalToday(time) && !birthdayCelebrant(time)) {
          expect(celebrationDayKey(time)).toBeNull();
          sawNull = true;
        }
      }
    }
    expect(sawNull).toBe(true);
  });

  it('keys are stable for the same day (no per-frame churn)', () => {
    const time = t(0, 3);
    expect(celebrationDayKey(time)).toBe(celebrationDayKey({ ...time, hour: 18 } as TimeOfDay));
  });
});
