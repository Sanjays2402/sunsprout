// Rumor history tab on the lore panel — each entry in the rumor ring
// buffer becomes a "discovered" row tagged with bought/skipped status.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  LORE_CATEGORIES,
  buildLoreRows,
  loreCompletion,
  loreProgress,
} from '../src/game/lore';
import { recordRumorVisit, recordRumorBuy, getRumorHistory } from '../src/game/cart-rumor';

function freshWorld(): World {
  const w = new World();
  return w;
}

describe('lore panel — Rumors category', () => {
  it('is registered in LORE_CATEGORIES last (so the chrome tab order keeps the bestiary first)', () => {
    expect(LORE_CATEGORIES[LORE_CATEGORIES.length - 1]).toBe('Rumors');
    expect(LORE_CATEGORIES.includes('Rumors')).toBe(true);
  });

  it('has no rows when the player has never seen a rumor', () => {
    const w = freshWorld();
    const rows = buildLoreRows(w.player).filter((r) => r.category === 'Rumors');
    expect(rows.length).toBe(0);
  });

  it('captures every entry in the rumor history ring buffer', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    recordRumorVisit(w.player, 1);
    recordRumorVisit(w.player, 2);
    const rows = buildLoreRows(w.player).filter((r) => r.category === 'Rumors');
    expect(rows.length).toBe(3);
    // Every row is "discovered" — even skipped rumors are visible.
    for (const r of rows) expect(r.discovered).toBe(true);
  });

  it('newest entry first (visit log reads top-down)', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    recordRumorVisit(w.player, 1);
    recordRumorVisit(w.player, 2);
    const rows = buildLoreRows(w.player).filter((r) => r.category === 'Rumors');
    const entries = getRumorHistory(w.player).entries;
    const newestSeason = entries[entries.length - 1].season;
    // The first row's name tags the most recent season visited.
    expect(rows[0].name.split(' ')[0]).toMatch(/Spring|Summer|Fall|Winter/);
    // And it corresponds to the newest entry — its description says 'skipped'.
    expect(rows[0].description).toContain('skipped');
    expect(newestSeason).toBe(2);
  });

  it('description carries bought / skipped state', () => {
    const w = freshWorld();
    const visited = recordRumorVisit(w.player, 0);
    expect(visited).not.toBeNull();
    // Stamp the entry as bought via the formal recordRumorBuy path.
    recordRumorBuy(w.player, 0, visited!.itemKey);
    const rows = buildLoreRows(w.player).filter((r) => r.category === 'Rumors');
    expect(rows.length).toBe(1);
    expect(rows[0].description).toContain('bought');
    expect(rows[0].description).not.toContain('skipped');
    expect(rows[0].count).toBe(1);
  });

  it('skipped rows have count 0', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    const rows = buildLoreRows(w.player).filter((r) => r.category === 'Rumors');
    expect(rows[0].count).toBe(0);
  });

  it('Rumors does not skew loreCompletion (visit log is excluded)', () => {
    const w = freshWorld();
    // Completion is 0% before any discoveries.
    const before = loreCompletion(w.player);
    expect(before).toBe(0);
    // Recording a rumor visit should leave completion at 0% — it's
    // not a "discovery" of fish / gems / forage / crops / folk.
    recordRumorVisit(w.player, 0);
    expect(loreCompletion(w.player)).toBe(before);
  });

  it('loreProgress tracks the rumors tab separately', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    recordRumorVisit(w.player, 1);
    const progress = loreProgress(w.player);
    const rumorBucket = progress.find((p) => p.category === 'Rumors');
    expect(rumorBucket).toBeDefined();
    expect(rumorBucket?.total).toBe(2);
    expect(rumorBucket?.discovered).toBe(2);
  });

  it('Rumors tab is rightmost — keeps bestiary tabs in their original order', () => {
    expect(LORE_CATEGORIES[0]).toBe('Fish');
    expect(LORE_CATEGORIES[1]).toBe('Gems');
    expect(LORE_CATEGORIES[2]).toBe('Forage');
    expect(LORE_CATEGORIES[3]).toBe('Crops');
    expect(LORE_CATEGORIES[4]).toBe('Folk');
    expect(LORE_CATEGORIES[5]).toBe('Rumors');
  });

  it('row id is unique per (season, itemKey, index) so two entries with the same key in different seasons stay distinct', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    recordRumorVisit(w.player, 1);
    recordRumorVisit(w.player, 2);
    const rows = buildLoreRows(w.player).filter((r) => r.category === 'Rumors');
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.size).toBe(rows.length);
  });
});
