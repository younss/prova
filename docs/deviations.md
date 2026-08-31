# Deviations from the spec

> Spec §9, deliverable #3: "the explicit list of every deviation from this spec, with
> justification." Source of truth remains `spec/spec-repetiteur-flux-de-valeur.md` — this file
> documents where the implementation departed from a literal reading of it, and why. It
> complements (does not replace) `docs/plan.md` §2's decision log, which records the same
> reasoning at the point each decision was made.

## 1. Ambiguities the spec left open, resolved during implementation

The spec doesn't specify these; nothing here contradicts it, but each is a real interpretation
choice a different implementer could have made differently.

| # | Spec gap | What we built | Justification |
|---|---|---|---|
| E1 target | §3 says a non-responding expert "escalade automatique" but not to whom, or what changes | Escalates the targeted case straight to the Supervisor at step 7, skipping steps 5/6. The Supervisor gets a distinct "manual call" UI (set the amount, approve) with **no four-eyes check** — there is no analyst-of-record to separate the approver from, and the audit entry says so explicitly. | A supervisor is the only role above the analyst in this scenario, so escalation has one natural destination. Skipping four-eyes here is a deliberate, logged exception rather than a silently weakened control — matching H3's premise that compliance-relevant deviations should be visible, not hidden. |
| E2 target | §3 says illegible documents cause "une boucle de retouche vers le client," but not from which step(s), or whether the case restarts at step 1 or a distinct state | Only injectable while a case is at `evaluation` (step 4) — the step where the analyst is actually looking at the client's documents. Moves the case to a new `waiting-on-client` step, not literally back to `declaration`; the client's "resubmit" action then re-enters the normal step-1 path and re-chains through triage/coverage-check. | Restricting to `evaluation` keeps the exception meaningful (the analyst caught the problem) without adding a transition from every step "just in case." A distinct waiting state (rather than a raw reset to `declaration`) preserves the case's original audit history instead of appearing to erase it — directly relevant to H3. |
| E3 mechanics | §3 says "8 dossiers arrivent d'un coup," but not whether they're created pre-formed at step 4 or go through the normal intake path | Cases are generated through the exact same `declareCase()` path as "Nouveau dossier," auto-chained through triage/coverage-check like any organic case — **except** coverage-check is forced valid for these 8 specifically, so none of them can auto-reject before reaching the queue. | AC4 states the 8 cases must appear in the analyst's queue; the normal coverage-check draw has an ~15% chance of auto-rejecting a case, which could otherwise silently shrink the spike below 8. Forcing only coverage (not complexity) keeps the spike as close as possible to "8 ordinary cases," while still satisfying the acceptance criterion exactly. |
| Threshold/duration ownership scope (§7) | §7 asks for a "single, isolated" declarative structure but doesn't say whether Phase 1 needs the real water-damage content or just the schema | Phase 1 shipped schema-only; the real 8-step scenario, decision rules, and exceptions landed in Phase 2 (`src/scenarios/waterDamage.ts`) | §7's stated reason for isolation is proving the engine is scenario-agnostic — that's demonstrable with a schema and a dummy 2–3 step fixture; the real content doesn't need to exist yet to prove it. |

## 2. A requirement implemented more narrowly than a literal reading suggests

- **§5.4 "alerte dans la file de l'analyste"**: for E1 and E3, the only visible effect in the
  Analyst's queue is the case's membership changing (a case disappears when E1 escalates it; 8
  new cases appear for E3) — there is no dedicated banner/toast element announcing "an exception
  was just injected." E2's effect *is* explicit (the Client view shows a `role="alert"` message
  and a resubmit button), and E1's escalation *is* explicit in the Supervisor view (a
  `role="alert"` panel explaining the case arrived via automatic escalation). The audit trail
  captures all three exceptions unambiguously either way (§5.4's third effect type).
  **Justification**: the Analyst-queue case disappearing/appearing, combined with the Control
  Tower's live "charge par rôle" KPI (which AC4 explicitly requires to "reflect the spike
  immediately," and does), was judged sufficient signal for a facilitator-narrated workshop
  without adding a separate notification component. Flagged here rather than silently accepted,
  since a literal reading of §5.4 could expect an explicit alert in that specific view too.

## 3. Corrections to stale project documentation (not the spec itself)

These are deviations from `.claude/CLAUDE.md`, which is *not* the source of truth (the spec is)
— recorded here because CLAUDE.md asserted them and the actual implementation disagrees.

- **Tech stack**: CLAUDE.md's "Tech stack" line states Next.js, Node.js, PostgreSQL, Docker. The
  spec's anti-goals (§2) explicitly forbid a backend, a database, and server dependencies. Built
  as a Vite + React + TypeScript single-page app with no backend, per the spec. CLAUDE.md itself
  should be corrected; this repo has not touched it, since `.claude/CLAUDE.md` isn't code and
  editing it wasn't in scope for any single task so far.
- **`constitution.md`**: CLAUDE.md and its "Article N" citations reference a `constitution.md`
  that doesn't exist in this repository. Treated CLAUDE.md's own bullets as the full authority;
  no separate file exists or was created.

## 4. Requirements not yet verified

Not deviations — these were built to spec, but haven't been checked against their acceptance
criteria the way the rest of this list has, and should be before calling v0.1 done:

- **§6 "fluide avec 30 dossiers simultanés et vitesse ×2000"**: no load test has been run against
  this. Nothing in the implementation is known to violate it, but it also hasn't been measured.
- **AC8 / H1–H3**: "a first-time viewer understands the Control Tower without more than two
  sentences of explanation" is explicitly not test-automatable per the spec (§8, item 8) — it
  requires watching a real person in a workshop dry-run, which is outside what an agent session
  can close.
