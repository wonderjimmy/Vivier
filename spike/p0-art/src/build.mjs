// P0 art viability spike — bundle builder.
// Generates every preview page from ONE source (cells.mjs). No page hand-maintains a copy
// of the cell data; this is the pattern AC6.6 will require of the real manifest at P6.
//
// Run: node spike/p0-art/src/build.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LOGICAL, UPSCALE, PALETTE, CELLS, BASE_FRAMES, OVERLAYS, CONDITIONS,
} from './cells.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// --- validation: a miscounted row must fail the build, not render as garbage ---------
function validate() {
  const bad = [];
  for (const [id, rows] of Object.entries(CELLS)) {
    if (rows.length !== LOGICAL) bad.push(`${id}: ${rows.length} rows, expected ${LOGICAL}`);
    rows.forEach((r, y) => {
      if (r.length !== LOGICAL) bad.push(`${id} row ${y}: ${r.length} chars, expected ${LOGICAL}`);
      for (const ch of r) {
        if (!(ch in PALETTE)) bad.push(`${id} row ${y}: unknown palette char ${JSON.stringify(ch)}`);
      }
    });
  }
  if (bad.length) {
    console.error('CELL VALIDATION FAILED:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log(`cells ok: ${Object.keys(CELLS).length} cells, ${LOGICAL}x${LOGICAL} logical`);
}

// --- compositing --------------------------------------------------------------------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Compose base + optional overlay into an RGBA buffer, then upscale to the sprite cell.
// Overlay pixels are opaque wherever they are not '.', so an overlay can paint over the
// base but never subtract from it.
function compose(baseId, overlayId) {
  const base = CELLS[baseId];
  const ov = overlayId ? CELLS[overlayId] : null;
  const size = LOGICAL * UPSCALE;
  const px = Buffer.alloc(size * size * 4, 0);
  for (let y = 0; y < LOGICAL; y++) {
    for (let x = 0; x < LOGICAL; x++) {
      let ch = base[y][x];
      if (ov && ov[y][x] !== '.') ch = ov[y][x];
      const col = PALETTE[ch];
      if (!col) continue;
      const [r, g, b] = hex(col);
      for (let dy = 0; dy < UPSCALE; dy++) {
        for (let dx = 0; dx < UPSCALE; dx++) {
          const o = (((y * UPSCALE + dy) * size) + (x * UPSCALE + dx)) * 4;
          px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
        }
      }
    }
  }
  return { px, size };
}

// --- minimal PNG encoder (RGBA, filter 0) --------------------------------------------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(px, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const uri = (baseId, ovId) => {
  const { px, size } = compose(baseId, ovId);
  return `data:image/png;base64,${png(px, size).toString('base64')}`;
};

// --- page scaffolding ----------------------------------------------------------------
const CSS = `
*{box-sizing:border-box}
body{margin:0;padding:28px;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;
     background:#14161a;color:#e6e8ec}
h1{font-size:17px;margin:0 0 4px;letter-spacing:.2px}
p.note{margin:0 0 22px;color:#9aa2ad;max-width:60ch;font-size:12.5px}
img{image-rendering:pixelated;display:block}
.row{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start}
.cell{text-align:center}
.cell figcaption{margin-top:8px;font-size:11px;color:#9aa2ad;letter-spacing:.4px;text-transform:uppercase}
.plate{background:#0d0f12;border:1px solid #262a31;border-radius:8px;padding:12px;display:inline-block}
table{border-collapse:collapse}
th,td{padding:10px 12px;text-align:center}
th{font-size:11px;color:#9aa2ad;letter-spacing:.4px;text-transform:uppercase;font-weight:500}
td.lbl{text-align:right;font-size:11px;color:#9aa2ad;letter-spacing:.4px;text-transform:uppercase}
.desk{background:#0d0f12;border:1px solid #262a31;border-radius:10px;padding:20px}
.sep{height:1px;background:#262a31;margin:26px 0}
.warn{color:#f0b86e;font-size:12.5px;max-width:60ch}
`;

const page = (card, title, note, body) => `<!-- @dsCard group="${card}" -->
<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head>
<body><h1>${title}</h1><p class="note">${note}</p>${body}</body></html>`;

const sprite = (baseId, ovId, px) =>
  `<img src="${uri(baseId, ovId)}" width="${px}" height="${px}" alt="">`;

// --- pages ---------------------------------------------------------------------------
mkdirSync(join(OUT, 'stages'), { recursive: true });
mkdirSync(join(OUT, 'overlays'), { recursive: true });
mkdirSync(join(OUT, 'composition'), { recursive: true });
mkdirSync(join(OUT, 'glance'), { recursive: true });
validate();

// 1. base pose
writeFileSync(join(OUT, 'stages', 'child-idle.html'), page(
  'Stages', 'Child — idle, 2 frames',
  'The only life stage this spike draws. Frame B squashes the silhouette by one pixel while the '
  + 'face stays anchored, so a bob does not move the eyes. 32×32 logical, upscaled ×2 into the 64×64 cell.',
  `<div class="row">
    <figure class="cell"><div class="plate">${sprite('child.idle.a', null, 256)}</div><figcaption>frame A · 256px</figcaption></figure>
    <figure class="cell"><div class="plate">${sprite('child.idle.b', null, 256)}</div><figcaption>frame B · 256px</figcaption></figure>
    <figure class="cell"><div class="plate">${sprite('child.idle.a', null, 64)}${sprite('child.idle.b', null, 64)}</div><figcaption>both · 64px</figcaption></figure>
  </div>`));

// 2. overlays alone, and applied
writeFileSync(join(OUT, 'overlays', 'child-overlays.html'), page(
  'Overlays', 'Four condition overlays',
  'Each overlay is one cell, applied over the same base. Overlays can only add pixels, never '
  + 'remove them — so sick and sleeping repaint the eyes in body colour before drawing their own, '
  + 'and hungry repaints the neutral mouth. That eraser pixel is what ties an overlay to a body colour.',
  `<div class="row">${OVERLAYS.map((id) => `
    <figure class="cell"><div class="plate">${sprite('child.idle.a', id, 176)}</div>
    <figcaption>${id.replace('ov.', '')}</figcaption></figure>`).join('')}</div>`));

// 3. composition matrix — AC0.2
writeFileSync(join(OUT, 'composition', 'child-matrix.html'), page(
  'Composition', 'Composition matrix — 5 conditions × 2 frames',
  'Every square below is generated from the six authored cells. Nothing here is hand-drawn per '
  + 'combination: that is the whole claim ADR-003 makes, and this is the page that proves or breaks it.',
  `<table><tr><th></th>${CONDITIONS.map((c) => `<th>${c.id}</th>`).join('')}</tr>
   ${BASE_FRAMES.map((b, i) => `<tr><td class="lbl">frame ${'AB'[i]}</td>${CONDITIONS
     .map((c) => `<td>${sprite(b, c.overlay, 128)}</td>`).join('')}</tr>`).join('')}
   </table>`));

// 4. glance test — AC0.3, the go/no-go
writeFileSync(join(OUT, 'glance', 'actual-size.html'), page(
  'Glance test', 'Glance test — device-equivalent size',
  'AC0.3. Top row is the sprite as it would appear on the 2.8″ panel (64×64 blitted at ×3 = 192px). '
  + 'Bottom row simulates looking at it from across the desk. Question: can you name each condition '
  + 'without reading the labels? Cover them and try.',
  `<div class="desk"><div class="row">${CONDITIONS.map((c) => `
      <figure class="cell">${sprite('child.idle.a', c.overlay, 192)}<figcaption>${c.id}</figcaption></figure>`).join('')}</div>
   <div class="sep"></div>
   <div class="row">${CONDITIONS.map((c) => `
      <figure class="cell">${sprite('child.idle.a', c.overlay, 56)}<figcaption>${c.id}</figcaption></figure>`).join('')}</div>
   </div>
   <p class="warn" style="margin-top:20px">If a condition is only nameable because of its label, that
   condition has failed — not the label.</p>
   <p class="note" style="margin-top:18px"><strong>What this page cannot show you (AC0.5).</strong>
   The 192px figure is arithmetic only — a 64×64 cell blitted at ×3. It is not a simulation of the
   device. Four things differ and none of them are reproducible here: the panel's
   <em>brightness</em>, its <em>contrast</em>, its <em>reflectance</em> under desk lighting, and
   your own monitor and viewing distance. Judge the shapes and the separation between conditions;
   do not judge the colour or the perceived size.</p>`));

// --- evidence for AC0.1 / AC0.2 / AC0.4 ----------------------------------------------
const cellCount = Object.keys(CELLS).length;
console.log(`AC0.1  cells authored: ${cellCount}  (${BASE_FRAMES.length} base frames + ${OVERLAYS.length} overlays; budget 2 + <=4)`);
console.log(`AC0.2  matrix renders: ${BASE_FRAMES.length * CONDITIONS.length} squares from ${cellCount} source cells, 0 hand-authored pairs`);
console.log(`built 4 pages -> ${OUT}`);
