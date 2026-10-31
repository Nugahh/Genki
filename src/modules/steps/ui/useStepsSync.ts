import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Device } from '../application/ports';
import type { StepsUseCases, SyncOutcome } from '../application/stepsUseCases';

export type StepsSync = {
  /** Reads the steps and writes them; one at a time, and a no-op while a sync is under way. */
  sync: () => Promise<void>;
  /** What the last sync did; null before the first. */
  outcome: SyncOutcome | null;
  isWriter: boolean;
  devices: Device[];
};

/**
 * The steps, kept up to date: this phone is noted among the devices (the first one becomes the writer), and the steps are read when the app
 * opens, when it comes back to the foreground, and when `sync` is called. Only the phone that writes the steps reads them.
 */
export function useStepsSync(steps: StepsUseCases, run: (write: () => Promise<void>) => void): StepsSync {
  const [seen, setSeen] = useState<{ devices: Device[]; known: boolean }>({ devices: [], known: false });
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const isWriter = seen.devices.find((d) => d.id === steps.device.id)?.stepsWriter ?? false;
  const registered = useRef(false);
  const running = useRef(false);

  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => steps.observeDevices((devices, known) => setSeen({ devices, known }), () => {}), [steps]);

  useEffect(() => {
    if (!seen.known || registered.current) return;
    registered.current = true;
    run(async () => void (await steps.registerThisDevice(seen.devices)));
  }, [seen, steps, run]);

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const result = await steps.sync({ isWriter });
      setOutcome(result.outcome);
      run(() => result.saved);
    } finally {
      running.current = false;
    }
  }, [steps, isWriter, run]);

  // Opening the app, and the moment this phone learns it is the writer.
  useEffect(() => {
    if (seen.known && isWriter) void sync();
  }, [seen.known, isWriter, sync]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return { sync, outcome, isWriter, devices: seen.devices };
}
