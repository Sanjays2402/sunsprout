// Settings panel section dividers — GENERAL / DISPLAY / SAVE DATA grouping
// over the existing contiguous row order (no nav/behaviour change).

import { describe, it, expect } from 'vitest';
import { settingsSections, type SettingsSection } from '../src/ui/settings-panel';

describe('settingsSections', () => {
  const sections = settingsSections();

  it('groups the rows into three labelled sections', () => {
    expect(sections.map((s) => s.key)).toEqual(['general', 'display', 'data']);
    expect(sections.map((s) => s.header)).toEqual(['GENERAL', 'DISPLAY', 'SAVE DATA']);
  });

  it('places each setting under the right section', () => {
    const byKey = (k: SettingsSection['key']) =>
      sections.find((s) => s.key === k)!.rows;
    expect(byKey('general')).toEqual(['autoSave']);
    expect(byKey('display')).toEqual(['nightTint', 'hudScale', 'reduceMotion']);
    expect(byKey('data')).toEqual(['reset']);
  });

  it('omits the headerless close verb from every section', () => {
    const allRows = sections.flatMap((s) => s.rows);
    expect(allRows).not.toContain('close');
  });

  it('every section header is a non-empty ASCII (no-emoji) string', () => {
    for (const s of sections) {
      expect(s.header.length).toBeGreaterThan(0);
      expect(/^[\x20-\x7E]+$/.test(s.header)).toBe(true);
    }
  });

  it('preserves the canonical row order within each section', () => {
    // The concatenation of section rows (sans close) is the ROWS order
    // minus the trailing close — i.e. grouping never reorders.
    const flat = sections.flatMap((s) => s.rows);
    expect(flat).toEqual(['autoSave', 'nightTint', 'hudScale', 'reduceMotion', 'reset']);
  });

  it('honours a custom row order, splitting non-contiguous runs', () => {
    // A hypothetical order that interleaves sections should produce a new
    // group each time the section changes (run-grouping, not group-by).
    const custom = ['autoSave', 'nightTint', 'reset', 'hudScale'] as const;
    const out = settingsSections(custom as unknown as Parameters<typeof settingsSections>[0]);
    expect(out.map((s) => s.key)).toEqual(['general', 'display', 'data', 'display']);
    expect(out[1].rows).toEqual(['nightTint']);
    expect(out[3].rows).toEqual(['hudScale']);
  });
});
