# Vivier

A desktop electronic pet — a Tamagotchi in spirit. It sits on a desk, ages in real time, and
degrades if you ignore it.

**→ [Try it in your browser](https://wonderjimmy.github.io/Vivier/)** — nothing to install.

| | |
|---|---|
| [**The character**](https://wonderjimmy.github.io/Vivier/character.html) | A ginger tabby from a blind newborn in a basket to an adult: four life stages, nine conditions, three reactions. |
| [**The den**](https://wonderjimmy.github.io/Vivier/den.html) | A corner of a Hong Kong flat. The window follows the real time of day and the Observatory's weather. |
| [**Tuning viewer**](https://wonderjimmy.github.io/Vivier/tuning.html) | Thirty days on one screen, four care patterns. Neglect kills it in under six days — and so does over-feeding. |

## What this is

The object is a small screen that lives on a desk, always on. Version one is a web app on an Android
tablet; if it earns its place, the screen grows and the interaction deepens. This repo is the
software that has to be right first — a pure simulation core, plus prototypes for judging whether
the thing is any good.

The one architectural rule: **the simulation core is pure.** No I/O, no rendering, no hardware, no
clock, no randomness. Time enters as an argument — the platform tells the core how much time has
passed, never the other way round. That is what lets the same core run in a browser today and on a
microcontroller later, and be tested with a fake clock in milliseconds instead of days.

## Running it locally

Needs **Node 23.6+** and nothing else. No dependencies, no install step, no build tool.

```bash
git clone https://github.com/wonderjimmy/Vivier.git && cd Vivier
node spike/live/src/build.mjs      # then open spike/live/dist/index.html
```

To run the checks:

```bash
npm run gate
```

That runs the test suite, three source scans, and a mutation gate that deliberately breaks the core
89 different ways to confirm the tests notice. It takes about two minutes.

## Honest status

Working: the simulation core, a golden-vector corpus cross-checked against an independently written
reference implementation, the character and den designs, and the prototypes above.

Not built yet: durable storage, life stages, illness and death in the simulation, the cat walking
around its den, the live weather feed, and the real app on a tablet.

The pages linked above are **throwaway spikes**, and they say so on their own faces. The live pet's
save format is disposable — a proper one comes later and will not be compatible.

## How it's being built

Under [AIDF-One](AIDF-One/): a spec-driven method where every phase writes its acceptance criteria
before its code, and a fresh reviewer with no memory of building it has to sign the work off.

The interesting part is [the worklog](AIDF-One/initiatives/2026-001-host-prototype/worklog.md).
It records the failures, not just the wins — including an audit that failed the whole phase, a
"defensive" division routine that turned out to produce silently wrong answers, and a decay curve
that read fine as numbers and was obviously broken the moment it was drawn as a chart.

## Interested?

The larger idea this is de-risking: **one pet on a shared display, raised by many people at once.**
A tragedy-of-the-commons simulator disguised as a toy — nobody has to feed it, so does anyone?

That version needs approvals and hardware. This one answers the questions that don't: is the decay
curve tuned right, are the interactions charming, does anyone still look at it after week two.

Open an issue or just say something.
