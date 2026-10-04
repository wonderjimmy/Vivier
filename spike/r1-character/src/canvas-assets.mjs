// Export the R1 concept's images as PNG files for the Design canvas, which takes uploaded assets
// rather than inline data URIs. Same subjects as the sheet (subjects.mjs), so the canvas and the
// sheet cannot drift apart.
//
// Run: node spike/r1-character/src/canvas-assets.mjs <outDir>

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cat, PALETTE, SICK, FADED, GHOST, EYES, MOUTHS, FX } from './cat.mjs';
import { N, CONDITIONS, REACTIONS, STAGE_ANIMS } from './subjects.mjs';
import { blank, blit, remap, strip, encodePNG, toRGBA } from '../../lib/pixel.mjs';

const out = process.argv[2];
if (!out) throw new Error('usage: canvas-assets.mjs <outDir>');
mkdirSync(out, { recursive: true });

const write = (name, img, bg = null) => writeFileSync(join(out, `${name}.png`), encodePNG(toRGBA(img, PALETTE, 1, bg)));
const frames = (fn) => Array.from({ length: N }, (_, f) => fn(f));
const tile = (st) => { const p = blank(st.w + 2, st.h + 2); return blit(p, st, 1, 1); };

for (const s of STAGE_ANIMS) write(`stage-${s.id}`, strip(frames(s.frames)));
for (const c of CONDITIONS) write(`cond-${c.id}`, strip(frames(c.frames)));
for (const r of REACTIONS) write(`react-${r.id}`, strip(frames(r.frames)));
for (const st of ['kitten', 'junior', 'adult']) write(`body-${st}`, cat(st, { face: false }));
for (const [n, m] of [['ginger', {}], ['sick', SICK], ['fading', FADED], ['ghost', GHOST]]) write(`remap-${n}`, remap(cat('kitten'), m));
for (const [k, v] of Object.entries(EYES)) write(`eye-${k}`, tile(v.stamp), '#ec8c43');
for (const [k, v] of Object.entries(MOUTHS)) write(`mouth-${k}`, tile(v.stamp), '#ec8c43');
for (const k of ['zzz', 'heart', 'fish', 'sweat', 'stink', 'halo', 'fading', 'sparkle']) write(`fx-${k}`, tile(FX[k]), '#cbb79c');
console.log('ok');
