import { formatAmount, NUTRIENTS, type NutrientInfo } from '@/modules/nutrition';
import type { MetricDefinition, SectionId } from '../domain/metric';
import { METRICS } from '../domain/metrics';

/** A nutrient as a statistic: its amount per day, against the reference of the profile (a ceiling for what is to be limited). */
function nutrientMetric(n: NutrientInfo): MetricDefinition {
  return {
    id: n.id, section: 'micro', label: n.label, source: 'meals', tint: 'micro', kind: 'bars',
    // A day with meals that lack the nutrient is 0 at least (`incomplete` says so): the mean over days then stays a lower bound.
    value: (f) => (f.nutrients ? (f.nutrients[n.id] ?? 0) : undefined),
    goal: (g) => g.nutrients?.[n.id],
    target: n.group === 'limit' ? 'atMost' : 'atLeast',
    format: (v) => formatAmount(v, n.unit),
    dayCompare: false,
    emptyHint: 'Ajoute un aliment qui indique ce nutriment pour le voir.',
    incomplete: (f) => f.incomplete?.includes(n.id) ?? false,
  };
}

/** The nutrients and the statistic of each, in display order. The domain registry holds the other statistics: the catalogue belongs to `nutrition`. */
export const NUTRIENT_METRICS = NUTRIENTS.map((info) => ({ info, def: nutrientMetric(info) }));

/** Every statistic the hub, the sections and Today's links can show. */
export const ALL_METRICS: MetricDefinition[] = [...METRICS, ...NUTRIENT_METRICS.map((m) => m.def)];

export const findMetric = (id: string) => ALL_METRICS.find((m) => m.id === id);
export const metricsIn = (section: SectionId) => ALL_METRICS.filter((m) => m.section === section);
