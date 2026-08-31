// Control Tower role view (spec §4.5, §5.5, §9 deliverable #2): live flow map, KPIs, filterable
// audit trail with JSON export, and the collapsible "Mode d'emploi atelier" panel. Spec §6 asks
// for "lisibilité projecteur" (generous font sizes, strong contrast) — see app.css.
import { useState } from 'react';
import { formatSimulatedDuration } from './formatSimulatedDuration';
import { useCaseStore, useCaseStoreSnapshot } from './useCaseStore';

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatRate(rate: number | undefined): string {
  return rate === undefined ? '—' : `${Math.round(rate * 100)} %`;
}

export function ControlTowerView() {
  const store = useCaseStore();
  const snapshot = useCaseStoreSnapshot();
  const steps = store.getScenarioSteps();
  const kpis = store.getKpis();
  const [auditFilterCaseId, setAuditFilterCaseId] = useState<string>('');

  const visibleAuditEntries = auditFilterCaseId
    ? snapshot.auditEntries.filter((entry) => entry.caseId === auditFilterCaseId)
    : snapshot.auditEntries;

  return (
    <section aria-labelledby="control-tower-title">
      <h2 id="control-tower-title">Tour de contrôle</h2>

      <details>
        <summary>Mode d'emploi atelier (20 minutes, 4 participants)</summary>
        <ol>
          <li>
            Introduction (2 min) — présentez le concept : "vous allez jouer le processus futur".
          </li>
          <li>
            Attribution des rôles (1 min) — chaque participant choisit Client, Analyste ou
            Superviseur ; l'animateur garde son propre panneau.
          </li>
          <li>Déclaration d'un sinistre (3 min) — le Client remplit le formulaire et le soumet.</li>
          <li>
            Vitesse ×500 (2 min) — l'animateur passe l'horloge en Lecture ; le dossier traverse le
            tri et la vérification de couverture automatiquement, puis apparaît dans la file de
            l'Analyste.
          </li>
          <li>
            Évaluation et proposition (4 min) — l'Analyste évalue le dossier et propose un montant
            (idéalement supérieur à 10 000 $ pour illustrer la double signature).
          </li>
          <li>
            Approbation quatre yeux (3 min) — le Superviseur tente d'approuver ; montrez le refus si
            c'est la même identité que l'analyste, puis approuvez avec une identité distincte.
          </li>
          <li>
            Tour de contrôle (3 min) — montrez la carte du flux, les KPIs, et exportez la piste
            d'audit en JSON.
          </li>
          <li>
            Discussion (2 min) — "est-ce que ces chiffres vous parlent pour votre vrai processus ?"
          </li>
        </ol>
      </details>

      <h3>Carte du flux</h3>
      <ul>
        {steps.map((step) => {
          const count = snapshot.cases.filter((record) => record.state.stepId === step.id).length;
          return (
            <li key={step.id}>
              {step.label} — <strong>{count}</strong>
            </li>
          );
        })}
      </ul>

      <h3>KPIs</h3>
      <ul>
        <li>Dossiers clôturés : {kpis.closedCaseCount}</li>
        <li>
          Temps de cycle moyen :{' '}
          {kpis.averageCycleTimeMs === undefined
            ? '—'
            : formatSimulatedDuration(kpis.averageCycleTimeMs)}
        </li>
        <li>
          Handoffs moyens par dossier :{' '}
          {kpis.averageHandoffsPerCase === undefined ? '—' : kpis.averageHandoffsPerCase.toFixed(1)}
        </li>
        <li>Taux de retouche : {formatRate(kpis.reworkRate)}</li>
        <li>Double signature : {formatRate(kpis.doubleSignatureRate)}</li>
        <li>
          Charge par rôle — Analyste : {kpis.loadByRole.analyst}, Superviseur :{' '}
          {kpis.loadByRole.supervisor}
        </li>
      </ul>

      <h3>Piste d'audit</h3>
      <div className="form-field">
        <label htmlFor="audit-case-filter">Filtrer par dossier</label>
        <select
          id="audit-case-filter"
          value={auditFilterCaseId}
          onChange={(event) => setAuditFilterCaseId(event.target.value)}
        >
          <option value="">Tous les dossiers</option>
          {snapshot.cases.map((record) => (
            <option key={record.id} value={record.id}>
              {record.id}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => downloadJson('piste-audit.json', store.getAuditLog().toJson())}
      >
        Exporter en JSON
      </button>
      <table>
        <thead>
          <tr>
            <th scope="col">Dossier</th>
            <th scope="col">Qui</th>
            <th scope="col">Quoi</th>
            <th scope="col">Quand (simulé)</th>
            <th scope="col">Justification</th>
          </tr>
        </thead>
        <tbody>
          {visibleAuditEntries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.caseId}</td>
              <td>{entry.actor}</td>
              <td>{entry.action}</td>
              <td>{formatSimulatedDuration(entry.simulatedTimestampMs)}</td>
              <td>{entry.justification}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
