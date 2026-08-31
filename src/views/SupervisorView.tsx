// Supervisor role view (spec §4.3, §5.6, AC3): four-eyes approval queue with mandatory-comment
// refusal. A blocked (same-analyst) attempt shows the explicit refusal message inline.
import { useState } from 'react';
import { useCaseStore, useCaseStoreSnapshot } from './useCaseStore';

export interface SupervisorViewProps {
  readonly userId: string;
}

export function SupervisorView({ userId }: SupervisorViewProps) {
  const store = useCaseStore();
  useCaseStoreSnapshot();
  const queue = store.getQueueForRole('supervisor');
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined);
  const selectedCase = queue.find((record) => record.id === selectedCaseId);

  return (
    <section aria-labelledby="supervisor-view-title">
      <h2 id="supervisor-view-title">Approbations quatre yeux</h2>
      {queue.length === 0 && <p>Aucune approbation en attente.</p>}
      <ul>
        {queue.map((record) => (
          <li key={record.id}>
            <button type="button" onClick={() => setSelectedCaseId(record.id)}>
              {record.id} — {record.state.context.proposedAmountDollars} $ (proposé par{' '}
              {record.proposedByUserId})
            </button>
          </li>
        ))}
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
