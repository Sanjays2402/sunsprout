// Almanac — a forward-looking schedule of village events, aggregated for
// the `0` planner panel. The game already scatters "what's coming up" across
// several systems (festivals, NPC birthdays, Pip's seasonal cart, the
// friendship tournament) but the player had no single place to see the
// next two weeks at a glance. This module pulls every dated event into one
// sorted list of "in N days" entries so the panel can render a clean agenda.
//
// Pure module: consumes the calendar helpers from each system and the
// current TimeOfDay. No canvas, no IO. The 28-day wrap (4 seasons x 7 days)
// mirrors the daysUntil math already used by birthdays.ts / festivals.ts.

import type { TimeOfDay } from './time';
import { SEASONS } from './time';
import { birthdayCalendar } from './birthdays';
import { festivalCalendar } from './festivals';
import { CART_VISIT_DAY } from './cart';
import { TOURNAMENT_DAY, TOURNAMENT_KINDS, TOURNAMENT_LABELS } from './tournament';

/** How many days ahead the almanac looks. Two full in-game weeks. */
export const ALMANAC_HORIZON_DAYS = 14;

export type AlmanacKind = 'festival' | 'birthday' | 'cart' | 'tournament';

export interface AlmanacEntry {
  /** Days from today; 0 = today, 1 = tomorrow, ... */
  daysUntil: number;
  /** Category, used for the panel's colour-coding + icon. */
  kind: AlmanacKind;
  /** Short headline, e.g. "Maple's birthday". */
  title: string;
  /** Optional second-line detail, e.g. "Gifts count 8x". */
  detail: string;
  /** Season index of the event date. */
  season: number;
  /** Day-of-season (1..7) of the event. */
  day: number;
}

/** Calendar index 0..27 for a (season, day-of-season) pair. */
function calIndex(season: number, day: number): number {
  return season * 7 + (day - 1);
}

/** Days from `time` until the next occurrence of (season, day). 0 = today. */
function daysUntil(time: TimeOfDay, season: number, day: number): number {
  const today = calIndex(time.season, time.day);
  const target = calIndex(season, day);
  return (target - today + 28) % 28;
}

/** Season + day for an offset of N days ahead of `time`. */
function dateInDays(time: TimeOfDay, n: number): { season: number; day: number } {
  const idx = (calIndex(time.season, time.day) + n) % 28;
  return { season: Math.floor(idx / 7), day: (idx % 7) + 1 };
}

/**
 * Every dated event within ALMANAC_HORIZON_DAYS of `time`, sorted by how
 * soon it arrives (today first), ties broken by a stable kind order so the
 * agenda reads consistently. Events are de-duplicated only within their own
 * system; two different systems landing on the same day each get a row.
 */
export function buildAlmanac(
  time: TimeOfDay,
  horizon: number = ALMANAC_HORIZON_DAYS,
): AlmanacEntry[] {
  const entries: AlmanacEntry[] = [];

  // Festivals (Spring d7 planting fair, Fall d7 harvest festival).
  for (const f of festivalCalendar(time)) {
    if (f.daysUntil > horizon) continue;
    entries.push({
      daysUntil: f.daysUntil,
      kind: 'festival',
      title: f.name,
      detail: f.season === 0 ? 'Seeds half-price' : 'Crops sell 1.5x',
      season: f.season,
      day: f.day,
    });
  }

  // NPC birthdays.
  for (const b of birthdayCalendar(time)) {
    if (b.daysUntil > horizon) continue;
    entries.push({
      daysUntil: b.daysUntil,
      kind: 'birthday',
      title: `${b.name}'s birthday`,
      detail: 'Gifts count 8x',
      season: b.season,
      day: b.day,
    });
  }

  // Pip's travelling cart — day 3 of every season.
  for (let s = 0; s < 4; s++) {
    const d = daysUntil(time, s, CART_VISIT_DAY);
    if (d > horizon) continue;
    entries.push({
      daysUntil: d,
      kind: 'cart',
      title: 'Pip the Peddler visits',
      detail: 'Rare seeds & curios, 9am-6pm',
      season: s,
      day: CART_VISIT_DAY,
    });
  }

  // Friendship tournament — day 6 of every season, kind rotates by season.
  for (let s = 0; s < 4; s++) {
    const d = daysUntil(time, s, TOURNAMENT_DAY);
    if (d > horizon) continue;
    const kind = TOURNAMENT_KINDS[s];
    entries.push({
      daysUntil: d,
      kind: 'tournament',
      title: TOURNAMENT_LABELS[kind],
      detail: 'Friendship contest at the well, 2-6pm',
      season: s,
      day: TOURNAMENT_DAY,
    });
  }

  const kindOrder: Record<AlmanacKind, number> = {
    festival: 0,
    tournament: 1,
    cart: 2,
    birthday: 3,
  };
  entries.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return kindOrder[a.kind] - kindOrder[b.kind];
  });
  return entries;
}

/** Human label for a daysUntil value: "Today", "Tomorrow", "in N days". */
export function whenLabel(daysUntil: number): string {
  if (daysUntil <= 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `in ${daysUntil} days`;
}

/** "Spring 7" style date stamp for an entry. */
export function dateLabel(season: number, day: number): string {
  return `${SEASONS[season] ?? '?'} ${day}`;
}

// Re-export for the panel + tests that want to project an arbitrary offset.
export { dateInDays };
