// Achievements earn-state filter — all / earned / locked cycle.

import { describe, it, expect } from 'vitest';
import {
  applyAchievementFilter,
  cycleAchievementFilter,
  achievementFilterLabel,
  ACHIEVEMENT_FILTERS,
  type AchievementFilter,
  type AchievementRow,
  type AchievementId,
} from '../src/game/achievements';
import { AchievementsPanel } from '../src/ui/achievements-panel';

/** A minimal synthetic badge row of a given earn state. */
function rowOf(earned: boolean, name: string = name_(earned)): AchievementRow {
  return {
    id: name as AchievementId,
    name,
    description: earned ? 'done' : 'hint',
    earned,
    earnedDay: earned ? 3 : null,
  };
}
function name_(earned: boolean): string {
  return earned ? 'won' : 'todo';
}

describe('cycleAchievementFilter', () => {
  it('cycles all -> earned -> locked -> all', () => {
    expect(cycleAchievementFilter('all')).toBe('earned');
    expect(cycleAchievementFilter('earned')).toBe('locked');
    expect(cycleAchievementFilter('locked')).toBe('all');
  });

  it('walks the whole cycle and returns to the start', () => {
    let f: AchievementFilter = 'all';
    const seen: AchievementFilter[] = [f];
    for (let i = 0; i < ACHIEVEMENT_FILTERS.length - 1; i++) {
      f = cycleAchievementFilter(f);
      seen.push(f);
    }
    expect(seen).toEqual([...ACHIEVEMENT_FILTERS]);
    expect(cycleAchievementFilter(f)).toBe('all');
  });
});

describe('achievementFilterLabel', () => {
  it('labels every filter with a non-empty ASCII word', () => {
    for (const f of ACHIEVEMENT_FILTERS) {
      const label = achievementFilterLabel(f);
      expect(label).toBe(f);
      expect(/^[\x20-\x7E]+$/.test(label)).toBe(true);
    }
  });
});

describe('applyAchievementFilter', () => {
  const mixed: AchievementRow[] = [
    rowOf(true, 'first'),
    rowOf(false, 'second'),
    rowOf(true, 'third'),
    rowOf(false, 'fourth'),
  ];

  it("'all' returns every row untouched (as a copy)", () => {
    const out = applyAchievementFilter(mixed, 'all');
    expect(out).toEqual(mixed);
    expect(out).not.toBe(mixed); // copy, not the same array ref
  });

  it("'earned' admits only earned badges, in catalog order", () => {
    const names = applyAchievementFilter(mixed, 'earned').map((r) => r.name);
    expect(names).toEqual(['first', 'third']);
  });

  it("'locked' admits only locked badges, in catalog order", () => {
    const names = applyAchievementFilter(mixed, 'locked').map((r) => r.name);
    expect(names).toEqual(['second', 'fourth']);
  });

  it('the two non-all filters partition the earn space', () => {
    for (const earned of [true, false]) {
      const hits = (['earned', 'locked'] as const).filter(
        (f) => applyAchievementFilter([rowOf(earned)], f).length === 1,
      );
      expect(hits.length).toBe(1);
    }
  });

  it('returns an empty list when the filter matches nothing', () => {
    const allEarned = [rowOf(true, 'a'), rowOf(true, 'b')];
    expect(applyAchievementFilter(allEarned, 'locked')).toEqual([]);
  });
});

describe('AchievementsPanel filter controller', () => {
  it('starts on all and resets to all on each open', () => {
    const p = new AchievementsPanel();
    p.open();
    expect(p.currentFilter()).toBe('all');
    p.update(200);
    p.cycleFilter();
    expect(p.currentFilter()).toBe('earned');
    p.close();
    p.open();
    expect(p.currentFilter()).toBe('all');
  });

  it('ignores cycleFilter while closed', () => {
    const p = new AchievementsPanel();
    p.cycleFilter();
    expect(p.currentFilter()).toBe('all');
  });
});
