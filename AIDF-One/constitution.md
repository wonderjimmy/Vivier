# Constitution — Vivier

> Engineering philosophy + framework meta-rules. Evergreen. Principles only — no product facts.
> Changing this is an ADR-level event; record it in `decisions.md`.
> version: 1 · created: 2026-07-30 21:31 HKT

## Code-craft principles

- No assumptions. Base everything on facts; if unsure, investigate or ask.
- Never delegate up. Investigate, then bring a recommended answer with a one-line *why* — the human
  approves or rejects, never does your thinking. No menu of options, no fork to confirm; ask only
  when a call genuinely needs the human, and never empty-handed.
- Fix root causes. No shortcuts, workarounds, or lazy patches.
- Show real errors to the user. Never fake success; never ship mock data as real.
- Think whole-system (core, time, storage, input, render). Don't break existing behaviour.
- One source of truth for each piece of data.
- Keep it simple and fit-for-purpose. This is a desk object, not a platform.
- Write clean, elegant code — not tutorial filler.

## Framework-operation meta-rules

- SSOT or nothing: name the SSOT each step reads/writes; cut ceremonial steps.
- No fabrication: re-read real files for state; fetch time via CLI `date`; never invent test
  results, file contents, or "what we did last time".
- Evidence before claims: no "works"/"looks good" without shown proof.
- Record failures & superseded decisions, not just shipped changes.
- Respect scope boundaries: never silently expand scope; flag out-of-scope, don't build it.
- Loop, don't patch: on a real audit failure, return to think/critique for that problem.
- Acceptance criteria are un-fakeable rulers: each states its own check, is binary, derives from a
  written INTENT (not the code); the set is written against failure modes AND back-translates to
  that intent; tag REQUIRES-JUDGMENT, never fake green.
  (standard: `aidf-one` skill → `references/acceptance-criteria.md`)
- Security baseline: no leaked secrets; validate all persisted state on load (a corrupt or
  hand-edited save must fail loudly, never silently produce a nonsense pet).
- Operate the model fleet by rule, not by feel: the commander doesn't do bulk work in its own
  context (delegate broad/large/external reads), dispatches with the triple (goal+why / acceptance /
  report-format), escalates a twice-failed subtask up a named tier *with the trace*, and never calls
  work done without a fresh-context verification artifact.
  (doctrine: `aidf-one` skill → `references/dispatch.md`; judgment calls → `references/judgment.md`)

## Project-specific engineering law

These are the engineering non-negotiables for Vivier. They are *principles*, not product scope
(product scope lives in `product-spec.md`).

1. **The simulation core is pure.** No I/O, no rendering, no hardware, no ambient time, no
   randomness sourced inside it. Time and entropy enter as explicit arguments. If a core function
   cannot be called from a desktop unit test with a fake clock and a seeded RNG and produce a
   deterministic result, it is in the wrong layer. This is the single architectural law that makes
   the browser build, the device build, and any future shared build possible from one core.
2. **Time is data, never an ambient fact.** The core never asks the platform what time it is; the
   platform tells the core how much time has passed. Every ageing/decay path must be expressible as
   `advance(state, elapsed)` and must be correct for `elapsed` values spanning seconds to weeks.
3. **Deterministic replay.** Given an initial state, a seed, and an ordered list of
   `(timestamp, event)` pairs, the core must reproduce the identical end state. Tuning is worthless
   without it, and it is the only honest way to test a 30-day decay curve in under a second.
4. **Persistence is a bounded, versioned resource.** Every save carries a schema version and is
   validated on load. Write frequency is a budgeted design parameter, never an accident of the loop
   (flash endurance is finite; a per-tick write is a defect, not a tuning choice).
5. **Software before hardware.** No hardware-only code path may be the first or only implementation
   of a behaviour. The host build is the reference implementation; the device is a second consumer.
6. **The pet must never lie.** No fake liveliness that isn't backed by real state, no cosmetic
   animation implying a state change that did not occur, and no silent state reset presented as
   continuity. If the pet's history is lost, it says so.

## Stack constraints

- **Concrete language / toolchain / test runner: deferred to ADR-001**, to be decided at the first
  TRACK-THINK. The intent-level priors (host-testable pure core shared with an ESP32-S3 target) are
  investigated there, not assumed here. This file records the law the toolchain must satisfy, not
  the toolchain.
- **Hardware class (prior, challengeable at THINK):** integrated ESP32-S3 board with a bonded
  2.8" 320×240 touch LCD; mains-powered; no battery-backed RTC.
- **No network dependency** beyond whatever time synchronisation ADR-001 settles on. No cloud, no
  accounts, no telemetry.
- **Vertical layers** — every change is reasoned across *exactly* these six, top to bottom. The
  Layer Coverage Matrix in each `scope.md` emits one row per layer, no blanks, no omissions:

  | # | Layer | Owns |
  |---|---|---|
  | 1 | **Sim Core** | pet state, decay, life stage, event resolution — pure, deterministic |
  | 2 | **Clock** | wall-time acquisition, trust, and elapsed-time resolution across power cycles |
  | 3 | **Persistence** | state serialisation, schema version, validation, write budgeting |
  | 4 | **Input** | interaction events (feed/play/clean/…) marshalled into core events |
  | 5 | **Render** | sprites, scenes, animation — a read-only projection of core state |
  | 6 | **Platform (HAL)** | host binding: browser shell / ESP32 firmware wiring; owns 2–5's adapters |
