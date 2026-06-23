// Festival Regular achievement — career-entries milestone keyed off the
// tournamentCareer().entries aggregate. Lights up once the player has
// entered each of the four seasonal tournaments at least once. Lazy-
// ledger style: no new persisted counter, predicate reads the existing
// entries map.
//
// 4 entries = full calendar of festival attendance: Spring flower-show,
// Summer fishing-derby, Fall harvest-weigh-in, Winter cook-off. The
// entries map is keyed by `${season}-${kind}` so it caps at 4 unique
// keys across the entire save (enterTournament returns 'already-
// entered' on a re-press in the same slot, even on year 2).

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  FESTIVAL_REGULAR_MILESTONE,
  TIER_THRESHOLD,
  TOURNAMENT_DAY,
  TOURNAMENT_OPEN_HOUR,
  enterTournament,
  festivalRegularMilestoneReached,
  tournamentCareer,
} from '../src/game/tournament';
import { ACHIEVEMENTS, tickAchievements } from '../src/game/achievements';

function tournamentTime(season: 0 | 1 | 2 | 3): TimeOfDay {
  const t = new TimeOfDay(TOURNAMENT_OPEN_HOUR + 1);
  t.day = TOURNAMENT_DAY;
  t.season = season;
  return t;
}

function enterAllFourSeasons(player: World['player']): void {
  // Spring: flower-show, threshold-bronze tier.
  player.inventory = {};
  player.inventory.flower_harvest = TIER_THRESHOLD.bronze;
  enterTournament(player, tournamentTime(0));
  // Summer: fishing-derby.
  player.inventory = {};
  player.inventory['fish-minnow'] = TIER_THRESHOLD.bronze;
  enterTournament(player, tournamentTime(1));
  // Fall: harvest-weigh-in.
  player.inventory = {};
  player.inventory.wheat_harvest = TIER_THRESHOLD.bronze;
  enterTournament(player, tournamentTime(2));
  // Winter: cook-off.
  player.inventory = {};
  player.inventory['dish-omelet'] = TIER_THRESHOLD.bronze;
  enterTournament(player, tournamentTime(3));
}

describe('FESTIVAL_REGULAR_MILESTONE — tuning sanity', () => {
  it('milestone equals 4 — the full calendar of seasonal tournaments', () => {
    expect(FESTIVAL_REGULAR_MILESTONE).toBe(4);
  });

  it('milestone fits the natural entries map ceiling (4 unique season-kind keys)', () => {
    // The tournament entries map is keyed by `${season}-${kind}` and
    // enterTournament locks out a second entry in the same slot. A
    // milestone above 4 would be unreachable.
    expect(FESTIVAL_REGULAR_MILESTONE).toBeLessThanOrEqual(4);
  });
});

describe('festivalRegularMilestoneReached — predicate', () => {
  it('returns false on a fresh player', () => {
    const w = new World();
    expect(festivalRegularMilestoneReached(w.player)).toBe(false);
  });

  it('returns false at 1 entry', () => {
    const w = new World();
    w.player.inventory.flower_harvest = TIER_THRESHOLD.bronze;
    enterTournament(w.player, tournamentTime(0));
    expect(tournamentCareer(w.player).entries).toBe(1);
    expect(festivalRegularMilestoneReached(w.player)).toBe(false);
  });

  it('returns false at 3 entries (one season short)', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory.flower_harvest = TIER_THRESHOLD.bronze;
    enterTournament(w.player, tournamentTime(0));
    w.player.inventory = {};
    w.player.inventory['fish-minnow'] = TIER_THRESHOLD.bronze;
    enterTournament(w.player, tournamentTime(1));
    w.player.inventory = {};
    w.player.inventory.wheat_harvest = TIER_THRESHOLD.bronze;
    enterTournament(w.player, tournamentTime(2));
    expect(tournamentCareer(w.player).entries).toBe(3);
    expect(festivalRegularMilestoneReached(w.player)).toBe(false);
  });

  it('returns true at exactly 4 entries (full season cycle)', () => {
    const w = new World();
    enterAllFourSeasons(w.player);
    expect(tournamentCareer(w.player).entries).toBe(FESTIVAL_REGULAR_MILESTONE);
    expect(festivalRegularMilestoneReached(w.player)).toBe(true);
  });

  it('lights up even when all entries were no-prize (zero-score entries count)', () => {
    const w = new World();
    // Enter every season with an empty bag — all entries are
    // 'entered-no-prize' but tournamentCareer.entries still counts them.
    for (const season of [0, 1, 2, 3] as const) {
      enterTournament(w.player, tournamentTime(season));
    }
    expect(festivalRegularMilestoneReached(w.player)).toBe(true);
  });
});

describe('festival-regular achievement — catalog wiring', () => {
  it('catalog includes a festival-regular row', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'festival-regular');
    expect(def).toBeDefined();
    expect(def?.name).toBe('Festival Regular');
  });

  it('catalog has grown to at least 22 badges this tick', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(22);
  });

  it('hint references the milestone count', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'festival-regular')!;
    expect(def.hint).toContain(String(FESTIVAL_REGULAR_MILESTONE));
  });

  it('tickAchievements grants the badge once the 4-entry cycle is complete', () => {
    const w = new World();
    enterAllFourSeasons(w.player);
    const t = new TimeOfDay(8);
    const earned = tickAchievements(w.player, w, t);
    expect(earned).toContain('festival-regular');
  });

  it('tickAchievements does NOT grant the badge at 3 entries', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory.flower_harvest = TIER_THRESHOLD.bronze;
    enterTournament(w.player, tournamentTime(0));
    w.player.inventory = {};
    w.player.inventory['fish-minnow'] = TIER_THRESHOLD.bronze;
    enterTournament(w.player, tournamentTime(1));
    w.player.inventory = {};
    w.player.inventory.wheat_harvest = TIER_THRESHOLD.bronze;
    enterTournament(w.player, tournamentTime(2));
    const t = new TimeOfDay(8);
    const earned = tickAchievements(w.player, w, t);
    expect(earned).not.toContain('festival-regular');
  });

  it('grants only once across multiple tickAchievements calls', () => {
    const w = new World();
    enterAllFourSeasons(w.player);
    const t = new TimeOfDay(8);
    const earned1 = tickAchievements(w.player, w, t);
    expect(earned1).toContain('festival-regular');
    const earned2 = tickAchievements(w.player, w, t);
    expect(earned2).not.toContain('festival-regular');
  });
});
