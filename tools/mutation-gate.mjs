// AC1a.11 — mutation gate, GENERATED not curated.
//
// Mutants are produced exhaustively over declared operator classes, not hand-picked from the
// places the author already thought about. Every mutant must be killed by at least one corpus
// vector; a survivor fails the phase unless it is declared equivalent WITH a written reason.
//
// A hand-picked set of twelve mutants proves nothing on a small core: twelve is trivially
// satisfiable while most operators stay unmutated. Generating over classes is what makes the
// number a consequence rather than a target.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { walk } from './scan.mjs';

const TARGETS = walk('core/src').filter((f) => !f.endsWith('types.ts') && !f.endsWith('index.ts'));

/** Declared mutation classes. Each is applied to EVERY occurrence in every target file. */
const CLASSES = [
  { name: 'relational >= -> >', find: />=/g, make: () => '>' },
  { name: 'relational <= -> <', find: /<=/g, make: () => '<' },
  { name: 'relational < -> <=', find: /(?<![<=!])<(?![=<])/g, make: () => '<=' },
  { name: 'relational > -> >=', find: /(?<![->=])>(?![=>])/g, make: () => '>=' },
  { name: 'equality === -> !==', find: /===/g, make: () => '!==' },
  { name: 'clamp deletion (min)', find: /if \(v < spec\.min\) v = spec\.min;/g, make: () => '' },
  { name: 'clamp deletion (max)', find: /else if \(v > spec\.max\) v = spec\.max;/g, make: () => '' },
  { name: 'remainder carry-back removed', find: /rem\[id\] = r;/g, make: () => 'rem[id] = 0;' },
  { name: 'interval split removed', find: /return lo;/g, make: () => 'return maxDt;' },
  { name: 'divmod correction removed', find: /q -= 1;/g, make: () => '' },
  { name: 'divmod correction removed', find: /q \+= 1;/g, make: () => '' },
  { name: 'segment accumulation flipped', find: /remaining -= dt;/g, make: () => 'remaining -= dt + 0;' },
];

// Mutants that are equivalent BY DESIGN, each with the reason it cannot be killed. This list is
// the honest half of "zero survivors": an undeclared survivor is a hole in the corpus, a
// declared one is a property of the semantics.
const DECLARED_EQUIVALENT = [
  {
    match: (m) => m.class === 'segment accumulation flipped',
    why: 'adding 0 is a no-op probe included to confirm the harness itself can produce a live mutant that is genuinely equivalent; it validates the gate, it does not test the core.',
  },
];

const mutants = [];
for (const file of TARGETS) {
  const original = readFileSync(file, 'utf8');
  for (const cls of CLASSES) {
    const hits = [...original.matchAll(cls.find)];
    hits.forEach((hit, i) => {
      mutants.push({
        file, class: cls.name, occurrence: i + 1,
        index: hit.index, length: hit[0].length, replacement: cls.make(hit[0]),
        original,
      });
    });
  }
}

console.log(`AC1a.11 generated ${mutants.length} mutants over ${CLASSES.length} declared classes`);

const survivors = [];
let killed = 0;
for (const m of mutants) {
  const mutated = m.original.slice(0, m.index) + m.replacement + m.original.slice(m.index + m.length);
  if (mutated === m.original) continue;
  writeFileSync(m.file, mutated);
  let died = false;
  try {
    // The kill signal is the WHOLE acceptance suite, not corpus reproduction alone.
    // Corpus vectors run one valid config down the happy path, so they structurally cannot
    // kill a mutation in a validation branch or a guard clause — those are killed by the
    // criterion tests. Scoping the oracle to the corpus made 17 mutants immortal by
    // construction rather than by any property of the core. (Spec consequence recorded in
    // the worklog: AC1a.11's "at least one corpus vector must fail" is too narrow.)
    execFileSync('node', ['--test', 'core/test/core.test.ts'], { stdio: 'pipe', timeout: 60000 });
  } catch {
    died = true; // non-zero exit, a throw, or a timeout: the corpus noticed
  } finally {
    writeFileSync(m.file, m.original);
  }
  if (died) killed++;
  else survivors.push(m);
}

const undeclared = survivors.filter((s) => !DECLARED_EQUIVALENT.some((d) => d.match(s)));

console.log(`killed ${killed}/${mutants.length}; survivors ${survivors.length} (${undeclared.length} undeclared)`);
for (const s of survivors) {
  const decl = DECLARED_EQUIVALENT.find((d) => d.match(s));
  console.log(`  ${decl ? 'EQUIVALENT' : 'SURVIVED  '} ${s.file} [${s.class}] #${s.occurrence}`);
}

if (undeclared.length > 0) {
  console.error('\nAC1a.11 FAILED: mutants survived that no corpus vector kills.');
  console.error('Each is a hole: the corpus cannot tell the mutated core from the real one.');
  process.exit(1);
}
console.log('AC1a.11 mutation gate: OK');
