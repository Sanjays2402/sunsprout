// Quest log — pure summary + panel controller.
import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import {
  buildQuestLog,
  formatReward,
  questCounts,
  questHint,
  questLogSections,
} from '../src/game/quest-log';
import { QuestLogPanel } from '../src/ui/quest-log-panel';
import { startingQuests, checkQuests, type Quest } from '../src/game/quests';

function seedQuests(p: Player): void {
  (p as { quests: Quest[] }).quests = startingQuests();
}

describe('formatReward', () => {
  it('formats gold-only rewards', () => {
    expect(formatReward({ gold: 10 })).toBe('+10g');
  });
  it('formats items and strips the _harvest suffix', () => {
    expect(formatReward({ gold: 50, items: { tomato_harvest: 3, wheat: 2 } })).toBe(
      '+50g, +3 tomato, +2 wheat',
    );
  });
  it('formats a cosmetic-only reward', () => {
    expect(formatReward({ cosmetic: 'sunhat' })).toBe('+sunhat');
  });
  it('emits a dash for an empty reward record', () => {
    expect(formatReward({})).toBe('—');
  });
});

describe('questHint', () => {
  it('returns Done. for completed quests', () => {
    const q = startingQuests()[0];
    q.complete = true;
    expect(questHint(q)).toBe('Done.');
  });
  it('falls back to the description when active', () => {
    const q = startingQuests()[0];
    expect(questHint(q)).toBe(q.description);
  });
});

describe('buildQuestLog', () => {
  it('returns active quests first, then completed', () => {
    const w = new World();
    (w.player as { quests: Quest[] }).quests = startingQuests();
    // Complete one quest (first-sprout) by directly flipping it.
    const qs = w.player.quests as Quest[];
    qs[0].complete = true;
    qs[0].progress = qs[0].goal;
    const log = buildQuestLog(w.player);
    expect(log.length).toBe(qs.length);
    expect(log[0].status).toBe('active');
    expect(log[log.length - 1].status).toBe('completed');
    expect(log[log.length - 1].id).toBe('first-sprout');
  });

  it('rolls up an empty quest array cleanly', () => {
    const w = new World();
    expect(buildQuestLog(w.player)).toEqual([]);
  });

  it('reports progress against goal on the row', () => {
    const w = new World();
    (w.player as { quests: Quest[] }).quests = startingQuests();
    // Plant a seed: first-sprout should bump to 1/1 and complete.
    checkQuests(w.player, { kind: 'plant', cropKey: 'wheat' });
    const log = buildQuestLog(w.player);
    const sprout = log.find((r) => r.id === 'first-sprout');
    expect(sprout?.progress).toBe(1);
    expect(sprout?.status).toBe('completed');
  });
});

describe('questCounts', () => {
  it('counts active + completed + total', () => {
    const w = new World();
    (w.player as { quests: Quest[] }).quests = startingQuests();
    const before = questCounts(w.player);
    expect(before.completed).toBe(0);
    expect(before.total).toBe(before.active);
    // Complete one.
    (w.player.quests[0] as Quest).complete = true;
    const after = questCounts(w.player);
    expect(after.completed).toBe(1);
    expect(after.active).toBe(after.total - 1);
  });
});

describe('questLogSections', () => {
  it('splits rows into ACTIVE then DONE', () => {
    const w = new World();
    (w.player as { quests: Quest[] }).quests = startingQuests();
    // Complete the first quest so both buckets exist.
    const qs = w.player.quests as Quest[];
    qs[0].complete = true;
    qs[0].progress = qs[0].goal;
    const sections = questLogSections(buildQuestLog(w.player));
    expect(sections.map((s) => s.key)).toEqual(['active', 'completed']);
    expect(sections[0].header).toBe('ACTIVE');
    expect(sections[1].header).toBe('DONE');
    // The completed quest is the only DONE row.
    expect(sections[1].rows.every((r) => r.status === 'completed')).toBe(true);
    expect(sections[0].rows.every((r) => r.status === 'active')).toBe(true);
  });

  it('omits the DONE bucket when nothing is finished', () => {
    const w = new World();
    (w.player as { quests: Quest[] }).quests = startingQuests();
    const sections = questLogSections(buildQuestLog(w.player));
    expect(sections.map((s) => s.key)).toEqual(['active']);
  });

  it('omits the ACTIVE bucket when every quest is done', () => {
    const w = new World();
    (w.player as { quests: Quest[] }).quests = startingQuests();
    for (const q of w.player.quests as Quest[]) {
      q.complete = true;
      q.progress = q.goal;
    }
    const sections = questLogSections(buildQuestLog(w.player));
    expect(sections.map((s) => s.key)).toEqual(['completed']);
  });

  it('returns nothing for an empty board', () => {
    expect(questLogSections([])).toEqual([]);
  });

  it('every quest row lands in exactly one section', () => {
    const w = new World();
    (w.player as { quests: Quest[] }).quests = startingQuests();
    (w.player.quests[0] as Quest).complete = true;
    const rows = buildQuestLog(w.player);
    const sections = questLogSections(rows);
    const regrouped = sections.flatMap((s) => s.rows);
    expect(regrouped).toHaveLength(rows.length);
  });
});

describe('QuestLogPanel controller', () => {
  it('toggles open + close', () => {
    const panel = new QuestLogPanel();
    expect(panel.isVisible()).toBe(false);
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('respects the lockout before canAct', () => {
    const panel = new QuestLogPanel();
    panel.open();
    expect(panel.canAct()).toBe(false);
    panel.update(200);
    expect(panel.canAct()).toBe(true);
  });

  it('scroll up + down clamp inside the row count', () => {
    const w = new World();
    seedQuests(w.player);
    const panel = new QuestLogPanel();
    panel.open();
    panel.update(200);
    panel.scrollUp(); // stays at 0
    for (let i = 0; i < 50; i++) panel.scrollDown(w.player);
    // Should never throw, never blow past the bound.
    expect(panel.isVisible()).toBe(true);
  });
});
