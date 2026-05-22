// Hearts — slice 1 of v0.5.0 marriage candidates.
// Pure state-machine module: gift tastes, talk bonus, heart meter math.
import { describe, it, expect } from 'vitest';
import {
  CANDIDATES,
  HEART_POINTS,
  MAX_HEARTS,
  creditTalk,
  getHearts,
  giftPoints,
  giveGift,
  heartsFromPoints,
  startingHearts,
  tasteOf,
} from '../src/game/hearts';

describe('hearts', () => {
  it('seeds a row for every candidate at zero hearts', () => {
    const s = startingHearts();
    expect(Object.keys(s).sort()).toEqual(Object.keys(CANDIDATES).sort());
    for (const id of Object.keys(CANDIDATES)) {
      expect(s[id].points).toBe(0);
      expect(getHearts(s, id)).toBe(0);
    }
  });

  it('classifies tastes from candidate definitions', () => {
    expect(tasteOf('rose', 'hearty-stew')).toBe('loved');
    expect(tasteOf('rose', 'flower_harvest')).toBe('liked');
    expect(tasteOf('rose', 'copper')).toBe('disliked');
    expect(tasteOf('rose', 'turnip_harvest')).toBe('neutral');
    expect(tasteOf('nobody', 'anything')).toBe('neutral');
  });

  it('giftPoints scales by taste', () => {
    expect(giftPoints('loved')).toBe(80);
    expect(giftPoints('liked')).toBe(40);
    expect(giftPoints('neutral')).toBe(20);
    expect(giftPoints('disliked')).toBe(-20);
  });

  it('applies a loved gift and reports the points', () => {
    const s = startingHearts();
    const r = giveGift(s, 'rose', 'hearty-stew', 1);
    expect(r.accepted).toBe(true);
    expect(r.taste).toBe('loved');
    expect(r.pointsApplied).toBe(80);
    expect(s.rose.points).toBe(80);
    expect(r.hearts).toBe(0); // 80 < HEART_POINTS
    expect(r.leveledUp).toBe(false);
  });

  it('rejects a second gift on the same day', () => {
    const s = startingHearts();
    expect(giveGift(s, 'finn', 'frog', 3).accepted).toBe(true);
    const second = giveGift(s, 'finn', 'frog', 3);
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe('already gifted today');
    expect(s.finn.points).toBe(80);
  });

  it('accepts a gift on a new day', () => {
    const s = startingHearts();
    giveGift(s, 'finn', 'frog', 3);
    const r = giveGift(s, 'finn', 'frog', 4);
    expect(r.accepted).toBe(true);
    expect(s.finn.points).toBe(160);
  });

  it('reports a heart level-up when crossing a HEART_POINTS boundary', () => {
    const s = startingHearts();
    s.maple.points = HEART_POINTS - 10; // just below 1 heart
    const r = giveGift(s, 'maple', 'ruby', 7); // loved, +80
    expect(r.leveledUp).toBe(true);
    expect(r.hearts).toBe(1);
  });

  it('clamps points to [0, MAX_HEARTS * HEART_POINTS]', () => {
    const s = startingHearts();
    s.mayor.points = MAX_HEARTS * HEART_POINTS;
    const r = giveGift(s, 'mayor', 'flower_harvest', 1);
    expect(r.accepted).toBe(true);
    expect(s.mayor.points).toBe(MAX_HEARTS * HEART_POINTS);
    expect(getHearts(s, 'mayor')).toBe(MAX_HEARTS);

    const s2 = startingHearts();
    s2.maple.points = 10;
    giveGift(s2, 'maple', 'frog', 1); // disliked, -20 → clamps to 0
    expect(s2.maple.points).toBe(0);
  });

  it('credits the talk bonus once per day per NPC', () => {
    const s = startingHearts();
    expect(creditTalk(s, 'mayor', 5)).toBe(true);
    expect(s.mayor.points).toBe(2);
    expect(creditTalk(s, 'mayor', 5)).toBe(false);
    expect(s.mayor.points).toBe(2);
    expect(creditTalk(s, 'mayor', 6)).toBe(true);
    expect(s.mayor.points).toBe(4);
  });

  it('heartsFromPoints clamps and floors', () => {
    expect(heartsFromPoints(0)).toBe(0);
    expect(heartsFromPoints(HEART_POINTS - 1)).toBe(0);
    expect(heartsFromPoints(HEART_POINTS)).toBe(1);
    expect(heartsFromPoints(HEART_POINTS * MAX_HEARTS * 5)).toBe(MAX_HEARTS);
    expect(heartsFromPoints(-50)).toBe(0);
  });
});
