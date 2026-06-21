// NPC hangouts — heart-4 invites + window firing + persistence.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingHearts, HEART_POINTS, type HeartsState } from '../src/game/hearts';
import {
  HANGOUT_GOLD_TIP,
  HANGOUT_HEART_THRESHOLD,
  HANGOUT_HOUR_END,
  HANGOUT_HOUR_START,
  HANGOUT_SPOTS,
  activeInviteAtPlayer,
  expireOldInvites,
  fireHangoutIfPresent,
  getInvites,
  hasInviteFrom,
  inviteToastLine,
  maybePostInvite,
  rollDailyInvites,
} from '../src/game/hangouts';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function withHearts(world: World, npcId: string, hearts: number): void {
  const state = startingHearts();
  state[npcId].points = hearts * HEART_POINTS;
  (world.player as { hearts?: HeartsState }).hearts = state;
}

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('maybePostInvite', () => {
  it('refuses when hearts < threshold', () => {
    const w = new World();
    withHearts(w, 'mayor', HANGOUT_HEART_THRESHOLD - 1);
    const t = new TimeOfDay(6);
    expect(maybePostInvite(w.player, 'mayor', t)).toBeNull();
    expect(getInvites(w.player)).toEqual([]);
  });

  it('posts an invite once hearts cross the threshold', () => {
    const w = new World();
    withHearts(w, 'mayor', HANGOUT_HEART_THRESHOLD);
    const t = new TimeOfDay(6);
    const inv = maybePostInvite(w.player, 'mayor', t);
    expect(inv).not.toBeNull();
    expect(inv?.npcId).toBe('mayor');
    expect(inv?.x).toBe(HANGOUT_SPOTS.mayor.x);
    expect(inv?.y).toBe(HANGOUT_SPOTS.mayor.y);
    expect(hasInviteFrom(w.player, 'mayor')).toBe(true);
  });

  it('refuses to double-post for the same NPC', () => {
    const w = new World();
    withHearts(w, 'maple', 5);
    const t = new TimeOfDay(6);
    expect(maybePostInvite(w.player, 'maple', t)).not.toBeNull();
    expect(maybePostInvite(w.player, 'maple', t)).toBeNull();
  });

  it('refuses for an unknown NPC', () => {
    const w = new World();
    withHearts(w, 'mayor', 5);
    const t = new TimeOfDay(6);
    expect(maybePostInvite(w.player, 'nobody', t)).toBeNull();
  });
});

describe('rollDailyInvites', () => {
  it('posts an invite for every heart-4 candidate that lacks one', () => {
    const w = new World();
    const state = startingHearts();
    for (const id of Object.keys(state)) state[id].points = 5 * HEART_POINTS;
    (w.player as { hearts: HeartsState }).hearts = state;
    const t = new TimeOfDay(6);
    const posted = rollDailyInvites(w.player, t);
    expect(posted.length).toBe(Object.keys(state).length);
    // A second call shouldn't add more (each NPC already has one).
    expect(rollDailyInvites(w.player, t).length).toBe(0);
  });
});

describe('activeInviteAtPlayer + fireHangoutIfPresent', () => {
  it('only matches inside the hour window AND the radius', () => {
    const w = new World();
    withHearts(w, 'mayor', 5);
    const t = new TimeOfDay(6);
    // Force a deterministic invite at known coords.
    const inv = maybePostInvite(w.player, 'mayor', t);
    expect(inv).not.toBeNull();
    const tgt = new TimeOfDay(6);
    tgt.season = inv!.season;
    tgt.day = inv!.day;
    // Outside the hour window → no match.
    tgt.hour = HANGOUT_HOUR_START - 1;
    expect(activeInviteAtPlayer(w.player, inv!.x, inv!.y, tgt)).toBeNull();
    // Inside the hour window AND on the spot → match.
    tgt.hour = HANGOUT_HOUR_START;
    expect(activeInviteAtPlayer(w.player, inv!.x, inv!.y, tgt)).toBe(inv);
    // Inside hour, outside radius → no match.
    expect(activeInviteAtPlayer(w.player, inv!.x + 5, inv!.y, tgt)).toBeNull();
  });

  it('firing awards gold + hearts and consumes the invite', () => {
    const w = new World();
    withHearts(w, 'rose', 5);
    const t = new TimeOfDay(6);
    const inv = maybePostInvite(w.player, 'rose', t);
    expect(inv).not.toBeNull();
    const tgt = new TimeOfDay(6);
    tgt.season = inv!.season;
    tgt.day = inv!.day;
    tgt.hour = HANGOUT_HOUR_START + 1;
    w.player.gold = 100;
    const beforePoints = w.player.hearts!.rose.points;
    const out = fireHangoutIfPresent(w.player, inv!.x, inv!.y, tgt);
    expect(out.kind).toBe('fired');
    expect(w.player.gold).toBe(100 + HANGOUT_GOLD_TIP);
    expect(w.player.hearts!.rose.points).toBeGreaterThan(beforePoints);
    expect(getInvites(w.player)).toEqual([]);
  });

  it('returns none when no invite is active', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    t.hour = HANGOUT_HOUR_START + 1;
    const out = fireHangoutIfPresent(w.player, 19, 7, t);
    expect(out.kind).toBe('none');
  });
});

describe('expireOldInvites', () => {
  it('drops invites whose date already passed', () => {
    const w = new World();
    withHearts(w, 'finn', 5);
    const t = new TimeOfDay(6);
    const inv = maybePostInvite(w.player, 'finn', t)!;
    // Roll the clock past the invite's date.
    const later = new TimeOfDay(6);
    later.season = inv.season;
    later.day = inv.day + 1;
    if (later.day > 7) {
      later.day = 1;
      later.season = (((inv.season + 1) % 4) as 0 | 1 | 2 | 3);
    }
    const expired = expireOldInvites(w.player, later);
    expect(expired).toBe(1);
    expect(getInvites(w.player)).toEqual([]);
  });

  it('leaves invites that haven\'t fired yet', () => {
    const w = new World();
    withHearts(w, 'maple', 5);
    const t = new TimeOfDay(6);
    maybePostInvite(w.player, 'maple', t);
    expect(expireOldInvites(w.player, t)).toBe(0);
    expect(getInvites(w.player).length).toBe(1);
  });
});

describe('inviteToastLine', () => {
  it('mentions the NPC + day + hour window', () => {
    const w = new World();
    withHearts(w, 'mayor', 5);
    const inv = maybePostInvite(w.player, 'mayor', new TimeOfDay(6))!;
    const line = inviteToastLine(inv);
    expect(line).toContain('Mayor');
    expect(line).toContain(`day ${inv.day}`);
    expect(line).toContain(`${HANGOUT_HOUR_START}-${HANGOUT_HOUR_END}`);
  });
});

describe('persistence — invites + cooldowns round-trip', () => {
  it('survives a snapshot round-trip', () => {
    const a = fakeGame();
    withHearts(a.world, 'mayor', 5);
    const inv = maybePostInvite(a.world.player, 'mayor', a.time)!;
    // Also stamp a hangout cooldown.
    (a.world.player as { lastHangoutDay?: Record<string, number> }).lastHangoutDay = {
      rose: 3,
    };
    const snap = serializeGame(a);
    expect(snap.player.npcInvites).toHaveLength(1);
    expect(snap.player.npcInvites?.[0].npcId).toBe('mayor');
    expect(snap.player.lastHangoutDay?.rose).toBe(3);
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(getInvites(b.world.player)).toHaveLength(1);
    expect(getInvites(b.world.player)[0].x).toBe(inv.x);
    expect(
      (b.world.player as { lastHangoutDay?: Record<string, number> }).lastHangoutDay?.rose,
    ).toBe(3);
  });
});
