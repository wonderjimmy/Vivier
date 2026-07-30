// Vivier simulation core — the pure layer.
//
// Constitution law 1: no I/O, no rendering, no hardware, no ambient time, no randomness.
// Time enters as an explicit argument; the platform tells the core how much time has passed
// rather than the core asking what time it is (law 2).
//
// AC1a.12: this layer is randomness-free. There is no PRNG and no seed parameter. Entropy
// consumed as a function of elapsed time would make step-size independence unsatisfiable,
// because re-chunking an interval changes the draw count. A later phase that needs randomness
// introduces it at discrete event resolution, with its own criteria.

export { loadConfig } from './config.ts';
export { advance } from './sim/advance.ts';
export { apply, initialState, interactionKinds } from './sim/events.ts';
export { replay } from './sim/replay.ts';
export { isGateOpen, netRates, signature } from './sim/rules.ts';
export {
  AdvanceError,
  ConfigError,
  ReplayError,
  type Config,
  type Event,
  type Gate,
  type LoadedConfig,
  type Rule,
  type State,
  type StatId,
  type StatSpec,
} from './types.ts';
