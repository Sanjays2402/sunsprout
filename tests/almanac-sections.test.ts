// Almanac sections — TODAY / THIS WEEK / LATER grouping for the planner.

import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  buildAlmanac,
  almanacSections,
  ALMANAC_WEEK_MAX_DAYS,
  type AlmanacEntry,
} from '../src/game/almanac';

/** Build a clock parked at a given season/day. */
function clockAt(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = day;
  return t;
}

/** A minimal synthetic entry at a given daysUntil, for boundary tests. */
function entryAt(daysUntil: number): AlmanacEntry {
  return {
    daysUntil,
    kind: 'festival',
    title: `e${daysUntil}`,
    detail: '',
    season: 0,
    day: 1,
  };
}

describe('almanacSections', () => {
  it('buckets by daysUntil into today / week / later', () => {
    const sections = almanacSections([
      entryAt(0),
      entryAt(1),
      entryAt(ALMANAC_WEEK_MAX_DAYS),
      entryAt(ALMANAC_WEEK_MAX_DAYS + 1),
      entryAt(13),
    ]);
    expect(sections.map((s) => s.key)).toEqual(['today', 'week', 'later']);
    expect(sections[0].entries.map((e) => e.daysUntil)).toEqual([0]);
    expect(sections[1].entries.map((e) => e.daysUntil)).toEqual([1, ALMANAC_WEEK_MAX_DAYS]);
    expect(sections[2].entries.map((e) => e.daysUntil)).toEqual([ALMANAC_WEEK_MAX_DAYS + 1, 13]);
  });

  it('omits empty buckets so a bare header never shows', () => {
    // Only a far-future entry — just the LATER section appears.
    const sections = almanacSections([entryAt(10)]);
    expect(sections.map((s) => s.key)).toEqual(['later']);
  });

  it('returns nothing for an empty agenda', () => {
    expect(almanacSections([])).toEqual([]);
  });

  it('labels the headers TODAY / THIS WEEK / LATER', () => {
    const sections = almanacSections([entryAt(0), entryAt(2), entryAt(9)]);
    expect(sections.map((s) => s.header)).toEqual(['TODAY', 'THIS WEEK', 'LATER']);
  });

  it('preserves the soonest-first order within each bucket', () => {
    const sections = almanacSections([entryAt(2), entryAt(4), entryAt(1)].sort(
      (a, b) => a.daysUntil - b.daysUntil,
    ));
    // All three land in the week bucket, ascending.
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map((e) => e.daysUntil)).toEqual([1, 2, 4]);
  });

  it('every entry from buildAlmanac lands in exactly one section', () => {
    const entries = buildAlmanac(clockAt(0, 1));
    const sections = almanacSections(entries);
    const regrouped = sections.flatMap((s) => s.entries);
    expect(regrouped).toHaveLength(entries.length);
    // Section runs are in their canonical today/week/later order.
    const order = ['today', 'week', 'later'];
    const keys = sections.map((s) => s.key);
    const sorted = [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    expect(keys).toEqual(sorted);
  });
});
