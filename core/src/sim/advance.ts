// Time integration with exact discrete-event segmentation.
//
// The whole design follows from AC1a.1: folding `advance` over any partition of Δ must give a
// value-identical state to one call over Δ. Two consequences, both load-bearing:
//
//   * No per-step rounding. Rates are integers in the stat's own unit scale and every division
//     carries its remainder back into STATE (not into a module-level accumulator — see AC1a.3),
//     so splitting an interval never loses a fraction.
//   * No evaluating a whole Δ in one shot when the rate set can change inside it. `advance`
//     ends each sub-interval at the exact millisecond the state's categorical shape changes —
//     a gate flipping OR a stat reaching a bound.
//
// The boundary is found by binary search rather than a closed-form solve. That is deliberate:
// the search is correct by monotonicity (with rates held constant, each stat moves monotonically,
// so each gate flips at most once and each bound is reached at most once), whereas a hand-derived
// closed form is exactly the kind of algebra that hides an off-by-one. The reference module used
// to build the corpus derives its crossing times independently, so if either is wrong they
// disagree and the build fails.

import { divmod } from '../divmod.ts';
import { AdvanceError, type Config, type LoadedConfig, type State, type StatId } from '../types.ts';
import { netRates, signature } from './rules.ts';

const HALF = 2;

function integrate(
  config: Config,
  s: State,
  dt: number,
  rates: Readonly<Record<StatId, number>>,
): State {
  const stats: Record<StatId, number> = {};
  const rem: Record<StatId, number> = {};
  for (const id of Object.keys(config.stats)) {
    const spec = config.stats[id];
    const { q, r } = divmod(rates[id] * dt + s.rem[id], config.denominator);
    let v = s.stats[id] + q;
    if (v < spec.min) v = spec.min;
    else if (v > spec.max) v = spec.max;
    stats[id] = v;
    rem[id] = r;
  }
  return {
    schemaVersion: s.schemaVersion,
    tMs: s.tMs + dt,
    ageMs: s.ageMs + dt,
    stats,
    rem,
  };
}

/**
 * Smallest `dt` in `[1, maxDt]` at which the state's categorical signature differs from now.
 * Returns `maxDt` when nothing changes within the interval.
 */
function firstChange(
  config: Config,
  s: State,
  rates: Readonly<Record<StatId, number>>,
  maxDt: number,
): number {
  const here = signature(config, s.stats);
  if (signature(config, integrate(config, s, maxDt, rates).stats) === here) return maxDt;
  let lo = 1;
  let hi = maxDt;
  while (lo < hi) {
    const mid = divmod(lo + hi, HALF).q;
    if (signature(config, integrate(config, s, mid, rates).stats) === here) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Advance the pet by `elapsedMs` of real time.
 *
 * The core never asks what time it is — the platform tells it how much time has passed
 * (constitution law 2). `elapsedMs` of 0 returns a value-identical state; a negative value
 * throws rather than ageing the pet backwards.
 */
export function advance(loaded: LoadedConfig, s: State, elapsedMs: number): State {
  if (!Number.isInteger(elapsedMs)) {
    throw new AdvanceError(`elapsedMs must be an integer, got ${elapsedMs}`);
  }
  if (elapsedMs < 0) {
    throw new AdvanceError(`elapsedMs must not be negative, got ${elapsedMs}`);
  }
  if (elapsedMs > loaded.maxAdvanceMs) {
    throw new AdvanceError(
      `elapsedMs ${elapsedMs} exceeds maxAdvanceMs ${loaded.maxAdvanceMs}; ` +
        'advancing further would leave the safe-integer range',
    );
  }
  const config = loaded.config;
  let state = s;
  let remaining = elapsedMs;
  let segments = 0;
  while (remaining > 0) {
    if (++segments > config.maxSegments) {
      throw new AdvanceError(
        `exceeded maxSegments (${config.maxSegments}); the tuning config oscillates a gate`,
      );
    }
    const rates = netRates(config, state.stats);
    const dt = firstChange(config, state, rates, remaining);
    state = integrate(config, state, dt, rates);
    remaining -= dt;
  }
  return state;
}
