import { inMemoryMilestoneRepository, inMemoryPlanRepository, inMemoryWorkoutRepository, trainingUseCases } from '@/modules/training';
import { inMemoryBodyRepository } from '../adapters/inMemoryBodyRepository';
import type { BodySummary } from './bodyUseCases';
import { bodyUseCases } from './bodyUseCases';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') }; // 11:00 in Paris

function setup() {
  const milestones = inMemoryMilestoneRepository();
  const training = trainingUseCases({ plans: inMemoryPlanRepository(), workouts: inMemoryWorkoutRepository(milestones), milestones, clock, timezone: 'Europe/Paris' });
  const repo = inMemoryBodyRepository(milestones);
  const body = bodyUseCases({ repo, milestones: training.listMilestones, clock, timezone: 'Europe/Paris' });
  return { milestones, training, repo, body };
}

test('records the measure of today, merged: the weight and then the waist share the day', async () => {
  const { repo, body } = setup();
  await body.save({ weightKg: 80.5 });
  await body.save({ waistCm: 92 });
  expect(repo.days.get('2026-11-03')).toEqual({ weightKg: 80.5, waistCm: 92 });
});

test('records the measure of another day', async () => {
  const { repo, body } = setup();
  await body.save({ weightKg: 81 }, '2026-11-01');
  expect(repo.days.get('2026-11-01')).toEqual({ weightKg: 81 });
});

test('refuses a measure out of range with its message, and writes nothing', async () => {
  const { repo, body } = setup();
  await expect(body.save({ weightKg: 5 })).rejects.toThrow('Le poids est compris entre 20 et 400 kg.');
  await expect(body.save({})).rejects.toThrow('Saisis au moins une mesure.');
  expect(repo.days.size).toBe(0);
});

test('reaches a milestone of the body once: it is returned, marked, and not returned again', async () => {
  const { milestones, training, body } = setup();
  await training.addMilestone({ metric: 'waistCm', target: 90, direction: 'down', label: 'Tour de taille sous 90 cm' });
  expect(await body.save({ waistCm: 91 })).toEqual([]);
  expect(await body.save({ waistCm: 89.5 })).toEqual(['1']);
  expect(milestones.milestones[0].achievedAt).toEqual(new Date('2026-11-03T10:00:00Z'));
  expect(await body.save({ waistCm: 88 })).toEqual([]);
});

test('keeps the measure when the milestones cannot be read', async () => {
  const { repo, milestones, body } = setup();
  milestones.list = async () => {
    throw new Error('offline');
  };
  expect(await body.save({ weightKg: 80 })).toEqual([]);
  expect(repo.days.get('2026-11-03')).toEqual({ weightKg: 80 });
});

describe('observeSummary', () => {
  test('gives the measures of the day and the mean of the seven days up to it', async () => {
    const { body } = setup();
    for (const [day, weightKg] of [['2026-10-28', 82], ['2026-10-30', 81], ['2026-11-03', 80], ['2026-10-27', 90]] as const) await body.save({ weightKg }, day);
    await body.save({ waistCm: 92 });
    const seen: BodySummary[] = [];
    body.observeSummary('2026-11-03', (s) => seen.push(s), () => {});
    // 27 October is eight days before: out of the seven days.
    expect(seen[seen.length - 1]).toEqual({ today: { weightKg: 80, waistCm: 92 }, weightAverage: 81, waistAverage: 92 });
  });

  test('is empty with no measure', () => {
    const { body } = setup();
    const seen: BodySummary[] = [];
    body.observeSummary('2026-11-03', (s) => seen.push(s), () => {});
    expect(seen[0]).toEqual({ today: {}, weightAverage: undefined, waistAverage: undefined });
  });
});
