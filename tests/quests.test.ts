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

  it('a mine event completes First Gem and applies the reward', () => {
    const p = freshPlayer();
    const before = p.gold;
    const completed = checkQuests(p, { kind: 'mine', gemKey: 'quartz' });
    expect(completed).toContain('first-gem');
    const q = (p.quests as Quest[]).find((qq) => qq.id === 'first-gem')!;
    expect(q.complete).toBe(true);
    expect(p.gold).toBe(before + 60);
    expect(p.inventory.wheat).toBe(3);
  });

  it('Geologist completes after mining one of every gem kind, dedup-by-kind', () => {
    const p = freshPlayer();
    const before = p.gold;
    // Same gem twice should only count once.
    checkQuests(p, { kind: 'mine', gemKey: 'copper' });
    checkQuests(p, { kind: 'mine', gemKey: 'copper' });
    let q = (p.quests as Quest[]).find((qq) => qq.id === 'geologist')!;
    expect(q.progress).toBe(1);
    expect(q.complete).toBe(false);
    for (const k of ['iron', 'silver', 'gold', 'ruby']) {
      checkQuests(p, { kind: 'mine', gemKey: k });
    }
    q = (p.quests as Quest[]).find((qq) => qq.id === 'geologist')!;
    expect(q.complete).toBe(true);
    expect(q.progress).toBe(q.goal);
    // 60 from first-gem + 250 from geologist
    expect(p.gold).toBe(before + 60 + 250);
  });

  it('Sweetheart quest completes when a gift event reports ≥2 hearts', () => {
    const p = freshPlayer();
    const before = p.gold;
    // 1 heart gift does NOT complete it
    let done = checkQuests(p, { kind: 'gift', npcId: 'maple', hearts: 1 });
    expect(done).not.toContain('sweetheart');
    let q = (p.quests as Quest[]).find((qq) => qq.id === 'sweetheart')!;
    expect(q.complete).toBe(false);
    // 2 hearts triggers it
    done = checkQuests(p, { kind: 'gift', npcId: 'maple', hearts: 2 });
    expect(done).toContain('sweetheart');
    q = (p.quests as Quest[]).find((qq) => qq.id === 'sweetheart')!;
    expect(q.complete).toBe(true);
    expect(p.gold).toBe(before + 80);
    expect(p.inventory['flower']).toBe(2);
  });

  it('Confidant and Devoted complete at the 4- and 6-heart thresholds', () => {
    const p = freshPlayer();
    const before = p.gold;
    // 3 hearts: sweetheart fires, confidant/devoted do not.
    let done = checkQuests(p, { kind: 'gift', npcId: 'rose', hearts: 3 });
    expect(done).toContain('sweetheart');
    expect(done).not.toContain('confidant');
    expect(done).not.toContain('devoted');
    // 4 hearts: confidant fires.
    done = checkQuests(p, { kind: 'gift', npcId: 'rose', hearts: 4 });
    expect(done).toContain('confidant');
    expect(done).not.toContain('devoted');
    // 6 hearts: devoted fires.
    done = checkQuests(p, { kind: 'gift', npcId: 'rose', hearts: 6 });
    expect(done).toContain('devoted');
    const confidant = (p.quests as Quest[]).find((qq) => qq.id === 'confidant')!;
    const devoted = (p.quests as Quest[]).find((qq) => qq.id === 'devoted')!;
    expect(confidant.complete).toBe(true);
    expect(devoted.complete).toBe(true);
    // Rewards: 80 + 160 + 320 gold.
    expect(p.gold).toBe(before + 80 + 160 + 320);
  });

  it('Soulmate completes at the 8-heart threshold and grants a bouquet', () => {
    const p = freshPlayer();
    const before = p.gold;
    const beforeBouquet = p.inventory['bouquet'] ?? 0;
    // 7 hearts: soulmate does NOT fire yet (but lower tiers do).
    let done = checkQuests(p, { kind: 'gift', npcId: 'finn', hearts: 7 });
    expect(done).not.toContain('soulmate');
    // 8 hearts: soulmate fires.
    done = checkQuests(p, { kind: 'gift', npcId: 'finn', hearts: 8 });
    expect(done).toContain('soulmate');
    const soulmate = (p.quests as Quest[]).find((qq) => qq.id === 'soulmate')!;
    expect(soulmate.complete).toBe(true);
    // Gold: 80 + 160 + 320 + 640 (all four heart quests across both gifts).
    expect(p.gold).toBe(before + 80 + 160 + 320 + 640);
    expect((p.inventory['bouquet'] ?? 0) - beforeBouquet).toBe(1);
  });
});
