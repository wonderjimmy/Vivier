// Interaction events. Instantaneous: an event changes stats, never time.

import { ReplayError, type Config, type LoadedConfig, type State, type StatId } from '../types.ts';

/** The initial state for a newborn pet, taken entirely from the config. */
export function initialState(loaded: LoadedConfig, startedAtMs: number): State {
  if (!Number.isInteger(startedAtMs)) {
    throw new ReplayError(`startedAtMs must be an integer, got ${startedAtMs}`);
  }
  const stats: Record<StatId, number> = {};
  const rem: Record<StatId, number> = {};
  for (const id of Object.keys(loaded.config.stats)) {
    stats[id] = loaded.config.stats[id].initial;
    rem[id] = 0;
  }
  return { schemaVersion: loaded.config.schemaVersion, tMs: startedAtMs, ageMs: 0, stats, rem };
}

/**
 * Apply one interaction. Effects are summed first and clamped once per stat, matching the
 * composition rule used during integration — so an interaction near a bound behaves the same
 * way a rule does, rather than depending on the order its effects happen to be listed in.
 */
export function apply(loaded: LoadedConfig, s: State, kind: string): State {
  const effects = loaded.config.interactions[kind];
  if (effects === undefined) {
    throw new ReplayError(`unknown interaction "${kind}"`);
  }
  const deltas: Record<StatId, number> = {};
  for (const effect of effects) {
    deltas[effect.stat] = (deltas[effect.stat] ?? 0) + effect.delta;
  }
  const stats: Record<StatId, number> = {};
  for (const id of Object.keys(loaded.config.stats)) {
    const spec = loaded.config.stats[id];
    let v = s.stats[id] + (deltas[id] ?? 0);
    if (v < spec.min) v = spec.min;
    else if (v > spec.max) v = spec.max;
    stats[id] = v;
  }
  return { schemaVersion: s.schemaVersion, tMs: s.tMs, ageMs: s.ageMs, stats, rem: { ...s.rem } };
}

export function interactionKinds(config: Config): string[] {
  return Object.keys(config.interactions);
}
