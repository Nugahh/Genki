export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

/** The meal a food is most likely for at this hour (profile time zone): small hours and mid-afternoon are snacks. */
export function defaultMeal(hour: number): Meal {
  if (hour < 4) return 'snack';
  if (hour < 10.5) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}
