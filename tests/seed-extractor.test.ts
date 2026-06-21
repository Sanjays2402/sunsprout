// Seed extractor — kit ownership, pick target, alternating yield.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  EXTRACTOR_INVENTORY_KEY,
  EXTRACTOR_PRICE,
  getExtractor,
  hasExtractor,
  nextYield,
  pickExtractTarget,
  runExtract,
  totalExtractions,
} from '../src/game/seed-extractor';

function freshPlayer() {
  const w = new World();
  return w.player;
}

function giveKit(p: ReturnType<typeof freshPlayer>): void {
  p.inventory[EXTRACTOR_INVENTORY_KEY] = 1;
}

describe('hasExtractor', () => {
  it('is false on a fresh player + true after granting the kit', () => {
    const p = freshPlayer();
    expect(hasExtractor(p)).toBe(false);
    giveKit(p);
    expect(hasExtractor(p)).toBe(true);
  });
});

describe('pickExtractTarget', () => {
  it('returns null when the bag has no harvest', () => {
    const p = freshPlayer();
    expect(pickExtractTarget(p)).toBeNull();
  });

  it('picks the largest stockpile', () => {
    const p = freshPlayer();
    p.inventory['wheat_harvest'] = 3;
    p.inventory['tomato_harvest'] = 5;
    p.inventory['pumpkin_harvest'] = 1;
    expect(pickExtractTarget(p)).toBe('tomato');
  });

  it('does NOT consider silver/gold tier stacks', () => {
    const p = freshPlayer();
    p.inventory['tomato_harvest_silver'] = 9;
    p.inventory['wheat_harvest'] = 2;
    expect(pickExtractTarget(p)).toBe('wheat');
  });
});

describe('runExtract', () => {
  it('refuses without the kit', () => {
    const p = freshPlayer();
    p.inventory['wheat_harvest'] = 3;
    expect(runExtract(p).kind).toBe('no-kit');
  });

  it('refuses with no harvest in the bag', () => {
    const p = freshPlayer();
    giveKit(p);
    expect(runExtract(p).kind).toBe('no-harvest');
  });

  it('consumes 1 harvest and grants nextYield() seeds', () => {
    const p = freshPlayer();
    giveKit(p);
    p.inventory['wheat_harvest'] = 4;
    const expectYield = nextYield(p);
    const seedsBefore = p.inventory['wheat'] ?? 0;
    const out = runExtract(p);
    expect(out.kind).toBe('extracted');
    expect(p.inventory['wheat_harvest']).toBe(3);
    expect((p.inventory['wheat'] ?? 0) - seedsBefore).toBe(expectYield);
  });

  it('alternates the yield across consecutive extractions', () => {
    const p = freshPlayer();
    giveKit(p);
    p.inventory['wheat_harvest'] = 10;
    const yields: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = p.inventory['wheat'] ?? 0;
      runExtract(p);
      yields.push((p.inventory['wheat'] ?? 0) - before);
    }
    // Even uses (0,2) -> 2; odd uses (1,3) -> 1.
    expect(yields).toEqual([2, 1, 2, 1]);
  });

  it('uses counter climbs only on successful extractions', () => {
    const p = freshPlayer();
    giveKit(p);
    expect(totalExtractions(p)).toBe(0);
    // No harvest -> use count unchanged.
    runExtract(p);
    expect(totalExtractions(p)).toBe(0);
    p.inventory['tomato_harvest'] = 2;
    runExtract(p);
    expect(totalExtractions(p)).toBe(1);
  });

  it('switches to a different crop when the primary stack empties', () => {
    const p = freshPlayer();
    giveKit(p);
    p.inventory['wheat_harvest'] = 1;
    p.inventory['tomato_harvest'] = 5;
    runExtract(p); // tomato is biggest
    expect(p.inventory['tomato_harvest']).toBe(4);
    // Stuff the wheat stack so it's biggest now.
    p.inventory['wheat_harvest'] = 9;
    const out = runExtract(p);
    expect(out.kind).toBe('extracted');
    expect((out as { cropKey: string }).cropKey).toBe('wheat');
  });
});

describe('shop price', () => {
  it('EXTRACTOR_PRICE is sensibly tuned (>=200, <=800)', () => {
    expect(EXTRACTOR_PRICE).toBeGreaterThanOrEqual(200);
    expect(EXTRACTOR_PRICE).toBeLessThanOrEqual(800);
  });
});
