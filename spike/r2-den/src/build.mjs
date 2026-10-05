// R2 concept — export the den's animated variants as PNG strips (for the Design canvas) and a local
// preview page. Every frame is den() + a cat from the R1 subjects, so the den and the character
// sheet cannot drift apart.
//
// Run: node spike/r2-den/src/build.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { den, PALETTE, W, H } from './den.mjs';
import { cat, withFx } from '../../r1-character/src/cat.mjs';
import { N, idle, CONDITIONS } from '../../r1-character/src/subjects.mjs';
import { blank, blit, encodePNG, toRGBA } from '../../lib/pixel.mjs';
import { shell } from '../../lib/page.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const sleeping = CONDITIONS.find((c) => c.id === 'sleeping').frames;

export const VARIANTS = [
  {
    id: 'night', label: 'Night · clear', clock: { h: 23, m: 40 }, time: 'night', weather: 'clear', spot: 'bed',
    note: 'It sleeps when you do. The lamp stays on over its bed; the city stays awake outside.',
    cat: (f) => sleeping(f),
  },
  {
    id: 'day', label: 'Day · clear', clock: { h: 10, m: 10 }, time: 'day', weather: 'clear', spot: 'rug',
    note: 'Sun on the floorboards, the towers across the road in daylight.',
    cat: idle('kitten'),
  },
  {
    id: 'dusk', label: 'Dusk · clear', clock: { h: 18, m: 30 }, time: 'dusk', weather: 'clear', spot: 'rug',
    note: 'The room warms, the light stretches, the first windows light up.',
    cat: idle('kitten', { tail: 0 }),
  },
  {
    id: 'rain', label: 'Afternoon · rain', clock: { h: 15, m: 0 }, time: 'day', weather: 'rain', spot: 'window',
    note: 'Grey light, a cooler room. It sits close to the window, ears back.',
    cat: (f) => cat('kitten', { ears: 'back', eyes: f === 13 ? 'blink' : 'droopy', mouth: 'calm', blush: false, bob: f >= 8 ? 1 : 0 }),
  },
  {
    id: 'storm', label: 'Night · thunderstorm', clock: { h: 22, m: 15 }, time: 'night', weather: 'storm', spot: 'bed',
    note: 'Kept awake by the thunder: ears flat, eyes open, on its bed under the lamp.',
    cat: (f) => cat('kitten', { ears: 'back', eyes: f === 5 || f === 6 ? 'droopy' : 'open', mouth: 'calm', blush: false, bob: f % 4 < 2 ? 1 : 0 }),
  },
];

/** Render one variant's N frames into a single horizontal strip, lit per frame. */
function stripOf(v) {
  const frames = Array.from({ length: N }, (_, f) =>
    den({ time: v.time, weather: v.weather, clock: { ...v.clock, f }, cat: v.cat(f), spot: v.spot }));
  const rgba = frames.map(({ img, light }) => toRGBA(img, PALETTE, 1, null, light));
  const buf = Buffer.alloc(W * N * H * 4);
  rgba.forEach(({ buf: b }, i) => {
    for (let y = 0; y < H; y++) b.copy(buf, (y * W * N + i * W) * 4, y * W * 4, (y + 1) * W * 4);
  });
  return { buf, w: W * N, h: H };
}

mkdirSync(join(OUT, 'canvas-assets'), { recursive: true });
const uris = {};
for (const v of VARIANTS) {
  const png = encodePNG(stripOf(v));
  writeFileSync(join(OUT, 'canvas-assets', `den-${v.id}.png`), png);
  uris[v.id] = `data:image/png;base64,${png.toString('base64')}`;
}

// The published page, on the shared design system (spike/lib/page.mjs).
const byId = Object.fromEntries(VARIANTS.map((v) => [v.id, v]));
const scene = (id, scale, extra = '') =>
  `<div class="anim scene" role="img" aria-label="${byId[id].label}: ${byId[id].note}" style="width:${W * scale}px;background-image:url(${uris[id]})${extra}"></div>`;
const CSS = `
.scene{max-width:100%;aspect-ratio:16/10;border-radius:4px;display:block}
.tablet{background:#1d1c21;border-radius:36px;padding:clamp(12px,3vw,30px);display:inline-block;max-width:100%}
.center{display:flex;justify-content:center}
.vgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:34px 32px}
.vgrid b{display:block;font:13px/1.4 var(--label);letter-spacing:.04em;margin-top:12px}
.vgrid span{display:block;color:var(--mute);font-size:15px;margin-top:2px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px}
.cols>div{border-top:2px solid var(--line);padding-top:16px}.cols p{color:var(--mute);font-size:15px;margin:0}
table{border-collapse:collapse;font-size:14px;margin-top:10px}td{padding:4px 14px 4px 0;color:var(--mute)}td:first-child{color:var(--ink);font-weight:500}
`;
const body = `
<section>
  <p class="kicker">R2 · THE DEN</p>
  <h1>A corner of a Hong Kong flat.</h1>
  <p class="lede">The cat’s whole world: a bed, a bowl, a lamp, and a window onto the real time of
  day and the Observatory’s weather. At night it sleeps under the lamp while the city stays awake
  outside.</p>
  <div class="center"><div class="tablet">${scene('night', 6)}</div></div>
</section>
<section>
  <h2>The window tells the truth</h2>
  <p class="lede">Sky, light and the city follow the device’s clock. Weather comes from one read-only
  Hong Kong Observatory feed. If that feed fails or goes stale, the window shows only the time of
  day — never a guessed sky.</p>
  <div class="vgrid">${['day', 'dusk', 'rain', 'storm'].map((id) =>
    `<div>${scene(id, 3)}<b>${byId[id].label.toUpperCase()}</b><span>${byId[id].note}</span></div>`).join('')}</div>
</section>
<section>
  <h2>How it is built</h2>
  <div class="cols">
    <div><h3>One pixel size, any screen</h3><p>The room is 160 × 100 pixels, cat included, drawn at the
      largest whole-number scale the screen allows — so it stays crisp from a small tablet up to a
      monitor.</p>
      <table><tr><td>1280 × 800</td><td>×8</td></tr><tr><td>1920 × 1200</td><td>×12</td></tr>
      <tr><td>2560 × 1600</td><td>×16</td></tr><tr><td>1920 × 1080</td><td>×12, edges cropped</td></tr></table></div>
    <div><h3>Light in two zones</h3><p>At night the room drops to a cool dark, the lamp throws a warm
      pool over the bed, and a clear sky leaves a patch of moonlight on the floor. The edges are
      dithered, as pixel art should be, rather than blurred.</p></div>
    <div><h3>Weather is scenery</h3><p>It changes what the window shows and never what the cat is.
      Hunger, health and mood come only from time and care, so a month of the pet’s life can still be
      replayed exactly.</p></div>
    <div><h3>Places to be</h3><p>The bed, the rug and the window are spots the cat can occupy. Walking
      between them needs a side-view walk the character does not have yet — the next piece of art.</p></div>
  </div>
</section>`;
writeFileSync(join(OUT, 'den.html'), shell({
  title: 'Vivier — the den',
  description: 'The den for Vivier, a desktop electronic pet: a Hong Kong flat whose window follows the real time and weather.',
  current: 'den.html', css: CSS, body,
}));
console.log(`wrote ${VARIANTS.length} strips (${W * N}x${H}) and dist/den.html (published page)`);
