import type { DaySteps, StepsSource, StoredSource } from '../domain/steps';

export type HealthStatus = 'unavailable' | 'update-needed' | 'ready';

/** Where steps are read (spec §8: Health Connect today, the Google Health API as a second adapter later). */
export interface HealthDataSource {
  /** Whether the health service is on the phone and up to date. */
  status(): Promise<HealthStatus>;
  hasPermission(): Promise<boolean>;
  /** Asks the user for the permission to read steps; true when granted. */
  requestPermission(): Promise<boolean>;
  /** The steps of a day of the time zone, as the service totals them under the priority the user chose, and the apps that wrote them. */
  daySteps(day: string, timezone: string): Promise<DaySteps>;
  /** The apps that wrote steps that day, with the time of their last data. */
  recentSources(day: string, timezone: string): Promise<StepsSource[]>;
  /** Opens the service's own settings, where the priority of the sources is chosen. */
  openSettings(): void;
}

export type Device = { id: string; name: string; stepsWriter: boolean; lastStepsSyncAt?: Date };

export interface StepsRepository {
  /** Merges the steps into the day, leaving its totals alone; settles once the server has the write. */
  saveDay(day: string, steps: { steps: number; source: StoredSource; syncedAt: Date }): Promise<void>;
  /**
   * The devices of the account, live. `known` is false for a snapshot that only says « not in the cache » (a new phone not yet
   * connected): nothing can be told from it. Returns the unsubscribe function.
   */
  observeDevices(onNext: (devices: Device[], known: boolean) => void, onError: (error: Error) => void): () => void;
  /** Creates the device if it is not there and notes the time of its last sync; leaves `stepsWriter` alone. */
  touchDevice(id: string, name: string, syncedAt?: Date): Promise<void>;
  /** Makes this device the one that writes the steps, and the ones given stop: one batch. */
  setWriter(id: string, name: string, othersToClear: string[]): Promise<void>;
}
