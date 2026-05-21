// Quests — `cook` event wiring for the v0.3.0 First Recipe quest.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { checkQuests, startingQuests, type Quest } from '../src/game/quests';

function freshPlayer() {
  const w = new World();
  const p = w.player;
  p.inventory = {};
  p.gold = 0;
  p.quests = startingQuests();
  return p;
}

describe('quests', () => {
  it('starting roster includes the First Recipe cooking quest', () => {
    const quests = startingQuests();
    const ids = quests.map((q) => q.id);
    expect(ids).toContain('first-recipe');
    const q = quests.find((qq) => qq.id === 'first-recipe')!;
    expect(q.goal).toBe(1);
    expect(q.complete).toBe(false);
    expect(q.reward.gold).toBe(40);
  });

  it('a cook event completes First Recipe and applies the reward', () => {
    const p = freshPlayer();
    const before = p.gold;
    const completed = checkQuests(p, { kind: 'cook', dishKey: 'hearty-stew' });
    expect(completed).toContain('first-recipe');
    const q = (p.quests as Quest[]).find((qq) => qq.id === 'first-recipe')!;
    expect(q.complete).toBe(true);
    expect(q.progress).toBe(1);
    // gold reward (40) + items reward (2 wheat) applied
    expect(p.gold).toBe(before + 40);
    expect(p.inventory.wheat).toBe(2);
  });

  it('a non-cook event does not advance the First Recipe quest', () => {
    const p = freshPlayer();
    checkQuests(p, { kind: 'harvest', cropKey: 'wheat' });
    checkQuests(p, { kind: 'plant', cropKey: 'wheat' });
    const q = (p.quests as Quest[]).find((qq) => qq.id === 'first-recipe')!;
    expect(q.progress).toBe(0);
    expect(q.complete).toBe(false);
  });

  it('a second cook after completion does not double-reward', () => {
    const p = freshPlayer();
    checkQuests(p, { kind: 'cook', dishKey: 'hearty-stew' });
    const goldAfterFirst = p.gold;
    const completed = checkQuests(p, { kind: 'cook', dishKey: 'pumpkin-soup' });
    expect(completed).toEqual([]);
    expect(p.gold).toBe(goldAfterFirst);
  });
});
