// Almanac empty-horizon look-ahead — peek past the 14-day window so an
// empty (filtered) agenda still names what's next.

import { describe, it, expect } from 'vitest';
import {
  almanacLookAhead,
  almanacLookAheadLine,
  applyAlmanacFilter,
  buildAlmanac,
  ALMANAC_HORIZON_DAYS,
  type AlmanacEntry,
} from '../src/game/almanac';
import { World, type Player } from '../src/world/world';
import type { TimeOfDay } from '../src/game/time';
import type { NPCInvite } from '../src/game/hangouts';

function t(season: number, day: number, hour = 9): TimeOfDay {
  return { season, day, hour, minute: 0 } as TimeOfDay;
}

/** Seed a single hangout invite onto the player. */
function withInvite(p: Player, season: 0 | 1 | 2 | 3, day: number): void {
  const iv: NPCInvite = {
    npcId: 'maple',
    season,
    day,
    x: 10,
    y: 10,
    flavor: '',
    postedDay: 0,
  };
  (p as Player & { npcInvites: NPCInvite[] }).npcInvites = [iv];
}

describe('almanacLookAhead', () => {
  it('returns only events strictly beyond the 14-day horizon', () => {
    // Scan every calendar slot; any look-ahead it returns must be past the
    // horizon, and must be the soonest such entry of its filter.
    for (let s = 0; s < 4; s++) {
      for (let d = 1; d <= 7; d++) {
        const time = t(s, d);
        const ahead = almanacLookAhead(time, 'all');
        if (ahead) {
          expect(ahead.daysUntil).toBeGreaterThan(ALMANAC_HORIZON_DAYS);
          // It is the FIRST past-horizon entry in the soonest-first list.
          const expected = buildAlmanac(time, 27).find(
            (e) => e.daysUntil > ALMANAC_HORIZON_DAYS,
          );
          expect(ahead).toEqual(expected);
        }
      }
    }
  });

  it('honours the active filter: a personal hangout past the horizon surfaces under personal', () => {
    const w = new World();
    // Place a hangout 15 days out (Fall day 2 from a Spring-day-1 vantage:
    // calIndex 15 vs 0), just beyond the 14-day window.
    withInvite(w.player, 2, 2);
    const time = t(0, 1);

    // The personal fortnight is empty (the hangout is >14 days out)...
    const personalInView = applyAlmanacFilter(
      buildAlmanac(time, ALMANAC_HORIZON_DAYS, w.player),
      'personal',
    );
    expect(personalInView.length).toBe(0);

    // ...but the look-ahead still finds it.
    const ahead = almanacLookAhead(time, 'personal', w.player);
    expect(ahead).not.toBeNull();
    expect(ahead?.kind).toBe('personal');
    expect(ahead?.daysUntil).toBeGreaterThan(ALMANAC_HORIZON_DAYS);
  });

  it('returns null when nothing of the filtered kind exists anywhere', () => {
    // No invites posted, so the personal filter has nothing in the whole
    // 28-day cycle.
    const w = new World();
    expect(almanacLookAhead(t(0, 1), 'personal', w.player)).toBeNull();
  });

  it('defaults to the all filter', () => {
    const time = t(0, 1);
    expect(almanacLookAhead(time)).toEqual(almanacLookAhead(time, 'all'));
  });
});

describe('almanacLookAheadLine', () => {
  const mk = (over: Partial<AlmanacEntry>): AlmanacEntry => ({
    daysUntil: 19,
    kind: 'birthday',
    title: "Maple's birthday",
    detail: '',
    season: 1,
    day: 5,
    ...over,
  });

  it('formats a "next: <title> in N days" caption', () => {
    expect(almanacLookAheadLine(mk({}))).toBe("next: Maple's birthday in 19 days");
  });

  it("returns '' for a null look-ahead", () => {
    expect(almanacLookAheadLine(null)).toBe('');
  });

  it('stays ASCII apart from the title text it echoes', () => {
    const line = almanacLookAheadLine(mk({ title: 'Harvest Festival', daysUntil: 16 }));
    expect(/^[\x20-\x7E]*$/.test(line)).toBe(true);
    expect(line).toBe('next: Harvest Festival in 16 days');
  });
});
