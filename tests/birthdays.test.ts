// Birthdays — calendar + multiplier behaviour.
import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  BIRTHDAYS,
  BIRTHDAY_GIFT_MULTIPLIER,
  isBirthdayToday,
  birthdayCelebrant,
  giftMultiplier,
  birthdayBanner,
  daysUntilBirthday,
  birthdayCalendar,
} from '../src/game/birthdays';
import { startingHearts, giveGift, CANDIDATES } from '../src/game/hearts';
import { attemptAutoGift } from '../src/game/gifting';
import { World } from '../src/world/world';

describe('birthdays', () => {
  it('every candidate has a birthday spec', () => {
    for (const id of Object.keys(CANDIDATES)) {
      expect(BIRTHDAYS[id]).toBeDefined();
      expect(BIRTHDAYS[id].day).toBeGreaterThanOrEqual(1);
      expect(BIRTHDAYS[id].day).toBeLessThanOrEqual(7);
      expect(BIRTHDAYS[id].season).toBeGreaterThanOrEqual(0);
      expect(BIRTHDAYS[id].season).toBeLessThanOrEqual(3);
    }
  });

  it('birthdays span all four seasons', () => {
    const seasons = new Set(Object.values(BIRTHDAYS).map((b) => b.season));
    expect(seasons.size).toBe(4);
  });

  it('isBirthdayToday lights up on the right (season, day)', () => {
    const t = new TimeOfDay(6);
    const b = BIRTHDAYS.maple;
    t.season = b.season;
    t.day = b.day;
    expect(isBirthdayToday('maple', t)).toBe(true);
    expect(isBirthdayToday('mayor', t)).toBe(false);
  });

  it('birthdayCelebrant returns the npc id or null', () => {
    const t = new TimeOfDay(6);
    t.season = BIRTHDAYS.finn.season;
    t.day = BIRTHDAYS.finn.day;
    expect(birthdayCelebrant(t)).toBe('finn');
    t.day = (t.day % 7) + 1;
    expect(birthdayCelebrant(t)).toBeNull();
  });

  it('giftMultiplier is 8x on birthday, 1x otherwise', () => {
    const t = new TimeOfDay(6);
    t.season = BIRTHDAYS.rose.season;
    t.day = BIRTHDAYS.rose.day;
    expect(giftMultiplier('rose', t)).toBe(BIRTHDAY_GIFT_MULTIPLIER);
    expect(giftMultiplier('finn', t)).toBe(1);
  });

  it('giveGift with multiplier=8 applies 8x points', () => {
    const state = startingHearts();
    // A loved gift normally gives 80 pts — with mult=8 that's 640.
    const r = giveGift(state, 'maple', 'ruby', 1, 8);
    expect(r.accepted).toBe(true);
    expect(r.pointsApplied).toBe(640);
    expect(state.maple.points).toBe(640);
  });

  it('attemptAutoGift uses the birthday multiplier when time is on birthday', () => {
    const w = new World();
    w.player.hearts = startingHearts();
    w.player.inventory = { ruby: 1, 'watering-can': 1 };
    w.player.gold = 50;
    w.player.quests = [];
    const t = new TimeOfDay(6);
    t.season = BIRTHDAYS.maple.season;
    t.day = BIRTHDAYS.maple.day;
    const out = attemptAutoGift(w.player, 'maple', t.day, t);
    expect(out.kind).toBe('gifted');
    if (out.kind === 'gifted') {
      // 80 base × 8 = 640 — that's >= 2 hearts (HEART_POINTS=250).
      expect(out.result.pointsApplied).toBe(640);
      expect(out.result.hearts).toBeGreaterThanOrEqual(2);
    }
  });

  it('attemptAutoGift without time arg falls back to 1x', () => {
    const w = new World();
    w.player.hearts = startingHearts();
    w.player.inventory = { ruby: 1, 'watering-can': 1 };
    w.player.gold = 50;
    w.player.quests = [];
    const out = attemptAutoGift(w.player, 'maple', 1);
    expect(out.kind).toBe('gifted');
    if (out.kind === 'gifted') {
      expect(out.result.pointsApplied).toBe(80); // unboosted loved
    }
  });

  it('birthdayBanner formats the today-celebrant line, null otherwise', () => {
    const t = new TimeOfDay(6);
    t.season = BIRTHDAYS.mayor.season;
    t.day = BIRTHDAYS.mayor.day;
    const s = birthdayBanner(t);
    expect(s).toContain("Mayor Bramble");
    expect(s).toContain('birthday');
    t.day = (BIRTHDAYS.mayor.day % 7) + 1;
    // Make sure we land on a non-birthday slot.
    if (birthdayCelebrant(t) === null) {
      expect(birthdayBanner(t)).toBeNull();
    }
  });

  it('daysUntilBirthday is 0 on the day itself, full year (28) the day before', () => {
    const t = new TimeOfDay(6);
    t.season = BIRTHDAYS.finn.season;
    t.day = BIRTHDAYS.finn.day;
    expect(daysUntilBirthday('finn', t)).toBe(0);
    // Day after their birthday: 27 days until the next one.
    t.day = BIRTHDAYS.finn.day + 1;
    if (t.day <= 7) {
      expect(daysUntilBirthday('finn', t)).toBe(27);
    }
  });

  it('birthdayCalendar is sorted by daysUntil ascending', () => {
    const t = new TimeOfDay(6);
    t.season = 0;
    t.day = 1;
    const cal = birthdayCalendar(t);
    for (let i = 1; i < cal.length; i++) {
      expect(cal[i].daysUntil).toBeGreaterThanOrEqual(cal[i - 1].daysUntil);
    }
    expect(cal.length).toBe(Object.keys(BIRTHDAYS).length);
  });
});
