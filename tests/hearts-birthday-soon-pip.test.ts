// Hearts birthday-soon pip — birthdaySoon() flags a candidate's birthday
// inside the 14-day 8x gift window so the panel can mark the row with a warm
// pip, mirroring the gift-ready dot so both planning cues read together.

import { describe, it, expect } from 'vitest';
import { birthdaySoon, BIRTHDAY_SOON_DAYS } from '../src/ui/hearts-panel';

describe('birthdaySoon', () => {
  it('is true today through the window edge', () => {
    expect(birthdaySoon(0)).toBe(true);
    expect(birthdaySoon(1)).toBe(true);
    expect(birthdaySoon(BIRTHDAY_SOON_DAYS)).toBe(true);
  });

  it('is false past the window', () => {
    expect(birthdaySoon(BIRTHDAY_SOON_DAYS + 1)).toBe(false);
    expect(birthdaySoon(27)).toBe(false);
  });

  it('is false for a negative (no upcoming) count', () => {
    expect(birthdaySoon(-1)).toBe(false);
  });

  it('matches the 14-day window the summary header uses', () => {
    expect(BIRTHDAY_SOON_DAYS).toBe(14);
  });
});
