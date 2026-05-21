// Game: ties together the canvas context, the World, the Camera, the
// Input handler, and the Renderer. Uses a classic fixed-timestep
// accumulator: variable real-time deltas are sliced into 16ms ticks so
// gameplay updates run deterministically while rendering can still
// happen at any framerate.

import { Camera } from './camera';
import { Input } from './input';
import { Renderer } from '../render/renderer';
import { World } from '../world/world';

const FIXED_STEP_MS = 16;
/** Cap the accumulator so a long tab-switch doesn't trigger a spiral of death. */
const MAX_ACCUM_MS = 250;
/** Day length in real seconds. */
const DAY_LENGTH_SECONDS = 120;

export class Game {
  public ctx: CanvasRenderingContext2D;
  public world: World;
  public camera: Camera;
  public input: Input;
  public renderer: Renderer;

  /** Time of day in [0,1). 0 == dawn, 0.25 == noon, 0.5 == dusk, 0.75 == midnight. */
  public timeOfDay = 0.25;

  private running = false;
  private lastTimestamp = 0;
  private accumulator = 0;
  private rafHandle: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context.');
    }
    this.ctx = ctx;
    this.world = new World();
    this.camera = new Camera(canvas.width, canvas.height);
    this.camera.setBounds(this.world.pixelWidth, this.world.pixelHeight);
    this.input = new Input(window);
    this.renderer = new Renderer(this.ctx);

    // Snap the camera to the player on construction so we don't slide
    // into view on the first few frames.
    const p = this.world.player;
    if (p) {
      const tileSize = canvas.width / Math.max(1, canvas.width); // no-op safety
      void tileSize;
      this.camera.snapTo(
        p.x * 32 + 16,
        p.y * 32 + 16,
      );
    }
  }

  /** Start the requestAnimationFrame loop. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    const frame = (ts: number) => {
      if (!this.running) return;
      this.tick(ts);
      this.rafHandle = requestAnimationFrame(frame);
    };
    this.rafHandle = requestAnimationFrame(frame);
  }

  /** Stop the loop and release the rAF handle. */
  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  /** A single rAF iteration. */
  private tick(now: number): void {
    let delta = now - this.lastTimestamp;
    this.lastTimestamp = now;
    if (delta < 0) delta = 0;
    if (delta > MAX_ACCUM_MS) delta = MAX_ACCUM_MS;
    this.accumulator += delta;

    // Fixed-timestep update.
    let steps = 0;
    while (this.accumulator >= FIXED_STEP_MS) {
      this.update(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      steps++;
      if (steps > 8) {
        // Safety valve: never spend an entire frame catching up.
        this.accumulator = 0;
        break;
      }
    }

    // Render every animation frame regardless of update count.
    this.render();
  }

  /** Fixed-step update at dtMs == FIXED_STEP_MS. */
  private update(dtMs: number): void {
    // Advance time of day. One full cycle every DAY_LENGTH_SECONDS.
    this.timeOfDay = (this.timeOfDay + dtMs / (DAY_LENGTH_SECONDS * 1000)) % 1;

    // Resolve player movement against the world.
    const dir = this.input.getDirection();
    this.world.update(dtMs, dir);

    // Camera follow uses the player's centre in world-space pixels.
    const p = this.world.player;
    if (p) {
      this.camera.follow(p.x * 32 + 16, p.y * 32 + 16, dtMs);
    }

    // Clear edge-triggered input at the end of the tick so each press
    // is consumed exactly once per fixed update window.
    this.input.clearJustPressed();
  }

  private render(): void {
    this.renderer.draw(this.world, this.camera, this.timeOfDay);
  }
}
