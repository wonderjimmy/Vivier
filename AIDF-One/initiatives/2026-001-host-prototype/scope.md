# Scope — Host prototype: a pet you can actually neglect   (id: 2026-001-host-prototype)

> Authority for "what THIS in-flight initiative will do". Frozen & promoted on completion.
> APPROVED 2026-07-30 21:31 HKT (rejection-funnel round 1, accepted without cuts).
> Product-wide OUT OF SCOPE and HARD CONSTRAINTS are inherited from `product-spec.md` — not restated.

## 1. USER

The owner-caretaker, using the pet on the machine already on their desk — a browser tab left open,
not a device. Same person, same relationship, no hardware. They are simultaneously the carer (who
must be able to forget about it) and the tuner (who must be able to compress 30 days into a second).

## 2. PROBLEM

The decay curve, the interaction set, and the minimum sprite vocabulary are all empirical questions
that can only be answered by living with a pet for weeks — and buying hardware before answering them
risks an expensive board in a drawer.

## 3. USER JOURNEY

1. **Open the tab** → the pet is restored to exactly where it was, aged by the real time that
   elapsed while it was closed.
   - ACCEPTANCE: with the state saved at `t0` and reopened at `t0 + Δ`, the restored state is
     value-identical to `advance(saved, Δ)` computed directly by the core. Verified by an automated
     test driving a fake clock across a save/load round-trip — not by reading the screen.

2. **Glance at it** → its condition is legible with no input.
   - ACCEPTANCE: rendered output differs pixel-wise between the named condition states
     (`content` / `hungry` / `dirty` / `sick` / `sleeping` / `dead`) at the same frame index.
     Verified by snapshot equality/inequality assertions over the pure render function.

3. **Interact** (feed / play / clean) → an immediate, distinct reaction and a real state change.
   - ACCEPTANCE: each interaction (a) moves its target stat by the configured amount in the state
     returned by the core, and (b) produces a reaction frame distinct from every other interaction's.
     Verified by unit assertions on returned state plus pairwise snapshot inequality.

4. **Ignore it for a day, come back** → the neglect is visible on the pet.
   - ACCEPTANCE: replaying an event list with a 48h interaction gap drives the pet into `sick`; a 7d
     gap reaches `dead`. Both deterministic and asserted on the core's returned state, at
     thresholds named in the tuning config — not hardcoded in the test.

5. **Compress time to tune the curve** → 30 simulated days in under a second.
   - ACCEPTANCE: the replay harness consumes a 30-day synthetic `(timestamp, event)` list, completes
     in < 1s wall clock, emits a per-day stat trajectory, and produces byte-identical output across
     two runs with the same seed.

## 4. SUCCESS

**The exit criterion for buying hardware, and the only thing that closes this initiative:**

The prototype has run for **3+ consecutive days without a reset**, the owner opened it unprompted on
each of those days, the pet **changed life stage at least once**, and the owner still wants to look
at it.

Failing that, the correct outcome is *not* buying the board — and that is a successful initiative
too, provided the worklog says why.

## 5. OUT OF SCOPE (this initiative only)

Cuts from the candidate list in `project-intent.md` §6, with the reason each was cut:

| Cut | Why |
|---|---|
| **Reincarnation / new-egg cycle** | Depends on death being tuned right, which this initiative is trying to find out. Building the sequel to a mechanic before validating the mechanic. |
| **Memorial record of past pets** | Requires more than one dead pet to mean anything. Nothing to record inside a 3-day run. |
| **Personality drift from interaction history** | The most expensive thing on the list (history retention + divergent art + a way to perceive the difference) and invisible over 3 days. First thing to re-open once the curve is settled. |
| **Sound / buzzer feedback** | Browser audio teaches nothing about a piezo buzzer. Pure art/feel cost with no transferable answer. |
| **Interactions: pet, discipline, tease** | `pet` duplicates `play` with no distinct state effect. `discipline` and `tease` both presuppose a misbehaviour/personality system that is itself cut. Three interactions is enough to test whether interacting is charming. |
| **Local web server / phone control** | A device-side feature with no host analogue. |
| **Physical enclosure, any hardware purchase** | Gated behind §4 by design. Nothing in this initiative may depend on a device existing. |
| **Finished sprite art** | This initiative buys the *minimum* readable sprite vocabulary at final resolution, deliberately not a finished art set — the question is "what is the fewest frames that read as alive", and answering it with a full art set answers nothing. |
| **Save migration between schema versions** | Version is *recorded and validated* from day one; migrating between versions is deferred until there is a save worth keeping. Pre-§4, a rejected save is an acceptable outcome. |

## 6. HARD CONSTRAINTS (this initiative only)

- **No hardware may be purchased, and nothing may depend on a device.** Violating this defeats the
  initiative's entire purpose.
- **The core must stay device-portable.** No host-platform construct — no DOM, no ambient `Date`,
  no timers, no storage API, no `Math.random()` — may appear in the core's import graph. This is
  mechanically enforced (see Layer 6 below), not a code-review convention.
- **Zero network.** Stricter than product-wide: the prototype does not even do time
  synchronisation. Trusted-time acquisition is a device problem and is deliberately not solved here;
  the host build supplies the platform clock through the same seam a device NTP source will later.
- **Display fixed at 320×240 logical with 64×64 sprites** even though a browser has no such limit.
  A prototype rendered at a comfortable size answers a question the object will never be asked.

## LAYER COVERAGE MATRIX

| Layer (from constitution) | CHANGE / NO CHANGE | Phase |
|---|---|---|
| **1. Sim Core** | **CHANGE:** pet state (hunger, happiness, cleanliness, weight, health, age), real-time decay, life-stage transitions, illness/death resolution, interaction events — pure and deterministic → **AC:** `advance(state, Δ)` returns a state whose `stage` field flips `egg`→`child` exactly at the age threshold named in the tuning config; and replaying an identical `(timestamp, event)` list twice returns value-identical states. | **P1** (P3, P4 extend) |
| **2. Clock** | **CHANGE:** elapsed-time resolution from a platform-supplied timestamp, with an explicit anomaly path for a clock that moved backwards → **AC:** given saved `t0` and supplied `t1 < t0`, the resolver returns `elapsed === 0` and `clockAnomaly === true` on the returned value; the pet is never aged by a negative or unbounded interval. | **P2** |
| **3. Persistence** | **CHANGE:** versioned save schema, validate-on-load, `clockAnomaly` persisted, budgeted write cadence (debounced + immediate on significant events) → **AC:** a save blob with a missing or unknown `schemaVersion`, or a stat outside its declared range, causes load to return an explicit `LoadError` value — never a silently defaulted pet; **and** under a continuous run a counting fake adapter records ≤ N writes per simulated hour (G2). | **P2** |
| **4. Input** | **CHANGE:** feed / play / clean marshalled into timestamped core events → **AC:** each control emits exactly one core event carrying the platform timestamp, and replaying the emitted event log from the initial state reproduces the live state value-identically. | **P4** (vocabulary) · **P5** (marshalling) |
| **5. Render** | **CHANGE:** 320×240 canvas projection of core state at 64×64 sprite scale, plus idle animation → **AC:** `render(state, frameIndex)` is pure — two calls with identical arguments produce identical pixel output — and no code path lets it mutate or write state. | **P5** (P6 extends) |
| **6. Platform (HAL)** | **CHANGE:** browser shell wiring the clock / persistence / input / render adapters around the core → **AC:** an automated dependency check over the core module's transitive import graph reports zero host globals (`window`, `document`, `localStorage`, `Date`, `Math.random`, timers) — the check fails the build, not a reviewer's attention. | **P5** |

**Silent-gap check:** greenfield initiative — every declared layer is a CHANGE row, so there is no
NO CHANGE row that an adjacent CHANGE could be silently leaning on. The one seam worth naming is
**Clock → Persistence**: `clockAnomaly` must be *persisted*, not just computed, or a restart
launders an untrustworthy clock into a trustworthy one. Logged to `worklog.md` at THINK.

Each matrix AC **joins its phase's acceptance set** below and is verified by the same AUDIT/CHECK
machinery — it is not a note beside it.

## Phases (from ROADMAP — 2026-07-30 22:03 HKT)

Six phases, each independently testable and safe to ship alone. Phases 1–4 are headless: the pet is
fully alive and fully verified before a single pixel is drawn. That ordering is deliberate — it is
what stops rendering from becoming the place bugs hide.

### P1 — Deterministic core & replay harness
> Layers: 1 (partial) · delivers journey step 5

- **INTENT:** The owner must be able to judge a month of the pet's life without living a month, and
  trust that what the harness shows is exactly what the pet will really do.
- **failure modes:** decay silently depends on tick frequency (60 Hz and 1 Hz grow different pets) ·
  float drift makes two runs differ · Δ of 0 / negative / 60 days mishandled · stats escape their
  declared range · the harness is fast because it *approximates*, i.e. one big step ≠ many small
  steps · tuning constants baked into code, so the harness tunes something the pet doesn't use.
- **acceptance:**
  - **AC1.1 — step-size independence (invariant).** For any state `S` and any partition of `Δ` into
    consecutive sub-intervals, folding `advance` over the partition returns a value-identical state
    to `advance(S, Δ)`. Property test, ≥1000 seeded random partitions, `Δ` from 1 ms to 60 days.
  - **AC1.2 — determinism (invariant).** `replay(initial, seed, events)` run twice yields
    byte-identical serialised state, over every vector in the golden-vector corpus.
  - **AC1.3 — no floating point (invariant).** Core source contains no float literal and no division
    yielding a non-integer; every stat field in every corpus end-state satisfies `Number.isInteger`.
    Source scan + runtime sweep; **fails the build**.
  - **AC1.4 — range closure (invariant).** Every stat in every state produced anywhere in the corpus
    lies within its declared `[min,max]`. Property-tested with adversarial `Δ` (0, 1 ms,
    `MAX_SAFE_INTEGER`, 60 days) and adversarial event orderings.
  - **AC1.5 — time is forward-only.** `advance(S, 0)` returns a value-identical state; `advance` with
    negative `Δ` throws rather than ages. Binary.
  - **AC1.6 — the harness.** Consumes a 30-day synthetic event list, exits 0 in < 1 s wall clock,
    prints a per-day trajectory of every stat; two runs at the same seed produce byte-identical
    stdout.
  - **AC1.7 — tuning is data, not code.** Every decay rate, threshold and interaction magnitude is
    read from the tuning config; a source scan finds zero numeric simulation constants in core logic
    files, and mutating one config value provably changes the corpus trajectory.
- **REQUIRES-JUDGMENT:** whether the decay curve's *shape* feels right. No oracle exists — that is
  what tuning and the §4 soak are for. A green P1 proves the curve is faithfully executed, never
  that it is well chosen.
- **design consequence of AC1.1 (worth stating before building):** exact step-size independence
  forbids per-step rounding, so rates must be integers in the state's own unit scale (no division in
  the decay path). It also forbids evaluating a whole `Δ` in one shot when a rule is *conditional* on
  a threshold — e.g. "health decays only while hunger is at 0" — so `advance` must internally split
  `Δ` at exact threshold-crossing times. This is the single most important structural implication in
  the initiative and is far cheaper to build in than to retrofit.

### P2 — Continuity: clock trust & durable state
> Layers: 2, 3 · delivers journey step 1 · closes G2 and G3

- **INTENT:** The owner must be able to close it, walk away, and come back to the same pet correctly
  older — and never be quietly told a lie about time the system could not actually account for.
- **failure modes:** elapsed accumulated from frames, so a suspended tab loses time · a backwards or
  absurd clock ages the pet by garbage · `clockAnomaly` computed then dropped on save, so a restart
  launders an untrusted clock into a trusted one (G3) · a corrupt or old-schema save silently
  defaults to a fresh pet, destroying history *and* lying about it · per-tick writes (G2) · a save
  written mid-update lands torn.
- **acceptance:**
  - **AC2.1 — restore equals advance.** Saved at `t0`, loaded at `t1`, the restored state is
    value-identical to `advance(saved, t1−t0)`. Fake-clock round-trip for `Δ ∈ {1 s, 1 h, 3 d, 30 d}`.
  - **AC2.2 — never age on untrusted time (invariant).** For any `t1 ≤ t0` or
    `t1−t0 > MAX_PLAUSIBLE_GAP`, applied elapsed is exactly 0 and the returned state has
    `clockAnomaly === true`. Property-tested over adversarial timestamp pairs.
  - **AC2.3 — the anomaly survives a restart (G3).** After AC2.2's condition, save-then-load returns
    a state with `clockAnomaly === true`. Binary. This is the silent-gap closer.
  - **AC2.4 — validate on load.** A blob with a missing/unknown `schemaVersion`, an unknown field, a
    truncation, a type-swap, or a stat outside its declared range returns an explicit `LoadError`
    value — never a defaulted pet. Table-driven, ≥ 6 corruption cases.
  - **AC2.5 — write budget (G2).** Under a continuous simulated run against a counting fake storage
    adapter: writes ≤ N per simulated hour, and a write occurs immediately on each event in the
    config's `significantEvents` list and at no other time. Binary against the counter.
  - **AC2.6 — no torn writes (invariant).** Every blob handed to the adapter during the AC2.5 run
    deserialises to a state that passes AC2.4's validator.
- **REQUIRES-JUDGMENT:** the value of `MAX_PLAUSIBLE_GAP`, and whether a `LoadError` should present
  to the owner as "your pet is gone" or "start fresh" — a felt call, not a computable one.

### P3 — Life cycle: stages, illness, death
> Layers: 1 (extends) · delivers journey step 4 · implements ADR-004

- **INTENT:** The owner's care must have an arc worth watching and a stake worth fearing — the pet
  becomes something else as it grows, and it can actually be lost.
- **failure modes:** stage transition keyed to tick timing rather than accumulated age (silently
  breaks AC1.1) · the pet dies while unobserved, which is the drawer risk in one line · death arrives
  with no warning · illness unreachable, or reachable and unrecoverable · the weight mechanic reads
  as noise because its timescale isn't separable from hunger's (G6) · stage regresses.
- **acceptance:**
  - **AC3.1 — stages are forward-only (invariant).** Stage never regresses, over the whole corpus and
    under property testing.
  - **AC3.2 — exact thresholds.** Advancing to `threshold − 1 ms` yields the prior stage; advancing
    to `threshold` yields the next. Binary, at every stage boundary.
  - **AC3.3 — death requires a witness (invariant, ADR-004).** For any state and any `Δ`,
    `advance(S, Δ)` never returns `dead`; only the live-tick entry point can. Property-tested with
    `Δ` up to 365 days from every corpus state, including critical ones.
  - **AC3.4 — death is approached, not sprung.** The trajectory from healthy to death passes through
    `sick` then `dying` for at least the configured warning duration, with no state jumps. Asserted
    on the replayed trajectory.
  - **AC3.5 — illness is recoverable.** A corpus vector exists carrying the pet from `sick` back to
    `content` inside the configured window.
  - **AC3.6 — timescales are separable (G6).** Weight and hunger rates are independent config keys;
    mutating the weight rate alone changes the weight trajectory while leaving the hunger trajectory
    byte-identical. Binary.
  - **AC3.7 — attention itself has a cost.** A replay of maximal feeding reaches `obese` and then
    `sick`. This is the ruler for the whole weight mechanic: without it, neglect is the only failure
    mode and the pet cannot be over-loved.
- **REQUIRES-JUDGMENT:** whether death feels *earned* rather than arbitrary. Per G4 this ships
  replay-validated only — the live §4 window is too short to reach it — and a green P3 must never be
  read as evidence that death feels right.

### P4 — ViewModel: the pet's condition, still headless
> Layers: 1 (completes), 4 (event vocabulary) · delivers the semantic half of journey steps 2–3

- **INTENT:** The owner must be able to tell what is wrong with the pet by looking, not by reading
  numbers — so the pet's *condition* has to be something the system knows explicitly, before
  anything draws it.
- **failure modes:** the ViewModel leaks raw stats, so the renderer re-implements the semantics and
  there are now two sources of truth · two genuinely different conditions project to the same
  ViewModel, making a state invisible · overlay composition collapses into flat sprite ids, so art
  cost goes multiplicative and ADR-003 is violated in fact while honoured on paper · projection is
  not pure.
- **acceptance:**
  - **AC4.1 — conditions are distinguishable (invariant).** The named conditions — `content`,
    `hungry`, `dirty`, `sick`, `dying`, `sleeping`, `obese`, `dead` — project to pairwise-distinct
    ViewModels. Binary over all pairs.
  - **AC4.2 — overlay shape (ADR-003).** The ViewModel is `{stage, pose, overlays[]}`; assertions
    confirm no field is a flat composite sprite id and every overlay id is valid across all four
    stages. Binary. This is what keeps art cost additive.
  - **AC4.3 — projection is pure (invariant).** `project(S)` twice on the same state returns
    deep-equal results and mutates nothing (frozen-input test).
  - **AC4.4 — no numbers escape.** The ViewModel exposes no raw stat value. Type-level + runtime
    assertion. This is what forces the renderer to stay dumb.
  - **AC4.5 — reactions are distinguishable.** Each of feed / play / clean yields a reaction
    ViewModel distinct from the other two and from the idle projection. Binary over all pairs.
  - **AC4.6 — interactions move state.** Each interaction moves its target stat by the configured
    magnitude in the returned state. Binary per interaction.
- **REQUIRES-JUDGMENT:** whether the condition vocabulary is the *right* set — i.e. whether a real
  observer would want a distinction we have not named. No test can find a missing category.

### P5 — Browser shell: visible, touchable, wired
> Layers: 4 (marshalling), 5, 6 · delivers journey steps 1–3 end-to-end · closes G1

- **INTENT:** The pet must stop being a test suite and start being an object the owner can look at
  and poke.
- **failure modes:** host globals leak into the core (the cardinal violation) · the render loop
  drives the simulation, so frame-coupled ageing sneaks back in after P1 banished it · input events
  lose their timestamp, so replay silently diverges from what was lived · a suspended tab resumes by
  accumulating frames instead of asking the clock (G1).
- **acceptance:**
  - **AC5.1 — core purity, enforced (Layer 6 ruler).** A dependency check over `core/`'s transitive
    import graph reports zero host globals (`window`, `document`, `localStorage`, `Date`,
    `Math.random`, `setTimeout`/`setInterval`) and zero runtime dependencies. Non-zero exit **fails
    the build**.
  - **AC5.2 — live equals replay (Layer 4 ruler).** Each control emits exactly one core event
    carrying the platform timestamp; replaying the session's emitted event log from its initial
    state reproduces the live state value-identically. Asserted by an in-app self-check.
  - **AC5.3 — suspend/resume (G1).** A simulated suspension (no frames for an interval, then one
    frame with a jumped clock) yields the same state as a continuously-ticked run over the same
    interval. This is AC1.1 re-asserted at the host seam, where it actually gets violated.
  - **AC5.4 — render is a projection.** `render(viewModel, frameIndex)` is pure: identical arguments
    produce identical pixel output (canvas snapshot equality), and the render path holds no
    reference that would let it mutate state.
  - **AC5.5 — display budget.** The canvas backing store is exactly 320×240 and every blit is 64×64
    at integer scale. Asserted at runtime, binary.
- **REQUIRES-JUDGMENT:** none at this phase — but nothing here proves the pet is *charming*. That is
  P6's problem and it is not mechanically answerable.

### P6 — Minimum sprite vocabulary & idle life
> Layers: 5 (extends) · delivers journey step 2 in earnest · answers `project-intent.md` §8 Q3

- **INTENT:** The owner has to actually want to keep looking at it. Nothing else in this initiative
  can buy that, and if this phase fails the honest outcome is not buying hardware.
- **failure modes:** art cost explodes because ADR-003 was honoured in the type and not in the assets
  · idle is a static image, so the object reads as dead · idle animation implies a state change that
  did not occur, violating constitution law 6 · the sprite set is attractive and unreadable at a
  glance, which is the failure that matters most and the one no test catches.
- **acceptance:**
  - **AC6.1 — art budget (invariant).** Total sprite cells ≤ 20 at 64×64, and the asset manifest's
    structure is additive: adding a hypothetical fifth life stage would add exactly 2 cells.
    Asserted against the manifest, without drawing anything.
  - **AC6.2 — every reachable condition renders.** Every ViewModel reachable in the golden-vector
    corpus resolves to a defined sprite composition; zero missing-asset fallbacks. Exhaustive over
    the corpus, binary.
  - **AC6.3 — idle is alive.** In every non-`dead` condition, output differs between at least two
    frame indices of the idle loop. Binary.
  - **AC6.4 — no lying animation (constitution law 6).** Every frame is a pure function of
    `(viewModel, frameIndex)`; no animation state persists across a state change or is driven by
    anything else. Source-level + snapshot assertion.
  - **AC6.5 — REQUIRES-JUDGMENT: glance-readability.** The owner can name the pet's condition from
    across the desk, without touching it, for each named condition. **No mechanical check exists.**
    Routed to the human at CHECK; it must never be marked green by a test.

## Exit gate (not a phase — this is §4)

After P6, the prototype runs unattended. Three of §4's four clauses are mechanically verifiable from
the persisted state plus the interaction log — 3+ consecutive days un-reset, opened on each of those
days, at least one life-stage change. The fourth — *and the owner still wants to look at it* — is
**REQUIRES-JUDGMENT (G5)** and is the one that actually decides whether hardware gets bought. It is
routed to the human and is never faked green.

