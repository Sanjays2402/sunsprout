// Dawn-toast composer — assemble the day-rollover headline with any
// number of optional tails.
//
// Why this exists: the engine's dawn rollover branch has accumulated
// a growing chain of "if (tail) headline = `${headline} · ${tail}`"
// ternaries — pondOverflow, haulRecap, compostNudge — and each new
// dawn surface (deep-vein brag, future seasonal callouts) adds one
// more ternary on the headline string. By tick #23 the chain was at
// 4 conditional appends; the roadmap observation #2 flagged retiring
// it before it hit 6. assembleDawnToast() is the generic gate: every
// tail flows through the same join logic, the engine code shrinks
// from N ternaries to one call, and adding the next tail is a single
// array push.
//
// The separator is a U+00B7 middle dot (" · ") to match the existing
// dawn-headline aesthetic — a thin glyph that reads as a soft pause
// without screaming punctuation. Pure module: no IO, no canvas, no
// engine coupling.

/**
 * Compose the dawn-toast headline with an arbitrary number of tail
 * strings, skipping any empty / null / undefined entries. Returns a
 * string of the form:
 *
 *   "headline · tail1 · tail2 · tail3"
 *
 * When `tails` is empty (or contains only empties), returns the
 * headline alone — no trailing separator, no double spaces.
 *
 * Order of tails in the array IS the order they appear in the final
 * string, so callers pin the "pondOverflow first, haulRecap second,
 * compostNudge third, deepVeinBrag fourth" sequence by argument order.
 *
 * Pure: doesn't mutate its inputs, doesn't depend on time or state.
 */
export function assembleDawnToast(
  headline: string,
  tails: ReadonlyArray<string | null | undefined>,
): string {
  let out = headline;
  for (const tail of tails) {
    if (!tail) continue;
    out = `${out} · ${tail}`;
  }
  return out;
}

// ---------------------------------------------------------------------
// oneShotBrag — generic helper for the sticky-flag dawn-brag pattern.
//
// Observation #4 from tick #30: three+ achievements in tree (deep-vein,
// chain-tier, plus two more landing this tick) all share a near-
// identical shape: a `*Pending` field is set by the action-side helper
// when a milestone crossing fires, and a `*DawnBrag` function reads +
// clears it on the next dawn so a player who skips a day doesn't see
// the same brag re-emit. An optional `*Fired` audit flag stays sticky
// so reloaded saves know the brag has already played.
//
// Without this helper, each new brag duplicates the same 6-7 lines:
// guard on pending, clear the pending flag, set the fired flag, render
// the readout, return. With the helper, a new brag is one call and a
// tiny render function — the next sticky-flag tail lands as a single
// branch in the engine compose array.
//
// Pure: doesn't know about MineHaulState, OwlStampBook, or any other
// specific carrier — works on any object with optional numeric/boolean
// fields. The pendingKey is widened to accept any value the carrier
// holds so the helper covers numeric-pending arms (e.g. the chain-
// tier brag stores the multiplier as the pending value) AND boolean
// arms (e.g. the deep-vein brag).
// ---------------------------------------------------------------------

/**
 * Resets the `pendingKey` field on `carrier` to `undefined`, sets the
 * optional `firedKey` field to `true`, and returns the result of
 * `render(pending)` — where `pending` is the value the pending field
 * held BEFORE the reset. Returns the empty string when the pending
 * field is falsy (no pending crossing).
 *
 * One-shot semantics: subsequent calls return the empty string until
 * a fresh crossing arms the pending flag again. Survives reload via
 * persistence — callers store the pending field as part of the
 * carrier's snapshot so a save reloaded mid-pending-state surfaces
 * the brag on the next dawn rather than swallowing it.
 *
 * The render callback can return the empty string even when pending
 * is truthy (e.g. a corrupted state with no matching label table
 * entry); in that case the helper still clears the pending flag so
 * the bad state doesn't haunt subsequent dawns. The fired flag is
 * still set so the audit trail records "we tried and resolved this".
 *
 * Type-wise: pendingKey + firedKey are typed as `keyof T` so a
 * caller can't pass a typo'd key, and `render` receives the actual
 * pending value (defaults to `unknown` so callers narrow it inside
 * their render lambda).
 *
 * @example
 *   const tail = oneShotBrag(
 *     state,
 *     'deepVeinBragPending',
 *     'deepVeinBragFired',
 *     () => `Deep Vein unlocked - ${state.bestRun!.count} gems...`,
 *   );
 */
export function oneShotBrag<T extends Record<string, unknown>>(
  carrier: T,
  pendingKey: keyof T,
  firedKey: keyof T | null,
  render: (pending: T[keyof T]) => string,
): string {
  const pending = carrier[pendingKey];
  if (!pending) return '';
  // Clear pending whether or not render produces text — a bad pending
  // value should still reset cleanly so it doesn't haunt subsequent
  // dawns. The carrier's pending field is widened to optional so the
  // `undefined` assignment lines up with the schema.
  (carrier as Record<string, unknown>)[pendingKey as string] = undefined;
  if (firedKey !== null) {
    (carrier as Record<string, unknown>)[firedKey as string] = true;
  }
  return render(pending);
}
