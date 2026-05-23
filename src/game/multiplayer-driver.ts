// Multiplayer driver — v0.6.0 tenth slice (extended w/ emotes in nineteenth).
//
// Thin glue object: owns a MultiplayerSession + PeerView + PeerEmotes and
// exposes the small per-frame surface that engine/game.ts needs:
//   - tick(local, now) → broadcasts the local snapshot and evicts stale peers
//   - peers(now)       → returns smoothed PeerRenderables to draw
//   - emoteFor(id, now)→ active emote bubble for a peer (or undefined)
//   - sendEmote(kind)  → broadcast an emote from the local player
//
// Pulled into its own module so the Game class doesn't have to know about
// session/view/emote wiring details and so we can unit-test the per-frame
// loop without instantiating the renderer or a real BroadcastChannel.

import type { MultiplayerSession, LocalState } from './multiplayer-session';
import type { PeerView, PeerRenderable } from './peer-view';
import { PeerPresenceLog, type PeerEvent } from './peer-events';
import { PeerEmotes, type ActiveEmote, type EmoteKind } from './peer-emotes';
import { bindTransportToEmotes, broadcastEmote } from './emote-transport';

export interface MultiplayerDriverOpts {
  session: MultiplayerSession;
  view: PeerView;
  /** Optional presence log — injected in tests; one is created if omitted. */
  presence?: PeerPresenceLog;
  /** Optional emotes store — injected in tests; one is created if omitted. */
  emotes?: PeerEmotes;
}

export class MultiplayerDriver {
  readonly session: MultiplayerSession;
  readonly view: PeerView;
  readonly presence: PeerPresenceLog;
  readonly emotes: PeerEmotes;
  /** Cumulative count of broadcasts since construction — handy for tests. */
  private _ticks = 0;
  /** Events produced by the most recent tick(). Drained by drainEvents(). */
  private _lastEvents: PeerEvent[] = [];
  private _unbindEmotes: () => void;

  constructor(opts: MultiplayerDriverOpts) {
    this.session = opts.session;
    this.view = opts.view;
    this.presence = opts.presence ?? new PeerPresenceLog();
    this.emotes = opts.emotes ?? new PeerEmotes();
    // Seed with whatever peers already exist so we don't fire spurious joins
    // for sessions we attach to mid-flight.
    this.presence.seed(this.session.registry);
    // Subscribe to inbound emote events on the session's transport. The
    // snapshot path uses a different demux upstream, so this listener only
    // reacts to emote-tagged payloads.
    this._unbindEmotes = bindTransportToEmotes(this.session.transport, this.emotes);
  }

  /** True once the underlying session has been closed. */
  get closed(): boolean {
    return this.session.closed;
  }

  /** Tick count; one per non-closed tick() call. */
  get ticks(): number {
    return this._ticks;
  }

  /**
   * Drive the session forward one frame. Returns the list of peer ids that
   * were evicted this tick (stale, no snapshot within peerTimeoutMs). The
   * caller can ignore the return value in most cases — it's exposed so the
   * Game can surface a toast when a friend disconnects.
   */
  tick(local: LocalState, now: number): string[] {
    if (this.session.closed) return [];
    this._ticks++;
    const evicted = this.session.update(local, now);
    this._lastEvents = this.presence.diff(this.session.registry, now);
    // Forget emote bubbles for peers that just left so a re-join doesn't
    // briefly inherit an old emote.
    for (const ev of this._lastEvents) {
      if (ev.kind === 'leave') this.emotes.forget(ev.id);
    }
    return evicted;
  }

  /** Pull and clear the queue of join/leave events recorded since the last
   *  call. Empty on the happy path. Callers pump these into PeerToasts. */
  drainEvents(): PeerEvent[] {
    const out = this._lastEvents;
    this._lastEvents = [];
    return out;
  }

  /** Resolve smoothed render positions for every visible peer. */
  peers(now: number): PeerRenderable[] {
    return this.view.viewAt(this.session.registry, now);
  }

  /** Active emote bubble for a peer (local or remote), or undefined. */
  emoteFor(peerId: string, now: number): ActiveEmote | undefined {
    return this.emotes.activeFor(peerId, now);
  }

  /**
   * Broadcast an emote from the local player and immediately echo it into
   * our own emote store so the local player sees their own bubble (the
   * loopback transport doesn't deliver to the sender by design).
   */
  sendEmote(kind: EmoteKind, now: number): void {
    if (this.session.closed) return;
    broadcastEmote(this.session.transport, this.session.identity.id, kind);
    this.emotes.push(this.session.identity.id, kind, now);
  }

  close(): void {
    this._unbindEmotes();
    this.session.close();
    this.view.clear();
    this.emotes.clear();
  }
}
