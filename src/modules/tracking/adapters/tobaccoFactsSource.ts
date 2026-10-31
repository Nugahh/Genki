import type { TobaccoUseCases } from '@/modules/tobacco';
import type { FactsSource } from '../application/ports';
import type { DayFacts } from '../domain/metric';

/** The cravings noted each day, and the cigarettes smoked among them. */
export function tobaccoFactsSource(tobacco: Pick<TobaccoUseCases, 'observeCravingsBetween'>): FactsSource {
  return {
    observeRange(from, to, onNext, onError) {
      return tobacco.observeCravingsBetween(
        from,
        to,
        (cravings) => {
          const facts = new Map<string, DayFacts>();
          for (const c of cravings) {
            const day = facts.get(c.day) ?? { cravings: 0, smoked: 0 };
            facts.set(c.day, { cravings: (day.cravings ?? 0) + 1, smoked: (day.smoked ?? 0) + (c.resisted ? 0 : 1) });
          }
          // A day with no cigarette has no « smoked » record: it is not a day at 0.
          for (const [day, f] of facts) if (f.smoked === 0) facts.set(day, { cravings: f.cravings });
          onNext(facts);
        },
        onError,
      );
    },
  };
}
