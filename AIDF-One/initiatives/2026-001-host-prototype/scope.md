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
| **1. Sim Core** | **CHANGE:** pet state (hunger, happiness, cleanliness, weight, health, age), real-time decay, life-stage transitions, illness/death resolution, interaction events — pure and deterministic → **AC:** `advance(state, Δ)` returns a state whose `stage` field flips `egg`→`child` exactly at the age threshold named in the tuning config; and replaying an identical `(timestamp, event)` list twice returns value-identical states. | **P1a** (P1b, P3, P4 extend) |
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

Eight phases, each independently testable and safe to ship alone. Everything through P4 is headless: the pet is
fully alive and fully verified before a single pixel is drawn. That ordering is deliberate — it is
what stops rendering from becoming the place bugs hide.

### P0 — Art viability spike *(added at ROADMAP amendment 2)*
> Layers: none — produces no shipped code · answers the ship-or-not half of `project-intent.md` §8 Q3
> · runs in Claude Design per **ADR-005**

- **INTENT:** The owner needs to know, *before* paying for five phases of simulation, whether a 64×64
  pet can read as alive at all under an additive overlay budget — because `project-intent.md` §8 Q3
  calls this "a direct proxy for whether this project ships at all", and discovering the answer at
  P6 would waste everything built before it.
- **failure modes:** the spike quietly becomes a full art commission (it is a probe, not a
  deliverable) · it explores a style that reads well once but cannot scale to four life stages ·
  it answers "is this attractive" instead of "is this legible at a glance" — the wrong question,
  attractively answered · its assets leak into the build and become the shipping set without ever
  passing P6's budget criteria.
- **acceptance:**
  - **AC0.1 — probe budget.** Exactly one life stage's base pose (2 idle frames) plus ≤ 4 overlays.
    Binary, counted against the pushed card set. This is the ruler that stops P0 becoming P6.
  - **AC0.2 — composition is real, not staged.** The composition-matrix card renders every
    base × overlay pair from the same source cells, with zero hand-authored per-pair artwork. Binary.
    If ADR-003 cannot survive its own first contact with actual pixels, it is better to know now.
  - **AC0.3 — REQUIRES-JUDGMENT: the go/no-go.** The owner can name each rendered condition — the
    bare base plus each of the ≤ 4 overlays — from the composition matrix at a glance, at
    device-equivalent scale. **No mechanical check exists — this is the entire point of the phase.**
    A NO returns the initiative to THINK, not to P1.
  - **AC0.4 — no leakage.** No P0 asset is imported by `core/`, `host/`, or the runtime manifest.
    Source scan, binary. P6 re-authors from scratch under AC6.1.
  - **AC0.5 — the viewing context is disclosed, not implied.** *(added after P0's adversarial
    completeness gate found that AC0.1–0.4 constrain the pixels but not the conditions under which
    they are judged.)* The glance page states, in the page itself, the arithmetic behind its
    "device-equivalent" size and names what it cannot reproduce — the target panel's brightness,
    contrast and reflectance, and the reviewer's own monitor and distance. Binary: the disclosure is
    present and names all four. Without it a judgment made on a dark webpage can be mistaken for a
    judgment made on the device.
- **REQUIRES-JUDGMENT:** AC0.3, and it is a genuine go/no-go on the initiative — not a checkpoint.

### P1a — Deterministic core & frozen corpus
> Layers: 1 (partial) · *(P1 was split into P1a/P1b after its CRITIQUE panel roughly doubled its
> acceptance set — see worklog 2026-07-30 23:09. Downstream phase numbers are unchanged.)*

- **INTENT:** The owner must be able to trust that the pet's state is the honest consequence of the
  time that actually passed and the care they actually gave — identical on any machine, at any tick
  rate, across any gap. Without that, every later judgement about the pet is a judgement about an
  artefact of how often the code happened to run.
- **failure modes:** decay depends on tick frequency (60 Hz and 1 Hz grow different pets) · float
  drift · Δ of 0 / negative / 60 days mishandled · stats escape their declared range · one big step ≠
  many small steps · **hidden state that is not a declared stat** (the remainder accumulator, an
  unclamped shadow value) escapes every integer and range check · **conditional rules quietly made
  unconditional** so step-independence passes trivially · a crossing-time off-by-one that random
  partitioning can never land on · **overflow past 2^53 while still `Number.isInteger`** · **the
  corpus generated from the implementation**, making every corpus check a tautology · corpus coverage
  unspecified, so one trivial vector satisfies most of the set · event ordering undefined (unsorted,
  equal timestamps, events predating the initial state) · an inert `seed` that buys nothing.
- **acceptance:**
  - **AC1a.1 — step-size independence (invariant).** For any state `S` and any partition of `Δ`,
    folding `advance` over the partition returns a value-identical state to `advance(S, Δ)`.
    ≥ 1000 seeded random partitions, `Δ` from 1 ms to 60 days — **plus, mandatorily, `{t−1, t, t+1}`
    for every threshold-crossing time AND every clamp-saturation time `t` reachable in the vector.**
    Random points essentially never land near either, and a saturation boundary breaks composition
    exactly as a threshold does. **Those times are supplied by AC1a.9's independent oracle, never by
    `core/`** — a `t` obtained from the implementation lets an off-by-one test itself and pass.
  - **AC1a.2 — threshold-gated rules are gated, and split exactly.** The config must declare at least
    one conditional rule (so this cannot pass vacuously). Per rule: (a) gate open → the gated stat's
    movement equals the value computed from the config rate, `Δ`, **and `S`'s declared remainder
    field** — hand-derived, not read off the implementation (stating it as bare `rate × Δ` would
    reject a correct carry-remainder implementation); (b) gate closed throughout `Δ` → the gated stat
    is value-identical; (c) at the exact crossing `tc`, `advance(S, tc−1 ms)` leaves it unmoved and
    `advance(S, tc+1 ms)` moves it by exactly one millisecond's worth.
  - **AC1a.2b — rule composition is declared, not emergent.** Where two rules act on one stat
    simultaneously, the evaluation order, whether contributions are additive, and the rule that
    **clamping is applied exactly once per stat per sub-interval** must be written down *before*
    being tested. The config must declare at least one overlapping pair, the corpus must contain a
    vector exercising it at a bound, and AC1a.11's mutation set must include swapping rule order and
    moving the clamp inside the loop. Undeclared composition semantics would ship as the ESP32
    contract by accident.
  - **AC1a.3 — the state is complete (invariant).** Anything surviving across an `advance` call is a
    declared state field. Verified three ways: a plain-JSON clone round-trip of `S` is value-identical;
    **every module-level value in `core/` is deep-frozen, asserted at test start** (a `const` holding
    a mutable object is the obvious way around a "no module-level `let`" scan); and the corpus runner
    produces identical results when vectors run in randomised order and when each runs in a fresh
    module instance.
  - **AC1a.4 — integers only, everywhere (invariant).** No float literal and no division yielding a
    non-integer in core source; `Number.isInteger` holds on **every numeric field of every state**
    produced anywhere in the corpus, not only declared stats, so remainders are covered.
    `Math.round`/`floor`/`ceil`/`trunc`, `| 0`, `>>> 0`, `parseInt`, `toFixed` and bare `/` appear
    nowhere in `core/` except inside **one `divmod` function definition — one definition, any number
    of call sites** — whose remainder is written back into state. **Fails the build.**
  - **AC1a.5 — range closure (invariant).** Every declared stat within its `[min,max]` and every
    remainder within `[0, DEN)`, for every state produced anywhere in the corpus and under property
    testing with adversarial `Δ` and adversarial event orderings.
  - **AC1a.6 — arithmetic stays representable.** The core declares `MAX_ADVANCE_MS` such that
    **`(Σ of all rates that can act on one stat simultaneously) × MAX_ADVANCE_MS + DEN < 2^53`** —
    the sum, not the largest single rate — asserted at config-load against the actual config.
    `advance` with `Δ > MAX_ADVANCE_MS` returns an explicit error rather than saturating silently.
  - **AC1a.7 — time is forward-only.** `advance(S, 0)` returns a value-identical state; `advance`
    with negative `Δ` throws rather than ages. Binary.
  - **AC1a.8 — ordering and interval conventions are declared, not accidental.** Written down before
    being tested, then asserted table-driven (≥ 6 cases): an unsorted event list · two events at an
    identical timestamp · an event predating the initial state · **whether an event at exactly `t0`
    and at exactly `t0+Δ` falls inside the advance** · **an event coincident with an internal
    threshold crossing or clamp saturation**. Undefined is a failure even when it happens to be
    stable.
  - **AC1a.9 — the corpus is independent, cross-checked and frozen.** No expected state may be
    produced by `core/`. Short vectors (≤ 1 h) take theirs from a brute-force reference stepping 1 ms
    at a time; long vectors from closed-form integer arithmetic in the same separate reference module,
    which **shares no code with `core/`** (import-graph assertion). **≥ 10 vectors must lie in range
    of BOTH oracles, and for each the two expected states must be value-identical** — a disagreement
    fails the build; this is a genuinely independent cross-check the corpus already pays for.
    Crossing and saturation times are enumerated by that module and stored in the corpus. The corpus
    file carries a content hash asserted by the test run. *(Honest limit: an independent **algorithm**,
    not an independent **author** — it cannot catch a misreading of the spec shared by both, and the
    import-graph assertion catches imports, not transcription. Recorded, not papered over.)*
  - **AC1a.10 — coverage is measured on transitions, not values.** The coverage checker fails the
    build unless, **by simulated evolution rather than by initial condition**: each stat is observed
    strictly increasing in one vector and strictly decreasing in another, and arrives at each of its
    bounds from a strictly interior value within a single vector; each gated rule is observed
    transitioning off→on and on→off within a single vector; every interaction type appears; `Δ`
    spans `{0, 1 ms, 1 h, 30 d}`; at least one vector carries an unsorted event list and one an event
    at exactly a crossing time.
  - **AC1a.11 — mutation gate, generated not curated.** Mutants are produced **exhaustively over
    declared operator classes** — every relational and equality operator in the decay path flipped,
    every clamp deleted, every config rate ±1, every interval split removed, the remainder carry-back
    removed, rule order swapped — not hand-picked from places already tested. **Zero surviving
    mutants**; any mutant claimed equivalent is justified in writing in `worklog.md`.
  - **AC1a.12 — P1a is randomness-free.** `core/` contains no PRNG and `advance`/`replay` take no
    seed; source scan, binary. *(Resolves a genuine contradiction the panel surfaced: entropy consumed
    as a function of `Δ` makes AC1a.1 unsatisfiable, since re-chunking changes the draw count. Nothing
    in P1a needs randomness, so it is removed rather than constrained. A later phase that needs it
    introduces it with its own criteria — consumed only at discrete event resolution, never per-`Δ`.)*
  - **AC1a.13 — tuning is data, every key is live, and there is no second copy.** An AST scan over
    the core's simulation modules permits only `0`, `1` and `-1` **as a direct operand, one hop, of an
    expression that reads or writes a state field**; structural/cardinality constants and the declared
    time-conversion `units` module are carved out by name. Mutating **each** config key individually
    must change the corpus trajectory — a dead key fails the phase. **`core/` contains no numeric data
    file other than the tuning config**, and the set of numeric parameters reachable by the simulation
    equals the config schema's key set exactly — a defaults file that silently fills gaps would defeat
    P1b's whole intent while every criterion stayed green.
  - **AC1a.14 — config enters through exactly one validating door.** Config validation is a `core/`
    entry point, and every consumer — corpus generator, reference module, harness, and every later
    phase's loader — obtains config only through it. Source scan, binary. A validator living only in
    the harness leaves the core accepting anything.
- **REQUIRES-JUDGMENT:** whether the decay curve's *shape* feels right. No oracle exists. A green
  P1a proves the curve is faithfully executed, never that it is well chosen.
- **design consequence (worth stating before building):** exact step-size independence forbids
  per-step rounding, so rates are integers in the state's own unit scale and every division carries
  its remainder back into state. It also forbids evaluating a whole `Δ` in one shot when a rule is
  *conditional* on a threshold, so `advance` must internally split `Δ` at exact crossing times. This
  is the most important structural implication in the initiative and is far cheaper to build in than
  to retrofit.

### P1b — Tuning instrument
> Layers: 1 (extends) · delivers journey step 5 · *(carries the half of the original P1 INTENT that
> its acceptance set left unencoded — found by the back-translation gate at CRITIQUE)*

- **INTENT:** The owner must be able to judge a month of the pet's life without living a month, and
  to change how the pet decays and then re-judge it, without editing code.
- **failure modes:** the harness hardcodes its event list and its config, so it is a fixture and not
  an instrument — green, with the owner no closer to tuning anything · the harness prints numbers the
  core never produced, because nothing binds stdout to core state and an approximating harness is
  exactly as reproducible as a correct one · an invalid config runs silently and thirty days of
  tuning produce a meaningless flat pet · the output is byte-stable but illegible, so a crossing
  cannot be located by reading it · only one care pattern ships, so there is nothing to compare.
- **acceptance:**
  - **AC1b.1 — the harness is an instrument, not a fixture.** It takes the event list and the tuning
    config as arguments. Running an alternative care pattern and an alternative config requires
    **zero source edits**. Binary: two CLI invocations differing only in their input files produce
    different trajectories.
  - **AC1b.2 — the output is the core's state, unmodified.** Every printed value is a serialised
    state field; a source scan finds zero rounding, scaling or derived quantities between core state
    and stdout, and the printed trajectory is value-identical to folding the core's public `advance`
    over the same event list. Binary.
  - **AC1b.3 — contrasting patterns ship as data.** At least two care patterns — attentive and
    neglectful — ship as input files, not code, and their 30-day trajectories differ in at least
    three stats. Without a contrast there is nothing to judge a curve against.
  - **AC1b.4 — crossings are legible.** The per-day output carries, for each day, every stat's value,
    each threshold-gated rule's on/off state **with the exact timestamp of every transition** (a gate
    that toggles twice between daily samples would otherwise make this check vacuous rather than
    failing), **and every enumerated state field, `stage` included**. Binary: the crossing day derived
    by reading the output equals the crossing day computed from the core. Stage is neither a stat nor
    a rate rule, yet §4's exit criterion turns on seeing a stage change — without this clause an owner
    can re-tune a stage age and not be able to see the result.
  - **AC1b.5 — the config is validated on load.** A config violating the declared schema returns an
    explicit `ConfigError` naming the offending key — never a defaulted, clamped or zeroed run.
    Table-driven, ≥ 11 invalid cases: non-integer value, negative rate, **a zero rate** (the exact
    flat-pet case that motivated this criterion, and neither non-integer nor negative), **a
    zero-length stage duration**, **a gate whose condition can never open**, `min ≥ max`,
    non-monotonic stage ages, a threshold inconsistent with its stat's direction, an interaction
    magnitude outside its target stat's range, an unknown key, a missing key. Constitution law 4 demands this of saves;
    the config is the file the owner edits daily and deserves no less.
  - **AC1b.6 — fast and reproducible.** A 30-day event list completes in < 1 s wall clock, exits 0,
    and produces byte-identical stdout across two runs with identical inputs.
- **REQUIRES-JUDGMENT:** none mechanical. But note that this phase makes tuning *possible*; whether
  the resulting curve is *good* stays with P1a's judgment item and the §4 soak.

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
> · assets authored in-repo, reviewed in Claude Design per **ADR-005**

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
    Routed to the human at CHECK via the Claude Design review surface (ADR-005); it must never be
    marked green by a test.
  - **AC6.6 — one manifest, no second copy (ADR-005).** The Claude Design preview bundle is
    *generated* from the same asset manifest the runtime reads. Mutating one cell in the manifest
    provably changes both the runtime render and the regenerated bundle, and a source scan finds no
    hand-maintained duplicate of the cell list. Binary. This is what stops the design system and the
    code drifting apart — the classic failure of keeping a component library beside an app.

## Exit gate (not a phase — this is §4)

After P6, the prototype runs unattended. Three of §4's four clauses are mechanically verifiable from
the persisted state plus the interaction log — 3+ consecutive days un-reset, opened on each of those
days, at least one life-stage change. The fourth — *and the owner still wants to look at it* — is
**REQUIRES-JUDGMENT (G5)** and is the one that actually decides whether hardware gets bought. It is
routed to the human and is never faked green.

