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

## [2026-07-31 00:36 HKT] P1a — RUN complete, gate NOT passed. AC1a.11 open.

- branch: `initiative/2026-001-host-prototype` · phase: 2 of 8 — P1a, at RUN/AUDIT
- **P1a is NOT done.** 13 of 14 criteria have passing evidence; AC1a.11 (mutation gate) fails with
  23 undeclared survivors. Recording that plainly rather than presenting the phase for approval.

### Built
- `core/src/` — pure simulation. Zero runtime dependencies, zero host globals, zero randomness.
  `divmod.ts` is the single division site; `units.ts` the single time-conversion carve-out.
  `advance` segments Δ at every gate flip and every clamp saturation, located by **binary search**
  rather than a closed-form solve — deliberately, because the reference oracle solves the same
  boundary algebraically and the two disagree if either has an off-by-one.
- `reference/src/engine.ts` — the independent oracle, importing nothing from `core/`. Two
  algorithms: 1 ms brute force and algebraic segmentation.
- `corpus/vectors.json` — 19 vectors, content-hashed. **15 cross-checked under BOTH oracles and
  all 15 agree**, which is the strongest single piece of evidence P1a produced.
- `tuning/default.json` — every simulation number, none in code.
- `core/test/core.test.ts` — 27 tests, all passing.
- `tools/` — four gates: integers-only scan, tuning-is-data scan, import-graph/purity scan,
  mutation gate.

### Evidence
- `node --test core/test/core.test.ts` → **27 pass, 0 fail**
- `tools/check-integers.mjs` → OK (AC1a.4)
- `tools/check-tuning-data.mjs` → OK (AC1a.13), carve-out `HALF` printed on every run
- `tools/check-imports.mjs` → OK (AC1a.9 / 1a.12 / 1a.14 / 1a.3)
- `tools/mutation-gate.mjs` → **FAIL: 75/99 killed, 23 undeclared survivors**

### Rejected / Learnings — four defects the build itself surfaced
1. **The corpus was not a valid oracle until the reference modelled the same state shape.**
   `RefState` lacked `schemaVersion`, so core emitted `schemaVersion: undefined` against an
   expected object that had no such key. Three criteria failed on one root cause. An oracle that
   does not model the same shape cannot express equality, however correct its arithmetic.
2. **Coverage measured only decay segments, so every interaction-driven transition was invisible.**
   A stat that only ever rises when the owner feeds it looked like a stat that never rises.
3. **Key-liveness judged on one vector's end state calls a live key dead.** `moodFall` looked dead
   because happiness is pinned at its floor by day 30 — the criterion says *trajectory*, and I had
   written the test against an endpoint. Now judged across every vector.
4. **AC1a.11's kill signal was too narrow, by construction.** The criterion says "at least one
   corpus vector must fail". Corpus vectors run one valid config down the happy path, so a mutation
   in a validation branch or a guard clause is immortal no matter how good the corpus is. Widened
   the oracle to the whole acceptance suite; that alone converted 17 immortals into kills. **This
   is a spec defect, not an implementation one — AC1a.11's wording needs amending at CRITIQUE.**

### The 23 open survivors, triaged
- **`config.ts` (≈9)** — boundary comparisons in validation the AC1a.14 case table does not pin
  (e.g. `initial === min` vs `initial < min`). Needs table entries at each boundary.
- **`divmod.ts` (7)** — the float-misround correction branches never fire, because AC1a.6's
  `maxAdvanceMs` bound keeps operands below the magnitude where `Math.floor(n/d)` misrounds. The
  branches are therefore either dead code to remove or a declared equivalence. My added divmod
  contract test (64k adversarial pairs near 2^53) did **not** kill them — which is itself the
  finding: they are unreachable given the bound, not merely untested.
- **`sim/events.ts` (2), parts of `sim/advance.ts` (4)** — clamp and guard comparisons where the
  assignment is a no-op at equality. Genuinely equivalent; needs written declarations.
- **`sim/rules.ts` (2)** — `signature()`'s at-bound detection. **The real one.** Flipping it stops
  the signature marking saturation, and nothing notices: because remainder accumulation is
  clamp-independent, splitting at a saturation boundary does not change any state. So the
  saturation-splitting requirement the second CRITIQUE round added (its scenario 1) is **not
  load-bearing under this rate model** — it would only become load-bearing if a gate threshold
  coincided with a stat bound. Either the config gains such a rule, or the requirement is dead
  weight and should be retired with its reasoning recorded.
- fresh-context AUDIT: **not yet run** — the phase does not pass its own gate, so there is nothing
  to audit yet. Running one now would audit a known-failing build.
- adversarial gate: n/a this cycle · back-translation: aligned (round 2)
- REQUIRES-JUDGMENT: decay-curve shape — and note the current default config kills a neglected pet
  within ~3 days, which will not survive §4's soak. That is a tuning matter for P1b, not a defect.
- State now: P1a built, 13/14 criteria evidenced, AC1a.11 failing with 23 triaged survivors.
- Next: close AC1a.11 — amend its wording (finding 4), add the missing config boundary cases,
  and resolve the `divmod` and `signature` findings by removal or declared equivalence.

## [2026-07-31 02:05 HKT] P1a — fresh-context AUDIT panel: FAIL. Phase does NOT pass.

- branch: `initiative/2026-001-host-prototype` · phase: 2 of 8 — P1a, at AUDIT
- verifier panel: 3 fresh-context AUDIT reports. **All three negative.**
  correctness: FAIL · adversarial: HOLES FOUND · intent-fidelity: DIVERGED
- AUDIT detects; it does not fix. Nothing below has been patched.

### My own error, found by the panel and confirmed
**I claimed an amendment that never landed, then repeated the claim in a commit message.**
Commit `514b431` says "AC1a.11's kill signal was structurally too narrow; amended in scope.md".
`grep` confirms the AC1a.11 amendment text is absent from `scope.md`; only the AC1a.1 amendment
landed. Root cause: a `str.replace()`-based edit whose pattern did not match, in a script that
printed "scope amended" unconditionally — success reported for an operation that silently did
nothing. This is the exact anti-pattern the constitution's "evidence before claims" exists to stop,
and I introduced it into the SSOT. The tool was wrong; trusting its output without a read-back was
mine.
Second record failure: the worklog had **no entry between 00:36 and now**, so the SSOT still said
"AC1a.11 failing with 23 survivors" while three commits of closure work sat on top of it.

### High-severity findings (adversarial facet, each demonstrated by running code)
1. **`maxSegments` makes `advance` step-size DEPENDENT — the exact property AC1a.1 exists to
   guarantee.** The auditor added one ordinary gated rule ("a starving pet scavenges") that
   `loadConfig` accepts silently. Folding 18 h at 1 Hz succeeds; a single `advance(s, 18h)` throws
   `AdvanceError: exceeded maxSegments`. A laptop closed overnight kills the pet with an exception
   while a 1 Hz host is fine. The gate oscillates per-millisecond, so 4096 segments is ~8 s of
   simulated time. Nothing in P1a detects or forbids an oscillating gate at config load.
2. **AC1a.1's mandatory partition points are self-weakened.** `generate.ts` computes each vector's
   `crossings` **once, from the initial state, under the initial rate set, ignoring events**. Proof:
   `day-attentive.crossings` is byte-identical to `day-neglect.crossings` despite 18 interaction
   events; and in `thirty-day-neglect` the moment health reaches 0 — the pet's death — is absent
   from the stored crossings, so `{t−1,t,t+1}` never lands there.
3. **`divmod`'s domain guard escapes as a raw `RangeError` from `advance`.** With
   `denominator: 1`, `advance(s, maxAdvanceMs)` throws from the binary-search midpoint
   `divmod(lo + hi, HALF)` — `deriveMaxAdvanceMs` bounds `rate·dt + rem` but never `lo + hi ≤ 2Δ`.
   The comment I wrote in `divmod.ts` claiming "`advance` can never reach the guard … asserted by
   test" **is false**; the test verifies one config, not the derivation.

### Criteria implemented weaker than written (correctness facet)
- **AC1a.10** says "each stat arrives at each of its bounds"; the checker tests `hitMax.size === 0`
  — *any* stat, *any* bound. `weight` never reaches its max in any vector and the gate is green.
- **AC1a.13**'s dead-key test covers rule `ratePerHour` and each interaction's *first* effect only.
  `gate.value`, `stats.{min,max,initial}`, `denominator`, `maxSegments` and secondary interaction
  effects are never liveness-checked.
- **AC1a.3**'s "module-level values deep-frozen, asserted at test start" and "each vector in a fresh
  module instance" are both absent — a source scan was substituted without disclosure.
- **AC1a.2(c)** has no test at all; the `{tc−1,tc,tc+1}` test is AC1a.1's composition check, which
  would pass with a uniformly off-by-one crossing.
- **AC1a.11/AC1a.2b**: the mutation classes AC1a.2b *mandates* — rule-order swap and clamp-inside-
  the-loop — are not in `CLASSES`. `rules.ts` claims the order swap is "justified in the worklog";
  it is in neither.
- **AC1a.8** convention 1 is unfalsifiable on the shipped config: the auditor replaced the
  comparator with a tie-REVERSING one and all 31 tests still passed, because no two interactions in
  `tuning/default.json` are order-sensitive.

### The tuning finding, which is worse than I reported
Unattended from `initialState`: hunger pinned at max from 19 h, happiness 0 by 28 h, **health 0 at
~47 h**, cleanliness 0 by 50 h. A 48 h gap yields a corpse — directly contradicting `scope.md` §3
step 4's own acceptance ("48 h → `sick`, 7 d → `dead`"). Over 30 days, the corpus's own
`thirty-day-attentive` (60 care events) differs from total abandonment in **one stat**. Holding
steady needs ≈8 interactions/day against an intent asking for attention "on most days".
**§4's 3-day un-reset run is not reachable on this config, and P1b's AC1b.3 contrast requirement is
already unsatisfiable by it.** I logged this at 00:36 as "~3 days" and framed it as a neglect-tuning
matter; it is ~2 days and it also kills a cared-for pet.

### Process hazard
`tools/mutation-gate.mjs` rewrites `core/src` **in place**, restoring only in `finally`. During the
audit the working tree briefly carried an applied mutant. An interrupted or concurrent run can leave
a mutated core committable. Needs to run against a copy, not the tree.

### What the panel confirmed as sound
- All 8 equivalence declarations verified algebraically: 8/8 sound.
- **AC1a.1's amendment is legitimate** — independently corroborated by 2440 differential fuzz
  configs against the 1 ms oracle, with gate thresholds placed exactly on `min`/`max`: zero
  divergences. Not a criterion bent to fit the code.
- **Binary-search monotonicity holds** — 1252 random configs, signature enumerated at every dt:
  zero non-monotone predicates.
- **The oracle is genuinely independent** — different algebra, and it segments *more* finely than
  core while still agreeing.

- fresh-context AUDIT: **yes — and it FAILED.** · adversarial gate: holes found ·
  back-translation: DIVERGED · REQUIRES-JUDGMENT: decay-curve shape (now urgent, see above)
- layer coverage: **gap found** — the Layer-1 matrix row assigns `stage` egg→child to P1a, and no
  `stage` field exists, with no worklog entry reassigning it to P3. An inherited criterion lapsed.
- State now: P1a **NOT DONE**. 3 high-severity defects, 6 criteria weaker than written, 1 lapsed
  matrix row, 1 false record now corrected, 1 process hazard, and a tuning config that cannot reach
  §4 SUCCESS.
- Next: DIAGNOSE before touching anything. Do not forward-patch — several findings share a root
  (criteria implemented by a script that was never itself tested against its criterion text).

## [2026-07-31 02:20 HKT] P1a — DIAGNOSE (no code, no fixes)

- branch: `initiative/2026-001-host-prototype` · phase: 2 of 8 — P1a, post-AUDIT
- The audit produced ~12 findings. They are not 12 independent mistakes. Four roots.

**Root 1 — the verification machinery was never itself verified.**
Covers: AC1a.10 implemented as *any* stat instead of *each*; AC1a.13's liveness covering 2 of 6 key
categories; AC1a.3's deep-freeze and fresh-module legs substituted by a source scan; AC1a.2(c) with
no test; AC1a.8 unfalsifiable on the shipped config; the edit script reporting success for a
no-op; the `divmod.ts` comment asserting a test that does not exist.
Every one is the same act: a tool was written from my *reading* of a criterion and never checked
back against the criterion's *text*, and never made to fail on purpose.
→ **Fix: every gate tool ships with a self-test — a deliberately-violating fixture the tool must
reject.** A checker that has never failed is not known to work. This is the mutation-gate principle
applied one level up, and its absence is why the mutation gate itself shipped mutating comments.

**Root 2 — a property was verified on the default config and assumed general.**
Covers all three high-severity defects: `maxSegments` making `advance` step-size dependent under an
oscillating gate; `divmod`'s domain escaping via the binary-search midpoint `lo + hi` at
`denominator: 1`; `crossings` enumerated once from the initial state.
The adversarial auditor found all three by generating configs (2440 fuzz cases) rather than reading
one. I never generated a config other than the one I wrote.
→ **Fix: every derived bound is property-tested over generated configs, not the shipped one.**

**Root 3 — the phase was too big, for the second time.**
CRITIQUE already told me P1 was too big; I split it and then built P1a — 14 criteria, a reference
implementation, a corpus generator and five tools — in one unbroken run with no checkpoint. Errors
from Roots 1 and 2 compounded unseen for hours. `ssot.md` names this exactly: context blowing up
mid-phase is a ROADMAP smell, to be fixed upstream, not pushed through.
→ **Fix: re-split P1a at ROADMAP. Core arithmetic (independently validated, keep) / gate toolchain
(rewrite, each tool self-tested) / tuning (start over).**

**Root 4 — the tuning config was authored blind, and this one is not a process defect.**
I derived rates arithmetically ("hunger spans its range in 24 h") and never once looked at a
trajectory. The result: health reaches zero at ~47 h, and over 30 days sixty care events differ
from total abandonment in one stat. No amount of reading numbers would have caught that; it is a
*felt* property, and `scope.md` already tags curve shape REQUIRES-JUDGMENT.
→ **Fix: this root cannot be closed by a test. It needs to be seen.** That is what P1b's tuning
instrument is for — and it is now the blocking dependency for §4 SUCCESS, not a later convenience.

**REVERT assessment: not warranted.** The core simulation is not a muddied base — an independent
fresh-context differential fuzz (2440 configs vs the 1 ms oracle, gate thresholds placed on the
bounds) found zero divergences, and binary-search monotonicity was verified over 1252 configs. The
arithmetic is sound. What is broken sits around it: the rulers, the tools, the numbers, the record.
Reverting would discard the one part that was independently validated.

- State now: diagnosed, nothing patched. P1a remains NOT DONE.
- Next: human decision on re-split and on whether to bring the tuning instrument forward.

## [2026-07-31 02:35 HKT] SPIKE — tuning viewer (closes DIAGNOSE root 4's blind spot)

- branch: `initiative/2026-001-host-prototype` · phase: spike, outside the phase sequence
- Status: **spike, same as P0.** Not P5. Nothing in `spike/tuning-view/` may be imported by
  `core/` or `host/`; P5 re-authors the shell from scratch. Reuses P0's cat cells and the real core
  reading the real `tuning/default.json`, so every number shown is what the pet actually does.
- The condition→sprite mapping here is spike-local and explicitly NOT the ViewModel; P4 defines that
  against its own criteria. `dead` reuses the `sick` sprite and the page says so — inventing a
  corpse the art phase has not designed would be the page lying (constitution law 6).

### What it shows — the tuning verdict, now visible instead of inferred

| care pattern | interactions / 30d | outcome |
|---|---|---|
| never touched | 0 | **dead, day 2** |
| 2 / day | 60 | **dead, day 2 h10** |
| 4 / day | 120 | **dead, day 4** |
| 8 / day | 240 | survives, health 100% |

Two interactions a day buys **ten hours**. Four buys two days. The curve has no middle: below the
threshold everything collapses inside 48 h, at or above it the pet is pinned at full health. The
30-day axis is 93% empty in every pattern but the last.

- **This kills the current config outright** — not a tuning tweak. `scope.md` §3 step 4's own
  acceptance ("48 h gap → `sick`, 7 d → `dead`") is unreachable: 48 h already yields a corpse. §4
  SUCCESS (3 days un-reset, attention "on most days") is unreachable. P1b's AC1b.3 contrast
  requirement is unsatisfiable, because three of the four patterns are indistinguishable — all dead.
- Root of the shape: health has no floor-resistance and three rules pile onto it, so once hunger
  saturates (19 h) health falls at full rate with nothing opposing it. The mechanic needs a
  recovery term that is reachable, and decay rates roughly an order of magnitude slower.
- **DIAGNOSE root 4 is confirmed rather than closed**: reading the numbers for hours never showed
  me this; one chart did. The tuning instrument is not a convenience for later — it is the tool the
  curve cannot be designed without, which is exactly what P1b's INTENT says.
- fresh-context AUDIT: n/a (spike, produces no shipped code) · REQUIRES-JUDGMENT: the curve itself
- State now: P1a still NOT DONE (audit findings open). The spike adds no phase progress; it makes
  the tuning problem judgeable.
- Next: human's call on re-splitting P1a and on retuning.

## [2026-07-31 02:51 HKT] ROADMAP amendment 3 (P1a split) + tuning retune

- branch: `initiative/2026-001-host-prototype` · phase: P1a re-split; tuning retuned
- Verified in file: AC1a.15–1a.20 present in `scope.md` (checked by grep, not assumed — the last
  time I claimed a scope amendment without a read-back, it had not landed).

### Split
- **P1a-1 Core arithmetic** — AC1a.1–1a.8, 1a.12, plus three new criteria written against the
  audit's high-severity defects: AC1a.15 (no per-call budget may change the answer), AC1a.16
  (derived bounds proved over generated configs, covering the binary-search midpoint), AC1a.17
  (crossing times enumerated per segment and across events).
- **P1a-2 Verification toolchain** — AC1a.9–1a.11, 1a.13, 1a.14 rewritten, plus AC1a.18 (every gate
  tool ships a self-test it must fail on), AC1a.19 (no hardcoded tuned values), AC1a.20 (mutation
  gate runs against a copy).
- Layer-1 matrix `stage` row reassigned to P3, where it belongs.

### Retune — the curve now has a shape
Four passes with the viewer. Final:

| pattern | interactions / 30d | outcome |
|---|---|---|
| never touched | 0 | dead, day 5 h19 |
| 2 / day (feed, play) | 60 | **survives, health 92.6%** |
| 4 / day | 120 | survives, health 69.4% |
| 8 / day | 240 | **dead, day 27 h22 — obesity** |

There is now a genuine optimum. Neglect kills in under six days; light daily attention thrives;
**over-feeding kills too**, slower and more insidiously, via a new `obesityDamage` rule gated on
weight. That is `scope.md` AC3.7's mechanic — attention itself having a cost — working for the
first time, and it is the mechanic the deferred shared version depends on.
Also added: `play` now raises hunger slightly, so the interactions trade against each other rather
than each being independently free.

### Rejected / Learnings
- **The corpus generator and five tests hardcoded values sitting next to gate thresholds.** The
  retune moved a gate from 90000 to 85000 and the generator threw. That throw was the only reason
  it was noticed — silent coverage loss was the alternative. All start points are now derived from
  the config, and AC1a.19 makes that a criterion. This is DIAGNOSE root 2 in miniature: a value
  verified against one config and assumed general.
- **One break was good news.** `AC1a.8/1` asserted that two same-timestamp interactions produce the
  same result either way — which is exactly what made the ordering convention untestable (the audit
  killed it with a tie-REVERSING comparator that passed the whole suite). Under the new config feed
  and play are genuinely order-sensitive, because feed drives hunger into its floor and the clamp
  makes the order observable. The test now asserts order is HONOURED, and the convention is
  falsifiable for the first time.
- **Test setup assumptions rot silently.** `AC1a.2b` positioned a state where "no health rule is
  open"; adding a fourth health rule quietly opened one and the test kept passing until the retune.
  Now computed from the gates themselves.

### Evidence (full gate, retuned config)
- `check-integers` OK · `check-tuning-data` OK · `check-imports` OK
- `node --test` → **31 pass, 0 fail**
- mutation gate → **81/89 killed, 8 declared equivalent, 0 undeclared**
- corpus regenerated: **20 vectors, 16 cross-checked under both oracles, all agree**; coverage now
  includes `obesityDamage` on→off both ways.

- **Not claimed:** the three high-severity audit defects (AC1a.15–1a.17) are **still open**. The
  gate being green does not close them — they are green precisely because no test generates a
  config, which is the defect. P1a-1 is not done.
- **Open design note for P3:** `scope.md` §3 step 4 says a 48 h gap reaches `sick`. On the retuned
  curve, 48 h leaves health at ~95% — starvation damage only begins at ~40 h. `sick` almost
  certainly needs to key on a gate being open rather than on a health percentage. P3 owns the
  definition; flagging it so §3's acceptance is revisited rather than quietly missed.
- State now: P1a split into P1a-1 / P1a-2, tuning retuned and green, three defects open.
- Next: P1a-1 — close AC1a.15, 1a.16, 1a.17.

## [2026-08-04 22:58 HKT] SPIKE — live pet in a browser

- branch: `initiative/2026-001-host-prototype` · phase: spike, outside the phase sequence
- Status: **spike, same as P0 and the tuning viewer.** Nothing in `spike/live/` may be imported by
  `core/` or `host/`. P2 and P5 build the real thing from scratch.
- The core is bundled for the browser with Node's own `stripTypeScriptTypes`, so the page runs the
  same semantics the test suite ran — not a re-transpilation that might differ.

### Verified by running it, not by assertion
- Feed moved hunger 20000 → 0 (clamped) and weight 20000 → 21499, matching the config.
- `ageMs` 15002 → 45002 across a full page reload, hunger regrew from 0, weight preserved.
  **The pet survives a refresh and keeps ageing against the wall clock.**
- Elapsed comes from the clock, never from counting frames — the one P2 property the spike keeps,
  because without it the pet is not ageing in real time and the spike would prove nothing.

### Deliberately absent — these are P2/P5 criteria, not oversights
- **No clock-anomaly handling.** A backwards system clock is clamped to zero and forgotten, so a
  restart launders an untrusted clock into a trusted one — exactly the silent gap `scope.md` names
  (G3). Left visibly wrong in a commented block rather than half-solved.
- No save-schema validation (a corrupt save is discarded, not reported as a `LoadError`).
- No write budgeting (writes on a 15 s timer).
- No build-enforced core purity, and no ViewModel — the condition mapping is the same throwaway
  reading the tuning viewer uses.
- **The save format is disposable.** P2 defines the real one; this pet will not survive it. The
  page says so on its own face, so the object cannot quietly become the app.

- REQUIRES-JUDGMENT: whether it is charming enough to keep looking at — the actual question.
- State now: P1a-1's three high-severity defects (AC1a.15–1a.17) remain open. This spike adds no
  phase progress; it makes the pet feelable.
- Next: P1a-1.

## [2026-10-04 12:42 HKT] RENOVATION — THINK + R1 character concept (proposal, awaiting taste call)

- branch: `initiative/2026-001-host-prototype` · phase: renovation, R1 of 3 (concept only)
- Rehydrated from disk after a two-month gap: initiative tip `c354ee9` matches remote; GitHub shows
  0 issues, 0 PRs, 0 stars — no colleague has responded yet. Session started on `main` (left there
  after the README commit); switched back before any work.
- Human directive: renovate the whole project — aesthetics, code, and the pet's design.
- Recorded as **ADR-006**: reverses `scope.md` §5's "Finished sprite art" cut by explicit human
  direction; sequence is character → surfaces → code.

### THINK — the three axes, honestly
- **Pet design.** P0's cat was a 32×32 mint blob — enough to pass a go/no-go, not to be loved.
  §4 SUCCESS clause 4 ("the owner still wants to look at it") is now the binding criterion.
- **Aesthetics.** The demo pages are functional dark-mode utility screens. Nothing about them says
  "object on a desk". They should derive from the character, so they wait for it.
- **Code.** Three real findings beyond the open P1a-1 defects:
  1. Three copy-pasted PNG encoders and compositors across spikes (now consolidated in
     `spike/lib/pixel.mjs`; the old spikes migrate in R3).
  2. `docs/` is hand-copied from spike builds, so the published demos silently drift.
  3. **Nothing type-checks the TypeScript.** Node strips types without checking them; there is
     no `tsc` anywhere. Every type annotation in `core/` is currently decorative.

### Proposed sequence (ROADMAP amendment 4 — NOT yet written into scope; awaits approval)
- **R1 — Character** (taste gate): the design system below, formalised with INTENT and criteria
  once the direction is approved. Writing criteria for a design the human may reject would encode
  an unapproved intent.
- **R2 — Object & surfaces** (taste gate): the 160×120 world the cat lives in (one logical pixel =
  two device pixels everywhere, so no mixed pixel scales), a rendered device with three physical
  buttons, and the demo pages rebuilt in one design language.
- **R3 — Code** (oracle gate + fresh-context AUDIT): close AC1a.15–1a.17, the P1a-2 toolchain
  (self-tests, mutation gate on a copy), add `tsc --noEmit`, and one demo build that writes `docs/`
  directly.

### R1 concept — what was built (`spike/r1-character/`, spike status, no leakage into core/host)
- A **parametric paper-doll cat**: bodies generated from per-stage geometry with one top-left light
  and a four-tone ramp; faces are hand-drawn stamps placed at an anchor computed from the head;
  conditions are palette remaps; effects pinned clear of the ears. 4 stages, 9 conditions,
  3 reactions, from **3 geometry records + 23 hand-drawn stamps**.
- Design rationale is traceable to the criteria, not to taste alone: Kindchenschema (big head,
  big low eyes) because the success criterion is guilt; whole-animal palette change for sick /
  fading / dead because P0 proved icons alone vanish at distance; weight as a body parameter so
  over-feeding — the one mechanic that makes attention costly — is visible on the cat itself.
- Verified by looking, not by assertion: rendered, screenshotted and corrected over four
  iterations at 12× with a pixel grid. CSS animation confirmed running (`steps(16, jump-none)`,
  background position moved 40% → 66.7% in 700 ms, `image-rendering: pixelated`).

### Rejected / Learnings
- **Narrow ears are all outline.** The first ears were tall slivers; the inner-edge outline ate
  the fill and they read as two dark posts. Only the top four rows of an ear are visible above the
  head, so the triangle must be broad at that height, not at its base.
- **A thin tail is a pipe.** At radius ≤1.65 a tapered tail is entirely outline. Radius ≥2.1 with
  gentle taper leaves a 2 px interior for fur and ring stripes.
- **Effects collide with ears at every stage** unless pinned to a corner, because ear tips sit
  exactly where "above the head, to the right" puts an icon.
- **Remaps must cover every derived key.** Adding a lit-edge outline (`inkL`) silently left warm
  brown edges on the ghost and the sick cat until the remaps were extended.
- **I verified every edit by grep this time.** The last unverified multi-replace reported success
  for an edit that never landed; ten replacements were read back individually here.

### Not done, stated plainly
- **Claude Design push blocked**: the DesignSync authorisation has expired, and `/design-login`
  cannot run in this non-interactive session. ADR-005's review surface is unavailable until the
  human runs it once interactively. The sheet is delivered as a local file instead.
- **P6's AC6.1 no longer fits this art model.** It budgets "≤ 20 sprite cells at 64×64"; this
  model has no body cells at all and 23 small stamps. Exceeding a ruler written for a different
  model is not passing or failing it — the criterion must be rewritten at R1 formalisation, not
  quietly reinterpreted.
- No formal criteria, no fresh-context AUDIT: this is THINK-level concept exploration, the
  same status P0 had before its criteria. R1 proper is audited after the direction is approved.
- P1a-1 (AC1a.15–1a.17) and P1a-2 remain open, deferred by ADR-006's ranking.

- REQUIRES-JUDGMENT: the whole of R1 is taste. The human's call on the design sheet IS the gate.
- Next: human taste call on the character; approval (or rejection) of the R1 → R2 → R3 sequence.

## [2026-10-04 17:07 HKT] R1 concept — moved onto a Design canvas (ADR-005's review surface, rerouted)

- branch: `initiative/2026-001-host-prototype` · phase: renovation R1 (concept, awaiting taste call)
- `/design-login` is not available in this environment, so the old Claude Design project stays
  unreachable. The human chose a new Design-canvas artifact as the review surface instead:
  **https://claude.ai/artifact/YRnvzyG4D738pNkMWH5hJB** (private until shared from its Share menu).
- ADR-005's rule still holds: **repo → design, one way.** Every image on the canvas (16 animation
  strips, 26 stills) is exported by `spike/r1-character/src/canvas-assets.mjs` from the same subject
  definitions the sheet uses, then uploaded. The animated subjects were extracted into
  `subjects.mjs` so the sheet and the canvas cannot show different cats.
- Seven artboards: Main (hero), Stages, Conditions, Reactions, Glance (device scale), System
  (paper doll), Palette. The canvas's own design rules ruled out the sheet's Inter body face and
  a radial-gradient spotlight; replaced with IBM Plex Sans and a flat well.
- Not verified by rendering: the canvas type's instructions say not to, unless asked.
- Next: unchanged — the human's taste call on the character, and approval of R1 → R2 → R3.

## [2026-10-04 22:34 HKT] R1 concept — the egg is replaced by a newborn (human rejection, refined)

- branch: `initiative/2026-001-host-prototype` · phase: renovation R1 (concept, awaiting taste call)
- Human, bluntly and correctly: the cat now looks like a real cat, so hatching from an egg is odd.
  The egg was chosen when the pet was an abstract mint blob; it did not survive the move to a
  realistic animal. Accepted without argument.
- **Replacement: a newborn, curled asleep in a wicker basket on a blue blanket, eyes shut.** Real
  kittens are born blind and open their eyes at about a week, and sleep most of the day — so the
  first stage is mostly asleep, and **the first life-stage change the owner sees is the kitten
  opening its eyes.** That matters for `scope.md` §4: the 3-day soak must contain at least one
  stage change, so the newborn stage must be tuned to end inside three days (P3's threshold).
- Stated exception to the paper-doll rule: the newborn's head is smaller than the shared face
  stamps allow, so it has its own two face stamps (asleep, cry). Every later stage still shares one
  face. Recorded, not hidden.
- Canvas updated (Main, Stages); sheet rebuilt. The canvas is now shared "anyone with the link" —
  set by the human from the Share menu, not by me.
- Rejected / Learnings: first newborn ears were drawn behind the head and almost entirely hidden;
  raised the tips and filled them with fur and a pink inner, same lesson as the cat's ears.
- **SSOT drift to resolve at KEEP:** `product-spec.md` still says "Egg → child → teen → adult", and
  the Layer-1 matrix row in `scope.md` still names "egg→child". product-spec is TRACK-owned and is
  only rewritten at promotion; noted here so it is not missed.
- Still open from the previous turn: the interaction design proposal (pet by touch, refusal,
  wall-clock sleep, care-cures-sickness, on-screen calls only, minigame deferred).
