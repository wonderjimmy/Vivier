# Decisions

> ADR-lite, append-only. Rationale for why things are the way they are, and what superseded what.
> Proposed at TRACK-THINK, promoted here on approval. The investigation that produced each one lives
> in the initiative's `worklog.md`.

## ADR-001 — TypeScript core with a language-independent golden-vector corpus   (2026-07-30 22:46 HKT)

- Context: the simulation core must be pure and portable enough to serve a browser build now and an
  ESP32-S3 build later, from one definition of the simulation's semantics.
- Decision: write the core in TypeScript. Bound the future port cost with a frozen corpus of golden
  vectors — JSON fixtures of `(initial state, seed, event list) → expected end state` — which any
  future implementation in any language must pass. **The corpus, not a shared binary, is the single
  source of truth for the simulation's semantics.** It survives a language change; a shared binary
  does not.
- Alternatives rejected: C++17 core + Emscripten/WASM; Rust + `wasm-bindgen`/`esp-hal`. Both give a
  genuinely shared core and both pay that cost *now*, against a device that `scope.md` §4 explicitly
  sanctions never buying — while slowing the tuning loop `project-intent.md` §9 requires be cheap.
  Neither avoids a two-language project either: render, input and persistence would be TS regardless.
- Rider: the corpus is a P1 deliverable. Without it this decision is the wrong one.
- supersedes: none

## ADR-002 — no floating point in the core; fixed-point integers only   (2026-07-30 22:46 HKT)

- Context: constitution law 3 requires deterministic replay across implementations.
- Decision: stats are integer milli-units; decay is integer arithmetic over integer milliseconds; no
  float literal and no division yielding a non-integer appears in the core. The seeded PRNG is a
  small integer generator written in-tree, not a dependency, so two implementations match bit-for-bit.
- Alternatives rejected: IEEE-754 doubles (TypeScript's native number). The ESP32-S3 FPU is
  single-precision, so doubles are software-emulated — the device build would either diverge from the
  host or crawl. Divergence breaks law 3 outright. Integers also make golden vectors byte-comparable
  rather than epsilon-comparable.
- supersedes: none

## ADR-003 — need/expression states compose as overlays over per-stage base sprites   (2026-07-30 22:46 HKT)

- Context: art is the scarcest resource in the project. Four life stages × eight condition states
  drawn independently is ~48 cells; drawn compositionally it is ~16.
- Decision: a condition is `{stage, pose, overlays[]}`, never a flat sprite id. Overlay ids are drawn
  from a stage-independent set. Art cost is therefore additive in stages, not multiplicative.
- Consequence discovered at P0 (validated, not theoretical): overlays can only **add** pixels, never
  subtract. Changing the base's open eyes or neutral mouth requires painting body colour over them
  first, so an overlay is implicitly tied to a body colour. And the base's **face anchors — eye and
  mouth positions — must be identical across every frame and every stage**, or each face-touching
  overlay multiplies back out into per-frame variants and the whole saving is lost.
- Alternatives rejected: one flat sprite per (stage, condition) pair. Simpler renderer, unaffordable
  art budget.
- supersedes: none

## ADR-004 — age in absentia, but death requires a witnessed live tick   (2026-07-30 22:46 HKT)

- Context: the pet must age while unobserved (the product's north-star), yet an outage killing a
  three-week-old pet is the fastest route to the device being put in a drawer.
- Decision: decay applies fully across an unobserved gap, but the terminal transition to `dead` is
  reachable only from a live tick — never from gap resolution. Returning to a pet at death's door is
  the intended beat.
- Rationale: guilt requires the consequence be *attributable*. Neglect you watched happen produces
  guilt; a power cut that killed it produces a bug feeling. Guilt is the stated success criterion.
- Alternatives rejected: pausing while unobserved (makes it a save file, not a pet); unrestricted
  death in absentia (the drawer risk).
- supersedes: none

## ADR-005 — sprite vocabulary explored and reviewed in Claude Design, authored in-repo   (2026-07-30 22:46 HKT)

- Context: the glance-readability criterion has no mechanical check and needs a real review surface,
  and ADR-003's additive cost only holds if the overlay structure survives contact with actual
  pixels — which is a thing that has to be looked at.
- Decision: the repo's asset manifest and cells are the SSOT. Candidate designs are generated as
  preview cards and pushed to a dedicated Claude Design project, judged there, and iterated;
  the winning vocabulary is then authored into the repo manifest. **Sync direction is strictly
  repo → Design, never the reverse.** Claude Design hosts and renders candidates; it does not draw.
- Rationale for the one-way rule: a two-way sync would put the asset SSOT behind a login and make the
  build depend on a network artifact.
- Note: the zero-network hard constraint governs the prototype's *runtime*, not the dev workflow.
  Pushing a preview bundle at author time does not breach it.
- Risk accepted: a design-system surface invites component proliferation. Mitigated by asserting the
  art budget against the repo manifest, never against the Design project.
- Alternatives rejected: authoring inside the Design project (SSOT behind a login); no review surface
  at all (leaves the criterion that decides the hardware purchase with no mechanism).
- supersedes: none

## ADR-006 — "Finished sprite art" is back in scope; renovation leads with the character   (2026-10-04 12:42 HKT)

- Context: `scope.md` §5 cut finished sprite art from this initiative: it was to buy only the
  minimum readable vocabulary. Three spikes have since shown the mechanics work (dual-oracle core,
  a tuned curve with a real optimum, a pet that lives in a browser). The human has directed a
  renovation of the whole project — aesthetics, code, and the pet's design.
- Decision: the §5 cut is **reversed by explicit human direction**, recorded here so it reads as a
  decision and not as scope creep. The renovation is sequenced **character → surfaces → code**,
  because the page and device aesthetics derive from the character's palette and silhouette, and
  because `scope.md` §4 SUCCESS clause 4 — "the owner still wants to look at it" — is the
  criterion now binding, and it is a question of charm, not arithmetic.
- Ranked by aim, not by age of the open item: the three open P1a-1 defects (AC1a.15–1a.17) do not
  bite on the shipped config; they bite on configs nobody runs yet. They are deferred, not dropped.
- Alternatives rejected: (a) code first — the defects don't touch the north-star on the shipped
  config, and design is the input everything visual depends on; (b) a new initiative — the
  renovation serves this initiative's own SUCCESS moment, and a second open initiative would break
  one-branch-one-initiative while 001 is unfinished.
- supersedes: the "Finished sprite art" row of `scope.md` §5 (annotated in place, not deleted)
