// Friendship tournament — kind rotation, scoring, ribbons, re-entry.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  RIBBONS,
  TIER_GOLD,
  TIER_THRESHOLD,
  TOURNAMENT_CLOSE_HOUR,
  TOURNAMENT_DAY,
  TOURNAMENT_KINDS,
  TOURNAMENT_OPEN_HOUR,
  alreadyEntered,
  enterTournament,
  getTournament,
  ribbonCounts,
  scoreFor,
  tierFor,
  tournamentDawnLine,
  tournamentKindToday,
  tournamentOpen,
} from '../src/game/tournament';

function freshWorld(): World {
  return new World();
}

function setTime(season: number, day: number, hour: number): TimeOfDay {
  const t = new TimeOfDay(hour);
  t.season = season as 0 | 1 | 2 | 3;
  t.day = day;
  return t;
}

describe('tournamentKindToday', () => {
  it('returns null off-day', () => {
    expect(tournamentKindToday(setTime(0, 1, 14))).toBeNull();
    expect(tournamentKindToday(setTime(0, 7, 14))).toBeNull();
  });

  it('returns the season-keyed kind on day 6', () => {
    expect(tournamentKindToday(setTime(0, TOURNAMENT_DAY, 14))).toBe(TOURNAMENT_KINDS[0]);
    expect(tournamentKindToday(setTime(1, TOURNAMENT_DAY, 14))).toBe(TOURNAMENT_KINDS[1]);
    expect(tournamentKindToday(setTime(2, TOURNAMENT_DAY, 14))).toBe(TOURNAMENT_KINDS[2]);
    expect(tournamentKindToday(setTime(3, TOURNAMENT_DAY, 14))).toBe(TOURNAMENT_KINDS[3]);
  });
});

describe('tournamentOpen', () => {
  it('is closed outside open hours', () => {
    expect(tournamentOpen(setTime(0, TOURNAMENT_DAY, TOURNAMENT_OPEN_HOUR - 1))).toBe(false);
    expect(tournamentOpen(setTime(0, TOURNAMENT_DAY, TOURNAMENT_CLOSE_HOUR))).toBe(false);
  });

  it('is open from open to close hour', () => {
    expect(tournamentOpen(setTime(0, TOURNAMENT_DAY, TOURNAMENT_OPEN_HOUR))).toBe(true);
    expect(tournamentOpen(setTime(0, TOURNAMENT_DAY, TOURNAMENT_CLOSE_HOUR - 1))).toBe(true);
  });

  it('is closed on non-tournament days even during open hours', () => {
    expect(tournamentOpen(setTime(0, 4, TOURNAMENT_OPEN_HOUR))).toBe(false);
  });
});

describe('scoreFor', () => {
  it('flower-show counts flower harvest tiers', () => {
    const w = freshWorld();
    w.player.inventory['flower_harvest'] = 4;
    w.player.inventory['flower_harvest_gold'] = 1;
    expect(scoreFor(w.player, 'flower-show')).toBe(5);
  });

  it('fishing-derby counts every fish key', () => {
    const w = freshWorld();
    w.player.inventory['fish-minnow'] = 3;
    w.player.inventory['fish-trout'] = 2;
    expect(scoreFor(w.player, 'fishing-derby')).toBe(5);
  });

  it('harvest-weigh-in sums every crop harvest across tiers', () => {
    const w = freshWorld();
    w.player.inventory['wheat_harvest'] = 10;
    w.player.inventory['pumpkin_harvest_silver'] = 2;
    expect(scoreFor(w.player, 'harvest-weigh-in')).toBe(12);
  });

  it('cook-off sums every dish key', () => {
    const w = freshWorld();
    w.player.inventory['dish-hearty-stew'] = 3;
    w.player.inventory['dish-berry-tart'] = 1;
    expect(scoreFor(w.player, 'cook-off')).toBe(4);
  });
});

describe('tierFor', () => {
  it('returns none below bronze threshold', () => {
    expect(tierFor(TIER_THRESHOLD.bronze - 1)).toBe('none');
  });

  it('climbs through bronze, silver, gold at the thresholds', () => {
    expect(tierFor(TIER_THRESHOLD.bronze)).toBe('bronze');
    expect(tierFor(TIER_THRESHOLD.silver)).toBe('silver');
    expect(tierFor(TIER_THRESHOLD.gold)).toBe('gold');
  });
});

describe('enterTournament', () => {
  it('rejects when not open', () => {
    const w = freshWorld();
    expect(enterTournament(w.player, setTime(0, 1, 14)).kind).toBe('not-open');
  });

  it('pays the bronze prize at exactly the bronze threshold', () => {
    const w = freshWorld();
    const t = setTime(0, TOURNAMENT_DAY, 14);
    w.player.inventory['flower_harvest'] = TIER_THRESHOLD.bronze;
    const goldBefore = w.player.gold;
    const out = enterTournament(w.player, t);
    expect(out.kind).toBe('won');
    expect((out as { tier: string }).tier).toBe('bronze');
    expect(w.player.gold).toBe(goldBefore + TIER_GOLD.bronze);
    expect(w.player.inventory[RIBBONS.bronze]).toBe(1);
  });

  it('pays the gold prize when the player crushes it', () => {
    const w = freshWorld();
    const t = setTime(2, TOURNAMENT_DAY, 15);
    w.player.inventory['wheat_harvest'] = TIER_THRESHOLD.gold + 5;
    const out = enterTournament(w.player, t);
    expect(out.kind).toBe('won');
    expect((out as { tier: string }).tier).toBe('gold');
    expect(w.player.inventory[RIBBONS.gold]).toBe(1);
  });

  it('records a "no prize" entry when the score is below bronze', () => {
    const w = freshWorld();
    const t = setTime(0, TOURNAMENT_DAY, 16);
    w.player.inventory['flower_harvest'] = 1;
    const out = enterTournament(w.player, t);
    expect(out.kind).toBe('entered-no-prize');
    expect((out as { score: number }).score).toBe(1);
    // No ribbon added.
    expect(ribbonCounts(w.player).bronze).toBe(0);
  });

  it('refuses re-entry the same season', () => {
    const w = freshWorld();
    const t = setTime(0, TOURNAMENT_DAY, 14);
    w.player.inventory['flower_harvest'] = TIER_THRESHOLD.silver;
    const out1 = enterTournament(w.player, t);
    expect(out1.kind).toBe('won');
    const out2 = enterTournament(w.player, t);
    expect(out2.kind).toBe('already-entered');
  });

  it('allows entry in a different season', () => {
    const w = freshWorld();
    const ta = setTime(0, TOURNAMENT_DAY, 14);
    w.player.inventory['flower_harvest'] = TIER_THRESHOLD.bronze;
    enterTournament(w.player, ta);
    const tb = setTime(1, TOURNAMENT_DAY, 14);
    w.player.inventory['fish-minnow'] = TIER_THRESHOLD.bronze;
    const out = enterTournament(w.player, tb);
    expect(out.kind).toBe('won');
  });
});

describe('alreadyEntered + state map', () => {
  it('alreadyEntered is false until the player enters', () => {
    const w = freshWorld();
    const t = setTime(0, TOURNAMENT_DAY, 14);
    expect(alreadyEntered(w.player, t)).toBe(false);
    w.player.inventory['flower_harvest'] = 5;
    enterTournament(w.player, t);
    expect(alreadyEntered(w.player, t)).toBe(true);
  });

  it('persists the (season, kind) entry on the player state', () => {
    const w = freshWorld();
    const t = setTime(1, TOURNAMENT_DAY, 14);
    w.player.inventory['fish-trout'] = 4;
    enterTournament(w.player, t);
    const entries = getTournament(w.player).entries;
    expect(Object.keys(entries).length).toBe(1);
  });
});

describe('tournamentDawnLine', () => {
  it('is null off-day', () => {
    expect(tournamentDawnLine(setTime(0, 1, 6))).toBeNull();
  });

  it('mentions the kind label and the open hours on tournament day', () => {
    const line = tournamentDawnLine(setTime(0, TOURNAMENT_DAY, 6))!;
    expect(line).toContain('Flower Show');
    expect(line).toContain(`${TOURNAMENT_OPEN_HOUR}`);
  });
});
