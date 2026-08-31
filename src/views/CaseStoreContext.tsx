// Provides one shared case-store instance to the whole app (spec §4: "l'état est unique et
// partagé entre toutes les vues"), and the "Réinitialiser" mechanism (spec §6): reset never
// mutates or deletes the audit log's entries (CLAUDE.md forbids that) — it discards the whole
// store and mounts a fresh one, so every prior AuditEntry stays exactly as it was. Hooks live in
// useCaseStore.ts, kept out of this file so fast refresh only sees component exports here.
import { useCallback, useState, type ReactNode } from 'react';
import { createCaseStore } from '../app/caseStore';
import { CaseStoreContext } from './caseStoreContextValue';
import { ResetStoreContext } from './resetStoreContextValue';

export function CaseStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState(() => createCaseStore());
  const resetStore = useCallback(() => setStore(createCaseStore()), []);

  return (
    <CaseStoreContext.Provider value={store}>
      <ResetStoreContext.Provider value={resetStore}>{children}</ResetStoreContext.Provider>
    </CaseStoreContext.Provider>
  );
}
