// Achievements — earned badges for hitting cozy-life milestones.
//
// The catalog is data-driven: each entry declares its name, a teaser
// description, and a `check(player, world, time)` predicate that returns
// true once the milestone is met. The runtime calls `tickAchievements()`
// every day rollover (and once on demand from the achievements panel)
// to grant any newly-completed badges.
//
// Earned achievements live on Player.achievements as an array of
// `{id, earnedDay}`. Order in the panel follows catalog declaration.
//
// Pure module — no IO, no canvas. The wiring + panel sit in their own
// files. Persistence is handled in persistence.ts.

import type { Player, World } from '../world/world';
import type { TimeOfDay } from './time';
import { CANDIDATES, getHearts } from './hearts';
import { GEM_KEYS, gemInventoryKey } from './gems';
import {
  totalDishesCooked,
  recipesCooked,
  breedersBowlMilestoneReached,
  BREEDERS_BOWL_MILESTONE,
} from './cooking-history';
import { RECIPE_KEYS } from './cooking';
import { buildJournal } from './crop-journal';
import { unreadCount } from './mail';
import { getDog } from './farm-dog';
import { getCoops } from './coop';
import { getGreenhouses } from './greenhouse';
import { getChests } from './chest';
import { getSprinklers } from './sprinklers';
import {
  getMineHaul,
  lifetimeMiningMilestoneReached,
  LIFETIME_MINING_MILESTONE,
  deepVeinMilestoneReached,
  DEEP_VEIN_COUNT,
  DEEP_VEIN_GOLD,
} from './mining-haul';
import {
  compostMasterMilestoneReached,
  COMPOST_MASTER_MILESTONE_GOLD,
  pulperMilestoneReached,
  PULPER_MILESTONE_BAGS,
} from './compost';
import {
  owlFluentMilestoneReached,
  OWL_FLUENT_MILESTONE,
} from './owl-post';

/** Identifier — stable strings so persisted records survive rebalances. */
export type AchievementId =
  | 'first-steps'
  | 'green-thumb'
  | 'master-farmer'
  | 'star-grower'
  | 'pantry-cook'
  | 'recipe-collector'
  | 'wealthy'
  | 'rich'
  | 'tycoon'
  | 'pen-pal'
  | 'best-friend'
  | 'wedding-bells'
  | 'rockhound'
  | 'menagerie'
  | 'farm-decorator'
  | 'cave-veteran'
  | 'compost-master'
  | 'breeders-bowl'
  | 'fluent-with-the-owl'
  | 'pulper'
  | 'deep-vein';

export interface AchievementDef {
  id: AchievementId;
  name: string;
  /** Short teaser shown before the badge is earned. */
  hint: string;
  /** Final description shown once earned. */
  done: string;
  check: (player: Player, world: World, time: TimeOfDay) => boolean;
}

/** Catalog of all achievements in display order. */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    hint: 'Plant your very first seed.',
    done: 'Planted your first seed.',
    check: (p) => Object.values(buildJournal(p)).some((r) => r.sown > 0),
  },
  {
    id: 'green-thumb',
    name: 'Green Thumb',
    hint: 'Harvest 20 crops of any kind.',
    done: 'Brought in 20 crops.',
    check: (p) =>
      buildJournal(p).reduce((s, r) => s + r.normal + r.silver + r.gold, 0) >= 20,
  },
  {
    id: 'master-farmer',
    name: 'Master Farmer',
    hint: 'Harvest 100 crops.',
    done: 'Reaped 100 crops over your career.',
    check: (p) =>
      buildJournal(p).reduce((s, r) => s + r.normal + r.silver + r.gold, 0) >= 100,
  },
  {
    id: 'star-grower',
    name: 'Star Grower',
    hint: 'Bring in your first gold-star crop.',
    done: 'Grew a perfect gold-star crop.',
    check: (p) => buildJournal(p).some((r) => r.gold > 0),
  },
  {
    id: 'pantry-cook',
    name: 'Pantry Cook',
    hint: 'Cook 10 dishes at the inn.',
    done: 'Stirred up 10 dishes.',
    check: (p) => totalDishesCooked(p) >= 10,
  },
  {
    id: 'recipe-collector',
    name: 'Recipe Collector',
    hint: 'Cook at least one of every recipe.',
    done: 'Discovered every recipe in the book.',
    check: (p) => recipesCooked(p) >= RECIPE_KEYS.length,
  },
  {
    id: 'wealthy',
    name: 'Wealthy',
    hint: 'Hold 1,000g at once.',
    done: 'First time holding 1,000g.',
    check: (p) => p.gold >= 1000,
  },
  {
    id: 'rich',
    name: 'Rich',
    hint: 'Hold 5,000g at once.',
    done: 'First time holding 5,000g.',
    check: (p) => p.gold >= 5000,
  },
  {
    id: 'tycoon',
    name: 'Sunsprout Tycoon',
    hint: 'Hold 20,000g at once.',
    done: 'First time holding 20,000g.',
    check: (p) => p.gold >= 20000,
  },
  {
    id: 'pen-pal',
    name: 'Pen Pal',
    hint: 'Receive your first letter from a villager.',
    done: 'Got your first villager letter.',
    check: (p) => {
      const mail = (p as Player & { mail?: { inbox: unknown[] } }).mail;
      // Any letter in the box (unread or read) qualifies.
      const inbox = mail?.inbox ?? [];
      // Also count unread, in case the player hasn't opened the letter yet.
      return inbox.length > 0 || unreadCount(p) > 0;
    },
  },
  {
    id: 'best-friend',
    name: 'Best Friend',
    hint: 'Reach 6 hearts with any villager.',
    done: 'Reached 6 hearts with a villager.',
    check: (p) => {
      if (!p.hearts) return false;
      for (const id of Object.keys(CANDIDATES)) {
        if (getHearts(p.hearts, id) >= 6) return true;
      }
      return false;
    },
  },
  {
    id: 'wedding-bells',
    name: 'Wedding Bells',
    hint: 'Hold a wedding at the village well.',
    done: 'Married someone special.',
    check: (p) => Boolean((p as Player).marriage),
  },
  {
    id: 'rockhound',
    name: 'Rockhound',
    hint: 'Mine at least one of every gem.',
    done: 'Mined every gem tier.',
    check: (p) => GEM_KEYS.every((g) => (p.inventory[gemInventoryKey(g)] ?? 0) > 0),
  },
  {
    id: 'menagerie',
    name: 'Menagerie',
    hint: 'Own a dog and at least one chicken coop.',
    done: 'Built a farm zoo.',
    check: (p, w) => getDog(w).owned && getCoops(w).length > 0,
  },
  {
    id: 'farm-decorator',
    name: 'Farm Decorator',
    hint: 'Place a greenhouse, an extra chest, and a sprinkler.',
    done: 'Decked out the farm.',
    check: (_p, w) =>
      getGreenhouses(w).length > 0 &&
      getChests(w).length >= 2 &&
      getSprinklers(w).length > 0,
  },
  {
    id: 'cave-veteran',
    name: 'Cave Veteran',
    hint: `Mine ${LIFETIME_MINING_MILESTONE} gems over your career.`,
    done: `Pulled ${LIFETIME_MINING_MILESTONE}+ gems out of the cave.`,
    check: (p) => lifetimeMiningMilestoneReached(getMineHaul(p)),
  },
  {
    id: 'compost-master',
    name: 'Compost Master',
    hint: `Recycle ${COMPOST_MASTER_MILESTONE_GOLD}g back from fertilizer bags.`,
    done: `Pulped ${COMPOST_MASTER_MILESTONE_GOLD}+ gold from fertilizer bags.`,
    check: (p) => compostMasterMilestoneReached(p),
  },
  {
    id: 'breeders-bowl',
    name: "Breeder's Bowl",
    hint: `Cook ${BREEDERS_BOWL_MILESTONE} premium (breeder-egg) dishes.`,
    done: `Plated ${BREEDERS_BOWL_MILESTONE}+ premium dishes from breeder eggs.`,
    check: (p) => breedersBowlMilestoneReached(p),
  },
  {
    id: 'fluent-with-the-owl',
    name: 'Fluent with the Owl',
    hint: `Dispatch ${OWL_FLUENT_MILESTONE} owl-post gifts across the village.`,
    done: `Sent ${OWL_FLUENT_MILESTONE}+ owl-post gifts — the owl knows your handwriting now.`,
    check: (p) => owlFluentMilestoneReached(p),
  },
  {
    id: 'pulper',
    name: 'Pulper',
    hint: `Apply ${PULPER_MILESTONE_BAGS} fertilizer bags to your fields.`,
    done: `Pulped ${PULPER_MILESTONE_BAGS}+ fertilizer bags into the soil.`,
    check: (p) => pulperMilestoneReached(p),
  },
  {
    id: 'deep-vein',
    name: 'Deep Vein',
    hint: `Pull ${DEEP_VEIN_COUNT} gems or ${DEEP_VEIN_GOLD}g of ore out of the cave in a single run.`,
    done: `Brought home a single-run haul of ${DEEP_VEIN_COUNT}+ gems or ${DEEP_VEIN_GOLD}+g of ore.`,
    check: (p) => deepVeinMilestoneReached(getMineHaul(p)),
  },
];

/** One earned-badge record stored on the player. */
export interface EarnedAchievement {
  id: AchievementId;
  earnedDay: number;
}

/** Lazy accessor — creates the array on first use. */
export function getEarned(player: Player): EarnedAchievement[] {
  const p = player as Player & { achievements?: EarnedAchievement[] };
  if (!p.achievements) p.achievements = [];
  return p.achievements;
}

/** True iff the player has earned this achievement. */
export function isEarned(player: Player, id: AchievementId): boolean {
  return getEarned(player).some((e) => e.id === id);
}

/** Returns the array of newly-earned ids (often empty). */
export function tickAchievements(
  player: Player,
  world: World,
  time: TimeOfDay,
): AchievementId[] {
  const earned = getEarned(player);
  const newly: AchievementId[] = [];
  for (const a of ACHIEVEMENTS) {
    if (earned.some((e) => e.id === a.id)) continue;
    if (a.check(player, world, time)) {
      earned.push({ id: a.id, earnedDay: time.day });
      newly.push(a.id);
    }
  }
  return newly;
}

/** Pure summary row for the panel. */
export interface AchievementRow {
  id: AchievementId;
  name: string;
  description: string;
  earned: boolean;
  earnedDay: number | null;
}

/** Snapshot every achievement with current earn state. */
export function buildAchievements(player: Player): AchievementRow[] {
  const earned = getEarned(player);
  return ACHIEVEMENTS.map((a) => {
    const e = earned.find((x) => x.id === a.id);
    return {
      id: a.id,
      name: a.name,
      description: e ? a.done : a.hint,
      earned: Boolean(e),
      earnedDay: e ? e.earnedDay : null,
    };
  });
}

/** Tiny progress helper: how many achievements are done. */
export function earnedCount(player: Player): number {
  return getEarned(player).length;
}
