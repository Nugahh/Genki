import type { MetricDefinition } from '../domain/metric';
import type { Period } from '../domain/period';

/** What a period is compared with, as it is said: « par rapport à la veille ». */
export const BEFORE: Record<Period, string> = { day: 'la veille', week: 'la semaine précédente', year: 'l’année précédente' };

/** A change with its sign (a true minus), or « Inchangé ». */
export const signed = (def: MetricDefinition, change: number) => (change === 0 ? 'Inchangé' : `${change > 0 ? '+' : '−'}${def.format(Math.abs(change))}`);
