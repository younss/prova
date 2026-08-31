// Composes the generic state machine with the audit log: every transition a case makes is
// journalized (spec §5.5), and the four-eyes separation-of-duties rule (spec §5.6, AC3) is
// enforced here, since a blocked attempt's whole purpose is to be logged as one (CLAUDE.md).
import type { CaseState, StateMachineDefinition } from '../engine/stateMachine';
import { applyTransition } from '../engine/stateMachine';
import type { AuditLog } from './auditLog';

export interface RecordTransitionInput {
  readonly caseId: string;
  readonly actor: string;
  readonly justification: string;
  readonly simulatedTimestampMs: number;
}

/** Applies a transition and journalizes it in one step. Throws (and logs nothing) if invalid. */
export function applyTransitionWithAudit<TContext>(
  auditLog: AuditLog,
  definition: StateMachineDefinition<TContext>,
  state: CaseState<TContext>,
  transitionId: string,
  input: RecordTransitionInput,
): CaseState<TContext> {
  const nextState = applyTransition(definition, state, transitionId);
  auditLog.record({
    caseId: input.caseId,
    actor: input.actor,
    action: transitionId,
    justification: input.justification,
    simulatedTimestampMs: input.simulatedTimestampMs,
  });
  return nextState;
}

export interface FourEyesCheckInput {
  readonly analystUserId: string;
  readonly approverUserId: string;
}

export type FourEyesCheckResult =
  { readonly allowed: true } | { readonly allowed: false; readonly refusalReason: string };

/** Pure separation-of-duties check: the approver may not be the case's own analyst. */
export function checkFourEyesSeparation(input: FourEyesCheckInput): FourEyesCheckResult {
  if (input.analystUserId === input.approverUserId) {
    return {
      allowed: false,
      refusalReason:
        `Règle de séparation des tâches : « ${input.approverUserId} » ne peut pas approuver ` +
        'un dossier dont il est également l’analyste.',
    };
  }
  return { allowed: true };
}

export interface AttemptSupervisorApprovalInput extends FourEyesCheckInput {
  readonly caseId: string;
  readonly simulatedTimestampMs: number;
}

export interface AttemptSupervisorApprovalOutcome<TContext> {
  readonly result: FourEyesCheckResult;
  /** Unchanged from the input state when the attempt was refused. */
  readonly state: CaseState<TContext>;
}

/**
 * The step-7 approval gate (spec §5.6, AC3): refuses and journalizes a "tentative bloquée" when
 * the approver is the case's own analyst, otherwise applies the transition and journalizes it.
 */
export function attemptSupervisorApproval<TContext>(
  auditLog: AuditLog,
  definition: StateMachineDefinition<TContext>,
  state: CaseState<TContext>,
  transitionId: string,
  input: AttemptSupervisorApprovalInput,
): AttemptSupervisorApprovalOutcome<TContext> {
  const result = checkFourEyesSeparation(input);

  if (!result.allowed) {
    auditLog.record({
      caseId: input.caseId,
      actor: input.approverUserId,
      action: 'blocked-attempt',
      justification: result.refusalReason,
      simulatedTimestampMs: input.simulatedTimestampMs,
    });
    return { result, state };
  }

  const nextState = applyTransitionWithAudit(auditLog, definition, state, transitionId, {
    caseId: input.caseId,
    actor: input.approverUserId,
    justification: `Approuvé par ${input.approverUserId} (analyste : ${input.analystUserId}).`,
    simulatedTimestampMs: input.simulatedTimestampMs,
  });
  return { result, state: nextState };
}
