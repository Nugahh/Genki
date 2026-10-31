import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { dayBounds } from '@/shared/clock';
import type { HealthDataSource } from '../application/ports';
import type { StepsSource } from '../domain/steps';

const READ_STEPS = { accessType: 'read', recordType: 'Steps' } as const;
// Special permissions (route, background, history) carry no record type.
const grantsSteps = (permissions: readonly object[]) => (permissions as { accessType?: string; recordType?: string }[]).some((p) => p.recordType === 'Steps' && p.accessType === 'read');

const rangeOf = (day: string, timezone: string) => {
  const { start, end } = dayBounds(day, timezone);
  return { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } as const;
};

/** Health Connect on Android (spec §7): the steps of a day as the service totals them under the priority the user chose in it. */
export function healthConnectSource(): HealthDataSource {
  // initialize() binds the client to the provider once; later calls reuse it.
  let ready: Promise<boolean> | null = null;
  const init = () => (ready ??= initialize());

  return {
    async status() {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update-needed';
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return 'unavailable';
      return (await init()) ? 'ready' : 'unavailable';
    },
    async hasPermission() {
      return grantsSteps(await getGrantedPermissions());
    },
    async requestPermission() {
      return grantsSteps(await requestPermission([READ_STEPS]));
    },
    async daySteps(day, timezone) {
      const total = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: rangeOf(day, timezone) });
      return { steps: Math.round(total.COUNT_TOTAL ?? 0), origins: total.dataOrigins ?? [] };
    },
    async recentSources(day, timezone) {
      const { records } = await readRecords('Steps', { timeRangeFilter: rangeOf(day, timezone), ascendingOrder: false, pageSize: 200 });
      const latest = new Map<string, Date>();
      for (const record of records) {
        const origin = record.metadata?.dataOrigin;
        if (!origin) continue;
        const end = new Date(record.endTime);
        if (!latest.has(origin) || end > latest.get(origin)!) latest.set(origin, end);
      }
      return [...latest].map(([origin, lastDataAt]): StepsSource => ({ origin, lastDataAt }));
    },
    openSettings: openHealthConnectSettings,
  };
}
