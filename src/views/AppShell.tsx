// Permanent role switcher + active-identity selector (spec §4: "sélecteur de rôle permanent...
// changement de rôle est instantané"). All views read the same shared CaseStoreProvider state.
import { useState } from 'react';
import { ACTIVE_IDENTITY_OPTIONS, VIEW_TAB_LABELS, type ViewTab } from './identities';
import { ClientView } from './ClientView';
import { AnalystView } from './AnalystView';
import { SupervisorView } from './SupervisorView';
import { FacilitatorView } from './FacilitatorView';
import { ControlTowerView } from './ControlTowerView';

const TABS: readonly ViewTab[] = [
  'client',
  'analyst',
  'supervisor',
  'facilitator',
  'control-tower',
];

export function AppShell() {
  const [tab, setTab] = useState<ViewTab>('client');
  const [userId, setUserId] = useState<string>(ACTIVE_IDENTITY_OPTIONS[0]!);

  return (
    <div>
      <header>
        <h1>Prova — Répétiteur de flux de valeur</h1>
        <nav aria-label="Sélecteur de rôle">
          {TABS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={candidate === tab}
              onClick={() => setTab(candidate)}
            >
              {VIEW_TAB_LABELS[candidate]}
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
        Every view stays mounted and is hidden rather than removed, so switching tabs is instant
        and never discards local state (spec §4) — e.g. a client's declared-case list, an
        analyst's in-progress proposal, or the facilitator's clock-ticking effect.
      */}
      <main>
        <div hidden={tab !== 'client'}>
          <ClientView />
        </div>
        <div hidden={tab !== 'analyst'}>
          <AnalystView userId={userId} />
        </div>
        <div hidden={tab !== 'supervisor'}>
          <SupervisorView userId={userId} />
        </div>
        <div hidden={tab !== 'facilitator'}>
          <FacilitatorView />
        </div>
        <div hidden={tab !== 'control-tower'}>
          <ControlTowerView />
        </div>
      </main>
    </div>
  );
}
