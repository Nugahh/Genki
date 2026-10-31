import { resolveUi } from './resolveUi';

test('starts on the default cards and on the week', () => {
  const ui = resolveUi({});
  expect(ui.period).toBe('week');
  expect(ui.hubMetrics.slice(0, 3)).toEqual(['calories', 'protein', 'water']);
});

test('keeps what was chosen, and drops a statistic that no longer exists', () => {
  expect(resolveUi({ hubMetrics: ['water', 'gone', 'steps'], period: 'year' })).toEqual({ hubMetrics: ['water', 'steps'], period: 'year' });
});

test('an empty hub stays empty: hiding every card is a choice', () => {
  expect(resolveUi({ hubMetrics: [] }).hubMetrics).toEqual([]);
});
