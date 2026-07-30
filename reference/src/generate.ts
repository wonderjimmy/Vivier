// Golden-vector corpus generator — AC1a.9, AC1a.10.
//
// Expected states come from reference/src/engine.ts, NEVER from core/. The generator loads the
// tuning config through core's single validating door (AC1a.14) and hands the reference a plain
// object, so the door stays honoured without creating an import edge the reference is forbidden
// to have.
//
// Run: node reference/src/generate.ts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadConfig } from '../../core/src/config.ts';
import {
  brute, closed, crossings, refApply, refInitial, refReplay, traceClosed, type RefState,
} from './engine.ts';

const MS_HOUR = 3600000;
const MS_DAY = 86400000;

const loaded = loadConfig(JSON.parse(readFileSync('tuning/default.json', 'utf8')));
const cfg = loaded.config as never as Parameters<typeof brute>[0];

interface VectorSpec {
  id: string;
  note: string;
  overrides?: Record<string, number>;
  events?: { atMs: number; kind: string }[];
  untilMs: number;
  /** Short vectors are cross-checked under BOTH oracles (AC1a.9's >=10 overlap). */
  both: boolean;
}

function start(overrides: Record<string, number> = {}): RefState {
  const s = refInitial(cfg, 0);
  return { ...s, stats: { ...s.stats, ...overrides } };
}

// Short vectors start from deliberately near-threshold states so a gate can toggle inside a
// span the 1 ms oracle can actually walk. Waiting 19 real hours for hunger to reach its gate
// would put every gate transition out of the brute-force oracle's reach.
const SPECS: VectorSpec[] = [
  { id: 'zero', note: 'delta = 0', untilMs: 0, both: true },
  { id: 'one-ms', note: 'delta = 1 ms', untilMs: 1, both: true },
  { id: 'quiet-minute', note: 'one minute, no events', untilMs: 60000, both: true },
  {
    id: 'starve-gate-on', note: 'hunger crosses its gate upward: starveDamage off -> on',
    overrides: { hunger: 89900 }, untilMs: 10 * 60000, both: true,
  },
  {
    id: 'starve-gate-off',
    note: 'two feeds walk hunger down through both gates: starveDamage on->off, healthRecover off->on',
    overrides: { hunger: 89900 },
    events: [{ atMs: 3 * 60000, kind: 'feed' }, { atMs: 6 * 60000, kind: 'feed' }],
    untilMs: 10 * 60000, both: true,
  },
  {
    id: 'recover-gate-toggle', note: 'healthRecover on -> off as hunger rises past 40000',
    overrides: { hunger: 39900, health: 50000 }, untilMs: 10 * 60000, both: true,
  },
  {
    id: 'filth-gate-toggle', note: 'filthDamage off -> on -> off across a clean()',
    overrides: { cleanliness: 15100, health: 60000 },
    events: [{ atMs: 8 * 60000, kind: 'clean' }], untilMs: 12 * 60000, both: true,
  },
  {
    id: 'saturate-max', note: 'hunger arrives at its max from an interior value',
    overrides: { hunger: 99800 }, untilMs: 10 * 60000, both: true,
  },
  {
    id: 'saturate-min', note: 'happiness arrives at its min from an interior value',
    overrides: { happiness: 200 }, untilMs: 10 * 60000, both: true,
  },
  {
    id: 'unsorted-events', note: 'event list supplied out of order (AC1a.8 convention 1)',
    events: [
      { atMs: 9 * 60000, kind: 'clean' },
      { atMs: 2 * 60000, kind: 'feed' },
      { atMs: 5 * 60000, kind: 'play' },
    ], untilMs: 12 * 60000, both: true,
  },
  {
    id: 'event-at-crossing', note: 'an event lands exactly on an internal crossing time',
    overrides: { hunger: 89900 }, untilMs: 10 * 60000, both: true, // events filled in below
  },
  {
    id: 'event-at-endpoints', note: 'events at exactly t0 and exactly untilMs (conventions 3, 4)',
    events: [{ atMs: 0, kind: 'feed' }, { atMs: 10 * 60000, kind: 'play' }],
    untilMs: 10 * 60000, both: true,
  },
  {
    id: 'same-timestamp', note: 'two events at an identical timestamp keep input order',
    events: [{ atMs: 3 * 60000, kind: 'feed' }, { atMs: 3 * 60000, kind: 'play' }],
    untilMs: 6 * 60000, both: true,
  },
  {
    id: 'rising-weight', note: 'weight strictly increases under repeated feeding',
    events: Array.from({ length: 6 }, (_, i) => ({ atMs: (i + 1) * 60000, kind: 'feed' })),
    untilMs: 8 * 60000, both: true,
  },
  { id: 'one-hour-quiet', note: 'one hour, no events', untilMs: MS_HOUR, both: true },
  { id: 'day-neglect', note: 'a full day ignored', untilMs: MS_DAY, both: false },
  {
    id: 'day-attentive', note: 'a day with regular care',
    events: [2, 6, 10, 14, 18, 22].flatMap((h) => [
      { atMs: h * MS_HOUR, kind: 'feed' },
      { atMs: h * MS_HOUR + 60000, kind: 'play' },
      { atMs: h * MS_HOUR + 120000, kind: 'clean' },
    ]), untilMs: MS_DAY, both: false,
  },
  { id: 'thirty-day-neglect', note: '30 days ignored', untilMs: 30 * MS_DAY, both: false },
  {
    id: 'thirty-day-attentive', note: '30 days of twice-daily care',
    events: Array.from({ length: 60 }, (_, i) => {
      const kinds = ['feed', 'play', 'clean'];
      return { atMs: Math.floor(i / 2) * MS_DAY + (i % 2) * 12 * MS_HOUR, kind: kinds[i % 3] };
    }), untilMs: 30 * MS_DAY, both: false,
  },
];

// Fill the event-at-crossing vector with a timestamp taken from the INDEPENDENT oracle's
// crossing enumeration, not from core/ (AC1a.1's "times supplied by the reference module").
{
  const spec = SPECS.find((s) => s.id === 'event-at-crossing')!;
  const times = crossings(cfg, start(spec.overrides), spec.untilMs);
  if (times.length === 0) throw new Error('event-at-crossing: reference found no crossing');
  spec.events = [{ atMs: times[0], kind: 'feed' }];
}

const vectors = SPECS.map((spec) => {
  const s0 = start(spec.overrides);
  const events = spec.events ?? [];
  const expected = refReplay(cfg, s0, events, spec.untilMs, 'closed');
  if (spec.both) {
    const viaBrute = refReplay(cfg, s0, events, spec.untilMs, 'brute');
    if (JSON.stringify(viaBrute) !== JSON.stringify(expected)) {
      console.error(`ORACLE DISAGREEMENT on "${spec.id}"`);
      console.error('  brute :', JSON.stringify(viaBrute));
      console.error('  closed:', JSON.stringify(expected));
      process.exit(1);
    }
  }
  return {
    id: spec.id, note: spec.note, both: spec.both,
    initial: s0, events, untilMs: spec.untilMs,
    crossings: crossings(cfg, s0, spec.untilMs),
    expected,
  };
});

// ---- AC1a.10: coverage measured on TRANSITIONS, by simulated evolution -------------------
const statIds = Object.keys(loaded.config.stats);
const gatedRules = loaded.config.rules.filter((r) => r.gate !== null);
const rose = new Set<string>(), fell = new Set<string>();
const hitMax = new Set<string>(), hitMin = new Set<string>();
const gateOn = new Set<string>(), gateOff = new Set<string>();
const kindsSeen = new Set<string>();
const deltas = new Set<number>();

const shapeOf = (st: RefState) => traceClosed(cfg, st, 0)[0].shape;

for (const v of vectors) {
  deltas.add(v.untilMs);
  for (const e of v.events) kindsSeen.add(e.kind);

  // Build ONE continuous timeline of observation points: every decay segment boundary AND
  // every interaction. Watching only the decay segments was the first version's bug — it made
  // every interaction-driven transition invisible, so a stat that only ever rises when the
  // owner feeds it looked like a stat that never rises at all.
  const points: { state: RefState; shape: string }[] = [];
  let s0 = v.initial;
  const ordered = [...v.events].sort((a, b) => a.atMs - b.atMs);
  for (const e of ordered) {
    if (e.atMs > v.untilMs) break;
    const leg = traceClosed(cfg, s0, e.atMs - s0.tMs);
    points.push(...leg);
    const after = refApply(cfg, leg[leg.length - 1].state, e.kind);
    points.push({ state: after, shape: shapeOf(after) });
    s0 = after;
  }
  points.push(...traceClosed(cfg, s0, v.untilMs - s0.tMs));

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    for (const id of statIds) {
      const spec = loaded.config.stats[id];
      if (b.state.stats[id] > a.state.stats[id]) rose.add(id);
      if (b.state.stats[id] < a.state.stats[id]) fell.add(id);
      if (b.state.stats[id] === spec.max && a.state.stats[id] < spec.max) hitMax.add(id);
      if (b.state.stats[id] === spec.min && a.state.stats[id] > spec.min) hitMin.add(id);
    }
    for (const rule of gatedRules) {
      const idx = loaded.config.rules.indexOf(rule);
      if (a.shape[idx] === '.' && b.shape[idx] === 'o') gateOn.add(rule.id);
      if (a.shape[idx] === 'o' && b.shape[idx] === '.') gateOff.add(rule.id);
    }
  }
}

const problems: string[] = [];
for (const id of statIds) {
  if (!rose.has(id)) problems.push(`stat "${id}" never observed strictly increasing`);
  if (!fell.has(id)) problems.push(`stat "${id}" never observed strictly decreasing`);
}
for (const rule of gatedRules) {
  if (!gateOn.has(rule.id)) problems.push(`gate "${rule.id}" never observed off -> on`);
  if (!gateOff.has(rule.id)) problems.push(`gate "${rule.id}" never observed on -> off`);
}
for (const kind of Object.keys(loaded.config.interactions)) {
  if (!kindsSeen.has(kind)) problems.push(`interaction "${kind}" never appears in any vector`);
}
for (const required of [0, 1, MS_HOUR, 30 * MS_DAY]) {
  if (!deltas.has(required)) problems.push(`no vector spans delta = ${required} ms`);
}
if (hitMax.size === 0) problems.push('no stat arrives at its max from an interior value');
if (hitMin.size === 0) problems.push('no stat arrives at its min from an interior value');
const overlap = vectors.filter((v) => v.both).length;
if (overlap < 10) problems.push(`only ${overlap} dual-oracle vectors, need >= 10`);

const coverage = {
  rose: [...rose].sort(), fell: [...fell].sort(),
  arrivedAtMax: [...hitMax].sort(), arrivedAtMin: [...hitMin].sort(),
  gateOn: [...gateOn].sort(), gateOff: [...gateOff].sort(),
  interactions: [...kindsSeen].sort(), dualOracleVectors: overlap,
};

if (problems.length > 0) {
  console.error('CORPUS COVERAGE FAILED:\n  ' + problems.join('\n  '));
  console.error('coverage:', JSON.stringify(coverage, null, 2));
  process.exit(1);
}

const corpus = { schemaVersion: 1, generatedFrom: 'reference/src/engine.ts', coverage, vectors };
const body = JSON.stringify(corpus, null, 2);
const hash = createHash('sha256').update(body).digest('hex');
mkdirSync('corpus', { recursive: true });
writeFileSync('corpus/vectors.json', body);
writeFileSync('corpus/vectors.sha256', hash + '\n');
console.log(`corpus: ${vectors.length} vectors (${overlap} cross-checked under both oracles)`);
console.log(`coverage: ${JSON.stringify(coverage)}`);
console.log(`sha256: ${hash}`);
