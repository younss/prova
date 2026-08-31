// Client role view (spec §4.1): declaration form (5 fields + fake upload) then a live status
// list of the cases declared from this browser session.
import { useState, type FormEvent } from 'react';
import type { ScenarioStep } from '../scenarios/types';
import { CaseStatusBadge } from './CaseStatusBadge';
import { formatCaseAge } from './caseAge';
import { useCaseStore, useCaseStoreSnapshot } from './useCaseStore';

interface DeclarationFormState {
  fullName: string;
  address: string;
  incidentDate: string;
  description: string;
  claimedAmountDollars: string;
}

const EMPTY_FORM: DeclarationFormState = {
  fullName: '',
  address: '',
  incidentDate: '',
  description: '',
  claimedAmountDollars: '',
};

export function ClientView() {
  const store = useCaseStore();
  const snapshot = useCaseStoreSnapshot();
  const stepsById = useSteps();
  const [form, setForm] = useState<DeclarationFormState>(EMPTY_FORM);
  const [myCaseIds, setMyCaseIds] = useState<string[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const record = store.declareCase({
      fullName: form.fullName,
      address: form.address,
      incidentDate: form.incidentDate,
      description: form.description,
      claimedAmountDollars: Number(form.claimedAmountDollars),
    });
    setMyCaseIds((ids) => [...ids, record.id]);
    setForm(EMPTY_FORM);
  }

  const myCases = snapshot.cases.filter((record) => myCaseIds.includes(record.id));

  return (
    <section aria-labelledby="client-view-title">
      <h2 id="client-view-title">Déclarer un sinistre</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="client-full-name">Nom complet</label>
          <input
            id="client-full-name"
            required
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-address">Adresse</label>
          <input
            id="client-address"
            required
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-incident-date">Date du sinistre</label>
          <input
            id="client-incident-date"
            type="date"
            required
            value={form.incidentDate}
            onChange={(event) => setForm({ ...form, incidentDate: event.target.value })}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-description">Description du dégât d'eau</label>
          <textarea
            id="client-description"
            required
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-amount">Montant estimé des dommages ($)</label>
          <input
            id="client-amount"
            type="number"
            min={0}
            required
            value={form.claimedAmountDollars}
            onChange={(event) => setForm({ ...form, claimedAmountDollars: event.target.value })}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-photos">
            Photos (démo — aucun fichier n'est réellement envoyé)
          </label>
          <input id="client-photos" type="file" disabled />
        </div>
        <button type="submit">Déclarer le sinistre</button>
      </form>

      {myCases.length > 0 && (
        <div>
          <h3>Mes dossiers</h3>
          <ul className="case-list">
            {myCases.map((record) => {
              const step = stepsById.get(record.state.stepId);
              return (
                <li key={record.id}>
                  <span className="case-list-primary">
                    <strong>{record.id}</strong> ({record.incidentDate})
                  </span>
                  {step && <CaseStatusBadge step={step} />}
                  <span className="case-age">
                    {formatCaseAge(store.getAuditLog(), record.id, snapshot.clock.now)}
                  </span>
                  {record.state.stepId === 'waiting-on-client' && (
                    <div>
                      <span role="alert">
                        Vos documents sont illisibles — veuillez les corriger et les renvoyer.
                      </span>{' '}
                      <button type="button" onClick={() => store.resubmitDocuments(record.id)}>
                        Renvoyer les documents
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function useSteps(): Map<string, ScenarioStep> {
  const store = useCaseStore();
  return new Map(store.getScenarioSteps().map((step) => [step.id, step]));
}
