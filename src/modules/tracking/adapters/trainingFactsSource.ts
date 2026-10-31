import type { TrainingUseCases } from '@/modules/training';
import type { FactsSource } from '../application/ports';
import type { DayFacts } from '../domain/metric';

/** The training facts of a day: how many workouts, and the volume lifted (Σ reps × kg over their sets). */
export function trainingFactsSource(training: Pick<TrainingUseCases, 'observeWorkoutsBetween'>): FactsSource {
  return {
    observeRange(from, to, onNext, onError) {
      return training.observeWorkoutsBetween(
        from,
        to,
        (logs) => {
          const facts = new Map<string, DayFacts>();
          for (const log of logs) {
            const day = facts.get(log.day) ?? { volumeKg: 0, sessions: 0 };
            // The rules check the size of the sets list, not its shape: a malformed set counts for nothing.
            const lifted = log.sets.reduce((sum, s) => sum + (Number.isFinite(s.reps * s.kg) ? s.reps * s.kg : 0), 0);
            facts.set(log.day, { volumeKg: (day.volumeKg ?? 0) + lifted, sessions: (day.sessions ?? 0) + 1 });
          }
          onNext(facts);
        },
        onError,
      );
    },
  };
}
