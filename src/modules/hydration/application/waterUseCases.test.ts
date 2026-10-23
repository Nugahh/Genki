import { inMemoryWaterRepository } from '../adapters/inMemoryWaterRepository';
import type { WaterEntry } from './ports';
import { waterUseCases } from './waterUseCases';

test('a glass logged at 23:50 in Paris stays on that day', async () => {
  const repo = inMemoryWaterRepository();
  const lateEvening = { now: () => new Date('2026-10-24T21:50:00Z') };
  await waterUseCases(repo, lateEvening, 'Europe/Paris').addWater(250);
  expect(repo.entries).toEqual([expect.objectContaining({ day: '2026-10-24', ml: 250 })]);
});

test('the day journal lists live glasses newest first and drops removed ones', async () => {
  const repo = inMemoryWaterRepository();
  const clock = { now: () => new Date('2026-10-23T08:00:00Z') };
  const water = waterUseCases(repo, clock, 'Europe/Paris');
  await water.addWater(250);
  clock.now = () => new Date('2026-10-23T09:00:00Z');
  await water.addWater(500);

  let journal: WaterEntry[] = [];
  water.observeDay('2026-10-23', (entries) => (journal = entries), () => {});
  expect(journal.map((e) => e.ml)).toEqual([500, 250]);

  await water.removeWater(journal[0]);
  expect(journal.map((e) => e.ml)).toEqual([250]);
});
