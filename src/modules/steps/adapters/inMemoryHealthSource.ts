import type { HealthDataSource, HealthStatus } from '../application/ports';
import type { DaySteps, StepsSource } from '../domain/steps';

/** HealthDataSource kept in memory, for tests: `days` holds the steps by day, `sources` the apps by day. */
export function inMemoryHealthSource(initial: { status?: HealthStatus; granted?: boolean; days?: Record<string, DaySteps>; sources?: Record<string, StepsSource[]>; deny?: boolean } = {}) {
  const source = {
    state: { status: initial.status ?? ('ready' as HealthStatus), granted: initial.granted ?? true, days: initial.days ?? {}, sources: initial.sources ?? {}, deny: initial.deny ?? false },
    reads: [] as string[],
    settingsOpened: 0,
    async status() {
      return source.state.status;
    },
    async hasPermission() {
      return source.state.granted;
    },
    async requestPermission() {
      if (!source.state.deny) source.state.granted = true;
      return source.state.granted;
    },
    async daySteps(day: string) {
      source.reads.push(day);
      return source.state.days[day] ?? { steps: 0, origins: [] };
    },
    async recentSources(day: string) {
      return source.state.sources[day] ?? [];
    },
    openSettings() {
      source.settingsOpened++;
    },
  };
  return source;
}
