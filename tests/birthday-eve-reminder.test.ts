// Birthday-eve reminder — tomorrowCelebrant + birthdayReminderLine.
// A dawn-toast nudge the evening before an NPC birthday so the 8x gift
// window doesn't pass silently for players who never open the calendar.
import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import { BIRTHDAY_GIFT_MULTIPLIER, tomorrowCelebrant, birthdayReminderLine } from '../src/game/birthdays';
import { CANDIDATES } from '../src/game/hearts';

function time(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(6);
  t.season = season;
  t.day = day;
  return t;
}

describe('birthday-eve reminder', () => {
  it('names the celebrant the evening before their birthday', () => {
    // Maple's birthday is Summer day 5 -> reminder on Summer day 4.
    expect(tomorrowCelebrant(time(1, 4))).toBe('maple');
  });

  it('wraps day 7 into day 1 of the next season', () => {
    // Spring day 7 -> Summer day 1: no birthday there (Maple's is Summer day 5).
    expect(tomorrowCelebrant(time(0, 7))).toBeNull();
    // Winter day 5 eve: Rose's birthday is Winter day 6.
    expect(tomorrowCelebrant(time(3, 5))).toBe('rose');
  });

  it('returns null when no birthday is tomorrow', () => {
    expect(tomorrowCelebrant(time(1, 1))).toBeNull();
  });

  it('reminder line names the NPC and quotes the multiplier', () => {
    const line = birthdayReminderLine(time(1, 4));
    expect(line).not.toBeNull();
    expect(line).toContain(CANDIDATES['maple'].name);
    expect(line).toContain('tomorrow');
    expect(line).toContain(`${BIRTHDAY_GIFT_MULTIPLIER}x`);
  });

  it('no reminder line on ordinary days', () => {
    expect(birthdayReminderLine(time(2, 5))).toBeNull();
  });
});
