import { inMemoryFavoriteMealRepository, inMemoryFoodEntryRepository, mealUseCases } from '@/modules/nutrition';
import type { DayFacts } from '../domain/metric';
import { mealsFactsSource } from './mealsFactsSource';

const clock = { now: () => new Date('2026-10-11T10:00:00Z') };

test('adds up the nutrients of each day and lists those that a meal lacks', async () => {
  const entries = inMemoryFoodEntryRepository();
  const meals = mealUseCases({ entries, favorites: inMemoryFavoriteMealRepository(), clock, timezone: 'Europe/Paris' });
  const at = (day: string) => new Date(`${day}T10:00:00Z`);
  const add = (day: string, nutrients?: Record<string, number>) =>
    entries.add({ day, meal: 'lunch', foodRef: { type: 'ciqual', id: 'x' }, foodName: 'x', grams: 100, macros: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, nutrients, createdAt: at(day) });
  await add('2026-10-09', { vitC: 10, iron: 1 });
  await add('2026-10-09', { vitC: 5 });
  await add('2026-10-10', { vitC: 7 });
  await add('2026-10-20', { vitC: 99 }); // out of the range

  let seen = new Map<string, DayFacts>();
  mealsFactsSource(meals).observeRange('2026-10-01', '2026-10-15', (facts) => (seen = facts), () => {});
  expect([...seen.keys()]).toEqual(['2026-10-09', '2026-10-10']);
  expect(seen.get('2026-10-09')?.nutrients).toEqual({ vitC: 15, iron: 1 });
  expect(seen.get('2026-10-09')?.incomplete).toContain('iron');
  expect(seen.get('2026-10-09')?.incomplete).not.toContain('vitC');
  expect(seen.get('2026-10-10')?.incomplete).toContain('iron');
});

test('a day with an entry that has no nutrients has none and everything is incomplete', async () => {
  const entries = inMemoryFoodEntryRepository();
  const meals = mealUseCases({ entries, favorites: inMemoryFavoriteMealRepository(), clock, timezone: 'Europe/Paris' });
  await entries.add({ day: '2026-10-09', meal: 'lunch', foodRef: { type: 'custom', id: 'c' }, foodName: 'Pain', grams: 100, macros: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, createdAt: new Date('2026-10-09T10:00:00Z') });
  let seen = new Map<string, DayFacts>();
  mealsFactsSource(meals).observeRange('2026-10-01', '2026-10-15', (facts) => (seen = facts), () => {});
  expect(seen.get('2026-10-09')?.nutrients).toEqual({});
  expect(seen.get('2026-10-09')?.incomplete).toHaveLength(26);
});
