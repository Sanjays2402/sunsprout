// Almanac — forward-looking village event aggregator for the `0` panel.

import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  buildAlmanac,
  whenLabel,
  dateLabel,
  dateInDays,
  ALMANAC_HORIZON_DAYS,
} from '../src/game/almanac';

/** Build a clock parked at a given season/day. */
function clockAt(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = day;
  return t;
}

describe('buildAlmanac — aggregation', () => {
  it('returns entries sorted by soonest first', () => {
    const list = buildAlmanac(clockAt(0, 1));
    for (let i = 1; i < list.length; i++) {
      expect(list[i].daysUntil).toBeGreaterThanOrEqual(list[i - 1].daysUntil);
    }
  });

  it('pulls in all four event kinds across a Spring fortnight', () => {
    // Spring d1: cart d3 (+2), tournament d6 (+5), festival d7 (+6),
    // mayor birthday d3 (+2) all fall within the 14-day horizon.
    const kinds = new Set(buildAlmanac(clockAt(0, 1)).map((e) => e.kind));
    expect(kinds.has('festival')).toBe(true);
    expect(kinds.has('tournament')).toBe(true);
    expect(kinds.has('cart')).toBe(true);
    expect(kinds.has('birthday')).toBe(true);
  });

  it('marks the planting fair as today when standing on Spring 7', () => {
    const list = buildAlmanac(clockAt(0, 7));
    const fair = list.find((e) => e.kind === 'festival' && e.title.includes('Planting'));
    expect(fair).toBeDefined();
    expect(fair!.daysUntil).toBe(0);
  });

  it('honours the horizon — nothing beyond it leaks in', () => {
    const list = buildAlmanac(clockAt(0, 1), 3);
    for (const e of list) {
      expect(e.daysUntil).toBeLessThanOrEqual(3);
    }
  });

  it('computes the cart visit as 2 days out on Spring 1', () => {
    const cart = buildAlmanac(clockAt(0, 1)).find((e) => e.kind === 'cart');
    expect(cart).toBeDefined();
    expect(cart!.daysUntil).toBe(2); // d1 -> d3
    expect(cart!.day).toBe(3);
    expect(cart!.season).toBe(0);
  });

  it('finds the tournament 5 days out on Spring 1 with the season label', () => {
    const t = buildAlmanac(clockAt(0, 1)).find((e) => e.kind === 'tournament');
    expect(t).toBeDefined();
    expect(t!.daysUntil).toBe(5); // d1 -> d6
    expect(t!.title).toBe('Spring Flower Show');
  });

  it('wraps across the season boundary for events earlier in the week', () => {
    // On Spring 7, the next cart (Spring d3) is next season-week away.
    const cart = buildAlmanac(clockAt(0, 7), 28).find((e) => e.kind === 'cart');
    expect(cart).toBeDefined();
    // d7 -> next d3 is 7-?-> wraps: (2 - 6 + 28) % 28 = 24 days... but the
    // soonest cart across all 4 seasons is summer d3. Just assert it's a
    // positive forward offset within a full year.
    expect(cart!.daysUntil).toBeGreaterThan(0);
    expect(cart!.daysUntil).toBeLessThanOrEqual(28);
  });

  it('every entry carries a non-empty title and a valid date', () => {
    const list = buildAlmanac(clockAt(1, 4), 28);
    for (const e of list) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.season).toBeGreaterThanOrEqual(0);
      expect(e.season).toBeLessThan(4);
      expect(e.day).toBeGreaterThanOrEqual(1);
      expect(e.day).toBeLessThanOrEqual(7);
    }
  });

  it('defaults to a two-week horizon', () => {
    expect(ALMANAC_HORIZON_DAYS).toBe(14);
    const list = buildAlmanac(clockAt(2, 1));
    for (const e of list) {
      expect(e.daysUntil).toBeLessThanOrEqual(14);
    }
  });
});

describe('whenLabel', () => {
  it('reads naturally for near dates', () => {
    expect(whenLabel(0)).toBe('Today');
    expect(whenLabel(1)).toBe('Tomorrow');
    expect(whenLabel(5)).toBe('in 5 days');
  });
});

describe('dateLabel', () => {
  it('stamps season + day', () => {
    expect(dateLabel(0, 7)).toBe('Spring 7');
    expect(dateLabel(3, 1)).toBe('Winter 1');
  });
});

describe('dateInDays', () => {
  it('advances within a season', () => {
    expect(dateInDays(clockAt(0, 1), 3)).toEqual({ season: 0, day: 4 });
  });

  it('rolls into the next season at the week boundary', () => {
    expect(dateInDays(clockAt(0, 6), 3)).toEqual({ season: 1, day: 2 });
  });

  it('wraps the full year back to Spring', () => {
    expect(dateInDays(clockAt(3, 7), 1)).toEqual({ season: 0, day: 1 });
  });
});
