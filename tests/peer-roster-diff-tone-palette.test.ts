import { describe, it, expect } from 'vitest';
import { rosterDiffTonePalette } from '../src/ui/peer-roster-diff-tone-palette';
import type { RosterDiffTone } from '../src/game/peer-roster-diff-tone';

describe('rosterDiffTonePalette', () => {
  it('returns a distinct palette for every non-none tone', () => {
    const tones: RosterDiffTone[] = ['arrivals', 'departures', 'liveness', 'churn'];
    const bgs = new Set(tones.map((t) => rosterDiffTonePalette(t).bg));
    expect(bgs.size).toBe(tones.length);
  });

  it('returns fully transparent triple for tone "none"', () => {
    const p = rosterDiffTonePalette('none');
    expect(p.bg).toContain('rgba(0, 0, 0, 0)');
    expect(p.border).toContain('rgba(0, 0, 0, 0)');
    expect(p.text).toContain('rgba(0, 0, 0, 0)');
  });

  it('arrivals palette is green-tinted', () => {
    const p = rosterDiffTonePalette('arrivals');
    expect(p.border.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    // pulled from intent: arrivals border is sprout-green
    expect(p.border).toBe('#7fd48a');
  });

  it('churn palette is amber-tinted', () => {
    const p = rosterDiffTonePalette('churn');
    expect(p.border).toBe('#e0a060');
  });

  it('falls back to none palette for unknown tones', () => {
    const p = rosterDiffTonePalette('mystery' as RosterDiffTone);
    expect(p.bg).toContain('rgba(0, 0, 0, 0)');
  });

  it('returns identical objects shape (bg/border/text)', () => {
    for (const t of ['none', 'arrivals', 'departures', 'liveness', 'churn'] as RosterDiffTone[]) {
      const p = rosterDiffTonePalette(t);
      expect(Object.keys(p).sort()).toEqual(['bg', 'border', 'text']);
    }
  });
});
