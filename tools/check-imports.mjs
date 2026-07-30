// Import-graph and purity assertions:
//   AC1a.9  — reference/src/engine.ts imports NOTHING from core/ (else it is a mirror, not an oracle)
//   AC1a.12 — core/ is randomness-free: no PRNG, no seed parameter
//   AC1a.14 — tuning data enters through core/src/config.ts and nowhere else
//   AC1a.3  — core/ holds no module-level mutable state
// plus constitution law 1: no host globals, no ambient time, zero runtime dependencies.

import { walk, readSource, lineOf, report } from './scan.mjs';

const violations = [];
const importsOf = (code) =>
  [...code.matchAll(/(?:^|\n)\s*import[^;]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

// --- AC1a.9: the reference oracle must share no code with core/ -------------------------
{
  const { text } = readSource('reference/src/engine.ts');
  for (const spec of importsOf(text)) {
    violations.push(`reference/src/engine.ts imports "${spec}" — the oracle must import nothing`);
  }
}

// --- core/ purity ------------------------------------------------------------------------
const HOST_GLOBALS = [
  /\bwindow\b/g, /\bdocument\b/g, /\blocalStorage\b/g, /\bsessionStorage\b/g,
  /\bnew Date\b/g, /\bDate\.now\b/g, /\bsetTimeout\b/g, /\bsetInterval\b/g,
  /\bfetch\b/g, /\bprocess\b/g, /\brequire\b/g,
];
const RANDOMNESS = [/Math\.random\b/g, /\bcrypto\b/g, /\bseed\b/gi, /\bprng\b/gi, /\brandom\b/gi];

for (const file of walk('core/src')) {
  const { code, text } = readSource(file);

  for (const spec of importsOf(text)) {
    if (spec.startsWith('.')) continue;              // intra-core, fine
    violations.push(`${file} imports "${spec}" — core/ must have zero runtime dependencies`);
  }
  for (const pattern of HOST_GLOBALS) {
    for (const m of code.matchAll(pattern)) {
      violations.push(`${file}:${lineOf(code, m.index)} — host global "${m[0]}" in the pure core`);
    }
  }
  // AC1a.12 — randomness-free.
  for (const pattern of RANDOMNESS) {
    for (const m of code.matchAll(pattern)) {
      violations.push(`${file}:${lineOf(code, m.index)} — "${m[0]}": core/ must be randomness-free`);
    }
  }
  // AC1a.3 — no module-level mutable state. A `const` bound to an object or array counts:
  // freezing the binding does not freeze what it points at.
  for (const m of code.matchAll(/(?:^|\n)(let|var)\s+/g)) {
    violations.push(`${file}:${lineOf(code, m.index + 1)} — module-level ${m[1].trim()} binding`);
  }
  for (const m of code.matchAll(/(?:^|\n)const\s+[\w$]+(?::[^=]+)?\s*=\s*[[{]/g)) {
    violations.push(`${file}:${lineOf(code, m.index + 1)} — module-level object/array literal (mutable referent)`);
  }
}

// --- AC1a.14: one validating door --------------------------------------------------------
for (const file of [...walk('core/src'), ...walk('reference/src'), ...walk('tools')]) {
  if (file.endsWith('check-imports.mjs') || file.endsWith('check-tuning-data.mjs')) continue;
  const { text } = readSource(file);
  const readsTuning = /tuning\//.test(text);
  const goesThroughDoor = /\bloadConfig\b/.test(text) || file.endsWith('core/src/config.ts');
  if (readsTuning && !goesThroughDoor) {
    violations.push(`${file} reads tuning/ without going through loadConfig — AC1a.14`);
  }
}

process.exit(report('AC1a.9/12/14/3 import-graph and purity scan', violations));
