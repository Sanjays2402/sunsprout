// Crop quality tiers — silver and gold star crops.
//
// Crops grown with sustained care (i.e. watered every single day of their
// growth window) ripen to a higher-quality tier that sells for more gold.
//
//   waterStreak == 0           → normal harvest
//   waterStreak == growthStages  → silver star (sells at 1.5x)
//   waterStreak >  growthStages  → gold star (sells at 2x; the player
//                                  kept watering past the ripen point so
//                                  their growth was "extra cared-for")
//
// Implementation strategy: extend the FarmCrop with a `waterStreak`
// counter that ticks up on every advanceDay() pass where the crop was
// watered. On harvest we resolve a quality and store the produce under
// a tier-flavoured inventory key (`<crop>_harvest`, `<crop>_harvest_silver`,
// `<crop>_harvest_gold`). The well's sellAllHarvest() walks every tier
// and pays the right multiplier.
//
// We keep the existing `<crop>_harvest` keys as the "normal" bucket so
// recipes, gifting and quests continue to work unchanged.
//
// Pure module — exposed helpers operate on a single FarmCrop or just a
// streak number, no World access required (so tests stay tiny).

/** Star tiers a harvested crop can wear. */
export type CropQuality = 'normal' | 'silver' | 'gold';

/** Sell-price multiplier for each tier. */
export const QUALITY_MULTIPLIER: Record<CropQuality, number> = {
  normal: 1,
  silver: 1.5,
  gold: 2,
};

/** Suffix appended to `<crop>_harvest` to bucket a tier's produce separately. */
export const QUALITY_SUFFIX: Record<CropQuality, string> = {
  normal: '',
  silver: '_silver',
  gold: '_gold',
};

/** Pretty label for the HUD / toast. */
export const QUALITY_LABEL: Record<CropQuality, string> = {
  normal: '',
  silver: 'silver-star',
  gold: 'gold-star',
};

/**
 * Resolve the quality tier a crop earns given its `waterStreak`
 * (the count of consecutive watered days) and the crop's total
 * `growthStages` (from CROPS[key]).
 *
 * - streak >= growthStages + 1 → gold
 * - streak >= growthStages     → silver
 * - else                       → normal
 */
export function qualityFromStreak(
  waterStreak: number,
  growthStages: number,
): CropQuality {
  if (waterStreak >= growthStages + 1) return 'gold';
  if (waterStreak >= growthStages) return 'silver';
  return 'normal';
}

/** Inventory key bucket for a (crop, quality) pair. */
export function harvestKey(cropKey: string, quality: CropQuality): string {
  return `${cropKey}_harvest${QUALITY_SUFFIX[quality]}`;
}

/**
 * Decode an inventory key back into (cropKey, quality) if it's a harvest
 * bucket, otherwise return null. Used by the well + recipes when iterating
 * the player's bag.
 */
export function parseHarvestKey(
  key: string,
): { cropKey: string; quality: CropQuality } | null {
  if (!key.endsWith('_harvest_silver') && !key.endsWith('_harvest_gold') && !key.endsWith('_harvest')) {
    return null;
  }
  if (key.endsWith('_harvest_silver')) {
    return { cropKey: key.slice(0, -'_harvest_silver'.length), quality: 'silver' };
  }
  if (key.endsWith('_harvest_gold')) {
    return { cropKey: key.slice(0, -'_harvest_gold'.length), quality: 'gold' };
  }
  return { cropKey: key.slice(0, -'_harvest'.length), quality: 'normal' };
}

/** Star-glyph hint for the (later) inventory badge. Monochrome by spec. */
export function qualityGlyph(quality: CropQuality): string {
  switch (quality) {
    case 'gold':
      return '**';
    case 'silver':
      return '*';
    case 'normal':
      return '';
  }
}
