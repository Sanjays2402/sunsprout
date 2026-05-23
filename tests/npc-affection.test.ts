// Affection dialogue — heart-tier-unlocked lines extend the NPC dialogue pool.
import { describe, it, expect } from 'vitest';
import {
  AFFECTION_TIERS,
  NPC_DEFS,
  dialoguePool,
  getDialogue,
} from '../src/game/npcs';
import type { NPC } from '../src/world/world';

function fakeNpc(id: string): NPC {
  return { id, name: 'Test', x: 0, y: 0, color: '#fff', hat: '#000', facing: 'down' };
}

describe('affection-tier dialogue', () => {
  it('every candidate defines the three affection tiers', () => {
    for (const [id, def] of Object.entries(NPC_DEFS)) {
      expect(def.affection, `${id} should have affection lines`).toBeDefined();
      for (const tier of AFFECTION_TIERS) {
        expect(def.affection![tier]?.length, `${id} tier ${tier}`).toBeGreaterThan(0);
      }
    }
  });

  it('dialoguePool grows monotonically with hearts', () => {
    for (const id of Object.keys(NPC_DEFS)) {
      const base = dialoguePool(id, 0).length;
      const t2 = dialoguePool(id, 2).length;
      const t4 = dialoguePool(id, 4).length;
      const t6 = dialoguePool(id, 6).length;
      const t8 = dialoguePool(id, 8).length;
      expect(t2).toBeGreaterThan(base);
      expect(t4).toBeGreaterThan(t2);
      expect(t6).toBeGreaterThan(t4);
      expect(t8).toBeGreaterThan(t6);
      // No double-counting: tier 8 adds exactly the four affection tiers.
      expect(t8).toBe(base + 4);
    }
  });

  it('getDialogue with hearts can return an affection-tier line', () => {
    // Probe many days at high hearts — at least one tier-6 line must surface.
    const npc = fakeNpc('mayor');
    const lovedLines = new Set(NPC_DEFS.mayor.affection![6]);
    let sawLoved = false;
    for (let d = 0; d < 200; d++) {
      if (lovedLines.has(getDialogue(npc, d, 6))) {
        sawLoved = true;
        break;
      }
    }
    expect(sawLoved).toBe(true);
  });

  it('getDialogue with 0 hearts never returns an affection line', () => {
    const npc = fakeNpc('finn');
    const affectionLines = new Set([
      ...NPC_DEFS.finn.affection![2],
      ...NPC_DEFS.finn.affection![4],
      ...NPC_DEFS.finn.affection![6],
    ]);
    for (let d = 0; d < 50; d++) {
      expect(affectionLines.has(getDialogue(npc, d, 0))).toBe(false);
    }
  });
});
