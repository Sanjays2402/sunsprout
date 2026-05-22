// NPC schedules and cozy dialogue.
//
// The world ships with four named NPCs (Mayor Bramble, Maple the Shopkeep,
// Finn the Fisher, and Rose the Innkeeper). This module hangs daily
// schedules and warm, wholesome dialogue off each of them. We don't try
// to do real path-finding — NPCs simply ease toward their scheduled
// (x,y) anchor when the in-game hour falls inside their window.
//
// Dialogue selection is deterministic per (day * 100 + npc-id-hash) so
// the player gets the same line if they re-open the box in the same day,
// but the lines rotate as the days roll over.

import type { NPC, World } from '../world/world';
import type { TimeOfDay } from './time';

/** A schedule slot: between `from` and `to` the NPC drifts toward (x,y). */
export interface ScheduleSlot {
  from: number;
  to: number;
  x: number;
  y: number;
}

/** Dialogue + schedule metadata, keyed by NPC id. */
export interface NPCDef {
  schedule: ScheduleSlot[];
  dialogue: string[];
  role: string;
}

export const NPC_DEFS: Record<string, NPCDef> = {
  mayor: {
    role: 'Mayor of Sunsprout',
    schedule: [
      { from: 6, to: 10, x: 19, y: 6 },
      { from: 10, to: 14, x: 18, y: 9 },
      { from: 14, to: 22, x: 20, y: 7 },
    ],
    dialogue: [
      'The lavender by the well bloomed early this year — must be a good omen.',
      "I've been keeping a list of every newcomer's favourite flower. Yours?",
      'A village is just neighbours who agreed to learn each other\'s names.',
      'Mind the loose stone by the south path. I keep meaning to fix it.',
      'There\'s an old cave mouth in the northeast — copper in the walls, if you bring a pickaxe.',
      'Spring rain on a clay roof is the best lullaby in the world.',
      'You\'ve been farming hard. I hope the work has been kind to you too.',
    ],
  },
  maple: {
    role: 'Shopkeep',
    schedule: [
      { from: 6, to: 9, x: 24, y: 7 },
      { from: 9, to: 19, x: 24, y: 8 },
      { from: 19, to: 22, x: 24, y: 7 },
    ],
    dialogue: [
      'Fresh seeds came in this morning — tomatoes love a sunny patch.',
      'If you ever bring me a perfect pumpkin, the price goes up. Just a warning.',
      "Flowers won't fill your belly, but they pay the rent in cheer.",
      'A copper coin saved is two you don\'t have to chase down later.',
      'Bring me five wheat and I\'ll tell you a little secret about the well.',
      'Plant something every week. The harvest knows when you\'ve been faithful.',
    ],
  },
  finn: {
    role: 'Fisher',
    schedule: [
      { from: 6, to: 11, x: 7, y: 21 },
      { from: 11, to: 14, x: 8, y: 21 },
      { from: 14, to: 18, x: 7, y: 21 },
      { from: 18, to: 22, x: 18, y: 8 },
    ],
    dialogue: [
      'Caught a fish with stripes today. Threw it back — it had work to do.',
      'The pond gets quieter just before dusk. That\'s when the big ones bite.',
      "I caught a frog! It blinked at me!",
      'A patient angler hears more secrets than a tavern keep.',
      'If you\'re ever lost, follow the water. It always knows the way home.',
      'Trade you a rare fish for a pumpkin. Don\'t ask me why — just an old craving.',
    ],
  },
  rose: {
    role: 'Innkeeper',
    schedule: [
      { from: 6, to: 8, x: 15, y: 9 },
      { from: 8, to: 22, x: 15, y: 8 },
    ],
    dialogue: [
      "Carrots forgive a missed watering. Tomatoes do not.",
      'There\'s a room upstairs with your name on the door, if you ever need it.',
      'Plant flowers between your crops. Bees will thank you.',
      'I make a soup on rainy days. You\'re always welcome at the long table.',
      'Sleep early, dream gentle, wake with dirt under your nails. That\'s the village way.',
      'A stranger is just a friend who hasn\'t taken off their boots yet.',
    ],
  },
};

/** Cheap deterministic hash for picking a dialogue line per (npc,day). */
function hash(s: string, day: number): number {
  let h = day * 2654435761;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
    h = h | 0;
  }
  return Math.abs(h);
}

/** Picks a single dialogue line for the given NPC + current day. */
export function getDialogue(npc: NPC, day: number): string {
  const def = NPC_DEFS[npc.id];
  if (!def || def.dialogue.length === 0) {
    return `${npc.name} smiles at you warmly.`;
  }
  const i = hash(npc.id, day) % def.dialogue.length;
  return def.dialogue[i];
}

/** Looks up role text for the dialogue box header. */
export function getRole(npc: NPC): string {
  return NPC_DEFS[npc.id]?.role ?? '';
}

/** Returns the schedule anchor for the current hour, or null for "stay put". */
export function getCurrentAnchor(
  npc: NPC,
  hour: number,
): { x: number; y: number } | null {
  const def = NPC_DEFS[npc.id];
  if (!def) return null;
  for (const slot of def.schedule) {
    if (hour >= slot.from && hour < slot.to) {
      return { x: slot.x, y: slot.y };
    }
  }
  return null;
}

/**
 * Eases each NPC toward its current schedule anchor. NPCs don't do real
 * path-finding — they just nudge a tiny fraction of a tile per tick toward
 * the target, which is plenty for ambient village motion.
 */
export function updateNPCs(world: World, time: TimeOfDay, dtMs: number): void {
  const speed = 0.0008; // tiles per ms when far from anchor
  for (const npc of world.npcs) {
    const anchor = getCurrentAnchor(npc, time.hour);
    if (!anchor) continue;
    const dx = anchor.x - npc.x;
    const dy = anchor.y - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) {
      npc.x = anchor.x;
      npc.y = anchor.y;
      continue;
    }
    const step = Math.min(dist, speed * dtMs);
    npc.x += (dx / dist) * step;
    npc.y += (dy / dist) * step;
    // Update facing for visual variety.
    if (Math.abs(dx) > Math.abs(dy)) {
      npc.facing = dx > 0 ? 'right' : 'left';
    } else {
      npc.facing = dy > 0 ? 'down' : 'up';
    }
  }
}

/** Returns the NPC adjacent to (or on the tile in front of) the player, or null. */
export function npcInFrontOf(
  world: World,
  tx: number,
  ty: number,
): NPC | null {
  for (const npc of world.npcs) {
    const ntx = Math.round(npc.x);
    const nty = Math.round(npc.y);
    if (ntx === tx && nty === ty) return npc;
  }
  return null;
}
