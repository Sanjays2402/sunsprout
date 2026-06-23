// Fluent with the Owl — lifetime owl-post achievement.
//
// The badge lights up once totalOwlStamps(p) >= OWL_FLUENT_MILESTONE
// (25). Mirrors the cave-veteran / compost-master / breeders-bowl
// shape: the lazy OwlStampBook on Player.owlStamps already accrues
// inside dispatchOwl, so the achievement is a one-line predicate
// over the existing ledger.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  OWL_FLUENT_MILESTONE,
  owlFluentMilestoneReached,
  recordOwlStamp,
  totalOwlStamps,
} from '../src/game/owl-post';
import {
  ACHIEVEMENTS,
  isEarned,
  tickAchievements,
} from '../src/game/achievements';

describe('owlFluentMilestoneReached predicate', () => {
  it('false on a fresh player with no dispatched owls', () => {
    const w = new World();
    expect(owlFluentMilestoneReached(w.player)).toBe(false);
  });

  it('false at MILESTONE - 1, true at MILESTONE', () => {
    const w = new World();
    for (let i = 0; i < OWL_FLUENT_MILESTONE - 1; i++) {
      recordOwlStamp(w.player, 'maple');
    }
    expect(owlFluentMilestoneReached(w.player)).toBe(false);
    recordOwlStamp(w.player, 'maple');
    expect(owlFluentMilestoneReached(w.player)).toBe(true);
  });

  it('aggregates across multiple NPC ids', () => {
    const w = new World();
    // Split the milestone across several recipients.
    for (let i = 0; i < 10; i++) recordOwlStamp(w.player, 'maple');
    for (let i = 0; i < 10; i++) recordOwlStamp(w.player, 'pip');
    for (let i = 0; i < 5; i++) recordOwlStamp(w.player, 'rowan');
    expect(totalOwlStamps(w.player)).toBe(OWL_FLUENT_MILESTONE);
    expect(owlFluentMilestoneReached(w.player)).toBe(true);
  });
});

describe('fluent-with-the-owl in the achievements catalog', () => {
  it('catalog includes the fluent-with-the-owl entry', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'fluent-with-the-owl');
    expect(def).toBeTruthy();
    expect(def?.name).toBe('Fluent with the Owl');
    // Both teaser and done-text must mention the milestone.
    expect(def?.hint).toContain(String(OWL_FLUENT_MILESTONE));
    expect(def?.done).toContain(String(OWL_FLUENT_MILESTONE));
  });

  it('tickAchievements grants the badge once the threshold is crossed', () => {
    const w = new World();
    const time = new TimeOfDay(7);
    // Below threshold — not granted.
    for (let i = 0; i < OWL_FLUENT_MILESTONE - 1; i++) {
      recordOwlStamp(w.player, 'maple');
    }
    let newly = tickAchievements(w.player, w, time);
    expect(newly).not.toContain('fluent-with-the-owl');
    expect(isEarned(w.player, 'fluent-with-the-owl')).toBe(false);
    // Crossing the threshold flips the badge on.
    recordOwlStamp(w.player, 'maple');
    newly = tickAchievements(w.player, w, time);
    expect(newly).toContain('fluent-with-the-owl');
    expect(isEarned(w.player, 'fluent-with-the-owl')).toBe(true);
  });

  it('catalog size grew (now includes fluent-with-the-owl)', () => {
    // Mirror the prior catalog growth assertions — the catalog continues
    // to expand as new lifetime-ledger badges land. Anchored on the
    // presence of this entry, not a hardcoded total, so a follow-on
    // badge in the same tick doesn't force a fragile count update here.
    expect(ACHIEVEMENTS.some((a) => a.id === 'fluent-with-the-owl')).toBe(true);
  });

  it('fluent-with-the-owl is positioned after breeders-bowl in display order', () => {
    const owlIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'fluent-with-the-owl');
    const bowlIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'breeders-bowl');
    expect(owlIdx).toBeGreaterThan(bowlIdx);
  });
});
