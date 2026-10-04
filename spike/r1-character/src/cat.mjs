// R1 character concept — a parametric pixel cat.
//
// SPIKE. Its job is to fix the pet's design language for the human's taste call. Nothing here may
// be imported by core/ or host/; whether this generator graduates into the shipping art pipeline
// is decided at P6, against P6's own criteria.
//
// The design is a paper doll, not a sprite sheet:
//   * the BODY is generated from per-stage geometry (stage proportions are data);
//   * the FACE is hand-drawn stamps placed at an anchor COMPUTED from the head geometry;
//   * conditions are palette remaps and stamp swaps, never new drawings.
// That is ADR-003's "additive, not multiplicative" rule made structural: adding a stage adds
// geometry numbers, not art, and every expression works on every stage for free.
//
// Grid: 32 x 32 logical, symmetric about the line between columns 15 and 16, so a mirrored
// coordinate is x' = 32 - x in continuous space and c' = 31 - c in pixel space.

import { blank, set, get, stamp, blit, remap } from '../../lib/pixel.mjs';

export const SIZE = 32;

export const PALETTE = {
  ink: '#3d2128',
  inkL: '#7b3a26',      // selective outline: the lit edge is drawn lighter, the shadow edge dark
  'fur.0': '#a5481f', 'fur.1': '#d2662b', 'fur.2': '#ec8c43', 'fur.3': '#ffbd6e',
  stripe: '#8a3416',
  'cream.0': '#deae84', 'cream.1': '#f6dcb8', 'cream.2': '#fff4e2',
  'pink.0': '#d65d78', 'pink.1': '#f59cab',
  eye: '#25151c', glint: '#ffffff',
  ground: '#d9c8b0',   // contact shadow; overridden per presentation background
  // effects
  'fx.blue': '#5aa8ff', 'fx.blueL': '#b9dcff', 'fx.grime': '#6e4b2c', 'fx.fly': '#2b2b33',
  'fx.gold': '#ffd45c', 'fx.goldD': '#d9a12b', 'fx.heart': '#ff5d7a', 'fx.white': '#ffffff',
  'fx.stink': '#9bb06a',
};

// Condition palettes: the whole animal changes colour, which reads from across a room in a way a
// small icon never does — the lesson P0 paid for.
export const SICK = {
  'fur.0': 'sick.0', 'fur.1': 'sick.1', 'fur.2': 'sick.2', 'fur.3': 'sick.3', stripe: 'sick.s',
  'cream.0': 'sickc.0', 'cream.1': 'sickc.1', 'cream.2': 'sickc.2', 'pink.0': 'sick.p', 'pink.1': 'sick.p',
  inkL: 'sick.s',
};
export const FADED = {
  'fur.0': 'fade.0', 'fur.1': 'fade.1', 'fur.2': 'fade.2', 'fur.3': 'fade.3', stripe: 'fade.s',
  'cream.0': 'fade.1', 'cream.1': 'fade.2', 'cream.2': 'fade.3', 'pink.0': 'fade.p', 'pink.1': 'fade.p',
  inkL: 'fade.s',
};
export const GHOST = {
  'fur.0': 'ghost.0', 'fur.1': 'ghost.1', 'fur.2': 'ghost.2', 'fur.3': 'ghost.3', stripe: 'ghost.1',
  'cream.0': 'ghost.2', 'cream.1': 'ghost.3', 'cream.2': 'ghost.3', 'pink.0': 'ghost.1', 'pink.1': 'ghost.2',
  ink: 'ghost.ink', inkL: 'ghost.0', eye: 'ghost.ink',
};
Object.assign(PALETTE, {
  // newborn's basket and blanket — props, so condition remaps leave them alone
  'wick.0': '#5e3620', 'wick.1': '#8c5630', 'wick.2': '#b77b47', 'wick.3': '#d9a771',
  'blank.0': '#6f98c4', 'blank.1': '#9dbfe3', 'blank.2': '#cfe1f4',
  'sick.0': '#6f7b45', 'sick.1': '#93a05c', 'sick.2': '#b5bd7b', 'sick.3': '#d6d9a3', 'sick.s': '#5d6939',
  'sickc.0': '#c2c49a', 'sickc.1': '#dcdcb9', 'sickc.2': '#eeeed6', 'sick.p': '#b98b8b',
  'fade.0': '#8a7c78', 'fade.1': '#a89a94', 'fade.2': '#c4b8b1', 'fade.3': '#ddd4cd', 'fade.s': '#776a66', 'fade.p': '#c7a6a6',
  'ghost.0': '#a9b9d6', 'ghost.1': '#c9d6ec', 'ghost.2': '#e3ebf8', 'ghost.3': '#f7faff', 'ghost.ink': '#7f8fb3',
});

// ---- shapes -----------------------------------------------------------------------------

const ellipse = (cx, cy, rx, ry) => ({
  cx, cy, rx, ry,
  test: (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1,
});

const union = (...shapes) => ({ ...shapes[0], test: (x, y) => shapes.some((s) => s.test(x, y)) });

function triangle(a, b, c) {
  const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  return {
    test: (x, y) => {
      const p = [x + 0.5, y + 0.5];
      const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(neg && pos);
    },
  };
}

/** A tapered quadratic Bézier — the tail. Thick at the root, thinner at the tip. */
function stroke(p0, p1, p2, r) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, u = 1 - t;
    pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], t]);
  }
  return {
    pts,
    test: (x, y) => pts.some(([px, py, t]) => (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= (r * (1 - 0.28 * t)) ** 2),
    // parameter along the stroke of the nearest centreline point, for ring stripes
    along: (x, y) => {
      let best = Infinity, bt = 0;
      for (const [px, py, t] of pts) {
        const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
        if (d < best) { best = d; bt = t; }
      }
      return bt;
    },
  };
}

const maskOf = (shape) => {
  const m = blank(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (shape.test(x, y)) m.px[y][x] = 1;
  return m;
};
const inside = (m, x, y) => get(m, x, y) === 1;
const isEdge = (m, x, y) =>
  inside(m, x, y) && (!inside(m, x - 1, y) || !inside(m, x + 1, y) || !inside(m, x, y - 1) || !inside(m, x, y + 1));

// Light from the upper left, slightly in front. Sphere shading, quantised to the ramp.
const L = [-0.55, -0.7, 0.45];
function sphereBand(s, x, y) {
  const nx = (x + 0.5 - s.cx) / s.rx, ny = (y + 0.5 - s.cy) / s.ry;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const i = nx * L[0] + ny * L[1] + nz * L[2];
  return i > 0.66 ? 3 : i > 0.28 ? 2 : i > -0.2 ? 1 : 0;
}

/** Paint a filled, outlined, shaded shape. `ramp` is a palette prefix: 'fur' or 'cream'. */
function paint(img, shape, ramp, { outline = true, shadeFrom = shape, clip = null, band = null } = {}) {
  const m = maskOf(shape);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inside(m, x, y)) continue;
      if (clip && (!inside(clip, x, y) || isEdge(clip, x, y))) continue;
      if (outline && isEdge(m, x, y)) {
        const litEdge = (!inside(m, x, y - 1) || !inside(m, x - 1, y)) && inside(m, x + 1, y) && inside(m, x, y + 1);
        set(img, x, y, litEdge && sphereBand(shadeFrom, x, y) >= 2 ? 'inkL' : 'ink');
        continue;
      }
      const b = band ? band(x, y) : sphereBand(shadeFrom, x, y);
      set(img, x, y, `${ramp}.${Math.min(b, ramp === 'cream' ? 2 : 3)}`);
    }
  }
  return m;
}

// ---- stage geometry ---------------------------------------------------------------------
// Everything a stage IS lives in these numbers. The face stamps never change between stages;
// only the anchor they are placed at does, and that anchor is computed from the head.

export const STAGES = {
  kitten: {
    body: { cy: 25.4, rx: 6.3, ry: 4.6 }, head: { cy: 16.2, rx: 9, ry: 7 },
    ear: { base: 10.4, tip: [9.3, 5.2] },
    tail: [[20.6, 26.2], [29.6, 27.6], [26.2, 18.6]], tailR: 2.15,
    paws: { y: 29.3, dx: 3.2, rx: 2.1, ry: 1.35 },
  },
  junior: {
    body: { cy: 24.4, rx: 7.4, ry: 5.7 }, head: { cy: 14.0, rx: 9, ry: 7 },
    ear: { base: 8.2, tip: [9.0, 2.8] },
    tail: [[21.6, 25.8], [31.2, 27.4], [27.4, 15.4]], tailR: 2.25,
    paws: { y: 29.4, dx: 3.6, rx: 2.2, ry: 1.4 },
  },
  adult: {
    body: { cy: 23.6, rx: 9.4, ry: 6.9 }, head: { cy: 12.6, rx: 9, ry: 7 },
    ear: { base: 6.8, tip: [8.8, 1.2] },
    tail: [[23.4, 26.0], [32.8, 27.8], [28.6, 13.6]], tailR: 2.35,
    paws: { y: 29.5, dx: 4.0, rx: 2.4, ry: 1.45 },
  },
};

// ---- face stamps (hand-drawn) -----------------------------------------------------------
// Drawn for the LEFT eye; the right eye is the same stamp, not mirrored — glints are lit from the
// same window, so mirroring them would make the light come from two directions at once.

const E = { E: 'eye', g: 'glint', p: 'pink.0', P: 'pink.1', i: 'ink', b: 'fx.blue', w: 'fx.white' };

export const EYES = {
  open:   { stamp: stamp(['gEE', 'EEE', 'EEE', '.E.'], E), dx: -7, dy: -1 },
  blink:  { stamp: stamp(['...', '...', 'iii', '...'], E), dx: -7, dy: -1 },
  closed: { stamp: stamp(['...', '...', 'i.i', '.i.'], E), dx: -7, dy: -1 },   // sleeping ‿
  happy:  { stamp: stamp(['...', '.i.', 'i.i', '...'], E), dx: -7, dy: -1 },   // ^
  droopy: { stamp: stamp(['...', 'iii', 'EEE', 'gE.'], E), dx: -7, dy: -1 },   // heavy lids: hungry
  sick:   { stamp: stamp(['...', 'iii', 'EgE', 'iii'], E), dx: -7, dy: -1 },   // half-lidded, ringed
};

export const MOUTHS = {
  smile:  { stamp: stamp(['.pp.', 'i..i', '.ii.'], E), dx: -2, dy: 2 },
  calm:   { stamp: stamp(['.pp.', '.ii.', '....'], E), dx: -2, dy: 2 },
  open:   { stamp: stamp(['.pp.', '.ii.', 'iPPi', '.ii.'], E), dx: -2, dy: 2 },
  wobble: { stamp: stamp(['.pp.', '....', 'i.i.', '.i.i'], E), dx: -2, dy: 2 },
  sleepy: { stamp: stamp(['.pp.', '.i..', '....'], E), dx: -2, dy: 2 },
};

// ---- the cat ----------------------------------------------------------------------------

/**
 * Render the cat.
 * @param stage   'kitten' | 'junior' | 'adult'
 * @param o.eyes  key of EYES        @param o.mouth key of MOUTHS
 * @param o.bob   0|1 — head drops one pixel on the exhale (breathing that never boils the outline)
 * @param o.tail  -1..1 — tail sway
 * @param o.ears  'up' | 'back' | 'droop'
 * @param o.girth 0..2 — extra body width; weight made visible
 * @param o.blush show cheek blush
 */
export function cat(stage, o = {}) {
  const g = STAGES[stage];
  const { eyes = 'open', mouth = 'smile', bob = 0, tail = 0, ears = 'up', girth = 0, blush = true, face = true } = o;
  const img = blank(SIZE, SIZE);
  const cx = 16;

  // ground shadow
  const shadow = ellipse(cx, 30.9, g.body.rx + 1.0 + girth, 0.95);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (shadow.test(x, y)) set(img, x, y, 'ground');

  // tail — behind the body, sways at the tip only
  const [t0, t1, t2] = g.tail;
  const tl = stroke(t0, [t1[0] + tail * 1.2, t1[1]], [t2[0] + tail * 2.2, t2[1] - Math.abs(tail) * 0.6], g.tailR);
  const tm = maskOf(tl);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inside(tm, x, y)) continue;
      if (isEdge(tm, x, y)) { set(img, x, y, 'ink'); continue; }
      const t = tl.along(x, y);
      const ring = t > 0.35 && Math.floor(t * 9) % 3 === 0;
      const top = !inside(tm, x, y - 1) || !inside(tm, x - 1, y - 1);
      const bottom = !inside(tm, x, y + 1);
      set(img, x, y, ring ? 'stripe' : top ? 'fur.2' : bottom ? 'fur.0' : 'fur.1');
    }
  }

  // body
  const body = ellipse(cx, g.body.cy, g.body.rx + girth, g.body.ry + girth * 0.25);
  const bm = paint(img, body, 'fur');
  // flank stripes, following the body's curve
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inside(bm, x, y) || isEdge(bm, x, y)) continue;
      const nx = (x + 0.5 - cx) / body.rx;
      if (Math.abs(nx) > 0.55 && Math.abs(nx) < 0.85 && (y + Math.round(nx * 4)) % 4 === 0) set(img, x, y, 'stripe');
    }
  }
  // chest
  paint(img, ellipse(cx, g.body.cy + 0.6, Math.max(2.6, g.body.rx * 0.48 + girth * 0.4), g.body.ry * 0.78),
    'cream', { outline: false, clip: bm });

  // front paws
  for (const s of [-1, 1]) {
    paint(img, ellipse(cx + s * g.paws.dx + s * girth * 0.5, g.paws.y, g.paws.rx, g.paws.ry), 'cream');
  }

  // ears — drawn before the head so the head overlaps their base. The visible part is only the
  // top few rows, so the triangle has to be broad: a narrow one is all outline and reads as a post.
  const hy = g.head.cy + bob;
  const B = g.ear.base + bob;
  const tipUp = [g.ear.tip[0], g.ear.tip[1] + bob];
  const tip = {
    up: tipUp,
    back: [tipUp[0] - 3.6, tipUp[1] + 3.0],
    droop: [tipUp[0] - 4.8, tipUp[1] + 5.8],
  }[ears];
  for (const side of [-1, 1]) {
    const X = (x) => (side < 0 ? x : 32 - x);
    const pts = [[6.3, B + 3.8], [15.2, B], tip];
    const outer = triangle(...pts.map(([x, y]) => [X(x), y]));
    const cxT = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cyT = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    const inner = triangle(...pts.map(([x, y]) => [X(cxT + (x - cxT) * 0.5), cyT + (y - cyT) * 0.5 + 0.9]));
    const om = maskOf(outer), im = maskOf(inner);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (!inside(om, x, y)) continue;
      if (isEdge(om, x, y)) { set(img, x, y, 'ink'); continue; }
      set(img, x, y, inside(im, x, y) ? (y >= cyT + 0.9 ? 'pink.0' : 'pink.1') : 'fur.1');
    }
  }

  // head: cranium plus cheek fluff, shaded as one form
  const cranium = ellipse(cx, hy, g.head.rx, g.head.ry);
  const cheeks = ellipse(cx, hy + 2.1, g.head.rx + 0.7, g.head.ry * 0.68);
  const hm = paint(img, union(cranium, cheeks), 'fur', { shadeFrom: cranium });

  // tabby M on the forehead
  const fy = Math.round(hy);
  for (const [c, r] of [[13, -5], [13, -4], [15, -6], [16, -6], [15, -5], [16, -5], [18, -5], [18, -4]]) {
    if (inside(hm, c, fy + r) && !isEdge(hm, c, fy + r)) set(img, c, fy + r, 'stripe');
  }

  // muzzle
  paint(img, ellipse(cx, hy + 3.6, 4.0, 2.5), 'cream', { outline: false, clip: hm });

  if (!face) return img;

  // face
  const eye = EYES[eyes];
  blit(img, eye.stamp, cx + eye.dx, fy + eye.dy);
  blit(img, eye.stamp, 31 - (cx + eye.dx) - (eye.stamp.w - 1), fy + eye.dy);
  if (blush) for (const [c, r] of [[8, 3], [9, 3], [22, 3], [23, 3]]) if (inside(hm, c, fy + r) && !isEdge(hm, c, fy + r)) set(img, c, fy + r, 'pink.1');
  const m = MOUTHS[mouth];
  blit(img, m.stamp, cx + m.dx, fy + m.dy);

  return img;
}

// ---- the newborn ------------------------------------------------------------------------
// Replaces the egg. Cats are not hatched: a newborn kitten is born blind, opens its eyes at
// about a week, and sleeps most of the day. So the first stage is a tiny curled kitten asleep in
// a basket, and the first life-stage change the owner sees is the moment it opens its eyes.
//
// The newborn has its own small face (eyes always shut, a nose, a mouth that can cry). It is the
// one stage the shared face stamps do not fit — a stated exception, not a hidden one.

const NB = { e: 'ink', p: 'pink.0', P: 'pink.1', i: 'ink' };
export const NEWBORN_FACE = {
  asleep: stamp(['ee...ee', '.......', '...p...'], NB),
  cry:    stamp(['ee...ee', '.......', '...p...', '..iPi..'], NB),
};

export function newborn({ sink = 0, twitch = false, face = 'asleep' } = {}) {
  const img = blank(SIZE, SIZE);
  const cx = 16;
  const shadow = ellipse(cx, 30.9, 12, 0.95);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (shadow.test(x, y)) set(img, x, y, 'ground');

  // inside of the basket, then the blanket the kitten lies on
  const opening = ellipse(cx, 20.6, 12.2, 3.6);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (opening.test(x, y)) set(img, x, y, 'wick.0');
  paint(img, ellipse(cx, 20.4, 11.0, 3.0), 'blank', { outline: false, band: (x, y) => (y < 19 ? 2 : 1) });

  // the kitten, curled: body behind, head resting on the left, tail wrapped round the front
  const k = sink; // breathing: the whole kitten sinks a pixel into the blanket on the exhale
  const body = ellipse(18.2, 17.4 + k, 7.4, 4.2);
  paint(img, body, 'fur');
  for (const [x, y] of [[20, 15], [22, 15], [21, 16], [23, 16], [19, 14]]) if (get(img, x, y + k)?.startsWith('fur')) set(img, x, y + k, 'stripe');
  const tail = stroke([24.6, 18.4 + k], [26.6, 21.6 + k], [16.0, 20.6 + k], 1.55);
  const tm = maskOf(tail);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!inside(tm, x, y)) continue;
    const t = tail.along(x, y);
    set(img, x, y, isEdge(tm, x, y) ? 'ink' : t > 0.5 && Math.floor(t * 8) % 2 === 0 ? 'stripe' : 'fur.2');
  }
  // small ears, one of which twitches now and then
  for (const [a, b, tip] of [
    [[6.4, 15.6 + k], [11.0, 12.6 + k], twitch ? [5.8, 9.8 + k] : [7.0, 8.8 + k]],
    [[11.8, 12.6 + k], [16.4, 15.0 + k], [15.4, 8.8 + k]],
  ]) {
    const om = maskOf(triangle(a, b, tip));
    const inner = maskOf(triangle(
      [a[0] * 0.6 + tip[0] * 0.4 + 0.6, a[1] * 0.6 + tip[1] * 0.4], [b[0] * 0.6 + tip[0] * 0.4 - 0.6, b[1] * 0.6 + tip[1] * 0.4], [tip[0], tip[1] + 2.2]));
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (!inside(om, x, y)) continue;
      set(img, x, y, isEdge(om, x, y) ? 'ink' : inside(inner, x, y) ? 'pink.1' : 'fur.1');
    }
  }
  const head = ellipse(11.4, 15.8 + k, 5.6, 4.5);
  const hm = paint(img, head, 'fur');
  for (const [x, y] of [[10, 12], [12, 12]]) if (inside(hm, x, y + k) && !isEdge(hm, x, y + k)) set(img, x, y + k, 'stripe');
  paint(img, ellipse(11.4, 17.9 + k, 3.0, 1.6), 'cream', { outline: false, clip: hm });
  blit(img, NEWBORN_FACE[face], 8, 15 + k);
  for (const x of [7, 15]) if (inside(hm, x, 17 + k) && !isEdge(hm, x, 17 + k)) set(img, x, 17 + k, 'pink.1');

  // the basket's front wall covers the kitten's lower half; woven, lit from the upper left
  const wall = { test: (x, y) => y + 0.5 >= 20.6 && ellipse(cx, 20.6, 12.2, 9.2).test(x, y) };
  const wm = maskOf(wall);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!inside(wm, x, y)) continue;
    if (isEdge(wm, x, y)) { set(img, x, y, 'ink'); continue; }
    if (y <= 22) { set(img, x, y, (x + y) % 2 ? 'wick.3' : 'wick.2'); continue; }   // the rim
    const weave = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
    const shade = x > 21 || y > 27 ? 0 : 1;
    set(img, x, y, weave ? `wick.${shade + 1}` : `wick.${shade}`);
  }
  // the blanket spills over the rim at the front left
  const drape = maskOf(ellipse(9.6, 22.4, 4.0, 2.2));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!inside(drape, x, y) || y < 21) continue;
    set(img, x, y, isEdge(drape, x, y) && y > 22 ? 'blank.0' : y > 23 ? 'blank.1' : 'blank.2');
  }
  return img;
}

// ---- the egg (retired) -------------------------------------------------------------------
// Kept only so the history in the worklog can be reproduced; no subject uses it.------------------------------------------------------------------------

export function egg({ wobble = 0, cracks = 0 } = {}) {
  const img = blank(SIZE, SIZE);
  const cx = 16, cy = 19.5, ry = 10.2;
  const shadow = ellipse(cx, 30.6, 8.5, 1.25);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (shadow.test(x, y)) set(img, x, y, 'ground');
  // egg: narrower at the top; wobble shears the upper half
  const shape = {
    cx, cy, rx: 8, ry,
    test: (x, y) => {
      const v = (y + 0.5 - cy) / ry;
      const rx = 8 * (v < 0 ? 0.78 + 0.22 * (1 + v) : 1);
      const shear = wobble * Math.max(0, -v) * 1.6;
      return ((x + 0.5 - cx - shear) / rx) ** 2 + v * v <= 1;
    },
  };
  const m = maskOf(shape);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!inside(m, x, y)) continue;
    if (isEdge(m, x, y)) { set(img, x, y, 'ink'); continue; }
    const b = sphereBand({ cx: cx + wobble, cy, rx: 8, ry }, x, y);
    // a tabby band — the egg hints at who is inside
    const band = Math.abs(y - 18 - Math.round(Math.sin((x - wobble) * 0.9) * 1.2)) <= 1;
    const band2 = Math.abs(y - 24 - Math.round(Math.sin((x - wobble) * 0.9 + 2) * 1.0)) <= 0;
    set(img, x, y, band || band2 ? (b >= 2 ? 'fur.2' : 'fur.1') : `cream.${Math.min(2, b)}`);
  }
  // cracks grow as hatching approaches
  const CR = [[14, 12], [15, 13], [14, 14], [15, 15], [16, 16], [17, 15], [18, 16], [19, 15], [18, 14], [12, 17], [11, 18]];
  CR.slice(0, cracks).forEach(([x, y]) => { if (inside(m, x + Math.round(wobble), y)) set(img, x + Math.round(wobble), y, 'ink'); });
  return img;
}

export { remap, blit, stamp, blank };

// ---- condition effects -------------------------------------------------------------------
// Secondary cues only. P0 proved an icon alone does not survive across-the-room viewing; the
// face, ears and palette carry each condition, and these confirm it at close range.

const F = {
  b: 'fx.blue', L: 'fx.blueL', s: 'fx.stink', h: 'fx.heart', w: 'fx.white', G: 'fx.gold',
  D: 'fx.goldD', g: 'fx.grime', f: 'fx.fly', i: 'ink',
};
export const FX = {
  zzz:     stamp(['....bbb', '.....b.', '....bbb', 'bbbb...', '..b....', '.b.....', 'bbbb...'], F),
  sweat:   stamp(['.b.', 'bLb', 'bbb'], F),
  stink:   stamp(['.s..s', 's..s.', '.s..s', 's..s.'], F),
  heart:   stamp(['hh.hh', 'hhhhh', '.hhh.', '..h..'], F),
  halo:    stamp(['.GGGGGG.', 'G......G', '.DDDDDD.'], F),
  sparkle: stamp(['..w..', '..w..', 'wwGww', '..w..', '..w..'], F),
  fish:    stamp(['.bbb..b', 'bibbbbb', '.bbb..b'], F),
  bubble:  stamp(['L..', '...', '.L.'], F),
  fading:  stamp(['.ii.ii.', 'i..i..i', '.i...i.', '..i.i..', '...i...'], { i: 'fade.0' }),
  grimeA:  stamp(['gg', 'g.'], F),
  grimeB:  stamp(['.g', 'gg'], F),
  fly:     stamp(['f'], F),
};

/** Anchor points computed from stage geometry — the same numbers the body was drawn from. */
export function anchors(stage, { bob = 0 } = {}) {
  const g = STAGES[stage];
  const hy = g.head.cy + bob;
  return {
    headTop: Math.round(hy - g.head.ry),
    fy: Math.round(hy),
    bodyY: Math.round(g.body.cy),
    bodyR: Math.round(16 + g.body.rx),
  };
}

export function withFx(img, stage, kinds, o = {}) {
  const a = anchors(stage, o);
  const put = (st, x, y) => blit(img, st, x, y);
  for (const k of kinds) {
    if (k === 'zzz') put(FX.zzz, 25, 0);
    if (k === 'fading') put(FX.fading, 25, 1);
    if (k === 'sweat') put(FX.sweat, 26, Math.max(0, a.fy - 6));
    if (k === 'heart') put(FX.heart, 26, 1);
    if (k === 'halo') put(FX.halo, 12, Math.max(0, a.headTop - 4));
    if (k === 'sparkle') { put(FX.sparkle, 26, 1); put(FX.sparkle, 1, a.bodyY - 3); }
    if (k === 'sparkle2') { put(FX.sparkle, 1, 2); put(FX.sparkle, 26, a.bodyY - 2); }
    if (k === 'fishbite') put(FX.fish, 25, 0);
    if (k === 'hungry') { put(FX.bubble, 23, 4); put(FX.fish, 25, 0); }
    if (k === 'dirty') {
      put(FX.stink, 2, a.headTop + 1); put(FX.stink, 25, a.headTop + 2);
      put(FX.grimeA, 18, a.bodyY); put(FX.grimeB, 11, a.bodyY + 2); put(FX.grimeA, 19, a.fy - 4);
      put(FX.fly, 4, a.headTop - 1); put(FX.fly, 27, a.headTop - 2);
    }
  }
  return img;
}
