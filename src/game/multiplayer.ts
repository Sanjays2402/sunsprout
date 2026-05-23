// Multiplayer foundation — v0.6.0 first slice.
//
// Pure state module: types + snapshot serialize / deserialize / apply. No
// network transport, no WebSocket, no UI. A later tick wires this onto a
// real transport (likely WebRTC datachannel for serverless co-op, per the
// "no backend" DECISIONS rule).
//
// A "peer" is a remote player on the same farm. We track only what the
// renderer needs to draw them: tile position, facing, name, and an
// optional color/hat for distinguishability. State is intentionally tiny
// so snapshots fit in a single packet.

import type { Facing } from '../world/world';

/** Snapshot wire-format version. Bumped when fields change. */
export const PEER_SNAPSHOT_VERSION = 1;

/** Minimum/maximum world tile coords we accept in a snapshot. */
const MAX_TILE = 1024;

export interface PeerPlayer {
  /** Stable peer id (uuid-ish string assigned at handshake). */
  id: string;
  /** Display name shown above the sprite. */
  name: string;
  /** Tile-space coords. Fractional during interpolation. */
  x: number;
  y: number;
  facing: Facing;
  /** Sprite tint, hex string. */
  color: string;
  /** Hat tint, hex string. */
  hat: string;
  /** ms timestamp of the last snapshot we applied. */
  lastSeenAt: number;
}

export interface PeerSnapshot {
  v: number;
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  color: string;
  hat: string;
}

/** Container the renderer reads from. Local player is NOT in this list. */
export class PeerRegistry {
  private peers = new Map<string, PeerPlayer>();

  list(): PeerPlayer[] {
    return Array.from(this.peers.values());
  }

  get(id: string): PeerPlayer | undefined {
    return this.peers.get(id);
  }

  has(id: string): boolean {
    return this.peers.has(id);
  }

  size(): number {
    return this.peers.size;
  }

  remove(id: string): boolean {
    return this.peers.delete(id);
  }

  clear(): void {
    this.peers.clear();
  }

  /** Apply a snapshot. Returns true if peer was newly created. */
  apply(snap: PeerSnapshot, now: number): boolean {
    if (!isValidSnapshot(snap)) return false;
    const existing = this.peers.get(snap.id);
    if (existing) {
      existing.name = snap.name;
      existing.x = snap.x;
      existing.y = snap.y;
      existing.facing = snap.facing;
      existing.color = snap.color;
      existing.hat = snap.hat;
      existing.lastSeenAt = now;
      return false;
    }
    this.peers.set(snap.id, {
      id: snap.id,
      name: snap.name,
      x: snap.x,
      y: snap.y,
      facing: snap.facing,
      color: snap.color,
      hat: snap.hat,
      lastSeenAt: now,
    });
    return true;
  }

  /** Drop peers we haven't heard from in `timeoutMs`. Returns removed ids. */
  evictStale(now: number, timeoutMs: number): string[] {
    const out: string[] = [];
    for (const [id, p] of this.peers) {
      if (now - p.lastSeenAt > timeoutMs) out.push(id);
    }
    for (const id of out) this.peers.delete(id);
    return out;
  }
}

/** Serialize a snapshot to a wire string. JSON for now; switch to binary later. */
export function serializeSnapshot(snap: PeerSnapshot): string {
  return JSON.stringify(snap);
}

/** Parse a wire string. Returns null on malformed/invalid payloads. */
export function deserializeSnapshot(raw: string): PeerSnapshot | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const snap: PeerSnapshot = {
    v: typeof o.v === 'number' ? o.v : -1,
    id: typeof o.id === 'string' ? o.id : '',
    name: typeof o.name === 'string' ? o.name : '',
    x: typeof o.x === 'number' ? o.x : NaN,
    y: typeof o.y === 'number' ? o.y : NaN,
    facing: (o.facing as Facing) ?? 'down',
    color: typeof o.color === 'string' ? o.color : '#cccccc',
    hat: typeof o.hat === 'string' ? o.hat : '#888888',
  };
  return isValidSnapshot(snap) ? snap : null;
}

function isValidSnapshot(s: PeerSnapshot): boolean {
  if (s.v !== PEER_SNAPSHOT_VERSION) return false;
  if (!s.id || s.id.length > 64) return false;
  if (!s.name || s.name.length > 32) return false;
  if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return false;
  if (s.x < -MAX_TILE || s.x > MAX_TILE) return false;
  if (s.y < -MAX_TILE || s.y > MAX_TILE) return false;
  if (s.facing !== 'up' && s.facing !== 'down' && s.facing !== 'left' && s.facing !== 'right') {
    return false;
  }
  return true;
}

/** Build a snapshot from a local player + identity. Helper for the future transport tick. */
export function buildSnapshot(opts: {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  color: string;
  hat: string;
}): PeerSnapshot {
  return {
    v: PEER_SNAPSHOT_VERSION,
    id: opts.id,
    name: opts.name,
    x: opts.x,
    y: opts.y,
    facing: opts.facing,
    color: opts.color,
    hat: opts.hat,
  };
}
