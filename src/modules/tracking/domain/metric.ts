import type { Bucket } from './period';

/** What was recorded on one day, whichever module recorded it; a missing field is a day with no such record. */
export type DayFacts = {
  waterMl?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  steps?: number;
  weightKg?: number;
  waistCm?: number;
  /** Σ reps × kg over the day's workouts. */
  volumeKg?: number;
  sessions?: number;
  /** Cravings noted, and the cigarettes smoked among them. */
  cravings?: number;
  smoked?: number;
  /** The nutrients of the day's meals (the amounts that are known), and the ids of those that at least one meal lacks. */
  nutrients?: Record<string, number>;
  incomplete?: string[];
};

/** The goals of the profile that the charts measure against. */
export type Goals = {
  kcal: number;
  /** What the calories goal is for (the settings' goal mode, redeclared); missing is keeping the weight. */
  kcalMode?: 'deficit' | 'maintenance' | 'surplus';
  proteinG: number;
  waterMl: number;
  steps: number;
  /** The reference intake of each nutrient for the profile; none under 18. */
  nutrients?: Record<string, number>;
};

/** How a finished day compares with its goal (spec §9); `none` for a metric with no goal to hit. */
export type Tone = 'good' | 'warn' | 'bad' | 'none';

/** Where a metric's facts are read: each metric listens to one source only. */
export type SourceId = 'days' | 'training' | 'tobacco' | 'meals';

export type SectionId = 'nutrition' | 'micro' | 'activite' | 'corps' | 'entrainement' | 'eau' | 'tabac';
export type Tint = 'water' | 'calories' | 'protein' | 'carbs' | 'fat' | 'micro' | 'steps' | 'weight' | 'waist' | 'training' | 'tobacco';

/** One thing the Suivi screens can chart (spec §6): adding a statistic is adding one of these to the registry. */
export type MetricDefinition = {
  id: string;
  section: SectionId;
  label: string;
  tint: Tint;
  source: SourceId;
  /** Bars for what adds up over a day, a line for a measure. */
  kind: 'bars' | 'line';
  value: (facts: DayFacts) => number | undefined;
  /** Undefined when the goal is not known (a nutrient without reference). */
  goal?: (goals: Goals) => number | undefined;
  /** `atLeast`: at 90 % of the goal or more is on target; `atMost`: up to the goal; `calories`: from 90 % to 105 %; `none`: no target. */
  target: 'atLeast' | 'atMost' | 'calories' | 'none';
  format: (value: number) => string;
  /** Whether the day view compares the day with the day before: only for what one measure a day gives (spec §6), not for a total that is still adding up. */
  dayCompare: boolean;
  /** What to say when nothing was recorded in the period. */
  emptyHint: string;
  /** Whether the value of that day is only a minimum (a meal lacks the nutrient). */
  incomplete?: (facts: DayFacts) => boolean;
};

/** A bucket drawn on a chart: its value (the mean of its finished days), and whether it is only today's value so far. */
export type Point = { bucket: Bucket; value?: number; partial: boolean; tone: Tone };

export type Summary = { average?: number; daysInTarget: number; daysCounted: number; best?: { day: string; value: number } };
