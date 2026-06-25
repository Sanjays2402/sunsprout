// Almanac HUD highlight — almanacHighlight + highlightChipText.

import { describe, it, expect } from 'vitest';
import { almanacHighlight, highlightChipText, buildAlmanac } from '../src/game/almanac';
import type { TimeOfDay } from '../src/game/time';

function t(season: number, day: number, hour = 9): TimeOfDay {
  return { season, day, hour, minute: 0 } as TimeOfDay;
}

describe('almanacHighlight', () => {
  it('returns the soonest event within the day window', () => {
    // Find any calendar slot that has at least one event today or tomorrow.
    let found = false;
    for (let s = 0; s < 4 && !found; s++) {
      for (let d = 1; d <= 7 && !found; d++) {
        const time = t(s, d);
        const hit = almanacHighlight(time, 1);
        if (hit) {
          // The highlight is the first entry in the full almanac that's <= 1 day out.
          const first = buildAlmanac(time).find((e) => e.daysUntil <= 1);
          expect(hit).toEqual(first);
          expect(hit.daysUntil).toBeLessThanOrEqual(1);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('returns null when nothing is due inside the window', () => {
    // maxDays = 0 with a day that has no same-day event somewhere in the calendar.
    let sawNull = false;
    for (let s = 0; s < 4 && !sawNull; s++) {
      for (let d = 1; d <= 7 && !sawNull; d++) {
        if (almanacHighlight(t(s, d), 0) === null) sawNull = true;
      }
    }
    expect(sawNull).toBe(true);
  });

  it('never returns an event further out than maxDays', () => {
    for (let s = 0; s < 4; s++) {
      for (let d = 1; d <= 7; d++) {
        const hit = almanacHighlight(t(s, d), 1);
        if (hit) expect(hit.daysUntil).toBeLessThanOrEqual(1);
      }
    }
  });

  it('widening maxDays never drops a closer event', () => {
    for (let s = 0; s < 4; s++) {
      for (let d = 1; d <= 7; d++) {
        const near = almanacHighlight(t(s, d), 1);
        const far = almanacHighlight(t(s, d), 5);
        if (near) {
          // A wider window must still surface something at least as soon.
          expect(far).not.toBeNull();
          expect(far!.daysUntil).toBeLessThanOrEqual(near.daysUntil);
        }
      }
    }
  });
});

describe('highlightChipText', () => {
  it('prefixes Today for same-day events', () => {
    const txt = highlightChipText({
      daysUntil: 0,
      kind: 'birthday',
      title: "Maple's birthday",
      detail: '',
      season: 0,
      day: 1,
    });
    expect(txt).toBe("Today: Maple's birthday");
  });

  it('prefixes Tomorrow for next-day events', () => {
    const txt = highlightChipText({
      daysUntil: 1,
      kind: 'festival',
      title: 'Planting Fair',
      detail: '',
      season: 0,
      day: 7,
    });
    expect(txt).toBe('Tomorrow: Planting Fair');
  });

  it('carries no emoji in the chip text', () => {
    for (let s = 0; s < 4; s++) {
      for (let d = 1; d <= 7; d++) {
        const hit = almanacHighlight(t(s, d), 1);
        if (hit) {
          // ASCII-only — pixel HUD uses monochrome glyphs, never emoji.
          expect(highlightChipText(hit)).toMatch(/^[\x20-\x7E]+$/);
        }
      }
    }
  });
});
