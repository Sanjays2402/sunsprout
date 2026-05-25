import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('peer-roster subtitle wiring', () => {
  it('engine/game.ts imports drawRosterSubtitle + summarize/format/tone and calls them in render', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/engine/game.ts'),
      'utf8',
    );
    expect(src).toContain(
      "import { drawRosterSubtitle } from '../ui/peer-roster-subtitle'",
    );
    expect(src).toMatch(
      /import\s*\{\s*summarizeRoster,\s*formatRosterSummary\s*\}\s*from\s*'\.\.\/game\/peer-roster-summary'/,
    );
    expect(src).toContain(
      "import { rosterTone } from '../game/peer-roster-tone'",
    );
    expect(src).toContain('drawRosterSubtitle(this.ctx');
    expect(src).toMatch(/summarizeRoster\(roster\)/);
    expect(src).toMatch(/formatRosterSummary\(summary\)/);
    expect(src).toMatch(/rosterTone\(summary\)/);
  });
});
