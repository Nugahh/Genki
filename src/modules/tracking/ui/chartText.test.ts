import { bucketsFor } from '../domain/period';
import { metricById } from '../domain/metrics';
import type { Point } from '../domain/metric';
import { chartText } from './chartText';

const calories = metricById('calories')!;
const week = bucketsFor('week', '2026-10-31');
const point = (i: number, patch: Partial<Point>): Point => ({ bucket: week[i], partial: false, tone: 'none', ...patch });

test('says each bucket that has a value, with its tone in words, and the goal', () => {
  const points = [point(0, { value: 1900, tone: 'good' }), point(1, { value: 2400, tone: 'bad' }), point(2, {}), point(5, { value: 1200, partial: true })];
  const text = chartText(calories, points, 2000);
  expect(text).toContain('lun. 1');
  expect(text).toContain(', dans la cible');
  expect(text).toContain(', loin de la cible');
  expect(text).toContain('sam. 1');
  expect(text).toContain('(en cours)');
  expect(text).not.toContain('mer.');
  expect(text).toContain(`Objectif ${calories.format(2000)}.`);
});

test('says there is no data', () => expect(chartText(calories, [point(0, {})])).toBe('Calories : aucune donnée.'));
