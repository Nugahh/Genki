import type { MetricDefinition } from '../domain/metric';
import type { Period } from '../domain/period';

/** What a period is compared with, as it is said after « par rapport » (the preposition is in it: « au mois »). */
export const BEFORE: Record<Period, string> = { day: 'à la veille', week: 'à la semaine précédente', month: 'au mois précédent', year: 'à l’année précédente' };

/** A change with its sign (a true minus), or « Inchangé ». */
export const signed = (def: MetricDefinition, change: number) => (change === 0 ? 'Inchangé' : `${change > 0 ? '+' : '−'}${def.format(Math.abs(change))}`);
