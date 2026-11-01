/**
 * At most `max` requests in any window of `perMs`. `reserve` books the next free slot and says how long to wait for it (0 when it is free now):
 * requests booked together are spaced, so the limit holds however many are waiting.
 */
export function rateLimiter(max: number, perMs: number, now: () => number) {
  const slots: number[] = [];
  return {
    reserve(): number {
      const cutoff = now() - perMs;
      while (slots.length > 0 && slots[0] <= cutoff) slots.shift();
      // The slot after the `max`-th most recent one opens a window later.
      const at = slots.length < max ? now() : slots[slots.length - max] + perMs;
      slots.push(at);
      return Math.max(0, at - now());
    },
  };
}
