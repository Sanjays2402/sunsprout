// Per-NPC owl fluency tiers — qualitative tag tacked onto the lore
// Folk row description once the player crosses thresholds of owl
// posts to ONE recipient (5 = occasional, 15 = regular, 25 = favorite).
// Mirrors the global OWL_FLUENT_MILESTONE shape but at a per-NPC level
// so the Folk tab surfaces which friendships are owl-heavy vs.
// in-person.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  OWL_FLUENCY_TIERS,
  OWL_FLUENT_MILESTONE,
  owlFluencyTier,
  owlStampLine,
  recordOwlStamp,
} from '../src/game/owl-post';
import { CANDIDATES } from '../src/game/hearts';
import { buildLoreRows } from '../src/game/lore';

function pickCandidate(): string {
  return Object.keys(CANDIDATES)[0];
}

describe('OWL_FLUENCY_TIERS — sanity', () => {
  it('exactly three tiers in ascending min order', () => {
    expect(OWL_FLUENCY_TIERS.length).toBe(3);
    for (let i = 1; i < OWL_FLUENCY_TIERS.length; i++) {
      expect(OWL_FLUENCY_TIERS[i].min).toBeGreaterThan(OWL_FLUENCY_TIERS[i - 1].min);
    }
  });

  it('top tier matches the global OWL_FLUENT_MILESTONE so a fluent run lights up at least one favorite', () => {
    const top = OWL_FLUENCY_TIERS[OWL_FLUENCY_TIERS.length - 1];
    expect(top.min).toBe(OWL_FLUENT_MILESTONE);
  });

  it('first tier is gentle (>=5) so a single-owl friendship stays plain', () => {
    expect(OWL_FLUENCY_TIERS[0].min).toBeGreaterThanOrEqual(5);
  });
});

describe('owlFluencyTier — per-NPC tier predicate', () => {
  it('empty string at 0 stamps', () => {
    const p = {} as object;
    expect(owlFluencyTier(p, 'maple')).toBe('');
  });

  it('empty string just below the first tier floor', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min - 1; i++) recordOwlStamp(p, 'maple');
    expect(owlFluencyTier(p, 'maple')).toBe('');
  });

  it('first tier label at exactly the first tier floor', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) recordOwlStamp(p, 'maple');
    expect(owlFluencyTier(p, 'maple')).toBe(OWL_FLUENCY_TIERS[0].label);
  });

  it('promotes through every tier as stamps climb', () => {
    const p = {} as object;
    let crossed = 0;
    for (let i = 0; i < OWL_FLUENT_MILESTONE; i++) {
      recordOwlStamp(p, 'maple');
      const tier = owlFluencyTier(p, 'maple');
      const expected = [...OWL_FLUENCY_TIERS].reverse().find((t) => i + 1 >= t.min);
      expect(tier).toBe(expected?.label ?? '');
      if (expected) crossed += 1;
    }
    // Every tier was eventually reached on the way to the milestone.
    expect(crossed).toBeGreaterThan(0);
  });

  it('per-NPC isolation — bumping NPC A does not affect NPC B', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) recordOwlStamp(p, 'maple');
    expect(owlFluencyTier(p, 'maple')).toBe(OWL_FLUENCY_TIERS[0].label);
    expect(owlFluencyTier(p, 'pip')).toBe('');
  });
});

describe('owlStampLine — count + tier composition', () => {
  it('returns "" when player has 0 stamps to this npc', () => {
    expect(owlStampLine({}, 'maple')).toBe('');
  });

  it('plain count line below the first tier floor', () => {
    const p = {} as object;
    recordOwlStamp(p, 'maple');
    expect(owlStampLine(p, 'maple')).toBe('Owl posts: 1.');
  });

  it('count + tier label at the first tier floor', () => {
    const p = {} as object;
    const tier = OWL_FLUENCY_TIERS[0];
    for (let i = 0; i < tier.min; i++) recordOwlStamp(p, 'maple');
    expect(owlStampLine(p, 'maple')).toBe(`Owl posts: ${tier.min} (${tier.label}).`);
  });

  it('count + tier label at the middle tier floor', () => {
    const p = {} as object;
    const tier = OWL_FLUENCY_TIERS[1];
    for (let i = 0; i < tier.min; i++) recordOwlStamp(p, 'maple');
    expect(owlStampLine(p, 'maple')).toBe(`Owl posts: ${tier.min} (${tier.label}).`);
  });

  it('count + favorite-courier label at the top tier floor', () => {
    const p = {} as object;
    const tier = OWL_FLUENCY_TIERS[2];
    for (let i = 0; i < tier.min; i++) recordOwlStamp(p, 'maple');
    expect(owlStampLine(p, 'maple')).toBe(`Owl posts: ${tier.min} (${tier.label}).`);
    expect(tier.label).toBe('favorite courier');
  });

  it('count + favorite-courier label above the top tier — label stays favorite', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENT_MILESTONE + 10; i++) recordOwlStamp(p, 'maple');
    const line = owlStampLine(p, 'maple');
    expect(line).toContain(`${OWL_FLUENT_MILESTONE + 10}`);
    expect(line).toContain('favorite courier');
  });
});

describe('lore Folk row picks up the per-NPC tier tail', () => {
  it('Folk row gets the favorite-courier tag once a recipient is owl-saturated', () => {
    const w = new World();
    const npcId = pickCandidate();
    w.player.hearts = { [npcId]: { points: 1, lastGiftDay: -1, lastTalkDay: 1 } };
    const tier = OWL_FLUENCY_TIERS[2];
    for (let i = 0; i < tier.min; i++) recordOwlStamp(w.player, npcId);
    const rows = buildLoreRows(w.player);
    const folkRow = rows.find((r) => r.category === 'Folk' && r.id === npcId);
    expect(folkRow).toBeTruthy();
    expect(folkRow!.description).toContain(`Owl posts: ${tier.min}`);
    expect(folkRow!.description).toContain('favorite courier');
  });

  it('Folk row keeps the plain count when the player is under the first tier floor', () => {
    const w = new World();
    const npcId = pickCandidate();
    w.player.hearts = { [npcId]: { points: 1, lastGiftDay: -1, lastTalkDay: 1 } };
    // 3 stamps — under the first tier (5).
    for (let i = 0; i < 3; i++) recordOwlStamp(w.player, npcId);
    const rows = buildLoreRows(w.player);
    const folkRow = rows.find((r) => r.category === 'Folk' && r.id === npcId);
    expect(folkRow).toBeTruthy();
    expect(folkRow!.description).toContain('Owl posts: 3.');
    expect(folkRow!.description).not.toContain('pen pal');
    expect(folkRow!.description).not.toContain('courier');
  });
});
