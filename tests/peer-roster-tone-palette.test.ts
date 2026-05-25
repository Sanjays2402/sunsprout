import { describe, it, expect } from 'vitest';
import { rosterTonePalette } from '../src/ui/peer-roster-tone-palette';

describe('peer-roster-tone-palette', () => {
  it('returns the neutral purple triple for solo', () => {
    const p = rosterTonePalette('solo');
    expect(p.bg).toBe('rgba(26, 20, 38, 0.78)');
    expect(p.border).toBe('#4a3b6e');
    expect(p.text).toBe('#cdb8f0');
  });

  it('returns dim grey-violet for stale-only', () => {
    const p = rosterTonePalette('stale-only');
    expect(p.text).toBe('#8a869a');
    expect(p.border).toBe('#3d3a4a');
  });

  it('returns sprout-green for calm', () => {
    const p = rosterTonePalette('calm');
    expect(p.border).toBe('#4e7a52');
    expect(p.text).toBe('#bfe6c3');
  });

  it('returns sunset-amber for busy', () => {
    const p = rosterTonePalette('busy');
    expect(p.border).toBe('#a87142');
    expect(p.text).toBe('#f4cb9a');
  });

  it('returns distinct bg per tone', () => {
    const bgs = new Set(
      (['solo', 'stale-only', 'calm', 'busy'] as const).map(
        (t) => rosterTonePalette(t).bg,
      ),
    );
    expect(bgs.size).toBe(4);
  });
});
