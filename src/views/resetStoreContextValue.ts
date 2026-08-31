import { createContext } from 'react';

export const ResetStoreContext = createContext<(() => void) | null>(null);
