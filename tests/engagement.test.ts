import { describe, it, expect } from 'vitest';
import { propose, fianceOf, PROPOSAL_HEART_REQ } from '../src/game/engagement';
import { startingHearts, HEART_POINTS, MAX_HEARTS, BOUQUET_KEY } from '../src/game/hearts';
import type { Player } from '../src/world/world';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    x: 0,
    y: 0,
    facing: 'down',
    moveProgress: 0,
    targetX: 0,
    targetY: 0,
    fromX: 0,
    fromY: 0,
    inventory: {},
    gold: 0,
    quests: [],
    hearts: startingHearts(),
    ...overrides,
  };
}

describe('engagement', () => {
  it('rejects unknown candidates', () => {
    const p = makePlayer();
    expect(propose(p, 'noone', 1)).toEqual({ kind: 'not-candidate' });
  });

  it('rejects when hearts are below threshold', () => {
    const p = makePlayer();
    p.inventory[BOUQUET_KEY] = 1;
    const r = propose(p, 'rose', 1);
    expect(r.kind).toBe('too-few-hearts');
    if (r.kind === 'too-few-hearts') expect(r.need).toBe(PROPOSAL_HEART_REQ);
  });

  it('rejects when player has no bouquet even at max hearts', () => {
    const p = makePlayer();
    p.hearts!.rose.points = MAX_HEARTS * HEART_POINTS;
    expect(propose(p, 'rose', 1)).toEqual({ kind: 'no-bouquet' });
  });

  it('accepts a max-hearts proposal with bouquet and locks the engagement', () => {
    const p = makePlayer();
    p.hearts!.finn.points = MAX_HEARTS * HEART_POINTS;
    p.inventory[BOUQUET_KEY] = 2;
    const r = propose(p, 'finn', 12);
    expect(r).toEqual({ kind: 'accepted', npcId: 'finn' });
    expect(p.inventory[BOUQUET_KEY]).toBe(1);
    expect(p.engagement).toEqual({ npcId: 'finn', day: 12 });
    expect(fianceOf(p)).toBe('finn');
  });

  it('refuses a second proposal once engaged', () => {
    const p = makePlayer();
    p.hearts!.finn.points = MAX_HEARTS * HEART_POINTS;
    p.hearts!.rose.points = MAX_HEARTS * HEART_POINTS;
    p.inventory[BOUQUET_KEY] = 5;
    propose(p, 'finn', 1);
    const r = propose(p, 'rose', 2);
    expect(r).toEqual({ kind: 'already-engaged', toNpcId: 'finn' });
    expect(p.inventory[BOUQUET_KEY]).toBe(4); // only one consumed
  });
});
