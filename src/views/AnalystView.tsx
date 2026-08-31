// Analyst role view (spec §4.2): case queue + detail with the two actions this role supports —
// completing an evaluation, and proposing a settlement amount. Sending a case back to the client
// over illegible documents is E2 (spec §5.4), a facilitator-injected exception rather than an
// analyst self-service action — see FacilitatorView.
import { useState } from 'react';
import { CaseStatusBadge } from './CaseStatusBadge';
import { formatCaseAge } from './caseAge';
import { useCaseStore, useCaseStoreSnapshot } from './useCaseStore';

export interface AnalystViewProps {
  readonly userId: string;
}

export function AnalystView({ userId }: AnalystViewProps) {
  const store = useCaseStore();
  const snapshot = useCaseStoreSnapshot();
  const queue = store.getQueueForRole('analyst');
  const stepsById = new Map(store.getScenarioSteps().map((step) => [step.id, step]));
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined);
  const selectedCase = queue.find((record) => record.id === selectedCaseId);

  return (
    <section aria-labelledby="analyst-view-title">
      <h2 id="analyst-view-title">File de l'analyste</h2>
      {queue.length === 0 && <p>Aucun dossier en attente.</p>}
      <ul className="case-list">
        {queue.map((record) => {
          const step = stepsById.get(record.state.stepId);
          return (
            <li key={record.id}>
              <button type="button" onClick={() => setSelectedCaseId(record.id)}>
                <span className="case-list-primary">
                  {record.id} — {record.claimant.fullName}
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
        <CaseDetail key={selectedCase.id} caseId={selectedCase.id} userId={userId} />
      )}
    </section>
  );
}

function CaseDetail({ caseId, userId }: { caseId: string; userId: string }) {
  const store = useCaseStore();
  const snapshot = useCaseStoreSnapshot();
  const record = store.getCase(caseId);
  const [proposedAmount, setProposedAmount] = useState('');

  if (!record) {
    return null;
  }

  const step = store.getScenarioSteps().find((candidate) => candidate.id === record.state.stepId);

  return (
    <div aria-labelledby={`case-detail-${caseId}`}>
      <h3 id={`case-detail-${caseId}`}>
        Dossier {record.id} — {record.claimant.fullName}
        {step && <CaseStatusBadge step={step} />}
      </h3>
      <p className="case-age">
        {formatCaseAge(store.getAuditLog(), record.id, snapshot.clock.now)}
      </p>
      <p>{record.claimant.address}</p>
      <p>{record.description}</p>
      <p>Montant réclamé : {record.claimedAmountDollars} $</p>

      {record.state.stepId === 'evaluation' && (
        <button type="button" onClick={() => store.completeEvaluation(record.id, userId)}>
          Terminer l'évaluation
        </button>
      )}

      {record.state.stepId === 'external-expertise' && (
        <p>
          En attente de l'expert externe (retour automatique après 3 jours simulés — voir le panneau
          animateur pour l'horloge, ou pour injecter E1 si l'expert ne répond pas).
        </p>
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
