import { addDays, dayKey, type Clock } from '@/shared/clock';
import { withTimeout } from '@/shared/withTimeout';
import { reachedByMeasure, rollingMean, validateMeasure, type Measure } from '../domain/body';
import type { BodyRepository } from './ports';

/** The milestones the body use cases check a measure against (the training module's list). */
export type MilestoneList = () => Promise<{ id: string; metric: string; target: number; direction: 'up' | 'down'; achievedAt?: Date }[]>;

/** What Today shows of the body: the measures of the day, and the mean over the last seven days. */
export type BodySummary = { today: Measure; weightAverage?: number };

const MILESTONES_WAIT_MS = 1500;

export function bodyUseCases(deps: { repo: BodyRepository; milestones: MilestoneList; clock: Clock; timezone: string }) {
  const { repo, milestones, clock, timezone } = deps;

  return {
    /** Records the measure of `day` (today by default); returns the milestones it reached, by id. */
    async save(measure: Measure, day = dayKey(clock.now(), timezone)) {
      const problem = validateMeasure(measure);
      if (problem) throw new Error(problem);
      // A milestone that cannot be read now (offline, the read waits for the network) is reached by a later measure: the measure itself
      // is kept, at once.
      const reached = reachedByMeasure(await withTimeout(milestones().catch(() => []), MILESTONES_WAIT_MS, []), measure);
      await repo.save(day, measure, reached, clock.now());
      return reached;
    },

    /** The measures of `day` and the mean of the seven days up to it, live. */
    observeSummary(day: string, onNext: (summary: BodySummary) => void, onError: (error: Error) => void) {
      const week = Array.from({ length: 7 }, (_, i) => addDays(day, -i));
      return repo.observeRecent(
        week[6],
        day,
        (days) =>
          onNext({
            today: days.get(day) ?? {},
            weightAverage: rollingMean(week.map((d) => days.get(d)?.weightKg)),
          }),
        onError,
      );
    },
  };
}

export type BodyUseCases = ReturnType<typeof bodyUseCases>;
