import type { MetricDefinition, SectionId } from './metric';

const fr = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits });

/** The registry (spec §6): every statistic the hub, the sections and Today's links can show. */
export const METRICS: MetricDefinition[] = [
  { id: 'calories', section: 'nutrition', label: 'Calories', unit: 'kcal', tint: 'calories', kind: 'bars', value: (f) => f.kcal, goal: (g) => g.kcal, target: 'calories', format: (v) => `${fr(v)} kcal`, emptyHint: 'Ajoute un repas pour voir tes calories.' },
  { id: 'protein', section: 'nutrition', label: 'Protéines', unit: 'g', tint: 'protein', kind: 'bars', value: (f) => f.proteinG, goal: (g) => g.proteinG, target: 'atLeast', format: (v) => `${fr(v)} g`, emptyHint: 'Ajoute un repas pour voir tes protéines.' },
  { id: 'carbs', section: 'nutrition', label: 'Glucides', unit: 'g', tint: 'carbs', kind: 'bars', value: (f) => f.carbsG, target: 'none', format: (v) => `${fr(v)} g`, emptyHint: 'Ajoute un repas pour voir tes glucides.' },
  { id: 'fat', section: 'nutrition', label: 'Lipides', unit: 'g', tint: 'fat', kind: 'bars', value: (f) => f.fatG, target: 'none', format: (v) => `${fr(v)} g`, emptyHint: 'Ajoute un repas pour voir tes lipides.' },
  { id: 'water', section: 'eau', label: 'Eau', unit: 'L', tint: 'water', kind: 'bars', value: (f) => f.waterMl, goal: (g) => g.waterMl, target: 'atLeast', format: (v) => `${fr(v / 1000, 2)} L`, emptyHint: 'Ajoute un verre d’eau pour voir ta courbe.' },
  { id: 'steps', section: 'activite', label: 'Pas', unit: 'pas', tint: 'steps', kind: 'bars', value: (f) => f.steps, goal: (g) => g.steps, target: 'atLeast', format: (v) => `${fr(v)} pas`, emptyHint: 'Aucun pas enregistré : ils arriveront quand Health Connect ou ton Fitbit sera branché.' },
  { id: 'weight', section: 'corps', label: 'Poids', unit: 'kg', tint: 'weight', kind: 'line', value: (f) => f.weightKg, target: 'none', format: (v) => `${fr(v, 1)} kg`, emptyHint: 'Aucune pesée enregistrée pour l’instant.' },
  { id: 'waist', section: 'corps', label: 'Tour de taille', unit: 'cm', tint: 'waist', kind: 'line', value: (f) => f.waistCm, target: 'none', format: (v) => `${fr(v, 1)} cm`, emptyHint: 'Aucune mesure de tour de taille pour l’instant.' },
  { id: 'volume', section: 'entrainement', label: 'Volume', unit: 'kg', tint: 'training', kind: 'bars', value: (f) => f.volumeKg, target: 'none', format: (v) => `${fr(v)} kg`, emptyHint: 'Termine une séance pour voir ton volume.' },
];

export const metricById = (id: string) => METRICS.find((m) => m.id === id);
export const metricsOf = (section: SectionId) => METRICS.filter((m) => m.section === section);

export const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'nutrition', label: 'Nutrition', icon: 'silverware-fork-knife' },
  { id: 'activite', label: 'Activité', icon: 'walk' },
  { id: 'corps', label: 'Corps', icon: 'scale-bathroom' },
  { id: 'entrainement', label: 'Entraînement', icon: 'dumbbell' },
  { id: 'eau', label: 'Eau', icon: 'water' },
];
export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);

/** The cards the hub starts with. */
export const DEFAULT_HUB = ['calories', 'protein', 'water', 'steps', 'weight', 'volume'];
