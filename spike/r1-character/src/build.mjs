// R1 character concept — design sheet and Claude Design cards, from one source.
//
// Animations are CSS steps() over a PNG strip: no script, so they play inside Claude Design cards
// as well as in a browser. Every image on every page is generated here from cat.mjs; nothing is
// hand-maintained beside it (the AC6.6 rule, applied early).
//
// Run: node spike/r1-character/src/build.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cat, PALETTE, SICK, FADED, GHOST, EYES, MOUTHS, FX, STAGES } from './cat.mjs';
import { blank, blit, remap, strip, dataURI } from '../../lib/pixel.mjs';
import { FONTS, BASE_CSS, shell } from '../../lib/page.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
import { N, FRAME_MS, idle, CONDITIONS, REACTIONS, STAGE_ANIMS } from './subjects.mjs';

// ---- rendering helpers ------------------------------------------------------------------

function anim(frames, scale, { label = '', note = '' } = {}) {
  const imgs = Array.from({ length: N }, (_, f) => frames(f));
  const uri = dataURI(strip(imgs), PALETTE, 1);
  const px = 32 * scale;
  return `<figure class="sp">
    <div class="a anim" role="img" aria-label="${label || 'animated cat'}" style="width:${px}px;max-width:100%;aspect-ratio:1/1;background-image:url(${uri})"></div>
    ${label ? `<figcaption><b>${label}</b>${note ? `<span>${note}</span>` : ''}</figcaption>` : ''}
  </figure>`;
}

function still(img, scale, label = '') {
  return `<figure class="sp"><img src="${dataURI(img, PALETTE, scale)}" width="${img.w * scale}" height="${img.h * scale}" alt="">
    ${label ? `<figcaption><b>${label}</b></figcaption>` : ''}</figure>`;
}

function stampTile(st, scale, label, bg = '#ec8c43') {
  const pad = blank(st.w + 2, st.h + 2);
  blit(pad, st, 1, 1);
  return `<div class="stamp"><img src="${dataURI(pad, PALETTE, scale, bg)}" alt=""><span>${label}</span></div>`;
}

const swatches = (keys) => `<div class="sw">${keys.map((k) =>
  `<div><i style="background:${PALETTE[k]}"></i><code>${PALETTE[k]}</code><span>${k}</span></div>`).join('')}</div>`;

// ---- sections ---------------------------------------------------------------------------

const SECTIONS = {
  hero: {
    group: 'Character', title: 'Vivier — the cat',
    body: `<div class="hero">
      <div class="stage">${anim(idle('kitten'), 10)}</div>
      <div class="pitch">
        <p class="kicker">R1 · character concept</p>
        <h1>A ginger tabby<br>you'd feel bad about.</h1>
        <p>The success criterion for this whole project is that its owner, at least once, feels
        guilty for neglecting it. So the design starts from what makes people care for a creature
        at all — and works backwards from guilt.</p>
        <ul class="facts">
          <li><b>32 × 32</b> logical pixels, drawn ×2 on the device</li>
          <li><b>4</b> life stages · <b>9</b> conditions · <b>3</b> reactions · <b>1</b> face</li>
          <li><b>0</b> hand-drawn bodies — stages are numbers</li>
        </ul>
      </div>
    </div>`,
  },
  stages: {
    group: 'Character', title: 'Life stages',
    body: `<p class="lede">Newborn → kitten → junior → adult. Cats are born blind and open their eyes
      at about a week, so the first stage is a kitten asleep in a basket, and the first change the
      owner sees is the moment it opens its eyes. After that the head keeps its size while everything
      below it grows.</p>
      <div class="row stages">${STAGE_ANIMS.map((s, i) =>
        `${i ? '<span class="arrow">→</span>' : ''}${anim(s.frames, 5, { label: s.id, note: s.note })}`).join('')}</div>`,
  },
  conditions: {
    group: 'Character', title: 'Conditions',
    body: `<p class="lede">Each condition changes <em>the animal</em> — its colour, its eyes, its ears,
      its posture. The small effects only confirm what the body already says. That is the lesson the
      first art spike paid for: an icon on its own vanishes at a distance; a face does not.</p>
      <div class="grid">${CONDITIONS.map((c) => anim(c.frames, 5, { label: c.id, note: c.note })).join('')}</div>`,
  },
  reactions: {
    group: 'Character', title: 'Reactions',
    body: `<p class="lede">What happens the moment you press a button. Each of the three must look
      unlike the other two and unlike idle — otherwise pressing feels like nothing happened.</p>
      <div class="row">${REACTIONS.map((r) => anim(r.frames, 5, { label: r.id, note: r.note })).join('')}</div>`,
  },
  glance: {
    group: 'Character', title: 'Glance test — device scale',
    body: `<p class="lede">Actual size on the 2.8″ panel: each cat is 64 px. Cover the labels.
      Can you name every one from across the desk?</p>
      <div class="glance">${CONDITIONS.map((c) => anim(c.frames, 2, { label: c.id })).join('')}</div>
      <p class="fine">The 64 px figure is arithmetic (32 logical × 2), not a simulation of the panel:
      its brightness, contrast and reflectance, and your monitor and distance, all differ. Judge the
      shapes and how far apart the conditions sit — not the colour or the size.</p>`,
  },
  system: {
    group: 'System', title: 'How it is built — a paper doll',
    body: `<p class="lede">Nothing here is a drawing of a particular cat in a particular mood. The cat
      is assembled, which is what keeps the art budget additive (ADR-003): a new stage costs a few
      numbers, and every expression works on every stage for free.</p>
      <div class="sys">
        <div><h3>1 · Body from numbers</h3><p>Each stage is a handful of geometry — head, body, ear and
          tail — rendered with one light from the upper left and quantised to a four-tone ramp.
          Weight widens the body.</p>${['kitten', 'junior', 'adult'].map((s) => still(cat(s, { face: false }), 3)).join('')}</div>
        <div><h3>2 · Face stamps</h3><p>Hand-drawn, placed at an anchor computed from the head. Glints are
          not mirrored — both eyes are lit by the same window.</p>
          <div class="stamps">${Object.entries(EYES).map(([k, v]) => stampTile(v.stamp, 9, k)).join('')}</div>
          <div class="stamps">${Object.entries(MOUTHS).map(([k, v]) => stampTile(v.stamp, 9, k)).join('')}</div></div>
        <div><h3>3 · Palette remaps</h3><p>Sick, fading and gone are colour substitutions over the same
          pixels — no new art, and readable from across a room.</p>
          ${[['ginger', {}], ['sick', SICK], ['fading', FADED], ['ghost', GHOST]].map(([n, m]) =>
            still(remap(cat('kitten', { eyes: 'open' }), m), 3, n)).join('')}</div>
        <div><h3>4 · Effects</h3><p>Secondary cues, pinned to a corner clear of the ears at every stage.</p>
          <div class="stamps">${['zzz', 'heart', 'fish', 'sweat', 'stink', 'halo', 'fading', 'sparkle'].map((k) => stampTile(FX[k], 6, k, '#cbb79c')).join('')}</div></div>
      </div>`,
  },
  palette: {
    group: 'System', title: 'Palette',
    body: `<p class="lede">Warm, few, and with a dark that is never black: the outline is a deep plum
      brown, and on lit edges it lightens to a burnt umber so the silhouette softens toward the
      light instead of reading as a sticker.</p>
      <h4>Coat</h4>${swatches(['fur.3', 'fur.2', 'fur.1', 'fur.0', 'stripe'])}
      <h4>Cream, pink, line</h4>${swatches(['cream.2', 'cream.1', 'cream.0', 'pink.1', 'pink.0', 'inkL', 'ink', 'eye', 'glint'])}
      <h4>Conditions</h4>${swatches(['sick.3', 'sick.1', 'sick.0', 'fade.3', 'fade.1', 'fade.0', 'ghost.3', 'ghost.1', 'ghost.ink'])}`,
  },
  why: {
    group: 'System', title: 'Design decisions',
    body: `<ol class="why">
      <li><b>Baby schema, on purpose.</b> Big head, big eyes set low, small nose and mouth, a round
        body. These are the features that trigger caretaking in people. The project's success
        criterion is guilt; this is the shape guilt has.</li>
      <li><b>Ginger tabby.</b> Orange holds up on a small, cheap LCD in both a bright and a dim room,
        and keeps its distance from every condition palette — sick green, fading grey, ghost blue
        cannot be mistaken for a healthy coat.</li>
      <li><b>One light.</b> Every highlight and both eye glints come from the upper left. Mirrored
        glints are the commonest tell of a character drawn half at a time.</li>
      <li><b>The head never changes size.</b> Face anchors are computed, not repositioned by hand,
        so a face stamp drawn once lands correctly on every stage.</li>
      <li><b>Animation that cannot lie.</b> Every frame is a pure function of the condition and the
        frame index. Breathing moves the head a whole pixel rather than resizing the body, so outlines
        never shimmer.</li>
      <li><b>Dead is gentle but final.</b> A pale ghost with a halo, not a corpse — upsetting enough
        to matter, not so upsetting that the device goes in a drawer.</li>
    </ol>`,
  },
};

// ---- page shell -------------------------------------------------------------------------

// Component styles on top of the shared design system (spike/lib/page.mjs) — fonts, colours and
// the animation rule come from there, so this page and the den page cannot drift apart.
const CSS = `
h4{font:13px/1.4 var(--label);letter-spacing:.06em;color:var(--mute);margin:22px 0 10px}
.hero{display:flex;gap:44px;align-items:center;flex-wrap:wrap}
.stage{background:var(--well);border-radius:20px;padding:22px;border:1px solid var(--line);max-width:100%}
.pitch{flex:1;min-width:260px}.pitch p{color:var(--mute);max-width:46ch;font-size:17px}
.facts{list-style:none;padding:0;margin:18px 0 0;display:grid;gap:6px;font-size:15px;color:var(--mute)}
.facts b{font:800 24px/1 var(--display);color:var(--ink);margin-right:6px}
.sp{margin:0;text-align:center;max-width:100%}
.sp .a,.sp img{display:block;margin:0 auto}
figcaption{margin-top:10px;font-size:14px;line-height:1.4}
figcaption b{display:block;font:13px/1.4 var(--label);letter-spacing:.04em}
figcaption span{color:var(--mute);display:block;max-width:24ch;margin:2px auto 0}
.row{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}.arrow{color:#b9a690;font-size:24px;padding-bottom:80px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:28px 14px}
.glance{display:flex;gap:18px;flex-wrap:wrap;padding:22px;background:var(--well);border-radius:14px}
.sys{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:28px}
.sys>div{border-top:2px solid var(--line);padding-top:16px}.sys p{font-size:15px;color:var(--mute)}
.sys .sp{display:inline-block;margin:4px 8px 0 0}
.stamps{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
.stamp{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:var(--mute)}
.stamp img{image-rendering:pixelated;border:1px solid var(--line);border-radius:4px}
.sw{display:flex;flex-wrap:wrap;gap:12px}
.sw div{display:grid;grid-template-columns:40px auto;column-gap:10px;font-size:13px;align-items:center}
.sw i{grid-row:span 2;width:40px;height:40px;border-radius:10px;border:1px solid rgba(0,0,0,.1)}
.sw code{font-size:12.5px;color:var(--mute)}
.why{padding-left:22px;margin:0;display:grid;gap:14px;max-width:80ch}.why li{color:var(--mute)}.why b{color:var(--ink)}
`;


const page = (title, inner, card = null) => `${card ? `<!-- @dsCard group="${card}" -->\n` : ''}<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>${FONTS}<style>${BASE_CSS}${CSS}</style></head><body><div class="wrap">${inner}</div></body></html>`;

const section = (key) => {
  const s = SECTIONS[key];
  return `<section>${key === 'hero' ? '' : `<h2>${s.title}</h2>`}${s.body}</section>`;
};

mkdirSync(join(OUT, 'cards'), { recursive: true });
writeFileSync(join(OUT, 'sheet.html'), page('Vivier — character design', Object.keys(SECTIONS).map(section).join('')));
writeFileSync(join(OUT, 'character.html'), shell({
  title: 'Vivier — the character',
  description: 'Character design for Vivier, a desktop electronic pet: a ginger tabby in four life stages, nine conditions and three reactions.',
  current: 'character.html', css: CSS,
  body: Object.keys(SECTIONS).map(section).join(''),
}));
for (const key of Object.keys(SECTIONS)) {
  writeFileSync(join(OUT, 'cards', `${key}.html`), page(`Vivier — ${SECTIONS[key].title}`, section(key), SECTIONS[key].group));
}

// Budget evidence: what the art actually costs under this model.
const stampCount = Object.keys(EYES).length + Object.keys(MOUTHS).length + Object.keys(FX).length;
console.log(`stages: ${Object.keys(STAGES).length} geometries (data) + 1 newborn generator`);
console.log(`hand-drawn stamps: ${stampCount} (eyes ${Object.keys(EYES).length}, mouths ${Object.keys(MOUTHS).length}, effects ${Object.keys(FX).length})`);
console.log(`conditions: ${CONDITIONS.length}, frames per loop: ${N}`);
console.log(`wrote dist/character.html, dist/sheet.html and ${Object.keys(SECTIONS).length} cards`);
