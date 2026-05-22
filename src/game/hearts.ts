// Hearts — relationships, gift preferences, and friendship meter.
//
// Slice 1 of the v0.5.0 marriage candidates feature. This is the pure data
// + state module: no input wiring, no UI, no world coupling. Later ticks
// will hook the `G` (gift) key to giveGift() and add a hearts panel to
// the HUD.
//
// Each romanceable NPC has a heart meter from 0 to MAX_HEARTS (default 10),
// stored as `points` where each heart costs HEART_POINTS (250) points.
// Talking nudges +2/day (capped once per game day). Gifts apply preference
// multipliers: a `loved` item gives +80, `liked` +40, `neutral` +20,
// `disliked` -20. Players can only gift the same NPC once per day.
//
// All functions are deterministic and side-effect-only on the HeartsState.

export const MAX_HEARTS = 10;
export const HEART_POINTS = 250;
export const TALK_POINTS_PER_DAY = 2;

export type GiftTaste = 'loved' | 'liked' | 'neutral' | 'disliked';

export interface CandidateDef {
  /** Pretty name (matches NPC.name). */
  name: string;
  /** Inventory keys this candidate adores (+80 pts). */
  loved: string[];
  /** Inventory keys this candidate likes (+40 pts). */
  liked: string[];
  /** Inventory keys this candidate dislikes (-20 pts). */
  disliked: string[];
  /** One-line introduction shown on first heart-up. */
  intro: string;
}

/** All four NPCs are romanceable. Tastes lean on each NPC's role. */
export const CANDIDATES: Record<string, CandidateDef> = {
  mayor: {
    name: 'Mayor Bramble',
    loved: ['flower_harvest', 'pumpkin_harvest'],
    liked: ['tomato_harvest', 'ruby'],
    disliked: ['turnip_harvest'],
    intro: 'Bramble tips his hat a little lower than usual.',
  },
  maple: {
    name: 'Maple',
    loved: ['ruby', 'amethyst'],
    liked: ['wheat_harvest', 'tomato_harvest'],
    disliked: ['frog'],
    intro: 'Maple slips an extra seed packet into your pocket.',
  },
  finn: {
    name: 'Finn',
    loved: ['frog', 'amethyst'],
    liked: ['pumpkin_harvest', 'copper'],
    disliked: ['flower_harvest'],
    intro: "Finn grins like he's been waiting all week to see you.",
  },
  rose: {
    name: 'Rose',
    loved: ['hearty-stew', 'pumpkin-pie'],
    liked: ['flower_harvest', 'carrot_harvest'],
    disliked: ['copper'],
    intro: 'Rose pulls a stool to the warm side of the hearth for you.',
  },
};

/** Per-NPC relationship row stored on the Player. */
export interface HeartRow {
  /** Raw points; hearts = floor(points / HEART_POINTS). */
  points: number;
  /** Day (TimeOfDay.day) of the last accepted gift. */
  lastGiftDay: number;
  /** Day of the last talk-bonus credit. */
  lastTalkDay: number;
}

/** Map of npcId → HeartRow. Lives on Player.hearts (added later). */
export type HeartsState = Record<string, HeartRow>;

/** Fresh state — all candidates at zero hearts. */
export function startingHearts(): HeartsState {
  const s: HeartsState = {};
  for (const id of Object.keys(CANDIDATES)) {
    s[id] = { points: 0, lastGiftDay: -1, lastTalkDay: -1 };
  }
  return s;
}

/** Classify how the candidate feels about a given inventory key. */
export function tasteOf(npcId: string, itemKey: string): GiftTaste {
  const def = CANDIDATES[npcId];
  if (!def) return 'neutral';
  if (def.loved.includes(itemKey)) return 'loved';
  if (def.liked.includes(itemKey)) return 'liked';
  if (def.disliked.includes(itemKey)) return 'disliked';
  return 'neutral';
}

/** Point value of a gift, before per-day gating. */
export function giftPoints(taste: GiftTaste): number {
  switch (taste) {
    case 'loved':
      return 80;
    case 'liked':
      return 40;
    case 'neutral':
      return 20;
    case 'disliked':
      return -20;
  }
}

export interface GiftResult {
  accepted: boolean;
  taste: GiftTaste;
  pointsApplied: number;
  /** Hearts after the gift was applied. */
  hearts: number;
  /** True if this gift pushed the candidate past a whole new heart. */
  leveledUp: boolean;
  /** Human-readable reason when accepted is false. */
  reason?: string;
}

/** Number of whole hearts from a points total. Capped at MAX_HEARTS. */
export function heartsFromPoints(points: number): number {
  const raw = Math.floor(points / HEART_POINTS);
  if (raw < 0) return 0;
  if (raw > MAX_HEARTS) return MAX_HEARTS;
  return raw;
}

/**
 * Apply a gift to a candidate. Enforces one-gift-per-day. Returns a
 * GiftResult describing what happened — the caller is responsible for
 * decrementing the player's inventory on `accepted: true`.
 */
export function giveGift(
  state: HeartsState,
  npcId: string,
  itemKey: string,
  day: number,
): GiftResult {
  const row = state[npcId];
  if (!row) {
    return {
      accepted: false,
      taste: 'neutral',
      pointsApplied: 0,
      hearts: 0,
      leveledUp: false,
      reason: 'not a candidate',
    };
  }
  if (row.lastGiftDay === day) {
    return {
      accepted: false,
      taste: tasteOf(npcId, itemKey),
      pointsApplied: 0,
      hearts: heartsFromPoints(row.points),
      leveledUp: false,
      reason: 'already gifted today',
    };
  }
  const taste = tasteOf(npcId, itemKey);
  const pts = giftPoints(taste);
  const before = heartsFromPoints(row.points);
  row.points = Math.max(0, Math.min(MAX_HEARTS * HEART_POINTS, row.points + pts));
  row.lastGiftDay = day;
  const after = heartsFromPoints(row.points);
  return {
    accepted: true,
    taste,
    pointsApplied: pts,
    hearts: after,
    leveledUp: after > before,
  };
}

/**
 * Award the small talk bonus, once per in-game day per NPC. Returns true
 * if the bonus was applied (caller may want to surface a tiny toast).
 */
export function creditTalk(
  state: HeartsState,
  npcId: string,
  day: number,
): boolean {
  const row = state[npcId];
  if (!row) return false;
  if (row.lastTalkDay === day) return false;
  row.lastTalkDay = day;
  row.points = Math.min(MAX_HEARTS * HEART_POINTS, row.points + TALK_POINTS_PER_DAY);
  return true;
}

/** Convenience accessor used by the (future) HUD. */
export function getHearts(state: HeartsState, npcId: string): number {
  const row = state[npcId];
  if (!row) return 0;
  return heartsFromPoints(row.points);
}
