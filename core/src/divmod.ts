// THE single division site in core/ (AC1a.4).
//
// Every other module in core/ is forbidden from using `/`, Math.round/floor/ceil/trunc,
// `| 0`, `>>> 0`, parseInt or toFixed. One definition, any number of call sites.

/**
 * Floored division with a non-negative remainder.
 *
 * Returns `{ q, r }` with `n === q * d + r` and `0 <= r < d`, exactly, for integer `n` and
 * positive integer `d` with `|n| < Number.MAX_SAFE_INTEGER`.
 *
 * The correction step is not defensive padding: `Math.floor(n / d)` performs the division in
 * IEEE-754 doubles and can land one off for large operands. `n - q * d` is exact whenever both
 * products stay inside the safe-integer range, so correcting on the remainder makes the result
 * exact regardless of how the float division rounded.
 */
export function divmod(n: number, d: number): { q: number; r: number } {
  let q = Math.floor(n / d);
  let r = n - q * d;
  if (r < 0) {
    q -= 1;
    r += d;
  } else if (r >= d) {
    q += 1;
    r -= d;
  }
  return { q, r };
}
