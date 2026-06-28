// Quest-log status-filter — all / active / done cycle.

import { describe, it, expect } from 'vitest';
import {
  applyQuestFilter,
  cycleQuestFilter,
  questFilterLabel,
  QUEST_FILTERS,
  type QuestFilter,
  type QuestLogEntry,
  type QuestStatus,
} from '../src/game/quest-log';
import { QuestLogPanel } from '../src/ui/quest-log-panel';

/** A minimal synthetic quest row of a given status. */
function rowOf(status: QuestStatus, name: string = status): QuestLogEntry {
  return {
    id: name,
    name,
    description: '',
    status,
    progress: status === 'completed' ? 5 : 2,
    goal: 5,
    rewardLine: '+10g',
    rewardGlyphs: ['gold'],
    hint: status === 'completed' ? 'Done.' : 'do the thing',
  };
}

describe('cycleQuestFilter', () => {
  it('cycles all -> active -> done -> all', () => {
    expect(cycleQuestFilter('all')).toBe('active');
    expect(cycleQuestFilter('active')).toBe('done');
    expect(cycleQuestFilter('done')).toBe('all');
  });

  it('walks the whole cycle and returns to the start', () => {
    let f: QuestFilter = 'all';
    const seen: QuestFilter[] = [f];
    for (let i = 0; i < QUEST_FILTERS.length - 1; i++) {
      f = cycleQuestFilter(f);
      seen.push(f);
    }
    expect(seen).toEqual([...QUEST_FILTERS]);
    expect(cycleQuestFilter(f)).toBe('all');
  });
});

describe('questFilterLabel', () => {
  it('labels every filter with a non-empty ASCII word', () => {
    for (const f of QUEST_FILTERS) {
      const label = questFilterLabel(f);
      expect(label).toBe(f);
      expect(/^[\x20-\x7E]+$/.test(label)).toBe(true);
    }
  });
});

describe('applyQuestFilter', () => {
  const mixed: QuestLogEntry[] = [
    rowOf('active', 'plant'),
    rowOf('active', 'water'),
    rowOf('completed', 'first-sprout'),
  ];

  it("'all' returns every row untouched (as a copy)", () => {
    const out = applyQuestFilter(mixed, 'all');
    expect(out).toEqual(mixed);
    expect(out).not.toBe(mixed); // copy, not the same array ref
  });

  it("'active' admits only active quests", () => {
    const names = applyQuestFilter(mixed, 'active').map((r) => r.name);
    expect(names).toEqual(['plant', 'water']);
  });

  it("'done' admits only completed quests", () => {
    const names = applyQuestFilter(mixed, 'done').map((r) => r.name);
    expect(names).toEqual(['first-sprout']);
  });

  it('preserves the active-then-done order within a filter', () => {
    const ordered = [rowOf('active', 'a'), rowOf('active', 'b')];
    const out = applyQuestFilter(ordered, 'active');
    expect(out.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('the two non-all filters partition the status space', () => {
    const statuses: QuestStatus[] = ['active', 'completed'];
    for (const s of statuses) {
      const hits = (['active', 'done'] as const).filter(
        (f) => applyQuestFilter([rowOf(s)], f).length === 1,
      );
      expect(hits.length).toBe(1);
    }
  });
});

describe('QuestLogPanel filter controller', () => {
  it('starts on all and resets to all on each open', () => {
    const p = new QuestLogPanel();
    p.open();
    expect(p.currentFilter()).toBe('all');
    p.update(200);
    p.cycleFilter();
    expect(p.currentFilter()).toBe('active');
    p.close();
    p.open();
    expect(p.currentFilter()).toBe('all');
  });

  it('ignores cycleFilter while closed', () => {
    const p = new QuestLogPanel();
    p.cycleFilter();
    expect(p.currentFilter()).toBe('all');
  });
});
