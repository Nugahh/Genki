import type { UiPrefs } from '@/modules/settings';
import { DEFAULT_HUB, metricById } from '../domain/metrics';
import type { Period } from '../domain/period';

/** The preferences with the defaults applied: the default cards and the week; a statistic that no longer exists is dropped. */
export function resolveUi(ui: UiPrefs): { hubMetrics: string[]; period: Period } {
  return { hubMetrics: (ui.hubMetrics ?? DEFAULT_HUB).filter((id) => metricById(id)), period: ui.period ?? 'week' };
}
