// Every animated subject in the R1 concept, as a pure function of the frame index.
// Shared by the design sheet (build.mjs) and the Design-canvas export (canvas-assets.mjs) so the two
// can never show different cats.

import { cat, egg, newborn, withFx, SICK, FADED, GHOST } from './cat.mjs';
import { blank, blit, remap } from '../../lib/pixel.mjs';

export const N = 16;            // frames per loop
export const FRAME_MS = 150;    // 2.4 s loop: one slow breath, one blink

export const sway = (f, speed = 1) => Math.round(Math.sin((2 * Math.PI * f * speed) / N) * 10) / 10;
export const shiftUp = (img, dy) => blit(blank(img.w, img.h), img, 0, -dy);

// ---- every animated subject is a function of the frame index ------------------------------
// Constitution law 6: an animation frame is a pure function of (condition, frame). Nothing here
// carries state between frames, so no frame can imply something the pet is not.

export const idle = (stage, o = {}) => (f) =>
  cat(stage, { bob: f >= N / 2 ? 1 : 0, tail: sway(f), eyes: f === 13 ? 'blink' : 'open', ...o });

export const CONDITIONS = [
  { id: 'content', note: 'Idle. Breathes, blinks, swishes.', frames: idle('kitten') },
  {
    id: 'happy', note: 'Just played. Fast tail, closed-eye smile.',
    frames: (f) => withFx(cat('kitten', { eyes: 'happy', tail: sway(f, 2) * 1.3, bob: f % 8 >= 4 ? 1 : 0 }), 'kitten', ['heart']),
  },
  {
    id: 'hungry', note: 'Heavy lids, ears back — and it meows at you.',
    frames: (f) => withFx(cat('kitten', {
      eyes: 'droopy', mouth: f % 8 < 3 ? 'open' : 'calm', ears: 'back', blush: false, tail: sway(f) * 0.4,
    }), 'kitten', ['hungry']),
  },
  {
    id: 'dirty', note: 'Grime on the coat, a smell you can see.',
    frames: (f) => withFx(cat('kitten', { eyes: 'droopy', mouth: 'wobble', ears: 'back', blush: false, bob: f >= 8 ? 1 : 0 }), 'kitten', ['dirty']),
  },
  {
    id: 'sick', note: 'The whole animal changes colour. Shivers.',
    frames: (f) => withFx(remap(cat('kitten', { eyes: 'sick', mouth: 'wobble', ears: 'droop', blush: false, bob: f % 4 < 2 ? 1 : 0 }), SICK), 'kitten', ['sweat']),
  },
  {
    id: 'sleeping', note: 'Slow, deep breaths. Ears relaxed.',
    frames: (f) => withFx(cat('kitten', { eyes: 'closed', mouth: 'sleepy', ears: 'back', bob: f < 8 ? 1 : 0 }), 'kitten', ['zzz'], { bob: 1 }),
  },
  { id: 'obese', note: 'Weight is a body parameter: it just gets rounder.', frames: idle('adult', { girth: 2.2 }) },
  {
    id: 'dying', note: 'Colour drains out. Still breathing — still savable.',
    frames: (f) => withFx(remap(cat('kitten', { eyes: f === 12 ? 'blink' : 'sick', mouth: 'calm', ears: 'droop', bob: 1, blush: false }), FADED), 'kitten', ['fading']),
  },
  {
    id: 'dead', note: 'Gentle, unmistakable, and permanent.',
    frames: (f) => shiftUp(withFx(remap(cat('kitten', { eyes: 'closed', mouth: 'calm', blush: false }), GHOST), 'kitten', ['halo']), f < 8 ? 1 : 2),
  },
];

export const REACTIONS = [
  {
    id: 'feed', note: 'Chomps. Mouth works, eyes close with pleasure.',
    frames: (f) => withFx(cat('kitten', { eyes: 'happy', mouth: f % 4 < 2 ? 'open' : 'calm', tail: sway(f) }), 'kitten', f < 10 ? ['fishbite'] : []),
  },
  {
    id: 'play', note: 'Hops. The only time both feet leave the ground.',
    frames: (f) => withFx(shiftUp(cat('kitten', { eyes: 'happy', tail: sway(f, 2) * 1.4 }), [0, 1, 3, 4, 3, 1, 0, 0][f % 8]), 'kitten', ['heart']),
  },
  {
    id: 'clean', note: 'Eyes shut, still for once, sparkling.',
    frames: (f) => withFx(cat('kitten', { eyes: 'closed', mouth: 'smile' }), 'kitten', [f % 8 < 4 ? 'sparkle' : 'sparkle2']),
  },
];

export const STAGE_ANIMS = [
  {
    id: 'newborn', note: 'Born blind, asleep in a basket. Opening its eyes is the first stage change.',
    frames: (f) => withFx(newborn({ sink: f >= N / 2 ? 1 : 0, twitch: f === 5 || f === 6 }), 'kitten', f >= 10 ? ['zzz'] : []),
  },
  { id: 'kitten', note: 'Head is two-thirds of the animal.', frames: idle('kitten') },
  { id: 'junior', note: 'Legs and tail lengthen first.', frames: idle('junior') },
  { id: 'adult', note: 'Same face, grown into.', frames: idle('adult') },
];

