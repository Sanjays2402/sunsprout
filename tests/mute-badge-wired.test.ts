import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('mute-badge wiring', () => {
  it('engine/game.ts imports and calls drawMuteBadge with multiplayer.mutes.size()', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/engine/game.ts'),
      'utf8',
    );
    expect(src).toContain("import { drawMuteBadge } from '../ui/mute-badge'");
    expect(src).toContain('drawMuteBadge(this.ctx');
    expect(src).toMatch(/mutedCount:\s*this\.multiplayer\.mutes\.size\(\)/);
  });
});
