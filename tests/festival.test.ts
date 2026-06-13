// Festival Days — unit tests for src/game/festival.ts and
// src/ui/festival-banner.ts
import { describe, it, expect } from 'vitest';
import {
  getFestival,
  isFestivalDay,
  festivalActivityBonus,
  type Festival,
} from '../src/game/festival';
import { SEASON_LENGTH } from '../src/game/time';
import { FestivalBanner } from '../src/ui/festival-banner';

// ---------------------------------------------------------------------------
// getFestival / isFestivalDay
// ---------------------------------------------------------------------------

describe('getFestival', () => {
  it('returns null on non-final days', () => {
    for (const season of [0, 1, 2, 3] as const) {
      for (let day = 1; day < SEASON_LENGTH; day++) {
        expect(getFestival(day, season)).toBeNull();
      }
    }
  });

  it('returns a festival on the last day of each season', () => {
    const expectedKinds = [
      'spring-planting',
      'summer-fishing',
      'fall-harvest',
      'winter-star',
    ] as const;
    for (let s = 0; s < 4; s++) {
      const f = getFestival(SEASON_LENGTH, s as 0 | 1 | 2 | 3);
      expect(f).not.toBeNull();
      expect(f!.kind).toBe(expectedKinds[s]);
    }
  });

  it('each festival has a non-empty name and subtitle', () => {
    for (let s = 0; s < 4; s++) {
      const f = getFestival(SEASON_LENGTH, s as 0 | 1 | 2 | 3)!;
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.subtitle.length).toBeGreaterThan(0);
    }
  });
});

describe('isFestivalDay', () => {
  it('returns true on festival days', () => {
    for (let s = 0; s < 4; s++) {
      expect(isFestivalDay(SEASON_LENGTH, s as 0 | 1 | 2 | 3)).toBe(true);
    }
  });

  it('returns false on non-festival days', () => {
    expect(isFestivalDay(1, 0)).toBe(false);
    expect(isFestivalDay(3, 2)).toBe(false);
    expect(isFestivalDay(SEASON_LENGTH - 1, 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// festivalActivityBonus
// ---------------------------------------------------------------------------

describe('festivalActivityBonus', () => {
  it('returns 0 when festival is null', () => {
    expect(festivalActivityBonus(null, 'plant')).toBe(0);
    expect(festivalActivityBonus(null, 'fish')).toBe(0);
    expect(festivalActivityBonus(null, 'harvest')).toBe(0);
    expect(festivalActivityBonus(null, 'gift')).toBe(0);
  });

  it('returns 0 for non-matching activity on any festival', () => {
    const spring = getFestival(SEASON_LENGTH, 0)!; // bonusActivity: 'plant'
    expect(festivalActivityBonus(spring, 'fish')).toBe(0);
    expect(festivalActivityBonus(spring, 'harvest')).toBe(0);
    expect(festivalActivityBonus(spring, 'gift')).toBe(0);
  });

  it('returns bonus for the matching activity', () => {
    const spring = getFestival(SEASON_LENGTH, 0)!;
    expect(festivalActivityBonus(spring, 'plant')).toBe(spring.activityBonus);

    const summer = getFestival(SEASON_LENGTH, 1)!;
    expect(festivalActivityBonus(summer, 'fish')).toBe(summer.activityBonus);

    const fall = getFestival(SEASON_LENGTH, 2)!;
    expect(festivalActivityBonus(fall, 'harvest')).toBe(fall.activityBonus);

    const winter = getFestival(SEASON_LENGTH, 3)!;
    expect(festivalActivityBonus(winter, 'gift')).toBe(winter.activityBonus);
  });

  it('each festival bonus is a positive integer', () => {
    for (let s = 0; s < 4; s++) {
      const f = getFestival(SEASON_LENGTH, s as 0 | 1 | 2 | 3)!;
      expect(f.activityBonus).toBeGreaterThan(0);
      expect(Number.isInteger(f.activityBonus)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// FestivalBanner
// ---------------------------------------------------------------------------

describe('FestivalBanner', () => {
  const mockFestival = getFestival(SEASON_LENGTH, 0) as Festival;

  it('starts invisible', () => {
    const banner = new FestivalBanner();
    expect(banner.isVisible()).toBe(false);
  });

  it('becomes visible after open()', () => {
    const banner = new FestivalBanner();
    banner.open(mockFestival);
    expect(banner.isVisible()).toBe(true);
  });

  it('stays visible during the display window', () => {
    const banner = new FestivalBanner();
    banner.open(mockFestival);
    banner.update(1000);
    expect(banner.isVisible()).toBe(true);
  });

  it('becomes invisible after the total duration has elapsed', () => {
    const banner = new FestivalBanner();
    banner.open(mockFestival);
    // Total duration is 500 (fade-in) + 2800 (hold) + 700 (fade-out) = 4000ms
    banner.update(4100);
    expect(banner.isVisible()).toBe(false);
  });

  it('can be re-opened for a new festival', () => {
    const banner = new FestivalBanner();
    banner.open(mockFestival);
    banner.update(4100); // let it expire
    expect(banner.isVisible()).toBe(false);
    const winterFest = getFestival(SEASON_LENGTH, 3) as Festival;
    banner.open(winterFest);
    expect(banner.isVisible()).toBe(true);
  });

  it('draw() does not throw when called while visible', () => {
    const banner = new FestivalBanner();
    banner.open(mockFestival);
    // Minimal canvas mock.
    const ctx = {
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      imageSmoothingEnabled: true,
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D;
    expect(() => banner.draw(ctx, 800, 600)).not.toThrow();
  });

  it('draw() is a no-op when not visible', () => {
    const banner = new FestivalBanner();
    let called = false;
    const ctx = {
      save: () => { called = true; },
    } as unknown as CanvasRenderingContext2D;
    banner.draw(ctx, 800, 600);
    expect(called).toBe(false);
  });
});
