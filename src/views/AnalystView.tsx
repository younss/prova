// Analyst role view (spec §4.2): case queue + detail with the two actions this phase supports —
// completing an evaluation, and proposing a settlement amount. "Renvoyer au client" is
// intentionally omitted: its target state is open question F, unresolved until Phase 5.
import { useState } from 'react';
import { useCaseStore, useCaseStoreSnapshot } from './useCaseStore';

export interface AnalystViewProps {
  readonly userId: string;
}

export function AnalystView({ userId }: AnalystViewProps) {
  const store = useCaseStore();
  useCaseStoreSnapshot(); // subscribes this component to store changes for re-rendering
  const queue = store.getQueueForRole('analyst');
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined);
  const selectedCase = queue.find((record) => record.id === selectedCaseId);

  return (
    <section aria-labelledby="analyst-view-title">
      <h2 id="analyst-view-title">File de l'analyste</h2>
      {queue.length === 0 && <p>Aucun dossier en attente.</p>}
      <ul>
        {queue.map((record) => (
          <li key={record.id}>
            <button type="button" onClick={() => setSelectedCaseId(record.id)}>
              {record.id} — {record.claimant.fullName} ({record.state.stepId})
            </button>
          </li>
        ))}
      </ul>

      {selectedCase && (
        <CaseDetail key={selectedCase.id} caseId={selectedCase.id} userId={userId} />
      )}
    </section>
  );
}

function CaseDetail({ caseId, userId }: { caseId: string; userId: string }) {
  const store = useCaseStore();
  const record = store.getCase(caseId);
  const [proposedAmount, setProposedAmount] = useState('');

  if (!record) {
    return null;
  }

  return (
    <div aria-labelledby={`case-detail-${caseId}`}>
      <h3 id={`case-detail-${caseId}`}>
        Dossier {record.id} — {record.claimant.fullName}
      </h3>
      <p>{record.claimant.address}</p>
      <p>{record.description}</p>
      <p>Montant réclamé : {record.claimedAmountDollars} $</p>

      {record.state.stepId === 'evaluation' && (
        <button type="button" onClick={() => store.completeEvaluation(record.id, userId)}>
          Terminer l'évaluation
        </button>
      )}

      {record.state.stepId === 'external-expertise' && (
        <p>En attente de l'expert externe (contrôles d'horloge à venir en phase 5).</p>
      )}

      {record.state.stepId === 'settlement-proposal' && (
        <div className="form-field">
          <label htmlFor={`proposed-amount-${record.id}`}>Montant proposé ($)</label>
          <input
            id={`proposed-amount-${record.id}`}
            type="number"
            min={0}
            value={proposedAmount}
            onChange={(event) => setProposedAmount(event.target.value)}
          />
          <button
            type="button"
            disabled={proposedAmount === ''}
            onClick={() => {
              store.proposeSettlement(record.id, Number(proposedAmount), userId);
              setProposedAmount('');
            }}
          >
            Proposer
          </button>
        </div>
      )}
    </div>
  );
}
