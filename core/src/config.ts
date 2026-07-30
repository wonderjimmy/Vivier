// AC1a.14 — the single validating door.
//
// Every consumer of tuning data (the corpus generator, the reference module, the harness, and
// every later phase's loader) obtains its config through `loadConfig`. A validator that lives
// only in the harness leaves the core accepting anything, so the door is here, in core/.
//
// P1a validates what P1a's own criteria depend on: structural integrity, integer-only values
// (ADR-002), and the safe-arithmetic bound. P1b extends the invalid-case table (AC1b.5) — it
// does not add a second door.

import { divmod } from './divmod.ts';
import { ConfigError, type Config, type LoadedConfig, type Rule } from './types.ts';

function requireInteger(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ConfigError(key, `must be an integer, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requirePositive(value: number, key: string): number {
  if (value <= 0) throw new ConfigError(key, `must be positive, got ${value}`);
  return value;
}

/**
 * Validate a raw config object and derive its load-time bounds.
 * Throws `ConfigError` naming the offending key. Never defaults, never clamps, never repairs.
 */
export function loadConfig(raw: unknown): LoadedConfig {
  if (raw === null || typeof raw !== 'object') {
    throw new ConfigError('<root>', 'config must be an object');
  }
  const c = raw as Record<string, unknown>;

  const schemaVersion = requireInteger(c.schemaVersion, 'schemaVersion');
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new ConfigError('schemaVersion', `unsupported version ${schemaVersion}`);
  }
  const denominator = requirePositive(requireInteger(c.denominator, 'denominator'), 'denominator');
  const maxSegments = requirePositive(requireInteger(c.maxSegments, 'maxSegments'), 'maxSegments');

  if (c.stats === null || typeof c.stats !== 'object') {
    throw new ConfigError('stats', 'must be an object');
  }
  const statsRaw = c.stats as Record<string, Record<string, unknown>>;
  const statIds = Object.keys(statsRaw);
  if (statIds.length === 0) throw new ConfigError('stats', 'must declare at least one stat');

  const stats: Record<string, { min: number; max: number; initial: number }> = {};
  for (const id of statIds) {
    const spec = statsRaw[id];
    const min = requireInteger(spec?.min, `stats.${id}.min`);
    const max = requireInteger(spec?.max, `stats.${id}.max`);
    const initial = requireInteger(spec?.initial, `stats.${id}.initial`);
    if (min >= max) throw new ConfigError(`stats.${id}`, `min (${min}) must be below max (${max})`);
    if (initial < min || initial > max) {
      throw new ConfigError(`stats.${id}.initial`, `${initial} outside [${min}, ${max}]`);
    }
    stats[id] = { min, max, initial };
  }

  if (!Array.isArray(c.rules)) throw new ConfigError('rules', 'must be an array');
  const seenRuleIds = new Set<string>();
  const rules: Rule[] = [];
  (c.rules as Record<string, unknown>[]).forEach((r, i) => {
    const at = `rules[${i}]`;
    const id = r?.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new ConfigError(`${at}.id`, 'must be a non-empty string');
    }
    if (seenRuleIds.has(id)) throw new ConfigError(`${at}.id`, `duplicate rule id "${id}"`);
    seenRuleIds.add(id);

    const stat = r.stat;
    if (typeof stat !== 'string' || !(stat in stats)) {
      throw new ConfigError(`${at}.stat`, `unknown stat ${JSON.stringify(stat)}`);
    }
    const ratePerHour = requireInteger(r.ratePerHour, `${at}.ratePerHour`);

    let gate: Rule['gate'] = null;
    if (r.gate !== null && r.gate !== undefined) {
      const g = r.gate as Record<string, unknown>;
      const gStat = g.stat;
      if (typeof gStat !== 'string' || !(gStat in stats)) {
        throw new ConfigError(`${at}.gate.stat`, `unknown stat ${JSON.stringify(gStat)}`);
      }
      if (g.op !== 'gte' && g.op !== 'lte') {
        throw new ConfigError(`${at}.gate.op`, `must be "gte" or "lte", got ${JSON.stringify(g.op)}`);
      }
      const value = requireInteger(g.value, `${at}.gate.value`);
      const spec = stats[gStat];
      if (value < spec.min || value > spec.max) {
        throw new ConfigError(`${at}.gate.value`, `${value} outside [${spec.min}, ${spec.max}]`);
      }
      gate = { stat: gStat, op: g.op, value };
    }
    rules.push({ id, stat, ratePerHour, gate });
  });

  if (c.interactions === null || typeof c.interactions !== 'object') {
    throw new ConfigError('interactions', 'must be an object');
  }
  const interactionsRaw = c.interactions as Record<string, unknown>;
  const interactions: Record<string, { stat: string; delta: number }[]> = {};
  for (const kind of Object.keys(interactionsRaw)) {
    const effects = interactionsRaw[kind];
    if (!Array.isArray(effects) || effects.length === 0) {
      throw new ConfigError(`interactions.${kind}`, 'must be a non-empty array of effects');
    }
    interactions[kind] = (effects as Record<string, unknown>[]).map((e, i) => {
      const at = `interactions.${kind}[${i}]`;
      const stat = e?.stat;
      if (typeof stat !== 'string' || !(stat in stats)) {
        throw new ConfigError(`${at}.stat`, `unknown stat ${JSON.stringify(stat)}`);
      }
      return { stat, delta: requireInteger(e.delta, `${at}.delta`) };
    });
  }

  const config: Config = {
    schemaVersion, denominator, maxSegments, stats, rules, interactions,
  };
  return { config, maxAdvanceMs: deriveMaxAdvanceMs(config) };
}

const SUPPORTED_SCHEMA_VERSION = 1;

/**
 * AC1a.6 — the bound uses the SUM of every rate that can act on one stat simultaneously, not the
 * largest single rate. With several rules live on one stat the true intermediate is the sum, and
 * a bound derived from the maximum would understate it.
 */
function deriveMaxAdvanceMs(config: Config): number {
  const perStat = new Map<string, number>();
  for (const rule of config.rules) {
    const magnitude = rule.ratePerHour < 0 ? -rule.ratePerHour : rule.ratePerHour;
    perStat.set(rule.stat, (perStat.get(rule.stat) ?? 0) + magnitude);
  }
  let worst = 0;
  for (const sum of perStat.values()) if (sum > worst) worst = sum;
  if (worst === 0) return Number.MAX_SAFE_INTEGER;
  const headroom = Number.MAX_SAFE_INTEGER - config.denominator;
  return divmod(headroom, worst).q;
}
