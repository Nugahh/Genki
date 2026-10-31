export type UiPeriod = 'day' | 'week' | 'year';

/**
 * How the Suivi screens are set up (spec §4, `users/{uid}.ui`): the ordered statistics of the hub, and the period.
 * A field that was never chosen is missing: the screens apply their own defaults.
 */
export type UiPrefs = { hubMetrics?: string[]; period?: UiPeriod };

/** A French message for the first problem with the preferences, or null. The list is bounded as in the Firestore rules. */
export function validateUi(ui: UiPrefs): string | null {
  if (ui.period !== undefined && !['day', 'week', 'year'].includes(ui.period)) return 'La période doit être le jour, la semaine ou l’année.';
  if (ui.hubMetrics === undefined) return null;
  if (ui.hubMetrics.length > 30) return 'Le tableau de bord a au plus 30 statistiques.';
  if (ui.hubMetrics.some((id) => id.trim() === '' || id.length > 40)) return 'Le nom d’une statistique doit faire entre 1 et 40 caractères.';
  if (new Set(ui.hubMetrics).size < ui.hubMetrics.length) return 'Une statistique ne peut apparaître qu’une fois.';
  return null;
}
