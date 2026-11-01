import type { NutrientInfo } from '@/modules/nutrition';
import { dayKey, type Clock } from '@/shared/clock';
import type { DayFacts, Goals, MetricDefinition, Point, SourceId, Summary, Tone } from '../domain/metric';
import { bucketsFor, rangeOf, shiftAnchor, type Period } from '../domain/period';
import { headline, macroSplit, seriesFor, summarize, toneOf, variation } from '../domain/series';
import type { FactsSource } from './ports';
import { NUTRIENT_METRICS } from './registry';

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
  /** Whether some of the period's values are minimums: a meal lacks the nutrient. */
  incomplete?: boolean;
};

/** One nutrient over a period: its amount (a day's total, else the mean of the finished days), and where that stands against the reference. */
export type MicroRow = {
  info: NutrientInfo;
  def: MetricDefinition;
  value?: number;
  /** The amount is a minimum: a meal of the period lacks this nutrient. */
  incomplete: boolean;
  reference?: number;
  /** The share of the reference, in percent. */
  pct?: number;
  tone: Tone;
};

export function trackingUseCases(deps: { sources: Record<SourceId, FactsSource>; clock: Clock; timezone: string }) {
  const { sources, clock, timezone } = deps;

  const periodOf = (period: Period, anchor: string) => {
    const buckets = bucketsFor(period, anchor);
    return { period, buckets, range: rangeOf(buckets), previousRange: rangeOf(bucketsFor(period, shiftAnchor(period, anchor, -1))) };
  };

  /** The view of one metric over the period, from the facts of the period and the one before it. */
  function viewOf(def: MetricDefinition, goals: Goals, p: ReturnType<typeof periodOf>, facts: Map<string, DayFacts>): MetricView {
    const today = dayKey(clock.now(), timezone);
    const points = seriesFor(def, goals, p.buckets, facts, today);
    const summary = summarize(def, goals, p.range, facts, today);
    const shown = headline(p.period, points, summary);
    const compare = p.period !== 'day' || def.dayCompare;
    const lacking = def.incomplete;
    return {
      points,
      summary,
      headline: shown,
      change: compare ? variation(shown, summarize(def, goals, p.previousRange, facts, today).average) : undefined,
      goal: def.goal?.(goals),
      split: def.section === 'nutrition' ? macroSplit(p.range, facts, today) : undefined,
      // The days that count: the day itself, else the finished days (today's meals are not in the mean).
      incomplete: lacking ? [...facts].some(([day, f]) => day >= p.range.from && day <= p.range.to && (p.period === 'day' || day < today) && lacking(f)) : undefined,
    };
  }

  return {
    /**
     * Calls `onNext` with the view of the metric over the period holding `anchor`, measured against `goals`, again whenever its source changes.
     * The read is the period and the one before it. Only the source the metric names is listened to.
     */
    observeMetric(def: MetricDefinition, goals: Goals, period: Period, anchor: string, onNext: (view: MetricView) => void, onError: (error: Error) => void) {
      const p = periodOf(period, anchor);
      return sources[def.source].observeRange(p.previousRange.from, p.range.to, (facts) => onNext(viewOf(def, goals, p, facts)), onError);
    },

    /** The 26 nutrients over a period, from one read of the meals (no change since the period before is shown, so only the period is read). */
    observeMicronutrients(goals: Goals, period: Period, anchor: string, onNext: (rows: MicroRow[]) => void, onError: (error: Error) => void) {
      const p = periodOf(period, anchor);
      return sources.meals.observeRange(
        p.range.from,
        p.range.to,
        (facts) =>
          onNext(
            NUTRIENT_METRICS.map(({ info, def }) => {
              const view = viewOf(def, goals, p, facts);
              const value = view.headline;
              const reference = view.goal;
              const incomplete = view.incomplete ?? false;
              // A day has its own tone (none while it is in progress); a longer period is judged on its mean.
              const tone = period === 'day' ? (view.points[0]?.tone ?? 'none') : value === undefined ? 'none' : toneOf(def, goals, value, incomplete);
              return { info, def, value, incomplete, reference, pct: value !== undefined && reference ? Math.round((value / reference) * 100) : undefined, tone };
            }),
          ),
        onError,
      );
    },
  };
}

export type TrackingUseCases = ReturnType<typeof trackingUseCases>;
