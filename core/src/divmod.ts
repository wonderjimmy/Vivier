// THE single division site in core/ (AC1a.4).
//
// Every other module in core/ is forbidden from using `/`, Math.round/floor/ceil/trunc,
// `| 0`, `>>> 0`, parseInt or toFixed. One definition, any number of call sites.

/**
 * Floored division with a non-negative remainder, exact on its stated domain.
 *
 * Returns `{ q, r }` with `n === q * d + r` and `0 <= r < d`, for integer `n` and positive
 * integer `d` satisfying `|n| + d <= Number.MAX_SAFE_INTEGER`. Outside that domain it throws.
 *
 * An earlier version instead "corrected" the result when `n - q * d` fell outside `[0, d)`.
 * That was worse than useless, and the mutation gate is what exposed it: no test could kill the
 * correction branches, because a search over the whole safe-integer range found they NEVER fire
 * inside the domain — while outside it they produce silently wrong answers. `q * d` can exceed
 * 2^53 even when `n` does not, so the correction's own arithmetic is inexact exactly where it
 * claims to be repairing inexactness. Failing loudly beats being confidently wrong
 * (constitution: show real errors, never fake success).
 *
 * `advance` can never reach the guard: `loadConfig` derives `maxAdvanceMs` so that every
 * intermediate stays inside this domain, and that relationship is asserted by test.
 */
export function divmod(n: number, d: number): { q: number; r: number } {
  const magnitude = n < 0 ? -n : n;
  if (magnitude + d > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`divmod(${n}, ${d}): outside the exact-integer domain`);
  }
  const q = Math.floor(n / d);
  return { q, r: n - q * d };
}
