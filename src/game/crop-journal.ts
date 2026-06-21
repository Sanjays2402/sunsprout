// Crop journal — a per-crop lifetime tally + the data underneath the `;`
// panel. The journal records:
//
//   - sown   : total seeds planted (across all qualities)
//   - harvested by tier (normal / silver / gold)
//   - best streak : longest watered-day streak ever achieved
//
// Everything here is pure. The Game wires plant() / harvest() through
// recordSown() and recordHarvest() so the counters tick in lock-step
// with the gameplay loop. Persistence is handled in persistence.ts.

import type { Player } from '../world/world';
import { CROPS, CROP_KEYS } from './crops';
import type { CropQuality } from './crop-quality';
import { festivalCalendar } from './festivals';
import type { TimeOfDay } from './time';

/** Per-crop running totals. */
export interface CropJournalRow {
  sown: number;
  normal: number;
  silver: number;
  gold: number;
  bestStreak: number;
  /**
   * Heaviest single-day harvest count for this crop across the run.
   * Bumped at every recordHarvest call when today's running tally
   * exceeds the previous record. The `ribbonDay` field tags which
   * (season,day) earned the ribbon so the journal can flavour it.
   */
  bestDayHarvest?: number;
  ribbonSeason?: number;
  ribbonDay?: number;
  /** Internal running tally for the current in-game day. */
  todayHarvest?: number;
  todayKey?: string;
}

/** Journal map keyed by crop key (wheat / tomato / pumpkin / flower). */
export type CropJournal = Record<string, CropJournalRow>;

/** Lazy accessor — creates a fresh empty entry on first read. */
export function getJournal(player: Player): CropJournal {
  const p = player as Player & { cropJournal?: CropJournal };
  if (!p.cropJournal) p.cropJournal = {};
  return p.cropJournal;
}

function row(journal: CropJournal, cropKey: string): CropJournalRow {
  if (!journal[cropKey]) {
    journal[cropKey] = { sown: 0, normal: 0, silver: 0, gold: 0, bestStreak: 0 };
  }
  return journal[cropKey];
}

/** Increment the sown counter for a crop. */
export function recordSown(player: Player, cropKey: string): void {
  if (!CROPS[cropKey]) return;
  const r = row(getJournal(player), cropKey);
  r.sown += 1;
}

/**
 * Increment the right harvest bucket. Optionally pass the water-streak
 * the crop had at harvest time so we can update the best-streak record.
 *
 * Pass `time` (as `{ season, day }`) so we can attribute today's harvest
 * to a single calendar day and update the per-crop ribbon (heaviest
 * single-day yield ever). Calls without a time field still work — the
 * ribbon just won't be touched.
 */
export function recordHarvest(
  player: Player,
  cropKey: string,
  quality: CropQuality,
  streak: number = 0,
  time?: { season: number; day: number },
): void {
  if (!CROPS[cropKey]) return;
  const r = row(getJournal(player), cropKey);
  if (quality === 'gold') r.gold += 1;
  else if (quality === 'silver') r.silver += 1;
  else r.normal += 1;
  if (streak > r.bestStreak) r.bestStreak = streak;
  if (time) {
    const key = `${time.season}:${time.day}`;
    if (r.todayKey !== key) {
      r.todayKey = key;
      r.todayHarvest = 0;
    }
    r.todayHarvest = (r.todayHarvest ?? 0) + 1;
    if ((r.todayHarvest ?? 0) > (r.bestDayHarvest ?? 0)) {
      r.bestDayHarvest = r.todayHarvest;
      r.ribbonSeason = time.season;
      r.ribbonDay = time.day;
    }
  }
}

/** Total harvest count (all tiers) for a crop. */
export function totalHarvest(row: CropJournalRow): number {
  return row.normal + row.silver + row.gold;
}

/** "Best season" advice for a crop — purely lore right now (all crops can
 *  grow year-round in v0.x), but tied to the catalog so future season
 *  gating drops in cleanly. */
const BEST_SEASON_HINT: Record<string, string> = {
  wheat: 'Spring',
  tomato: 'Summer',
  pumpkin: 'Fall',
  flower: 'any',
};

export function bestSeasonHint(cropKey: string): string {
  return BEST_SEASON_HINT[cropKey] ?? 'any';
}

/** Pure summary row for the journal panel + unit tests. */
export interface CropJournalEntry {
  key: string;
  name: string;
  seedPrice: number;
  sellPrice: number;
  growthDays: number;
  bestSeason: string;
  sown: number;
  normal: number;
  silver: number;
  gold: number;
  bestStreak: number;
  /** Heaviest single-day harvest count this crop ever produced. 0 when none. */
  ribbonCount: number;
  /** Human-readable label for the ribbon day, e.g. "Fall d4" or undefined. */
  ribbonWhen?: string;
}

/** Season-index → short two-letter label used for ribbons + festivals. */
const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** Format a (season, day) record as "Fall d4" / "Spring d1". */
export function formatRibbonWhen(season: number | undefined, day: number | undefined): string | undefined {
  if (season === undefined || day === undefined) return undefined;
  const name = SEASON_NAMES[Math.abs(season) % 4] ?? 'Spring';
  return `${name} d${day}`;
}

/** Snapshot every crop with current catalog + journal data. */
export function buildJournal(player: Player): CropJournalEntry[] {
  const j = getJournal(player);
  return CROP_KEYS.map((key) => {
    const crop = CROPS[key];
    const r = j[key] ?? { sown: 0, normal: 0, silver: 0, gold: 0, bestStreak: 0 };
    // Total days to reach harvest = stages * daysPerStage (each watered day = one stage step).
    return {
      key,
      name: crop.name,
      seedPrice: crop.seedPrice,
      sellPrice: crop.sellPrice,
      growthDays: (crop.growthStages - 1) * crop.daysPerStage,
      bestSeason: bestSeasonHint(key),
      sown: r.sown,
      normal: r.normal,
      silver: r.silver,
      gold: r.gold,
      bestStreak: r.bestStreak,
      ribbonCount: r.bestDayHarvest ?? 0,
      ribbonWhen: formatRibbonWhen(r.ribbonSeason, r.ribbonDay),
    };
  });
}

/** Festival forecast tucked at the bottom of the journal. */
export function nextFestivals(time: TimeOfDay, count: number = 2): string[] {
  return festivalCalendar(time)
    .slice(0, count)
    .map((f) => `${f.name}: ${f.daysUntil === 0 ? 'today' : `${f.daysUntil}d`}`);
}
