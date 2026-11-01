import { NUTRIENTS, type NutrientInfo } from '@/modules/nutrition';
import type { MetricDefinition, SectionId } from '../domain/metric';
import { METRICS } from '../domain/metrics';

const fr = (value: number, digits: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits });

/** A nutrient as a statistic: its amount per day, against the reference of the profile (a ceiling for what is to be limited). */
function nutrientMetric(n: NutrientInfo): MetricDefinition {
  return {
    id: n.id, section: 'micro', label: n.label, source: 'meals', tint: 'micro', kind: 'bars',
    value: (f) => f.nutrients?.[n.id],
    goal: (g) => g.nutrients?.[n.id],
    target: n.group === 'limit' ? 'atMost' : 'atLeast',
    // Three significant digits at most, as the amounts are stored.
    format: (v) => `${fr(v, v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${n.unit}`,
    dayCompare: false,
    emptyHint: 'Ajoute un aliment de la table Ciqual pour voir ce nutriment.',
    incomplete: (f) => f.incomplete?.includes(n.id) ?? false,
  };
}

/** The nutrients and the statistic of each, in display order. The domain registry holds the other statistics: the catalogue belongs to `nutrition`. */
export const NUTRIENT_METRICS = NUTRIENTS.map((info) => ({ info, def: nutrientMetric(info) }));

/** Every statistic the hub, the sections and Today's links can show. */
export const ALL_METRICS: MetricDefinition[] = [...METRICS, ...NUTRIENT_METRICS.map((m) => m.def)];

export const findMetric = (id: string) => ALL_METRICS.find((m) => m.id === id);
export const metricsIn = (section: SectionId) => ALL_METRICS.filter((m) => m.section === section);
