# Prova — Implementation Plan (v0.1 prototype)

> Status: Phases and acceptance-criteria mapping agreed. Items C–G resolved 2026-08-31 (see §2) — Phase 5's exception-effects schema is unblocked.
> Source of truth: `spec/spec-repetiteur-flux-de-valeur.md`. This plan does not restate the spec; it maps the spec to phases of work.

---

## 1. What this prototype must prove

- **H1 — Comprehension:** a non-technical workshop participant understands within 5 minutes that they're "playing" a future process, each in a role.
- **H2 — Value of the number:** seeing projected KPIs (cycle time, handoffs, rework) for the future process, before any development, triggers "I want that for my real process."
- **H3 — Playable compliance:** watching the audit trail and the four-eyes rule build live reassures a risk/compliance stakeholder at concept stage.

Any implementation choice that doesn't serve testing H1–H3 is out of scope (spec §1).

**Anti-goals (spec §2):** no backend, no database, no real auth — in-memory, browser-only. No live AI generation at runtime — scenario content is pre-written. No networked multi-user — single machine, workshop room. No standard BPMN engine, no real-system integration. No enterprise design system.

---

## 2. Decisions already resolved

| # | Question | Decision | Date |
|---|---|---|---|
| A | Tech stack conflict (CLAUDE.md said Next.js/Node/PostgreSQL/Docker; spec forbids a backend) | **Vite + React + TypeScript SPA, no backend.** CLAUDE.md's "Tech stack" line is stale and should be corrected there. | 2026-08-30 |
| B | `constitution.md` referenced by CLAUDE.md / "Article N" citations, but the file doesn't exist in the repo | **CLAUDE.md's own bullets are the full authority.** No separate constitution.md exists or is expected. Citations like "Article IV" map to the matching CLAUDE.md bullet (e.g. "Time is an injected dependency" for engine/clock rules). | 2026-08-30 |
| H | Scope of "isolated from day one" (§7) — module boundary/schema only in Phase 1, with real content in Phase 2, or must the real water-damage scenario content also exist in Phase 1? | **Working assumption confirmed: schema-only in Phase 1, real water-damage content in Phase 2.** Phase 2 implements this directly (`src/scenarios/waterDamage.ts`). | 2026-08-30 |
| C | Is "un seul fichier livrable si possible" (§6) a hard requirement for a single bundled HTML file, or is a normal `dist/` static build acceptable? | **Confirmed: `dist/` static build via `npm run build`/`preview` stays the deliverable.** Matches what's already shipped; spec says "si possible," not mandatory. | 2026-08-31 |
| D | Does "pas de localStorage requis" (§6) mean persistence is *optional* or *forbidden*? | **Confirmed: forbidden — state stays in-memory only.** Matches the anti-goals ("no backend, browser-only") and the existing Reset button, which discards the whole store rather than persisting it. | 2026-08-31 |
| E | E1 (expert non-response, 5-day simulated timeout) → "escalade automatique" — escalate to whom, and what state change results? | **Auto-escalate to Supervisor at step 7.** The case is pulled off the expertise wait and routed straight to the Supervisor for a manual call, bypassing steps 5/6. The escalation is logged in the audit trail. | 2026-08-31 |
| F | E2 ("documents illisibles" → retouche vers le client) — which step(s) can this target, and does it return the case to step 1 or to a distinct "waiting on client" sub-state? | **Distinct "attente client" sub-state.** The case leaves the normal queue into a visible waiting-on-client state, then re-enters at step 1 once the client resubmits — the original audit history is preserved, not superseded. | 2026-08-31 |
| G | E3 (8-case spike) — do the cases spawn directly into the analyst's queue at step 4, or get created at step 1 and fast-forwarded through steps 2–3? | **Fast-forwarded through steps 1–3.** Cases are created via the normal step-1 synthetic-generation path and auto-chain through triage/coverage-check, so their audit trail is complete and consistent with organically-created cases. | 2026-08-31 |

## 3. Open questions — answer before the phase that needs them

_None outstanding — all resolved, see §2._

## 4. Acceptance criteria (§8) → components

| # | Criterion | Components required |
|---|---|---|
| 1 | Client declares a claim → appears in Analyst queue in <2s | Client view (form), scenario step-1 definition, engine (auto-chain through steps 2–3), Analyst view (queue) |
| 2 | ×500 speed: expertise case returns after ~3 simulated days, no human action | Simulated clock (speed multiplier, tick/advance), engine's timed-transition handling for step 5 |
| 3 | $15,000 case can't close without a *distinct* supervisor; violation → justified refusal + logged | Decision table (>$10,000 → step 7), four-eyes identity check, audit log ("tentative bloquée" entry), Supervisor view |
| 4 | E3 injection → 8 cases in Analyst queue, Control Tower load reflects it immediately | Facilitator view (E3 button), synthetic generator (8 cases), engine (queue insertion), Control Tower "charge par rôle" KPI |
| 5 | After ≥3 closures, Control Tower shows coherent avg cycle time, handoffs, rework rate | Audit log (full history), KPI calculation module, Control Tower view |
| 6 | A case's audit trail tells its full simulated-time story, exports to JSON | Audit log (append-only, simulated timestamps), audit panel (filter by case), JSON export |
| 7 | Change $10,000 → $5,000 in the declarative structure, no engine touch, behavior changes | Scenario data (named threshold constant), engine (reads threshold from data, never hardcodes it) |
| 8 | A first-time viewer understands Control Tower without >2 sentences of explanation | Control Tower layout/typography/contrast (§6 "lisibilité projecteur") — **not test-automatable**; validated by watching a real person in a workshop dry-run (H1/H2), not by Vitest |

## 5. Phased plan

Each phase gates on: its listed ACs passing, `npm run typecheck` and `npm run lint` clean, and `main` remaining demoable via `npm run dev`/`preview`.

### Phase 1 — Scaffolding + simulated clock + generic state machine
- Tooling: Vite + React + TypeScript, Vitest, ESLint + Prettier, tsconfig.
- `src/engine/clock.ts`: simulated clock — pause/play, speed multiplier (×1/×100/×500/×2000), `advance(ms)`, `advanceToNextEvent()`. No `Date.now()`, `setTimeout`, or `setInterval` inside `src/engine/` (per CLAUDE.md's injected-time rule).
- `src/engine/stateMachine.ts`: generic, scenario-agnostic finite-state machine (steps/transitions/guards as data).
- `src/scenarios/`: type schema only, no real content yet (see open question H).
- **No UI.** "Demoable" here means the build boots without error — there is no feature to show yet.
- Tests: clock behavior (pause/play/speed/advance/advanceToNextEvent), FSM transitions against a dummy 2–3-step fixture.

### Phase 2 — Declarative water-damage scenario (§3) + decision-table engine
- Real 8-step scenario as data conforming to Phase 1's schema.
- Decision table for coverage / complexity-score / amount rules, with the $10,000 threshold as a named data value, not a hardcoded constant.
- Targets **AC7** directly: test mutates the threshold in a fixture and asserts behavior changes without touching engine code.
- Still no UI.

### Phase 3 — Audit log + four-eyes enforcement + synthetic data generator
- `src/audit/`: append-only log, JSON export, no mutation API exposed anywhere (including test helpers).
- Four-eyes check: analyst identity vs. approver identity at the step-7 gate.
- `src/synthetic/`: Quebec-flavored pseudo-random generator (names, fictitious addresses in real QC cities, amounts $800–$45,000, varied water-damage descriptions). No Lorem Ipsum, no real data.
- Targets **AC3** and **AC6**'s data model. Last engine-only phase — no UI yet.

### Phase 4 — Core workshop loop UI: Client, Analyst, Supervisor + role switcher
- First real UI, wired to the completed engine.
- Closes **AC1** end-to-end and the UI half of **AC3**.

### Phase 5 — Facilitator panel: clock controls, exception injection, reset
- Clock controls (pause/play/speed/advance-to-next-event), "Nouveau dossier," reset button — **shipped** (`db22f99`), closes AC2.
- E1/E2/E3 injection — **shipped**, per the E/F/G decisions in §2:
  - E1: targeted case at external-expertise → clock advances by the simulated timeout, then auto-escalates to Supervisor at step 7 (bypassing 5/6); resolved via a dedicated "manual call" UI (no four-eyes check, since no analyst proposed the case).
  - E2: targeted case at evaluation → "waiting-on-client" sub-state; the Client view surfaces a "Renvoyer les documents" action that re-enters at step 1 and re-chains through triage/coverage-check.
  - E3: 8 synthetic cases created at step 1 via the normal `generateNewCase()` path, auto-chained through 2–3 same as any organically-created case, with coverage-check forced valid so all 8 reliably reach the analyst's queue (AC4's literal "8 dossiers") rather than a random few landing in `rejected`.
- Closes **AC4**; AC2 already closed.

### Phase 6 — Control Tower + workshop help panel
- Flow map (8 steps, live case-count badges), live KPIs, filterable audit-trail UI, collapsible "Mode d'emploi atelier" panel (spec §9 deliverable #2).
- Closes **AC5**, **AC6**'s UI, and the design side of **AC8**.

---

*This document tracks agreed decisions and phase gates only. It is not the spec — `spec/spec-repetiteur-flux-de-valeur.md` remains the source of truth for behavior; this file records how we're sequencing the build against it. For the spec's §9 deliverable #3 — the explicit list of every deviation from the spec, with justification — see `docs/deviations.md`.*
