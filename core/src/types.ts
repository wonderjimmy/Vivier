// Core domain types. No behaviour, no constants.

export type StatId = string;

/**
 * The complete simulation state. AC1a.3: anything that survives across an `advance` call is a
 * field here. In particular `rem` — the sub-unit remainder carried per stat — is state, not a
 * hidden accumulator, because otherwise a save/restore round-trip would silently lose it and
 * two identically-treated pets would drift apart.
 */
export interface State {
  readonly schemaVersion: number;
  /** Simulation clock, milliseconds. Supplied by the platform; the core never reads a clock. */
  readonly tMs: number;
  /** Time this pet has been alive, milliseconds. */
  readonly ageMs: number;
  /** Stat values in milli-units. Always integers, always within their configured range. */
  readonly stats: Readonly<Record<StatId, number>>;
  /** Per-stat remainder numerators. Always integers in `[0, denominator)`. */
  readonly rem: Readonly<Record<StatId, number>>;
}

export type GateOp = 'gte' | 'lte';

export interface Gate {
  readonly stat: StatId;
  readonly op: GateOp;
  readonly value: number;
}

export interface Rule {
  readonly id: string;
  readonly stat: StatId;
  /** Milli-units per hour. May be negative. */
  readonly ratePerHour: number;
  readonly gate: Gate | null;
}

export interface StatSpec {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

export interface InteractionEffect {
  readonly stat: StatId;
  readonly delta: number;
}

export interface Config {
  readonly schemaVersion: number;
  /** Rate denominator: rates are milli-units per `denominator` milliseconds. */
  readonly denominator: number;
  readonly maxSegments: number;
  readonly stats: Readonly<Record<StatId, StatSpec>>;
  readonly rules: readonly Rule[];
  readonly interactions: Readonly<Record<string, readonly InteractionEffect[]>>;
}

/** A validated config plus the bounds derived from it at load time. */
export interface LoadedConfig {
  readonly config: Config;
  /** AC1a.6: largest `Δ` for which no intermediate can leave the safe-integer range. */
  readonly maxAdvanceMs: number;
}

export interface Event {
  readonly atMs: number;
  readonly kind: string;
}

export class ConfigError extends Error {
  readonly key: string;
  constructor(key: string, message: string) {
    super(`${key}: ${message}`);
    this.name = 'ConfigError';
    this.key = key;
  }
}

export class AdvanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvanceError';
  }
}

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}
