export type WaterContainer = { label: string; ml: number };
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'active';
/** What the calories goal is for: eating less than the energy spent, as much, or more. It decides the colors of the calories gauge. */
export type GoalMode = 'deficit' | 'maintenance' | 'surplus';
/** `carbsNetG` is the carbohydrates minus the fibre. */
export type Goals = { kcal: number; proteinG: number; carbsNetG: number; fatG: number; waterMl: number; steps: number };

/** `users/{uid}` (spec §4). A field that was never chosen has its default, so the app works before the setup screen. */
export type Profile = {
  timezone: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goalMode: GoalMode;
  /** The weight loss aimed at, in kg a week, when it is not the default deficit. */
  weeklyLossKg?: number;
  goals: Goals;
  /** The day of the last cigarette (`YYYY-MM-DD`). */
  quitDate?: string;
  cigarettesPerDay?: number;
  packSize: number;
  packPrice?: number;
  waterContainers: WaterContainer[];
  /** Set when the setup screen was done or skipped. */
  createdAt?: Date;
};

export const DEFAULT_PROFILE: Profile = {
  timezone: 'Europe/Paris',
  // Placeholders until the setup screen (M6): they keep the gauges working, and the goals mode keeps the weight.
  sex: 'male',
  birthYear: 1996,
  heightCm: 175,
  activityLevel: 'light',
  goalMode: 'maintenance',
  goals: { waterMl: 2500, kcal: 2200, proteinG: 130, carbsNetG: 255, fatG: 75, steps: 8000 },
  packSize: 20,
  waterContainers: [
    { label: 'Verre', ml: 250 },
    { label: 'Bouteille', ml: 500 },
  ],
};

const within = (n: number | undefined, min: number, max: number) => n !== undefined && Number.isFinite(n) && n >= min && n <= max;
// A day that exists: 2026-02-31 would roll over to 3 March.
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** A French message for the first problem with a profile, or null. The bounds are those of the Firestore rules. */
export function validateProfile(profile: Profile): string | null {
  if (!within(profile.heightCm, 100, 250)) return 'La taille est comprise entre 100 et 250 cm.';
  if (!Number.isInteger(profile.birthYear) || !within(profile.birthYear, 1900, new Date().getFullYear())) return 'L’année de naissance n’est pas valide.';
  const { goals } = profile;
  if (!within(goals.kcal, 800, 10000)) return 'Les calories sont comprises entre 800 et 10 000 par jour.';
  if (!within(goals.proteinG, 0, 500)) return 'Les protéines sont comprises entre 0 et 500 g par jour.';
  if (!within(goals.carbsNetG, 0, 1000)) return 'Les glucides nets sont compris entre 0 et 1 000 g par jour.';
  if (!within(goals.fatG, 0, 500)) return 'Les lipides sont compris entre 0 et 500 g par jour.';
  if (!within(goals.waterMl, 500, 10000)) return 'L’eau est comprise entre 0,5 et 10 L par jour.';
  if (!within(goals.steps, 0, 100000)) return 'Les pas sont compris entre 0 et 100 000 par jour.';
  if (profile.weeklyLossKg !== undefined && !within(profile.weeklyLossKg, 0.1, 2)) return 'La perte visée est comprise entre 0,1 et 2 kg par semaine.';
  if (profile.quitDate !== undefined && !isDay(profile.quitDate)) return 'La date d’arrêt du tabac n’est pas valide.';
  if (profile.cigarettesPerDay !== undefined && !(Number.isInteger(profile.cigarettesPerDay) && within(profile.cigarettesPerDay, 0, 200))) return 'Le nombre de cigarettes par jour est un entier de 0 à 200.';
  if (!(Number.isInteger(profile.packSize) && within(profile.packSize, 1, 100))) return 'Un paquet contient entre 1 et 100 cigarettes.';
  if (profile.packPrice !== undefined && !within(profile.packPrice, 0, 100)) return 'Le prix du paquet est compris entre 0 et 100 €.';
  const { waterContainers } = profile;
  if (waterContainers.length < 1 || waterContainers.length > 6) return 'Il faut entre 1 et 6 contenants d’eau.';
  for (const c of waterContainers) {
    if (c.label.trim() === '' || c.label.length > 30) return 'Le nom d’un contenant fait entre 1 et 30 caractères.';
    if (!within(c.ml, 1, 5000)) return 'Un contenant fait entre 1 et 5 000 ml.';
  }
  return null;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Fat is 30 % of the energy (9 kcal a gram); the net carbs are what is left after the protein (4 kcal a gram). Both to the nearest 5 g. */
export const macroGoals = (kcal: number, proteinG: number) => ({
  fatG: roundTo((0.3 * kcal) / 9, 5),
  carbsNetG: Math.max(0, roundTo((0.7 * kcal - 4 * proteinG) / 4, 5)),
});

/** The stored fields over the defaults; the goals field by field. Fat and net carbs that were never chosen follow the calories and protein that were. */
export function withDefaults(stored: Partial<Profile>): Profile {
  const goals = { ...DEFAULT_PROFILE.goals, ...stored.goals };
  return { ...DEFAULT_PROFILE, ...stored, goals: { ...goals, ...macroGoals(goals.kcal, goals.proteinG), ...stored.goals } };
}
