// Almanac empty-agenda glyph echo — almanacLookAheadGlyphKind() returns the
// kind of the look-ahead entry so an empty agenda can echo that event's
// cake/tent/cart/rosette/heart glyph faint behind the "next: X in N days"
// line, the same way a busy TODAY band watermarks its soonest event. null on
// no look-ahead so the empty panel draws no watermark.

import { describe, it, expect } from 'vitest';
import { almanacLookAheadGlyphKind, almanacKindGlyph, type AlmanacEntry } from '../src/game/almanac';

function e(daysUntil: number, kind: AlmanacEntry['kind']): AlmanacEntry {
  return { daysUntil, kind, title: 't', detail: '', season: 0, day: 1 };
}

describe('almanacLookAheadGlyphKind', () => {
  it('returns null when there is no look-ahead', () => {
    expect(almanacLookAheadGlyphKind(null)).toBeNull();
  });

  it('echoes the look-ahead entry kind', () => {
    expect(almanacLookAheadGlyphKind(e(19, 'birthday'))).toBe('birthday');
    expect(almanacLookAheadGlyphKind(e(20, 'tournament'))).toBe('tournament');
  });

  it('returns a kind whose glyph resolves to drawable cells', () => {
    const kind = almanacLookAheadGlyphKind(e(16, 'festival'));
    expect(kind).not.toBeNull();
    expect(almanacKindGlyph(kind!).length).toBeGreaterThan(0);
  });
});
