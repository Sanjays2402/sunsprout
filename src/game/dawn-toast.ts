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
