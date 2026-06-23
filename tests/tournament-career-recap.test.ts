// Tournament career recap — pulls the whole entries[] map down into a
// one-line "what have I done across the save" recap that pairs with
// the existing tournamentNudgeLine on the dawn-toast. Empty on non-
// tournament days; on tournament dawn it surfaces a positive on-ramp
// for first-timers and a gold/silver/bronze tally + best-ever score
// for returning competitors.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  TIER_GOLD,
  TIER_THRESHOLD,
  TOURNAMENT_DAY,
  TOURNAMENT_LABELS,
  TOURNAMENT_OPEN_HOUR,
  enterTournament,
  getTournament,
  tournamentCareer,
  tournamentCareerLine,
  tournamentNudgeWithCareer,
} from '../src/game/tournament';

function tournamentTime(season: 0 | 1 | 2 | 3): TimeOfDay {
  // The tournament fires on day 6 between 14-18h. Build a TimeOfDay
  // pointing right inside that window.
  const t = new TimeOfDay(TOURNAMENT_OPEN_HOUR + 1);
  t.day = TOURNAMENT_DAY;
  t.season = season;
  return t;
}

function stockFor(player: World['player'], kind: 'flower-show' | 'fishing-derby' | 'harvest-weigh-in' | 'cook-off', count: number) {
  if (kind === 'flower-show') {
    player.inventory.flower_harvest = (player.inventory.flower_harvest ?? 0) + count;
  } else if (kind === 'fishing-derby') {
    player.inventory['fish-minnow'] = (player.inventory['fish-minnow'] ?? 0) + count;
  } else if (kind === 'harvest-weigh-in') {
    player.inventory.wheat_harvest = (player.inventory.wheat_harvest ?? 0) + count;
  } else if (kind === 'cook-off') {
    player.inventory['dish-omelet'] = (player.inventory['dish-omelet'] ?? 0) + count;
  }
}

describe('tournamentCareer — aggregate', () => {
  it('returns empty stats on a fresh player', () => {
    const w = new World();
    const career = tournamentCareer(w.player);
    expect(career.entries).toBe(0);
    expect(career.ribbons.bronze).toBe(0);
    expect(career.ribbons.silver).toBe(0);
    expect(career.ribbons.gold).toBe(0);
    expect(career.bestScore).toBeNull();
    expect(career.bestKind).toBeNull();
  });

  it('counts a single bronze entry', () => {
    const w = new World();
    const t = tournamentTime(0); // spring -> flower-show
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.bronze);
    enterTournament(w.player, t);
    const career = tournamentCareer(w.player);
    expect(career.entries).toBe(1);
    expect(career.ribbons.bronze).toBe(1);
    expect(career.ribbons.silver).toBe(0);
    expect(career.bestScore).toBe(TIER_THRESHOLD.bronze);
    expect(career.bestKind).toBe('flower-show');
  });

  it('separates ribbon counts by tier across multiple seasons', () => {
    const w = new World();
    // Spring: flower-show, gold tier.
    w.player.inventory = {};
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.gold);
    enterTournament(w.player, tournamentTime(0));
    // Summer: fishing-derby, silver tier. Clear bag first so flower-show
    // bonus doesn't leak (fishing-derby reads fish-* only so this is
    // belt-and-suspenders).
    w.player.inventory = {};
    stockFor(w.player, 'fishing-derby', TIER_THRESHOLD.silver);
    enterTournament(w.player, tournamentTime(1));
    // Fall: harvest, bronze. harvest-weigh-in counts every _harvest so
    // we must clear the flower_harvest piled in by the spring stock.
    w.player.inventory = {};
    stockFor(w.player, 'harvest-weigh-in', TIER_THRESHOLD.bronze);
    enterTournament(w.player, tournamentTime(2));
    const career = tournamentCareer(w.player);
    expect(career.entries).toBe(3);
    expect(career.ribbons.gold).toBe(1);
    expect(career.ribbons.silver).toBe(1);
    expect(career.ribbons.bronze).toBe(1);
  });

  it('tracks the highest score across all kinds + names its kind', () => {
    const w = new World();
    w.player.inventory = {};
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.bronze);
    enterTournament(w.player, tournamentTime(0));
    w.player.inventory = {};
    stockFor(w.player, 'fishing-derby', TIER_THRESHOLD.gold + 5);
    enterTournament(w.player, tournamentTime(1));
    const career = tournamentCareer(w.player);
    expect(career.bestScore).toBe(TIER_THRESHOLD.gold + 5);
    expect(career.bestKind).toBe('fishing-derby');
  });

  it('counts a no-prize entry but skips the ribbon tally', () => {
    const w = new World();
    // 0 flowers, 0 score, no ribbon.
    enterTournament(w.player, tournamentTime(0));
    const career = tournamentCareer(w.player);
    expect(career.entries).toBe(1);
    expect(career.ribbons.bronze).toBe(0);
    expect(career.bestScore).toBe(0);
    // bestKind tracks the kind regardless of prize — it's the entry's
    // score that won. Score 0 still wins by default since it's the
    // only entry on record.
    expect(career.bestKind).toBe('flower-show');
  });
});

describe('tournamentCareerLine — wording', () => {
  it('returns the first-entry prompt when zero entries', () => {
    const w = new World();
    const line = tournamentCareerLine(w.player);
    expect(line).toContain('first entry');
    expect(line).toContain('bronze');
  });

  it('uses singular "entry" for 1 entry', () => {
    const w = new World();
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.bronze);
    enterTournament(w.player, tournamentTime(0));
    const line = tournamentCareerLine(w.player);
    expect(line).toContain('1 entry');
    expect(line).not.toContain('1 entries');
  });

  it('uses plural "entries" for 2+ entries', () => {
    const w = new World();
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.bronze);
    enterTournament(w.player, tournamentTime(0));
    stockFor(w.player, 'fishing-derby', TIER_THRESHOLD.silver);
    enterTournament(w.player, tournamentTime(1));
    const line = tournamentCareerLine(w.player);
    expect(line).toContain('2 entries');
  });

  it('skips a zero-count tier in the gold/silver/bronze list', () => {
    const w = new World();
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.gold);
    enterTournament(w.player, tournamentTime(0));
    const line = tournamentCareerLine(w.player);
    expect(line).toContain('1 gold');
    expect(line).not.toContain('0 silver');
    expect(line).not.toContain('0 bronze');
  });

  it('surfaces "no ribbons yet" when player has only no-prize entries', () => {
    const w = new World();
    enterTournament(w.player, tournamentTime(0));
    const line = tournamentCareerLine(w.player);
    expect(line).toContain('no ribbons yet');
  });

  it('names the best-ever score AND the kind label', () => {
    const w = new World();
    stockFor(w.player, 'fishing-derby', TIER_THRESHOLD.silver);
    enterTournament(w.player, tournamentTime(1));
    const line = tournamentCareerLine(w.player);
    expect(line).toContain(`Best: ${TIER_THRESHOLD.silver}`);
    expect(line).toContain(TOURNAMENT_LABELS['fishing-derby']);
  });
});

describe('tournamentNudgeWithCareer — composition', () => {
  it('returns empty on a NON-tournament day', () => {
    const w = new World();
    const t = new TimeOfDay(3); // not the tournament day
    expect(tournamentNudgeWithCareer(w.player, t)).toBe('');
  });

  it('returns nudge + career on a tournament day', () => {
    const w = new World();
    // Earn one bronze first so the career tail has real content.
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.bronze);
    enterTournament(w.player, tournamentTime(0));
    const line = tournamentNudgeWithCareer(w.player, tournamentTime(0));
    expect(line).toContain('Carrying');
    expect(line).toContain('Career');
  });

  it('first-time player sees nudge + the first-entry prompt', () => {
    const w = new World();
    const line = tournamentNudgeWithCareer(w.player, tournamentTime(0));
    expect(line).toContain('Carrying');
    expect(line).toContain('first entry');
  });
});

describe('tournamentCareer — gold credit untouched', () => {
  it('does not double-pay gold on a re-read', () => {
    const w = new World();
    stockFor(w.player, 'flower-show', TIER_THRESHOLD.bronze);
    const goldBefore = w.player.gold;
    enterTournament(w.player, tournamentTime(0));
    const goldAfter = w.player.gold;
    expect(goldAfter - goldBefore).toBe(TIER_GOLD.bronze);
    // Read the career multiple times — should not touch player gold.
    tournamentCareer(w.player);
    tournamentCareerLine(w.player);
    tournamentNudgeWithCareer(w.player, tournamentTime(0));
    expect(w.player.gold).toBe(goldAfter);
  });

  it('career.entries matches the entries map length verbatim', () => {
    const w = new World();
    stockFor(w.player, 'flower-show', 1);
    enterTournament(w.player, tournamentTime(0));
    stockFor(w.player, 'fishing-derby', 5);
    enterTournament(w.player, tournamentTime(1));
    const career = tournamentCareer(w.player);
    expect(career.entries).toBe(Object.keys(getTournament(w.player).entries).length);
  });
});
