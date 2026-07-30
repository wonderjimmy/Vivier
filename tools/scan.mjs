// Shared source-scanning helpers for the P1a gate tools.
//
// Comments and string/template literals are stripped before scanning so that a criterion's
// name appearing in a doc comment can never be mistaken for a violation — and, more
// importantly, so that a violation can never hide inside a string.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.mjs')) out.push(full);
  }
  return out;
}

/** Replace comments only, preserving offsets. Strings survive — use when the SPECIFIER matters. */
export function stripComments(src) {
  const out = src.split('');
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      blank(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      blank(i, end === -1 ? src.length : end + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const quote = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

/** Replace comments AND string/template contents with spaces, preserving offsets. */
export function stripNonCode(src) {
  const out = src.split('');
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      blank(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      blank(i, end === -1 ? src.length : end + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const quote = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

export function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

export function report(name, violations) {
  if (violations.length === 0) {
    console.log(`${name}: OK`);
    return 0;
  }
  console.error(`${name}: FAILED (${violations.length})`);
  for (const v of violations) console.error(`  ${v}`);
  return 1;
}

export const readSource = (f) => {
  const raw = readFileSync(f, 'utf8');
  // `code` hides string contents (so a violation cannot hide in a literal); `text` keeps them
  // (so an import specifier or a path can still be read). Different questions, different views.
  return { raw, code: stripNonCode(raw), text: stripComments(raw) };
};
