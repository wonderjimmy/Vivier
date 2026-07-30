# Project Intent — Vivier

> **Not an SSOT.** Frozen, human-authored pre-flight input, recorded verbatim so later sessions read
> the original rather than a summary of it (Rule 2). Scope is *derived* from this via the rejection
> funnel; `product-spec.md` / `scope.md` are the authorities once written.
> authored: 2026-07-30 21:25 HKT · recorded: 2026-07-30 21:31 HKT

Status: raw pre-flight input for AIDF-One. NOT a scope.md, NOT a product-spec.md. This document is
the human-authored intent that TRACK/THINK investigates against. Scope is to be derived from this
via the rejection funnel — deliberately over-scoped in §6 so it can be cut down.

## 1. One-line intent

A desktop electronic pet — a Tamagotchi in spirit — that lives on my desk as an always-on object,
ages in real time, and degrades if ignored.

## 2. Why this, why now

Two honest motivations, in order of weight:

1. A physical, finished, non-monetised object. Trading systems and frameworks are abstract and never
   "done". This one has an off-ramp: it either sits on the desk and works, or it doesn't.
2. A de-risking probe for a larger idea. The real idea is a shared pet on an office display,
   co-raised by many people via staff-card taps — a tragedy-of-the-commons simulator disguised as a
   toy. That version is blocked on InfoSec/PDPO approval and on an unvalidated NFC assumption. The
   desk version answers the questions that don't need approval: is the decay curve tuned right, are
   the interactions actually charming, does anyone keep looking at it after week two.

The desk version must stand alone as a finished thing. It is not a prototype waiting for permission.

## 3. Operator persona

Me. Single owner, single pet, single device on a desk at home or at work. No accounts, no cloud, no
other users in v1.

## 4. What "working" would look like

The pet has been alive and un-reset for 30 consecutive days, I have voluntarily interacted with it
on most of those days without a reminder, and at least once I have felt mildly guilty about
neglecting it.

That last clause is the actual success criterion. Everything else is plumbing.

## 5. Known constraints and priors (from prior analysis — to be challenged by THINK, not assumed correct)

- Hardware target: integrated ESP32-S3 board with bonded 2.8" 320×240 capacitive touch LCD (e.g.
  Waveshare ESP32-S3-Touch-LCD-2.8 class). Chosen for instant-on, power-cycle tolerance, no thermal
  issue, zero soldering. Not a Pi (boot time, SD-card corruption on power loss, heat).
- Small screen is a feature, not a compromise. 320×240 at 4× scale means 64×64 sprites. Art is the
  real bottleneck of this project; a larger panel multiplies art cost without improving the object.
- Simulation core must be pure and host-testable. Pet state machine, decay, and event resolution as
  pure logic with no rendering or hardware dependency, unit-testable on desktop. This is the one
  architectural non-negotiable — it is what makes both the browser prototype and any future shared
  version possible from one codebase.
- Time is the hidden hard problem. ESP32-S3 has no battery-backed RTC. Without a trusted wall clock
  across power cycles, the ageing loop is fictional. NTP over WiFi or an external RTC module — must
  be resolved in phase 1, not deferred.
- Persistence: state to NVS flash. Flash has finite write endurance; per-tick writes are
  unacceptable. Needs a debounced flush plus immediate writes on significant events.
- Input: physical buttons preferred over touch (tactility is core to the nostalgia, and 2.8" touch
  targets invite mis-taps). Open question, not decided.

## 6. Candidate scope — DELIBERATELY OVER-SCOPED

Everything below is a candidate. Expect most of it to be cut. Cuts and their rationale go to
`scope.md` §5 Out-of-Scope or to `decisions.md`.

- Browser-based simulation prototype (no hardware) to tune decay curves before buying anything
- Core stats: hunger, happiness, health, weight, age, cleanliness
- Life stages: egg → child → teen → adult, with visual change per stage
- Interactions: feed, play, pet, clean, discipline, tease
- Weight system: overfeeding causes obesity, obesity causes illness
- Sleep cycle tied to real wall-clock time
- Illness and death states
- Reincarnation / new-egg cycle after death
- Memorial record of past pets
- Personality drift based on interaction history (frequent play → playful adult)
- Idle animations and micro-events for ambient charm
- Sound / buzzer feedback
- Local web server on the ESP32 for phone-based interaction
- Physical enclosure (3D-printed or repurposed photo frame)
- Multi-user card-tap interaction (explicitly deferred — see §7)

## 7. Deliberate non-goals for this project

- The office / shared installation. Different product, different risk profile, requires InfoSec and
  physical-security sign-off, and depends on an unvalidated assumption (that corporate DESFire
  badges expose a stable UID rather than a random one). Not in this project's scope. The only
  obligation this project has toward it is not to architect in a way that forecloses it — hence the
  pure simulation core.
- Cloud services, user accounts, telemetry, any network dependency beyond NTP.
- Battery operation. Mains-powered desk object.
- App-store mobile app.
- Any monetisation, distribution, or open-sourcing consideration in v1.

## 8. Open questions for THINK

1. Does the ageing model survive power loss and multi-day unplugged periods gracefully, and what
   should happen — pause, or age in absentia?
2. Buttons or touch? What does the interaction actually feel like at 2.8"?
3. What is the minimum sprite set that still reads as alive? (Direct proxy for whether this project
   ships at all.)
4. Is death in a single-owner context desirable, or does it just cause the device to be put in a
   drawer?
5. Where is the boundary between the pure sim core and the render/HAL layer, precisely enough that
   the core can be unit-tested with a fake clock?
6. What is the browser prototype's exit criterion — i.e. what must be true before any hardware is
   purchased?

## 9. Sequencing bias

Software before hardware. The browser prototype exists to make the decay curve and the interaction
set cheap to iterate. No hardware is to be purchased until the prototype has been run continuously
for at least three days and I still want to look at it.
