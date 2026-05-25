import { describe, expect, it } from 'vitest';
import { rosterDiffFlashSpec } from '../src/ui/peer-roster-diff-flash-spec';

describe('rosterDiffFlashSpec', () => {
  it('returns zero-duration empty spec for none', () => {
    const s = rosterDiffFlashSpec('none');
    expect(s.tone).toBe('none');
    expect(s.label).toBe('');
    expect(s.durationMs).toBe(0);
  });

  it('packs label + palette + duration for arrivals', () => {
    const s = rosterDiffFlashSpec('arrivals');
    expect(s.label).toBe('joined');
    expect(s.durationMs).toBeGreaterThan(0);
    expect(s.palette.border).toMatch(/^#/);
  });

  it('gives churn the longest visible duration', () => {
    const tones = ['arrivals', 'departures', 'liveness', 'churn'] as const;
    const durations = tones.map((t) => rosterDiffFlashSpec(t).durationMs);
    const churn = rosterDiffFlashSpec('churn').durationMs;
    expect(Math.max(...durations)).toBe(churn);
  });

  it('every non-none tone has a positive duration and non-empty label', () => {
    for (const t of ['arrivals', 'departures', 'liveness', 'churn'] as const) {
      const s = rosterDiffFlashSpec(t);
      expect(s.durationMs).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
