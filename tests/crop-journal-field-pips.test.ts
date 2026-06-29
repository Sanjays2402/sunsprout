// Crop-journal field-status pips — fieldStatusParts() breaks the live-field
// digest into tagged, urgency-ordered parts so the panel can lead each count
// with a tinted pip (ready green / thirsty amber / growing dim). It mirrors
// fieldStatusSummary's order + buckets exactly so caption and pips agree.

import { describe, it, expect } from 'vitest';
import {
  fieldStatusCounts,
  fieldStatusParts,
  fieldStatusSummary,
  type FieldCropSample,
} from '../src/game/crop-journal';

const crop = (stage: number, growthStages: number, watered: boolean): FieldCropSample => ({
  stage,
  growthStages,
  watered,
});

describe('fieldStatusParts', () => {
  it('is empty on a bare field', () => {
    expect(fieldStatusParts(fieldStatusCounts([]))).toEqual([]);
  });

  it('leads with ready, then growing, then thirsty', () => {
    const parts = fieldStatusParts(
      fieldStatusCounts([
        crop(2, 3, true), // ready
        crop(0, 3, true), // growing, watered
        crop(0, 3, false), // growing, thirsty
      ]),
    );
    expect(parts.map((p) => p.kind)).toEqual(['ready', 'growing', 'thirsty']);
    expect(parts[0].count).toBe(1);
    expect(parts[1].count).toBe(2); // both un-ready crops are growing
    expect(parts[2].count).toBe(1);
  });

  it('omits zero buckets', () => {
    const parts = fieldStatusParts(fieldStatusCounts([crop(2, 3, true)]));
    expect(parts).toHaveLength(1);
    expect(parts[0].kind).toBe('ready');
  });

  it('counts + labels agree with the caption text', () => {
    const status = fieldStatusCounts([crop(2, 3, true), crop(0, 3, false)]);
    const parts = fieldStatusParts(status);
    const rebuilt = parts.map((p) => `${p.count} ${p.label}`).join(', ');
    expect(rebuilt).toBe(fieldStatusSummary(status));
  });
});
