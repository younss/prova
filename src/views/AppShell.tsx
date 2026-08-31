// Permanent role switcher + active-identity selector (spec §4: "sélecteur de rôle permanent...
// changement de rôle est instantané"). All views read the same shared CaseStoreProvider state.
import { useState } from 'react';
import type { Role } from '../app/caseStore';
import { ACTIVE_IDENTITY_OPTIONS, ROLE_LABELS } from './identities';
import { ClientView } from './ClientView';
import { AnalystView } from './AnalystView';
import { SupervisorView } from './SupervisorView';

const ROLES: readonly Role[] = ['client', 'analyst', 'supervisor'];

export function AppShell() {
  const [role, setRole] = useState<Role>('client');
  const [userId, setUserId] = useState<string>(ACTIVE_IDENTITY_OPTIONS[0]!);

  return (
    <div>
      <header>
        <h1>Prova — Répétiteur de flux de valeur</h1>
        <nav aria-label="Sélecteur de rôle">
          {ROLES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={candidate === role}
              onClick={() => setRole(candidate)}
            >
              {ROLE_LABELS[candidate]}
            </button>
          ))}
        </nav>
        <div className="form-field">
          <label htmlFor="active-identity">Identité active</label>
          <select
            id="active-identity"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            {ACTIVE_IDENTITY_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/*
        All three views stay mounted and are hidden rather than removed, so switching roles is
        instant and never discards a view's local state (spec §4) — e.g. a client's declared-case
        list, or an analyst's in-progress proposal amount.
      */}
      <main>
        <div hidden={role !== 'client'}>
          <ClientView />
        </div>
        <div hidden={role !== 'analyst'}>
          <AnalystView userId={userId} />
        </div>
        <div hidden={role !== 'supervisor'}>
          <SupervisorView userId={userId} />
        </div>
      </main>
    </div>
  );
}
