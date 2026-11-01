import { NUTRIENTS } from '@/modules/nutrition';
import { sectionById } from '../domain/metrics';
import { ALL_METRICS, findMetric, metricsIn, NUTRIENT_METRICS } from './registry';

test('every metric has a section, and ids are unique', () => {
  expect(new Set(ALL_METRICS.map((m) => m.id)).size).toBe(ALL_METRICS.length);
  expect(ALL_METRICS.every((m) => sectionById(m.section))).toBe(true);
});

test('has a metric for each nutrient of the catalogue, in its section', () => {
  expect(NUTRIENT_METRICS).toHaveLength(NUTRIENTS.length);
  expect(metricsIn('micro').map((m) => m.id)).toEqual(NUTRIENTS.map((n) => n.id));
  expect(metricsIn('nutrition').map((m) => m.id)).toEqual(['calories', 'protein', 'carbs', 'fat']);
});

test('a nutrient reads its amount, its reference and its incompleteness', () => {
  const iron = findMetric('iron')!;
  const facts = { nutrients: { iron: 8.25 }, incomplete: ['iron'] };
  expect(iron.value(facts)).toBe(8.25);
  expect(iron.value({})).toBeUndefined();
  expect(iron.goal?.({ kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000, nutrients: { iron: 11 } })).toBe(11);
  expect(iron.incomplete?.(facts)).toBe(true);
  expect(iron.incomplete?.({ nutrients: { iron: 8 }, incomplete: [] })).toBe(false);
  expect(iron.format(8.25)).toBe('8,25 mg');
  expect(iron.format(184.3)).toBe('184 mg');
});

test('what to reach is at least, what to limit is at most', () => {
  expect(findMetric('vitC')!.target).toBe('atLeast');
  expect(findMetric('salt')!.target).toBe('atMost');
  expect(findMetric('saturatedFat')!.target).toBe('atMost');
  expect(findMetric('sugars')!.target).toBe('atMost');
});
