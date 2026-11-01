import { bmr, dailyEnergy, GUARDRAILS, macroGoals, proposeGoals } from './goals';
import { DEFAULT_PROFILE, type Profile } from './profile';

const man: Profile = { ...DEFAULT_PROFILE, sex: 'male', birthYear: 1996, heightCm: 180, activityLevel: 'light', goalMode: 'deficit' };
const woman: Profile = { ...DEFAULT_PROFILE, sex: 'female', birthYear: 1986, heightCm: 155, activityLevel: 'sedentary', goalMode: 'deficit' };

describe('energy', () => {
  test('Mifflin-St Jeor: 10 kg + 6.25 cm - 5 years, +5 for a man and -161 for a woman', () => {
    expect(bmr('male', 80, 180, 30)).toBe(1780);
    expect(bmr('female', 80, 180, 30)).toBe(1614);
  });

  test('the daily energy is the basal rate times the activity factor', () => {
    expect(dailyEnergy(man, 80, 2026)).toBeCloseTo(1780 * 1.375, 5);
    expect(dailyEnergy({ ...man, activityLevel: 'sedentary' }, 80, 2026)).toBeCloseTo(1780 * 1.2, 5);
    expect(dailyEnergy({ ...man, activityLevel: 'active' }, 80, 2026)).toBeCloseTo(1780 * 1.55, 5);
  });
});

describe('proposeGoals', () => {
  const kcal = (profile: Profile, weightKg = 80) => proposeGoals({ profile, weightKg, year: 2026 }).goals.kcal;

  test('a deficit is the energy minus 400, to the nearest 10', () => expect(kcal(man)).toBe(2050));
  test('keeping the weight is the energy itself', () => expect(kcal({ ...man, goalMode: 'maintenance' })).toBe(2450));
  test('gaining is the energy plus 250', () => expect(kcal({ ...man, goalMode: 'surplus' })).toBe(2700));

  test('protein is 1.7 g per kg, to the nearest 5 g, with the water and the steps of the spec', () => {
    expect(proposeGoals({ profile: man, weightKg: 80, year: 2026 }).goals).toEqual({ kcal: 2050, proteinG: 135, carbsNetG: 225, fatG: 70, waterMl: 2500, steps: 8000 });
  });

  test('a loss rate asked for sets the deficit: 1 100 kcal a day for each kg a week', () => {
    expect(kcal({ ...man, weeklyLossKg: 0.5 })).toBe(1900); // 2447.5 - 550
  });

  test('never proposes less than 1 500 kcal, and says so', () => {
    const { goals, notes } = proposeGoals({ profile: woman, weightKg: 50, year: 2026 });
    expect(goals.kcal).toBe(GUARDRAILS.minKcal);
    expect(notes).toContain('Plancher de 1 500 kcal appliqué.');
  });

  test('caps the loss at 1 % of the body weight a week, and says so', () => {
    const { goals, notes } = proposeGoals({ profile: { ...man, weeklyLossKg: 1.2 }, weightKg: 80, year: 2026 });
    expect(goals.kcal).toBe(1570); // 2447.5 - 1100 * 0.8
    expect(notes).toContain('Perte limitée à 1 % du poids de corps par semaine (0,8 kg).');
  });

  test('always reminds to see a professional, last', () => {
    const { notes } = proposeGoals({ profile: man, weightKg: 80, year: 2026 });
    expect(notes[notes.length - 1]).toBe('Consulte un professionnel avant de changer de régime ou de reprendre une activité intense.');
  });

  test('the guard-rails are the spec values', () => {
    expect(GUARDRAILS).toMatchObject({ minKcal: 1500, maxWeeklyLossPct: 1, deficitKcal: 400 });
  });
});

describe('the macros of the proposal', () => {
  test('fat is 30 % of the energy and the net carbs are what is left after the protein, to the nearest 5 g', () => {
    for (const weightKg of [50, 80, 120]) {
      const { kcal, proteinG, fatG, carbsNetG } = proposeGoals({ profile: { ...man, goalMode: 'maintenance' }, weightKg, year: 2026 }).goals;
      expect(Math.abs(fatG * 9 - 0.3 * kcal)).toBeLessThanOrEqual(22.5); // half a step of 5 g
      expect(Math.abs(carbsNetG * 4 - (0.7 * kcal - 4 * proteinG))).toBeLessThanOrEqual(10);
    }
  });

  test('2 200 kcal and 130 g of protein give 75 g of fat and 255 g of net carbs', () => {
    expect(macroGoals(2200, 130)).toEqual({ fatG: 75, carbsNetG: 255 });
  });

  test('net carbs never go below zero', () => {
    expect(macroGoals(1500, 400).carbsNetG).toBe(0); // 1 600 kcal of protein alone are more than the 1 500 kcal
  });
});
