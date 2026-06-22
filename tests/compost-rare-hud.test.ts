// Rare-fertilizer HUD glance — compostStatusLine + rareDayCountdownLine
// surface the season's rare-day timing inline so the player can plan
// deposit timing without leaving the bin.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  RARE_FERTILIZER_STREAK,
  compostStatusLine,
  depositCrops,
  placeCompost,
  rareDayCountdownLine,
  rareFinishDayFor,
} from '../src/game/compost';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  return w;
}

const TX = 10;
const TY = 14;

describe('rareDayCountdownLine', () => {
  it('returns an empty string after the rare day has passed', () => {
    for (let s = 0; s < 4; s++) {
      const rareDay = rareFinishDayFor(s);
      expect(rareDayCountdownLine(s, rareDay + 1)).toBe('');
      expect(rareDayCountdownLine(s, 7)).toBe('');
    }
  });

  it('says TODAY on the rare day and mentions the streak bonus', () => {
    for (let s = 0; s < 4; s++) {
      const rareDay = rareFinishDayFor(s);
      const line = rareDayCountdownLine(s, rareDay);
      expect(line).toMatch(/TODAY/);
      expect(line).toMatch(new RegExp(`\\+${RARE_FERTILIZER_STREAK}`));
    }
  });

  it('says tomorrow at delta=1', () => {
    for (let s = 0; s < 4; s++) {
      const rareDay = rareFinishDayFor(s);
      if (rareDay >= 2) {
        const line = rareDayCountdownLine(s, rareDay - 1);
        expect(line).toMatch(/tomorrow/i);
      }
    }
  });

  it('counts down in days otherwise', () => {
    // Find any season where the rare day sits at >=3 from day 1.
    for (let s = 0; s < 4; s++) {
      const rareDay = rareFinishDayFor(s);
      const delta = rareDay - 1;
      if (delta >= 2) {
        const line = rareDayCountdownLine(s, 1);
        expect(line).toMatch(new RegExp(`${delta} days`));
        expect(line).toMatch(new RegExp(`day ${rareDay}`));
      }
    }
  });
});

describe('compostStatusLine (empty bin)', () => {
  it('keeps the old wording when no season is supplied', () => {
    const w = freshWorld();
    const bin = placeCompost(w, TX, TY)!;
    expect(compostStatusLine(bin, 5)).toMatch(/empty/i);
    expect(compostStatusLine(bin, 5)).not.toMatch(/RARE/);
  });

  it('appends the rare-day countdown when season + day are supplied (pre-rare-day)', () => {
    const w = freshWorld();
    const bin = placeCompost(w, TX, TY)!;
    for (let s = 0; s < 4; s++) {
      const rareDay = rareFinishDayFor(s);
      // Pick a day that is BEFORE the rare day so countdown isn't empty.
      if (rareDay >= 2) {
        const line = compostStatusLine(bin, 1, s, 1);
        expect(line).toMatch(/empty/i);
        expect(line).toMatch(/RARE/);
      }
    }
  });

  it('does not append a countdown if the rare day has already passed', () => {
    const w = freshWorld();
    const bin = placeCompost(w, TX, TY)!;
    for (let s = 0; s < 4; s++) {
      const rareDay = rareFinishDayFor(s);
      const line = compostStatusLine(bin, rareDay + 1, s, rareDay + 1);
      expect(line).not.toMatch(/RARE/);
    }
  });
});

describe('compostStatusLine (non-empty bin)', () => {
  it('flags a batch as on the rare-day track when its finishOnDay matches', () => {
    const w = freshWorld();
    const bin = placeCompost(w, TX, TY)!;
    // Drop 8 wheat into the bin on a day chosen so finishOnDay == rareDay.
    // depositCrops sets finishOnDay = today + COMPOST_DAYS - 1 = today + 2.
    // So if we want finishOnDay to equal rareDay, today = rareDay - 2.
    const s = 0;
    const rareDay = rareFinishDayFor(s);
    if (rareDay >= 3) {
      const today = rareDay - 2;
      w.player.inventory = { wheat_harvest: 8 };
      depositCrops(bin, w.player, today);
      const line = compostStatusLine(bin, today, s, today);
      // Should mention 8 crops, 3 days, and a rare-day flag.
      expect(line).toMatch(/Composting 8 crops/);
      expect(line).toMatch(/rare-day track/);
    }
  });

  it('mentions "RARE" alongside ready bag count when a batch finished on the rare day', () => {
    const w = freshWorld();
    const bin = placeCompost(w, TX, TY)!;
    const s = 0;
    const rareDay = rareFinishDayFor(s);
    if (rareDay >= 3) {
      const today = rareDay - 2;
      w.player.inventory = { wheat_harvest: 8 };
      depositCrops(bin, w.player, today);
      // Push the world clock forward until the batch is ready and rolled.
      // But "ready" lives on the same line only if compostTick hasn't fired
      // — depositCrops sets finishOnDay = today + 2 — so on day (today+3)
      // bin has 0 batches (already minted). We need to keep the batch and
      // simulate "ready" by walking just past finishOnDay without ticking.
      // Trick: don't tick, just ask for the line on (finishOnDay + 1) where
      // the batch hasn't been minted yet because we skipped compostTick.
      const readyDay = rareDay + 1;
      const line = compostStatusLine(bin, readyDay, s, readyDay);
      expect(line).toMatch(/2 bags/);
      expect(line).toMatch(/RARE/);
    }
  });

  it('still passes the old single-arg call signature for legacy callers', () => {
    const w = freshWorld();
    const bin = placeCompost(w, TX, TY)!;
    w.player.inventory = { wheat_harvest: 4 };
    depositCrops(bin, w.player, 1);
    // Legacy two-arg form — no season — should not throw, no RARE flag.
    const line = compostStatusLine(bin, 1);
    expect(line).toMatch(/Composting 4 crops/);
    expect(line).not.toMatch(/RARE/);
  });
});
