import { useContext, useSyncExternalStore } from 'react';
import type { CaseStore, CaseStoreSnapshot } from '../app/caseStore';
import { CaseStoreContext } from './caseStoreContextValue';

export function useCaseStore(): CaseStore {
  const store = useContext(CaseStoreContext);
  if (!store) {
    throw new Error('useCaseStore must be used within a CaseStoreProvider.');
  }
  return store;
}

export function useCaseStoreSnapshot(): CaseStoreSnapshot {
  const store = useCaseStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
