// Persistence — JSON snapshot of the player's game state to localStorage.
//
// Sunsprout has always been "play, refresh, lose everything" — the README's
// v0.1.0 feature list literally calls out "save system — not yet". This
// module fills that gap with a tiny, browser-only snapshot/load pair:
//
//   serializeGame()  → SaveSnapshot   (pure; safe to call any frame)
//   applySnapshot()  → mutates Game   (pure; safe to call once on boot)
//   saveToStorage()  → writes JSON to localStorage
//   loadFromStorage() → reads + parses; null on miss or schema mismatch
//
// Schema is versioned. If we ever ship a breaking change to Player /
// World / hearts / engagement / marriage, bump SAVE_VERSION and the old
// blob is ignored on load (we prefer a fresh save over a wrong-shape
// crash). A `clearSave()` helper is exposed for the future settings panel.
//
// Intentionally narrow scope: we only snapshot the player + clock + world
// crops/tiles. NPCs, buildings, dialogue state, and multiplayer are
// regenerated from constructors on every boot, so re-storing them would
// just be noise — the player's farm is what they actually want preserved.

import type { Player, Tile, Crop as RenderCrop } from '../world/world';
import type { Game } from '../engine/game';
import type { HeartsState } from './hearts';
import type { Engagement } from './engagement';
import type { Marriage } from './marriage';
import type { Quest } from './quests';
import { getSprinklers, type PlacedSprinkler } from './sprinklers';
import { getForage, type PlacedForage } from './forage';

/** Localstorage key. Versioned so a manual `localStorage.clear()` is reversible-ish. */
export const SAVE_KEY = 'sunsprout.save.v1';

/** Bump whenever the SaveSnapshot shape changes incompatibly. */
export const SAVE_VERSION = 1;

/** Minimal per-tile snapshot — type + variant only. */
export interface TileSnapshot {
  type: Tile['type'];
  variant?: number;
}

/** Minimal per-crop snapshot — captures everything the renderer + farming need. */
export interface CropSnapshot {
  tx: number;
  ty: number;
  crop: string;
  kind: RenderCrop['kind'];
  stage: number;
  watered: boolean;
  daysSinceWater: number;
  growth: number;
}

/** Full save payload. */
export interface SaveSnapshot {
  version: number;
  /** Player snapshot — position, facing, inventory, gold, quests, romance. */
  player: {
    x: number;
    y: number;
    facing: Player['facing'];
    inventory: Record<string, number>;
    gold: number;
    quests: Quest[];
    hearts?: HeartsState;
    engagement?: Engagement;
    marriage?: Marriage;
  };
  /** Day / hour clock. We round to the nearest in-game hour on load. */
  time: { day: number; hour: number; minute: number; season: 0 | 1 | 2 | 3 };
  /** World snapshot — tiles + crops + sprinklers. NPCs and buildings are regenerated. */
  world: {
    width: number;
    height: number;
    tiles: TileSnapshot[][];
    crops: CropSnapshot[];
    sprinklers: PlacedSprinkler[];
    forage?: PlacedForage[];
  };
}

/** Tiny storage abstraction — anything that quacks like localStorage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Build a SaveSnapshot from the current Game. Pure — does not mutate.
 * The snapshot is JSON-safe (no functions, no class instances).
 */
export function serializeGame(game: Game): SaveSnapshot {
  const p = game.world.player;
  const tiles: TileSnapshot[][] = game.world.tiles.map((row) =>
    row.map((t) => ({ type: t.type, variant: t.variant })),
  );
  // `world.crops` is typed as RenderCrop but farming.ts stores FarmCrop in it.
  // We snapshot every field we can see — extras are harmless.
  const crops: CropSnapshot[] = (
    game.world.crops as unknown as Array<Record<string, unknown>>
  ).map((c) => ({
    tx: (c.tx as number) ?? (c.x as number),
    ty: (c.ty as number) ?? (c.y as number),
    crop: (c.crop as string) ?? '',
    kind: c.kind as RenderCrop['kind'],
    stage: (c.stage as number) ?? 0,
    watered: (c.watered as boolean) ?? false,
    daysSinceWater: (c.daysSinceWater as number) ?? 0,
    growth: (c.growth as number) ?? 0,
  }));
  return {
    version: SAVE_VERSION,
    player: {
      x: Math.round(p.x),
      y: Math.round(p.y),
      facing: p.facing,
      inventory: { ...p.inventory },
      gold: p.gold,
      quests: (p.quests as Quest[]).map((q) => ({ ...q, seen: [...q.seen] })),
      hearts: p.hearts ? structuredCloneHearts(p.hearts) : undefined,
      engagement: p.engagement ? { ...p.engagement } : undefined,
      marriage: p.marriage ? { ...p.marriage } : undefined,
    },
    time: {
      day: game.time.day,
      hour: game.time.hour,
      minute: game.time.minute,
      season: game.time.season,
    },
    world: {
      width: game.world.width,
      height: game.world.height,
      tiles,
      crops,
      sprinklers: getSprinklers(game.world).map((s) => ({ ...s })),
      forage: getForage(game.world).map((f) => ({ ...f })),
    },
  };
}

/** Plain-object deep clone for the hearts state (no Date / Map shenanigans). */
function structuredCloneHearts(h: HeartsState): HeartsState {
  const out: HeartsState = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = { points: v.points, lastGiftDay: v.lastGiftDay, lastTalkDay: v.lastTalkDay };
  }
  return out;
}

/**
 * Apply a snapshot back onto a Game. Skips a snapshot whose width/height
 * doesn't match the current World (different map version) and returns
 * false so the caller can fall back to a fresh game.
 */
export function applySnapshot(game: Game, snap: SaveSnapshot): boolean {
  if (snap.version !== SAVE_VERSION) return false;
  if (snap.world.width !== game.world.width || snap.world.height !== game.world.height) {
    return false;
  }
  const p = game.world.player;
  // Player.
  p.x = snap.player.x;
  p.y = snap.player.y;
  p.targetX = p.x;
  p.targetY = p.y;
  p.fromX = p.x;
  p.fromY = p.y;
  p.moveProgress = 1;
  p.facing = snap.player.facing;
  p.inventory = { ...snap.player.inventory };
  p.gold = snap.player.gold;
  p.quests = snap.player.quests.map((q) => ({ ...q, seen: [...q.seen] }));
  if (snap.player.hearts) p.hearts = structuredCloneHearts(snap.player.hearts);
  if (snap.player.engagement) p.engagement = { ...snap.player.engagement };
  if (snap.player.marriage) p.marriage = { ...snap.player.marriage };
  // Tiles.
  for (let y = 0; y < snap.world.height; y++) {
    for (let x = 0; x < snap.world.width; x++) {
      const t = snap.world.tiles[y][x];
      game.world.tiles[y][x] = { type: t.type, variant: t.variant };
    }
  }
  // Crops — replace the array wholesale; FarmCrop and RenderCrop coexist.
  game.world.crops.length = 0;
  for (const c of snap.world.crops) {
    (game.world.crops as unknown as CropSnapshot[]).push({
      tx: c.tx,
      ty: c.ty,
      crop: c.crop,
      kind: c.kind,
      stage: c.stage,
      watered: c.watered,
      daysSinceWater: c.daysSinceWater,
      growth: c.growth,
    });
    // Also mirror x/y onto the entry so the renderer's RenderCrop.x/y view works.
    const last = game.world.crops[game.world.crops.length - 1] as unknown as Record<string, number>;
    last.x = c.tx;
    last.y = c.ty;
  }
  // Sprinklers — replace the world's list. Default to empty for forward
  // compat with v1 saves that pre-date sprinklers.
  const sprList = getSprinklers(game.world);
  sprList.length = 0;
  for (const s of snap.world.sprinklers ?? []) {
    sprList.push({ ...s });
  }
  // Forage — same forward-compat story; older v1 saves predate the
  // forage list and round-trip cleanly with an empty array.
  const forageList = getForage(game.world);
  forageList.length = 0;
  for (const f of snap.world.forage ?? []) {
    forageList.push({ ...f });
  }
  // Time — set day/season directly; reseed the internal elapsed counter.
  game.time.day = snap.time.day;
  game.time.hour = snap.time.hour;
  game.time.minute = snap.time.minute;
  game.time.season = snap.time.season;
  // Force the renderer to pick up the change next frame.
  return true;
}

/** Writes the snapshot to storage. Returns false on a quota / serialisation error. */
export function saveToStorage(
  game: Game,
  storage: StorageLike,
  key: string = SAVE_KEY,
): boolean {
  try {
    const snap = serializeGame(game);
    storage.setItem(key, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

/** Loads a snapshot from storage. Returns null on miss / parse error / version mismatch. */
export function loadFromStorage(
  storage: StorageLike,
  key: string = SAVE_KEY,
): SaveSnapshot | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== SAVE_VERSION) return null;
    if (!parsed.player || !parsed.world || !parsed.time) return null;
    return parsed as SaveSnapshot;
  } catch {
    return null;
  }
}

/** Wipes the save slot. Used by the future settings "Reset save" button. */
export function clearSave(storage: StorageLike, key: string = SAVE_KEY): void {
  try {
    storage.removeItem(key);
  } catch {
    // Best-effort — silently fail if storage is locked.
  }
}
