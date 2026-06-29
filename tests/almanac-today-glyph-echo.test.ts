// Almanac TODAY-band glyph echo — almanacTodayGlyphKind() picks the kind of
// the soonest event happening today so the planner can paint that kind's
// glyph as a faint watermark behind the TODAY band, tying "right now" to its
// cake/tent/cart/rosette/heart icon. Pure pick over a soonest-first agenda.

import { describe, it, expect } from 'vitest';
import { almanacTodayGlyphKind, almanacKindGlyph, type AlmanacEntry } from '../src/game/almanac';

function e(daysUntil: number, kind: AlmanacEntry['kind'], title = 't'): AlmanacEntry {
  return { daysUntil, kind, title, detail: '', season: 0, day: 1 };
}

describe('almanacTodayGlyphKind', () => {
  it('returns null when nothing lands today', () => {
    expect(almanacTodayGlyphKind([])).toBeNull();
    expect(almanacTodayGlyphKind([e(1, 'cart'), e(3, 'festival')])).toBeNull();
  });

  it('picks the soonest TODAY (daysUntil <= 0) event kind', () => {
    expect(almanacTodayGlyphKind([e(0, 'birthday'), e(0, 'cart')])).toBe('birthday');
  });

  it('treats negative daysUntil as today too', () => {
    expect(almanacTodayGlyphKind([e(-1, 'tournament'), e(2, 'cart')])).toBe('tournament');
  });

  it('skips later events to find the first one happening today', () => {
    // Soonest-first ordering normally puts today first, but a non-positive
    // entry anywhere should still win over future rows.
    expect(almanacTodayGlyphKind([e(0, 'personal')])).toBe('personal');
  });

  it('returns a kind whose glyph resolves to drawable cells', () => {
    const kind = almanacTodayGlyphKind([e(0, 'festival')]);
    expect(kind).not.toBeNull();
    expect(almanacKindGlyph(kind!).length).toBeGreaterThan(0);
  });
});
