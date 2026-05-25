import { describe, expect, it } from 'vitest';
import { rosterDiffFlashLabel } from '../src/ui/peer-roster-diff-flash-label';

describe('rosterDiffFlashLabel', () => {
  it("returns '' for none", () => {
    expect(rosterDiffFlashLabel('none')).toBe('');
  });

  it('returns joined for arrivals', () => {
    expect(rosterDiffFlashLabel('arrivals')).toBe('joined');
  });

  it('returns left for departures', () => {
    expect(rosterDiffFlashLabel('departures')).toBe('left');
  });

  it('returns stirring for liveness', () => {
    expect(rosterDiffFlashLabel('liveness')).toBe('stirring');
  });

  it('returns busy for churn', () => {
    expect(rosterDiffFlashLabel('churn')).toBe('busy');
  });

  it('is always a short single word', () => {
    const tones = ['none', 'arrivals', 'departures', 'liveness', 'churn'] as const;
    for (const t of tones) {
      const label = rosterDiffFlashLabel(t);
      expect(label).not.toContain(' ');
      expect(label.length).toBeLessThanOrEqual(10);
    }
  });
});
