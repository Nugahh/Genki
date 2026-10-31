import { dayKey, type Clock } from '@/shared/clock';
import type { Goals, MetricDefinition, Point, SourceId, Summary } from '../domain/metric';
import { bucketsFor, rangeOf, shiftAnchor, type Period } from '../domain/period';
import { headline, macroSplit, seriesFor, summarize, variation } from '../domain/series';
import type { FactsSource } from './ports';

/** What a chart and a card need to show one metric over one period. */
export type MetricView = {
  points: Point[];
  summary: Summary;
  /** The number a card shows, and how it moved since the period before (in the day view only for a measure, never for a total still adding up). */
  headline?: number;
  change?: number;
  goal?: number;
  /** Where the energy came from over the period, for the nutrition metrics. */
  split?: ReturnType<typeof macroSplit>;
};

export function trackingUseCases(deps: { sources: Record<SourceId, FactsSource>; goals: Goals; clock: Clock; timezone: string }) {
  const { sources, goals, clock, timezone } = deps;

  return {
    /**
     * Calls `onNext` with the view of the metric over the period holding `anchor`, again whenever its source changes.
     * The read is the period and the one before it. Only the source the metric names is listened to.
     */
    observeMetric(def: MetricDefinition, period: Period, anchor: string, onNext: (view: MetricView) => void, onError: (error: Error) => void) {
      const buckets = bucketsFor(period, anchor);
      const range = rangeOf(buckets);
      const previousRange = rangeOf(bucketsFor(period, shiftAnchor(period, anchor, -1)));

      return sources[def.source].observeRange(
        previousRange.from,
        range.to,
        (facts) => {
          const today = dayKey(clock.now(), timezone);
          const points = seriesFor(def, goals, buckets, facts, today);
          const summary = summarize(def, goals, range, facts, today);
          const shown = headline(period, points, summary);
          const compare = period !== 'day' || def.dayCompare;
          onNext({
            points,
            summary,
            headline: shown,
            change: compare ? variation(shown, summarize(def, goals, previousRange, facts, today).average) : undefined,
            goal: def.goal?.(goals),
            split: def.section === 'nutrition' ? macroSplit(range, facts, today) : undefined,
          });
        },
        onError,
      );
    },
  };
}

export type TrackingUseCases = ReturnType<typeof trackingUseCases>;
