// Generic, scenario-agnostic finite-state machine: steps/transitions/guards are data, never
// hardcoded logic — the actual water-damage scenario is composed on top of this in src/scenarios/.

export interface StateMachineStep {
  readonly id: string;
}

export interface StateMachineTransition<TContext = unknown> {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly guard?: (context: TContext) => boolean;
}

export interface StateMachineDefinition<TContext = unknown> {
  readonly initialStepId: string;
  readonly steps: readonly StateMachineStep[];
  readonly transitions: readonly StateMachineTransition<TContext>[];
}

export interface CaseState<TContext = unknown> {
  readonly stepId: string;
  readonly context: TContext;
  readonly history: readonly string[];
}

function assertValidDefinition<TContext>(definition: StateMachineDefinition<TContext>): void {
  const stepIds = new Set(definition.steps.map((step) => step.id));
  if (stepIds.size !== definition.steps.length) {
    throw new Error('State machine definition has duplicate step ids.');
  }
  if (!stepIds.has(definition.initialStepId)) {
    throw new Error(`Initial step "${definition.initialStepId}" is not a defined step.`);
  }

  const transitionIds = new Set<string>();
  for (const transition of definition.transitions) {
    if (transitionIds.has(transition.id)) {
      throw new Error(`Duplicate transition id "${transition.id}".`);
    }
    transitionIds.add(transition.id);
    if (!stepIds.has(transition.from)) {
      throw new Error(
        `Transition "${transition.id}" references unknown step "${transition.from}".`,
      );
    }
    if (!stepIds.has(transition.to)) {
      throw new Error(`Transition "${transition.id}" references unknown step "${transition.to}".`);
    }
  }
}

export function createCase<TContext>(
  definition: StateMachineDefinition<TContext>,
  context: TContext,
): CaseState<TContext> {
  assertValidDefinition(definition);
  return {
    stepId: definition.initialStepId,
    context,
    history: [definition.initialStepId],
  };
}

export function getAvailableTransitions<TContext>(
  definition: StateMachineDefinition<TContext>,
  state: CaseState<TContext>,
): StateMachineTransition<TContext>[] {
  return definition.transitions.filter(
    (transition) =>
      transition.from === state.stepId && (!transition.guard || transition.guard(state.context)),
  );
}

/**
 * Merges a partial patch into a case's context, leaving stepId/history untouched. A case's
 * context is filled in progressively by different actors at different steps (e.g. a complexity
 * score assigned at triage, an amount proposed at settlement) — createCase() only knows the
 * starting values, so later steps need a way to enrich it.
 */
export function updateContext<TContext>(
  state: CaseState<TContext>,
  patch: Partial<TContext>,
): CaseState<TContext> {
  return {
    ...state,
    context: { ...state.context, ...patch },
  };
}

export function applyTransition<TContext>(
  definition: StateMachineDefinition<TContext>,
  state: CaseState<TContext>,
  transitionId: string,
): CaseState<TContext> {
  const transition = definition.transitions.find((candidate) => candidate.id === transitionId);
  if (!transition) {
    throw new Error(`Unknown transition id "${transitionId}".`);
  }
  if (transition.from !== state.stepId) {
    throw new Error(
      `Transition "${transitionId}" starts from step "${transition.from}", but the case is at step "${state.stepId}".`,
    );
  }
  if (transition.guard && !transition.guard(state.context)) {
    throw new Error(
      `Transition "${transitionId}" is blocked: its guard rejected the current context.`,
    );
  }

  return {
    stepId: transition.to,
    context: state.context,
    history: [...state.history, transition.to],
  };
}
