import { createContext } from 'react';
import type { CaseStore } from '../app/caseStore';

export const CaseStoreContext = createContext<CaseStore | null>(null);
