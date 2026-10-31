import { inMemoryWaterRepository } from '../adapters/inMemoryWaterRepository';
import type { WaterEntry } from './ports';
import { waterUseCases } from './waterUseCases';

test("a glass goes on the profile's day around midnight", async () => {
  const repo = inMemoryWaterRepository();
  const clock = { now: () => new Date('2026-10-24T21:50:00Z') }; // 23:50 in Paris
  const water = waterUseCases(repo, clock, 'Europe/Paris');
  await water.addWater(250);
  clock.now = () => new Date('2026-10-24T22:10:00Z'); // 00:10 in Paris
  await water.addWater(250);
  expect(repo.entries.map((e) => e.day)).toEqual(['2026-10-24', '2026-10-25']);
});

test('a glass is in at once, and the entry addWater returns is enough to take it back', async () => {
  const repo = inMemoryWaterRepository();
  const clock = { now: () => new Date('2026-10-23T08:00:00Z') };
  const water = waterUseCases(repo, clock, 'Europe/Paris');
  const { entry, saved } = water.addWater(250);
  // Before the server has it: offline, `saved` waits for the network while the glass is already counted.
  expect(repo.entries).toEqual([entry]);
  expect(entry).toEqual({ id: expect.any(String), day: '2026-10-23', ml: 250, createdAt: new Date('2026-10-23T08:00:00Z') });
  await saved;
  await water.removeWater(entry);
  expect(repo.entries).toEqual([]);
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
