// INDEPENDENT REFERENCE IMPLEMENTATION — AC1a.9.
//
// This module must import NOTHING from core/. The import-graph assertion in
// tools/check-imports.mjs fails the build if it ever does. It receives the validated config as
// a plain object from the corpus generator, which is what keeps AC1a.14's "config enters through
// one door" true without creating an import edge.
//
// Two oracles live here, deliberately using different algorithms from core/:
//
//   brute()  — steps 1 ms at a time and re-evaluates everything every millisecond. Dead simple,
//              obviously correct, far too slow for long spans. Used for vectors up to ~1 hour.
//   closed() — solves each segment's end time ALGEBRAICALLY. core/ finds the same boundary by
//              binary search. If either the algebra or the search has an off-by-one, the two
//              disagree and the build fails.
//
// AC1a.9 also requires >= 10 vectors in range of BOTH, cross-checked against each other.
//
// Honest limit, restated from the criterion: this is an independent ALGORITHM, not an
// independent AUTHOR. It cannot catch a misreading of the spec shared by both.

type StatId = string;
interface Gate { stat: StatId; op: 'gte' | 'lte'; value: number }
interface Rule { id: string; stat: StatId; ratePerHour: number; gate: Gate | null }
interface StatSpec { min: number; max: number; initial: number }
interface Cfg {
  denominator: number;
  stats: Record<StatId, StatSpec>;
  rules: Rule[];
  interactions: Record<string, { stat: StatId; delta: number }[]>;
}
export interface RefState {
  /** Must mirror core's State shape exactly, or AC1a.9's equality can never hold. */
  schemaVersion: number;
  tMs: number;
  ageMs: number;
  stats: Record<StatId, number>;
  rem: Record<StatId, number>;
}

const SCHEMA_VERSION = 1;

const clampTo = (v: number, spec: StatSpec) => (v < spec.min ? spec.min : v > spec.max ? spec.max : v);

const gateOpen = (rule: Rule, stats: Record<StatId, number>) =>
  rule.gate === null
    ? true
    : rule.gate.op === 'gte'
      ? stats[rule.gate.stat] >= rule.gate.value
      : stats[rule.gate.stat] <= rule.gate.value;

function rates(cfg: Cfg, stats: Record<StatId, number>): Record<StatId, number> {
  const out: Record<StatId, number> = {};
  for (const id of Object.keys(cfg.stats)) out[id] = 0;
  for (const rule of cfg.rules) if (gateOpen(rule, stats)) out[rule.stat] += rule.ratePerHour;
  return out;
}

function step(cfg: Cfg, s: RefState, dt: number, r: Record<StatId, number>): RefState {
  const stats: Record<StatId, number> = {};
  const rem: Record<StatId, number> = {};
  for (const id of Object.keys(cfg.stats)) {
    const n = r[id] * dt + s.rem[id];
    let q = Math.floor(n / cfg.denominator);
    let rr = n - q * cfg.denominator;
    if (rr < 0) { q -= 1; rr += cfg.denominator; }
    stats[id] = clampTo(s.stats[id] + q, cfg.stats[id]);
    rem[id] = rr;
  }
  return { schemaVersion: s.schemaVersion, tMs: s.tMs + dt, ageMs: s.ageMs + dt, stats, rem };
}

/** Oracle 1: one millisecond at a time. Slow and obviously right. */
export function brute(cfg: Cfg, s0: RefState, elapsedMs: number): RefState {
  let s = s0;
  for (let i = 0; i < elapsedMs; i++) s = step(cfg, s, 1, rates(cfg, s.stats));
  return s;
}

const ceilDiv = (a: number, b: number) => {
  const q = Math.floor(a / b);
  return q * b === a ? q : q + 1;
};

/**
 * Smallest dt >= 1 at which stat `id`'s value reaches `target`, moving at rate `R`.
 * Returns null if it never does within `cap`. Derived algebraically from
 *   v(dt) = v + floor((R*dt + rem) / DEN)
 * which is the same definition core/ integrates, solved rather than searched.
 */
function timeToReach(
  DEN: number, v: number, rem: number, R: number, target: number, cap: number,
): number | null {
  if (R === 0) return null;
  const K = target - v;
  let dt: number;
  if (R > 0) {
    if (K <= 0) return null;
    dt = ceilDiv(K * DEN - rem, R);
  } else {
    if (K >= 0) return null;
    // want floor((R*dt + rem)/DEN) <= K  <=>  R*dt + rem <= (K+1)*DEN - 1
    dt = ceilDiv(rem + 1 - (K + 1) * DEN, -R);
  }
  if (dt < 1) dt = 1;
  return dt > cap ? null : dt;
}

/** Every time in (0, cap] at which the categorical shape of the state changes. */
export function crossings(cfg: Cfg, s: RefState, cap: number): number[] {
  const found = new Set<number>();
  const r = rates(cfg, s.stats);
  for (const id of Object.keys(cfg.stats)) {
    const spec = cfg.stats[id];
    const targets: number[] = [spec.min, spec.max];
    for (const rule of cfg.rules) if (rule.gate !== null && rule.gate.stat === id) {
      targets.push(rule.gate.value);
      // A gate flips when the stat moves off its threshold too, not only onto it.
      targets.push(rule.gate.value + 1, rule.gate.value - 1);
    }
    for (const t of targets) {
      if (t < spec.min || t > spec.max) continue;
      const dt = timeToReach(cfg.denominator, s.stats[id], s.rem[id], r[id], t, cap);
      if (dt !== null) found.add(dt);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** Oracle 2: algebraic segmentation. Fast enough for 30-day spans. */
export function closed(cfg: Cfg, s0: RefState, elapsedMs: number): RefState {
  let s = s0;
  let remaining = elapsedMs;
  let guard = 0;
  while (remaining > 0) {
    if (++guard > 1_000_000) throw new Error('reference closed(): segment guard tripped');
    const r = rates(cfg, s.stats);
    const here = shape(cfg, s.stats);
    let dt = remaining;
    for (const candidate of crossings(cfg, s, remaining)) {
      if (shape(cfg, step(cfg, s, candidate, r).stats) !== here) { dt = candidate; break; }
    }
    s = step(cfg, s, dt, r);
    remaining -= dt;
  }
  return s;
}

/**
 * Every segment boundary the closed oracle passes through, with the state at each.
 * Used by the corpus generator to measure AC1a.10 coverage on TRANSITIONS rather than on
 * values — a bound that a vector merely started at proves nothing about saturation dynamics.
 */
export function traceClosed(
  cfg: Cfg, s0: RefState, elapsedMs: number,
): { state: RefState; shape: string }[] {
  const out: { state: RefState; shape: string }[] = [{ state: s0, shape: shape(cfg, s0.stats) }];
  let s = s0;
  let remaining = elapsedMs;
  let guard = 0;
  while (remaining > 0) {
    if (++guard > 1_000_000) throw new Error('reference traceClosed(): segment guard tripped');
    const r = rates(cfg, s.stats);
    const here = shape(cfg, s.stats);
    let dt = remaining;
    for (const candidate of crossings(cfg, s, remaining)) {
      if (shape(cfg, step(cfg, s, candidate, r).stats) !== here) { dt = candidate; break; }
    }
    s = step(cfg, s, dt, r);
    remaining -= dt;
    out.push({ state: s, shape: shape(cfg, s.stats) });
  }
  return out;
}

function shape(cfg: Cfg, stats: Record<StatId, number>): string {
  const parts: string[] = [];
  for (const rule of cfg.rules) parts.push(gateOpen(rule, stats) ? 'o' : '.');
  for (const id of Object.keys(cfg.stats)) {
    const spec = cfg.stats[id];
    parts.push(stats[id] <= spec.min ? 'L' : stats[id] >= spec.max ? 'H' : '-');
  }
  return parts.join('');
}

export function refInitial(cfg: Cfg, startedAtMs: number): RefState {
  const stats: Record<StatId, number> = {};
  const rem: Record<StatId, number> = {};
  for (const id of Object.keys(cfg.stats)) { stats[id] = cfg.stats[id].initial; rem[id] = 0; }
  return { schemaVersion: SCHEMA_VERSION, tMs: startedAtMs, ageMs: 0, stats, rem };
}

export function refApply(cfg: Cfg, s: RefState, kind: string): RefState {
  const effects = cfg.interactions[kind];
  if (effects === undefined) throw new Error(`reference: unknown interaction "${kind}"`);
  const deltas: Record<StatId, number> = {};
  for (const e of effects) deltas[e.stat] = (deltas[e.stat] ?? 0) + e.delta;
  const stats: Record<StatId, number> = {};
  for (const id of Object.keys(cfg.stats)) {
    stats[id] = clampTo(s.stats[id] + (deltas[id] ?? 0), cfg.stats[id]);
  }
  return { schemaVersion: s.schemaVersion, tMs: s.tMs, ageMs: s.ageMs, stats, rem: { ...s.rem } };
}

/** Replay under either oracle. `engine` selects which. */
export function refReplay(
  cfg: Cfg,
  s0: RefState,
  events: { atMs: number; kind: string }[],
  untilMs: number,
  engine: 'brute' | 'closed',
): RefState {
  const run = engine === 'brute' ? brute : closed;
  const ordered = [...events].sort((a, b) => a.atMs - b.atMs);
  let s = s0;
  for (const e of ordered) {
    if (e.atMs > untilMs) break;
    s = run(cfg, s, e.atMs - s.tMs);
    s = refApply(cfg, s, e.kind);
  }
  return run(cfg, s, untilMs - s.tMs);
}
