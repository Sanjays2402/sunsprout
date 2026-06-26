// Almanac personal events — the player's own NPC hangout dates folded
// into the village planner.

import { describe, it, expect } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import { buildAlmanac, almanacHighlight } from '../src/game/almanac';
import { getInvites, type NPCInvite } from '../src/game/hangouts';
import type { Player } from '../src/world/world';

function clockAt(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = day;
  return t;
}

function mkPlayer(): Player {
  return { inventory: {}, gold: 0 } as unknown as Player;
}

/** Push a hangout invite onto a player for a (season, day). */
function addInvite(player: Player, npcId: string, season: 0 | 1 | 2 | 3, day: number): void {
  const iv: NPCInvite = {
    npcId,
    season,
    day,
    x: 19,
    y: 7,
    flavor: 'test',
    postedDay: 1,
  };
  getInvites(player).push(iv);
}

describe('buildAlmanac — personal events', () => {
  it('adds no personal rows when no player is supplied (back-compat)', () => {
    const list = buildAlmanac(clockAt(0, 1));
    expect(list.every((e) => e.kind !== 'personal')).toBe(true);
  });

  it('adds no personal rows when the player has no invites', () => {
    const list = buildAlmanac(clockAt(0, 1), undefined, mkPlayer());
    expect(list.every((e) => e.kind !== 'personal')).toBe(true);
  });

  it('surfaces a pending hangout as a personal entry within the horizon', () => {
    const player = mkPlayer();
    // Spring d1 -> a hangout on Spring d4 is +3 days.
    addInvite(player, 'mayor', 0, 4);
    const list = buildAlmanac(clockAt(0, 1), undefined, player);
    const personal = list.filter((e) => e.kind === 'personal');
    expect(personal).toHaveLength(1);
    expect(personal[0].daysUntil).toBe(3);
    expect(personal[0].title).toMatch(/hangout/i);
    expect(personal[0].title).toMatch(/bramble/i); // mayor's pretty name
  });

  it('drops a hangout beyond the 14-day horizon', () => {
    const player = mkPlayer();
    // Spring d1 (index 0) -> Fall d2 (index 15) is 15 days out, past 14.
    addInvite(player, 'maple', 2, 2);
    const list = buildAlmanac(clockAt(0, 1), 14, player);
    expect(list.every((e) => e.kind !== 'personal')).toBe(true);
  });

  it('sorts a same-day personal commitment ahead of a village event', () => {
    const player = mkPlayer();
    // Spring d3 is cart day (+2). Put a hangout on the same day.
    addInvite(player, 'finn', 0, 3);
    const list = buildAlmanac(clockAt(0, 1), undefined, player);
    const sameDay = list.filter((e) => e.daysUntil === 2);
    // Personal sorts first within a day-tie (it's the player's own deadline).
    expect(sameDay[0].kind).toBe('personal');
  });

  it('keeps the soonest-first ordering with personal rows mixed in', () => {
    const player = mkPlayer();
    addInvite(player, 'rose', 0, 5);
    const list = buildAlmanac(clockAt(0, 1), undefined, player);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].daysUntil).toBeGreaterThanOrEqual(list[i - 1].daysUntil);
    }
  });
});

describe('almanacHighlight — personal events', () => {
  it('promotes a tomorrow hangout to the HUD highlight', () => {
    const player = mkPlayer();
    // Spring d1 -> hangout tomorrow (d2).
    addInvite(player, 'mayor', 0, 2);
    const hit = almanacHighlight(clockAt(0, 1), 1, player);
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('personal');
    expect(hit!.daysUntil).toBe(1);
  });

  it('ignores personal events when no player is supplied', () => {
    // Without a player, the highlight only sees village events.
    const hit = almanacHighlight(clockAt(0, 1), 1);
    if (hit) expect(hit.kind).not.toBe('personal');
  });
});
