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
  tilesForTool,
  tierOf,
  upgradeCost,
  upgradeTool,
  toolLabel,
} from '../game/tools';
import {
  getDialogue,
  getRole,
  npcInFrontOf,
  updateNPCs,
} from '../game/npcs';
import { CROP_KEYS } from '../game/crops';
import { sellAllHarvest, sellAllGems, sellAllForage, sellAllEggs } from '../game/economy';
import { sellAllDishes } from '../game/cooking';
import { checkQuests as checkQuestsRaw, startingQuests, type QuestEvent } from '../game/quests';
import { CANDIDATES, creditTalk, getHearts, startingHearts } from '../game/hearts';
import { attemptAutoGift } from '../game/gifting';
import { propose } from '../game/engagement';
import { holdWedding } from '../game/marriage';
import { drawHUD } from '../ui/hud';
import { drawPeerBadge } from '../ui/peer-badge';
import { drawMuteBadge } from '../ui/mute-badge';
import { drawPeerRosterPanel } from '../ui/peer-roster-panel';
import { drawRosterSubtitle } from '../ui/peer-roster-subtitle';
import { buildPeerRoster } from '../game/peer-roster';
import { summarizeRoster, formatRosterSummary } from '../game/peer-roster-summary';
import { rosterTone } from '../game/peer-roster-tone';
import { drawEmoteLegend } from '../ui/emote-legend';
import { drawPeerBubbles } from '../render/peer-bubbles';
import { PeerToasts } from '../ui/peer-toasts';
import { drawHeartsPanel } from '../ui/hearts-panel';
import { DialogueBox } from '../ui/dialogue';
import { CookingMenu } from '../ui/cooking-menu';
import { SleepSummary } from '../ui/sleep-summary';
import { sleep as sleepAction } from '../game/sleep';
import { drawWeatherStrip, drawRainOverlay } from '../ui/weather-strip';
import { applyRain, weatherToday, WEATHER } from '../game/weather';
import { drawBirthdayBanner } from '../ui/birthday-banner';
import { drawFestivalBanner } from '../ui/festival-banner';
import { cropSellMultiplier } from '../game/festivals';
import {
  placeSprinkler,
  removeSprinkler,
  sprinklerAt,
  sprinklerTick,
  sprinklerInventoryKey,
  getSprinklers,
  drawSprinklerSprite,
  type SprinklerKey,
} from '../game/sprinklers';
import {
  regenerateForage,
  clearForage,
  isDusk,
  forageAt,
  pickupForage,
  getForage,
  drawForageSprite,
  FORAGE,
} from '../game/forage';
import {
  COOP_INVENTORY_KEY,
  COOP_W,
  COOP_H,
  MAX_CHICKENS_PER_COOP,
  addChicken,
  adjacentCoop,
  canPlaceCoop,
  collectEggs,
  coopTick,
  getCoops,
  placeCoop,
  drawCoopSprite,
} from '../game/coop';
import {
  DOG_TICKET_KEY,
  adoptDog,
  canPet,
  dogTick,
  drawDogSprite,
  getDog,
  petDog,
  updateDog,
} from '../game/farm-dog';
import {
  CAT_TICKET_KEY,
  adoptCat,
  canPetCat,
  catTick,
  drawCatSprite,
  getCat,
  petCat,
} from '../game/farm-cat';
import {
  GREENHOUSE_INVENTORY_KEY,
  GREENHOUSE_W,
  GREENHOUSE_H,
  canPlaceGreenhouse,
  drawGreenhouseSprite,
  getGreenhouses,
  greenhouseTick,
  placeGreenhouse,
} from '../game/greenhouse';
import { deliverDailyMail, readNextLetter, unreadCount } from '../game/mail';
import { CANDIDATES as MAIL_CANDIDATES } from '../game/hearts';
import {
  freezeOutdoorCrops,
  isFrozenSeason,
  drawSnowOverlay,
  winterFlavorLine,
} from '../game/winter';
import {
  expireOldInvites,
  fireHangoutIfPresent,
  inviteToastLine,
  rollDailyInvites,
} from '../game/hangouts';
import {
  CHEST_INVENTORY_KEY,
  adjacentChest,
  canPlaceChest,
  drawChestSprite,
  ensureStarterChest,
  getChests,
  placeChest,
} from '../game/chest';
import { ChestMenu } from '../ui/chest-menu';
import { RECIPES } from '../game/cooking';
import { recordCook } from '../game/cooking-history';
import { RecipeCodex } from '../ui/recipe-codex';
import { recordHarvest, recordSown } from '../game/crop-journal';
import { CropJournalPanel } from '../ui/crop-journal-panel';
import { tickAchievements } from '../game/achievements';
import { AchievementsPanel } from '../ui/achievements-panel';
import { logGold } from '../game/money-log';
import { MoneyLogPanel } from '../ui/money-log-panel';
import { QuestLogPanel } from '../ui/quest-log-panel';
import { getSettings } from '../game/settings';
import { SettingsPanel } from '../ui/settings-panel';
import { Rod, FISH, canCastInto } from '../game/fishing';
import { Pickaxe, GEMS, canStrikeInto } from '../game/mining';
import { gemInventoryKey } from '../game/gems';
import {
  pickaxeTier,
  pickaxeTierLabel,
  pickaxeUpgradeCost,
  upgradePickaxe,
  weightedGemPick,
} from '../game/pickaxe-upgrades';
import {
  rodBiteWindowFor,
  rodTierLabel,
  rodUpgradeCost,
  upgradeRod,
  weightedFishPick,
} from '../game/rod-upgrades';
import {
  STAMINA_COST,
  drinkBest,
  getStamina,
  refillStamina,
  spendStamina,
} from '../game/stamina';
import { drawStaminaBar } from '../ui/stamina-bar';
import {
  CART_X,
  CART_Y,
  cartArrivalLine,
  cartOpen,
  cartVisitToday,
  nearCart,
} from '../game/cart';
import { CartMenu } from '../ui/cart-menu';
import { drawCartSprite } from '../render/cart-sprite';
import { dawnRestock, recordLastSeed } from '../game/auto-restock';
import { LorePanel } from '../ui/lore-panel';
import {
  cursorPosition,
  drawFishingBar,
  gradeBonus,
  gradeLabel,
  gradeReel,
  MINIGAME,
  type ReelGrade,
} from '../ui/fishing-minigame';
import { initMultiplayer } from '../game/multiplayer-init';
import { tickMultiplayerFrame } from '../game/multiplayer-frame';
import {
  applySnapshot,
  loadFromStorage,
  saveToStorage,
  type StorageLike,
} from '../game/persistence';
import type { MultiplayerDriver } from '../game/multiplayer-driver';
import type { PeerRenderable } from '../game/peer-view';
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
  /** Day-summary overlay shown the morning after sleep(). */
  public sleepSummary: SleepSummary = new SleepSummary();
  /** Chest menu — opened with `]` when standing next to a placed chest. */
  public chestMenu: ChestMenu = new ChestMenu();
  /** Recipe codex panel — toggled with `R`. */
  public recipeCodex: RecipeCodex = new RecipeCodex();
  /** Crop journal panel — toggled with `;`. */
  public cropJournal: CropJournalPanel = new CropJournalPanel();
  /** Achievements panel — toggled with `V`. */
  public achievements: AchievementsPanel = new AchievementsPanel();
  /** Money log panel — toggled with `Q`. */
  public moneyLogPanel: MoneyLogPanel = new MoneyLogPanel();
  /** Quest log panel — toggled with `'`. */
  public questLogPanel: QuestLogPanel = new QuestLogPanel();
  /** Settings panel — toggled with `\\`. */
  public settingsPanel: SettingsPanel = new SettingsPanel();
  /** Pip's travelling cart menu — opened with E when next to the cart. */
  public cartMenu: CartMenu = new CartMenu();
  /** Lore / bestiary panel — toggled with backtick. */
  public lorePanel: LorePanel = new LorePanel();
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

  /** Optional multiplayer driver (null in single-player). */
  public multiplayer: MultiplayerDriver | null = null;
  /** Localstorage handle for save/load. Null in tests / SSR. */
  public storage: StorageLike | null = null;
  /** Last peer-list resolved this frame — handed to renderer.drawPeers(). */
  private peerRenderables: PeerRenderable[] = [];
  /** Join/leave toast queue (only used when multiplayer is active). */
  private peerToasts = new PeerToasts();

  /** Time of day in [0,1) for the renderer's sky/tint maths. */
  public timeOfDay = 0.25;

  /** Last harvest notification — short fade in the corner. */
  private toast = '';
  private toastFade = 0;
  private heartsPanelVisible = false;
  /** Set when we've already wiped today's forage at dusk. */
  private forageCleared = false;

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

    // Multiplayer (opt-in via `?multiplayer=1`). Safe-fails to null when
    // BroadcastChannel is unavailable so single-player still boots.
    try {
      this.multiplayer = initMultiplayer({
        location: typeof window !== 'undefined' ? window.location : undefined,
      });
    } catch {
      this.multiplayer = null;
    }

    // Persistence: if a save exists in localStorage, restore it on top of
    // the fresh world. We fall back silently to the new game on any error.
    this.storage = typeof window !== 'undefined' ? (window.localStorage as StorageLike) : null;
    if (this.storage) {
      const snap = loadFromStorage(this.storage);
      if (snap) {
        try {
          applySnapshot(this, snap);
        } catch {
          // ignore — corrupt snapshot stays in storage but doesn't break boot
        }
      }
    }
    // Seed the day's forage so a fresh boot already has pickables out.
    // If load restored an older save without forage this is also the
    // first chance to populate today.
    if (getForage(this.world).length === 0 && !isDusk(this.time.hour)) {
      regenerateForage(this.world, this.time.season, this.time.day);
    }
    // Make sure the starter cellar chest always exists at the farmhouse,
    // even on fresh worlds or saves that pre-date the chest system.
    ensureStarterChest(this.world);
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
   * Wrapper around checkQuests that captures any gold delta from a
   * completed quest and posts it to the money log so the player can
   * see "Wheat-Five Reward +50g" in the Q panel. The underlying quest
   * system mutates Player.gold internally — diffing before/after is
   * the cleanest way to capture rewards without touching quests.ts.
   */
  private checkQuests(event: QuestEvent): string[] {
    const before = this.world.player.gold;
    const completed = checkQuestsRaw(this.world.player, event);
    const diff = this.world.player.gold - before;
    if (diff !== 0 && completed.length > 0) {
      const label = completed.length === 1 ? `quest: ${completed[0]}` : `quests: ${completed.length}`;
      logGold(this.world.player, diff, label, this.time.day);
    }
    return completed;
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

  /** True when the player is standing within Chebyshev radius 1 of Maple's shop. */
  private isNearShop(): boolean {
    const p = this.world.player;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const shop = this.world.buildings.find((b) => b.kind === 'shop');
    if (!shop) return false;
    return (
      px >= shop.x - 1 &&
      px <= shop.x + shop.w &&
      py >= shop.y - 1 &&
      py <= shop.y + shop.h
    );
  }

  /** True when the player is standing within Chebyshev radius 1 of the farmhouse. */
  private isAtFarmhouseSimple(): boolean {
    const p = this.world.player;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const fh = this.world.buildings.find((b) => b.kind === 'farmhouse');
    if (!fh) return false;
    return (
      px >= fh.x - 1 &&
      px <= fh.x + fh.w &&
      py >= fh.y - 1 &&
      py <= fh.y + fh.h
    );
  }

  private update(dtMs: number): void {
    // Advance the cozy 24-hour clock; flip crop growth on the new day.
    const tick = this.time.tick(dtMs);
    if (tick.newDay) {
      // Apply today's rain BEFORE advanceDay so it counts toward the
      // growth tick that's about to fire.
      const w = weatherToday(this.time);
      const rained = applyRain(this.world, w);
      const sprinkled = sprinklerTick(this.world);
      // Winter pass: outdoor crops freeze. Run AFTER rain/sprinklers
      // (so they harmlessly try to water frozen tiles) and BEFORE
      // advanceDay (so the growth tick sees watered=false outside).
      // greenhouseTick later re-asserts watered=true for inside tiles.
      const frozen = isFrozenSeason(this.time) ? freezeOutdoorCrops(this.world) : 0;
      advanceDay(this.world);
      // Chickens drop their daily eggs into their coop's cache.
      const eggs = coopTick(this.world);
      // Farm dog's morale payout for yesterday's pet (if any).
      const dogPaid = dogTick(this.world, this.world.player, this.time);
      if (dogPaid > 0) logGold(this.world.player, dogPaid, 'farm dog streak', this.time.day);
      // Farm cat's morale payout for yesterday's pet (if any).
      const catPaid = catTick(this.world, this.world.player, this.time);
      if (catPaid > 0) logGold(this.world.player, catPaid, 'farm cat streak', this.time.day);
      // Stamina refill — top the pool back to max once per new day.
      refillStamina(this.world.player, this.time.day);
      // Auto-restock kit — re-buy the last seed up to target so the
      // player isn't stuck waiting at Maple's for a single packet.
      const restockOut = dawnRestock(this.world.player);
      if (restockOut.kind === 'restocked') {
        logGold(this.world.player, -restockOut.gold, `auto-restock ${restockOut.cropKey}`, this.time.day);
      }
      // Pip's cart — surface a dawn toast on the day he arrives so the
      // player knows to head over to the village square.
      const pipArrived = cartVisitToday(this.time);
      // Greenhouse boost: every crop inside grows extra and stays watered.
      const greenBumped = greenhouseTick(this.world);
      // Deliver any new letters earned by yesterday's heart gains.
      const newMail = deliverDailyMail(this.world.player, this.time.day);
      // Hangout invites: clear expired ones, post new ones from any
      // heart-4 candidate who isn't already on the schedule.
      expireOldInvites(this.world.player, this.time);
      const newInvites = rollDailyInvites(this.world.player, this.time);
      // Regenerate the day's forage layout — deterministic per (season,day).
      regenerateForage(this.world, this.time.season, this.time.day);
      this.forageCleared = false;
      const flavorTail =
        rained > 0
          ? ` (rain watered ${rained})`
          : sprinkled > 0
            ? ` (sprinklers watered ${sprinkled})`
            : eggs > 0
              ? ` (coops laid ${eggs} egg${eggs === 1 ? '' : 's'})`
              : dogPaid > 0
                ? ` (the dog tipped you +${dogPaid}g)`
                : catPaid > 0
                  ? ` (the cat tipped you +${catPaid}g)`
                  : greenBumped > 0
                    ? ` (greenhouse pushed ${greenBumped} crops)`
                    : newMail > 0
                      ? ` (${newMail} new letter${newMail === 1 ? '' : 's'} arrived)`
                      : newInvites.length === 1
                        ? ` (${inviteToastLine(newInvites[0])})`
                        : newInvites.length > 1
                          ? ` (${newInvites.length} hangout invites pending)`
                          : pipArrived
                            ? ` (${cartArrivalLine()})`
                            : '';
      // Winter takes priority on day 1 of the season — the player needs
      // to know the field froze. Days 2+ of winter just show the standard
      // flavour tail.
      const isFirstWinterDay = isFrozenSeason(this.time) && this.time.day === 1;
      const headline = isFirstWinterDay
        ? winterFlavorLine(frozen)
        : `A new day begins · Day ${this.time.day}${flavorTail}`;
      this.setToast(headline);
      // Auto-save snapshot at every day rollover — gated by settings.
      if (this.storage && getSettings(this.world.player).autoSave) {
        saveToStorage(this, this.storage);
      }
    }
    // Achievements: check every frame so a milestone (gold, marriage,
    // greenhouse placement) surfaces immediately rather than at next
    // day rollover. tickAchievements is idempotent — earned ids stay.
    const newlyEarned = tickAchievements(this.world.player, this.world, this.time);
    if (newlyEarned.length > 0) {
      const first = newlyEarned[0];
      const tail = newlyEarned.length > 1 ? ` (+${newlyEarned.length - 1})` : '';
      this.setToast(`Achievement unlocked: ${first}${tail}`);
    }
    // Dusk wipe — forage withers once the sun gets low.
    if (!this.forageCleared && isDusk(this.time.hour)) {
      clearForage(this.world);
      this.forageCleared = true;
    }
    // Map TimeOfDay → renderer's [0,1) sky cycle.
    // 06:00 → 0 (dawn), 14:00 → 0.5 (midday), 22:00 → ~0.7 (dusk).
    const dayFraction = (this.time.hour + this.time.minute / 60) / 24;
    this.timeOfDay = (dayFraction + 0.75) % 1;

    // NPC schedule + drift.
    updateNPCs(this.world, this.time, dtMs);

    // Farm dog follow movement — soft chase the player when too far.
    updateDog(this.world, this.world.player, dtMs);

    // Hangout: if the player is standing on / next to an open invite's
    // meeting spot during its hour window, fire it. The function is
    // idempotent — the invite is consumed on the first firing so this
    // check is cheap to run every frame.
    {
      const px = Math.round(this.world.player.x);
      const py = Math.round(this.world.player.y);
      const hangout = fireHangoutIfPresent(this.world.player, px, py, this.time);
      if (hangout.kind === 'fired') {
        const name = CANDIDATES[hangout.invite.npcId]?.name ?? hangout.invite.npcId;
        logGold(this.world.player, 120, `hangout: ${name}`, this.time.day);
        this.setToast(`${hangout.invite.flavor} +120g, hearts now ${hangout.heartsAfter}.`);
      }
    }

    // Dialogue lockout countdown.
    this.dialogue.update(dtMs);
    this.cookingMenu.update(dtMs);
    this.sleepSummary.update(dtMs);
    this.chestMenu.update(dtMs);
    this.cartMenu.update(dtMs);
    this.lorePanel.update(dtMs);
    this.recipeCodex.update(dtMs);
    this.cropJournal.update(dtMs);
    this.achievements.update(dtMs);
    this.moneyLogPanel.update(dtMs);
    this.questLogPanel.update(dtMs);
    this.settingsPanel.update(dtMs);
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
          logGold(p2, bonus, `fishing ${fish.name}`, this.time.day);
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
    const blocked = this.dialogue.isVisible() || this.cookingMenu.isVisible() || this.sleepSummary.isVisible() || this.chestMenu.isVisible() || this.cartMenu.isVisible();
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

    // R: toggle the recipe codex.
    if (this.input.justPressed.has('r')) {
      this.recipeCodex.toggle();
    } else if (this.recipeCodex.isVisible() && this.recipeCodex.canAct() && this.input.justPressed.has('escape')) {
      this.recipeCodex.close();
    }

    // ;: toggle the crop journal panel.
    if (this.input.justPressed.has(';')) {
      this.cropJournal.toggle();
    } else if (this.cropJournal.isVisible() && this.cropJournal.canAct() && this.input.justPressed.has('escape')) {
      this.cropJournal.close();
    }

    // V: toggle the achievements panel. While open, arrows / w/s scroll.
    if (this.input.justPressed.has('v')) {
      this.achievements.toggle();
    } else if (this.achievements.isVisible() && this.achievements.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.achievements.close();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.achievements.scrollDown();
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.achievements.scrollUp();
      }
    }

    // Q: toggle the money log panel.
    if (this.input.justPressed.has('q')) {
      this.moneyLogPanel.toggle();
    } else if (this.moneyLogPanel.isVisible() && this.moneyLogPanel.canAct() && this.input.justPressed.has('escape')) {
      this.moneyLogPanel.close();
    }

    // ': toggle the quest log panel.
    if (this.input.justPressed.has("'")) {
      this.questLogPanel.toggle();
    } else if (this.questLogPanel.isVisible() && this.questLogPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.questLogPanel.close();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.questLogPanel.scrollDown(this.world.player);
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.questLogPanel.scrollUp();
      }
    }

    // `: toggle the lore / bestiary panel.
    if (this.input.justPressed.has('`')) {
      this.lorePanel.toggle();
    } else if (this.lorePanel.isVisible() && this.lorePanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.lorePanel.close();
      } else if (this.input.justPressed.has('arrowright') || this.input.justPressed.has('d')) {
        this.lorePanel.nextTab();
      } else if (this.input.justPressed.has('arrowleft') || this.input.justPressed.has('a')) {
        this.lorePanel.prevTab();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.lorePanel.scrollDown(this.world.player);
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.lorePanel.scrollUp();
      }
    }

    // \: toggle the settings panel.
    if (this.input.justPressed.has('\\')) {
      this.settingsPanel.toggle();
    } else if (this.settingsPanel.isVisible() && this.settingsPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.settingsPanel.close();
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.settingsPanel.selectPrev();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.settingsPanel.selectNext();
      } else if (this.input.justPressed.has('enter') || this.input.justPressed.has(' ')) {
        const out = this.settingsPanel.confirm(this.world.player, this.storage);
        if (out.kind === 'cycled') {
          this.setToast(`${out.key}: ${out.value}`);
        } else if (out.kind === 'reset-requested') {
          this.setToast('Press Enter again to ERASE your save.');
        } else if (out.kind === 'reset-done') {
          this.setToast('Save erased. Refresh to start a fresh farm.');
        } else if (out.kind === 'closed') {
          // close() already hides — no toast.
        }
      }
    }

    // K: manual save. Useful before quitting / before risky moves.
    if (this.input.justPressed.has('k')) {
      if (this.storage && saveToStorage(this, this.storage)) {
        this.setToast('Saved.');
      } else {
        this.setToast('Save failed.');
      }
    }

    // B: bedtime. Fast-forward to dawn and pop the day-summary overlay.
    if (this.input.justPressed.has('b') && !this.sleepSummary.isVisible()) {
      const out = sleepAction(this.world, this.time);
      if (out.kind === 'slept') {
        // Sleep also restores stamina, mirroring the dawn rollover.
        refillStamina(this.world.player, this.time.day);
        this.sleepSummary.open(out.summary);
        if (this.storage) saveToStorage(this, this.storage);
      } else if (out.kind === 'not-at-farmhouse') {
        this.setToast('Stand by the farmhouse to sleep.');
      } else if (out.kind === 'too-early') {
        this.setToast(`Too early to sleep (after ${out.until}:00).`);
      }
    }

    // Z: drink the best stamina-restoring dish in the bag (hot cocoa > tea).
    if (this.input.justPressed.has('z')) {
      const out = drinkBest(this.world.player);
      if (out.kind === 'drank') {
        const pretty = out.key.replace('dish-', '').replace('-', ' ');
        this.setToast(`Sipped ${pretty}. +${out.restored} stamina.`);
      } else if (out.kind === 'no-drink') {
        this.setToast('No tea or cocoa in your bag.');
      } else if (out.kind === 'already-full') {
        this.setToast('Already at full stamina.');
      }
    }

    // O: place / remove a sprinkler on the tile in front of the player.
    if (this.input.justPressed.has('o')) {
      const front = this.tileInFront();
      const here = sprinklerAt(this.world, front.tx, front.ty);
      if (here) {
        removeSprinkler(this.world, front.tx, front.ty);
        p.inventory[sprinklerInventoryKey(here.kind)] =
          (p.inventory[sprinklerInventoryKey(here.kind)] ?? 0) + 1;
        this.setToast('Picked up sprinkler.');
      } else {
        // Place the first sprinkler kind the player has in stock.
        const candidates: SprinklerKey[] = ['basic'];
        let placed = false;
        for (const k of candidates) {
          if ((p.inventory[sprinklerInventoryKey(k)] ?? 0) > 0) {
            if (placeSprinkler(this.world, front.tx, front.ty, k)) {
              p.inventory[sprinklerInventoryKey(k)]! -= 1;
              this.setToast(`Placed ${k} sprinkler.`);
              placed = true;
              break;
            }
          }
        }
        if (!placed) {
          this.setToast('Need a tilled tile and a sprinkler in your bag.');
        }
      }
    }

    // Y: pick up the forage on the tile in front of the player. Plain
    // grass-tile pickups so the player never has to mash E + risk
    // talking to an NPC overlapping the same column.
    if (this.input.justPressed.has('y')) {
      const front = this.tileInFront();
      const here = forageAt(this.world, front.tx, front.ty);
      if (here) {
        const kind = pickupForage(this.world, p, front.tx, front.ty);
        if (kind) {
          this.setToast(`Picked ${FORAGE[kind].name}.`);
        }
      } else {
        this.setToast('Nothing to forage here.');
      }
    }

    // N: place a chicken coop on the COOP_W x COOP_H grass footprint
    // starting at the tile in front of the player. Consumes one coop
    // kit from the bag on success.
    if (this.input.justPressed.has('n')) {
      const front = this.tileInFront();
      const have = p.inventory[COOP_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Buy a coop kit from Maple first.');
      } else if (canPlaceCoop(this.world, front.tx, front.ty)) {
        if (placeCoop(this.world, front.tx, front.ty)) {
          p.inventory[COOP_INVENTORY_KEY] = have - 1;
          this.setToast('Placed a coop. Buy chickens to fill it.');
        }
      } else {
        this.setToast(`Need a clear ${COOP_W}x${COOP_H} grass patch.`);
      }
    }

    // I: add a chicken to the adjacent coop, consuming one from the bag.
    if (this.input.justPressed.has('i')) {
      const front = this.tileInFront();
      const coop = adjacentCoop(this.world, front.tx, front.ty);
      const have = p.inventory['chicken'] ?? 0;
      if (!coop) {
        this.setToast('Stand next to a coop first.');
      } else if (have <= 0) {
        this.setToast('No chickens in your bag. Buy one from Maple.');
      } else if (coop.chickens >= MAX_CHICKENS_PER_COOP) {
        this.setToast(`Coop is full (${MAX_CHICKENS_PER_COOP} max).`);
      } else if (addChicken(coop)) {
        p.inventory['chicken'] = have - 1;
        this.setToast(`Chicken added (${coop.chickens}/${MAX_CHICKENS_PER_COOP}).`);
      }
    }

    // J: adopt the dog (consumes a ticket from the bag) on first press,
    // pet the dog on subsequent presses. Cozy morale loop — the streak
    // gold posts at the next morning's rollover.
    if (this.input.justPressed.has('j')) {
      const dog = getDog(this.world);
      if (!dog.owned) {
        const have = p.inventory[DOG_TICKET_KEY] ?? 0;
        if (have > 0) {
          if (adoptDog(this.world, p)) {
            this.setToast('A scruffy farm dog trots up — adopted!');
          }
        } else {
          this.setToast('Buy a Farm Dog Ticket from Maple first.');
        }
      } else if (canPet(this.world, p)) {
        const out = petDog(this.world, p, this.time);
        if (out.kind === 'petted') {
          this.setToast(`Pet the dog. Streak ${out.streak} (+${out.bonus}g tomorrow).`);
        } else if (out.kind === 'already-today') {
          this.setToast('Already petted today — come back tomorrow.');
        }
      } else {
        this.setToast('Walk closer to the dog to pet it.');
      }
    }

    // -: adopt the cat on first press, pet the cat on subsequent presses.
    // Cat sits on the farmhouse roof — stand near the farmhouse to pet.
    if (this.input.justPressed.has('-')) {
      const cat = getCat(this.world);
      if (!cat.owned) {
        const have = p.inventory[CAT_TICKET_KEY] ?? 0;
        if (have > 0) {
          if (adoptCat(this.world, p)) {
            this.setToast('A grey tabby kitten settles on your farmhouse roof.');
          }
        } else {
          this.setToast('Buy a Kitten Ticket from Maple first.');
        }
      } else if (canPetCat(this.world, p)) {
        const out = petCat(this.world, p, this.time);
        if (out.kind === 'petted') {
          this.setToast(`Pet the cat. Streak ${out.streak} (+${out.bonus}g tomorrow).`);
        } else if (out.kind === 'already-today') {
          this.setToast('The cat has had enough scritches for today.');
        }
      } else {
        this.setToast('Stand by the farmhouse to pet the cat.');
      }
    }

    // U: place a greenhouse kit on a 3x3 grass footprint in front of the player.
    if (this.input.justPressed.has('u')) {
      const front = this.tileInFront();
      const have = p.inventory[GREENHOUSE_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Buy a Greenhouse Kit from Maple first.');
      } else if (canPlaceGreenhouse(this.world, front.tx, front.ty)) {
        if (placeGreenhouse(this.world, front.tx, front.ty)) {
          p.inventory[GREENHOUSE_INVENTORY_KEY] = have - 1;
          this.setToast('Greenhouse erected. Plant inside for fast growth.');
        }
      } else {
        this.setToast(`Need a clear ${GREENHOUSE_W}x${GREENHOUSE_H} grass patch.`);
      }
    }

    // [: read the next unread letter from the farmhouse mailbox.
    if (this.input.justPressed.has('[')) {
      if (!this.isAtFarmhouseSimple()) {
        this.setToast('Stand near the farmhouse to check the mailbox.');
      } else {
        const letter = readNextLetter(p);
        if (!letter) {
          const left = unreadCount(p);
          if (left === 0) this.setToast('No new letters in the mailbox.');
        } else {
          const author = MAIL_CANDIDATES[letter.npcId]?.name ?? letter.npcId;
          this.dialogue.open(author, `Letter delivered day ${letter.deliveredDay}`, letter.body);
        }
      }
    }

    // ]: open the adjacent chest (deposit / withdraw).
    if (this.input.justPressed.has(']') && !this.chestMenu.isVisible()) {
      const front = this.tileInFront();
      const chest =
        adjacentChest(this.world, front.tx, front.ty) ??
        adjacentChest(this.world, Math.round(p.x), Math.round(p.y));
      if (chest) {
        this.chestMenu.open(chest);
      } else {
        this.setToast('No chest nearby.');
      }
    }

    // X: place a new chest from a chest-kit (one tile in front of the player).
    if (this.input.justPressed.has('x')) {
      const front = this.tileInFront();
      const have = p.inventory[CHEST_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Buy a Chest Kit from Maple first.');
      } else if (canPlaceChest(this.world, front.tx, front.ty)) {
        if (placeChest(this.world, front.tx, front.ty)) {
          p.inventory[CHEST_INVENTORY_KEY] = have - 1;
          this.setToast('Placed a chest.');
        }
      } else {
        this.setToast('Need a clear grass tile in front of you.');
      }
    }

    // Dialogue dismiss
    if (this.sleepSummary.isVisible()) {
      // Sleep summary takes priority — it locks the world. Wait until it's
      // dismissible (fade-in done), then accept any meaningful key to close.
      if (this.sleepSummary.canDismiss()) {
        const dismissKeys = ['e', ' ', 'enter', 'escape', 'b'];
        for (const k of dismissKeys) {
          if (this.input.justPressed.has(k)) {
            this.sleepSummary.close();
            break;
          }
        }
      }
    } else if (this.dialogue.canDismiss()) {
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
            recordCook(this.world.player, outcome.recipe);
            this.setToast(`Cooked ${outcome.name}!`);
            this.checkQuests({ kind: 'cook', dishKey: outcome.recipe });
          } else if (outcome.kind === 'missing') {
            const recipe = RECIPES[outcome.recipe];
            const need = recipe.ingredients
              .map((ing) => `${ing.count}× ${ing.key.replace('_harvest', '').replace('fish-', '')}`)
              .join(', ');
            this.setToast(`Need ${need}.`);
          }
        }
      }
    } else if (this.chestMenu.isVisible()) {
      // Chest menu input — only when fully open (lockout cleared).
      if (this.chestMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has(']')) {
          this.chestMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.chestMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.chestMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          const out = this.chestMenu.withdrawOne(this.world.player);
          if (out.kind === 'withdrew') {
            this.setToast(`Withdrew 1 ${out.key.replace('_harvest', '')}.`);
          } else if (out.kind === 'empty') {
            this.setToast('Chest is empty.');
          }
        } else if (i.has('tab')) {
          const out = this.chestMenu.depositAllHarvest(this.world.player);
          if (out.kind === 'deposited') {
            this.setToast(`Deposited ${out.count} harvest item${out.count === 1 ? '' : 's'}.`);
          } else {
            this.setToast('Nothing to deposit.');
          }
        }
      }
    } else if (this.cartMenu.isVisible()) {
      // Cart menu input — only when fully open (lockout cleared).
      if (this.cartMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has('e')) {
          this.cartMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.cartMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.cartMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          const px = Math.round(this.world.player.x);
          const py = Math.round(this.world.player.y);
          const out = this.cartMenu.confirm(this.world.player, px, py, this.time);
          if (out.kind === 'bought') {
            logGold(this.world.player, -out.item.buyPrice, `cart: ${out.item.label}`, this.time.day);
            this.setToast(`Bought ${out.item.label}. (${out.remainingGold}g left)`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g (have ${out.have}g).`);
          } else if (out.kind === 'closed') {
            this.setToast("Pip's already packed up for the day.");
            this.cartMenu.close();
          } else if (out.kind === 'too-far') {
            this.setToast('Stand by the cart.');
            this.cartMenu.close();
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
            if (!spendStamina(p, STAMINA_COST.cast)) {
              this.setToast('Too tired to cast. Sleep or sip cocoa (Z).');
            } else {
              const biteWindowMs = rodBiteWindowFor(p);
              const fishPicker = (rng: () => number) => weightedFishPick(p, rng);
              if (this.rod.cast({ biteWindowMs, fishPicker })) {
                this.reelLockedCursor = null;
                this.reelGrade = null;
                this.setToast('Cast! Wait for a bite…');
              } else {
                getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.cast);
              }
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
          const rolled = this.pickaxe.strike();
          // Pickaxe-tier bias: if the strike landed and the player has
          // an upgraded pickaxe, re-roll using the tier weights so the
          // gem distribution actually responds to the upgrade. We keep
          // the inner roll in place so the state-machine stays clean.
          const gem = rolled ? weightedGemPick(p) : null;
          if (gem) {
            const def = GEMS[gem];
            p.inventory[gemInventoryKey(gem)] = (p.inventory[gemInventoryKey(gem)] ?? 0) + 1;
            this.checkQuests({ kind: 'mine', gemKey: gem });
            const bonus = strikeBonus(grade);
            if (bonus > 0) {
              p.gold += bonus;
              logGold(p, bonus, `mining ${def.name}`, this.time.day);
              this.setToast(`${strikeLabel(grade)} +1 ${def.name} +${bonus}g`);
            } else {
              this.setToast(`${strikeLabel(grade)} +1 ${def.name}`);
            }
          }
        } else if (this.pickaxe.state === 'idle') {
          if (canStrikeInto(this.world, front.tx, front.ty)) {
            if (!spendStamina(p, STAMINA_COST.mine)) {
              this.setToast('Too tired to swing. Sleep or sip cocoa (Z).');
            } else if (this.pickaxe.swing()) {
              this.strikeLockedCursor = null;
              this.strikeGrade = null;
              this.setToast('Swinging the pickaxe…');
            } else {
              getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.mine);
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
        if (!spendStamina(p, STAMINA_COST.till)) {
          this.setToast('Too tired to till. Sleep or sip cocoa (Z).');
        } else {
          let tilledAny = false;
          for (const tile of tilesForTool(p, 'hoe')) {
            if (till(this.world, tile.tx, tile.ty)) tilledAny = true;
          }
          if (tilledAny) {
            const tier = tierOf(p, 'hoe');
            this.setToast(tier === 'wood' ? 'Tilled the soil.' : `Tilled (${tier}).`);
          } else {
            // Refund the cost — nothing actually happened.
            getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.till);
          }
        }
      }
      if (this.input.justPressed.has('w')) {
        if (!spendStamina(p, STAMINA_COST.water)) {
          this.setToast('Too tired to water. Sleep or sip cocoa (Z).');
        } else {
          let wateredAny = 0;
          for (const tile of tilesForTool(p, 'watering-can')) {
            if (water(this.world, tile.tx, tile.ty)) wateredAny++;
          }
          if (wateredAny > 0) {
            const tier = tierOf(p, 'watering-can');
            this.setToast(
              tier === 'wood'
                ? 'Watered the crop.'
                : `Watered ${wateredAny} crop${wateredAny === 1 ? '' : 's'} (${tier}).`,
            );
          } else {
            getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.water);
          }
        }
      }
      // ,  Upgrade the hoe at Maple's. Requires standing near the shop.
      // .  Upgrade the watering can. Same rules.
      if (this.input.justPressed.has(',') || this.input.justPressed.has('.')) {
        const tool: 'hoe' | 'watering-can' =
          this.input.justPressed.has(',') ? 'hoe' : 'watering-can';
        if (!this.isNearShop()) {
          this.setToast('Stand by Maple\u2019s shop to upgrade tools.');
        } else {
          const cost = upgradeCost(p, tool);
          const out = upgradeTool(p, tool);
          if (out.kind === 'upgraded') {
            if (cost) logGold(p, -cost, `${toolLabel(tool, out.to)} upgrade`, this.time.day);
            this.setToast(`Upgraded to ${toolLabel(tool, out.to)} (-${cost ?? 0}g).`);
          } else if (out.kind === 'max-tier') {
            this.setToast(`${toolLabel(tool, out.tier)} is already the best tier.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g (have ${out.have}g).`);
          }
        }
      }
      // /  Upgrade the pickaxe at Maple's. wood -> copper -> iron -> gold -> diamond.
      if (this.input.justPressed.has('/')) {
        if (!this.isNearShop()) {
          this.setToast('Stand by Maple\u2019s shop to upgrade the pickaxe.');
        } else {
          const cost = pickaxeUpgradeCost(p);
          const out = upgradePickaxe(p);
          if (out.kind === 'upgraded') {
            if (cost) logGold(p, -cost, `${pickaxeTierLabel(out.to)} upgrade`, this.time.day);
            this.setToast(`Upgraded to ${pickaxeTierLabel(out.to)} (-${cost ?? 0}g).`);
          } else if (out.kind === 'max-tier') {
            this.setToast(`${pickaxeTierLabel(out.tier)} is already the best tier.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g for the next pickaxe (have ${out.have}g).`);
          }
        }
      }
      // =  Upgrade the fishing rod at Maple's. wood -> copper -> iron -> gold.
      if (this.input.justPressed.has('=')) {
        if (!this.isNearShop()) {
          this.setToast('Stand by Maple\u2019s shop to upgrade the rod.');
        } else {
          const cost = rodUpgradeCost(p);
          const out = upgradeRod(p);
          if (out.kind === 'upgraded') {
            if (cost) logGold(p, -cost, `${rodTierLabel(out.to)} upgrade`, this.time.day);
            this.setToast(`Upgraded to ${rodTierLabel(out.to)} (-${cost ?? 0}g).`);
          } else if (out.kind === 'max-tier') {
            this.setToast(`${rodTierLabel(out.tier)} is already the best tier.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g for the next rod (have ${out.have}g).`);
          }
        }
      }
      // Plant on hotbar key (1..N) — uses front tile.
      for (let i = 0; i < CROP_KEYS.length; i++) {
        if (this.input.justPressed.has(String(i + 1))) {
          const key = CROP_KEYS[i];
          if (isPlantableTile(this.world, front.tx, front.ty) && (p.inventory[key] ?? 0) > 0) {
            if (plant(this.world, front.tx, front.ty, key, p)) {
              recordSown(p, key);
              recordLastSeed(p, key);
              this.setToast(`Planted ${key}.`);
              this.checkQuests({ kind: 'plant', cropKey: key });
            }
          }
        }
      }
      // E: prefer NPC interaction, else harvest, else sell-all-at-well
      if (this.input.justPressed.has('g')) {
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc && CANDIDATES[npc.id]) {
          const out = attemptAutoGift(p, npc.id, this.time.day, this.time);
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
            this.checkQuests({ kind: 'gift', npcId: npc.id, hearts: r.hearts });
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
        // If already engaged, P holds the wedding (no NPC needed — symbolic at the well).
        if (p.engagement) {
          const w = holdWedding(p, this.time.day);
          switch (w.kind) {
            case 'married': {
              const name = CANDIDATES[w.npcId]?.name ?? w.npcId;
              this.setToast(`💒 You married ${name}! Forever ${name} & you.`);
              this.checkQuests({ kind: 'marry', npcId: w.npcId });
              break;
            }
            case 'too-soon':
              this.setToast(`Wedding in ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'}.`);
              break;
            case 'already-married': {
              const name = CANDIDATES[w.toNpcId]?.name ?? w.toNpcId;
              this.setToast(`You're already married to ${name}.`);
              break;
            }
            case 'not-engaged':
              // unreachable — engagement was truthy above
              break;
          }
        } else {
          const npc = npcInFrontOf(this.world, front.tx, front.ty);
          if (npc) {
          const out = propose(p, npc.id, this.time.day);
          switch (out.kind) {
            case 'accepted':
              this.setToast(`💍 ${npc.name} said YES! You are engaged.`);
              this.checkQuests({ kind: 'gift', npcId: npc.id, hearts: 10 });
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
      }
      if (this.input.justPressed.has('e')) {
        // Pip's cart takes priority over NPC/harvest when the player
        // stands right next to it during open hours.
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        if (nearCart(px, py) && cartOpen(this.time)) {
          this.cartMenu.open();
          return;
        }
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc) {
          const h = p.hearts ? getHearts(p.hearts, npc.id) : 0;
          this.dialogue.open(npc.name, getRole(npc), getDialogue(npc, this.time.day, h));
          this.checkQuests({ kind: 'talk', npcId: npc.id });
          if (p.hearts && creditTalk(p.hearts, npc.id, this.time.day)) {
            // Tiny ambient feedback — only on the day's first chat.
            // (No toast — keeps the dialogue moment quiet.)
          }
        } else if (cropAt(this.world, front.tx, front.ty)) {
          // Try to harvest.
          const c = cropAt(this.world, front.tx, front.ty);
          const cropKey = c ? c.crop : '';
          const streak = (c as unknown as { waterStreak?: number } | undefined)?.waterStreak ?? 0;
          const quality = harvest(this.world, front.tx, front.ty, p);
          if (quality) {
            const flair =
              quality === 'gold' ? ' (gold-star! 2x)' : quality === 'silver' ? ' (silver-star, 1.5x)' : '';
            this.setToast(`Harvested ${cropKey}${flair}.`);
            if (cropKey) {
              recordHarvest(p, cropKey, quality, streak);
              this.checkQuests({ kind: 'harvest', cropKey });
            }
          }
        } else if (adjacentCoop(this.world, front.tx, front.ty) || adjacentCoop(this.world, Math.round(p.x), Math.round(p.y))) {
          // Collect eggs from a coop the player is standing next to.
          const coop =
            adjacentCoop(this.world, front.tx, front.ty) ??
            adjacentCoop(this.world, Math.round(p.x), Math.round(p.y))!;
          const collected = collectEggs(coop, p);
          if (collected > 0) {
            this.setToast(`Collected ${collected} egg${collected === 1 ? '' : 's'}.`);
          } else if (coop.chickens === 0) {
            this.setToast('No chickens yet — buy one and press I.');
          } else {
            this.setToast('Eggs come in the morning.');
          }
        } else {
          // Standing in front of the well? Sell all harvest as quick economy.
          // Standing in front of the inn? Sell all dishes for bigger gold.
          let handled = false;
          for (const b of this.world.buildings) {
            if (b.kind === 'well' && front.tx === b.x && front.ty === b.y) {
              const festBonus = cropSellMultiplier(this.time);
              const earned = sellAllHarvest(p, festBonus);
              const gemGold = sellAllGems(p);
              const forageGold = sellAllForage(p);
              const eggGold = sellAllEggs(p);
              const total = earned + gemGold + forageGold + eggGold;
              if (total > 0) {
                const parts: string[] = [];
                if (earned > 0) {
                  const tail = festBonus > 1 ? ' (festival x' + festBonus + ')' : '';
                  parts.push(`harvest +${earned}g${tail}`);
                  logGold(p, earned, festBonus > 1 ? 'well: harvest (festival)' : 'well: harvest', this.time.day);
                }
                if (gemGold > 0) {
                  parts.push(`gems +${gemGold}g`);
                  logGold(p, gemGold, 'well: gems', this.time.day);
                }
                if (forageGold > 0) {
                  parts.push(`forage +${forageGold}g`);
                  logGold(p, forageGold, 'well: forage', this.time.day);
                }
                if (eggGold > 0) {
                  parts.push(`eggs +${eggGold}g`);
                  logGold(p, eggGold, 'well: eggs', this.time.day);
                }
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
                logGold(p, earned, 'inn: dishes', this.time.day);
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

    // Multiplayer: broadcast our snapshot + resolve smoothed peer positions
    // for the upcoming render(). No-op when the driver is null.
    this.peerRenderables = tickMultiplayerFrame(
      this.multiplayer,
      this.world.player,
      typeof performance !== 'undefined' ? performance.now() : Date.now(),
    );
    if (this.multiplayer) {
      const tNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const events = this.multiplayer.drainEvents();
      if (events.length > 0) this.peerToasts.push(events, tNow);
    }
  }

  private render(): void {
    const settings = getSettings(this.world.player);
    this.renderer.draw(this.world, this.camera, this.timeOfDay, settings.nightTintScale);
    // Sprinklers — render after the world so they sit on top of crops/tiles
    // but below peers / HUD. Each sprinkler is a 14-ish px sprite anchored
    // to the centre of its tile.
    {
      const list = getSprinklers(this.world);
      for (const s of list) {
        const wx = s.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = s.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawSprinklerSprite(this.ctx, sx, sy, s.kind);
      }
    }
    // Forage — same layer as sprinklers but only on the daytime grass.
    {
      const list = getForage(this.world);
      for (const f of list) {
        const wx = f.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = f.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawForageSprite(this.ctx, sx, sy, f.kind);
      }
    }
    // Coops — chunky 2x2 building rendered after world tiles so it
    // sits visibly above the grass.
    {
      const list = getCoops(this.world);
      for (const c of list) {
        const cx = (c.tx + COOP_W / 2) * TILE_SIZE;
        const cy = (c.ty + COOP_H / 2) * TILE_SIZE;
        const { sx, sy } = this.camera.worldToScreen(cx, cy);
        drawCoopSprite(this.ctx, sx, sy, c, TILE_SIZE);
      }
    }
    // Greenhouses — translucent glass frame over tilled soil tiles.
    {
      const list = getGreenhouses(this.world);
      for (const g of list) {
        const cx = (g.tx + GREENHOUSE_W / 2) * TILE_SIZE;
        const cy = (g.ty + GREENHOUSE_H / 2) * TILE_SIZE;
        const { sx, sy } = this.camera.worldToScreen(cx, cy);
        drawGreenhouseSprite(this.ctx, sx, sy, TILE_SIZE);
      }
    }
    // Chests — small wooden + brass-band sprites placed on grass.
    {
      const list = getChests(this.world);
      for (const c of list) {
        const wx = c.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = c.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawChestSprite(this.ctx, sx, sy);
      }
    }
    // Pip's travelling cart — visible only during the visit-day open
    // hours. Rendered above chests so the awning sits clean over the
    // plaza tiles.
    if (cartOpen(this.time)) {
      const wx = CART_X * TILE_SIZE + TILE_SIZE / 2;
      const wy = CART_Y * TILE_SIZE + TILE_SIZE / 2;
      const { sx, sy } = this.camera.worldToScreen(wx, wy);
      drawCartSprite(this.ctx, sx, sy, TILE_SIZE);
    }
    // Farm dog — drawn after coops so it appears in front of them.
    {
      const dog = getDog(this.world);
      if (dog.owned) {
        const wx = dog.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = dog.y * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        const facingRight = this.world.player.x >= dog.x;
        drawDogSprite(this.ctx, sx, sy, facingRight);
      }
    }
    // Farm cat — perched on the farmhouse roof.
    {
      const cat = getCat(this.world);
      if (cat.owned) {
        const wx = cat.x * TILE_SIZE + TILE_SIZE / 2;
        // Render the cat a few pixels HIGHER than the tile centre so it
        // visually sits on top of the farmhouse roof rather than inside it.
        const wy = cat.y * TILE_SIZE + TILE_SIZE / 2 - 8;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawCatSprite(this.ctx, sx, sy);
      }
    }
    if (this.peerRenderables.length > 0) {
      this.renderer.drawPeers(this.peerRenderables, this.camera, this.multiplayer?.mutes);
    }
    drawHUD(this.ctx, this.world.player, this.time, this.canvas.width, this.canvas.height, settings.hudScale);
    drawStaminaBar(this.ctx, this.world.player, this.canvas.width, settings.hudScale);
    drawWeatherStrip(this.ctx, this.time, this.canvas.width);
    drawBirthdayBanner(this.ctx, this.time, this.canvas.width);
    drawFestivalBanner(this.ctx, this.time, this.canvas.width);
    // Rain overlay sits between the world and the HUD chrome so it darkens
    // the village but not the on-screen text. Only render when the active
    // weather actually drops water — and skip when reduce-motion is on.
    {
      const today = weatherToday(this.time);
      if (WEATHER[today].watersCrops && !settings.reduceMotion) {
        const intense = today === 'storm';
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        drawRainOverlay(this.ctx, this.canvas.width, this.canvas.height, intense, now);
      }
    }
    // Snow overlay — only in Winter, only when reduce-motion is off.
    // Layered on top of rain so a stormy Winter day reads as snow-driven.
    if (isFrozenSeason(this.time) && !settings.reduceMotion) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      drawSnowOverlay(this.ctx, this.canvas.width, this.canvas.height, now);
    }
    if (this.multiplayer) {
      drawPeerBadge(this.ctx, {
        peerCount: this.multiplayer.session.registry.size(),
        canvasW: this.canvas.width,
      });
      drawMuteBadge(this.ctx, {
        mutedCount: this.multiplayer.mutes.size(),
        canvasW: this.canvas.width,
      });
      {
        const roster = buildPeerRoster(this.multiplayer.session.registry.list(), {
          localX: this.world.player.x,
          localY: this.world.player.y,
          now: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        });
        const summary = summarizeRoster(roster);
        const tone = rosterTone(summary);
        drawPeerRosterPanel(this.ctx, { entries: roster, canvasW: this.canvas.width, tone });
        drawRosterSubtitle(this.ctx, {
          text: formatRosterSummary(summary),
          canvasW: this.canvas.width,
          tone,
        });
      }
      this.peerToasts.draw(
        this.ctx,
        this.canvas.width,
        typeof performance !== 'undefined' ? performance.now() : Date.now(),
      );
      drawEmoteLegend(this.ctx, {
        canvasW: this.canvas.width,
        canvasH: this.canvas.height,
      });
      if (this.peerRenderables.length > 0) {
        drawPeerBubbles(this.ctx, {
          peers: this.peerRenderables,
          source: this.multiplayer,
          camera: this.camera,
          now: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        });
      }
    }
    drawHeartsPanel(this.ctx, this.world.player, this.canvas.width, this.heartsPanelVisible);
    this.recipeCodex.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.cropJournal.draw(this.ctx, this.world.player, this.time, this.canvas.width, this.canvas.height);
    this.achievements.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.moneyLogPanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.questLogPanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.settingsPanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.lorePanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.dialogue.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.cookingMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.sleepSummary.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.chestMenu.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.cartMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);

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
