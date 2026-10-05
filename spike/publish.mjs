// Build every published page and assemble the site into one folder.
//
// Replaces hand-copying spike builds into docs/, which let the published demos drift silently.
// Every page is regenerated from source on each run.
//
// Run: node spike/publish.mjs <outDir>

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { shell } from './lib/page.mjs';
import { strip, dataURI } from './lib/pixel.mjs';
import { PALETTE } from './r1-character/src/cat.mjs';
import { N, idle } from './r1-character/src/subjects.mjs';

const out = process.argv[2];
if (!out) throw new Error('usage: node spike/publish.mjs <outDir>');
mkdirSync(out, { recursive: true });

// The first live prototype (spike/live) is not published: it still wears the first-draft cat and
// was withdrawn at the human's request. Its source stays in the repo.
for (const builder of ['spike/r1-character/src/build.mjs', 'spike/r2-den/src/build.mjs',
  'spike/tuning-view/src/build.mjs']) {
  execFileSync('node', ['--no-warnings', builder], { stdio: 'pipe' });
}

const kitten = dataURI(strip(Array.from({ length: N }, (_, f) => idle('kitten')(f))), PALETTE, 1);
const night = `data:image/png;base64,${readFileSync('spike/r2-den/dist/canvas-assets/den-night.png').toString('base64')}`;

const CSS = `
.hero{display:flex;gap:40px;align-items:center;flex-wrap:wrap}
.hero .copy{flex:1;min-width:260px}
.hero .lede{margin-bottom:0}
.thumb{image-rendering:pixelated;background-repeat:no-repeat;background-size:1600% 100%;border-radius:12px;max-width:100%}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:18px}
a.card{display:flex;flex-direction:column;gap:14px;text-decoration:none;color:var(--ink);background:var(--card);
  border:1px solid var(--line);border-radius:18px;padding:22px}
a.card:hover{border-color:var(--accent)}
a.card h3{margin:0}a.card p{margin:0;color:var(--mute);font-size:15px}
.well{background:var(--well);border-radius:12px;display:flex;justify-content:center;align-items:center;padding:14px}
.old a.card{background:transparent}
h2.group{font:13px/1.4 var(--label);letter-spacing:.06em;color:var(--mute);margin:34px 0 14px}
`;

const body = `
<section class="hero">
  <div class="well" style="padding:20px"><div class="anim thumb" role="img" aria-label="The kitten, breathing and blinking"
    style="width:224px;aspect-ratio:1/1;background-image:url(${kitten})"></div></div>
  <div class="copy">
    <p class="kicker">A DESKTOP ELECTRONIC PET</p>
    <h1>Vivier</h1>
    <p class="lede">A ginger tabby that lives on a small screen on your desk. It ages in real time,
    sleeps when it is night, watches the real Hong Kong weather through its window — and slowly
    goes downhill if you forget it exists.</p>
  </div>
</section>

<h2 class="group">THE DESIGN</h2>
<div class="cards">
  <a class="card" href="character.html">
    <div class="well"><div class="anim thumb" role="img" aria-label="The kitten" style="width:128px;aspect-ratio:1/1;background-image:url(${kitten})"></div></div>
    <h3>The character</h3>
    <p>Four life stages from a blind newborn to an adult, nine conditions, three reactions — and the
    paper-doll system they are built from.</p>
  </a>
  <a class="card" href="den.html">
    <div class="well" style="padding:0;overflow:hidden"><div class="anim thumb" role="img" aria-label="The den at night"
      style="width:100%;aspect-ratio:16/10;border-radius:0;background-image:url(${night})"></div></div>
    <h3>The den</h3>
    <p>A corner of a Hong Kong flat. Its window follows the real time of day and the Observatory’s
    weather.</p>
  </a>
</div>

<h2 class="group">EARLIER PROTOTYPE — FIRST-DRAFT CAT</h2>
<div class="cards old">
  <a class="card" href="tuning.html"><h3>Tuning viewer</h3>
    <p>Thirty days on one screen across four care patterns. Neglect kills it in under six days —
    and so does over-feeding.</p></a>
</div>`;

writeFileSync(join(out, 'index.html'), shell({
  title: 'Vivier — a desktop electronic pet',
  description: 'Vivier is a desktop electronic pet: a ginger tabby that ages in real time and lives in a Hong Kong flat whose window follows the real weather.',
  current: 'index.html', css: CSS, body,
}));
copyFileSync('spike/r1-character/dist/character.html', join(out, 'character.html'));
copyFileSync('spike/r2-den/dist/den.html', join(out, 'den.html'));
copyFileSync('spike/tuning-view/dist/index.html', join(out, 'tuning.html'));
console.log(`site assembled in ${out}: index, character, den, tuning`);
