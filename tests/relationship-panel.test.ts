// Relationship panel polish — pure relationshipRows() builder.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  relationshipRows,
  birthdayCountdownLabel,
  prettyGiftKey,
  statusChipLabel,
  giftChipLabel,
  giftChipColor,
  heartsSummary,
} from '../src/ui/hearts-panel';
import { CANDIDATES, MAX_HEARTS, startingHearts, giveGift } from '../src/game/hearts';
import { BIRTHDAYS } from '../src/game/birthdays';

function freshPlayer() {
  const w = new World();
  const p = w.player;
  p.hearts = startingHearts();
  return p;
}

describe('birthdayCountdownLabel', () => {
  it('says today / tomorrow / in Nd', () => {
    expect(birthdayCountdownLabel(0)).toBe('birthday today');
    expect(birthdayCountdownLabel(1)).toBe('birthday tomorrow');
    expect(birthdayCountdownLabel(5)).toBe('birthday in 5d');
  });
  it('treats negatives as today (defensive)', () => {
    expect(birthdayCountdownLabel(-1)).toBe('birthday today');
  });
});

describe('prettyGiftKey', () => {
  it('strips harvest + dish prefixes and normalises separators', () => {
    expect(prettyGiftKey('flower_harvest')).toBe('flower');
    expect(prettyGiftKey('dish-hearty-stew')).toBe('hearty stew');
    expect(prettyGiftKey('ruby')).toBe('ruby');
  });
});

describe('statusChipLabel', () => {
  it('maps status to a short chip, empty for single', () => {
    expect(statusChipLabel('married')).toBe('wed');
    expect(statusChipLabel('engaged')).toBe('vow');
    expect(statusChipLabel('single')).toBe('');
  });
});

describe('relationshipRows', () => {
  it('returns one row per candidate with hearts + birthday + loves hint', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    const rows = relationshipRows(p, t);
    expect(rows.length).toBe(Object.keys(CANDIDATES).length);
    for (const r of rows) {
      expect(r.max).toBe(MAX_HEARTS);
      expect(r.name).toBeTruthy();
      expect(r.lovedHint.startsWith('loves ')).toBe(true);
      expect(r.daysUntilBirthday).toBeGreaterThanOrEqual(0);
      expect(r.daysUntilBirthday).toBeLessThanOrEqual(27);
    }
  });

  it('reflects accumulated hearts and sorts by closeness then hearts', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    // Push maple to ~1 heart (4 loved gifts on different days).
    for (let d = 1; d <= 4; d++) giveGift(p.hearts!, 'maple', 'ruby', d);
    const rows = relationshipRows(p, t);
    // The most-hearted single candidate leads when nobody is engaged/wed.
    expect(rows[0].id).toBe('maple');
    expect(rows[0].hearts).toBe(1);
  });

  it('floats an engaged candidate above a higher-hearted single one', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    for (let d = 1; d <= 8; d++) giveGift(p.hearts!, 'maple', 'ruby', d);
    p.engagement = { npcId: 'finn', day: 2 };
    const rows = relationshipRows(p, t);
    expect(rows[0].id).toBe('finn');
    expect(rows[0].status).toBe('engaged');
  });

  it('marks a married candidate first with the married status', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    p.marriage = { npcId: 'rose', day: 4 };
    const rows = relationshipRows(p, t);
    expect(rows[0].id).toBe('rose');
    expect(rows[0].status).toBe('married');
  });

  it('counts down to the right birthday', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    const b = BIRTHDAYS.maple;
    t.season = b.season;
    t.day = b.day;
    const maple = relationshipRows(p, t).find((r) => r.id === 'maple')!;
    expect(maple.daysUntilBirthday).toBe(0);
    expect(maple.birthdayLine).toBe('birthday today');
  });

  it('still feeds the legacy heartsSummary helper', () => {
    const rows = heartsSummary(startingHearts());
    expect(rows.length).toBe(Object.keys(CANDIDATES).length);
    for (const r of rows) expect(r.hearts).toBe(0);
  });
});

describe('gift-readiness chip', () => {
  it('is not ready for any candidate on a fresh empty bag', () => {
    const p = freshPlayer();
    p.inventory = {};
    const rows = relationshipRows(p, new TimeOfDay(6));
    for (const r of rows) {
      expect(r.giftReady).toBe(false);
      expect(giftChipLabel(r)).toBe('');
    }
  });

  it('lights up the carried candidate with the right taste chip', () => {
    const p = freshPlayer();
    p.inventory = { ruby: 1 }; // Maple loves ruby
    const t = new TimeOfDay(6);
    const maple = relationshipRows(p, t).find((r) => r.id === 'maple')!;
    expect(maple.giftReady).toBe(true);
    expect(maple.giftTaste).toBe('loved');
    expect(giftChipLabel(maple)).toBe('loved gift');
    // A candidate who doesn't love/like ruby still gets a neutral "gift ready".
    const rose = relationshipRows(p, t).find((r) => r.id === 'rose')!;
    expect(rose.giftReady).toBe(true);
    expect(giftChipLabel(rose)).toBe('gift ready');
  });

  it('drops the chip once the candidate was gifted today', () => {
    const p = freshPlayer();
    p.inventory = { ruby: 1 };
    const t = new TimeOfDay(6);
    t.day = 3;
    giveGift(p.hearts!, 'maple', 'ruby', 3);
    const maple = relationshipRows(p, t).find((r) => r.id === 'maple')!;
    expect(maple.giftReady).toBe(false);
    expect(giftChipLabel(maple)).toBe('');
  });

  it('chip labels are short, ASCII, and have a hex colour', () => {
    const p = freshPlayer();
    p.inventory = { ruby: 1, 'hearty-stew': 1 };
    const rows = relationshipRows(p, new TimeOfDay(6));
    for (const r of rows) {
      const label = giftChipLabel(r);
      expect(/^[\x20-\x7E]*$/.test(label)).toBe(true);
      expect(label.length).toBeLessThanOrEqual(12);
      expect(giftChipColor(r.giftTaste)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
