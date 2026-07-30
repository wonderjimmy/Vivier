# Worklog — 2026-001-host-prototype

> Agent working memory: narrative + failures. Append-only, per cycle.

## [2026-07-30 22:03 HKT] TRACK — THINK

- branch: `initiative/2026-001-host-prototype` · phase: pre-ROADMAP (no phases exist yet)
- Reads: `constitution.md`, `product-spec.md` v1, `scope.md`, `project-intent.md`. Codebase: empty
  (greenfield — nothing to investigate against, so this THINK is domain + architecture only).
- **Cross-lineage expert: unavailable** (no expert command configured — `CLAUDE.md`). THINK ran solo.
- No code written.

### Recommended approach (ONE — approve or reject)

A three-package TypeScript project, purity mechanically enforced at the boundary:

```
core/    pure simulation — zero runtime deps, zero host globals, fixed-point integers,
         seeded PRNG implemented in-tree. Exposes exactly four entry points:
           advance(state, elapsedMs) -> state
           apply(state, event, atMs) -> state
           replay(initial, events)   -> state
           project(state)            -> ViewModel      (semantic, not pixels)
host/    browser shell — clock adapter, localStorage adapter, canvas renderer (320×240,
         64×64 sprites), three discrete button controls.
tools/   replay harness + the tuning config both tests and runtime read.
```

Runner: Vitest. Purity enforced by a dependency check over `core/`'s transitive import graph that
**fails the build** — the Layer-6 acceptance criterion in `scope.md`, not a review convention.

### Answers to `project-intent.md` §8

**Q5 — where exactly is the core/render boundary?** *(answered first: everything else depends on it)*
The seam is `project(state) -> ViewModel`. The **core** decides *what condition the pet is in* —
stage, pose, mood, which need flags are firing, whether it is asleep, whether it is dying. The
**Render** layer decides only *what pixels that condition is*. Consequence: "which sprite state
applies" is unit-testable in the core with no canvas, and the device renderer is a drop-in second
consumer of the same ViewModel. The core never learns what time it is, where state is stored, what a
pixel is, or what a button is — the platform hands it `elapsedMs` and timestamped events.

**Q1 — power loss and multi-day gaps: pause, or age in absentia?**
Neither cleanly. Pausing makes it a save file, not a pet, and kills the north-star. Ageing fully in
absentia risks a power cut killing a three-week pet, which is the fastest route to the drawer.
Recommendation: **decay ages fully in absentia, but death may only occur on a live tick.** Resolving
a gap can drive the pet to critical/dying and leave it at death's door; it cannot deliver the
terminal transition. Rationale: guilt requires the consequence be *attributable* — neglect you
watched happen generates guilt, an outage that killed it while unplugged generates a bug feeling.
The save-it-or-lose-it moment on return is a stronger beat than arriving at a corpse. Three rules
fall out, all testable:
1. elapsed computable and forward → age by the full elapsed
2. elapsed negative or absurd → `elapsed = 0`, set and **persist** `clockAnomaly`, surface it
3. death is reachable only from a live tick, never from gap resolution

**Q4 — is death desirable in a single-owner context?**
Yes, **given rule 3 above** — which is what defuses the drawer risk. Two riders: death must be
*approached* visibly (escalating signals over hours, never a surprise), and since the scope cuts
reincarnation, death is terminal for this initiative. See gap G4 for the testing consequence.

**Q2 — buttons or touch?**
Not this initiative's question, but constrain it now. The host prototype uses **three discrete
controls** (feed / play / clean), modelled as physical buttons, not gestures and not taps on the
pet's body. Whatever the device ends up with, the Input layer marshals to the same three discrete
events — so the *event vocabulary* is fixed now, which is the part that matters, and the physical
question stays genuinely open for the device initiative.

**Q3 — minimum sprite set that still reads as alive?**
A first estimate to be tested, not a settled answer. The load-bearing decision is **composition**:
expressions and need-states are **overlays composed onto a per-stage base sprite**, never
per-stage × per-state sprites. That makes art cost *additive* instead of multiplicative, which is
the only way the "art is the bottleneck" constraint survives four life stages. Estimate: 4 stages ×
2-frame idle loop (8 cells) + ~8 shared overlay/reaction cells ≈ **16 cells at 64×64**. Under
multiplication the same expressiveness would cost ~48.

**Q6 — the browser prototype's exit criterion?**
Already answered by `scope.md` §4 and needs no separate mechanism. But see gap G5: one of its four
clauses is not mechanically verifiable and must be tagged, not faked.

### Decisions proposed (promote to `decisions.md` as ADR-001…004 on approval)

- **ADR-001 — TypeScript core with a language-independent golden-vector corpus.**
  Rejected: C++17 core + Emscripten/WASM, and Rust + `wasm-bindgen`/`esp-hal`. Both genuinely give
  one shared core, and both pay that tax *now* against a device that `scope.md` §4 explicitly
  sanctions never buying — while slowing the exact tuning loop `project-intent.md` §9 demands be
  cheap. They also don't avoid a two-language project: render/input/persistence would be TS anyway.
  **The port cost is bounded instead by a frozen corpus of golden vectors** — JSON fixtures of
  `(initial state, seed, event list) → expected end state` — that any future implementation must
  pass. That corpus, not a shared binary, becomes the real single source of truth for the
  simulation's semantics; it survives a language change, which a shared binary does not.
  **Rider: the corpus is a phase-1 deliverable. Without it, ADR-001 is the wrong call.**

- **ADR-002 — no floating point anywhere in the core; fixed-point integers only.**
  Stats held as integer milli-units, decay computed as integer arithmetic over integer milliseconds.
  Reason: TS numbers are IEEE-754 doubles while the ESP32-S3 FPU is single-precision (doubles are
  software-emulated and slow), so float core math would either diverge across implementations or
  crawl on device — and divergence breaks constitution law 3 outright. It also makes golden vectors
  byte-comparable rather than epsilon-comparable. The seeded PRNG is likewise a small integer
  generator implemented in-tree, not a dependency, so both implementations match bit-for-bit.

- **ADR-003 — need/expression states compose as overlays over per-stage base sprites.**
  Keeps art cost additive across life stages (see Q3). Constrains the ViewModel: it must express
  condition as `(stage, pose, overlay[])`, not as one flat sprite id.

- **ADR-004 — age in absentia, but death requires a witnessed live tick.** See Q1.

- **ADR-005 — sprite vocabulary explored *and* reviewed in a Claude Design system, authored in-repo.**
  *(added 2026-07-30 at human request as ROADMAP amendment 1; **revised at amendment 2**, before
  promotion, to cover design *exploration* and not only review of a finished manifest.)*
  **Revision:** the Design project is where the pet's visual language is *developed* — candidate
  designs are generated as HTML/CSS cards, pushed, judged by the human in the pane, and iterated.
  It is a working surface, not just an inspection window. Claude Design does not itself draw: it
  hosts and renders candidates. The winning vocabulary is then re-authored into the repo manifest,
  which remains the SSOT.
  Context: AC6.5 (glance-readability) has no mechanical check and needs a real review surface, and
  ADR-003's additive art cost only holds if the overlay structure is honoured *in the assets*, not
  merely in the ViewModel type — which is a thing you have to look at to know.
  Decision: the repo's asset manifest + cells are the **SSOT**; a preview bundle is *generated* from
  that manifest and pushed to a dedicated new Claude Design project. **Sync direction is strictly
  repo → Design, never the reverse.** Three card groups: *Stages* (4 base poses), *Overlays*
  (shared, stage-independent), *Composition matrix* (stage × overlay) — the matrix being the visual
  form of AC6.2 and the only practical way to *see* ADR-003 actually holding.
  Rejected: authoring sprites inside the Design project (puts the SSOT behind a login and makes the
  build depend on a network artifact); no review surface at all (leaves AC6.5 with no mechanism, and
  it is the criterion that decides whether hardware gets bought).
  Risk it introduces: a design-system surface invites component proliferation, which is exactly what
  AC6.1's ≤ 20-cell budget exists to prevent. Mitigated by asserting the budget against the *repo
  manifest*, never against the Design project, so the constraint stays where the code is.
  Note: the **zero-network hard constraint governs the prototype's runtime, not the dev workflow** —
  pushing a preview bundle at author time does not breach it. Stated explicitly so it is not later
  mistaken for a violation.
  Verified 2026-07-30: `DesignSync.list_projects` succeeds; the account holds one unrelated project
  (`CQTS+ Design System`) which must not be touched. A new project is created at P6, not before.
  Caveat: the `/design-sync` skill is **not installed in this session** — the tool is driven
  directly, so the skill's bundle-builder and `.render-check.json` self-check are unavailable and
  the preview bundle is generated by project code (which AC6.6 requires anyway).

### Risks & gaps found

- **G1 — "a browser tab left open for 3 days" is not a real always-on assumption.** Tabs get
  throttled, laptops sleep, tabs get closed. This is not a problem to fix but a **requirement to
  restate**: continuity must never depend on the tab staying alive, and elapsed time must be
  resolved from the clock, never accumulated from frames. Handled correctly, the 3-day run becomes a
  *better* test than intended — it exercises the same suspend/resume/restore path the device will.
  A prototype that passes by never being interrupted has proven less, not more.

- **G2 — `localStorage` doesn't wear out, so the write-budget discipline goes untested.**
  `scope.md` Layer 3 has an AC for versioning and validate-on-load (both transferable) but **none
  for write cadence** — the one part of persistence that exists purely because NVS flash is finite.
  Left as-is, the debounce is written and never verified until it's on hardware, which is precisely
  where it's expensive to be wrong. **Recommend adding an AC at ROADMAP:** under a continuous
  simulated run, the persistence layer performs no more than N writes per simulated hour, with
  immediate writes only on the declared significant events — assertable via a counting fake adapter.

- **G3 — silent gap confirmed real (flagged at scope time).** `clockAnomaly` must be **persisted**,
  not merely computed. Otherwise a restart launders an untrustworthy clock into a trustworthy one:
  Clock detects the anomaly, Persistence drops it, next boot sees a clean state and ages the pet on
  a clock it has no right to trust. The Persistence save schema must carry it.

- **G4 — death is not reachable inside the live 3-day success window.** With a ~7-day neglect
  curve, the live run will never exercise the terminal path, so death ships validated only by
  replay. That is acceptable *provided it is stated*: death's correctness is a replay-harness
  claim, not a lived-experience claim, and the tuning of how death *feels* remains unvalidated when
  the hardware gate is decided. Do not let a green CHECK imply otherwise.

- **G5 — REQUIRES-JUDGMENT: "and the owner still wants to look at it."** The fourth clause of
  `scope.md` §4 has no mechanical check and must never be faked green. The other three clauses (3+
  consecutive days un-reset, opened on each day, at least one stage change) are all mechanically
  verifiable from the persisted state and an interaction log. Route clause four to the human at
  CHECK, explicitly.

- **G6 — two timescales in one tuning config.** Overfeeding damage must accrue far more slowly than
  hunger decay, or weight becomes noise. Tuning risk, not a blocker — but the tuning config must
  make the two rates independently adjustable and the replay harness must plot both, or the weight
  mechanic will be judged broken when it is merely mistuned.

- **G7 — process gap, needs your decision.** Framework rule 8 requires CHECK and AUDIT to run in a
  **fresh context** — a report from the session that built the thing does not count as verification.
  My operating rules in this environment forbid spawning subagents unless you ask for them. So at
  CHECK I will either need your go-ahead to dispatch a fresh-context reviewer, or CHECK degrades to
  self-review and the worklog must record it honestly as *not* a fresh-context audit. Flagging now,
  not at the gate.

- Rejected / Learnings: nothing built yet, nothing abandoned yet.
- fresh-context AUDIT: n/a (THINK produces no artifact to audit — see G7 for when this bites)
- verifier panel: n/a (no build)
- adversarial gate: n/a · back-translation: n/a · REQUIRES-JUDGMENT: G5 (`scope.md` §4 clause 4)
- layer coverage: n/a at THINK — matrix exists in `scope.md`, gated at CHECK
- State now: branch cut, pre-flight committed on `main`, scope approved, zero code.
- Next: ROADMAP — break into small independently-shippable phases, write each phase's INTENT +
  failure modes + acceptance criteria, and assign every Layer Coverage Matrix row to a phase
  (all six rows are currently `P?`).
  Open questions: none — both resolved below.

**Resolution (2026-07-30, same cycle):**
- **G2 accepted** — the write-budget AC enters scope; assigned to P2 at ROADMAP (AC2.5).
- **G7 resolved** — the human directed "follow AIDF-One's requirements in full", which authorises
  fresh-context subagents for every AUDIT and CHECK. Recorded as a standing operational fact in
  `../../../CLAUDE.md` so it is not re-litigated each phase and survives a session change.

## [2026-07-30 22:26 HKT] TRACK — ROADMAP (amendment 1)

- branch: `initiative/2026-001-host-prototype` · phase: pre-APPROVE (roadmap not yet approved)
- Did: human requested Claude Design be used for the sprite work. Recorded as **ADR-005** (above),
  amended P6 with **AC6.6** (one manifest, no second copy), and annotated AC6.5's routing.
- Why: it is a change to *how* P6 is delivered and to where the art SSOT lives — that is an ADR and
  a scope amendment, not an implementation detail to discover at P6. Verified tool access now rather
  than five phases from now, so an auth or fit problem surfaces while it is still cheap.
- Rejected / Learnings: **Claude Design is a component-library / design-system surface, not a pixel
  editor** — it does not draw sprites. Assuming it would produce the art would have left P6 with a
  review surface and no assets. It also does not remove the art bottleneck; it makes the bottleneck
  reviewable. Recorded so a later session does not re-form the same expectation.
- Phases P1–P5 unchanged. No code written.
- fresh-context AUDIT: n/a (no build) · verifier panel: n/a
- adversarial gate: n/a · back-translation: n/a · REQUIRES-JUDGMENT: AC6.5 (unchanged, now routed)
- layer coverage: 6/6 rows assigned to phases · silent gaps: none new
- State now: roadmap complete and amended, awaiting approval to build P1. Zero code.
- Next: APPROVE — build P1 only, then stop.   Open questions: none.

## [2026-07-30 22:30 HKT] TRACK — ROADMAP (amendment 2)

- branch: `initiative/2026-001-host-prototype` · phase: pre-APPROVE (roadmap not yet approved)
- Did: human clarified they want Claude Design involved in **designing** the pet, not only reviewing
  a finished manifest. Revised ADR-005 accordingly (exploration surface, not inspection window) and
  **inserted P0 — art viability spike** ahead of P1.
- Why: the clarification exposed a real ordering defect in THINK that I own. `project-intent.md` §8
  Q3 states plainly that the minimum sprite set is "a direct proxy for whether this project ships at
  all" — and ROADMAP nonetheless placed all art at P6, *last*. That schedules the project's own
  stated ship-or-not question after five phases of simulation work have already been paid for. A
  cheap, bounded probe belongs first. THINK read Q3 as an art-cost question and missed that it is a
  viability question.
- Rejected / Learnings:
  - **Rejected — pulling all of P6 forward.** Drawing the full vocabulary before P4 exists means
    drawing without a settled condition list; the shipping set still belongs at P6. P0 is a probe
    with a hard budget (AC0.1) and a no-leakage rule (AC0.4) precisely so it cannot drift into P6.
  - **Learning — Claude Design does not draw.** It hosts and renders candidates as preview cards; the
    designs are generated and pushed. Expecting it to produce art would have left P6 with a review
    surface and no assets. Recorded so a later session does not re-form the expectation.
  - **Learning — one condition list already exists** (AC4.1's vocabulary + the four stages), so P0 is
    not blocked on P4 despite preceding it. It draws against a named subset, not an invented one.
- Phases P1–P6 unchanged in content; P6 gains AC6.6 from amendment 1. No code written.
- fresh-context AUDIT: n/a (no build) · verifier panel: n/a
- adversarial gate: n/a · back-translation: n/a · REQUIRES-JUDGMENT: AC0.3 (new, go/no-go), AC6.5
- layer coverage: 6/6 rows assigned · P0 declares no layer (produces no shipped code) · silent gaps: none new
- State now: seven phases (P0–P6), roadmap awaiting approval. Zero code, no Design project created.
- Next: APPROVE — build P0 only, then stop.   Open questions: none.

## [2026-07-30 22:46 HKT] CRAFT — P0 built, audited, filed

- branch: `initiative/2026-001-host-prototype` · phase: **1 of 7 — P0 art viability spike**
- Did: authored 6 cells (2 base idle frames + 4 condition overlays) at 32×32 logical, ×2 upscaled
  into the 64×64 sprite cell; wrote a bundle builder that validates every cell, composites
  base+overlay, encodes PNGs in-tree (no dependencies) and generates 4 preview pages from that one
  source; created the Claude Design project **Vivier — Pet Sprite System** and pushed the bundle.
- Why 32×32 logical rather than native 64×64: 1px detail is unreadable at a glance on a 2.8" panel,
  and chunkier pixels are the point of the form. Disclosed here as a P0 finding for P6 to keep or
  overturn — it is not settled by this spike.

### Rejected / Learnings — three iterations, two of them failures worth recording

1. **Iteration 1 failed its own glance test and I caught it before it reached the human.** All four
   overlays signalled through small icons (thought bubble, stray grime pixels, corner glyphs). At
   across-the-desk size `sick` and `sleeping` read fine — because they change the *face* — while
   `hungry` and `dirty` collapsed into "content plus a smudge". **The finding: overlays that change
   the face survive downscaling; overlays that add icons do not.** Every condition therefore needs a
   face variant, which is only affordable because the face anchors are fixed (ADR-003).
2. **Iteration 2 fixed that** by moving the signal into half-lidded eyes + frown (`hungry`) and a
   smudge crossing the face (`dirty`), demoting the icons to secondary cues. Cell count unchanged.
3. **Iteration 3 redrew the base as a cat** at the human's request mid-phase. Cost: two cells. The
   four overlays needed **no** change — direct empirical confirmation that ADR-003's anchor rule
   works, obtained by accident rather than by test. Only collision was the mess pile sitting where
   the new tail goes; moved to the opposite corner.
- **Learning — Claude Design does not draw.** It hosts and renders candidates as preview cards.

### Verification

- fresh-context AUDIT: **yes** — dispatched `general-purpose` (sonnet), clean context, did not build
  the code. Verdicts with evidence:
  - **AC0.1 PASS** — 6 authored cells counted from the `CELLS` export itself, not from the build's
    own printout (`cells.mjs:262-269`).
  - **AC0.2 PASS** — `compose()` (`build.mjs:42-63`) is one generic function; grep found no
    per-pair branching anywhere. 10 matrix squares from 6 cells, 0 hand-authored pairs.
  - **AC0.4 PASS** — `core/` and `host/` do not exist yet; no manifest exists; nothing outside
    `spike/` references `p0-art`.
  - **AC0.3** — correctly left unjudged (REQUIRES-JUDGMENT, human). Auditor confirmed the evidence
    page is *fair*: both sizes rendered, captions below the images and coverable.
  - **Validator adversarially tested** — auditor deleted one character from a cell row; build failed
    with exit 1 and the exact row named. A validator that cannot fail is not a validator; this one
    fails. File restored and verified byte-identical by md5.
- adversarial gate: **found a real hole** — AC0.1/0.2/0.4 constrain the pixels but say nothing about
  the *conditions under which they are judged*. The page asserted a "device-equivalent" size from
  pure arithmetic while being viewed on an arbitrary dark webpage on the reviewer's own monitor. A
  spike could pass every mechanical AC and still hand the human a rigged go/no-go. **Looped back to
  ROADMAP, added AC0.5** (viewing context disclosed, naming brightness / contrast / reflectance /
  monitor-and-distance), satisfied it, rebuilt and re-pushed the page.
- back-translation: aligned — the AC set reconstructs to "prove a 64×64 pet can read as alive under
  an additive overlay budget, cheaply and without committing to it", which is the stated INTENT.
- REQUIRES-JUDGMENT: **AC0.3 — open, routed to the human. This is the phase's go/no-go.**
- layer coverage: n/a — P0 declares no layer and ships no code (`scope.md`).
- Auditor's other findings, all actioned: worklog had no P0 entry (this entry) · AC0.3 said
  "≤ 4 conditions" while 5 are rendered, reworded to "the bare base plus each of the ≤ 4 overlays" ·
  `decisions.md` did not exist though `CLAUDE.md` names it in the reading order — created, ADR-001
  through ADR-005 promoted into it.
- CHANGELOG: deliberately not written. P0 ships nothing user-facing; the changelog is for shipped
  changes, and writing one here would misrepresent a probe as a release.

- State now: P0 built and audited. 4 cards live in the Claude Design project. Zero simulation code —
  `core/`, `host/` and `tools/` do not exist yet.
- Next: **STOP — human judges AC0.3.** YES → P1 (deterministic core & replay harness). NO → back to
  THINK, not to P1.   Open questions: AC0.3.

## [2026-07-30 23:09 HKT] P0 CLOSED — AC0.3 = YES

- branch: `initiative/2026-001-host-prototype` · phase: P0 closed, P1 opening
- Human judged AC0.3 **YES** on the glance test. The go/no-go passes: a 64×64 cat reads as alive
  under an additive overlay budget, and five conditions are separable at device-equivalent scale.
- Consequence: `project-intent.md` §8 Q3's ship-or-not half is answered affirmatively. The remaining
  art question (the full vocabulary across four stages) stays at P6 where it belongs.
- P0's cells remain spike-only under AC0.4. P6 re-authors.

## [2026-07-30 23:09 HKT] P1 — CRITIQUE panel (3 facets, fresh contexts). NOT YET BUILT.

- branch: `initiative/2026-001-host-prototype` · phase: 2 of 7 — P1, at CRITIQUE
- verifier panel: 3 CRITIQUE reports below. No code written. RUN is **blocked** on the judgment
  finding (craft.md: judgment findings escalate to the human *before* RUN).

### Facet 1 — correctness (sonnet)
- AC1.1 **OK** and confirmed achievable; forces an integer accumulator with exact remainder carry
  plus an internal discrete-event splitter that cuts Δ at analytically-computed crossing times.
  No mathematical contradiction: all rates and thresholds are integers, so crossing times solve exactly.
- **AC1.2 DEFECT (oracle, A1/A3)** — quantifies over "the golden-vector corpus", but the corpus is
  undefined everywhere: no size, no generation method, no seed, no committed location. As written the
  check cannot be built, and whoever writes the corpus silently chooses what determinism means.
- **AC1.7 DEFECT (oracle, A1/A3)** — "zero numeric simulation constants" has no operational
  definition separating a decay rate from a loop bound or a unit conversion. Not mechanical until an
  allowlist is named.
- AC1.3, AC1.4, AC1.5, AC1.6 OK. Unsatisfiable-as-written: none.

### Facet 2 — adversarial (opus) — six ways to pass every AC and still be wrong
1. **The corpus certifies itself.** Four ACs quantify over the corpus; the natural implementation
   generates expected end states by running `replay` and dumping the output. Every corpus check
   becomes a tautology, a single Δ=0 vector satisfies four ACs exhaustively, and a later phase that
   changes a decay rate just regenerates the corpus. **ADR-001 rests the entire port-cost bound on
   this corpus being the semantics SSOT** — self-generation reduces it to a snapshot of today's code.
2. **An invalid tuning config runs silently.** A zero or negative rate produces a flat trajectory
   that is perfectly step-size-independent, deterministic, integral and in-range. Thirty days of
   tuning yield a pet that never decays, and nothing says so — constitution law 4 demands
   validate-on-load for saves; the config, the file the owner edits daily, has no equivalent.
3. **The harness prints numbers the core never produced.** AC1.6 constrains speed, exit code and
   stdout stability but never binds stdout to core state. An approximating harness is exactly as
   reproducible as a correct one — this is the phase's own listed failure mode, unclosed by any AC.
4. **Hidden non-stat state.** AC1.3/AC1.4 quantify only over *declared stats*. The remainder
   accumulator AC1.1 forces, or an unclamped shadow value, escapes both — and P2's AC2.1 then
   assumes a round-trip P1 never proved.
5. **AC1.1 is satisfiable by deleting the conditional.** It is a self-consistency property, not a
   correctness one: making every rate unconditional and linear passes it trivially. Worse, 1000
   *random* partition points essentially never land within milliseconds of a crossing, so an
   off-by-one in the split is self-consistent and therefore invisible.
6. **Overflow past 2^53.** AC1.4 actively mandates Δ = MAX_SAFE_INTEGER; `rate × Δ` blows past 2^53
   immediately, and every float64 above 2^53 is still an integer — so `Number.isInteger` passes on
   garbage and the clamped result stays in range.
- Twelve unlisted failure modes recorded, incl. undefined event-list ordering (unsorted, equal
  timestamps, events predating `initial`), an inert `seed`, non-canonical serialisation, and
  AC1.7's mutation check being satisfiable by a single key while dead keys survive.
- kind tags: all six **oracle**.

### Facet 3 — intent-fidelity / back-translation gate (opus)
- Reconstruction from the AC set alone: *"a substrate/regression-fixture phase — make pet state a
  trustworthy pure function and prove it in CI."*
- Stated INTENT: *"The owner must be able to judge a month of the pet's life without living a month,
  and trust that what the harness shows is exactly what the pet will really do."*
- **Verdict: DIVERGED (kind: judgment).** Clause two is over-served — six of seven ACs are
  determinism/fidelity. Clause one is *not encoded at all*. Nothing requires the harness to be an
  **instrument**: AC1.6 pins one baked-in event list, and no AC requires it to accept a different
  care pattern or a different tuning config without editing source. The AC set is fully satisfied by
  a hardcoded fixture printing a CSV — green, with the owner no closer to judging an arbitrary month.
- Fix target: **the ACs**, not the INTENT. The INTENT is the better statement of the goal.

- Rejected / Learnings: my ROADMAP wrote P1's ACs almost entirely against *mechanism* fidelity and
  let the phase's human-facing half ride on one clause of one AC. The back-translation gate is the
  only check that could have caught that, and it did — before any code existed.
- fresh-context AUDIT: n/a (nothing built) · adversarial gate: **6 holes found** ·
  back-translation: **DIVERGED** · REQUIRES-JUDGMENT: decay-curve shape (unchanged)
- State now: P1 specified but **not built**. RUN blocked pending the human's call below.
- Next: human decides the two escalations, then rulers are re-trued and the panel re-run to two
  consecutive clean rounds before RUN.

## [2026-07-30 23:40 HKT] P1a/P1b — CRITIQUE round 2 + correction 2. STILL NOT BUILT.

- branch: `initiative/2026-001-host-prototype` · phase: 2 of 8 — P1a, at CRITIQUE (auto-correct loop)
- Correction 1 (after round 1): split P1 → P1a/P1b, rewrote the AC set, added the harness-as-
  instrument criteria the back-translation gate said were missing.

### Round 2 panel result — NOT clean
- **intent-fidelity: CLEAN.** Both reconstructions align with their INTENT lines; the round-1
  divergence is genuinely repaired, not relabelled. One narrow crack found: `stage` is tunable
  (AC1b.5 validates stage ages) but not *readable* — AC1b.4 required stats and gate states, and a
  stage is neither, so an owner could re-tune a stage age and be unable to see the transition day.
  That lands directly on §4's exit criterion ("changed life stage at least once"). Fixed in AC1b.4.
- **correctness: 2 DEFECTS.** (a) AC1a.2 said the gated stat "moves by exactly `rate × Δ`" — which
  would **reject a correct implementation**, because the carry-remainder design AC1a.4 mandates makes
  actual movement a function of `S`'s remainder too. Reworded. (b) AC1a.13's literal ban was not
  mechanically decidable and would false-positive on structural constants. Pinned to a one-hop AST
  rule with a named carve-out.
- **adversarial: HOLES FOUND — 11 new scenarios, and 5 of round 1's 6 closures were only PARTIAL.**
  The sharpest:
  1. **Clamp saturation is a splitting boundary too.** Round 1 closed the threshold case; a stat
     saturating mid-`Δ` breaks composition identically, and a saturation time is not a threshold
     crossing, so the mandatory partition points never covered it. *Hole 5 re-opened one metre left.*
  2. **The crossing times were still self-certified.** AC1a.2 required the *rate* be hand-computed,
     but nothing said where `tc` came from — so a core computing its crossing 1 ms late would be
     tested at its own wrong `tc` and the corpus would freeze the off-by-one.
  3. **AC1a.12 contradicted AC1a.1.** A live seed consumed as a function of `Δ` makes step-size
     independence *unsatisfiable*, because re-chunking changes the draw count. Resolved by removing
     randomness from P1a entirely rather than constraining it.
  4. `const obj = {}` at module scope defeats a "no module-level mutable binding" scan → deep-freeze.
  5. Config validation could live in the harness while `core/` accepted anything → AC1a.14.
  6. A `defaults.json` inside `core/` would silently fill config gaps, defeating P1b's intent while
     every criterion stayed green → AC1a.13's no-second-numeric-file clause.
  7. Coverage was satisfiable by vectors whose *initial states* already sat at the bounds → coverage
     is now measured on transitions, by simulated evolution.
  8. The two oracles never overlapped, wasting the free independent cross-check → ≥10 shared vectors.
- Correction 2 applied: AC1a set now 14 criteria (added AC1a.2b, AC1a.14; AC1a.12 inverted from
  "seed is load-bearing" to "P1a is randomness-free"), AC1b.4 and AC1b.5 extended.

### Rejected / Learnings
- **Round 1's closures were graded too generously by me.** I read "the panel closed six holes" as done
  when five were partial. The lesson is that a closure has to be re-attacked, not assumed — which is
  exactly what a *second* round is for, and why the framework demands consecutive clean rounds rather
  than one.
- **The adversarial facet is not converging on zero.** Round 1: 6 holes. Round 2: 11 new. Each round's
  findings are real and each is smaller than the last, but the spec has grown from 7 criteria to 20
  for a component of a few hundred lines. This is the known failure mode of unbounded adversarial
  review, and the framework's 3-attempt bound exists for it. Recorded here as the reason the next
  decision is a human one.
- fresh-context AUDIT: n/a (nothing built) · verifier panel: 3 round-1 + 3 round-2 reports (above)
- adversarial gate: **holes found, corrected** · back-translation: **aligned** ·
  REQUIRES-JUDGMENT: decay-curve shape (unchanged)
- State now: P1a/P1b specified at 20 criteria. **Zero code.** Correction 2 applied, round 3 not run.
- Next: human decides — run round 3, or freeze the spec and build. See escalation in chat.
