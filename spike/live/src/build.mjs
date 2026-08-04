// Live pet — SPIKE. Same status as P0 and the tuning viewer.
//
// What it IS: the real simulation core, running in a browser, ageing against the wall clock,
// surviving a refresh. Enough to feel the thing.
//
// What it is NOT — and these are exactly P2's and P5's acceptance criteria, deliberately absent:
//   * no clock-anomaly handling (a backwards system clock is clamped, not surfaced and persisted)
//   * no save-schema validation (a corrupt save is discarded, not reported as a LoadError)
//   * no write budgeting (it writes on a timer; flash endurance is a device concern P2 owns)
//   * no build-enforced core purity, and no ViewModel — the condition mapping here is throwaway
//
// THE SAVE FORMAT IS DISPOSABLE. P2 will define the real one and this pet will not survive it.
// Do not start the 30-day soak here.
//
// Run: node spike/live/src/build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { stripTypeScriptTypes } from 'node:module';
import { CELLS, PALETTE, LOGICAL, UPSCALE, CONDITIONS } from '../../p0-art/src/cells.mjs';

// --- bundle core/ for the browser ---------------------------------------------------------
// Node strips types natively; browsers do not. `stripTypeScriptTypes` is Node's own stripper,
// so the browser runs the same semantics the tests ran — not a re-transpilation that might differ.
const ORDER = [
  'core/src/types.ts', 'core/src/divmod.ts', 'core/src/sim/rules.ts',
  'core/src/sim/advance.ts', 'core/src/sim/events.ts', 'core/src/sim/replay.ts',
  'core/src/config.ts',
];
const bundle = ORDER.map((f) => stripTypeScriptTypes(readFileSync(f, 'utf8'), { mode: 'strip' })
  .replace(/^\s*import\s[\s\S]*?;\s*$/gm, '')
  .replace(/^export\s+/gm, ''))
  .join('\n');

const tuning = readFileSync('tuning/default.json', 'utf8');

// --- sprites ------------------------------------------------------------------------------
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
sprites.dead = sprites.sick;

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vivier (spike)</title><style>
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;background:#0b0d10;color:#e6e8ec;display:flex;align-items:center;
 justify-content:center;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
.frame{width:340px;background:#14161a;border:1px solid #262a31;border-radius:16px;padding:20px}
.screen{background:#0d0f12;border:1px solid #262a31;border-radius:10px;padding:16px 8px 10px;
 text-align:center;position:relative}
img{image-rendering:pixelated;display:block;margin:0 auto}
.cond{margin-top:10px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:#9aa2ad}
.age{font-size:12px;color:#5b626d;margin-top:2px}
.bars{margin-top:14px}
.bar{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:11px}
.bar span{width:74px;color:#9aa2ad;text-align:right}
.bar div{flex:1;height:7px;background:#1b1f26;border-radius:4px;overflow:hidden}
.bar i{display:block;height:100%;border-radius:4px;transition:width .3s}
.btns{display:flex;gap:8px;margin-top:16px}
button{flex:1;background:#1b1f26;color:#e6e8ec;border:1px solid #2d323b;border-radius:9px;
 padding:11px 0;font:inherit;font-size:13px;cursor:pointer}
button:active{background:#2a5f47;border-color:#3d8a68}
.away{position:absolute;inset:0;background:rgba(11,13,16,.94);border-radius:10px;display:none;
 flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center}
.away b{font-size:15px;display:block;margin-bottom:6px}
.away p{color:#9aa2ad;font-size:12.5px;margin:0 0 14px}
.foot{margin-top:14px;font-size:11px;color:#4d545e;line-height:1.5}
.foot b{color:#f0b86e;font-weight:600}
</style></head><body>
<div class="frame">
  <div class="screen">
    <img id="pet" width="192" height="192" alt="">
    <div class="cond" id="cond">—</div>
    <div class="age" id="age"></div>
    <div class="away" id="away">
      <b id="awayTitle"></b><p id="awayBody"></p>
      <button id="awayOk" style="flex:0 0 auto;padding:9px 22px">See how it is</button>
    </div>
  </div>
  <div class="bars" id="bars"></div>
  <div class="btns">
    <button id="feed">Feed</button><button id="play">Play</button><button id="clean">Clean</button>
  </div>
  <div class="foot"><b>Spike.</b> Real core, real wall clock, disposable save.
  No clock-anomaly handling, no save validation, no write budget — those are P2's job.
  Don't start the 30-day run here; P2 will change the format and this pet won't survive it.</div>
</div>
<script type="module">
${bundle}

const SPRITES = ${JSON.stringify(sprites)};
const KEY = 'vivier.spike.v1';
const COLOURS = { hunger:'#f0a35e', happiness:'#7ad4a0', cleanliness:'#7ab8f0',
                  health:'#f07a8a', weight:'#c9a0f0' };

const loaded = loadConfig(${tuning});
const cfg = loaded.config;
const ids = Object.keys(cfg.stats);
const pct = (id, v) => (v - cfg.stats[id].min) / (cfg.stats[id].max - cfg.stats[id].min);

function condition(s) {
  if (pct('health', s.stats.health) <= 0) return 'dead';
  if (pct('health', s.stats.health) < 0.4) return 'sick';
  if (pct('hunger', s.stats.hunger) > 0.7) return 'hungry';
  if (pct('cleanliness', s.stats.cleanliness) < 0.3) return 'dirty';
  return 'content';
}

// --- load, and resolve the gap since we were last here -------------------------------------
let state, awayMs = 0;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && saved.state) {
    state = saved.state;
    // SPIKE-LEVEL clock handling: a backwards clock is clamped to zero and forgotten.
    // P2 must instead persist a clockAnomaly flag and surface it — a restart currently
    // launders an untrustworthy clock into a trustworthy one, which is exactly the gap
    // the scope calls out. Left visibly wrong rather than half-solved.
    awayMs = Math.max(0, Date.now() - saved.at);
    state = advance(loaded, state, awayMs);
  }
} catch (e) { state = undefined; }
if (!state) { state = initialState(loaded, Date.now()); awayMs = 0; }

const save = () => localStorage.setItem(KEY, JSON.stringify({ state, at: Date.now() }));
let lastTick = Date.now();

document.getElementById('bars').innerHTML = ids.map((id) =>
  '<div class="bar"><span>' + id + '</span><div><i id="b_' + id +
  '" style="background:' + COLOURS[id] + '"></i></div></div>').join('');

let frame = 0;
function render() {
  const c = condition(state);
  document.getElementById('pet').src = SPRITES[c][frame];
  document.getElementById('cond').textContent = c;
  const days = Math.floor(state.ageMs / 86400000);
  const hrs = Math.floor(state.ageMs / 3600000) % 24;
  const mins = Math.floor(state.ageMs / 60000) % 60;
  document.getElementById('age').textContent =
    days > 0 ? days + 'd ' + hrs + 'h old' : hrs > 0 ? hrs + 'h ' + mins + 'm old' : mins + 'm old';
  for (const id of ids) {
    document.getElementById('b_' + id).style.width = (pct(id, state.stats[id]) * 100).toFixed(1) + '%';
  }
}

function tick() {
  const now = Date.now();
  // Elapsed comes from the clock, never from counting frames — a throttled or suspended tab
  // must not lose time. This is the one P2 property the spike does keep, because without it
  // the pet is not ageing in real time at all and the spike would prove nothing.
  const dt = Math.max(0, now - lastTick);
  if (dt > 0) { state = advance(loaded, state, dt); lastTick = now; }
  render();
}

function act(kind) {
  tick();
  state = apply(loaded, state, kind);
  save();
  render();
}
for (const k of ['feed', 'play', 'clean']) {
  document.getElementById(k).onclick = () => act(k);
}

// "You were away" — the pet showing that time passed, rather than quietly pretending it didn't.
if (awayMs > 5 * 60000) {
  const h = Math.floor(awayMs / 3600000), m = Math.floor(awayMs / 60000) % 60;
  document.getElementById('awayTitle').textContent =
    h >= 24 ? 'You were gone ' + Math.floor(h / 24) + ' days'
            : h > 0 ? 'You were gone ' + h + 'h ' + m + 'm' : 'You were gone ' + m + ' minutes';
  document.getElementById('awayBody').textContent = 'It kept ageing while you were away.';
  document.getElementById('away').style.display = 'flex';
  document.getElementById('awayOk').onclick = () => {
    document.getElementById('away').style.display = 'none';
  };
}

setInterval(tick, 1000);
setInterval(() => { frame ^= 1; render(); }, 550);
setInterval(save, 15000);
addEventListener('beforeunload', save);
render(); save();
</script></body></html>`;

mkdirSync('spike/live/dist', { recursive: true });
writeFileSync('spike/live/dist/index.html', html);
console.log(`wrote spike/live/dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
