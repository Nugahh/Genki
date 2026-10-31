import { chunk, countDocuments, exportFile, parseBackup, restoreWrites, type BackupFile } from './backup';

const stamp = (iso: string) => ({ __timestamp: iso });
const backup = (patch: Partial<BackupFile> = {}): BackupFile => ({
  version: 1,
  exportedAt: '2026-11-03T10:00:00.000Z',
  profile: { heightCm: 180, createdAt: stamp('2026-10-01T10:00:00.000Z') },
  collections: {
    days: [{ id: '2026-11-02', data: { kcal: 1800, updatedAt: stamp('2026-11-02T20:00:00.000Z') } }],
    waterEntries: [
      { id: 'w1', data: { day: '2026-11-02', ml: 250, createdAt: stamp('2026-11-02T08:00:00.000Z'), deletedAt: null } },
      { id: 'w2', data: { day: '2026-11-02', ml: 500, createdAt: stamp('2026-11-02T09:00:00.000Z'), deletedAt: stamp('2026-11-02T09:05:00.000Z') } },
    ],
    milestones: [
      { id: 'm1', data: { metric: 'waistCm', target: 90, direction: 'down', label: 'Tour de taille sous 90 cm', achievedAt: stamp('2026-11-02T10:00:00.000Z') } },
      { id: 'm2', data: { metric: 'weightKg', target: 80, direction: 'down', label: 'Poids sous 80 kg' } },
    ],
  },
  ...patch,
});

describe('exportFile and parseBackup', () => {
  test('a backup written is read back as it was', () => {
    const file = exportFile({ profile: backup().profile, collections: backup().collections, now: new Date('2026-11-03T10:00:00Z') });
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed).toEqual({ ok: true, backup: backup() });
  });

  test.each([
    ['text that is not JSON', 'pas du json'],
    ['a version to come', JSON.stringify({ ...backup(), version: 2 })],
    ['no version', JSON.stringify({ profile: {}, collections: {}, exportedAt: 'x' })],
    ['no profile', JSON.stringify({ ...backup(), profile: undefined })],
    ['collections that are a list', JSON.stringify({ ...backup(), collections: [] })],
    ['an unknown collection', JSON.stringify(backup({ collections: { secrets: [] } as never }))],
    ['a collection that is not a list', JSON.stringify(backup({ collections: { days: {} } as never }))],
    ['a document with no id', JSON.stringify(backup({ collections: { days: [{ data: {} }] } as never }))],
    ['an id with a slash', JSON.stringify(backup({ collections: { days: [{ id: 'a/b', data: {} }] } }))],
    ['a document with no data', JSON.stringify(backup({ collections: { days: [{ id: 'a' }] } as never }))],
    ['a date that is not a date', JSON.stringify(backup({ collections: { days: [{ id: 'a', data: { updatedAt: stamp('hier') } }] } }))],
    ['a date that is not a date in the profile', JSON.stringify(backup({ profile: { createdAt: stamp('hier') } }))],
    ['a date nested in a list', JSON.stringify(backup({ collections: { plans: [{ id: 'p', data: { phases: [{ since: stamp('x') }] } }] } }))],
  ])('refuses %s with a message', (_, text) => {
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toEqual(expect.stringMatching(/\S/));
  });
});

describe('restoreWrites', () => {
  test('leaves out what was deleted in the app', () => {
    const writes = restoreWrites(backup());
    expect(writes.filter((w) => w.collection === 'waterEntries').map((w) => w.id)).toEqual(['w1']);
  });

  test('creates a milestone without the date it was reached, then sets the date once everything exists', () => {
    const writes = restoreWrites(backup());
    const milestones = writes.filter((w) => w.collection === 'milestones');
    expect(milestones.map((w) => [w.id, w.mode])).toEqual([['m1', 'set'], ['m2', 'set'], ['m1', 'update']]);
    expect(milestones[0].data).not.toHaveProperty('achievedAt');
    expect(milestones[2].data).toEqual({ achievedAt: stamp('2026-11-02T10:00:00.000Z') });
    // Every creation comes before every update.
    expect(writes.findIndex((w) => w.mode === 'update')).toBeGreaterThan(writes.map((w) => w.mode).lastIndexOf('set'));
  });

  test('writes the collections in the order of the spec', () => {
    expect(restoreWrites(backup()).map((w) => w.collection)).toEqual(['days', 'waterEntries', 'milestones', 'milestones', 'milestones']);
  });
});

test('counts the documents', () => expect(countDocuments(backup())).toBe(5));

test('chunk cuts a list into parts of the size given', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunk([], 400)).toEqual([]);
});
