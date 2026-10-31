import { inMemoryCravingRepository } from '../adapters/inMemoryCravingRepository';
import { tobaccoUseCases, type QuitProfile, type TobaccoSummary } from './tobaccoUseCases';

const clock = { now: () => new Date('2026-10-11T10:00:00Z') }; // 12:00 in Paris

function setup() {
  const repo = inMemoryCravingRepository();
  return { repo, tobacco: tobaccoUseCases({ repo, clock, timezone: 'Europe/Paris' }) };
}

test('notes a craving at once with its day and time, resisted or not, and can take it back', () => {
  const { repo, tobacco } = setup();
  const { craving } = tobacco.logCraving(true);
  tobacco.logCraving(false);
  expect(repo.cravings).toEqual([
    { id: '1', day: '2026-10-11', createdAt: new Date('2026-10-11T10:00:00Z'), resisted: true },
    { id: '2', day: '2026-10-11', createdAt: new Date('2026-10-11T10:00:00Z'), resisted: false },
  ]);
  void tobacco.removeCraving(craving);
  expect(repo.cravings.map((c) => c.id)).toEqual(['2']);
});

test('the day shows its cravings, newest first', () => {
  const { repo, tobacco } = setup();
  repo.add({ day: '2026-10-11', createdAt: new Date('2026-10-11T08:00:00Z'), resisted: true });
  repo.add({ day: '2026-10-11', createdAt: new Date('2026-10-11T09:00:00Z'), resisted: false });
  repo.add({ day: '2026-10-10', createdAt: new Date('2026-10-10T09:00:00Z'), resisted: true });
  let seen: string[] = [];
  tobacco.observeDay('2026-10-11', (list) => (seen = list.map((c) => c.id)), () => {});
  expect(seen).toEqual(['2', '1']);
});

describe('observeSummary', () => {
  const profile: QuitProfile = { quitDate: '2026-10-01', cigarettesPerDay: 20, packPrice: 12, packSize: 20 };
  const read = (tobacco: ReturnType<typeof setup>['tobacco'], p = profile) => {
    const seen: TobaccoSummary[] = [];
    const stop = tobacco.observeSummary(p, (s) => seen.push(s), () => {});
    return { seen, stop };
  };

  test('counts the days, the record and the money; a smoked cigarette restarts the streak', () => {
    const { repo, tobacco } = setup();
    const { seen } = read(tobacco);
    expect(seen[seen.length - 1]).toEqual({ current: 10, record: 10, smokeFreeDays: 10, savedEuros: 120 });
    repo.add({ day: '2026-10-05', createdAt: new Date('2026-10-05T10:00:00Z'), resisted: false });
    expect(seen[seen.length - 1]).toEqual({ current: 6, record: 6, smokeFreeDays: 9, savedEuros: 108 });
  });

  test('a craving resisted does not restart anything', () => {
    const { repo, tobacco } = setup();
    repo.add({ day: '2026-10-05', createdAt: new Date('2026-10-05T10:00:00Z'), resisted: true });
    const { seen } = read(tobacco);
    expect(seen[seen.length - 1]).toMatchObject({ current: 10, smokeFreeDays: 10 });
  });

  test('is zero without a quit date, and reads nothing', () => {
    const { repo, tobacco } = setup();
    const { seen } = read(tobacco, { packSize: 20 });
    expect(seen).toEqual([{ current: 0, record: 0, smokeFreeDays: 0, savedEuros: undefined }]);
    expect(repo.cravings).toEqual([]);
  });

  test('stops listening', () => {
    const { repo, tobacco } = setup();
    const { seen, stop } = read(tobacco);
    stop();
    const count = seen.length;
    repo.add({ day: '2026-10-05', createdAt: new Date('2026-10-05T10:00:00Z'), resisted: false });
    expect(seen).toHaveLength(count);
  });
});
