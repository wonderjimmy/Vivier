// AC1a.4 — integers only, everywhere. Source half of the criterion.
//
// core/ may not contain a float literal, a bare `/`, Math.round/floor/ceil/trunc, `| 0`,
// `>>> 0`, parseInt or toFixed — anywhere except the single `divmod` definition, which is the
// one declared site allowed to divide, and whose remainder is written back into state.

import { walk, readSource, lineOf, report } from './scan.mjs';

const DIVMOD = 'core/src/divmod.ts';
const violations = [];

const BANNED = [
  [/\b\d+\.\d+\b/g, 'float literal'],
  [/Math\.(round|floor|ceil|trunc)\b/g, 'Math rounding call'],
  [/\|\s*0\b/g, '| 0 coercion'],
  [/>>>\s*0\b/g, '>>> 0 coercion'],
  [/\bparseInt\b/g, 'parseInt'],
  [/\.toFixed\b/g, 'toFixed'],
  // A bare `/` that is not part of //, /*, */, or an assignment `/=`.
  [/(?<![/*])\/(?![/*=])/g, 'bare division'],
];

for (const file of walk('core/src')) {
  if (file.replaceAll('\\', '/') === DIVMOD) continue;
  const { code } = readSource(file);
  for (const [pattern, label] of BANNED) {
    for (const m of code.matchAll(pattern)) {
      violations.push(`${file}:${lineOf(code, m.index)} — ${label} (${m[0].trim()})`);
    }
  }
}

// The carve-out must stay a carve-out: exactly one divmod definition, and it must exist.
const { code: divmodCode } = readSource(DIVMOD);
const defs = [...divmodCode.matchAll(/export function divmod\b/g)];
if (defs.length !== 1) {
  violations.push(`${DIVMOD} — expected exactly 1 divmod definition, found ${defs.length}`);
}

process.exit(report('AC1a.4 integers-only source scan', violations));
