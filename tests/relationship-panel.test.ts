// Relationship panel polish — pure relationshipRows() builder.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  relationshipRows,
  relationshipSummary,
  relationshipSummaryLine,
  birthdayCountdownLabel,
  prettyGiftKey,
  statusChipLabel,
  giftChipLabel,
  giftChipColor,
  lovedGlyphKeyFor,
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

describe('lovedGlyphKey', () => {
  it('picks the first adored gift with a drawable catalog sprite', () => {
    // Maple loves ['ruby', 'amethyst'] — ruby has a gem glyph, amethyst
    // is off-catalog, so ruby is chosen.
    expect(lovedGlyphKeyFor(CANDIDATES.maple.loved)).toBe('ruby');
    // Rose loves ['hearty-stew', ...] — the dish resolves.
    expect(lovedGlyphKeyFor(CANDIDATES.rose.loved)).toBe('hearty-stew');
  });

  it('skips off-catalog leading loves to find a drawable one', () => {
    // Finn loves ['frog', 'amethyst'] — neither resolves to a sprite.
    expect(lovedGlyphKeyFor(CANDIDATES.finn.loved)).toBeNull();
    // A synthetic list whose first entry is off-catalog but second isn't.
    expect(lovedGlyphKeyFor(['frog', 'ruby'])).toBe('ruby');
  });

  it('returns null for an empty loved list', () => {
    expect(lovedGlyphKeyFor([])).toBeNull();
  });

  it('threads a lovedGlyphKey onto each relationship row', () => {
    const p = freshPlayer();
    const rows = relationshipRows(p, new TimeOfDay(6));
    const maple = rows.find((r) => r.id === 'maple')!;
    expect(maple.lovedGlyphKey).toBe('ruby');
    const finn = rows.find((r) => r.id === 'finn')!;
    expect(finn.lovedGlyphKey).toBeNull();
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

describe('relationshipSummary', () => {
  it('returns an empty digest for no rows', () => {
    const s = relationshipSummary([]);
    expect(s.closest).toBeNull();
    expect(s.married).toBe(0);
    expect(s.engaged).toBe(0);
    expect(s.nextBirthday).toBeNull();
    expect(relationshipSummaryLine(s)).toBe('');
  });

  it('names the closest candidate (the sorted first row)', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    for (let d = 1; d <= 4; d++) giveGift(p.hearts!, 'maple', 'ruby', d);
    const rows = relationshipRows(p, t);
    const s = relationshipSummary(rows);
    expect(s.closest?.name).toBe(rows[0].name);
    expect(s.closest?.hearts).toBe(rows[0].hearts);
    expect(s.closest?.max).toBe(MAX_HEARTS);
    expect(relationshipSummaryLine(s)).toContain(`closest ${rows[0].name}`);
  });

  it('tallies marriages and engagements', () => {
    const p = freshPlayer();
    p.marriage = { npcId: 'rose', day: 4 };
    p.engagement = { npcId: 'finn', day: 2 };
    const s = relationshipSummary(relationshipRows(p, new TimeOfDay(6)));
    expect(s.married).toBe(1);
    expect(s.engaged).toBe(1);
  });

  it('finds the single soonest birthday across all candidates', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    const b = BIRTHDAYS.maple;
    t.season = b.season;
    t.day = b.day; // Maple's birthday is today (0 days).
    const s = relationshipSummary(relationshipRows(p, t));
    expect(s.nextBirthday?.name).toBe(CANDIDATES.maple.name);
    expect(s.nextBirthday?.days).toBe(0);
  });

  it('prioritises an imminent birthday over a marriage tally in the line', () => {
    const p = freshPlayer();
    const t = new TimeOfDay(6);
    p.marriage = { npcId: 'rose', day: 4 };
    const b = BIRTHDAYS.maple;
    t.season = b.season;
    t.day = b.day;
    const line = relationshipSummaryLine(relationshipSummary(relationshipRows(p, t)));
    expect(line).toContain('bday today');
    expect(line).not.toContain('wed');
  });

  it('falls back to the wed/vow tally when no birthday is imminent', () => {
    const s = relationshipSummary([
      {
        id: 'rose',
        name: 'Rose',
        hearts: 8,
        max: MAX_HEARTS,
        daysUntilBirthday: 20,
        birthdayLine: 'birthday in 20d',
        lovedHint: '',
        lovedGlyphKey: null,
        status: 'married',
        giftReady: false,
        giftTaste: null,
      },
    ]);
    const line = relationshipSummaryLine(s);
    expect(line).toContain('1 wed');
    expect(line).not.toContain('bday');
  });

  it('keeps the line ASCII and reasonably short', () => {
    const p = freshPlayer();
    const line = relationshipSummaryLine(
      relationshipSummary(relationshipRows(p, new TimeOfDay(6))),
    );
    expect(/^[\x20-\x7E]*$/.test(line)).toBe(true);
    expect(line.length).toBeLessThanOrEqual(48);
  });
});
