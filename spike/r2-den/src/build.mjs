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

// local preview, animated with the same CSS steps() technique as the character sheet
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vivier — the den</title><style>
body{margin:0;padding:24px;background:#1c1f24;color:#e8e3da;font:14px/1.5 system-ui,sans-serif}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:24px}
.s{width:480px;height:300px;image-rendering:pixelated;background-repeat:no-repeat;background-size:${N * 100}% 100%;
   animation:sp 2.4s steps(${N},jump-none) infinite;border-radius:6px}
@keyframes sp{from{background-position:0 0}to{background-position:100% 0}}
b{display:block;margin-top:8px}span{color:#a39b8e}</style></head><body><div class="g">${
  VARIANTS.map((v) => `<div><div class="s" style="background-image:url(${uris[v.id]})"></div><b>${v.label}</b><span>${v.note}</span></div>`).join('')
}</div></body></html>`;
writeFileSync(join(OUT, 'den.html'), html);
console.log(`wrote ${VARIANTS.length} strips (${W * N}x${H}) and dist/den.html`);
