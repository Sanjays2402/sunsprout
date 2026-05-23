// Multiplayer driver — v0.6.0 tenth slice.
//
// Thin glue object: owns a MultiplayerSession + PeerView and exposes the
// two-call surface that engine/game.ts needs each frame:
//   - tick(local, now) → broadcasts the local snapshot and evicts stale peers
//   - peers(registry, now) → returns smoothed PeerRenderables to draw
//
// Pulled into its own module so the Game class doesn't have to know about
// session/view wiring details and so we can unit-test the per-frame loop
// without instantiating the renderer or a real BroadcastChannel.

import type { MultiplayerSession, LocalState } from './multiplayer-session';
import type { PeerView, PeerRenderable } from './peer-view';

export interface MultiplayerDriverOpts {
  session: MultiplayerSession;
  view: PeerView;
}

export class MultiplayerDriver {
  readonly session: MultiplayerSession;
  readonly view: PeerView;
  /** Cumulative count of broadcasts since construction — handy for tests. */
  private _ticks = 0;

  constructor(opts: MultiplayerDriverOpts) {
    this.session = opts.session;
    this.view = opts.view;
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
    return this.session.update(local, now);
  }

  /** Resolve smoothed render positions for every visible peer. */
  peers(now: number): PeerRenderable[] {
    return this.view.viewAt(this.session.registry, now);
  }

  close(): void {
    this.session.close();
    this.view.clear();
  }
}
