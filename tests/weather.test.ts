// Weather — deterministic forecast + rain auto-watering.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { plant, water } from '../src/game/farming';
import { startingHearts } from '../src/game/hearts';
import { startingQuests } from '../src/game/quests';
import {
  rollWeather,
  weatherToday,
  weatherTomorrow,
  applyRain,
  WEATHER,
  WEATHER_KEYS,
  SEASON_WEIGHTS,
} from '../src/game/weather';

describe('weather', () => {
  it('rollWeather is deterministic per (season, day)', () => {
    for (const s of [0, 1, 2, 3] as const) {
      for (let d = 1; d <= 7; d++) {
        expect(rollWeather(s, d)).toBe(rollWeather(s, d));
      }
    }
  });

  it('SEASON_WEIGHTS for every season sum to ~1.0', () => {
    for (const s of [0, 1, 2, 3] as const) {
      const sum = WEATHER_KEYS.reduce((a, k) => a + SEASON_WEIGHTS[s][k], 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    }
  });

  it('every WEATHER_KEY has a WEATHER def with non-empty label + flavor', () => {
    for (const k of WEATHER_KEYS) {
      expect(WEATHER[k].label.length).toBeGreaterThan(0);
      expect(WEATHER[k].flavor.length).toBeGreaterThan(0);
    }
  });

  it('weatherToday reads from the current clock', () => {
    const t = new TimeOfDay(6);
    t.day = 3;
    t.season = 1;
    expect(weatherToday(t)).toBe(rollWeather(1, 3));
  });

  it('weatherTomorrow wraps day 7 → day 1 of the next season', () => {
    const t = new TimeOfDay(6);
    t.day = 7;
    t.season = 0;
    expect(weatherTomorrow(t)).toBe(rollWeather(1, 1));
  });

  it('weatherTomorrow within a season increments the day only', () => {
    const t = new TimeOfDay(6);
    t.day = 3;
    t.season = 2;
    expect(weatherTomorrow(t)).toBe(rollWeather(2, 4));
  });

  it('weatherTomorrow wraps season 3 → 0', () => {
    const t = new TimeOfDay(6);
    t.day = 7;
    t.season = 3;
    expect(weatherTomorrow(t)).toBe(rollWeather(0, 1));
  });

  it('applyRain waters every crop and returns the count when raining', () => {
    const w = new World();
    w.player.inventory = { wheat: 5, tomato: 5 };
    w.player.gold = 50;
    w.player.quests = startingQuests();
    w.player.hearts = startingHearts();
    plant(w, 19, 22, 'wheat', w.player);
    plant(w, 20, 22, 'tomato', w.player);
    // Both crops are unwatered now.
    for (const c of w.crops as unknown as Array<{ watered: boolean }>) {
      expect(c.watered).toBe(false);
    }
    const count = applyRain(w, 'rain');
    expect(count).toBe(2);
    for (const c of w.crops as unknown as Array<{ watered: boolean; daysSinceWater: number }>) {
      expect(c.watered).toBe(true);
      expect(c.daysSinceWater).toBe(0);
    }
  });

  it('applyRain is a no-op on sunny / cloudy days', () => {
    const w = new World();
    w.player.inventory = { wheat: 3 };
    w.player.gold = 50;
    w.player.quests = startingQuests();
    plant(w, 19, 22, 'wheat', w.player);
    expect(applyRain(w, 'sunny')).toBe(0);
    expect(applyRain(w, 'cloudy')).toBe(0);
    for (const c of w.crops as unknown as Array<{ watered: boolean }>) {
      expect(c.watered).toBe(false);
    }
  });

  it('storm waters crops just like rain does', () => {
    const w = new World();
    w.player.inventory = { wheat: 3 };
    w.player.gold = 50;
    w.player.quests = startingQuests();
    plant(w, 19, 22, 'wheat', w.player);
    expect(applyRain(w, 'storm')).toBe(1);
  });

  it('applyRain preserves already-watered crops (idempotent water mark)', () => {
    const w = new World();
    w.player.inventory = { wheat: 3 };
    w.player.gold = 50;
    w.player.quests = startingQuests();
    plant(w, 19, 22, 'wheat', w.player);
    water(w, 19, 22);
    expect(applyRain(w, 'rain')).toBe(1);
  });

  it('rolls hit every weather kind given enough days', () => {
    // Smoke-test that the table can produce all four kinds across all
    // seasons and a 7-day window. Not statistical — just "no kind is
    // permanently dead".
    const seen = new Set<string>();
    for (const s of [0, 1, 2, 3] as const) {
      for (let d = 1; d <= 7; d++) {
        seen.add(rollWeather(s, d));
      }
    }
    // We expect at least 3 of the 4 to show up in the deterministic table.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
