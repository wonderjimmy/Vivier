# Vivier — agent loader

This project runs on **AIDF-One**. Invoke the `aidf-one` skill at the start of any working session;
it carries the method (TRACK / CRAFT / SSOT rules, templates). **Do not restate the method here.**

## Reading order (rehydrate from these, never from a handover summary)

1. `AIDF-One/constitution.md` — engineering law + the six vertical layers
2. `AIDF-One/product-spec.md` — evergreen product scope SSOT
3. `AIDF-One/initiatives/<current>/scope.md` — the in-flight initiative's contract
4. `AIDF-One/initiatives/<current>/worklog.md` — where we are, what failed
5. `AIDF-One/decisions.md` — ADR-lite, why things are the way they are

Past initiatives are archive. Load on demand, not by default.

## Operational facts

- Timestamps: `YYYY-MM-DD HH:MM HKT` (UTC+8), fetched via CLI `date`. Never fabricate.
- Git: branch-per-initiative (`initiative/<id>`), cut at kickoff, merged at initiative-close.
  Integration branch is `main`. One branch, one open initiative.
- Expert command (TRACK-THINK cross-lineage advice): none configured — THINK runs solo and
  notes "expert unavailable" in the worklog.
