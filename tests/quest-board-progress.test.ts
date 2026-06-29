// Quest-log whole-board progress bar — questBoardProgress() sums every
// quest's clamped progress over the sum of every goal, so the header bar
// shows real momentum from in-flight quests, not just the binary done count.
// questBoardFraction() turns it into the 0..1 the bar fills, suppressing at 0.

import { describe, it, expect } from 'vitest';
import { questBoardProgress, questBoardFraction } from '../src/game/quest-log';
import type { Player } from '../src/world/world';

const q = (progress: number, goal: number, complete = false) => ({
  id: 'x',
  name: 'X',
  description: '',
  goal,
  progress,
  reward: {},
  complete,
});

function mkPlayer(quests: ReturnType<typeof q>[]): Player {
  return { quests } as unknown as Player;
}

describe('questBoardProgress', () => {
  it('returns {0,0} for an empty board', () => {
    expect(questBoardProgress(mkPlayer([]))).toEqual({ done: 0, total: 0 });
    expect(questBoardFraction({ done: 0, total: 0 })).toBe(0);
  });

  it('sums clamped progress over summed goals', () => {
    // 2/5 + 1/4 -> done 3, total 9.
    const p = mkPlayer([q(2, 5), q(1, 4)]);
    expect(questBoardProgress(p)).toEqual({ done: 3, total: 9 });
    expect(questBoardFraction({ done: 3, total: 9 })).toBeCloseTo(0.333, 2);
  });

  it('clamps over-progress to the goal so a fraction never exceeds 1', () => {
    const p = mkPlayer([q(99, 5)]);
    const board = questBoardProgress(p);
    expect(board).toEqual({ done: 5, total: 5 });
    expect(questBoardFraction(board)).toBe(1);
  });

  it('reflects momentum even when zero quests are complete', () => {
    // Two quests 90% along, none done — the board fraction shows real shape.
    const p = mkPlayer([q(9, 10), q(9, 10)]);
    expect(questBoardFraction(questBoardProgress(p))).toBeCloseTo(0.9, 2);
  });

  it('floors negative progress at 0 and ignores negative goals', () => {
    const p = mkPlayer([q(-3, 4)]);
    expect(questBoardProgress(p)).toEqual({ done: 0, total: 4 });
  });
});
