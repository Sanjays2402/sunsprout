// Day-summary view model — rows + best-moment highlight.
import { describe, it, expect } from 'vitest';
import {
  summaryRows,
  bestMomentLine,
  SUMMARY_ROW_COLOR,
  GOLD_HIGHLIGHT,
  HARVEST_HIGHLIGHT,
} from '../src/game/day-summary';
import type { DaySummary } from '../src/game/sleep';

function summary(over: Partial<DaySummary> = {}): DaySummary {
  return {
    prevDay: 1,
    newDay: 2,
    goldDelta: 0,
    harvestDelta: 0,
    dishesDelta: 0,
    heartGains: [],
    flavor: 'A quiet night.',
    ...over,
  };
}

describe('summaryRows', () => {
  it('always shows gold + harvest, signed', () => {
    const rows = summaryRows(summary({ goldDelta: 40, harvestDelta: -2 }));
    expect(rows[0].kind).toBe('gold');
    expect(rows[0].text).toBe('Gold +40g');
    expect(rows[1].kind).toBe('harvest');
    expect(rows[1].text).toBe('Harvest -2');
  });

  it('omits dishes when zero, includes when nonzero', () => {
    expect(summaryRows(summary()).some((r) => r.kind === 'dishes')).toBe(false);
    expect(summaryRows(summary({ dishesDelta: 3 })).some((r) => r.kind === 'dishes')).toBe(true);
  });

  it('adds one hearts row per heart gain', () => {
    const rows = summaryRows(
      summary({ heartGains: [
        { npcId: 'maple', name: 'Maple', delta: 1 },
        { npcId: 'finn', name: 'Finn', delta: 2 },
      ] }),
    );
    const hearts = rows.filter((r) => r.kind === 'hearts');
    expect(hearts.length).toBe(2);
    expect(hearts[0].text).toBe('Maple +1 hearts');
  });

  it('every row kind has a tint', () => {
    const rows = summaryRows(summary({ dishesDelta: 1, heartGains: [{ npcId: 'maple', name: 'Maple', delta: 1 }] }));
    for (const r of rows) expect(SUMMARY_ROW_COLOR[r.kind]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('bestMomentLine', () => {
  it('prioritises a heart level-up above gold/harvest', () => {
    const line = bestMomentLine(
      summary({ goldDelta: 999, heartGains: [{ npcId: 'rose', name: 'Rose', delta: 1 }] }),
    );
    expect(line).toBe('Your bond with Rose grew warmer.');
  });

  it('names the count when multiple bonds grew', () => {
    const line = bestMomentLine(
      summary({ heartGains: [
        { npcId: 'rose', name: 'Rose', delta: 2 },
        { npcId: 'finn', name: 'Finn', delta: 1 },
      ] }),
    );
    // Top gain (Rose, +2) leads, plus the count of the rest.
    expect(line).toBe('Hearts warmed with Rose and 1 more.');
  });

  it('calls out a strong gold day at the threshold', () => {
    const line = bestMomentLine(summary({ goldDelta: GOLD_HIGHLIGHT }));
    expect(line).toBe(`A handsome ${GOLD_HIGHLIGHT}g day at market.`);
  });

  it('calls out a heavy harvest when gold is modest', () => {
    const line = bestMomentLine(summary({ goldDelta: 10, harvestDelta: HARVEST_HIGHLIGHT }));
    expect(line).toContain(`${HARVEST_HIGHLIGHT} harvested`);
  });

  it('falls back to dishes, then null on a truly quiet day', () => {
    expect(bestMomentLine(summary({ dishesDelta: 2 }))).toContain('2 cooked');
    expect(bestMomentLine(summary())).toBeNull();
  });
});
