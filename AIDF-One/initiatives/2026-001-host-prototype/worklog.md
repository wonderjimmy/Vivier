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
