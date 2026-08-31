// Provides one shared case-store instance to the whole app (spec §4: "l'état est unique et
// partagé entre toutes les vues"). Hooks live in useCaseStore.ts, kept out of this file so fast
// refresh only sees component exports here.
import { useMemo, type ReactNode } from 'react';
import { createCaseStore } from '../app/caseStore';
import { CaseStoreContext } from './caseStoreContextValue';

export function CaseStoreProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createCaseStore(), []);
  return <CaseStoreContext.Provider value={store}>{children}</CaseStoreContext.Provider>;
}
