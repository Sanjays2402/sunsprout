// Sky dial — sun/moon arc math for the HUD daylight widget.

import { describe, it, expect } from 'vitest';
import {
  skyDialState,
  daylightMinutesLeft,
  phaseLabelFor,
  DAY_HOURS,
  NIGHT_HOURS,
} from '../src/game/sky-dial';
import { DAY_START, DAY_END } from '../src/game/time';

describe('skyDialState — body selection', () => {
  it('shows the sun during daytime', () => {
    expect(skyDialState(DAY_START).body).toBe('sun');
    expect(skyDialState(12).body).toBe('sun');
    expect(skyDialState(DAY_END - 1).body).toBe('sun');
  });

  it('shows the moon at night', () => {
    expect(skyDialState(DAY_END).body).toBe('moon');
    expect(skyDialState(0).body).toBe('moon');
    expect(skyDialState(3).body).toBe('moon');
    expect(skyDialState(DAY_START - 1).body).toBe('moon');
  });

  it('isDay flips exactly at the boundaries', () => {
    expect(skyDialState(DAY_START).isDay).toBe(true);
    expect(skyDialState(DAY_END).isDay).toBe(false);
    expect(skyDialState(DAY_END - 0.01 * 60, 0).isDay).toBe(true);
  });
});

describe('skyDialState — arc parameter', () => {
  it('sun rises at the left horizon (arcT 0) at DAY_START', () => {
    expect(skyDialState(DAY_START, 0).arcT).toBeCloseTo(0, 5);
  });

  it('sun reaches the zenith near midday', () => {
    const mid = DAY_START + DAY_HOURS / 2;
    const s = skyDialState(Math.floor(mid), (mid % 1) * 60);
    expect(s.arcT).toBeCloseTo(0.5, 2);
    expect(s.altitude).toBeCloseTo(1, 2);
  });

  it('arcT is monotonic across the day', () => {
    let prev = -1;
    for (let h = DAY_START; h < DAY_END; h++) {
      const t = skyDialState(h).arcT;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('moon arc spans the night and wraps midnight monotonically', () => {
    // Sample dusk -> midnight -> dawn; arcT should keep rising.
    const samples = [DAY_END, 23, 0, 2, DAY_START - 1].map((h) => skyDialState(h).arcT);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it('altitude is zero at both horizons and never exceeds 1', () => {
    expect(skyDialState(DAY_START).altitude).toBeCloseTo(0, 5);
    for (let h = 0; h < 24; h++) {
      const a = skyDialState(h).altitude;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});

describe('daylightMinutesLeft', () => {
  it('is the full window at sunrise', () => {
    expect(daylightMinutesLeft(DAY_START, 0)).toBe(DAY_HOURS * 60);
  });

  it('counts down through the day', () => {
    const noon = daylightMinutesLeft(12, 0);
    const later = daylightMinutesLeft(15, 0);
    expect(later).toBeLessThan(noon);
    expect(later).toBe((DAY_END - 15) * 60);
  });

  it('is zero once the sun has set', () => {
    expect(daylightMinutesLeft(DAY_END, 0)).toBe(0);
    expect(daylightMinutesLeft(23, 30)).toBe(0);
    expect(daylightMinutesLeft(2, 0)).toBe(0);
  });

  it('accounts for minutes', () => {
    expect(daylightMinutesLeft(DAY_END - 1, 30)).toBe(30);
  });
});

describe('phaseLabelFor', () => {
  it('labels the daytime arc progression', () => {
    expect(phaseLabelFor(DAY_START, true, 0)).toBe('Dawn');
    expect(phaseLabelFor(12, true, 0.5)).toBe('Midday');
    expect(phaseLabelFor(DAY_END - 1, true, 0.95)).toBe('Dusk');
  });

  it('labels the nighttime arc progression', () => {
    expect(phaseLabelFor(DAY_END, false, 0.05)).toBe('Dusk');
    expect(phaseLabelFor(0, false, 0.6)).toBe('Night');
    expect(phaseLabelFor(DAY_START - 0.5, false, 0.95)).toBe('Pre-dawn');
  });
});

describe('window constants', () => {
  it('day + night hours sum to 24', () => {
    expect(DAY_HOURS + NIGHT_HOURS).toBe(24);
  });
});
