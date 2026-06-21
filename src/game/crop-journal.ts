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
 */
export function recordHarvest(
  player: Player,
  cropKey: string,
  quality: CropQuality,
  streak: number = 0,
): void {
  if (!CROPS[cropKey]) return;
  const r = row(getJournal(player), cropKey);
  if (quality === 'gold') r.gold += 1;
  else if (quality === 'silver') r.silver += 1;
  else r.normal += 1;
  if (streak > r.bestStreak) r.bestStreak = streak;
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
    };
  });
}

/** Festival forecast tucked at the bottom of the journal. */
export function nextFestivals(time: TimeOfDay, count: number = 2): string[] {
  return festivalCalendar(time)
    .slice(0, count)
    .map((f) => `${f.name}: ${f.daysUntil === 0 ? 'today' : `${f.daysUntil}d`}`);
}
