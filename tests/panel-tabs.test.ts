// Panel tab-strip layout — shared tab geometry for the lore + bag panels.

import { describe, it, expect } from 'vitest';
import {
  tabStripLayout,
  cycleTabIndex,
  tabAtPoint,
  TAB_STRIP_HEIGHT,
  TAB_STRIP_GAP,
  type TabStripItem,
} from '../src/game/panel-tabs';

const ITEMS: TabStripItem[] = [
  { label: 'Fish', sub: '1/5' },
  { label: 'Gems', sub: '0/5' },
  { label: 'Folk', sub: '2/4' },
];

describe('tabStripLayout', () => {
  it('returns one rect per item', () => {
    const rects = tabStripLayout(ITEMS, 100, 200, 300, 0);
    expect(rects).toHaveLength(3);
  });

  it('divides the total width into equal floor cells', () => {
    const rects = tabStripLayout(ITEMS, 0, 0, 301, 0);
    const cell = Math.floor(301 / 3); // 100
    expect(rects[0].x).toBe(0);
    expect(rects[1].x).toBe(cell);
    expect(rects[2].x).toBe(cell * 2);
    // Drawn width is the cell minus the gap.
    expect(rects[0].w).toBe(cell - TAB_STRIP_GAP);
  });

  it('places every tab at the strip origin y with the default height', () => {
    const rects = tabStripLayout(ITEMS, 10, 55, 300, 1);
    for (const r of rects) {
      expect(r.y).toBe(55);
      expect(r.h).toBe(TAB_STRIP_HEIGHT);
    }
  });

  it('flags exactly the active index', () => {
    const rects = tabStripLayout(ITEMS, 0, 0, 300, 2);
    expect(rects.map((r) => r.active)).toEqual([false, false, true]);
  });

  it('carries label + sub through onto each rect', () => {
    const rects = tabStripLayout(ITEMS, 0, 0, 300, 0);
    expect(rects[0].label).toBe('Fish');
    expect(rects[0].sub).toBe('1/5');
    expect(rects[2].sub).toBe('2/4');
  });

  it('defaults a missing sub to an empty string', () => {
    const rects = tabStripLayout([{ label: 'Solo' }], 0, 0, 100, 0);
    expect(rects[0].sub).toBe('');
  });

  it('honours custom gap + height overrides', () => {
    const rects = tabStripLayout(ITEMS, 0, 0, 300, 0, { gap: 10, height: 40 });
    expect(rects[0].w).toBe(Math.floor(300 / 3) - 10);
    expect(rects[0].h).toBe(40);
  });

  it('returns an empty array for no items', () => {
    expect(tabStripLayout([], 0, 0, 300, 0)).toEqual([]);
  });

  it('reproduces the lore panel historical strip geometry', () => {
    // Lore panel: x+14 origin, y+38, width PANEL_W(520)-28, 6 tabs, gap 4.
    const six: TabStripItem[] = Array.from({ length: 6 }, (_, i) => ({ label: `T${i}` }));
    const rects = tabStripLayout(six, 0 + 14, 0 + 38, 520 - 28, 0);
    const tabW = Math.floor((520 - 28) / 6); // 82
    expect(rects[0].x).toBe(14);
    expect(rects[1].x).toBe(14 + tabW);
    expect(rects[0].y).toBe(38);
    expect(rects[0].w).toBe(tabW - 4); // 78, exactly the old `tabW - 4`
    expect(rects[0].h).toBe(26);
  });
});

describe('cycleTabIndex', () => {
  it('steps forward and wraps at the end', () => {
    expect(cycleTabIndex(0, 3, 1)).toBe(1);
    expect(cycleTabIndex(2, 3, 1)).toBe(0);
  });

  it('steps backward and wraps at the start', () => {
    expect(cycleTabIndex(0, 3, -1)).toBe(2);
    expect(cycleTabIndex(1, 3, -1)).toBe(0);
  });

  it('clamps to 0 for an empty list', () => {
    expect(cycleTabIndex(0, 0, 1)).toBe(0);
    expect(cycleTabIndex(5, 0, -1)).toBe(0);
  });
});

describe('tabAtPoint', () => {
  const rects = tabStripLayout(ITEMS, 0, 0, 300, 0);

  it('finds the tab under a point inside it', () => {
    expect(tabAtPoint(rects, 5, 5)).toBe(0);
    expect(tabAtPoint(rects, Math.floor(300 / 3) + 5, 5)).toBe(1);
  });

  it('returns -1 when the point misses every tab', () => {
    expect(tabAtPoint(rects, 5, 999)).toBe(-1);
    expect(tabAtPoint(rects, -5, 5)).toBe(-1);
  });

  it('treats the gap between tabs as a miss', () => {
    const cell = Math.floor(300 / 3);
    // Just past the drawn width of tab 0 (cell - gap), inside the gap.
    expect(tabAtPoint(rects, cell - 1, 5)).toBe(-1);
  });
});
