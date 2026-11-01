import { macroGoals, type ActivityLevel, type Goals, type Profile, type Sex } from './profile';

/** Constants of the domain, not editable from the interface (spec §9, « Garde-fous »). */
export const GUARDRAILS = {
  minKcal: 1500,
  /** The most weight loss proposed, in % of the body weight a week. */
  maxWeeklyLossPct: 1,
  deficitKcal: 400,
  surplusKcal: 250,
} as const;

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { sedentary: 1.2, light: 1.375, active: 1.55 };
// A kilogram of fat is about 7 700 kcal.
const KCAL_PER_KG_A_WEEK_PER_DAY = 7700 / 7;

const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Basal metabolic rate, Mifflin-St Jeor. */
export const bmr = (sex: Sex, weightKg: number, heightCm: number, age: number) => 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);

/** Energy spent in a day: the basal rate times the activity factor. */
export const dailyEnergy = (profile: Profile, weightKg: number, year: number) =>
  bmr(profile.sex, weightKg, profile.heightCm, year - profile.birthYear) * ACTIVITY_FACTOR[profile.activityLevel];

/** The goals proposed for a profile and a weight, with a French note for each guard-rail that bounded them (spec §9). */
export function proposeGoals(input: { profile: Profile; weightKg: number; year: number }): { goals: Goals; notes: string[] } {
  const { profile, weightKg, year } = input;
  const notes: string[] = [];
  const energy = dailyEnergy(profile, weightKg, year);

  let delta = 0;
  if (profile.goalMode === 'surplus') delta = GUARDRAILS.surplusKcal;
  if (profile.goalMode === 'deficit') {
    let weeklyLoss = profile.weeklyLossKg;
    const cap = (weightKg * GUARDRAILS.maxWeeklyLossPct) / 100;
    if (weeklyLoss !== undefined && weeklyLoss > cap) {
      weeklyLoss = cap;
      notes.push(`Perte limitée à ${GUARDRAILS.maxWeeklyLossPct} % du poids de corps par semaine (${fr(cap)} kg).`);
    }
    delta = -(weeklyLoss === undefined ? GUARDRAILS.deficitKcal : weeklyLoss * KCAL_PER_KG_A_WEEK_PER_DAY);
  }

  let kcal = roundTo(energy + delta, 10);
  if (kcal < GUARDRAILS.minKcal) {
    kcal = GUARDRAILS.minKcal;
    notes.push('Plancher de 1 500 kcal appliqué.');
  }
  notes.push('Consulte un professionnel avant de changer de régime ou de reprendre une activité intense.');
  const proteinG = roundTo(1.7 * weightKg, 5);
  return { goals: { kcal, proteinG, ...macroGoals(kcal, proteinG), waterMl: 2500, steps: 8000 }, notes };
}
