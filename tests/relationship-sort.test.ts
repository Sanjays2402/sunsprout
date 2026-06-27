// Relationship-panel sort toggle — closeness (default) vs by-birthday for
// gift planning. The display sort must NOT disturb the closeness-ordered
// rows the summary digest reads.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  cycleRelationshipSort,
  relationshipSortLabel,
  sortRelationshipRows,
  relationshipRows,
  relationshipSummary,
  RELATIONSHIP_SORT_MODES,
  type RelationshipRow,
  type RelationshipSortMode,
} from '../src/ui/hearts-panel';
import { startingHearts, giveGift } from '../src/game/hearts';

/** Build a synthetic relationship row with sane defaults. */
function rowOf(over: Partial<RelationshipRow>): RelationshipRow {
  return {
    id: 'x',
    name: 'X',
    hearts: 0,
    max: 10,
    daysUntilBirthday: 10,
    birthdayLine: '',
    lovedHint: '',
    lovedGlyphKey: null,
    status: 'single',
    giftReady: false,
    giftTaste: null,
    ...over,
  };
}

describe('cycleRelationshipSort', () => {
  it('toggles closeness <-> birthday', () => {
    expect(cycleRelationshipSort('closeness')).toBe('birthday');
    expect(cycleRelationshipSort('birthday')).toBe('closeness');
  });

  it('walks the whole cycle and returns to the start', () => {
    let m: RelationshipSortMode = 'closeness';
    const seen: RelationshipSortMode[] = [m];
    for (let i = 0; i < RELATIONSHIP_SORT_MODES.length - 1; i++) {
      m = cycleRelationshipSort(m);
      seen.push(m);
    }
    expect(seen).toEqual([...RELATIONSHIP_SORT_MODES]);
    expect(cycleRelationshipSort(m)).toBe('closeness');
  });
});

describe('relationshipSortLabel', () => {
  it('labels both modes with a non-empty ASCII phrase', () => {
    for (const m of RELATIONSHIP_SORT_MODES) {
      const label = relationshipSortLabel(m);
      expect(label.length).toBeGreaterThan(0);
      expect(/^[\x20-\x7E]+$/.test(label)).toBe(true);
    }
  });
});

describe('sortRelationshipRows', () => {
  it("'closeness' returns a copy in the same order (identity sort)", () => {
    const rows = [rowOf({ id: 'a', daysUntilBirthday: 9 }), rowOf({ id: 'b', daysUntilBirthday: 1 })];
    const out = sortRelationshipRows(rows, 'closeness');
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
    expect(out).not.toBe(rows); // a copy, never the same ref
  });

  it("'birthday' orders by the soonest birthday first", () => {
    const rows = [
      rowOf({ id: 'far', daysUntilBirthday: 20 }),
      rowOf({ id: 'soon', daysUntilBirthday: 2 }),
      rowOf({ id: 'mid', daysUntilBirthday: 9 }),
    ];
    const out = sortRelationshipRows(rows, 'birthday');
    expect(out.map((r) => r.id)).toEqual(['soon', 'mid', 'far']);
  });

  it('breaks birthday ties by hearts desc, then name', () => {
    const rows = [
      rowOf({ id: 'c', name: 'Cleo', daysUntilBirthday: 3, hearts: 4 }),
      rowOf({ id: 'a', name: 'Ana', daysUntilBirthday: 3, hearts: 8 }),
      rowOf({ id: 'b', name: 'Bo', daysUntilBirthday: 3, hearts: 4 }),
    ];
    const out = sortRelationshipRows(rows, 'birthday');
    // Ana leads on hearts; Bo before Cleo on name at equal hearts.
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('never mutates the input array', () => {
    const rows = [rowOf({ id: 'a', daysUntilBirthday: 9 }), rowOf({ id: 'b', daysUntilBirthday: 1 })];
    const before = rows.map((r) => r.id);
    sortRelationshipRows(rows, 'birthday');
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe('summary stays honest under a birthday re-sort', () => {
  it("relationshipSummary still reports the CLOSEST person, not the birthday-sorted rows[0]", () => {
    const w = new World();
    const p = w.player;
    p.hearts = startingHearts();
    // Make Maple the clearly-closest candidate by hearts.
    for (let d = 1; d <= 6; d++) giveGift(p.hearts, 'maple', 'ruby', d);
    const t = new TimeOfDay(6);

    const canonical = relationshipRows(p, t); // closeness order
    const summary = relationshipSummary(canonical);
    // Closest is whoever leads the canonical order...
    expect(summary.closest?.name).toBe(canonical[0].name);

    // ...and a birthday re-sort can move a DIFFERENT person to the top
    // without changing the summary (which reads the canonical order).
    const byBirthday = sortRelationshipRows(canonical, 'birthday');
    const summaryAfter = relationshipSummary(canonical);
    expect(summaryAfter.closest?.name).toBe(summary.closest?.name);
    // The display order is a re-sort, so its head can differ from canonical.
    expect(byBirthday.length).toBe(canonical.length);
  });
});
