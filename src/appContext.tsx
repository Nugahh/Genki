import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';
import type { App } from './composition';

type Write = () => Promise<void>;
type AppContextValue = { app: App; run: (write: Write) => void; writeFailed: boolean };

const AppContext = createContext<AppContextValue | null>(null);

/** Provides the composed app and runs its writes: a rejected write is kept and offered again (spec §8). */
export function AppProvider({ app, children }: { app: App; children: ReactNode }) {
  // shortcut: only the last refused write is kept; keep a list if refusals stop being rare.
  const [failed, setFailed] = useState<Write | null>(null);
  // Not awaited: offline, a write only settles once the server has it.
  const run = useCallback((write: Write) => {
    write().catch((error) => {
      console.warn(error);
      setFailed(() => write);
    });
  }, []);
  const value = useMemo(() => ({ app, run, writeFailed: failed !== null }), [app, run, failed]);

  const retry = () => {
    const write = failed;
    setFailed(null);
    if (write) run(write);
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {/* Mounted per failure: Paper's Snackbar misses a refusal that lands during its fade-out. */}
      {failed !== null && (
        <Snackbar
          visible
          onDismiss={() => setFailed(null)}
          duration={Number.POSITIVE_INFINITY}
          action={{ label: 'Réessayer', onPress: retry, contentStyle: { minHeight: 48 } }}
          onIconPress={() => setFailed(null)}
          iconAccessibilityLabel="Fermer"
        >
          L’enregistrement a échoué.
        </Snackbar>
      )}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}
