import type { MetricDefinition, Point, Tone } from '../domain/metric';

// The tone is a color on the chart: said in words here, it is not the color alone that tells it.
const TONE_WORDS: Record<Tone, string> = { good: ', dans la cible', warn: ', proche de la cible', bad: ', loin de la cible', none: '' };

/** The chart in words, for a screen reader: the period, each bucket with a value (named in full), its tone, and the goal. */
export function chartText(def: MetricDefinition, points: Point[], goal?: number, title?: string): string {
  const head = title ? `${def.label}, ${title}` : def.label;
  const items = points.filter((p) => p.value !== undefined).map((p) => `${p.bucket.spoken}, ${def.format(p.value!)}${p.partial ? ' (en cours)' : TONE_WORDS[p.tone]}`);
  if (items.length === 0) return `${head} : aucune donnée.`;
  return `${head} : ${items.join(' ; ')}.${goal ? ` Objectif ${def.format(goal)}.` : ''}`;
}
