import type { MetricDefinition, Point, Tone } from '../domain/metric';

// The tone is a color on the chart: said in words here, it is not the color alone that tells it.
const TONE_WORDS: Record<Tone, string> = { good: ', dans la cible', warn: ', proche de la cible', bad: ', loin de la cible', none: '' };

/** The chart in words, for a screen reader: each bucket with a value, its tone, and the goal. */
export function chartText(def: MetricDefinition, points: Point[], goal?: number): string {
  const items = points.filter((p) => p.value !== undefined).map((p) => `${p.bucket.label} ${def.format(p.value!)}${p.partial ? ' (en cours)' : TONE_WORDS[p.tone]}`);
  if (items.length === 0) return `${def.label} : aucune donnée.`;
  return `${def.label} : ${items.join(' ; ')}.${goal ? ` Objectif ${def.format(goal)}.` : ''}`;
}
