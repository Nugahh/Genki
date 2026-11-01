import { DEFAULT_PROFILE, validateProfile, type Profile } from './profile';

test('the default profile is valid, and keeps the weight (the current gauge colours)', () => {
  expect(validateProfile(DEFAULT_PROFILE)).toBeNull();
  expect(DEFAULT_PROFILE.goalMode).toBe('maintenance');
  expect(DEFAULT_PROFILE.goals.steps).toBe(8000);
});

const withGoals = (patch: Partial<Profile['goals']>): Profile => ({ ...DEFAULT_PROFILE, goals: { ...DEFAULT_PROFILE.goals, ...patch } });

test.each<[string, Profile]>([
  ['a height of 99 cm', { ...DEFAULT_PROFILE, heightCm: 99 }],
  ['a height of 251 cm', { ...DEFAULT_PROFILE, heightCm: 251 }],
  ['a birth year before 1900', { ...DEFAULT_PROFILE, birthYear: 1899 }],
  ['a birth year in the future', { ...DEFAULT_PROFILE, birthYear: new Date().getFullYear() + 1 }],
  ['a birth year that is not whole', { ...DEFAULT_PROFILE, birthYear: 1990.5 }],
  ['799 kcal', withGoals({ kcal: 799 })],
  ['10 001 kcal', withGoals({ kcal: 10001 })],
  ['501 g of protein', withGoals({ proteinG: 501 })],
  ['1 001 g of net carbs', withGoals({ carbsNetG: 1001 })],
  ['501 g of fat', withGoals({ fatG: 501 })],
  ['499 ml of water', withGoals({ waterMl: 499 })],
  ['10 001 ml of water', withGoals({ waterMl: 10001 })],
  ['100 001 steps', withGoals({ steps: 100001 })],
  ['a pack of 0', { ...DEFAULT_PROFILE, packSize: 0 }],
  ['a pack price of 101', { ...DEFAULT_PROFILE, packPrice: 101 }],
  ['201 cigarettes a day', { ...DEFAULT_PROFILE, cigarettesPerDay: 201 }],
  ['a quit date that is not a day', { ...DEFAULT_PROFILE, quitDate: 'demain' }],
  ['a quit date that does not exist', { ...DEFAULT_PROFILE, quitDate: '2026-02-31' }],
  ['a number of cigarettes that is not whole', { ...DEFAULT_PROFILE, cigarettesPerDay: 12.5 }],
  ['a pack size that is not whole', { ...DEFAULT_PROFILE, packSize: 20.5 }],
  ['no water container', { ...DEFAULT_PROFILE, waterContainers: [] }],
  ['7 water containers', { ...DEFAULT_PROFILE, waterContainers: Array.from({ length: 7 }, (_, i) => ({ label: `C${i}`, ml: 250 })) }],
  ['a container of 0 ml', { ...DEFAULT_PROFILE, waterContainers: [{ label: 'Verre', ml: 0 }] }],
  ['a container with no label', { ...DEFAULT_PROFILE, waterContainers: [{ label: ' ', ml: 250 }] }],
  ['a weekly loss of 0', { ...DEFAULT_PROFILE, weeklyLossKg: 0 }],
  ['a weekly loss of 3 kg', { ...DEFAULT_PROFILE, weeklyLossKg: 3 }],
])('refuses %s with a message', (_, profile) => {
  expect(validateProfile(profile)).toEqual(expect.stringMatching(/\S/));
});
