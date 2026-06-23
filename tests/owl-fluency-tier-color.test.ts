// Owl-post tier badge color — bronze / silver / gold chip drawn
// alongside the per-NPC fluency label on the lore Folk row. Mirrors
// the tournament ribbon palette (warm metallic family) so the lore
// panel reads as a coherent visual language across separate
// progression systems.
//
// Pure module-side helper returns the hex color for the player's
// current fluency tier with a given NPC (or null when below the
// first tier). The lore-row schema gained an optional tierColor
// field populated by buildLoreRows for Folk rows; the panel UI
// draws a small 6x6 colored chip alongside the row text when set.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  OWL_FLUENCY_TIERS,
  OWL_FLUENCY_TIER_COLOR,
  owlFluencyTierColor,
  recordOwlStamp,
} from '../src/game/owl-post';
import { buildLoreRows } from '../src/game/lore';
import { CANDIDATES } from '../src/game/hearts';

const ANY_NPC = Object.keys(CANDIDATES)[0];

describe('OWL_FLUENCY_TIER_COLOR — palette sanity', () => {
  it('contains a color entry for every fluency tier label', () => {
    for (const tier of OWL_FLUENCY_TIERS) {
      expect(OWL_FLUENCY_TIER_COLOR[tier.label]).toBeDefined();
      expect(OWL_FLUENCY_TIER_COLOR[tier.label]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('three distinct colors across the three tiers', () => {
    const colors = OWL_FLUENCY_TIERS.map((t) => OWL_FLUENCY_TIER_COLOR[t.label]);
    const unique = new Set(colors);
    expect(unique.size).toBe(OWL_FLUENCY_TIERS.length);
  });
});

describe('owlFluencyTierColor — predicate', () => {
  it('returns null on a fresh save (zero owl stamps)', () => {
    const w = new World();
    expect(owlFluencyTierColor(w.player, ANY_NPC)).toBeNull();
  });

  it('returns null when stamps are below the first tier', () => {
    const w = new World();
    // First tier min is 5. Stamp 4 times.
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min - 1; i++) {
      recordOwlStamp(w.player, ANY_NPC);
    }
    expect(owlFluencyTierColor(w.player, ANY_NPC)).toBeNull();
  });

  it('returns the bronze color (occasional pen pal) at the first tier threshold', () => {
    const w = new World();
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) {
      recordOwlStamp(w.player, ANY_NPC);
    }
    expect(owlFluencyTierColor(w.player, ANY_NPC)).toBe(
      OWL_FLUENCY_TIER_COLOR['occasional pen pal'],
    );
  });

  it('returns the silver color (regular pen pal) at the second tier threshold', () => {
    const w = new World();
    for (let i = 0; i < OWL_FLUENCY_TIERS[1].min; i++) {
      recordOwlStamp(w.player, ANY_NPC);
    }
    expect(owlFluencyTierColor(w.player, ANY_NPC)).toBe(
      OWL_FLUENCY_TIER_COLOR['regular pen pal'],
    );
  });

  it('returns the gold color (favorite courier) at the third tier threshold', () => {
    const w = new World();
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) {
      recordOwlStamp(w.player, ANY_NPC);
    }
    expect(owlFluencyTierColor(w.player, ANY_NPC)).toBe(
      OWL_FLUENCY_TIER_COLOR['favorite courier'],
    );
  });

  it('keeps the gold color past the top tier threshold (no overrun)', () => {
    const w = new World();
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min + 50; i++) {
      recordOwlStamp(w.player, ANY_NPC);
    }
    expect(owlFluencyTierColor(w.player, ANY_NPC)).toBe(
      OWL_FLUENCY_TIER_COLOR['favorite courier'],
    );
  });
});

describe('owlFluencyTierColor — per-NPC isolation', () => {
  it('separate NPCs track separate tier colors', () => {
    const w = new World();
    const ids = Object.keys(CANDIDATES);
    // Stamp NPC A enough for the bronze tier.
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) {
      recordOwlStamp(w.player, ids[0]);
    }
    // Stamp NPC B enough for the silver tier.
    for (let i = 0; i < OWL_FLUENCY_TIERS[1].min; i++) {
      recordOwlStamp(w.player, ids[1]);
    }
    expect(owlFluencyTierColor(w.player, ids[0])).toBe(
      OWL_FLUENCY_TIER_COLOR['occasional pen pal'],
    );
    expect(owlFluencyTierColor(w.player, ids[1])).toBe(
      OWL_FLUENCY_TIER_COLOR['regular pen pal'],
    );
  });
});

describe('lore Folk row — tierColor field wiring', () => {
  it('Folk rows carry tierColor=null on a fresh save (no fluency)', () => {
    const w = new World();
    const folkRows = buildLoreRows(w.player).filter((r) => r.category === 'Folk');
    for (const row of folkRows) {
      expect(row.tierColor).toBeNull();
    }
  });

  it('Folk row carries the bronze tierColor once the player crosses the first tier', () => {
    const w = new World();
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) {
      recordOwlStamp(w.player, ANY_NPC);
    }
    // Also seed a hearts entry so the row is `discovered`.
    if (!w.player.hearts) w.player.hearts = {};
    w.player.hearts[ANY_NPC] = { points: 5, lastGiftDay: -1, lastTalkDay: 0 };
    const folkRows = buildLoreRows(w.player).filter((r) => r.category === 'Folk');
    const row = folkRows.find((r) => r.id === ANY_NPC);
    expect(row?.tierColor).toBe(OWL_FLUENCY_TIER_COLOR['occasional pen pal']);
  });

  it('Folk row across all NPCs reflects per-NPC tier colors independently', () => {
    const w = new World();
    const ids = Object.keys(CANDIDATES);
    // Stamp NPC 0 to silver, NPC 1 to gold, NPC 2 stays at zero.
    for (let i = 0; i < OWL_FLUENCY_TIERS[1].min; i++) {
      recordOwlStamp(w.player, ids[0]);
    }
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) {
      recordOwlStamp(w.player, ids[1]);
    }
    // Seed hearts for all so they're discovered.
    if (!w.player.hearts) w.player.hearts = {};
    for (const id of ids) {
      w.player.hearts[id] = { points: 5, lastGiftDay: -1, lastTalkDay: 0 };
    }
    const folkRows = buildLoreRows(w.player).filter((r) => r.category === 'Folk');
    const row0 = folkRows.find((r) => r.id === ids[0]);
    const row1 = folkRows.find((r) => r.id === ids[1]);
    const row2 = folkRows.find((r) => r.id === ids[2]);
    expect(row0?.tierColor).toBe(OWL_FLUENCY_TIER_COLOR['regular pen pal']);
    expect(row1?.tierColor).toBe(OWL_FLUENCY_TIER_COLOR['favorite courier']);
    expect(row2?.tierColor).toBeNull();
  });
});

describe('Non-Folk lore rows do NOT carry tierColor', () => {
  it('Fish/Gems/Forage/Crops/Rumors rows leave tierColor undefined or null', () => {
    const w = new World();
    const rows = buildLoreRows(w.player);
    const nonFolk = rows.filter((r) => r.category !== 'Folk');
    for (const r of nonFolk) {
      // tierColor MAY be undefined on non-Folk rows (we don't set it
      // there) — the panel UI's null/undefined check handles both.
      expect(r.tierColor == null).toBe(true);
    }
  });
});
