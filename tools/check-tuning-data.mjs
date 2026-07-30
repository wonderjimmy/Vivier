// AC1a.13 — tuning is data, and there is no second copy of it.
//
// The simulation modules may contain only 0, 1 and -1. Anything else is either a tunable
// parameter (which belongs in the config) or a structural constant (which must be declared
// here, by name, so the carve-out is visible rather than assumed).
//
// The named carve-outs are printed on every run. A carve-out nobody can see is not a carve-out,
// it is a hole.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { walk, readSource, lineOf, report } from './scan.mjs';

const SIM_DIR = 'core/src/sim';
const ALLOWED_LITERALS = new Set(['0', '1']);

// Structural constants: cardinality and algorithm shape, not curve parameters. Declared by the
// name they are bound to, so adding one is a visible edit rather than a silent exemption.
const STRUCTURAL = new Map([
  ['HALF', 'binary-search midpoint divisor; the shape of the search, not a tunable rate'],
]);

const violations = [];

for (const file of walk(SIM_DIR)) {
  const { code } = readSource(file);
  for (const m of code.matchAll(/(?<![\w.$])(\d[\d_]*)(?![\w.$])/g)) {
    const literal = m[1].replaceAll('_', '');
    if (ALLOWED_LITERALS.has(literal)) continue;
    const line = code.slice(0, m.index).split('\n').pop() ?? '';
    const declared = line.match(/const\s+([A-Za-z_$][\w$]*)\s*=/);
    if (declared && STRUCTURAL.has(declared[1])) continue;
    violations.push(`${file}:${lineOf(code, m.index)} — numeric literal ${literal} in simulation logic`);
  }
}

// No second numeric data file: `core/` holds code, the config holds numbers.
for (const file of walk('core/src')) {
  if (file.endsWith('.json')) violations.push(`${file} — core/ must contain no numeric data file`);
}
const strayJson = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) strayJson(full);
    else if (entry.endsWith('.json')) violations.push(`${full} — core/ must contain no data file`);
  }
};
strayJson('core');

// The config's key set must be exactly what the simulation reads — a defaults file that
// silently filled a gap would defeat P1b's whole intent with every criterion still green.
const raw = JSON.parse(readFileSync('tuning/default.json', 'utf8'));
const REQUIRED_TOP = ['schemaVersion', 'denominator', 'maxSegments', 'stats', 'rules', 'interactions'];
const actual = Object.keys(raw).sort();
if (JSON.stringify(actual) !== JSON.stringify([...REQUIRED_TOP].sort())) {
  violations.push(`tuning/default.json — key set ${actual.join(',')} != ${REQUIRED_TOP.sort().join(',')}`);
}

console.log('AC1a.13 declared structural carve-outs:');
for (const [name, why] of STRUCTURAL) console.log(`  ${name} — ${why}`);
process.exit(report('AC1a.13 tuning-is-data scan', violations));
