// Controls catalog — single source of truth for the `?` help overlay.

import { describe, it, expect } from 'vitest';
import {
  CONTROL_GROUPS,
  totalBindingCount,
  splitControlColumns,
  type ControlGroup,
} from '../src/game/controls';

describe('CONTROL_GROUPS — shape', () => {
  it('has several non-empty groups', () => {
    expect(CONTROL_GROUPS.length).toBeGreaterThanOrEqual(5);
    for (const g of CONTROL_GROUPS) {
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.bindings.length).toBeGreaterThan(0);
    }
  });

  it('every binding has a key glyph and a label', () => {
    for (const g of CONTROL_GROUPS) {
      for (const b of g.bindings) {
        expect(b.keys.trim().length).toBeGreaterThan(0);
        expect(b.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('contains no emoji in any glyph or label (game chrome stays monochrome)', () => {
    // Surrogate-pair range catches the vast majority of emoji.
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const g of CONTROL_GROUPS) {
      expect(emoji.test(g.title)).toBe(false);
      for (const b of g.bindings) {
        expect(emoji.test(b.keys)).toBe(false);
        expect(emoji.test(b.label)).toBe(false);
      }
    }
  });
});

describe('CONTROL_GROUPS — coverage of real keybinds', () => {
  const allKeys = CONTROL_GROUPS.flatMap((g) => g.bindings.map((b) => b.keys));

  it('documents the core movement + interact keys', () => {
    expect(allKeys.some((k) => /WASD/i.test(k))).toBe(true);
    expect(allKeys).toContain('E');
  });

  it('documents the farming verbs', () => {
    expect(allKeys).toContain('T'); // till
    expect(allKeys).toContain('W'); // water
  });

  it('documents the new wayfinding panels (?, 9, 0)', () => {
    expect(allKeys).toContain('?');
    expect(allKeys).toContain('9');
    expect(allKeys).toContain('0');
  });

  it('documents every info-panel toggle', () => {
    for (const k of ['H', 'R', ';', 'V', 'Q', '`', '\\']) {
      expect(allKeys).toContain(k);
    }
  });
});

describe('totalBindingCount', () => {
  it('matches the flattened binding total', () => {
    const manual = CONTROL_GROUPS.reduce((n, g) => n + g.bindings.length, 0);
    expect(totalBindingCount()).toBe(manual);
  });

  it('catalogs a substantial number of keys (>= 30)', () => {
    expect(totalBindingCount()).toBeGreaterThanOrEqual(30);
  });
});

describe('splitControlColumns', () => {
  it('returns two columns that together hold every group', () => {
    const [left, right] = splitControlColumns();
    expect(left.length + right.length).toBe(CONTROL_GROUPS.length);
    // No group is dropped or duplicated.
    const titles = [...left, ...right].map((g) => g.title).sort();
    const expected = CONTROL_GROUPS.map((g) => g.title).sort();
    expect(titles).toEqual(expected);
  });

  it('keeps both columns non-empty for the real catalog', () => {
    const [left, right] = splitControlColumns();
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
  });

  it('roughly balances the row counts between columns', () => {
    const rowsOf = (g: ControlGroup) => g.bindings.length + 1;
    const [left, right] = splitControlColumns();
    const lRows = left.reduce((n, g) => n + rowsOf(g), 0);
    const rRows = right.reduce((n, g) => n + rowsOf(g), 0);
    // Within one group's worth of rows of each other.
    const maxGroup = Math.max(...CONTROL_GROUPS.map(rowsOf));
    expect(Math.abs(lRows - rRows)).toBeLessThanOrEqual(maxGroup);
  });

  it('handles a single-group input without emptying a column inappropriately', () => {
    const one: ControlGroup[] = [{ title: 'solo', bindings: [{ keys: 'E', label: 'do' }] }];
    const [left, right] = splitControlColumns(one);
    expect(left.length + right.length).toBe(1);
  });
});
