// Supervisor role view (spec §4.3, §5.6, AC3): four-eyes approval queue with mandatory-comment
// refusal. A blocked (same-analyst) attempt shows the explicit refusal message inline.
import { useState } from 'react';
import { CaseStatusBadge } from './CaseStatusBadge';
import { formatCaseAge } from './caseAge';
import { useCaseStore, useCaseStoreSnapshot } from './useCaseStore';

export interface SupervisorViewProps {
  readonly userId: string;
}

export function SupervisorView({ userId }: SupervisorViewProps) {
  const store = useCaseStore();
  const snapshot = useCaseStoreSnapshot();
  const queue = store.getQueueForRole('supervisor');
  const stepsById = new Map(store.getScenarioSteps().map((step) => [step.id, step]));
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined);
  const selectedCase = queue.find((record) => record.id === selectedCaseId);

  return (
    <section aria-labelledby="supervisor-view-title">
      <h2 id="supervisor-view-title">Approbations quatre yeux</h2>
      {queue.length === 0 && <p>Aucune approbation en attente.</p>}
      <ul className="case-list">
        {queue.map((record) => {
          const step = stepsById.get(record.state.stepId);
          return (
            <li key={record.id}>
              <button type="button" onClick={() => setSelectedCaseId(record.id)}>
                <span className="case-list-primary">
                  {record.id} —{' '}
                  {record.proposedByUserId
                    ? `${record.state.context.proposedAmountDollars} $ (proposé par ${record.proposedByUserId})`
                    : 'escaladé (E1) — aucun montant proposé'}
                </span>
                {step && <CaseStatusBadge step={step} />}
                <span className="case-age">
                  {formatCaseAge(store.getAuditLog(), record.id, snapshot.clock.now)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedCase && (
        <ApprovalDetail key={selectedCase.id} caseId={selectedCase.id} userId={userId} />
      )}
    </section>
  );
}

function ApprovalDetail({ caseId, userId }: { caseId: string; userId: string }) {
  const store = useCaseStore();
  const record = store.getCase(caseId);
  const [comment, setComment] = useState('');
  const [refusalMessage, setRefusalMessage] = useState<string | undefined>(undefined);
  const [escalatedAmount, setEscalatedAmount] = useState('');

  if (!record) {
    return null;
  }

  function handleApprove(): void {
    const result = store.approveSupervisor(caseId, userId);
    setRefusalMessage(result.allowed ? undefined : result.refusalReason);
  }

  function handleRefuse(): void {
    store.refuseSupervisor(caseId, userId, comment);
    setComment('');
    setRefusalMessage(undefined);
  }

  if (!record.proposedByUserId) {
    // Arrived via injectExceptionE1: no analyst ever proposed an amount, so there is nothing to
    // separate the approver from — a distinct "manual call" UI, not the four-eyes approval below.
    return (
      <div aria-labelledby={`approval-detail-${caseId}`}>
        <h3 id={`approval-detail-${caseId}`}>Dossier {record.id} — escaladé (E1)</h3>
        <p role="alert">
          Ce dossier a été escaladé automatiquement : l'expert externe n'a pas répondu. Aucun
          montant n'a encore été proposé.
        </p>
        <div className="form-field">
          <label htmlFor={`escalated-amount-${record.id}`}>Montant à fixer ($)</label>
          <input
            id={`escalated-amount-${record.id}`}
            type="number"
            min={0}
            value={escalatedAmount}
            onChange={(event) => setEscalatedAmount(event.target.value)}
          />
          <button
            type="button"
            disabled={escalatedAmount === ''}
            onClick={() => {
              store.resolveEscalation(caseId, Number(escalatedAmount), userId);
              setEscalatedAmount('');
            }}
          >
            Fixer le montant et approuver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div aria-labelledby={`approval-detail-${caseId}`}>
      <h3 id={`approval-detail-${caseId}`}>Dossier {record.id}</h3>
      <p>Montant : {record.state.context.proposedAmountDollars} $</p>
      <p>Analyste : {record.proposedByUserId}</p>

      {refusalMessage && <p role="alert">{refusalMessage}</p>}

      <button type="button" onClick={handleApprove}>
        Approuver
      </button>

      <div className="form-field">
        <label htmlFor={`refusal-comment-${record.id}`}>
          Commentaire (obligatoire pour refuser)
        </label>
        <textarea
          id={`refusal-comment-${record.id}`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <button type="button" disabled={comment.trim() === ''} onClick={handleRefuse}>
          Refuser
        </button>
      </div>
    </div>
  );
}
