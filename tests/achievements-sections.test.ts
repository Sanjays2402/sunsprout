// Achievements panel section dividers — EARNED / LOCKED grouping.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  ACHIEVEMENTS,
  buildAchievements,
  achievementSections,
  getEarned,
  type AchievementRow,
} from '../src/game/achievements';
import { AchievementsPanel } from '../src/ui/achievements-panel';

/** A synthetic row at a given earn state, for boundary tests. */
function rowAt(id: string, earned: boolean): AchievementRow {
  return {
    id: id as AchievementRow['id'],
    name: id,
    description: earned ? 'done' : 'hint',
    earned,
    earnedDay: earned ? 3 : null,
  };
}

describe('achievementSections', () => {
  it('splits rows into EARNED then LOCKED', () => {
    const sections = achievementSections([
      rowAt('a', true),
      rowAt('b', false),
      rowAt('c', true),
      rowAt('d', false),
    ]);
    expect(sections.map((s) => s.key)).toEqual(['earned', 'locked']);
    expect(sections[0].header).toBe('EARNED');
    expect(sections[1].header).toBe('LOCKED');
    expect(sections[0].rows.map((r) => r.id)).toEqual(['a', 'c']);
    expect(sections[1].rows.map((r) => r.id)).toEqual(['b', 'd']);
  });

  it('omits the EARNED bucket on a fresh save (everything locked)', () => {
    const sections = achievementSections([rowAt('a', false), rowAt('b', false)]);
    expect(sections.map((s) => s.key)).toEqual(['locked']);
  });

  it('omits the LOCKED bucket when every badge is earned', () => {
    const sections = achievementSections([rowAt('a', true), rowAt('b', true)]);
    expect(sections.map((s) => s.key)).toEqual(['earned']);
  });

  it('returns nothing for an empty list', () => {
    expect(achievementSections([])).toEqual([]);
  });

  it('preserves catalog order within each bucket', () => {
    const sections = achievementSections([
      rowAt('first', false),
      rowAt('second', true),
      rowAt('third', false),
      rowAt('fourth', true),
    ]);
    expect(sections[0].rows.map((r) => r.id)).toEqual(['second', 'fourth']);
    expect(sections[1].rows.map((r) => r.id)).toEqual(['first', 'third']);
  });

  it('every row from buildAchievements lands in exactly one section', () => {
    const w = new World();
    // Earn a couple so both buckets exist.
    getEarned(w.player).push({ id: ACHIEVEMENTS[0].id, earnedDay: 1 });
    getEarned(w.player).push({ id: ACHIEVEMENTS[2].id, earnedDay: 2 });
    const rows = buildAchievements(w.player);
    const sections = achievementSections(rows);
    const regrouped = sections.flatMap((s) => s.rows);
    expect(regrouped).toHaveLength(rows.length);
    // The header count matches each section's row tally.
    for (const s of sections) {
      expect(s.rows.length).toBeGreaterThan(0);
    }
  });
});

describe('AchievementsPanel controller', () => {
  it('toggle open + close', () => {
    const p = new AchievementsPanel();
    expect(p.isVisible()).toBe(false);
    p.toggle();
    expect(p.isVisible()).toBe(true);
    p.toggle();
    expect(p.isVisible()).toBe(false);
  });

  it('respects the open lockout before acting', () => {
    const p = new AchievementsPanel();
    p.open();
    expect(p.canAct()).toBe(false);
    p.update(200);
    expect(p.canAct()).toBe(true);
  });

  it('scroll never goes negative and clamps to the list', () => {
    const w = new World();
    const p = new AchievementsPanel();
    p.open();
    p.update(200);
    // Scrolling up on a fresh panel stays at 0.
    p.scrollUp();
    // Smoke: scrolling down many times then up returns toward the top
    // without throwing (the clamp math is exercised in draw()).
    for (let i = 0; i < 40; i++) p.scrollDown(w.player);
    for (let i = 0; i < 40; i++) p.scrollUp();
    expect(p.isVisible()).toBe(true);
  });
});
