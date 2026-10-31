import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Makes this phone the one that writes the steps (the others stop); a refused write is offered again. */
  makeWriter: () => void;
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
  // What `sync` needs of the latest render, without being rebuilt by it: a sync writes the device (its last sync time), which changes
  // the devices, which would rebuild `sync` and start another one for ever.
  const latest = useRef({ isWriter, devices: seen.devices });
  useEffect(() => {
    latest.current = { isWriter, devices: seen.devices };
  });

  // The SyncIcon watches only today's totals: a refusal of the devices (rules not deployed) is said here.
  useEffect(() => steps.observeDevices((devices, known) => setSeen({ devices, known }), () => setOutcome({ kind: 'failed', error: 'les téléphones du compte ne se lisent pas' })), [steps]);

  useEffect(() => {
    if (!seen.known || registered.current) return;
    registered.current = true;
    const devices = seen.devices;
    run(async () => void (await steps.registerThisDevice(devices)));
  }, [seen, steps, run]);

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      // The first time on this phone (it never synced) goes back a month.
      const { isWriter: writer, devices } = latest.current;
      const firstSync = devices.find((d) => d.id === steps.device.id)?.lastStepsSyncAt === undefined;
      const result = await steps.sync({ isWriter: writer, firstSync });
      setOutcome(result.outcome);
      run(result.save);
    } finally {
      running.current = false;
    }
  }, [steps, run]);

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

  const makeWriter = useCallback(() => run(() => steps.makeWriter(seen.devices)), [steps, seen.devices, run]);
  return useMemo(() => ({ sync, outcome, isWriter, devices: seen.devices, makeWriter }), [sync, outcome, isWriter, seen.devices, makeWriter]);
}
