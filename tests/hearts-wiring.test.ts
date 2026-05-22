// Slice 2 of v0.5.0 — verify HeartsState attaches to the World's Player
// and that creditTalk advances points correctly across multiple days.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  CANDIDATES,
  TALK_POINTS_PER_DAY,
  creditTalk,
  getHearts,
  startingHearts,
} from '../src/game/hearts';

describe('hearts wiring on Player', () => {
  it('attaches a HeartsState row for every candidate', () => {
    const w = new World();
    const p = w.player;
    expect(p).toBeTruthy();
    p!.hearts = startingHearts();
    for (const id of Object.keys(CANDIDATES)) {
      expect(p!.hearts![id]).toBeDefined();
      expect(getHearts(p!.hearts!, id)).toBe(0);
    }
  });

  it('credits one talk per day and ignores duplicates same-day', () => {
    const w = new World();
    const p = w.player!;
    p.hearts = startingHearts();
    expect(creditTalk(p.hearts, 'maple', 1)).toBe(true);
    expect(creditTalk(p.hearts, 'maple', 1)).toBe(false); // same day, no-op
    expect(creditTalk(p.hearts, 'maple', 2)).toBe(true);
    expect(p.hearts.maple.points).toBe(TALK_POINTS_PER_DAY * 2);
  });

  it('returns false for unknown npc ids', () => {
    const s = startingHearts();
    expect(creditTalk(s, 'ghost', 0)).toBe(false);
  });
});
