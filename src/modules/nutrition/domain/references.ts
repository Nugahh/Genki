import type { NutrientId, Nutrients } from './nutrients';

export type Who = { sex: 'male' | 'female'; age: number };

// ANSES, « Actualisation des repères du PNNS : élaboration des références nutritionnelles » (2016), tables 26 (men) and 27 (women):
// the RNP when there is one, else the AS. [man, woman]. Not from the ANSES: vitamin K is the EFSA's AS (2017), potassium the WHO's (2012),
// sugars the PNNS's (lactose excluded there, counted by Ciqual: indicative). Salt: the 2 000 mg of sodium the ANSES keeps for a Na/K of 1.
const FIXED: Partial<Record<NutrientId, [number, number]>> = {
  vitA: [750, 650], vitD: [15, 15], vitE: [10.5, 9.9], vitK: [70, 70], vitC: [110, 110],
  vitB1: [1.5, 1.2], vitB2: [1.8, 1.5], vitB3: [17.4, 14], vitB5: [5.8, 4.7], vitB6: [1.8, 1.5], vitB9: [330, 330], vitB12: [4, 4],
  iron: [11, 11], magnesium: [420, 360], potassium: [3510, 3510], zinc: [11.7, 9.3], selenium: [70, 70], iodine: [150, 150],
  phosphorus: [700, 700], copper: [1.3, 1], manganese: [2.8, 2.5], fiber: [30, 30], salt: [5, 5], sugars: [100, 100],
};

// shortcut: adults only (under 18 the ANSES table differs), no pregnancy, no heavy iron losses (16 mg); upgrade if the profile ever holds them.
/** The reference intakes of an adult for a day: what to reach, or the ceiling for salt, saturated fat and sugars. None under 18. */
export function referencesFor(who: Who, kcalGoal: number): Nutrients {
  if (!Number.isFinite(who.age) || who.age < 18) return {};
  const i = who.sex === 'male' ? 0 : 1;
  const refs: Nutrients = {};
  for (const [id, pair] of Object.entries(FIXED) as [NutrientId, [number, number]][]) refs[id] = pair[i];
  refs.calcium = who.age < 25 ? 1000 : 950;
  // The ANSES caps saturated fat at 12 % of the energy; fat gives 9 kcal a gram.
  if (Number.isFinite(kcalGoal) && kcalGoal > 0) refs.saturatedFat = Math.round(((kcalGoal * 0.12) / 9) * 10) / 10;
  return refs;
}
