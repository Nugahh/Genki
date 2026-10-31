import type { LoggedSet } from '../domain/workout';

/** A load the French way: 22,5 kg. */
export const kgText = (kg: number) => `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;

const one = (s: LoggedSet) => (s.kg > 0 ? `${s.reps} × ${kgText(s.kg)}` : `${s.reps}`);

/** What was done: « 3 × 8 à 20 kg » when the sets are alike, else each set in turn. */
export function setsText(sets: LoggedSet[]): string {
  if (sets.length === 0) return '';
  const alike = sets.every((s) => s.reps === sets[0].reps && s.kg === sets[0].kg);
  if (alike) return `${sets.length} × ${sets[0].reps}${sets[0].kg > 0 ? ` à ${kgText(sets[0].kg)}` : ''}`;
  return sets.map(one).join(' · ');
}

/** A number typed with a comma or a point; NaN when empty or not a number. */
export const parseNumber = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));

/** A number as it is typed in a field, with a comma: the way back from `parseNumber`. */
export const asText = (n: number) => String(n).replace('.', ',');
