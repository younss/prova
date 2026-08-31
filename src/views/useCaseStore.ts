import { useContext, useSyncExternalStore } from 'react';
import type { CaseStore, CaseStoreSnapshot } from '../app/caseStore';
import { CaseStoreContext } from './caseStoreContextValue';
import { ResetStoreContext } from './resetStoreContextValue';

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

export function useResetStore(): () => void {
  const resetStore = useContext(ResetStoreContext);
  if (!resetStore) {
    throw new Error('useResetStore must be used within a CaseStoreProvider.');
  }
  return resetStore;
}
