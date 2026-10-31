import { dayKey, type Clock } from '@/shared/clock';
import { savings, streaks, type Craving, type Streaks } from '../domain/tobacco';
import type { CravingRepository } from './ports';

/** The streaks and what they save, for the card and the section. */
export type TobaccoSummary = Streaks & { savedEuros?: number };

/** What the summary needs of the profile. */
export type QuitProfile = { quitDate?: string; cigarettesPerDay?: number; packPrice?: number; packSize: number };

const FAR_FUTURE = '9999-12-31';

export function tobaccoUseCases(deps: { repo: CravingRepository; clock: Clock; timezone: string }) {
  const { repo, clock, timezone } = deps;

  return {
    /** The craving is in at once (`craving` is what it takes to take it back); `saved` settles once the server has it. */
    logCraving(resisted: boolean) {
      const now = clock.now();
      const craving = { day: dayKey(now, timezone), createdAt: now, resisted };
      const { id, saved } = repo.add(craving);
      return { craving: { id, ...craving }, saved };
    },
    removeCraving: (craving: Craving) => repo.remove(craving.id),

    /** The cravings of a day, newest first. */
    observeDay(day: string, onNext: (cravings: Craving[]) => void, onError: (error: Error) => void) {
      return repo.observeBetween(day, day, (list) => onNext([...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())), onError);
    },
    /** The cravings between two days: what the charts of the Suivi count. */
    observeCravingsBetween: repo.observeBetween,

    /** Days without tobacco since the quit date, the record, and the money kept; zero (nothing read) without a quit date. */
    observeSummary(profile: QuitProfile, onNext: (summary: TobaccoSummary) => void, onError: (error: Error) => void) {
      const { quitDate } = profile;
      const publish = (relapseDays: string[]) => {
        const result = streaks(quitDate, relapseDays, dayKey(clock.now(), timezone));
        onNext({ ...result, savedEuros: savings(result.smokeFreeDays, profile) });
      };
      if (!quitDate) {
        publish([]);
        return () => {};
      }
      return repo.observeBetween(quitDate, FAR_FUTURE, (list) => publish(list.filter((c) => !c.resisted).map((c) => c.day)), onError);
    },
  };
}

export type TobaccoUseCases = ReturnType<typeof tobaccoUseCases>;
