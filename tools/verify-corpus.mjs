// Minimal corpus check, used as the mutation gate's kill signal.
// Exits 0 only if core reproduces every golden vector exactly.

import { readFileSync } from 'node:fs';
import { loadConfig } from '../core/src/config.ts';
import { replay } from '../core/src/sim/replay.ts';

try {
  const loaded = loadConfig(JSON.parse(readFileSync('tuning/default.json', 'utf8')));
  const corpus = JSON.parse(readFileSync('corpus/vectors.json', 'utf8'));
  for (const v of corpus.vectors) {
    const actual = replay(loaded, v.initial, v.events, v.untilMs);
    if (JSON.stringify(actual) !== JSON.stringify(v.expected)) {
      console.error(`vector "${v.id}" diverged`);
      process.exit(1);
    }
  }
  process.exit(0);
} catch (e) {
  console.error(`threw: ${e.message}`);
  process.exit(1);
}
