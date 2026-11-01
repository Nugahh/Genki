import type { UiPrefs } from '@/modules/settings';
import { findMetric } from '../application/registry';
import { DEFAULT_HUB } from '../domain/metrics';
import type { Period } from '../domain/period';

/** The preferences with the defaults applied: the default cards and the week; a statistic that no longer exists is dropped. */
export function resolveUi(ui: UiPrefs): { hubMetrics: string[]; period: Period } {
  return { hubMetrics: (ui.hubMetrics ?? DEFAULT_HUB).filter((id) => findMetric(id)), period: ui.period ?? 'week' };
}

/** The nutrients have no year view (it would read some two thousand meals): the month stands in for a year chosen elsewhere. */
export const nutrientPeriod = (period: Period): Period => (period === 'year' ? 'month' : period);
