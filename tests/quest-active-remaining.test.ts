// Quest-log remaining-work caption — questActiveRemaining() counts active
// quests + the steps left across them so the header can pair the board bar
// with "3 quests, 11 steps left". questRemainingLabel pluralises + clears
// when the board is done.

import { describe, it, expect } from 'vitest';
import { questActiveRemaining, questRemainingLabel } from '../src/game/quest-log';
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

describe('questActiveRemaining', () => {
  it('is {0,0} on an empty board', () => {
    expect(questActiveRemaining(mkPlayer([]))).toEqual({ quests: 0, steps: 0 });
    expect(questRemainingLabel({ quests: 0, steps: 0 })).toBe('');
  });

  it('counts active quests and sums their remaining steps', () => {
    // 2/5 -> 3 left, 1/4 -> 3 left => 2 quests, 6 steps.
    const p = mkPlayer([q(2, 5), q(1, 4)]);
    expect(questActiveRemaining(p)).toEqual({ quests: 2, steps: 6 });
  });

  it('ignores completed quests entirely', () => {
    const p = mkPlayer([q(5, 5, true), q(1, 3)]);
    expect(questActiveRemaining(p)).toEqual({ quests: 1, steps: 2 });
  });

  it('clamps over-progress so remaining never goes negative', () => {
    const p = mkPlayer([q(99, 5)]);
    expect(questActiveRemaining(p)).toEqual({ quests: 1, steps: 0 });
  });

  it('pluralises cleanly and clears when no quests are active', () => {
    expect(questRemainingLabel({ quests: 1, steps: 1 })).toBe('1 quest, 1 step left');
    expect(questRemainingLabel({ quests: 3, steps: 11 })).toBe('3 quests, 11 steps left');
    expect(questRemainingLabel({ quests: 0, steps: 0 })).toBe('');
  });
});
