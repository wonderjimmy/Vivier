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
 * The categorical shape of the state: which gates are open.
 *
 * `advance` segments time wherever this changes, because that is where the rate set changes.
 *
 * It deliberately does NOT track stats sitting on a bound. The second CRITIQUE round argued a
 * clamp-saturation boundary breaks step-size composition just as a threshold does; building it
 * proved otherwise, and the mutation gate is what showed it — flipping the bound comparisons
 * changed no observable behaviour at all. Two reasons it cannot:
 *
 *   * remainder accumulation is clamp-independent, so `rem` after an interval is a pure
 *     function of total elapsed time regardless of where the interval was cut; and
 *   * clamping is idempotent, so a stat that saturates mid-interval lands on the same bound
 *     whether or not the interval was split there.
 *
 * Any boundary that DOES change behaviour is a gate, and gates are tracked. Keeping a second,
 * redundant notion of boundary would be filler that the gate could not kill — code no test can
 * distinguish from its own absence.
 */
export function signature(config: Config, stats: Readonly<Record<StatId, number>>): string {
  const parts: string[] = [];
  for (const rule of config.rules) parts.push(isGateOpen(rule, stats) ? 'o' : '.');
  return parts.join('');
}
