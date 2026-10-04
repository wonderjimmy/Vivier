// Shared pixel utilities for spikes and design work.
//
// Replaces three copy-pasted PNG encoders (p0-art, tuning-view, live). Nothing in core/ or host/
// may import this; it is tooling for producing and previewing art, not part of the pet.

import { deflateSync } from 'node:zlib';

/** An indexed image: `w × h` cells, each a palette key or null (transparent). */
export function blank(w, h) {
  return { w, h, px: Array.from({ length: h }, () => new Array(w).fill(null)) };
}

export function clone(img) {
  return { w: img.w, h: img.h, px: img.px.map((row) => row.slice()) };
}

export const inBounds = (img, x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h;

export function set(img, x, y, key) {
  if (inBounds(img, x, y)) img.px[y][x] = key;
}

export function get(img, x, y) {
  return inBounds(img, x, y) ? img.px[y][x] : null;
}

/** Draw `src` onto `dst` at (ox, oy). Null cells in `src` are transparent. */
export function blit(dst, src, ox = 0, oy = 0) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const k = src.px[y][x];
      if (k !== null) set(dst, x + ox, y + oy, k);
    }
  }
  return dst;
}

/** Parse a hand-drawn stamp: an array of strings plus a char→palette-key legend. */
export function stamp(rows, legend) {
  const img = blank(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      if (!(ch in legend)) throw new Error(`stamp: no legend entry for "${ch}"`);
      img.px[y][x] = legend[ch];
    });
  });
  return img;
}

/** Replace palette keys through a mapping — cheap condition variants (sick, faded, ghost). */
export function remap(img, mapping) {
  const out = clone(img);
  for (const row of out.px) {
    for (let x = 0; x < row.length; x++) if (row[x] !== null && row[x] in mapping) row[x] = mapping[row[x]];
  }
  return out;
}

// ---- rasterising to RGBA and PNG -------------------------------------------------------

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Lay several indexed frames side by side into one strip (for CSS steps() animation). */
export function strip(frames, gap = 0) {
  const w = frames[0].w, h = frames[0].h;
  const out = blank(frames.length * (w + gap) - gap, h);
  frames.forEach((f, i) => blit(out, f, i * (w + gap), 0));
  return out;
}

export function toRGBA(img, palette, scale = 1, background = null) {
  const W = img.w * scale, H = img.h * scale;
  const buf = Buffer.alloc(W * H * 4, 0);
  const bg = background ? hexToRgb(background) : null;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const key = img.px[y][x];
      let rgb = null;
      if (key !== null) {
        const hex = palette[key];
        if (hex === undefined) throw new Error(`toRGBA: palette has no key "${key}"`);
        rgb = hexToRgb(hex);
      } else if (bg) rgb = bg;
      if (!rgb) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const o = ((y * scale + dy) * W + (x * scale + dx)) * 4;
          buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2]; buf[o + 3] = 255;
        }
      }
    }
  }
  return { buf, w: W, h: H };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePNG({ buf, w, h }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    buf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const dataURI = (img, palette, scale = 1, background = null) =>
  `data:image/png;base64,${encodePNG(toRGBA(img, palette, scale, background)).toString('base64')}`;
