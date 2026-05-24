import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('peer-mute-mark wiring', () => {
  it('renderer.ts imports drawPeerMuteMark and drawPeers forwards mutes', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/render/renderer.ts'),
      'utf8',
    );
    expect(src).toContain("import { drawPeerMuteMark");
    expect(src).toContain("from './peer-mute-mark'");
    expect(src).toMatch(/drawPeerMuteMark\(ctx, peer, mutes, sx, sy\)/);
  });

  it('engine/game.ts forwards multiplayer.mutes into drawPeers', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/engine/game.ts'),
      'utf8',
    );
    expect(src).toMatch(/drawPeers\([^)]*this\.multiplayer\?\.mutes\)/);
  });
});
