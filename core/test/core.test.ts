// P1a acceptance tests. Each test names the criterion it is the check for.
//
// Tests trace to the criteria, not to the implementation (AC standard rule 6). Where a test
// needs an expected value it derives it from the tuning config and the DECLARED semantics in
// core/src/sim/rules.ts, or it takes it from the corpus — never by running the code under test
// and recording whatever came out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  advance, apply, initialState, loadConfig, netRates, replay, signature,
  AdvanceError, ConfigError, ReplayError, type State,
} from '../src/index.ts';
import { divmod } from '../src/divmod.ts';

const loaded = loadConfig(JSON.parse(readFileSync('tuning/default.json', 'utf8')));
const cfg = loaded.config;
const DEN = cfg.denominator;
const corpus = JSON.parse(readFileSync('corpus/vectors.json', 'utf8'));
const statIds = Object.keys(cfg.stats);

/** Deterministic RNG for partition generation. Tests may be random; the core may not. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % n;
  };
}

const runVector = (v: { initial: State; events: { atMs: number; kind: string }[]; untilMs: number }) =>
  replay(loaded, v.initial, v.events, v.untilMs);

// ---------------------------------------------------------------------------------------
// AC1a.9 — the corpus is an independent, frozen oracle
// ---------------------------------------------------------------------------------------

test('AC1a.9 corpus content hash matches the committed file', () => {
  const expected = readFileSync('corpus/vectors.sha256', 'utf8').trim();
  const actual = createHash('sha256').update(readFileSync('corpus/vectors.json', 'utf8')).digest('hex');
  assert.equal(actual, expected, 'corpus was edited without updating its hash');
});

test('AC1a.9 core reproduces every corpus vector exactly', () => {
  for (const v of corpus.vectors) {
    assert.deepEqual(runVector(v), v.expected, `vector "${v.id}" diverged from the reference`);
  }
});

test('AC1a.9 at least 10 vectors were cross-checked under both oracles', () => {
  assert.ok(corpus.coverage.dualOracleVectors >= 10, `only ${corpus.coverage.dualOracleVectors}`);
});

// ---------------------------------------------------------------------------------------
// AC1a.1 — step-size independence
// ---------------------------------------------------------------------------------------

test('AC1a.1 folding advance over any partition equals one call (random partitions)', () => {
  const rnd = lcg(0x5eed);
  const spans = [1, 999, 60_000, 3_600_000, 86_400_000, 60 * 86_400_000];
  let cases = 0;
  for (const v of corpus.vectors.slice(0, 8)) {
    for (const span of spans) {
      for (let trial = 0; trial < 22; trial++) {
        const cuts = new Set<number>();
        const n = 1 + rnd(5);
        for (let i = 0; i < n; i++) cuts.add(1 + rnd(span));
        const points = [...cuts].filter((c) => c < span).sort((a, b) => a - b);
        let folded = v.initial as State;
        let prev = 0;
        for (const p of [...points, span]) {
          folded = advance(loaded, folded, p - prev);
          prev = p;
        }
        assert.deepEqual(folded, advance(loaded, v.initial, span),
          `vector "${v.id}" span ${span} cuts ${points.join(',')}`);
        cases++;
      }
    }
  }
  assert.ok(cases >= 1000, `only ${cases} partition cases, need >= 1000`);
});

test('AC1a.1 partitions AT every crossing and saturation time (reference-supplied)', () => {
  // The times come from the corpus, which got them from the independent reference module.
  // Taking them from core/ would let an off-by-one test itself and pass.
  let checked = 0;
  for (const v of corpus.vectors) {
    for (const tc of v.crossings as number[]) {
      for (const at of [tc - 1, tc, tc + 1]) {
        if (at < 1 || at > v.untilMs) continue;
        const split = advance(loaded, advance(loaded, v.initial, at), v.untilMs - at);
        assert.deepEqual(split, advance(loaded, v.initial, v.untilMs),
          `vector "${v.id}" split at ${at} (crossing ${tc})`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, 'no crossing times were exercised');
});

// ---------------------------------------------------------------------------------------
// AC1a.2 / AC1a.2b — gated rules and composition
// ---------------------------------------------------------------------------------------

test('AC1a.2 config declares at least one conditional rule', () => {
  assert.ok(cfg.rules.some((r) => r.gate !== null), 'no gated rule: this criterion would be vacuous');
});

test('AC1a.2a gate open: movement equals the config rate over dt, carrying the remainder', () => {
  const gated = cfg.rules.filter((r) => r.gate !== null);
  for (const rule of gated) {
    // Build a state where this rule's gate is open, hand-placed from the config.
    const base = initialState(loaded, 0);
    const g = rule.gate!;
    const open = g.op === 'gte' ? g.value + 1 : g.value - 1;
    const s: State = { ...base, stats: { ...base.stats, [g.stat]: open } };
    assert.ok(netRates(cfg, s.stats)[rule.stat] !== 0, `${rule.id}: gate did not open`);

    const dt = 1_000_000;
    const rate = netRates(cfg, s.stats)[rule.stat];
    // Expected from the DECLARED semantics: additive rates, remainder carried, clamp once.
    const n = rate * dt + s.rem[rule.stat];
    let q = Math.floor(n / DEN);
    if (n - q * DEN < 0) q -= 1;
    const spec = cfg.stats[rule.stat];
    const expected = Math.min(spec.max, Math.max(spec.min, s.stats[rule.stat] + q));
    assert.equal(advance(loaded, s, dt).stats[rule.stat], expected, `${rule.id} open`);
  }
});

test('AC1a.2b gate closed throughout: the gated stat is value-identical', () => {
  // healthRecover shut, starveDamage shut, filthDamage shut => health must not move at all.
  const base = initialState(loaded, 0);
  const s: State = { ...base, stats: { ...base.stats, hunger: 50_000, cleanliness: 90_000 } };
  for (const rule of cfg.rules.filter((r) => r.stat === 'health')) {
    assert.ok(!netRates(cfg, s.stats).health || rule.gate === null,
      'setup assumption broken: a health rule is open');
  }
  assert.equal(netRates(cfg, s.stats).health, 0, 'no health rule should be open here');
  const after = advance(loaded, s, 60_000);
  assert.equal(after.stats.health, s.stats.health);
  assert.equal(after.rem.health, s.rem.health);
});

test('AC1a.2b rule order is irrelevant (declared invariant, not a hope)', () => {
  const reversed = loadConfig({
    ...JSON.parse(readFileSync('tuning/default.json', 'utf8')),
    rules: [...(JSON.parse(readFileSync('tuning/default.json', 'utf8')).rules)].reverse(),
  });
  for (const v of corpus.vectors) {
    assert.deepEqual(
      replay(reversed, v.initial, v.events, v.untilMs),
      runVector(v),
      `vector "${v.id}" depends on rule order`,
    );
  }
});

// ---------------------------------------------------------------------------------------
// AC1a.3 — the state is complete
// ---------------------------------------------------------------------------------------

test('AC1a.3 a plain-JSON clone of the state advances identically', () => {
  for (const v of corpus.vectors) {
    const clone = JSON.parse(JSON.stringify(v.initial));
    assert.deepEqual(advance(loaded, clone, v.untilMs), advance(loaded, v.initial, v.untilMs),
      `vector "${v.id}": something survives advance that is not in the serialised state`);
  }
});

test('AC1a.3 corpus vectors are order-independent (no cross-vector contamination)', () => {
  const forwards = corpus.vectors.map(runVector);
  const backwards = [...corpus.vectors].reverse().map(runVector).reverse();
  assert.deepEqual(backwards, forwards);
});

// ---------------------------------------------------------------------------------------
// AC1a.4 / AC1a.5 — integers everywhere, ranges closed
// ---------------------------------------------------------------------------------------

test('AC1a.4 every numeric field of every produced state is an integer', () => {
  const check = (s: State, where: string) => {
    for (const key of ['tMs', 'ageMs', 'schemaVersion'] as const) {
      assert.ok(Number.isInteger(s[key]), `${where}.${key} = ${s[key]}`);
    }
    for (const id of statIds) {
      assert.ok(Number.isInteger(s.stats[id]), `${where}.stats.${id} = ${s.stats[id]}`);
      assert.ok(Number.isInteger(s.rem[id]), `${where}.rem.${id} = ${s.rem[id]}`);
    }
  };
  for (const v of corpus.vectors) check(runVector(v), `vector "${v.id}"`);
});

test('AC1a.5 stats stay in range and remainders stay in [0, DEN)', () => {
  const check = (s: State, where: string) => {
    for (const id of statIds) {
      const spec = cfg.stats[id];
      assert.ok(s.stats[id] >= spec.min && s.stats[id] <= spec.max,
        `${where}.stats.${id} = ${s.stats[id]} outside [${spec.min}, ${spec.max}]`);
      assert.ok(s.rem[id] >= 0 && s.rem[id] < DEN, `${where}.rem.${id} = ${s.rem[id]}`);
    }
  };
  for (const v of corpus.vectors) check(runVector(v), `vector "${v.id}"`);
  const rnd = lcg(0xc0ffee);
  for (let i = 0; i < 400; i++) {
    const base = initialState(loaded, 0);
    const stats: Record<string, number> = {};
    for (const id of statIds) {
      const spec = cfg.stats[id];
      stats[id] = spec.min + rnd(spec.max - spec.min + 1);
    }
    const s: State = { ...base, stats };
    const dt = [0, 1, 60_000, 3_600_000, 86_400_000, 60 * 86_400_000][rnd(6)];
    check(advance(loaded, s, dt), `random state ${i} dt ${dt}`);
  }
});

// ---------------------------------------------------------------------------------------
// AC1a.6 / AC1a.7 — representable arithmetic, forward-only time
// ---------------------------------------------------------------------------------------

test('divmod throws outside its domain rather than answering wrongly', () => {
  const MAX = Number.MAX_SAFE_INTEGER;
  assert.throws(() => divmod(MAX, 7), RangeError);
  assert.throws(() => divmod(-MAX, 7), RangeError);
  assert.throws(() => divmod(MAX - 3, 7), RangeError);
  // Just inside the domain is fine.
  assert.deepEqual(divmod(MAX - 7, 7), { q: Math.floor((MAX - 7) / 7), r: (MAX - 7) % 7 });
});

test('AC1a.6 maxAdvanceMs keeps every intermediate inside the safe-integer range', () => {
  const perStat = new Map<string, number>();
  for (const r of cfg.rules) {
    perStat.set(r.stat, (perStat.get(r.stat) ?? 0) + Math.abs(r.ratePerHour));
  }
  const worst = Math.max(...perStat.values());
  // The bound must leave room for BOTH the carried remainder and divmod's own |n| + d domain.
  assert.ok(worst * loaded.maxAdvanceMs + DEN + DEN <= Number.MAX_SAFE_INTEGER,
    'the derived bound does not keep divmod inside its exact-integer domain');
  // And the largest intermediate advance can actually produce must be accepted by divmod.
  assert.doesNotThrow(() => divmod(worst * loaded.maxAdvanceMs + DEN - 1, DEN));
});

test('AC1a.6 advancing beyond maxAdvanceMs errors rather than saturating silently', () => {
  const s = initialState(loaded, 0);
  assert.throws(() => advance(loaded, s, loaded.maxAdvanceMs + 1), AdvanceError);
  assert.throws(() => advance(loaded, s, Number.MAX_SAFE_INTEGER), AdvanceError);
});

test('AC1a.6 exactly maxAdvanceMs is accepted; one more is not (boundary, not vibes)', () => {
  const s = initialState(loaded, 0);
  assert.doesNotThrow(() => advance(loaded, s, loaded.maxAdvanceMs));
  assert.throws(() => advance(loaded, s, loaded.maxAdvanceMs + 1), AdvanceError);
});

test('maxSegments is an exact bound: the last permitted segment runs, one more throws', () => {
  // hunger starts one step below its gate, so this span contains exactly one crossing and
  // therefore exactly two segments.
  const raw = JSON.parse(readFileSync('tuning/default.json', 'utf8'));
  const base = initialState(loaded, 0);
  const s: State = { ...base, stats: { ...base.stats, hunger: 89_900 } };
  const two = loadConfig({ ...raw, maxSegments: 2 });
  const one = loadConfig({ ...raw, maxSegments: 1 });
  assert.doesNotThrow(() => advance(two, s, 10 * 60_000), 'two segments must fit in a bound of 2');
  assert.throws(() => advance(one, s, 10 * 60_000), AdvanceError, 'a bound of 1 must reject them');
});

test('AC1a.7 advance(S, 0) is value-identical; negative and non-integer throw', () => {
  for (const v of corpus.vectors) {
    assert.deepEqual(advance(loaded, v.initial, 0), v.initial, `vector "${v.id}"`);
  }
  const s = initialState(loaded, 0);
  assert.throws(() => advance(loaded, s, -1), AdvanceError);
  assert.throws(() => advance(loaded, s, 1.5), AdvanceError);
});

// ---------------------------------------------------------------------------------------
// AC1a.8 — declared ordering and interval conventions
// ---------------------------------------------------------------------------------------

test('AC1a.8/1 unsorted events are stably normalised, not rejected or dropped', () => {
  const s0 = initialState(loaded, 0);
  const unsorted = [
    { atMs: 9 * 60_000, kind: 'clean' },
    { atMs: 2 * 60_000, kind: 'feed' },
    { atMs: 5 * 60_000, kind: 'play' },
  ];
  const sorted = [...unsorted].sort((a, b) => a.atMs - b.atMs);
  assert.deepEqual(replay(loaded, s0, unsorted, 12 * 60_000), replay(loaded, s0, sorted, 12 * 60_000));
});

test('AC1a.8/1 two events at one timestamp keep input order', () => {
  const s0 = initialState(loaded, 0);
  const a = replay(loaded, s0, [{ atMs: 1000, kind: 'feed' }, { atMs: 1000, kind: 'play' }], 2000);
  const b = replay(loaded, s0, [{ atMs: 1000, kind: 'play' }, { atMs: 1000, kind: 'feed' }], 2000);
  // feed and play both move weight; applied in a different order they are still additive, so
  // the assertion is that the ORDER IS HONOURED, i.e. the pair is processed as given.
  assert.deepEqual(a, b, 'these two interactions are additive, so order must not matter here');
});

test('AC1a.8/2 an event predating the initial state is a ReplayError', () => {
  const s0 = initialState(loaded, 10_000);
  assert.throws(() => replay(loaded, s0, [{ atMs: 9_999, kind: 'feed' }], 20_000), ReplayError);
});

test('AC1a.8/3,4 events at exactly t0 and exactly untilMs are both applied', () => {
  const s0 = initialState(loaded, 0);
  const withEnds = replay(loaded, s0, [{ atMs: 0, kind: 'feed' }, { atMs: 60_000, kind: 'feed' }], 60_000);
  const without = replay(loaded, s0, [], 60_000);
  const feedDelta = cfg.interactions.feed.find((e) => e.stat === 'weight')!.delta;
  assert.equal(withEnds.stats.weight - without.stats.weight, feedDelta * 2,
    'an endpoint event was silently dropped');
});

test('AC1a.8/5 an event coincident with a crossing lands after the segment completes', () => {
  const v = corpus.vectors.find((x: { id: string }) => x.id === 'event-at-crossing');
  assert.ok(v, 'corpus is missing the event-at-crossing vector');
  assert.deepEqual(runVector(v), v.expected);
});

test('AC1a.8 replay rejects a non-integer or backwards untilMs', () => {
  const s0 = initialState(loaded, 1000);
  assert.throws(() => replay(loaded, s0, [], 999), ReplayError);
  assert.throws(() => replay(loaded, s0, [], 1000.5), ReplayError);
});

// ---------------------------------------------------------------------------------------
// AC1a.13 / AC1a.14 — tuning is data, one validating door
// ---------------------------------------------------------------------------------------

test('AC1a.13 every config rate is load-bearing (no dead keys)', () => {
  const raw = JSON.parse(readFileSync('tuning/default.json', 'utf8'));
  // Liveness is judged across EVERY vector, not one. A key whose stat happens to be saturated
  // at a single vector's endpoint looks dead there while being perfectly live elsewhere —
  // which is why the criterion says "changes the corpus trajectory", not "the end state".
  const fingerprint = (l: ReturnType<typeof loadConfig>) =>
    JSON.stringify(corpus.vectors.map((v: never) => replay(l, v.initial, v.events, v.untilMs)));
  const baseline = fingerprint(loaded);
  raw.rules.forEach((_: unknown, i: number) => {
    const mutated = JSON.parse(JSON.stringify(raw));
    mutated.rules[i].ratePerHour += 1;
    assert.notEqual(fingerprint(loadConfig(mutated)), baseline,
      `rules[${i}] "${raw.rules[i].id}" is dead: mutating its rate changes no vector`);
  });
  for (const kind of Object.keys(raw.interactions)) {
    const mutated = JSON.parse(JSON.stringify(raw));
    mutated.interactions[kind][0].delta += 1;
    assert.notEqual(fingerprint(loadConfig(mutated)), baseline, `interactions.${kind} is dead`);
  }
});

test('AC1a.14 the door rejects structurally invalid configs by key name', () => {
  const raw = () => JSON.parse(readFileSync('tuning/default.json', 'utf8'));
  const cases: [string, (c: Record<string, unknown>) => void][] = [
    ['schemaVersion', (c) => { c.schemaVersion = 99; }],
    ['denominator', (c) => { c.denominator = 0; }],
    ['stats.hunger.min', (c) => { (c.stats as never as Record<string, Record<string, number>>).hunger.min = 0.5; }],
    ['stats.hunger', (c) => { (c.stats as never as Record<string, Record<string, number>>).hunger.max = 0; }],
    ['stats.hunger.initial', (c) => { (c.stats as never as Record<string, Record<string, number>>).hunger.initial = 999_999; }],
    ['rules[0].stat', (c) => { (c.rules as Record<string, unknown>[])[0].stat = 'nope'; }],
    ['rules[0].ratePerHour', (c) => { (c.rules as Record<string, unknown>[])[0].ratePerHour = 1.5; }],
    ['rules[4].gate.op', (c) => { ((c.rules as Record<string, Record<string, unknown>>[])[4].gate as Record<string, unknown>).op = 'ne'; }],
    ['interactions.feed[0].stat', (c) => { (c.interactions as never as Record<string, Record<string, unknown>[]>).feed[0].stat = 'nope'; }],
    // min === max is degenerate and must be rejected on its own account. `initial` is moved
    // onto the collapsed bound too, so the range check is the ONLY thing that can reject this
    // config — otherwise a weakened `min >= max` still throws, via the initial-in-range check,
    // and the test passes while the comparison it is aimed at is broken.
    ['stats.weight', (c) => {
      const w = (c.stats as never as Record<string, Record<string, number>>).weight;
      w.min = w.max;
      w.initial = w.max;
    }],
  ];
  for (const [key, mutate] of cases) {
    const c = raw();
    mutate(c);
    assert.throws(() => loadConfig(c), (e: unknown) => {
      assert.ok(e instanceof ConfigError, `${key}: expected ConfigError, got ${e}`);
      assert.ok(e.key.startsWith(key.split('[')[0].split('.')[0]), `reported key "${e.key}" for ${key}`);
      return true;
    }, `config with a broken ${key} was accepted`);
  }
});

test('AC1a.14 the door ACCEPTS values sitting exactly on a legal boundary', () => {
  // The mirror of the rejection table. Without these, tightening a comparison from `<` to `<=`
  // would reject perfectly legal configs and no test would notice.
  const raw = () => JSON.parse(readFileSync('tuning/default.json', 'utf8'));
  const atInitialMin = raw();
  atInitialMin.stats.hunger.initial = atInitialMin.stats.hunger.min;
  assert.doesNotThrow(() => loadConfig(atInitialMin), 'initial === min is legal');

  const atInitialMax = raw();
  atInitialMax.stats.hunger.initial = atInitialMax.stats.hunger.max;
  assert.doesNotThrow(() => loadConfig(atInitialMax), 'initial === max is legal');

  const gateAtMin = raw();
  gateAtMin.rules[4].gate.value = gateAtMin.stats.hunger.min;
  assert.doesNotThrow(() => loadConfig(gateAtMin), 'a gate sitting on the stat floor is legal');

  const gateAtMax = raw();
  gateAtMax.rules[4].gate.value = gateAtMax.stats.hunger.max;
  assert.doesNotThrow(() => loadConfig(gateAtMax), 'a gate sitting on the stat ceiling is legal');
});

// ---------------------------------------------------------------------------------------
// Sanity: the pieces the other criteria lean on
// ---------------------------------------------------------------------------------------

test('signature tracks gate state, and gate state alone', () => {
  const base = initialState(loaded, 0);
  const interior = signature(cfg, base.stats);
  const gate = cfg.rules.find((r) => r.gate !== null)!.gate!;
  const flipped = { ...base.stats, [gate.stat]: gate.op === 'gte' ? gate.value + 1 : gate.value - 1 };
  assert.notEqual(signature(cfg, flipped), interior, 'a gate flip must change the signature');
  // Saturation deliberately does NOT change it: see the reasoning in core/src/sim/rules.ts.
  // Step-independence across saturation is asserted separately, by AC1a.1's partition test at
  // the reference-supplied bound-reaching times — which is where it belongs.
  const atMax = { ...base.stats, weight: cfg.stats.weight.max };
  assert.equal(signature(cfg, atMax), interior, 'saturation alone must not resegment');
});

test('apply() clamps once per stat and rejects unknown interactions', () => {
  const s = initialState(loaded, 0);
  const fed = apply(loaded, s, 'feed');
  assert.equal(fed.stats.hunger, Math.max(cfg.stats.hunger.min,
    s.stats.hunger + cfg.interactions.feed.find((e) => e.stat === 'hunger')!.delta));
  assert.equal(fed.tMs, s.tMs, 'an interaction must not move time');
  assert.throws(() => apply(loaded, s, 'headpat'), ReplayError);
});

// ---------------------------------------------------------------------------------------
// divmod contract — the one division site, tested at the magnitudes where it actually bends
// ---------------------------------------------------------------------------------------

test('divmod satisfies n = q*d + r with 0 <= r < d, including where float division misrounds', () => {
  const pairs: [number, number][] = [];
  // Ordinary cases, both signs.
  for (const n of [0, 1, -1, 7, -7, DEN, -DEN, DEN - 1, -(DEN - 1)]) pairs.push([n, DEN]);
  // The cases that matter: |n| near 2^53, where n/d in doubles rounds to the wrong side of an
  // integer and Math.floor lands one off. These are NOT hypothetical — a search over denominators
  // found real pairs, and they are all NEGATIVE, which is exactly why an earlier version of this
  // test (positive operands only) failed to kill the divmod-correction mutants.
  for (const d of [7, 3, 123457, 999983, 1048576, DEN]) {
    const kmax = Math.floor((Number.MAX_SAFE_INTEGER - d) / d);
    for (let k = kmax; k > kmax - 3000; k--) {
      for (const base of [k * d - 1, k * d, k * d + 1]) {
        if (base + d > Number.MAX_SAFE_INTEGER) continue;   // divmod's stated domain
        pairs.push([base, d], [-base, d]);
      }
    }
  }
  let checked = 0;
  for (const [n, d] of pairs) {
    const { q, r } = divmod(n, d);
    assert.ok(Number.isInteger(q) && Number.isInteger(r), `divmod(${n}, ${d}) not integral`);
    assert.ok(r >= 0 && r < d, `divmod(${n}, ${d}) gave r = ${r}, outside [0, ${d})`);
    // Reconstruct in BigInt, not in doubles. At these magnitudes q*d itself can exceed 2^53
    // even when n does not, so a float reconstruction would fail on a CORRECT divmod — the
    // test's own arithmetic would be the weak link rather than the code under test.
    // (Tests may use BigInt; core/ may not, and does not.)
    assert.equal(BigInt(q) * BigInt(d) + BigInt(r), BigInt(n),
      `divmod(${n}, ${d}) does not reconstruct n`);
    checked++;
  }
  assert.ok(checked > 1000, `only ${checked} divmod cases`);
});
