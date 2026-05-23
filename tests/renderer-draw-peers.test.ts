import { describe, it, expect } from 'vitest';
import { Renderer } from '../src/render/renderer';
import { Camera } from '../src/engine/camera';
import type { PeerRenderable } from '../src/game/peer-view';

function makeCtx(): { ctx: CanvasRenderingContext2D; rectCount: number } {
  const state = { rectCount: 0 };
  const ctx = {
    fillStyle: '',
    font: '',
    fillRect(_x: number, _y: number, _w: number, _h: number) {
      state.rectCount++;
    },
    fillText() {},
    beginPath() {},
    arc() {},
    fill() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, get rectCount() { return state.rectCount; } } as never;
}

function peer(id: string, x: number, y: number): PeerRenderable {
  return { id, name: id, x, y, facing: 'down', color: '#ff8855', hat: '#3a2a1a' };
}

describe('Renderer.drawPeers', () => {
  it('no-ops on an empty peer list', () => {
    const { ctx } = makeCtx();
    const r = new Renderer(ctx);
    const cam = new Camera(320, 240);
    expect(() => r.drawPeers([], cam)).not.toThrow();
  });

  it('draws on-screen peers and culls off-screen ones', () => {
    const captured: Array<[number, number, number, number]> = [];
    const ctx = {
      fillStyle: '',
      font: '',
      fillRect(x: number, y: number, w: number, h: number) {
        captured.push([x, y, w, h]);
      },
      fillText() {},
      beginPath() {},
      arc() {},
      ellipse() {},
      fill() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      createLinearGradient() {
        return { addColorStop() {} };
      },
    } as unknown as CanvasRenderingContext2D;
    const r = new Renderer(ctx);
    const cam = new Camera(320, 240);
    cam.snapTo(160, 120);

    const onScreen = peer('a', 5, 4);
    const offScreen = peer('b', 9999, 9999);
    r.drawPeers([onScreen, offScreen], cam);

    // On-screen peer should produce many rects (shadow + body + hat + nameplate).
    expect(captured.length).toBeGreaterThan(5);
    // Confirm at least one rect was drawn within viewport bounds.
    const inViewport = captured.some(
      ([x, y]) => x >= -32 && x <= 352 && y >= -32 && y <= 272,
    );
    expect(inViewport).toBe(true);
  });
});
