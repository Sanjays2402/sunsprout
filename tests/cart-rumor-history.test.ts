// Cart rumor history — track the last RUMOR_HISTORY_CAP headliners
// Pip teased + whether the player bought each one. Surfaced as a
// summary line in the cart menu footer and a per-entry list for
// the future panel.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  RUMOR_HISTORY_CAP,
  currentSeasonHeadliner,
  getRumorHistory,
  recordRumorBuy,
  recordRumorVisit,
  rumorHistoryEntryLine,
  rumorHistoryLines,
  rumorHistorySummary,
} from '../src/game/cart-rumor';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

describe('getRumorHistory default', () => {
  it('starts empty', () => {
    const w = freshWorld();
    expect(getRumorHistory(w.player).entries).toEqual([]);
  });
});

describe('recordRumorVisit', () => {
  it('captures the headliner for the visited season', () => {
    const w = freshWorld();
    const expected = currentSeasonHeadliner(0)!;
    const entry = recordRumorVisit(w.player, 0);
    expect(entry).not.toBeNull();
    expect(entry!.season).toBe(0);
    expect(entry!.itemKey).toBe(expected.key);
    expect(entry!.label).toBe(expected.label);
    expect(entry!.buyPrice).toBe(expected.buyPrice);
    expect(entry!.bought).toBe(false);
    expect(getRumorHistory(w.player).entries).toHaveLength(1);
  });

  it('is idempotent on repeat opens of the same visit', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 1);
    recordRumorVisit(w.player, 1);
    recordRumorVisit(w.player, 1);
    expect(getRumorHistory(w.player).entries).toHaveLength(1);
  });

  it('appends a NEW entry for a different season', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    recordRumorVisit(w.player, 1);
    recordRumorVisit(w.player, 2);
    const entries = getRumorHistory(w.player).entries;
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.season)).toEqual([0, 1, 2]);
  });

  it('caps the ring at RUMOR_HISTORY_CAP, dropping the oldest', () => {
    const w = freshWorld();
    // Simulate RUMOR_HISTORY_CAP + 2 distinct visits.
    for (let s = 0; s < RUMOR_HISTORY_CAP + 2; s++) {
      recordRumorVisit(w.player, s);
    }
    const entries = getRumorHistory(w.player).entries;
    expect(entries).toHaveLength(RUMOR_HISTORY_CAP);
    // The oldest two seasons should have rotated off the front.
    expect(entries[0].season).toBe(2);
    expect(entries[entries.length - 1].season).toBe(RUMOR_HISTORY_CAP + 1);
  });
});

describe('recordRumorBuy', () => {
  it('returns false + no-op when itemKey is NOT the headliner', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    const out = recordRumorBuy(w.player, 0, 'definitely-not-the-headliner');
    expect(out).toBe(false);
    expect(getRumorHistory(w.player).entries[0].bought).toBe(false);
  });

  it('stamps the matching entry as bought', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    const headliner = currentSeasonHeadliner(0)!;
    const out = recordRumorBuy(w.player, 0, headliner.key);
    expect(out).toBe(true);
    expect(getRumorHistory(w.player).entries[0].bought).toBe(true);
  });

  it('idempotent on repeat stamps', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 1);
    const headliner = currentSeasonHeadliner(1)!;
    recordRumorBuy(w.player, 1, headliner.key);
    recordRumorBuy(w.player, 1, headliner.key);
    expect(getRumorHistory(w.player).entries[0].bought).toBe(true);
  });
});

describe('rumorHistoryEntryLine + rumorHistoryLines', () => {
  it('formats a per-entry line with season + label + price + status', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    const entries = getRumorHistory(w.player).entries;
    const line = rumorHistoryEntryLine(entries[0]);
    expect(line).toContain('Spring');
    expect(line).toContain(`${entries[0].buyPrice}g`);
    expect(line).toContain('skipped');
  });

  it('reads "bought" when the entry was stamped', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 2);
    const headliner = currentSeasonHeadliner(2)!;
    recordRumorBuy(w.player, 2, headliner.key);
    const lines = rumorHistoryLines(w.player);
    expect(lines[0]).toContain('Fall');
    expect(lines[0]).toContain('bought');
  });

  it('returns a "no history" line when ring is empty', () => {
    const w = freshWorld();
    const lines = rumorHistoryLines(w.player);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/No rumor history/);
  });

  it('returns newest-first ordering', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    recordRumorVisit(w.player, 1);
    recordRumorVisit(w.player, 2);
    const lines = rumorHistoryLines(w.player);
    expect(lines[0]).toContain('Fall'); // season 2 most recent
    expect(lines[1]).toContain('Summer');
    expect(lines[2]).toContain('Spring');
  });
});

describe('rumorHistorySummary', () => {
  it('is empty before any visit', () => {
    const w = freshWorld();
    expect(rumorHistorySummary(w.player)).toBe('');
  });

  it('counts bought vs total', () => {
    const w = freshWorld();
    recordRumorVisit(w.player, 0);
    recordRumorVisit(w.player, 1);
    const h0 = currentSeasonHeadliner(0)!;
    recordRumorBuy(w.player, 0, h0.key);
    const summary = rumorHistorySummary(w.player);
    expect(summary).toContain('1/2');
    expect(summary).toMatch(/bought/i);
  });
});
