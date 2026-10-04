// R2 concept — the den. A corner of a Hong Kong flat, with a window onto real time and weather.
//
// SPIKE. Nothing here may be imported by core/ or host/. Canvas: 160 x 100 logical pixels (16:10),
// with a 160 x 90 safe area for 16:9 panels — the proposal pending as ADR-007. One logical pixel is
// the same size everywhere in the scene, cat included: no mixed pixel scales.
//
// The window is presentation only (ADR-008): time and weather change what is drawn, never a stat.

import { blank, set, get, blit, remap } from '../../lib/pixel.mjs';
import { PALETTE as CAT_PALETTE } from '../../r1-character/src/cat.mjs';

export const W = 160, H = 100;

export const PALETTE = {
  ...CAT_PALETTE,
  // room
  'wall.0': '#5f7f77', 'wall.1': '#7a9a90', 'wall.2': '#8eada2',
  'skirt.0': '#c9b79c', 'skirt.1': '#ecdfc8',
  'wood.0': '#5a3826', 'wood.1': '#7d4f35', 'wood.2': '#9a6643', 'wood.3': '#b98455',
  'frame.0': '#b9aa92', 'frame.1': '#efe5d3', 'frame.2': '#fffaf0',
  'curt.0': '#a8731f', 'curt.1': '#cf9a3a', 'curt.2': '#e8bd62', rod: '#3b2a22',
  'rug.0': '#4d607f', 'rug.1': '#6a7fa2', 'rug.2': '#c9d3e4',
  'bed.0': '#5e2430', 'bed.1': '#8a3644', 'bed.2': '#b24f5d', 'bed.3': '#d47a83',
  'pot.0': '#8a4228', 'pot.1': '#b5603a', 'pot.2': '#d17e52',
  'leaf.0': '#2f5a35', 'leaf.1': '#457c45', 'leaf.2': '#68a35a', 'leaf.3': '#93c674',
  'bowl.0': '#2f4f7a', 'bowl.1': '#4c74a8', 'bowl.2': '#7da1cf', kibble: '#8a5a32', water: '#a9d6f2',
  'lamp.pole': '#3b2a22', 'lamp.0': '#d8c49a', 'lamp.1': '#f1e3c0', 'lamp.glow': '#ffe7a3',
  'clock.face': '#f6efe2', 'clock.ink': '#2e1c20',
  // sky and city — drawn in their own colours, not lit by the room
  'sky.d0': '#7fb6e6', 'sky.d1': '#a4cdf0', 'sky.d2': '#cfe6f7',
  'sky.k0': '#5b4f93', 'sky.k1': '#b2678a', 'sky.k2': '#ec9a6c', 'sky.k3': '#f7c98d',
  'sky.n0': '#121a3a', 'sky.n1': '#1d2850', 'sky.n2': '#2a3866',
  'sky.r0': '#7d8792', 'sky.r1': '#98a2ac', 'sky.r2': '#b4bcc4',
  'sky.s0': '#3c4250', 'sky.s1': '#525a6a', 'sky.s2': '#6b7484',
  'city.d0': '#9fb0c2', 'city.d1': '#b7c5d3', 'city.dw': '#7f93a8',
  'city.k0': '#5a4a6e', 'city.k1': '#73608a', 'city.kw': '#f2c97a',
  'city.n0': '#0b1028', 'city.n1': '#141b3a', 'city.nw': '#f3d27e', 'city.nw2': '#ffeab0',
  'city.r0': '#8a939d', 'city.r1': '#a1a9b1', 'city.rw': '#6f7882',
  'cloud.0': '#c6ccd3', 'cloud.1': '#e2e6ea', 'cloud.s': '#4a5160',
  rain: '#d6e2ee', 'rain.d': '#9fb3c6', bolt: '#fffbe6', star: '#f4f0d8', 'moon.0': '#e9e1c0', 'moon.1': '#fbf6e2',
  'sun.0': '#ffd67a', 'sun.1': '#fff1c4',
};

// ---- drawing helpers --------------------------------------------------------------------

const rect = (img, x0, y0, x1, y1, k) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(img, x, y, k); };
const inEll = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function ell(img, cx, cy, rx, ry, k) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inEll(x, y, cx, cy, rx, ry)) set(img, x, y, k);
}
function line(img, x0, y0, x1, y1, k) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    set(img, x0, y0, k);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---- layout -----------------------------------------------------------------------------

export const GLASS = { x0: 50, y0: 12, x1: 111, y1: 51 };      // inside the window frame
const FLOOR_Y = 70;
export const SPOTS = {           // where the cat can be: top-left of its 32x32 sprite, and what it stands on
  rug: { x: 68, y: 60, ground: 'rug.0' },
  bed: { x: 17, y: 53, ground: 'bed.0' },
  window: { x: 66, y: 58, ground: 'rug.0' },
};
export const LAMP = { x: 12, y: 36 };

// ---- the window -------------------------------------------------------------------------

const TOWERS = [
  // [x, width, top] far layer then near layer — a dense Kowloon-ish skyline
  ['far', 50, 9, 26], ['far', 58, 7, 20], ['far', 64, 10, 24], ['far', 73, 8, 17], ['far', 80, 9, 22],
  ['far', 88, 8, 19], ['far', 95, 9, 25], ['far', 103, 9, 21],
  ['near', 50, 7, 33], ['near', 56, 9, 28], ['near', 66, 6, 36], ['near', 71, 10, 30], ['near', 82, 7, 34],
  ['near', 88, 9, 29], ['near', 97, 7, 35], ['near', 104, 8, 31],
];

function drawWindowView(img, time, weather, f) {
  const { x0, y0, x1, y1 } = GLASS;
  const h = y1 - y0;
  const sky = weather === 'storm' ? ['sky.s0', 'sky.s1', 'sky.s2']
    : weather === 'rain' || weather === 'cloudy' && time === 'day' ? ['sky.r0', 'sky.r1', 'sky.r2']
    : time === 'night' ? ['sky.n0', 'sky.n1', 'sky.n2']
    : time === 'dusk' ? ['sky.k0', 'sky.k1', 'sky.k2', 'sky.k3']
    : ['sky.d0', 'sky.d1', 'sky.d2'];
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / h;
    // dithered band edges so the gradient stays pixel art, not a smooth wash
    const band = Math.max(0, Math.min(sky.length - 1, Math.floor(t * sky.length + (y % 2 ? 0.12 : -0.12))));
    for (let x = x0; x < x1; x++) set(img, x, y, sky[band]);
  }
  const flash = weather === 'storm' && (f === 5 || f === 6);

  // sun / moon / stars
  if (weather === 'clear' && time === 'day') { ell(img, 98, 20, 4, 4, 'sun.0'); ell(img, 97, 19, 2, 2, 'sun.1'); }
  if (weather === 'clear' && time === 'dusk') { ell(img, 62, 40, 5, 5, 'sun.0'); ell(img, 61, 39, 3, 3, 'sun.1'); }
  if (weather === 'clear' && time === 'night') {
    ell(img, 97, 19, 3.5, 3.5, 'moon.0'); ell(img, 96, 18, 2, 2, 'moon.1'); ell(img, 99, 18, 2.6, 2.8, 'sky.n0');
    for (let i = 0; i < 14; i++) {
      const sx = x0 + Math.floor(hash(i, 3) * (x1 - x0)), sy = y0 + Math.floor(hash(i, 7) * 16);
      if ((f + i) % 7 !== 0) set(img, sx, sy, 'star');
    }
  }
  // clouds
  if (weather !== 'clear') {
    const c = weather === 'storm' ? 'cloud.s' : 'cloud.0';
    for (const [cx, cy, rx] of [[58, 15, 9], [72, 13, 8], [90, 16, 11], [104, 14, 8]]) {
      ell(img, cx + (f % 16) / 8, cy, rx, 3.4, c);
      if (weather !== 'storm') ell(img, cx - 2 + (f % 16) / 8, cy - 1, rx * 0.6, 2.2, 'cloud.1');
    }
  }

  // city
  const pal = weather === 'rain' || weather === 'storm' || (weather === 'cloudy' && time === 'day')
    ? (time === 'night' ? ['city.n0', 'city.n1', 'city.nw'] : ['city.r0', 'city.r1', 'city.rw'])
    : time === 'night' ? ['city.n0', 'city.n1', 'city.nw']
    : time === 'dusk' ? ['city.k0', 'city.k1', 'city.kw']
    : ['city.d0', 'city.d1', 'city.dw'];
  TOWERS.forEach(([layer, tx, tw, top], ti) => {
    const face = layer === 'far' ? pal[1] : pal[0];
    for (let y = y0 + top; y < y1; y++) for (let x = tx; x < Math.min(tx + tw, x1); x++) {
      const isWin = (x - tx) % 2 === 1 && (y - y0 - top) % 3 === 1 && x < tx + tw - 1;
      let k = face;
      if (isWin) {
        const lit = time === 'night' ? hash(x * 7 + ti, y) < 0.42 && !((f + x + y) % 37 === 0)
          : time === 'dusk' ? hash(x, y + ti) < 0.18 : false;
        k = lit ? (time === 'night' && hash(y, x) < 0.25 ? 'city.nw2' : pal[2]) : (time === 'day' && layer === 'near' ? pal[2] : face);
      }
      set(img, x, y, k);
    }
  });

  // rain / storm
  if (weather === 'rain' || weather === 'storm') {
    const n = weather === 'storm' ? 44 : 30;
    for (let i = 0; i < n; i++) {
      const sx = x0 + Math.floor(hash(i, 11) * (x1 - x0 + 12)), sy0 = Math.floor(hash(i, 13) * h);
      const sy = y0 + ((sy0 + f * 6) % h);
      // a 5-pixel slant, bright at the head, darker at the tail
      for (let k = 0; k < 5; k++) {
        const px = sx - Math.floor(k / 2), py = sy - k;
        if (px >= x0 && px < x1 && py >= y0 && py < y1) set(img, px, py, k < 2 ? 'rain' : 'rain.d');
      }
    }
  }
  if (flash) {
    let bx = 86, by = y0;
    for (const [dx, dy] of [[-2, 4], [2, 4], [-3, 5], [2, 4], [-2, 5]]) { line(img, bx, by, bx + dx, by + dy, 'bolt'); bx += dx; by += dy; }
  }
  return flash;
}

// ---- the room ---------------------------------------------------------------------------

function drawRoom(img, time, weather, clock) {
  // wall, with a faint vertical paper pattern and a ceiling shadow
  rect(img, 0, 0, W, FLOOR_Y, 'wall.1');
  for (let x = 3; x < W; x += 6) for (let y = 4; y < FLOOR_Y - 2; y++) if ((y + x) % 3 !== 0) set(img, x, y, 'wall.2');
  rect(img, 0, 0, W, 3, 'wall.0');
  // skirting
  rect(img, 0, FLOOR_Y - 3, W, FLOOR_Y, 'skirt.1'); rect(img, 0, FLOOR_Y - 3, W, FLOOR_Y - 2, 'ink'); rect(img, 0, FLOOR_Y - 1, W, FLOOR_Y, 'skirt.0');
  // floor planks
  for (let y = FLOOR_Y; y < H; y++) {
    const row = Math.floor((y - FLOOR_Y) / 6);
    for (let x = 0; x < W; x++) {
      const seam = (y - FLOOR_Y) % 6 === 0;
      const joint = (x + row * 17) % 46 === 0;
      const plank = Math.floor((x + row * 17) / 46);
      const grain = (y - FLOOR_Y) % 6 === 3 && hash(x >> 2, row * 31 + plank) < 0.35;
      set(img, x, y, seam || joint ? 'wood.0' : grain ? 'wood.1' : (hash(plank, row) < 0.5 ? 'wood.1' : 'wood.2'));
    }
  }
  // sunlight through the window onto the floor
  if (weather === 'clear' && time !== 'night') {
    const shift = time === 'dusk' ? -16 : -4;
    for (let y = FLOOR_Y + 1; y < FLOOR_Y + 16; y++) {
      const a = 52 + shift + Math.round((y - FLOOR_Y) * (time === 'dusk' ? 1.6 : 0.5));
      for (let x = a; x < a + 52; x++) {
        const k = get(img, x, y);
        if (k === 'wood.1' || k === 'wood.2') set(img, x, y, k === 'wood.1' ? 'wood.2' : 'wood.3');
      }
    }
  }

  // window: curtains behind the frame edges, frame, glass, mullions, sill
  rect(img, 34, 4, 126, 6, 'rod');
  for (const [cx0, cx1] of [[38, 47], [113, 122]]) {
    for (let y = 6; y < 60; y++) for (let x = cx0; x < cx1; x++) {
      const fold = (x - cx0) % 3;
      set(img, x, y, x === cx0 || x === cx1 - 1 ? 'curt.0' : fold === 0 ? 'curt.0' : fold === 1 ? 'curt.2' : 'curt.1');
    }
    rect(img, cx0, 59, cx1, 60, 'curt.0');
  }
  rect(img, 46, 8, 115, 55, 'ink');
  rect(img, 47, 9, 114, 54, 'frame.1');
  rect(img, 47, 9, 114, 10, 'frame.2');
  rect(img, 47, 53, 114, 54, 'frame.0');
  const flash = drawWindowView(img, time, weather, clock.f);
  for (let y = GLASS.y0; y < GLASS.y1; y++) { set(img, 80, y, 'frame.1'); set(img, 81, y, 'frame.0'); }
  for (let x = GLASS.x0; x < GLASS.x1; x++) set(img, x, 31, 'frame.1');
  rect(img, 42, 55, 119, 57, 'frame.2'); rect(img, 42, 57, 119, 58, 'frame.0'); rect(img, 41, 55, 42, 58, 'ink'); rect(img, 119, 55, 120, 58, 'ink'); rect(img, 41, 58, 120, 59, 'ink');

  // wall clock — shows the real time it is given
  const cc = [26, 16];
  ell(img, cc[0], cc[1], 7, 7, 'ink'); ell(img, cc[0], cc[1], 6, 6, 'clock.face');
  for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) set(img, Math.floor(cc[0] + dx), Math.floor(cc[1] + dy), 'clock.ink');
  const hand = (frac, len) => line(img, cc[0], cc[1] - 1 + 1, Math.round(cc[0] + Math.sin(frac * 2 * Math.PI) * len), Math.round(cc[1] - Math.cos(frac * 2 * Math.PI) * len), 'clock.ink');
  hand(((clock.h % 12) + clock.m / 60) / 12, 3); hand(clock.m / 60, 5);

  // floor lamp in the left corner
  rect(img, 11, 41, 13, 91, 'lamp.pole');
  ell(img, 12, 91, 5, 1.6, 'lamp.pole');
  for (let y = 30; y < 42; y++) {
    const half = 4 + Math.floor((y - 30) / 2);
    for (let x = 12 - half; x < 12 + half; x++) set(img, x, y, x === 12 - half || x === 12 + half - 1 || y === 30 || y === 41 ? 'ink' : time === 'night' ? 'lamp.glow' : (x < 12 ? 'lamp.1' : 'lamp.0'));
  }

  // plant in the right corner
  for (const [cx, cy, rx, ry, k] of [[136, 44, 8, 6, 'leaf.0'], [145, 40, 7, 7, 'leaf.1'], [131, 52, 7, 5, 'leaf.1'], [140, 34, 6, 6, 'leaf.2'],
    [149, 50, 6, 5, 'leaf.0'], [137, 46, 4, 3, 'leaf.3'], [144, 38, 3, 2.5, 'leaf.3']]) ell(img, cx, cy, rx, ry, k);
  rect(img, 132, 58, 150, 76, 'ink'); rect(img, 133, 59, 149, 75, 'pot.1'); rect(img, 133, 59, 136, 75, 'pot.2'); rect(img, 145, 59, 149, 75, 'pot.0'); rect(img, 131, 57, 151, 60, 'pot.0'); rect(img, 132, 57, 150, 58, 'pot.2');

  // rug
  ell(img, 84, 91, 31, 6.5, 'rug.0'); ell(img, 84, 91, 29, 5.2, 'rug.1');
  for (let x = 58; x < 111; x += 4) for (let y = 87; y < 96; y++) if (inEll(x, y, 84, 91, 27, 4.4) && (x + y) % 2) set(img, x, y, 'rug.2');

  // the cat's bed: a round cushion
  ell(img, 33, 86, 19, 7.5, 'ink'); ell(img, 33, 86, 18, 6.5, 'bed.1'); ell(img, 33, 87, 18, 5.5, 'bed.0');
  ell(img, 33, 84.5, 14, 4.2, 'bed.2'); ell(img, 31, 83.5, 9, 2.2, 'bed.3');

  // bowls
  ell(img, 117, 92, 6.5, 2.6, 'ink'); ell(img, 117, 92, 5.5, 1.8, 'bowl.1'); ell(img, 117, 91, 4.5, 1, 'kibble');
  ell(img, 128, 94, 6, 2.4, 'ink'); ell(img, 128, 94, 5, 1.6, 'frame.2'); ell(img, 128, 93.4, 4, 0.9, 'water');

  return flash;
}

/** Compose the den. `cat` is a 32x32 indexed sprite; `spot` names where it is. */
export function den({ time = 'day', weather = 'clear', clock = { h: 10, m: 10, f: 0 }, cat = null, spot = 'rug' } = {}) {
  const img = blank(W, H);
  const flash = drawRoom(img, time, weather, clock);
  if (cat) {
    const s = SPOTS[spot];
    blit(img, remap(cat, { ground: s.ground }), s.x, s.y);
  }
  return { img, light: lighting(time, weather, flash) };
}

// ---- light ------------------------------------------------------------------------------
// Two zones, hard-edged with a dithered seam: lamp light and everything else. The window glass is
// never multiplied — the sky carries its own colours.

function lighting(time, weather, flash) {
  const inGlass = (x, y) => x >= GLASS.x0 && x < GLASS.x1 && y >= GLASS.y0 && y < GLASS.y1;
  const ambient = flash ? [1.25, 1.25, 1.3]
    : time === 'night' ? [0.34, 0.38, 0.58]
    : weather === 'storm' ? [0.62, 0.66, 0.78]
    : weather === 'rain' ? [0.8, 0.85, 0.92]
    : time === 'dusk' ? [1.0, 0.84, 0.72]
    : null;
  if (!ambient) return null;
  const lampWarm = [1.0, 0.86, 0.62];
  const lampDim = [0.66, 0.6, 0.6];
  const moon = [0.58, 0.66, 0.92];
  return (x, y) => {
    if (inGlass(x, y)) return flash ? [1.15, 1.15, 1.2] : null;
    if (time !== 'night' || flash) return ambient;
    // the shade throws light down and out: an ellipse wider than tall, centred near the floor
    const d = Math.hypot((x - (LAMP.x + 14)) / 1.35, (y - (LAMP.y + 44)) / 0.95);
    // the cone directly under the shade, so the lamp itself sits in its own light
    const cone = y >= LAMP.y && y < LAMP.y + 60 && Math.abs(x - LAMP.x) < 6 + (y - LAMP.y) * 0.55;
    if (d < 21 || cone) return lampWarm;
    if (d < 24) return (x + y) % 2 ? lampWarm : lampDim;      // dithered falloff, two steps
    if (d < 27) return (x + y) % 2 ? lampDim : ambient;
    if (weather === 'clear' && y >= FLOOR_Y + 1 && y < FLOOR_Y + 14) {   // moonlight through the window
      const a = 56 + Math.round((y - FLOOR_Y) * 0.4);
      if (x >= a && x < a + 48) return moon;
    }
    return ambient;
  };
}
