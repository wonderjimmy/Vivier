// Rule gating and composition.
//
// DECLARED COMPOSITION SEMANTICS (AC1a.2b — written down before being tested, not inferred
// from the implementation):
//
//   1. A rule contributes to its stat only while its gate is open. A rule with `gate: null`
//      is always open.
//   2. Gates are evaluated ONCE per sub-interval, on the state at the START of that
//      sub-interval. They do not re-evaluate mid-interval; `advance` instead ends the
//      sub-interval at the exact millisecond a gate would change.
//   3. Every open rule targeting a stat contributes ADDITIVELY. The stat's net rate for the
//      sub-interval is the plain sum.
//   4. Clamping is applied EXACTLY ONCE per stat per sub-interval, after summing — never per
//      rule. Clamping per rule would make the result depend on rule order near a bound.
//   5. Consequently rule order is irrelevant. That is an invariant, asserted by test — not a
//      hope. It is also why "swap rule order" is a deliberately equivalent mutant in the
//      mutation gate, justified in the worklog rather than expected to die.

import type { Config, Rule, StatId } from '../types.ts';

export function isGateOpen(rule: Rule, stats: Readonly<Record<StatId, number>>): boolean {
  if (rule.gate === null) return true;
  const value = stats[rule.gate.stat];
  return rule.gate.op === 'gte' ? value >= rule.gate.value : value <= rule.gate.value;
}

/** Net rate per stat for a sub-interval, given the state at its start. Rule 3 above. */
export function netRates(
  config: Config,
  stats: Readonly<Record<StatId, number>>,
): Record<StatId, number> {
  const rates: Record<StatId, number> = {};
  for (const id of Object.keys(config.stats)) rates[id] = 0;
  for (const rule of config.rules) {
    if (isGateOpen(rule, stats)) rates[rule.stat] += rule.ratePerHour;
  }
  return rates;
}

/**
 * The categorical shape of the state: which gates are open, and which stats sit on a bound.
 *
 * `advance` segments time at every point where this changes. Both halves matter: a gate flip
 * changes the rate set, and a stat reaching a bound changes whether further movement has any
 * effect. Splitting on gates alone was the defect the second CRITIQUE round found — a
 * saturation boundary breaks step-size composition exactly as a threshold does.
 */
export function signature(config: Config, stats: Readonly<Record<StatId, number>>): string {
  const parts: string[] = [];
  for (const rule of config.rules) parts.push(isGateOpen(rule, stats) ? 'o' : '.');
  for (const id of Object.keys(config.stats)) {
    const spec = config.stats[id];
    parts.push(stats[id] <= spec.min ? 'L' : stats[id] >= spec.max ? 'H' : '-');
  }
  return parts.join('');
}
