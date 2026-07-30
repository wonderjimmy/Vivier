// Deterministic replay of a timestamped event list.
//
// DECLARED ORDERING AND INTERVAL CONVENTIONS (AC1a.8 — written down before being tested, so
// that "deterministic" cannot be confused with "defined"):
//
//   1. Events are sorted by `atMs` with a STABLE sort. Two events at an identical timestamp
//      keep their input order. Sorting is a normalisation, not an error: an out-of-order list
//      from a UI that batches input is a real case, and silently dropping or rejecting it would
//      lose the owner's care rather than record it.
//   2. An event with `atMs` before `initial.tMs` is a ReplayError. The past is not editable —
//      accepting it would let a caller rewrite history the pet has already lived.
//   3. An event at exactly `initial.tMs` is applied before any time advances.
//   4. An event at exactly `untilMs` IS applied — the interval is closed at its end for events.
//   5. An event coincident with an internal gate crossing or clamp saturation: time advances to
//      the event's timestamp first (completing that segment), then the event applies. Events
//      never take effect inside a sub-interval.

import { ReplayError, type Event, type LoadedConfig, type State } from '../types.ts';
import { advance } from './advance.ts';
import { apply } from './events.ts';

export function replay(
  loaded: LoadedConfig,
  initial: State,
  events: readonly Event[],
  untilMs: number,
): State {
  if (!Number.isInteger(untilMs)) {
    throw new ReplayError(`untilMs must be an integer, got ${untilMs}`);
  }
  if (untilMs < initial.tMs) {
    throw new ReplayError(`untilMs ${untilMs} is before the initial state's time ${initial.tMs}`);
  }
  for (const event of events) {
    if (!Number.isInteger(event.atMs)) {
      throw new ReplayError(`event atMs must be an integer, got ${event.atMs}`);
    }
    if (event.atMs < initial.tMs) {
      throw new ReplayError(
        `event at ${event.atMs} predates the initial state's time ${initial.tMs}`,
      );
    }
  }
  // Convention 1: stable sort. Array.prototype.sort is required to be stable by the language
  // spec, so equal timestamps keep input order without a decorating index.
  const ordered = [...events].sort((a, b) => a.atMs - b.atMs);

  let state = initial;
  for (const event of ordered) {
    if (event.atMs > untilMs) break;
    state = advance(loaded, state, event.atMs - state.tMs);
    state = apply(loaded, state, event.kind);
  }
  return advance(loaded, state, untilMs - state.tMs);
}
