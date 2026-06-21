// Quest board — rotation, turn-in, reward, week rollover.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  BOARD_QUESTS,
  BOARD_X,
  BOARD_Y,
  boardProgress,
  canTurnIn,
  getBoard,
  nearBoard,
  questForWeek,
  refreshBoard,
  turnIn,
} from '../src/game/board';

function freshWorld(): World {
  return new World();
}

describe('nearBoard', () => {
  it('is true on the board tile + its neighbours', () => {
    expect(nearBoard(BOARD_X, BOARD_Y)).toBe(true);
    expect(nearBoard(BOARD_X + 1, BOARD_Y)).toBe(true);
    expect(nearBoard(BOARD_X - 1, BOARD_Y + 1)).toBe(true);
  });

  it('is false more than one tile away', () => {
    expect(nearBoard(BOARD_X + 3, BOARD_Y)).toBe(false);
    expect(nearBoard(BOARD_X, BOARD_Y + 4)).toBe(false);
  });
});

describe('questForWeek', () => {
  it('returns a catalog entry for every season', () => {
    for (let s = 0; s < 4; s++) {
      const t = new TimeOfDay(8);
      t.season = s as 0 | 1 | 2 | 3;
      const q = questForWeek(t);
      expect(BOARD_QUESTS).toContain(q);
    }
  });

  it('rotates across seasons (Spring vs Summer differ)', () => {
    const a = new TimeOfDay(8);
    a.season = 0;
    const b = new TimeOfDay(8);
    b.season = 1;
    expect(questForWeek(a).id).not.toBe(questForWeek(b).id);
  });
});

describe('refreshBoard', () => {
  it('posts the season quest on first visit', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const q = refreshBoard(w.player, t);
    expect(q.id).toBe(questForWeek(t).id);
    expect(getBoard(w.player).activeId).toBe(q.id);
  });

  it('keeps the active quest stable within the same season', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const a = refreshBoard(w.player, t);
    // Advance days but stay in same season.
    t.day = 5;
    const b = refreshBoard(w.player, t);
    expect(a.id).toBe(b.id);
  });

  it('rotates to the next season quest when the season flips', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const a = refreshBoard(w.player, t);
    t.season = 2;
    t.day = 1;
    const b = refreshBoard(w.player, t);
    expect(a.id).not.toBe(b.id);
    expect(b.id).toBe(questForWeek(t).id);
  });
});

describe('turnIn', () => {
  it('rejects when player lacks the items', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const out = turnIn(w.player, t);
    expect(out.kind).toBe('not-enough');
  });

  it('consumes the items + pays reward gold on success', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const quest = questForWeek(t);
    w.player.inventory[quest.requireKey] = quest.requireCount;
    const goldBefore = w.player.gold;
    const out = turnIn(w.player, t);
    expect(out.kind).toBe('completed');
    expect(w.player.gold).toBe(goldBefore + quest.rewardGold);
    expect(w.player.inventory[quest.requireKey] ?? 0).toBe(0);
  });

  it('clears the active slot so the next week posts a fresh task', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const quest = questForWeek(t);
    w.player.inventory[quest.requireKey] = quest.requireCount;
    turnIn(w.player, t);
    expect(getBoard(w.player).activeId).toBeNull();
    // Same season: refresh re-arms the same quest.
    const re = refreshBoard(w.player, t);
    expect(re.id).toBe(quest.id);
  });

  it('drops the bonus items when present', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    // Tomato quest has rewardItems[{flower, 2}] — find it.
    const tomatoQuest = BOARD_QUESTS.find((q) => q.id === 'tomato-crate')!;
    t.season = (BOARD_QUESTS.findIndex((q) => q.id === 'tomato-crate') % 4) as 0 | 1 | 2 | 3;
    // Force board into tomato quest regardless of season-index match.
    refreshBoard(w.player, t);
    getBoard(w.player).activeId = tomatoQuest.id;
    w.player.inventory[tomatoQuest.requireKey] = tomatoQuest.requireCount;
    const flowerBefore = w.player.inventory['flower'] ?? 0;
    turnIn(w.player, t);
    expect((w.player.inventory['flower'] ?? 0)).toBe(flowerBefore + 2);
  });

  it('bumps completedCount + tracks recent ids', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const q = questForWeek(t);
    w.player.inventory[q.requireKey] = q.requireCount;
    turnIn(w.player, t);
    const state = getBoard(w.player);
    expect(state.completedCount).toBe(1);
    expect(state.recent[0]).toBe(q.id);
  });
});

describe('boardProgress / canTurnIn', () => {
  it('reflects current inventory against requirement', () => {
    const w = freshWorld();
    const t = new TimeOfDay(8);
    t.season = 0;
    const q = questForWeek(t);
    expect(canTurnIn(w.player, t)).toBe(false);
    w.player.inventory[q.requireKey] = q.requireCount - 1;
    const p = boardProgress(w.player, t);
    expect(p.have).toBe(q.requireCount - 1);
    expect(p.need).toBe(q.requireCount);
    expect(canTurnIn(w.player, t)).toBe(false);
    w.player.inventory[q.requireKey] = q.requireCount;
    expect(canTurnIn(w.player, t)).toBe(true);
  });
});
