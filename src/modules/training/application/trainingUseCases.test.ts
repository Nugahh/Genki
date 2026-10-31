import { inMemoryMilestoneRepository } from '../adapters/inMemoryMilestoneRepository';
import { inMemoryPlanRepository } from '../adapters/inMemoryPlanRepository';
import { inMemoryWorkoutRepository } from '../adapters/inMemoryWorkoutRepository';
import type { Plan, PlannedSession } from '../domain/plan';
import type { LoggedSet, WorkoutLog } from '../domain/workout';
import { trainingUseCases } from './trainingUseCases';

const squat = { exerciseId: 'squat-gobelet', name: 'Squat gobelet', sets: 3, reps: 8, incrementKg: 2.5 };
const pushups = { exerciseId: 'pompes', name: 'Pompes', sets: 3, reps: 8, incrementKg: 0 };
const session: PlannedSession = { name: 'Séance A', exercises: [squat, pushups] };
const plan: Plan = { id: 'p1', name: 'Reprise', active: true, startDay: '2026-11-02', phases: [{ name: 'Reprise', weeks: 4, sessions: [session] }] };

afterEach(() => jest.restoreAllMocks());

const sets = (exerciseId: string, reps: number[], kg: number): LoggedSet[] => reps.map((r, i) => ({ exerciseId, setNo: i + 1, reps: r, kg }));

function setup() {
  const plans = inMemoryPlanRepository();
  const milestones = inMemoryMilestoneRepository();
  const workouts = inMemoryWorkoutRepository(milestones);
  const clock = { now: () => new Date('2026-11-03T10:00:00Z') }; // 11:00 in Paris
  const training = trainingUseCases({ plans, workouts, milestones, clock, timezone: 'Europe/Paris' });
  const finish = async (done: LoggedSet[], startedAt = new Date('2026-11-03T09:15:00Z')) => {
    const { summary, save } = await training.finishWorkout({ plan, session, done, startedAt });
    await save();
    return summary;
  };
  return { plans, workouts, milestones, clock, training, finish };
}

describe('the programme', () => {
  test('starts from the template: active, from today in the profile day', async () => {
    const { plans, training } = setup();
    await training.startFromTemplate();
    expect(plans.plans).toHaveLength(1);
    expect(plans.plans[0]).toMatchObject({ name: 'Reprise progressive', active: true, startDay: '2026-11-03' });
  });

  test('starts again from the template on the same document, from today', async () => {
    const { plans, training } = setup();
    await plans.create({ ...plan, startDay: '2026-09-01', name: 'Mon programme' });
    await training.startFromTemplate(plans.plans[0]);
    expect(plans.plans).toHaveLength(1);
    expect(plans.plans[0]).toMatchObject({ id: '1', name: 'Reprise progressive', startDay: '2026-11-03' });
  });

  test('refuses to save an invalid programme, with the message, and saves a valid one', async () => {
    const { plans, training } = setup();
    await plans.create(plan);
    await expect(training.savePlan({ ...plans.plans[0], phases: [] })).rejects.toThrow('Un programme a entre 1 et 12 phases.');
    expect(plans.plans[0].phases).toHaveLength(1);
    await training.savePlan({ ...plans.plans[0], name: 'Nouveau nom' });
    expect(plans.plans[0].name).toBe('Nouveau nom');
  });

  test('is observed', async () => {
    const { plans, training } = setup();
    const seen: number[] = [];
    training.observePlans((list) => seen.push(list.length), () => {});
    await plans.create(plan);
    expect(seen).toEqual([0, 1]);
  });
});

describe('a workout', () => {
  test('starts with the planned sets at 0 kg the first time', async () => {
    const { training } = setup();
    const draft = await training.startWorkout(session);
    expect(draft.map((d) => d.exercise.exerciseId)).toEqual(['squat-gobelet', 'pompes']);
    expect(draft[0]).toMatchObject({ last: [], sets: Array(3).fill({ kg: 0, reps: 8 }) });
  });

  test('treats a failed read of the last workout as the first time, so that the workout can still start', async () => {
    const { workouts, training } = setup();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    workouts.latestWithExercise = async () => {
      throw new Error('The query requires an index');
    };
    const draft = await training.startWorkout(session);
    expect(draft[0]).toMatchObject({ last: [], sets: Array(3).fill({ kg: 0, reps: 8 }) });
    expect(console.warn).toHaveBeenCalled();
  });

  test('aims at the load plus the increment after a workout where every set reached the reps', async () => {
    const { training, finish } = setup();
    await finish([...sets('squat-gobelet', [8, 8, 8], 20), ...sets('pompes', [8, 8, 8], 0)]);
    const [first, second] = await training.startWorkout(session);
    expect(first.last).toEqual(sets('squat-gobelet', [8, 8, 8], 20));
    expect(first.sets).toEqual(Array(3).fill({ kg: 22.5, reps: 8 }));
    expect(second.sets).toEqual(Array(3).fill({ kg: 0, reps: 8 })); // body weight: nothing to add
  });

  test('keeps the load after a workout where a set fell short', async () => {
    const { training, finish } = setup();
    await finish(sets('squat-gobelet', [8, 8, 5], 20));
    expect((await training.startWorkout(session))[0].sets[0].kg).toBe(20);
  });

  test('writes nothing before save, then the log with its day, duration and exercises', async () => {
    const { workouts, training } = setup();
    const done = [...sets('squat-gobelet', [8, 8, 8], 20), ...sets('pompes', [8], 0)];
    const { summary, save } = await training.finishWorkout({ plan, session, done, startedAt: new Date('2026-11-03T09:15:00Z') });
    expect(summary.durationMin).toBe(45);
    expect(workouts.logs).toEqual([]);
    await save();
    expect(workouts.logs).toEqual<WorkoutLog[]>([
      {
        id: '1',
        day: '2026-11-03',
        planId: 'p1',
        sessionName: 'Séance A',
        exerciseIds: ['squat-gobelet', 'pompes'],
        sets: done,
        durationMin: 45,
        createdAt: new Date('2026-11-03T10:00:00Z'),
      },
    ]);
  });

  test('says which loads go up, and what it reached', async () => {
    const { milestones, training, finish } = setup();
    await training.addMilestone({ metric: 'exercise:squat-gobelet:kg', target: 20, direction: 'up', label: 'Squat à 20 kg' });
    const summary = await finish([...sets('squat-gobelet', [8, 8, 8], 20), ...sets('pompes', [8, 8, 8], 0)]);
    expect(summary.suggestions).toEqual([{ exerciseId: 'squat-gobelet', name: 'Squat gobelet', fromKg: 20, toKg: 22.5 }]);
    expect(summary.achieved.map((m) => m.label)).toEqual(['Squat à 20 kg']);
    expect(milestones.milestones[0].achievedAt).toEqual(new Date('2026-11-03T10:00:00Z'));
  });

  test('reaches a milestone once', async () => {
    const { training, finish } = setup();
    await training.addMilestone({ metric: 'exercise:squat-gobelet:kg', target: 20, direction: 'up', label: 'Squat à 20 kg' });
    await finish(sets('squat-gobelet', [8, 8, 8], 20));
    const again = await finish(sets('squat-gobelet', [8, 8, 8], 22.5));
    expect(again.achieved).toEqual([]);
  });

  test('refuses a workout with no set done', async () => {
    const { training } = setup();
    await expect(training.finishWorkout({ plan, session, done: [], startedAt: new Date() })).rejects.toThrow('Une séance a au moins une série.');
  });

  test('lasts a day at most: a session left open is recorded as 24 hours, so that the rules accept it', async () => {
    const { workouts, finish } = setup();
    await finish(sets('squat-gobelet', [8], 20), new Date('2026-10-30T10:00:00Z'));
    expect(workouts.logs[0].durationMin).toBe(1440);
  });

  test('is saved even when the milestones cannot be read: they are reached by a later workout', async () => {
    const { workouts, milestones, finish } = setup();
    milestones.list = async () => {
      throw new Error('offline');
    };
    expect((await finish(sets('squat-gobelet', [8], 20))).achieved).toEqual([]);
    expect(workouts.logs).toHaveLength(1);
  });

  test('records the log and the milestones it reaches together: a refused milestone leaves no log', async () => {
    const { workouts, milestones, training } = setup();
    await training.addMilestone({ metric: 'exercise:squat-gobelet:kg', target: 20, direction: 'up', label: 'Squat à 20 kg' });
    const { save } = await training.finishWorkout({ plan, session, done: sets('squat-gobelet', [8], 20), startedAt: new Date('2026-11-03T09:15:00Z') });
    await milestones.remove('1');
    await expect(save()).rejects.toThrow();
    expect(workouts.logs).toEqual([]);
  });

  test('lasts at least a minute', async () => {
    const { workouts, finish } = setup();
    await finish(sets('squat-gobelet', [8], 20), new Date('2026-11-03T10:00:00Z'));
    expect(workouts.logs[0].durationMin).toBe(1);
  });

  test('has a history by exercise, newest first, and the latest workout is observed', async () => {
    const { clock, training, finish } = setup();
    let latest: string | undefined;
    training.observeLatestWorkout((log) => (latest = log?.day), () => {});
    await finish(sets('squat-gobelet', [8], 20));
    clock.now = () => new Date('2026-11-05T10:00:00Z');
    await finish(sets('squat-gobelet', [8], 22.5));
    expect((await training.exerciseHistory('squat-gobelet')).map((l) => l.day)).toEqual(['2026-11-05', '2026-11-03']);
    expect(await training.exerciseHistory('inconnu')).toEqual([]);
    expect(latest).toBe('2026-11-05');
  });
});

describe('milestones', () => {
  test('refuses an invalid one with the message, adds and removes a valid one', async () => {
    const { milestones, training } = setup();
    await expect(training.addMilestone({ metric: 'poids', target: 80, direction: 'down', label: 'Poids' })).rejects.toThrow('Le palier doit suivre un exercice');
    await training.addMilestone({ metric: 'exercise:tractions:reps', target: 10, direction: 'up', label: '10 tractions' });
    expect(milestones.milestones).toHaveLength(1);
    await training.removeMilestone('1');
    expect(milestones.milestones).toEqual([]);
  });
});
