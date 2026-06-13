// Festival Days — one festival per season on the last day of the season.
//
// Each season's day 7 is a festival day. During a festival, certain
// activities earn a gold bonus: Spring rewards planting, Summer rewards
// fishing, Fall rewards harvesting, and Winter rewards gifting (hearts).
//
// `getFestival(day, season)` is the single query point; everything else
// in the codebase calls it. It returns `null` on non-festival days.

import { SEASON_LENGTH } from './time';

export type FestivalKind =
  | 'spring-planting'
  | 'summer-fishing'
  | 'fall-harvest'
  | 'winter-star';

export interface Festival {
  kind: FestivalKind;
  name: string;
  subtitle: string;
  /** Gold bonus applied to each qualifying action during the festival. */
  activityBonus: number;
  /** Which activity type earns the bonus. */
  bonusActivity: 'plant' | 'fish' | 'harvest' | 'gift';
  /** HUD badge colour (CSS colour string). */
  color: string;
}

/** One festival per season, firing on the last day of that season. */
const FESTIVALS: Record<number, Festival> = {
  0: {
    kind: 'spring-planting',
    name: 'Spring Planting Festival',
    subtitle: 'Every seed sown today earns a blessing.',
    activityBonus: 5,
    bonusActivity: 'plant',
    color: '#8BC48A',
  },
  1: {
    kind: 'summer-fishing',
    name: 'Summer Fishing Tournament',
    subtitle: 'The pond gives its finest catch to the boldest rod.',
    activityBonus: 20,
    bonusActivity: 'fish',
    color: '#7BB3DA',
  },
  2: {
    kind: 'fall-harvest',
    name: 'Autumn Harvest Fair',
    subtitle: 'Crops sell for extra gold at today\'s fair.',
    activityBonus: 10,
    bonusActivity: 'harvest',
    color: '#E0A050',
  },
  3: {
    kind: 'winter-star',
    name: 'Winter Star Night',
    subtitle: 'Gifts warm hearts a little more under the starlit sky.',
    activityBonus: 1, // +1 extra heart on each gift this day
    bonusActivity: 'gift',
    color: '#C8B4E8',
  },
};

/**
 * Returns the Festival for the given (day, season) pair, or `null` if it is
 * not a festival day. Festivals fire on `SEASON_LENGTH` (the last day of
 * each season).
 */
export function getFestival(day: number, season: 0 | 1 | 2 | 3): Festival | null {
  if (day !== SEASON_LENGTH) return null;
  return FESTIVALS[season] ?? null;
}

/** Convenience: true when (day, season) falls on any festival. */
export function isFestivalDay(day: number, season: 0 | 1 | 2 | 3): boolean {
  return getFestival(day, season) !== null;
}

/**
 * Returns the gold bonus that should be applied when the player performs
 * `activity` on the current festival day, or 0 when there is no bonus.
 * For the 'gift' festival the returned number is extra hearts, not gold.
 */
export function festivalActivityBonus(
  festival: Festival | null,
  activity: Festival['bonusActivity'],
): number {
  if (!festival) return 0;
  if (festival.bonusActivity !== activity) return 0;
  return festival.activityBonus;
}
