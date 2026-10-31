import { dayKey, type Clock } from '@/shared/clock';
import type { DayFacts, Goals, MetricDefinition, Point, Summary } from '../domain/metric';
import { bucketsFor, rangeOf, shiftAnchor, type Bucket, type Period } from '../domain/period';
import { headline, macroSplit, seriesFor, summarize, variation } from '../domain/series';
import type { FactsSource } from './ports';

/** What a chart and a card need to show one metric over one period. */
export type MetricView = {
  buckets: Bucket[];
  points: Point[];
  summary: Summary;
  /** The same summary one period earlier (the week before, the day before, the year before). */
  previous: Summary;
  /** The number a card shows, and how it moved since the period before. */
  headline?: number;
  change?: number;
  goal?: number;
  /** Where the energy came from over the period, when macros were recorded. */
  split?: ReturnType<typeof macroSplit>;
};

export function trackingUseCases(deps: { sources: FactsSource[]; goals: Goals; clock: Clock; timezone: string }) {
  const { sources, goals, clock, timezone } = deps;

  return {
    /**
     * Calls `onNext` with the view of the metric over the period holding `anchor`, again whenever a source changes.
     * It waits until every source has answered once; the range read is the period and the one before it.
     */
    observeMetric(def: MetricDefinition, period: Period, anchor: string, onNext: (view: MetricView) => void, onError: (error: Error) => void) {
      const buckets = bucketsFor(period, anchor);
      const range = rangeOf(buckets);
      const previousRange = rangeOf(bucketsFor(period, shiftAnchor(period, anchor, -1)));
      const latest: (Map<string, DayFacts> | undefined)[] = sources.map(() => undefined);

      const publish = () => {
        if (latest.some((facts) => facts === undefined)) return;
        const facts = new Map<string, DayFacts>();
        for (const part of latest) for (const [day, fields] of part!) facts.set(day, { ...facts.get(day), ...fields });
        const today = dayKey(clock.now(), timezone);
        const points = seriesFor(def, goals, buckets, facts, today);
        const summary = summarize(def, goals, range, facts, today);
        const previous = summarize(def, goals, previousRange, facts, today);
        const shown = headline(period, points, summary);
        onNext({ buckets, points, summary, previous, headline: shown, change: variation(shown, previous.average), goal: def.goal?.(goals), split: macroSplit(range, facts, today) });
      };

      const stops = sources.map((source, i) =>
        source.observeRange(
          previousRange.from,
          range.to,
          (facts) => {
            latest[i] = facts;
            publish();
          },
          onError,
        ),
      );
      return () => stops.forEach((stop) => stop());
    },
  };
}

export type TrackingUseCases = ReturnType<typeof trackingUseCases>;
