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
};

/** The goals of the profile that the charts measure against. */
export type Goals = {
  kcal: number;
  /** What the calories goal is for (the settings' goal mode, redeclared); missing is keeping the weight. */
  kcalMode?: 'deficit' | 'maintenance' | 'surplus';
  proteinG: number;
  waterMl: number;
  steps: number;
};

/** How a finished day compares with its goal (spec §9); `none` for a metric with no goal to hit. */
export type Tone = 'good' | 'warn' | 'bad' | 'none';

/** Where a metric's facts are read: each metric listens to one source only. */
export type SourceId = 'days' | 'training';

export type SectionId = 'nutrition' | 'activite' | 'corps' | 'entrainement' | 'eau';
export type Tint = 'water' | 'calories' | 'protein' | 'carbs' | 'fat' | 'steps' | 'weight' | 'waist' | 'training';

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
  goal?: (goals: Goals) => number;
  /** `atLeast`: at 90 % of the goal or more is on target; `calories`: from 90 % to 105 %; `none`: no target. */
  target: 'atLeast' | 'calories' | 'none';
  format: (value: number) => string;
  /** Whether the day view compares the day with the day before: only for what one measure a day gives (spec §6), not for a total that is still adding up. */
  dayCompare: boolean;
  /** What to say when nothing was recorded in the period. */
  emptyHint: string;
};

/** A bucket drawn on a chart: its value (the mean of its finished days), and whether it is only today's value so far. */
export type Point = { bucket: Bucket; value?: number; partial: boolean; tone: Tone };

export type Summary = { average?: number; daysInTarget: number; daysCounted: number; best?: { day: string; value: number } };
