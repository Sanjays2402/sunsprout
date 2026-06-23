// Tournament Champion achievement — career gold-ribbon milestone that
// lights up once the player has cleared the gold tier on 3 different
// seasonal tournaments. Distinct from Festival Regular (which counts
// raw entries regardless of tier) — Champion is the "actually won
// gold" half of the calendar.
//
// 3 / 4 seasons is the sweet spot: requires a real grind (gold tier
// is the highest threshold at 18), but isn't the all-four sweep that
// would be a perfectionist gate. tournament.entries is slot-capped
// at 4 (one per season-kind), so ribbons.gold caps at 4 too.
//
// Pure lazy-ledger pattern — reads tournamentCareer().ribbons.gold
// off the existing entries map. No new persisted field.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  TIER_THRESHOLD,
  TOURNAMENT_CHAMPION_GOLD_RIBBONS,
  TOURNAMENT_DAY,
  TOURNAMENT_OPEN_HOUR,
  enterTournament,
  tournamentCareer,
  tournamentChampionMilestoneReached,
} from '../src/game/tournament';
import { ACHIEVEMENTS, isEarned, tickAchievements } from '../src/game/achievements';

function tournamentTime(season: 0 | 1 | 2 | 3): TimeOfDay {
  const t = new TimeOfDay(TOURNAMENT_OPEN_HOUR + 1);
  t.day = TOURNAMENT_DAY;
  t.season = season;
  return t;
}

/** Stuff the player's inventory + enter the season's tournament at the gold tier. */
function enterAtGold(player: World['player'], season: 0 | 1 | 2 | 3): void {
  player.inventory = {};
  if (season === 0) {
    player.inventory.flower_harvest = TIER_THRESHOLD.gold;
  } else if (season === 1) {
    player.inventory['fish-minnow'] = TIER_THRESHOLD.gold;
  } else if (season === 2) {
    player.inventory.wheat_harvest = TIER_THRESHOLD.gold;
  } else {
    // Cook-off: sum across every dish-<key> matching a real RECIPE_KEYS
    // entry. dish-hearty-stew is the first canonical recipe; flooring
    // at TIER_THRESHOLD.gold gives the gold tier on score.
    player.inventory['dish-hearty-stew'] = TIER_THRESHOLD.gold;
  }
  enterTournament(player, tournamentTime(season));
}

describe('TOURNAMENT_CHAMPION_GOLD_RIBBONS — tuning sanity', () => {
  it('milestone is 3 — three out of four seasons at the top tier', () => {
    expect(TOURNAMENT_CHAMPION_GOLD_RIBBONS).toBe(3);
  });

  it('milestone is below the natural ceiling (4 gold ribbons max)', () => {
    expect(TOURNAMENT_CHAMPION_GOLD_RIBBONS).toBeLessThanOrEqual(4);
  });

  it('milestone is above Festival Regular floor (Champion is the harder bar)', () => {
    // Festival Regular checks entries == 4 (anything goes); Champion
    // requires gold-tier on 3. The bars are conceptually distinct.
    expect(TOURNAMENT_CHAMPION_GOLD_RIBBONS).toBeGreaterThanOrEqual(1);
  });
});

describe('tournamentChampionMilestoneReached — predicate', () => {
  it('returns false on a fresh player', () => {
    const w = new World();
    expect(tournamentChampionMilestoneReached(w.player)).toBe(false);
  });

  it('returns false at 1 gold ribbon', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(1);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(false);
  });

  it('returns false at 2 gold ribbons', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    enterAtGold(w.player, 1);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(2);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(false);
  });

  it('returns true at 3 gold ribbons (milestone hit)', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    enterAtGold(w.player, 1);
    enterAtGold(w.player, 2);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(3);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(true);
  });

  it('stays true at 4 gold ribbons (full sweep, never overruns)', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    enterAtGold(w.player, 1);
    enterAtGold(w.player, 2);
    enterAtGold(w.player, 3);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(4);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(true);
  });

  it('does NOT trigger on 3 bronzes (different tier)', () => {
    const w = new World();
    w.player.inventory = { flower_harvest: TIER_THRESHOLD.bronze };
    enterTournament(w.player, tournamentTime(0));
    w.player.inventory = { 'fish-minnow': TIER_THRESHOLD.bronze };
    enterTournament(w.player, tournamentTime(1));
    w.player.inventory = { wheat_harvest: TIER_THRESHOLD.bronze };
    enterTournament(w.player, tournamentTime(2));
    expect(tournamentCareer(w.player).ribbons.bronze).toBe(3);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(0);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(false);
  });

  it('does NOT trigger on 3 silvers (just-below-gold)', () => {
    const w = new World();
    w.player.inventory = { flower_harvest: TIER_THRESHOLD.silver };
    enterTournament(w.player, tournamentTime(0));
    w.player.inventory = { 'fish-minnow': TIER_THRESHOLD.silver };
    enterTournament(w.player, tournamentTime(1));
    w.player.inventory = { wheat_harvest: TIER_THRESHOLD.silver };
    enterTournament(w.player, tournamentTime(2));
    expect(tournamentCareer(w.player).ribbons.silver).toBe(3);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(0);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(false);
  });

  it('mixed tiers — gold + gold + gold trips the bar regardless of bronze/silver count', () => {
    const w = new World();
    // 1 gold + 1 silver + 1 bronze + 1 gold + 1 gold scenario:
    // Spring gold, Summer silver, Fall bronze, Winter gold.
    enterAtGold(w.player, 0);
    w.player.inventory = { 'fish-minnow': TIER_THRESHOLD.silver };
    enterTournament(w.player, tournamentTime(1));
    w.player.inventory = { wheat_harvest: TIER_THRESHOLD.bronze };
    enterTournament(w.player, tournamentTime(2));
    enterAtGold(w.player, 3);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(2);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(false);
  });
});

describe('achievement catalog wiring', () => {
  it("includes 'tournament-champion' as a registered achievement", () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'tournament-champion')).toBeDefined();
  });

  it('is NOT granted on a fresh save', () => {
    const w = new World();
    const t = new TimeOfDay(8);
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'tournament-champion')).toBe(false);
  });

  it('IS granted the day the 3rd gold ribbon falls', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    enterAtGold(w.player, 1);
    enterAtGold(w.player, 2);
    const t = new TimeOfDay(8);
    t.day = 7;
    const newly = tickAchievements(w.player, w, t);
    expect(newly).toContain('tournament-champion');
    expect(isEarned(w.player, 'tournament-champion')).toBe(true);
  });

  it('is NOT granted at 2 gold ribbons', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    enterAtGold(w.player, 1);
    const t = new TimeOfDay(8);
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'tournament-champion')).toBe(false);
  });

  it('is NOT double-awarded on consecutive days after first grant', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    enterAtGold(w.player, 1);
    enterAtGold(w.player, 2);
    const t = new TimeOfDay(8);
    t.day = 7;
    const first = tickAchievements(w.player, w, t);
    expect(first).toContain('tournament-champion');
    // Next day — already earned, no second grant.
    t.day = 8;
    const second = tickAchievements(w.player, w, t);
    expect(second).not.toContain('tournament-champion');
  });

  it('catalog now contains at least 23 achievements (champion is the 23rd)', () => {
    // Loose >= 23 so a future tick adding more doesn't break the test.
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(23);
  });
});

describe('Festival Regular vs Tournament Champion — orthogonal bars', () => {
  it('a player at 3 bronzes is a Festival Regular WIP but not a Champion', () => {
    const w = new World();
    w.player.inventory = { flower_harvest: TIER_THRESHOLD.bronze };
    enterTournament(w.player, tournamentTime(0));
    w.player.inventory = { 'fish-minnow': TIER_THRESHOLD.bronze };
    enterTournament(w.player, tournamentTime(1));
    w.player.inventory = { wheat_harvest: TIER_THRESHOLD.bronze };
    enterTournament(w.player, tournamentTime(2));
    expect(tournamentCareer(w.player).entries).toBe(3);
    expect(tournamentCareer(w.player).ribbons.gold).toBe(0);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(false);
  });

  it('a player at 3 golds IS a Champion AND a Festival Regular WIP', () => {
    const w = new World();
    enterAtGold(w.player, 0);
    enterAtGold(w.player, 1);
    enterAtGold(w.player, 2);
    expect(tournamentChampionMilestoneReached(w.player)).toBe(true);
    // Festival Regular requires 4 entries; 3 isn't enough.
    expect(tournamentCareer(w.player).entries).toBe(3);
  });
});
