import type { Device, StepsRepository } from '../application/ports';
import type { StoredSource } from '../domain/steps';

/** StepsRepository kept in memory, for tests. */
export function inMemoryStepsRepository(initial: { devices?: Device[]; known?: boolean } = {}) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const repo = {
    days: new Map<string, { steps: number; source: StoredSource; syncedAt: Date }>(),
    devices: initial.devices ?? ([] as Device[]),
    known: initial.known ?? true,
    async saveDay(day: string, steps: { steps: number; source: StoredSource; syncedAt: Date }) {
      repo.days.set(day, steps);
    },
    observeDevices(onNext: (devices: Device[], known: boolean) => void) {
      const listener = () => onNext(repo.devices, repo.known);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
    async touchDevice(id: string, name: string, syncedAt?: Date) {
      const found = repo.devices.find((d) => d.id === id);
      repo.devices = found
        ? repo.devices.map((d) => (d.id === id ? { ...d, name, ...(syncedAt && { lastStepsSyncAt: syncedAt }) } : d))
        : [...repo.devices, { id, name, stepsWriter: false, ...(syncedAt && { lastStepsSyncAt: syncedAt }) }];
      notify();
    },
    async setWriter(id: string, name: string, othersToClear: string[]) {
      const others = repo.devices.map((d) => (othersToClear.includes(d.id) ? { ...d, stepsWriter: false } : d));
      const mine = others.find((d) => d.id === id);
      repo.devices = mine ? others.map((d) => (d.id === id ? { ...d, name, stepsWriter: true } : d)) : [...others, { id, name, stepsWriter: true }];
      notify();
    },
  };
  return repo;
}
