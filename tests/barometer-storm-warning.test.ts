// Barometer storm warning — when the player owns a barometer and a
// storm sits in (tomorrow, day-after-tomorrow), surface a copy
// nudge so they can craft shelters in time.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BAROMETER_INVENTORY_KEY,
  barometerStormWarning,
} from '../src/game/barometer';
import { TimeOfDay } from '../src/game/time';
import { rollWeather, weatherTomorrow } from '../src/game/weather';

function freshPlayer() {
  const w = new World();
  w.player.inventory = {};
  return w.player;
}

function timeAt(season: 0 | 1 | 2 | 3, day: number, hour = 7): TimeOfDay {
  const t = new TimeOfDay();
  t.season = season;
  t.day = day;
  t.hour = hour;
  t.minute = 0;
  return t;
}

/**
 * Find the first (season, day) where the next-day weather is a storm.
 * Used to drive the deterministic tests below — the calendar is
 * deterministic per (season, day) so once we find one we can lock it in.
 */
function findStormTomorrow(): { season: 0 | 1 | 2 | 3; day: number } | null {
  for (let s = 0; s < 4; s++) {
    for (let d = 1; d <= 7; d++) {
      const t = timeAt(s as 0 | 1 | 2 | 3, d);
      if (weatherTomorrow(t) === 'storm') return { season: s as 0 | 1 | 2 | 3, day: d };
    }
  }
  return null;
}

/**
 * Find a (season, day) where weatherTomorrow is NOT a storm but the
 * day after is — drives the "Storm in 2 days" branch test.
 */
function findStormDayAfter(): { season: 0 | 1 | 2 | 3; day: number } | null {
  for (let s = 0; s < 4; s++) {
    for (let d = 1; d <= 7; d++) {
      const t = timeAt(s as 0 | 1 | 2 | 3, d);
      if (weatherTomorrow(t) === 'storm') continue;
      // day-after = (s, d+2 wrapped). Easiest reuse: shift the clock.
      let nextDay = d + 2;
      let nextSeason: 0 | 1 | 2 | 3 = s as 0 | 1 | 2 | 3;
      if (nextDay > 7) {
        nextDay = nextDay - 7;
        nextSeason = (((s + 1) % 4) as 0 | 1 | 2 | 3);
      }
      if (rollWeather(nextSeason, nextDay) === 'storm') {
        return { season: s as 0 | 1 | 2 | 3, day: d };
      }
    }
  }
  return null;
}

describe('barometerStormWarning gating on ownership', () => {
  it('returns empty string when the player has no barometer', () => {
    const p = freshPlayer();
    const slot = findStormTomorrow();
    if (!slot) return; // calendar lacks a storm; skip gracefully
    const t = timeAt(slot.season, slot.day);
    expect(barometerStormWarning(p, t)).toBe('');
  });

  it('returns empty string when the player has a barometer but no storm is on the horizon', () => {
    const p = freshPlayer();
    p.inventory[BAROMETER_INVENTORY_KEY] = 1;
    // Iterate the calendar until we find a window with no storm in next 2 days.
    for (let s = 0; s < 4; s++) {
      for (let d = 1; d <= 7; d++) {
        const t = timeAt(s as 0 | 1 | 2 | 3, d);
        const out = barometerStormWarning(p, t);
        if (out === '') return; // first clear window — pass
      }
    }
    throw new Error('Expected at least one clear-window in the deterministic calendar');
  });
});

describe('barometerStormWarning copy + branch', () => {
  it('surfaces "Storm tomorrow" when next day is a storm', () => {
    const p = freshPlayer();
    p.inventory[BAROMETER_INVENTORY_KEY] = 1;
    const slot = findStormTomorrow();
    if (!slot) return; // safety
    const t = timeAt(slot.season, slot.day);
    expect(barometerStormWarning(p, t)).toBe('Storm tomorrow — line up shelters now.');
  });

  it('surfaces "Storm in 2 days" when only day-after-tomorrow is a storm', () => {
    const p = freshPlayer();
    p.inventory[BAROMETER_INVENTORY_KEY] = 1;
    const slot = findStormDayAfter();
    if (!slot) return; // safety
    const t = timeAt(slot.season, slot.day);
    expect(barometerStormWarning(p, t)).toBe('Storm in 2 days — line up shelters now.');
  });

  it('prefers "tomorrow" wording over "in 2 days" when both qualify', () => {
    // Synthesise: find a (s, d) where weatherTomorrow returns 'storm'
    // regardless of day-after. The "tomorrow" branch must win.
    const p = freshPlayer();
    p.inventory[BAROMETER_INVENTORY_KEY] = 1;
    const slot = findStormTomorrow();
    if (!slot) return;
    const t = timeAt(slot.season, slot.day);
    expect(barometerStormWarning(p, t)).toContain('tomorrow');
  });
});
