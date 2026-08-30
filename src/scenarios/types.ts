// Declarative scenario schema (spec §7): shape only, no real scenario content yet — the water-damage
// content lands in Phase 2. Composes the engine's generic FSM contract, never duplicates it.
import type { StateMachineDefinition, StateMachineStep } from '../engine/stateMachine';

/** Matches the "Type" column of spec §3's step table. */
export type StepActorType = 'human' | 'automated' | 'third-party-async';

export interface ScenarioStep extends StateMachineStep {
  readonly label: string;
  readonly actorRole: string;
  readonly actorType: StepActorType;
  readonly simulatedDurationMs: number;
}

export interface ScenarioDecisionRule<TContext = unknown> {
  readonly id: string;
  /** Shown verbatim in the "Règles" panel (spec §5.3) — must read as a sentence, not a code fragment. */
  readonly description: string;
  readonly guard: (context: TContext) => boolean;
}

export interface ScenarioException {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface ScenarioDefinition<TContext = unknown> extends StateMachineDefinition<TContext> {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly ScenarioStep[];
  readonly decisionRules: readonly ScenarioDecisionRule<TContext>[];
  readonly exceptions: readonly ScenarioException[];
}
