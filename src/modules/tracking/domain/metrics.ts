import type { MetricDefinition, SectionId } from './metric';

const fr = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits });

/** The registry (spec §6): every statistic the hub, the sections and Today's links can show. */
export const METRICS: MetricDefinition[] = [
  { id: 'calories', section: 'nutrition', label: 'Calories', source: 'days', tint: 'calories', kind: 'bars', value: (f) => f.kcal, goal: (g) => g.kcal, target: 'calories', format: (v) => `${fr(v)} kcal`, dayCompare: false, emptyHint: 'Ajoute un repas pour voir tes calories.' },
  { id: 'protein', section: 'nutrition', label: 'Protéines', source: 'days', tint: 'protein', kind: 'bars', value: (f) => f.proteinG, goal: (g) => g.proteinG, target: 'atLeast', format: (v) => `${fr(v)} g`, dayCompare: false, emptyHint: 'Ajoute un repas pour voir tes protéines.' },
  { id: 'carbs', section: 'nutrition', label: 'Glucides', source: 'days', tint: 'carbs', kind: 'bars', value: (f) => f.carbsG, target: 'none', format: (v) => `${fr(v)} g`, dayCompare: false, emptyHint: 'Ajoute un repas pour voir tes glucides.' },
  { id: 'fat', section: 'nutrition', label: 'Lipides', source: 'days', tint: 'fat', kind: 'bars', value: (f) => f.fatG, target: 'none', format: (v) => `${fr(v)} g`, dayCompare: false, emptyHint: 'Ajoute un repas pour voir tes lipides.' },
  { id: 'water', section: 'eau', label: 'Eau', source: 'days', tint: 'water', kind: 'bars', value: (f) => f.waterMl, goal: (g) => g.waterMl, target: 'atLeast', format: (v) => `${fr(v / 1000, 2)} L`, dayCompare: false, emptyHint: 'Ajoute un verre d’eau pour voir ta courbe.' },
  { id: 'steps', section: 'activite', label: 'Pas', source: 'days', tint: 'steps', kind: 'bars', value: (f) => f.steps, goal: (g) => g.steps, target: 'atLeast', format: (v) => `${fr(v)} pas`, dayCompare: true, emptyHint: 'Aucun pas enregistré : ils arriveront quand Health Connect ou ton Fitbit sera branché.' },
  { id: 'weight', section: 'corps', label: 'Poids', source: 'days', tint: 'weight', kind: 'line', value: (f) => f.weightKg, target: 'none', format: (v) => `${fr(v, 1)} kg`, dayCompare: true, emptyHint: 'Aucune pesée enregistrée pour l’instant.' },
  { id: 'waist', section: 'corps', label: 'Tour de taille', source: 'days', tint: 'waist', kind: 'line', value: (f) => f.waistCm, target: 'none', format: (v) => `${fr(v, 1)} cm`, dayCompare: true, emptyHint: 'Aucune mesure de tour de taille pour l’instant.' },
  { id: 'sessions', section: 'entrainement', label: 'Séances', source: 'training', tint: 'training', kind: 'bars', value: (f) => f.sessions, target: 'none', format: (v) => `${fr(v, 1)} séance${v >= 2 ? 's' : ''}`, dayCompare: false, emptyHint: 'Termine une séance pour la voir ici.' },
  { id: 'volume', section: 'entrainement', label: 'Volume', source: 'training', tint: 'training', kind: 'bars', value: (f) => f.volumeKg, target: 'none', format: (v) => `${fr(v)} kg`, dayCompare: false, emptyHint: 'Termine une séance pour voir ton volume.' },
];

export const metricById = (id: string) => METRICS.find((m) => m.id === id);
export const metricsOf = (section: SectionId) => METRICS.filter((m) => m.section === section);

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'activite', label: 'Activité' },
  { id: 'corps', label: 'Corps' },
  { id: 'entrainement', label: 'Entraînement' },
  { id: 'eau', label: 'Eau' },
];
export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);

/** The cards the hub starts with. */
export const DEFAULT_HUB = ['calories', 'protein', 'water', 'steps', 'weight', 'volume'];
