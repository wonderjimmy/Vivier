# Product Spec — Vivier

> Global scope SSOT: what the product IS and who it's for. Grows as initiatives are promoted.
> version: 1 · updated: 2026-07-30 21:31 HKT

## USER

**The owner-caretaker.** One person, who is also the builder. They keep the object on their desk at
home or at work, are its only carer, and have no obligation to it — no reminders, no notifications,
no streak counter. Nothing makes them look at it except wanting to.

There is no second user, no guest, no operator/admin split. A feature that only makes sense with two
people in the room is out of scope by construction.

## PROBLEM

1. **Nothing this builder makes is ever finished.** Trading systems and frameworks are abstract and
   have no terminal state. There is no object that is simply *done* and sitting there working.
2. **The interesting questions about a co-raised pet cannot be answered by thinking about them.**
   Is a decay curve tuned so neglect *stings* without becoming a chore? Are the interactions
   charming enough to survive week two? Both are empirical, both need a real pet that has actually
   been alive for weeks, and neither needs the approvals the shared version is blocked on.
3. **A pet that cannot be neglected cannot be cared for.** Software companions typically wait
   patiently and forgive instantly. Nothing is at stake, so nothing is felt.

## VISION / north-star

An always-on object that is convincingly alive: it ages while you are not looking, it visibly
degrades when ignored, and its state at any moment is the honest consequence of how you have
actually treated it. **Winning is felt, not measured — the owner feels guilty about neglecting it
at least once, voluntarily.** Everything else is plumbing.

Secondary and strictly non-blocking: the product is architected so a future many-carer version is
not foreclosed. It is never architected *for* that version.

## GOLDEN PATH (end-to-end journey)

1. **Power on** — the pet is exactly where it was left, aged by the real time that actually passed.
   *(→ Continuity & Time)*
2. **Glance** — its condition is legible in about a second, with no input. *(→ Ambient Presence)*
3. **Notice** it needs something, because it is showing it, not announcing it. *(→ Needs Simulation)*
4. **Interact** — feed, play, clean — and get an immediate, distinct reaction. *(→ Interaction)*
5. **Walk away** — it keeps ageing and drifting with no one watching. *(→ Needs Simulation)*
6. **Return to consequence** — a neglected day is visible on the pet, not in a log.
   *(→ Consequence)*
7. **Live with it long enough** that it becomes something else — a life stage change earned by
   elapsed time. *(→ Life Cycle)*

## Feature areas

### Needs Simulation — status: proposed
The pet has needs that decay in real time and resolve against interactions. Deterministic: the same
history always produces the same pet.
- acceptance: a 30-day history replays to an identical pet, twice.

### Continuity & Time — status: proposed
The pet's age and condition track real wall-clock time, including across shutdowns, power loss, and
multi-day absences — and it never quietly pretends time it cannot account for.
- acceptance: closed for N hours, it reopens N hours older; an untrustworthy clock is surfaced, not
  guessed at.

### Interaction — status: proposed
A small set of direct, physical-feeling actions the owner takes on the pet, each with an immediate
legible reaction and a real state consequence — including consequences for *over*-doing it.
- acceptance: every interaction changes the pet's state and looks different from every other one.

### Ambient Presence — status: proposed
What the object does when nobody is doing anything: idle motion, micro-events, a readable silhouette
at a glance. This is the feature that decides whether it survives week two.
- acceptance: the owner can name the pet's condition from across the desk without touching it.

### Life Cycle — status: proposed
Egg → child → teen → adult, plus illness and death. Ageing has a visible payoff; neglect has a
terminal one.
- acceptance: sustained neglect reaches illness and then death on a tuned, non-arbitrary schedule.

### Consequence & Memory — status: proposed
The pet is shaped by its own history, not just its current stats — personality drift, and a record
of pets that came before.
- acceptance: two pets raised differently for the same duration are distinguishable.

### Device Embodiment — status: proposed (gated)
The object leaves the screen: dedicated always-on hardware on the desk with its own display and
physical input. **Gated** — no hardware is committed until a host build has proven the decay curve
and interaction set are worth embodying.
- acceptance: it sits on the desk, survives being unplugged, and needs no computer.

## OUT OF SCOPE

Durable product boundaries. These do not become in-scope by being easy.

- **The shared / office installation.** Many carers, card taps, a wall display. Different product,
  different risk profile, blocked on InfoSec/PDPO and an unvalidated badge-UID assumption. The only
  obligation this product carries toward it is a pure core that does not foreclose it.
- **Cloud, accounts, telemetry, remote sync, any network dependency** beyond time synchronisation.
- **Battery operation.** Mains-powered desk object.
- **Mobile / app-store app.**
- **Monetisation, distribution, packaging for others, open-sourcing.** Non-goals in v1, and no
  design compromise is to be made in anticipation of them.
- **More than one living pet at a time.** One owner, one pet.
- **Reminders, notifications, streaks, gamified nagging.** Voluntary attention is the measurement;
  prompting it destroys the experiment.

## HARD CONSTRAINTS (product-wide)

- **Single owner, single pet, single device.** No multi-user affordance anywhere in the design.
- **The simulation core is pure and portable** (`constitution.md` law 1–3). Any target — browser,
  device, future shared version — is a consumer of the same core.
- **Display budget: 320×240 logical, 64×64 sprites.** Small screen is a chosen constraint, not a
  compromise. Art is the scarcest resource in this project; anything that multiplies art cost
  without improving the object is rejected on those grounds alone.
- **The target hardware has no battery-backed real-time clock.** Time must be acquired and its
  trustworthiness represented explicitly.
- **The product must be finishable.** It has an off-ramp: it either sits on the desk and works, or
  it doesn't. No roadmap that has no end.
