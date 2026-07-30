// Tuning viewer — SPIKE, same status as P0.
//
// Its only job is to make the decay curve visible, because DIAGNOSE root 4 says the curve is a
// felt property that no test can close. It is NOT P5: nothing here may be imported by core/ or
// host/, and P5 re-authors the shell from scratch.
//
// It reads the real core and the real tuning config, so what you see is what the pet actually
// does — not an illustration of what it is supposed to do.
//
// Run: node spike/tuning-view/src/build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { loadConfig, initialState, replay } from '../../../core/src/index.ts';
import { CELLS, PALETTE, LOGICAL, UPSCALE, CONDITIONS } from '../../p0-art/src/cells.mjs';

const MS_HOUR = 3600000;
const MS_DAY = 86400000;
const DAYS = 30;

const loaded = loadConfig(JSON.parse(readFileSync('tuning/default.json', 'utf8')));
const cfg = loaded.config;
const statIds = Object.keys(cfg.stats);
const pct = (id, v) => (v - cfg.stats[id].min) / (cfg.stats[id].max - cfg.stats[id].min);

// SPIKE-LOCAL condition mapping. This is NOT the ViewModel — that is P4's job, defined against
// P4's own criteria. This is a throwaway reading, good enough to put a face on a number.
function condition(s) {
  if (pct('health', s.stats.health) <= 0) return 'dead';
  if (pct('health', s.stats.health) < 0.4) return 'sick';
  if (pct('hunger', s.stats.hunger) > 0.7) return 'hungry';
  if (pct('cleanliness', s.stats.cleanliness) < 0.3) return 'dirty';
  return 'content';
}

// --- care patterns, as data ---------------------------------------------------------------
const every = (perDay, kinds) => {
  const out = [];
  for (let d = 0; d < DAYS; d++) {
    for (let i = 0; i < perDay; i++) {
      const at = d * MS_DAY + Math.round(((i + 0.5) / perDay) * MS_DAY);
      out.push({ atMs: at, kind: kinds[i % kinds.length] });
    }
  }
  return out;
};
const PATTERNS = [
  { id: 'neglect', label: 'Never touched', events: [] },
  { id: 'light', label: '2 interactions / day', events: every(2, ['feed', 'play']) },
  { id: 'daily', label: '4 / day (feed, play, feed, clean)', events: every(4, ['feed', 'play', 'feed', 'clean']) },
  { id: 'devoted', label: '8 / day', events: every(8, ['feed', 'play', 'feed', 'clean', 'feed', 'play', 'feed', 'clean']) },
];

// --- run the real core, hourly ------------------------------------------------------------
const s0 = initialState(loaded, 0);
const series = PATTERNS.map((p) => {
  const samples = [];
  for (let h = 0; h <= DAYS * 24; h++) {
    const s = replay(loaded, s0, p.events, h * MS_HOUR);
    samples.push({
      h,
      stats: Object.fromEntries(statIds.map((id) => [id, Math.round(pct(id, s.stats[id]) * 1000)])),
      cond: condition(s),
    });
  }
  return { ...p, samples, events: undefined, eventCount: p.events.length };
});

// --- sprites (P0 cells, composited here) ---------------------------------------------------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function compose(baseId, overlayId) {
  const base = CELLS[baseId];
  const ov = overlayId ? CELLS[overlayId] : null;
  const size = LOGICAL * UPSCALE;
  const px = Buffer.alloc(size * size * 4, 0);
  for (let y = 0; y < LOGICAL; y++) for (let x = 0; x < LOGICAL; x++) {
    let ch = base[y][x];
    if (ov && ov[y][x] !== '.') ch = ov[y][x];
    const col = PALETTE[ch];
    if (!col) continue;
    const [r, g, b] = hex(col);
    for (let dy = 0; dy < UPSCALE; dy++) for (let dx = 0; dx < UPSCALE; dx++) {
      const o = (((y * UPSCALE + dy) * size) + (x * UPSCALE + dx)) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  return { px, size };
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, c]);
};
function png(px, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const sprites = {};
for (const c of CONDITIONS) {
  sprites[c.id] = ['child.idle.a', 'child.idle.b'].map((b) => {
    const { px, size } = compose(b, c.overlay);
    return `data:image/png;base64,${png(px, size).toString('base64')}`;
  });
}
// `dead` has no P0 overlay; the spike reuses `sick` and says so on the page rather than
// inventing a corpse sprite the art phase has not designed.
sprites.dead = sprites.sick;

const STAT_COLOURS = {
  hunger: '#f0a35e', happiness: '#7ad4a0', cleanliness: '#7ab8f0',
  health: '#f07a8a', weight: '#c9a0f0',
};

const DATA = JSON.stringify({ series, sprites, statIds, colours: STAT_COLOURS, days: DAYS });

const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Vivier — tuning viewer (spike)</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#14161a;color:#e6e8ec;
 font:14px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
h1{font-size:17px;margin:0 0 2px}p.note{color:#9aa2ad;font-size:12.5px;margin:0 0 20px;max-width:74ch}
.wrap{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}
.pet{background:#0d0f12;border:1px solid #262a31;border-radius:10px;padding:18px;text-align:center;min-width:250px}
img{image-rendering:pixelated;display:block;margin:0 auto}
.cond{margin-top:12px;font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:#9aa2ad}
.when{font-size:22px;margin-top:4px}
.panel{flex:1;min-width:420px}
canvas{width:100%;height:230px;background:#0d0f12;border:1px solid #262a31;border-radius:10px;display:block}
input[type=range]{width:100%;margin:16px 0 4px}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#9aa2ad;margin-top:10px}
.legend b{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}
.tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
button{background:#1b1f26;color:#e6e8ec;border:1px solid #2d323b;border-radius:7px;
 padding:7px 12px;font:inherit;font-size:12.5px;cursor:pointer}
button[aria-pressed=true]{background:#2a5f47;border-color:#3d8a68}
table{border-collapse:collapse;margin-top:14px;font-size:12.5px}
td{padding:3px 14px 3px 0}td.k{color:#9aa2ad}
.warn{color:#f0b86e;font-size:12.5px;max-width:74ch;margin-top:20px}
</style></head><body>
<h1>Vivier — tuning viewer <span style="color:#9aa2ad;font-weight:400">(spike, not the app)</span></h1>
<p class="note">Every number here comes from the real simulation core reading the real
<code>tuning/default.json</code>. Nothing is illustrated. Drag the slider to move through 30 days;
switch care patterns to compare. The <code>dead</code> state reuses the <code>sick</code> sprite —
the art phase has not designed a corpse, and inventing one here would be the page lying to you.</p>
<div class="tabs" id="tabs"></div>
<div class="wrap">
  <div class="pet">
    <img id="sprite" width="224" height="224" alt="">
    <div class="when" id="when">Day 0</div>
    <div class="cond" id="cond">content</div>
    <table id="stats"></table>
  </div>
  <div class="panel">
    <canvas id="chart" width="900" height="230"></canvas>
    <input type="range" id="slider" min="0" max="${DAYS * 24}" value="0">
    <div class="legend" id="legend"></div>
  </div>
</div>
<p class="warn" id="verdict"></p>
<script>
const D = ${DATA};
let pat = 0, hour = 0, frame = 0;
const $ = (id) => document.getElementById(id);

$('tabs').innerHTML = D.series.map((s, i) =>
  '<button data-i="' + i + '">' + s.label + '</button>').join('');
$('tabs').onclick = (e) => { if (e.target.dataset.i) { pat = +e.target.dataset.i; draw(); } };
$('legend').innerHTML = D.statIds.map((id) =>
  '<span><b style="background:' + D.colours[id] + '"></b>' + id + '</span>').join('');
$('slider').oninput = (e) => { hour = +e.target.value; draw(); };

function chart() {
  const c = $('chart'), x = c.getContext('2d');
  const S = D.series[pat].samples;
  x.clearRect(0, 0, c.width, c.height);
  x.strokeStyle = '#262a31'; x.lineWidth = 1;
  for (let d = 0; d <= D.days; d += 5) {
    const px = (d / D.days) * c.width;
    x.beginPath(); x.moveTo(px, 0); x.lineTo(px, c.height); x.stroke();
    x.fillStyle = '#5b626d'; x.font = '11px system-ui';
    x.fillText('d' + d, px + 4, c.height - 6);
  }
  for (const id of D.statIds) {
    x.strokeStyle = D.colours[id]; x.lineWidth = 1.6; x.beginPath();
    S.forEach((s, i) => {
      const px = (i / (S.length - 1)) * c.width;
      const py = c.height - 14 - (s.stats[id] / 1000) * (c.height - 26);
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    });
    x.stroke();
  }
  const px = (hour / (S.length - 1)) * c.width;
  x.strokeStyle = '#e6e8ec'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(px, 0); x.lineTo(px, c.height); x.stroke();
}

function draw() {
  const S = D.series[pat].samples[hour];
  $('sprite').src = D.sprites[S.cond][frame];
  $('cond').textContent = S.cond;
  $('when').textContent = 'Day ' + Math.floor(hour / 24) + ', ' + (hour % 24) + ':00';
  $('stats').innerHTML = D.statIds.map((id) =>
    '<tr><td class="k">' + id + '</td><td style="color:' + D.colours[id] + '">' +
    (S.stats[id] / 10).toFixed(1) + '%</td></tr>').join('');
  [...$('tabs').children].forEach((b, i) => b.setAttribute('aria-pressed', i === pat));
  chart();

  const last = D.series[pat].samples[D.series[pat].samples.length - 1];
  const died = D.series[pat].samples.findIndex((s) => s.cond === 'dead');
  $('verdict').textContent = died >= 0
    ? 'On this pattern the pet reaches a dead state at day ' + Math.floor(died / 24) +
      ', hour ' + (died % 24) + '. Interactions over 30 days: ' + D.series[pat].eventCount + '.'
    : 'Survives 30 days on ' + D.series[pat].eventCount + ' interactions. ' +
      'Ends at health ' + (last.stats.health / 10).toFixed(1) + '%.';
}
setInterval(() => { frame ^= 1; $('sprite').src = D.sprites[D.series[pat].samples[hour].cond][frame]; }, 550);
draw();
</script></body></html>`;

mkdirSync('spike/tuning-view/dist', { recursive: true });
writeFileSync('spike/tuning-view/dist/index.html', html);

// Console summary — the same facts, for the record.
console.log('pattern            interactions/30d   died at        health@30d');
for (const s of series) {
  const died = s.samples.findIndex((x) => x.cond === 'dead');
  const end = s.samples[s.samples.length - 1];
  console.log(
    s.label.padEnd(34),
    String(s.eventCount).padStart(5),
    (died >= 0 ? `day ${Math.floor(died / 24)} h${died % 24}` : 'survived').padStart(14),
    `${(end.stats.health / 10).toFixed(1)}%`.padStart(10),
  );
}
console.log('\nwrote spike/tuning-view/dist/index.html');
