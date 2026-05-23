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
import { sellAllHarvest, sellAllGems } from '../game/economy';
import { sellAllDishes } from '../game/cooking';
import { checkQuests, startingQuests } from '../game/quests';
import { CANDIDATES, creditTalk, getHearts, startingHearts } from '../game/hearts';
import { attemptAutoGift } from '../game/gifting';
import { propose } from '../game/engagement';
import { drawHUD } from '../ui/hud';
import { drawHeartsPanel } from '../ui/hearts-panel';
import { DialogueBox } from '../ui/dialogue';
import { CookingMenu } from '../ui/cooking-menu';
import { RECIPES } from '../game/cooking';
import { Rod, FISH, canCastInto } from '../game/fishing';
import { Pickaxe, GEMS, canStrikeInto } from '../game/mining';
import { gemInventoryKey } from '../game/gems';
import {
  cursorPosition,
  drawFishingBar,
  gradeBonus,
  gradeLabel,
  gradeReel,
  MINIGAME,
  type ReelGrade,
} from '../ui/fishing-minigame';
import {
  cursorPosition as swingCursorPosition,
  drawSwingMeter,
  gradeBonus as strikeBonus,
  gradeLabel as strikeLabel,
  gradeStrike,
  SWING,
  type StrikeGrade,
} from '../ui/mining-minigame';

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
  /** Cooking menu — opened with `C` when standing near the inn. */
  public cookingMenu: CookingMenu = new CookingMenu();
  /** Fishing rod state machine. F casts/reels; tile-in-front must be water. */
  public rod: Rod = new Rod();
  /** Pickaxe state machine. M swings/strikes; tile-in-front must be stone. */
  public pickaxe: Pickaxe = new Pickaxe();
  /** Cursor position (0..1) frozen the moment the player tapped F during REELING. */
  private reelLockedCursor: number | null = null;
  /** Grade awarded for the locked-in press, surfaced when the catch resolves. */
  private reelGrade: ReelGrade | null = null;
  /** Mining swing-meter — locked cursor + grade once the player taps M. */
  private strikeLockedCursor: number | null = null;
  private strikeGrade: StrikeGrade | null = null;

  /** Time of day in [0,1) for the renderer's sky/tint maths. */
  public timeOfDay = 0.25;

  /** Last harvest notification — short fade in the corner. */
  private toast = '';
  private toastFade = 0;
  private heartsPanelVisible = false;

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
      p.hearts = startingHearts();
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

  /**
   * True when the player is standing on a tile orthogonally touching the
   * inn's footprint — i.e. close enough that opening the cooking menu
   * feels diegetic. We check the player's nearest integer tile against
   * every tile bordering the inn (Chebyshev radius 1 including corners).
   */
  private isNearInn(): boolean {
    const p = this.world.player;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const inn = this.world.buildings.find((b) => b.kind === 'inn');
    if (!inn) return false;
    return (
      px >= inn.x - 1 &&
      px <= inn.x + inn.w &&
      py >= inn.y - 1 &&
      py <= inn.y + inn.h
    );
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
    this.cookingMenu.update(dtMs);
    if (this.toastFade > 0) this.toastFade = Math.max(0, this.toastFade - dtMs);

    // Fishing rod state machine ticks every frame so bite/escape fire even
    // if the player isn't pressing anything. Auto-toast escape events so
    // they don't feel silent.
    const rodBefore = this.rod.state;
    if (this.rod.tick(dtMs)) {
      if (rodBefore === 'biting' && this.rod.state === 'idle') {
        this.setToast('The fish got away…');
      } else if (this.rod.state === 'biting') {
        this.setToast('A bite! Press F to reel!');
      } else if (rodBefore === 'reeling' && this.rod.state === 'idle' && this.rod.lastCatch) {
        const fishKey = this.rod.lastCatch;
        const fish = FISH[fishKey];
        const p2 = this.world.player;
        p2.inventory[`fish-${fishKey}`] = (p2.inventory[`fish-${fishKey}`] ?? 0) + 1;
        // If the player nailed the timing press, award bonus gold and a
        // crisper label; otherwise just show a plain catch toast.
        const grade = this.reelGrade ?? 'miss';
        const bonus = gradeBonus(grade);
        if (bonus > 0) {
          p2.gold += bonus;
          this.setToast(`${gradeLabel(grade)} ${fish.name} +${bonus}g`);
        } else {
          this.setToast(`Caught a ${fish.name}!`);
        }
        this.reelLockedCursor = null;
        this.reelGrade = null;
      }
    }

    // Pickaxe state machine ticks every frame so missed strike windows
    // resolve even without input. Auto-toast state transitions.
    const pickBefore = this.pickaxe.state;
    if (this.pickaxe.tick(dtMs)) {
      if (this.pickaxe.state === 'striking') {
        this.setToast('STRIKE! Press M to land it!');
      } else if (pickBefore === 'striking' && this.pickaxe.state === 'idle') {
        this.setToast('The swing glanced off…');
      }
    }

    // Resolve player movement only when no dialogue / menu is up.
    const blocked = this.dialogue.isVisible() || this.cookingMenu.isVisible();
    const dir = blocked ? { dx: 0, dy: 0 } : this.input.getDirection();
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

    // Toggle hearts panel.
    if (this.input.justPressed.has('h')) {
      this.heartsPanelVisible = !this.heartsPanelVisible;
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
    } else if (this.cookingMenu.isVisible()) {
      // Cooking menu input — only when fully open (lockout cleared).
      if (this.cookingMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has('c')) {
          this.cookingMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.cookingMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.cookingMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          const outcome = this.cookingMenu.confirm(this.world.player);
          if (outcome.kind === 'cooked') {
            this.setToast(`Cooked ${outcome.name}!`);
            checkQuests(this.world.player, { kind: 'cook', dishKey: outcome.recipe });
          } else if (outcome.kind === 'missing') {
            const recipe = RECIPES[outcome.recipe];
            const need = recipe.ingredients
              .map((ing) => `${ing.count}× ${ing.key.replace('_harvest', '').replace('fish-', '')}`)
              .join(', ');
            this.setToast(`Need ${need}.`);
          }
        }
      }
    } else if (!this.dialogue.isVisible()) {
      // Gameplay actions
      const front = this.tileInFront();
      // C: open the cooking menu when standing on/adjacent to the inn.
      if (this.input.justPressed.has('c')) {
        if (this.isNearInn()) {
          this.cookingMenu.open();
        } else {
          this.setToast('Stand near the inn to cook.');
        }
      }
      // F: fishing — reel during a bite, lock-in timing during reel,
      // otherwise try to cast into water.
      if (this.input.justPressed.has('f')) {
        if (this.rod.state === 'biting') {
          this.rod.reel();
        } else if (this.rod.state === 'reeling' && this.reelLockedCursor === null) {
          // Player tapped F during the timing minigame — lock the cursor
          // position and grade it. We don't change rod state; the cozy
          // reel animation finishes on its own.
          const cursor = cursorPosition(this.rod.elapsedMs);
          this.reelLockedCursor = cursor;
          this.reelGrade = gradeReel(cursor);
        } else if (this.rod.state === 'idle') {
          if (canCastInto(this.world, front.tx, front.ty)) {
            if (this.rod.cast()) {
              this.reelLockedCursor = null;
              this.reelGrade = null;
              this.setToast('Cast! Wait for a bite…');
            }
          } else {
            this.setToast('Stand facing water to cast.');
          }
        } else {
          // Mid-cast / waiting — let F cancel cleanly.
          this.rod.cancel();
          this.reelLockedCursor = null;
          this.reelGrade = null;
          this.setToast('Reeled in early.');
        }
      }
      // M: mining — strike during STRIKING, otherwise try to swing at stone.
      if (this.input.justPressed.has('m')) {
        if (this.pickaxe.state === 'striking') {
          const cursor = swingCursorPosition(this.pickaxe.elapsedMs);
          const grade = gradeStrike(cursor);
          this.strikeLockedCursor = cursor;
          this.strikeGrade = grade;
          const gem = this.pickaxe.strike();
          if (gem) {
            const def = GEMS[gem];
            p.inventory[gemInventoryKey(gem)] = (p.inventory[gemInventoryKey(gem)] ?? 0) + 1;
            checkQuests(p, { kind: 'mine', gemKey: gem });
            const bonus = strikeBonus(grade);
            if (bonus > 0) {
              p.gold += bonus;
              this.setToast(`${strikeLabel(grade)} +1 ${def.name} +${bonus}g`);
            } else {
              this.setToast(`${strikeLabel(grade)} +1 ${def.name}`);
            }
          }
        } else if (this.pickaxe.state === 'idle') {
          if (canStrikeInto(this.world, front.tx, front.ty)) {
            if (this.pickaxe.swing()) {
              this.strikeLockedCursor = null;
              this.strikeGrade = null;
              this.setToast('Swinging the pickaxe…');
            }
          } else {
            this.setToast('Face stone to mine.');
          }
        } else {
          this.pickaxe.cancel();
          this.strikeLockedCursor = null;
          this.strikeGrade = null;
          this.setToast('Cancelled the swing.');
        }
      }
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
      if (this.input.justPressed.has('g')) {
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc && CANDIDATES[npc.id]) {
          const out = attemptAutoGift(p, npc.id, this.time.day);
          if (out.kind === 'gifted') {
            const r = out.result;
            const label =
              r.taste === 'loved'
                ? '💖 LOVED'
                : r.taste === 'liked'
                  ? '💗 liked'
                  : r.taste === 'disliked'
                    ? '💔 disliked'
                    : '🎁';
            const item = out.itemKey.replace('_harvest', '').replace('fish-', '');
            const lvl = r.leveledUp ? ` · ♥${r.hearts}!` : '';
            this.setToast(`${label} ${npc.name}: ${item}${lvl}`);
            checkQuests(p, { kind: 'gift', npcId: npc.id, hearts: r.hearts });
          } else if (out.kind === 'already-today') {
            this.setToast(`${npc.name} already got a gift today.`);
          } else if (out.kind === 'no-items') {
            this.setToast('Nothing in your bag to gift.');
          }
        } else if (npc) {
          this.setToast(`${npc.name} isn't a candidate.`);
        } else {
          this.setToast('Face someone to give a gift.');
        }
      }
      if (this.input.justPressed.has('p')) {
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc) {
          const out = propose(p, npc.id, this.time.day);
          switch (out.kind) {
            case 'accepted':
              this.setToast(`💍 ${npc.name} said YES! You are engaged.`);
              checkQuests(p, { kind: 'gift', npcId: npc.id, hearts: 10 });
              break;
            case 'not-candidate':
              this.setToast(`${npc.name} isn't a candidate.`);
              break;
            case 'no-bouquet':
              this.setToast('You need a bouquet to propose.');
              break;
            case 'too-few-hearts':
              this.setToast(`${npc.name} needs ♥${out.need} (have ${out.have}).`);
              break;
            case 'already-engaged':
              this.setToast(`You're already engaged to ${out.toNpcId}.`);
              break;
          }
        } else {
          this.setToast('Face someone to propose.');
        }
      }
      if (this.input.justPressed.has('e')) {
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc) {
          const h = p.hearts ? getHearts(p.hearts, npc.id) : 0;
          this.dialogue.open(npc.name, getRole(npc), getDialogue(npc, this.time.day, h));
          checkQuests(p, { kind: 'talk', npcId: npc.id });
          if (p.hearts && creditTalk(p.hearts, npc.id, this.time.day)) {
            // Tiny ambient feedback — only on the day's first chat.
            // (No toast — keeps the dialogue moment quiet.)
          }
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
          // Standing in front of the inn? Sell all dishes for bigger gold.
          let handled = false;
          for (const b of this.world.buildings) {
            if (b.kind === 'well' && front.tx === b.x && front.ty === b.y) {
              const earned = sellAllHarvest(p);
              const gemGold = sellAllGems(p);
              const total = earned + gemGold;
              if (total > 0) {
                const parts: string[] = [];
                if (earned > 0) parts.push(`harvest +${earned}g`);
                if (gemGold > 0) parts.push(`gems +${gemGold}g`);
                this.setToast(`Sold at the well: ${parts.join(', ')}`);
              } else {
                this.setToast('Nothing to sell yet.');
              }
              handled = true;
              break;
            }
            if (
              b.kind === 'inn' &&
              front.tx >= b.x &&
              front.tx < b.x + b.w &&
              front.ty >= b.y &&
              front.ty < b.y + b.h
            ) {
              const earned = sellAllDishes(p);
              if (earned > 0) {
                this.setToast(`Rose buys your dishes: +${earned}g`);
              } else {
                this.setToast('Cook a dish first — Rose pays well.');
              }
              handled = true;
              break;
            }
          }
          void handled;
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
    drawHeartsPanel(this.ctx, this.world.player, this.canvas.width, this.heartsPanelVisible);
    this.dialogue.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.cookingMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);

    // Fishing timing bar — shows during REELING above the hotbar.
    if (this.rod.state === 'reeling') {
      const barW = 240;
      const bx = Math.floor((this.canvas.width - barW) / 2);
      const by = this.canvas.height - 110;
      const cursor = cursorPosition(this.rod.elapsedMs);
      drawFishingBar(
        this.ctx,
        bx,
        by,
        barW,
        cursor,
        MINIGAME.defaultZone,
        this.reelLockedCursor,
        this.reelGrade,
      );
    }
    // Mining swing-meter — shows during STRIKING above the hotbar.
    if (this.pickaxe.state === 'striking') {
      const barW = 240;
      const bx = Math.floor((this.canvas.width - barW) / 2);
      const by = this.canvas.height - 110;
      const cursor = swingCursorPosition(this.pickaxe.elapsedMs);
      drawSwingMeter(
        this.ctx,
        bx,
        by,
        barW,
        cursor,
        SWING.defaultZone,
        this.strikeLockedCursor,
        this.strikeGrade,
      );
    }
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
