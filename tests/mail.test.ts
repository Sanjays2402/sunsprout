// Mail — daily delivery, unread tracking, dialogue wrapping.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingHearts, HEART_POINTS } from '../src/game/hearts';
import {
  LETTER_TIERS,
  LETTER_TEXT,
  deliverDailyMail,
  emptyMailbox,
  getMailbox,
  letterPreview,
  makeLetter,
  readNextLetter,
  unreadCount,
} from '../src/game/mail';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  w.player.hearts = startingHearts();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('mail catalog', () => {
  it('every (npc, tier) has a canned letter text', () => {
    for (const id of ['mayor', 'maple', 'finn', 'rose']) {
      for (const tier of LETTER_TIERS) {
        expect(LETTER_TEXT[`${id}-${tier}`]).toBeDefined();
        expect(LETTER_TEXT[`${id}-${tier}`].length).toBeGreaterThan(20);
      }
    }
  });

  it('makeLetter shapes a fresh unread letter', () => {
    const l = makeLetter('maple', 4, 12);
    expect(l.npcId).toBe('maple');
    expect(l.tier).toBe(4);
    expect(l.deliveredDay).toBe(12);
    expect(l.unread).toBe(true);
    expect(l.body.length).toBeGreaterThan(20);
  });
});

describe('mailbox + delivery', () => {
  it('emptyMailbox starts with no letters and no delivery history', () => {
    const m = emptyMailbox();
    expect(m.inbox).toEqual([]);
    expect(m.delivered).toEqual({});
  });

  it('getMailbox lazy-initialises the player mailbox', () => {
    const w = new World();
    const m = getMailbox(w.player);
    expect(m.inbox).toEqual([]);
    // Calling again returns the same object reference.
    expect(getMailbox(w.player)).toBe(m);
  });

  it('deliverDailyMail delivers a letter when hearts cross a tier', () => {
    const g = fakeGame();
    g.world.player.hearts!.maple.points = HEART_POINTS * 2; // exactly 2 hearts
    const n = deliverDailyMail(g.world.player, 3);
    expect(n).toBe(1);
    const mail = getMailbox(g.world.player);
    expect(mail.inbox.length).toBe(1);
    expect(mail.inbox[0].npcId).toBe('maple');
    expect(mail.inbox[0].tier).toBe(2);
  });

  it('deliverDailyMail does not deliver the same tier twice', () => {
    const g = fakeGame();
    g.world.player.hearts!.maple.points = HEART_POINTS * 2;
    deliverDailyMail(g.world.player, 3);
    const n = deliverDailyMail(g.world.player, 4);
    expect(n).toBe(0);
    expect(getMailbox(g.world.player).inbox.length).toBe(1);
  });

  it('crossing multiple tiers in one day delivers all the new ones', () => {
    const g = fakeGame();
    g.world.player.hearts!.maple.points = HEART_POINTS * 6;
    const n = deliverDailyMail(g.world.player, 3);
    expect(n).toBe(3); // tiers 2, 4, 6
  });

  it('letters are independent across NPCs', () => {
    const g = fakeGame();
    g.world.player.hearts!.maple.points = HEART_POINTS * 4;
    g.world.player.hearts!.finn.points = HEART_POINTS * 2;
    const n = deliverDailyMail(g.world.player, 1);
    expect(n).toBe(3); // maple-2 + maple-4 + finn-2
  });
});

describe('reading letters', () => {
  it('unreadCount tracks the unread queue', () => {
    const g = fakeGame();
    g.world.player.hearts!.maple.points = HEART_POINTS * 4;
    deliverDailyMail(g.world.player, 1);
    expect(unreadCount(g.world.player)).toBe(2);
    readNextLetter(g.world.player);
    expect(unreadCount(g.world.player)).toBe(1);
  });

  it('readNextLetter returns letters oldest-first and marks them read', () => {
    const g = fakeGame();
    g.world.player.hearts!.maple.points = HEART_POINTS * 4;
    deliverDailyMail(g.world.player, 1);
    const first = readNextLetter(g.world.player);
    expect(first?.tier).toBe(2);
    expect(first?.unread).toBe(false);
    const second = readNextLetter(g.world.player);
    expect(second?.tier).toBe(4);
    expect(readNextLetter(g.world.player)).toBeNull();
  });

  it('letterPreview clips long headers', () => {
    const l = makeLetter('maple', 2, 1);
    const preview = letterPreview(l);
    expect(preview.length).toBeLessThanOrEqual(40);
  });
});

describe('mail persistence', () => {
  it('inbox + delivered survive a snapshot round-trip', () => {
    const a = fakeGame();
    a.world.player.hearts!.maple.points = HEART_POINTS * 4;
    a.world.player.hearts!.finn.points = HEART_POINTS * 2;
    deliverDailyMail(a.world.player, 7);
    readNextLetter(a.world.player); // mark one read
    const snap = serializeGame(a);
    const b = fakeGame();
    applySnapshot(b, snap);
    const mail = getMailbox(b.world.player);
    expect(mail.inbox.length).toBe(3);
    expect(mail.inbox.filter((l) => l.unread).length).toBe(2);
    expect(mail.delivered.maple).toEqual([2, 4]);
    expect(mail.delivered.finn).toEqual([2]);
  });
});
