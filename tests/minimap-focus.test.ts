// Minimap focused-landmark caption — cursor wrap + caption wording.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  cycleFocusIndex,
  focusedLandmarkCaption,
  minimapMarkers,
} from '../src/game/minimap';

describe('cycleFocusIndex', () => {
  it('advances and wraps forward', () => {
    expect(cycleFocusIndex(0, 5, 1)).toBe(1);
    expect(cycleFocusIndex(4, 5, 1)).toBe(0);
  });
  it('retreats and wraps backward', () => {
    expect(cycleFocusIndex(0, 5, -1)).toBe(4);
    expect(cycleFocusIndex(2, 5, -1)).toBe(1);
  });
  it('returns 0 for an empty list', () => {
    expect(cycleFocusIndex(3, 0, 1)).toBe(0);
    expect(cycleFocusIndex(0, 0, -1)).toBe(0);
  });
  it('never escapes the range no matter how far it is nudged', () => {
    let i = 0;
    for (let n = 0; n < 50; n++) {
      i = cycleFocusIndex(i, 4, 1);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(4);
    }
  });
});

describe('focusedLandmarkCaption', () => {
  it('names the landmark and its rounded tile', () => {
    const markers = [
      { tx: 24.5, ty: 9, glyph: 'S', label: "Maple's shop", color: '#000' },
    ];
    expect(focusedLandmarkCaption(markers, 0)).toBe("Maple's shop  -  tile 25, 9");
  });

  it('returns null for an empty list or an out-of-range index', () => {
    expect(focusedLandmarkCaption([], 0)).toBeNull();
    const markers = minimapMarkers(new World());
    expect(focusedLandmarkCaption(markers, -1)).toBeNull();
    expect(focusedLandmarkCaption(markers, markers.length)).toBeNull();
  });

  it('captions every real world landmark cleanly', () => {
    const markers = minimapMarkers(new World());
    expect(markers.length).toBeGreaterThan(0);
    for (let i = 0; i < markers.length; i++) {
      const cap = focusedLandmarkCaption(markers, i)!;
      expect(cap).toContain(markers[i].label);
      expect(cap).toMatch(/tile \d+, \d+$/);
      // No emoji / non-ASCII in the caption chrome.
      expect(/^[\x20-\x7E]*$/.test(cap)).toBe(true);
    }
  });
});
