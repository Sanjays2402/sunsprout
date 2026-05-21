// Game: ties together the canvas context, the World, the Camera, the
// Input handler, and the Renderer. Uses a classic fixed-timestep
// accumulator: variable real-time deltas are sliced into 16ms ticks so
// gameplay updates run deterministically while rendering can still
// happen at any framerate.

import { Camera } from './camera';
import { Input } from './input';
import { Renderer } from '../render/renderer';
import { World } from '../world/world';
import { TILE_SIZE } from './grid';
import { TimeOfDay } from '../game/time';
import {
  advanceDay,
  cropAt,
  harvest,
  isPlantableTile,
  plant,
  till,
  water,
} from '../game/farming';
import {
  getDialogue,
  getRole,
  npcInFrontOf,
  updateNPCs,
} from '../game/npcs';
import { CROP_KEYS } from '../game/crops';
import { sellAllHarvest } from '../game/economy';
import { checkQuests, startingQuests } from '../game/quests';
import { drawHUD } from '../ui/hud';
import { DialogueBox } from '../ui/dialogue';

const FIXED_STEP_MS = 16;
/** Cap the accumulator so a long tab-switch doesn't trigger a spiral of death. */
const MAX_ACCUM_MS = 250;

export class Game {
  public ctx: CanvasRenderingContext2D;
  public world: World;
  public camera: Camera;
  public input: Input;
  public renderer: Renderer;
  public time: TimeOfDay;
  public dialogue: DialogueBox;

  /** Time of day in [0,1) for the renderer's sky/tint maths. */
  public timeOfDay = 0.25;

  /** Last harvest notification — short fade in the corner. */
  private toast = '';
  private toastFade = 0;

  private canvas: HTMLCanvasElement;
  private running = false;
  private lastTimestamp = 0;
  private accumulator = 0;
  private rafHandle: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context.');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.world = new World();
    this.camera = new Camera(canvas.width, canvas.height);
    this.camera.setBounds(this.world.pixelWidth, this.world.pixelHeight);
    this.input = new Input(window);
    this.renderer = new Renderer(this.ctx);
    this.time = new TimeOfDay(6);
    this.dialogue = new DialogueBox();

    // Overlay the spec inventory on top of the world's default player.
    const p = this.world.player;
    if (p) {
      p.inventory = {
        wheat: 4,
        tomato: 1,
        flower: 1,
        'watering-can': 1,
      };
      p.gold = 50;
      p.quests = startingQuests();
      (p as { selectedSlot?: number }).selectedSlot = 0;
      this.camera.snapTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
    }
  }

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

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private tick(now: number): void {
    let delta = now - this.lastTimestamp;
    this.lastTimestamp = now;
    if (delta < 0) delta = 0;
    if (delta > MAX_ACCUM_MS) delta = MAX_ACCUM_MS;
    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= FIXED_STEP_MS) {
      this.update(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      steps++;
      if (steps > 8) {
        this.accumulator = 0;
        break;
      }
    }
    this.render();
  }

  /** Returns the tile coordinates one tile in front of the player. */
  private tileInFront(): { tx: number; ty: number } {
    const p = this.world.player;
    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    switch (p.facing) {
      case 'up':
        return { tx, ty: ty - 1 };
      case 'down':
        return { tx, ty: ty + 1 };
      case 'left':
        return { tx: tx - 1, ty };
      case 'right':
        return { tx: tx + 1, ty };
    }
  }

  private setToast(msg: string): void {
    this.toast = msg;
    this.toastFade = 2500;
  }

  private update(dtMs: number): void {
    // Advance the cozy 24-hour clock; flip crop growth on the new day.
    const tick = this.time.tick(dtMs);
    if (tick.newDay) {
      advanceDay(this.world);
      this.setToast(`A new day begins · Day ${this.time.day}`);
    }
    // Map TimeOfDay → renderer's [0,1) sky cycle.
    // 06:00 → 0 (dawn), 14:00 → 0.5 (midday), 22:00 → ~0.7 (dusk).
    const dayFraction = (this.time.hour + this.time.minute / 60) / 24;
    this.timeOfDay = (dayFraction + 0.75) % 1;

    // NPC schedule + drift.
    updateNPCs(this.world, this.time, dtMs);

    // Dialogue lockout countdown.
    this.dialogue.update(dtMs);
    if (this.toastFade > 0) this.toastFade = Math.max(0, this.toastFade - dtMs);

    // Resolve player movement only when no dialogue is up.
    const dir = this.dialogue.isVisible() ? { dx: 0, dy: 0 } : this.input.getDirection();
    this.world.update(dtMs, dir);

    // Hotbar select 1-5.
    const p = this.world.player;
    for (let i = 0; i < CROP_KEYS.length; i++) {
      if (this.input.justPressed.has(String(i + 1))) {
        (p as { selectedSlot?: number }).selectedSlot = i;
      }
    }
    if (this.input.justPressed.has('5')) {
      (p as { selectedSlot?: number }).selectedSlot = CROP_KEYS.length;
    }

    // Dialogue dismiss
    if (this.dialogue.canDismiss()) {
      // Any meaningful key dismisses.
      const dismissKeys = ['e', ' ', 'enter', 'escape'];
      for (const k of dismissKeys) {
        if (this.input.justPressed.has(k)) {
          this.dialogue.close();
          break;
        }
      }
    } else if (!this.dialogue.isVisible()) {
      // Gameplay actions
      const front = this.tileInFront();
      if (this.input.justPressed.has('t')) {
        if (till(this.world, front.tx, front.ty)) {
          this.setToast('Tilled the soil.');
        }
      }
      if (this.input.justPressed.has('w')) {
        if (water(this.world, front.tx, front.ty)) {
          this.setToast('Watered the crop.');
        }
      }
      // Plant on hotbar key (1..N) — uses front tile.
      for (let i = 0; i < CROP_KEYS.length; i++) {
        if (this.input.justPressed.has(String(i + 1))) {
          const key = CROP_KEYS[i];
          if (isPlantableTile(this.world, front.tx, front.ty) && (p.inventory[key] ?? 0) > 0) {
            if (plant(this.world, front.tx, front.ty, key, p)) {
              this.setToast(`Planted ${key}.`);
              checkQuests(p, { kind: 'plant', cropKey: key });
            }
          }
        }
      }
      // E: prefer NPC interaction, else harvest, else sell-all-at-well
      if (this.input.justPressed.has('e')) {
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc) {
          this.dialogue.open(npc.name, getRole(npc), getDialogue(npc, this.time.day));
          checkQuests(p, { kind: 'talk', npcId: npc.id });
        } else if (cropAt(this.world, front.tx, front.ty)) {
          // Try to harvest.
          const c = cropAt(this.world, front.tx, front.ty);
          const cropKey = c ? c.crop : '';
          if (harvest(this.world, front.tx, front.ty, p)) {
            this.setToast(`Harvested ${cropKey}.`);
            if (cropKey) checkQuests(p, { kind: 'harvest', cropKey });
          }
        } else {
          // Standing in front of the well? Sell all harvest as quick economy.
          for (const b of this.world.buildings) {
            if (b.kind === 'well' && front.tx === b.x && front.ty === b.y) {
              const earned = sellAllHarvest(p);
              if (earned > 0) {
                this.setToast(`Sold your harvest at the well: +${earned}g`);
              } else {
                this.setToast('Nothing to sell yet.');
              }
              break;
            }
          }
        }
      }
    }

    // Camera follow uses the player's centre in world-space pixels.
    if (p) {
      this.camera.follow(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2, dtMs);
    }

    this.input.clearJustPressed();
  }

  private render(): void {
    this.renderer.draw(this.world, this.camera, this.timeOfDay);
    drawHUD(this.ctx, this.world.player, this.time, this.canvas.width, this.canvas.height);
    this.dialogue.draw(this.ctx, this.canvas.width, this.canvas.height);
    // Toast
    if (this.toastFade > 0 && this.toast) {
      const alpha = Math.min(1, this.toastFade / 600);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = 'rgba(26, 20, 38, 0.85)';
      this.ctx.font = 'bold 13px ui-monospace, monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const text = this.toast;
      const tw = this.ctx.measureText(text).width + 24;
      const x = (this.canvas.width - tw) / 2;
      const y = 50;
      this.ctx.fillRect(x, y, tw, 26);
      this.ctx.strokeStyle = '#F5C9A0';
      this.ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, 25);
      this.ctx.fillStyle = '#F5E9D4';
      this.ctx.fillText(text, this.canvas.width / 2, y + 13);
      this.ctx.restore();
    }
  }
}
