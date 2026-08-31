import { CaseStoreProvider } from './views/CaseStoreContext';
import { AppShell } from './views/AppShell';

export function App() {
  return (
    <CaseStoreProvider>
      <AppShell />
    </CaseStoreProvider>
  );
}
