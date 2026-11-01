import { sumNutrients, type FoodEntry, type MealUseCases } from '@/modules/nutrition';
import type { FactsSource } from '../application/ports';
import type { DayFacts } from '../domain/metric';

/** The nutrients of the meals of each day, added up from its journal entries (nothing is stored: the entries are the record). */
export function mealsFactsSource(meals: Pick<MealUseCases, 'observeBetween'>): FactsSource {
  return {
    observeRange(from, to, onNext, onError) {
      return meals.observeBetween(
        from,
        to,
        (entries) => {
          const byDay = new Map<string, FoodEntry[]>();
          for (const entry of entries) byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
          const facts = new Map<string, DayFacts>();
          for (const [day, list] of byDay) {
            const { totals, incomplete } = sumNutrients(list.map((e) => e.nutrients));
            facts.set(day, { nutrients: totals, incomplete });
          }
          onNext(facts);
        },
        onError,
      );
    },
  };
}
