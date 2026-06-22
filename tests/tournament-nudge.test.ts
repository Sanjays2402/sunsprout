// Tournament personal-best + next-tier nudge — dawn-toast extension
// that pairs the existing "Today is the Spring Flower Show" line
// with the player's PB for that kind and what they'd need to clear
// the next tier with the items already in their bag.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  TIER_THRESHOLD,
  enterTournament,
  nextTierToClear,
  personalBestFor,
  scoreTodayFor,
  tournamentNudgeLine,
} from '../src/game/tournament';
import { TimeOfDay } from '../src/game/time';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function tournamentTime(season: 0 | 1 | 2 | 3, hour = 14): TimeOfDay {
  const t = new TimeOfDay();
  t.day = 6;
  t.season = season;
  t.hour = hour;
  t.minute = 0;
  return t;
}

describe('nextTierToClear — pure tier mapping', () => {
  it('returns bronze when score is below bronze threshold', () => {
    expect(nextTierToClear(0)).toEqual({ tier: 'bronze', threshold: TIER_THRESHOLD.bronze });
    expect(nextTierToClear(2)).toEqual({ tier: 'bronze', threshold: TIER_THRESHOLD.bronze });
  });

  it('returns silver after bronze, gold after silver', () => {
    expect(nextTierToClear(TIER_THRESHOLD.bronze)).toEqual({
      tier: 'silver',
      threshold: TIER_THRESHOLD.silver,
    });
    expect(nextTierToClear(TIER_THRESHOLD.silver)).toEqual({
      tier: 'gold',
      threshold: TIER_THRESHOLD.gold,
    });
  });

  it('returns null when already at or above gold', () => {
    expect(nextTierToClear(TIER_THRESHOLD.gold)).toBeNull();
    expect(nextTierToClear(50)).toBeNull();
  });
});

describe('personalBestFor — per-kind ribbon ledger', () => {
  it('returns 0 / none when never entered', () => {
    const w = freshWorld();
    expect(personalBestFor(w.player, 'flower-show')).toEqual({ score: 0, tier: 'none' });
  });

  it('captures the best score across multiple entries', () => {
    const w = freshWorld();
    w.player.inventory['flower_harvest'] = TIER_THRESHOLD.silver;
    const t1 = tournamentTime(0);
    enterTournament(w.player, t1);
    // Walk forward to a future Spring (season 0, day 6) for a second entry.
    const t2 = tournamentTime(0);
    // We need a NEW entry; simulate by clearing the entries[] for season 0:
    // easier path is to just inject a fake second entry via the public API
    // by advancing the season and reusing the same kind.
    // Here, simulate via two consecutive Spring-week years: change the
    // existing entry's score to less than next entry.
    w.player.inventory['flower_harvest'] = TIER_THRESHOLD.gold; // bigger bag
    // To get a second flower-show entry we'd need year 2; engine doesn't
    // track years, so we manually inject a second entries[] record
    // representing "the next Spring".
    const tournament = (w.player as any).tournament;
    tournament.entries['0-flower-show'].score = TIER_THRESHOLD.bronze;
    tournament.entries['fake-year2-flower-show'] = {
      day: 6,
      tier: 'gold',
      score: TIER_THRESHOLD.gold,
    };
    const pb = personalBestFor(w.player, 'flower-show');
    expect(pb.score).toBe(TIER_THRESHOLD.gold);
    expect(pb.tier).toBe('gold');
  });

  it('keys per-kind independently', () => {
    const w = freshWorld();
    // Simulate prior Spring flower show + Summer fishing derby entries.
    const tournament = (w.player as any).tournament ?? { entries: {} };
    tournament.entries = {
      '0-flower-show': { day: 6, tier: 'silver' as const, score: 12 },
      '1-fishing-derby': { day: 6, tier: 'bronze' as const, score: 4 },
    };
    (w.player as any).tournament = tournament;
    expect(personalBestFor(w.player, 'flower-show').score).toBe(12);
    expect(personalBestFor(w.player, 'fishing-derby').score).toBe(4);
    expect(personalBestFor(w.player, 'cook-off').score).toBe(0);
  });
});

describe('scoreTodayFor — wrapper around scoreFor', () => {
  it('returns 0 off a tournament day', () => {
    const w = freshWorld();
    const t = new TimeOfDay();
    t.day = 1; // not day 6
    t.season = 0;
    expect(scoreTodayFor(w.player, t)).toBe(0);
  });

  it('returns the actual count on tournament day', () => {
    const w = freshWorld();
    w.player.inventory['flower_harvest'] = 5;
    w.player.inventory['flower_harvest_gold'] = 2;
    expect(scoreTodayFor(w.player, tournamentTime(0))).toBe(7);
  });
});

describe('tournamentNudgeLine — dawn nudge', () => {
  it('returns empty off a tournament day', () => {
    const w = freshWorld();
    const t = new TimeOfDay();
    t.day = 1;
    t.season = 0;
    expect(tournamentNudgeLine(w.player, t)).toBe('');
  });

  it('mentions today carry, next tier, and "no PB yet" on first attempt', () => {
    const w = freshWorld();
    w.player.inventory['flower_harvest'] = 4;
    const line = tournamentNudgeLine(w.player, tournamentTime(0));
    expect(line).toContain('Carrying 4');
    expect(line).toContain('silver needs');
    expect(line).toContain(`${TIER_THRESHOLD.silver}`);
    expect(line).toContain('no PB');
  });

  it('mentions "Carrying nothing yet" + bronze target when bag is empty', () => {
    const w = freshWorld();
    const line = tournamentNudgeLine(w.player, tournamentTime(1));
    expect(line).toContain('Carrying nothing yet');
    expect(line).toContain('bronze needs');
    expect(line).toContain(`${TIER_THRESHOLD.bronze}`);
  });

  it('names the PB tier + score when one exists', () => {
    const w = freshWorld();
    const tournament: any = (w.player as any).tournament ?? { entries: {} };
    tournament.entries = {
      '0-flower-show': { day: 6, tier: 'silver' as const, score: 12 },
    };
    (w.player as any).tournament = tournament;
    w.player.inventory['flower_harvest'] = 8;
    const line = tournamentNudgeLine(w.player, tournamentTime(0));
    expect(line).toContain('silver at 12');
  });

  it('switches to "maxed" copy when carrying gold-tier already', () => {
    const w = freshWorld();
    w.player.inventory['flower_harvest'] = TIER_THRESHOLD.gold;
    const line = tournamentNudgeLine(w.player, tournamentTime(0));
    expect(line).toContain('maxed');
  });
});
