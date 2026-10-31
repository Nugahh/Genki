import { inMemoryCravingRepository, tobaccoUseCases } from '@/modules/tobacco';
import type { DayFacts } from '../domain/metric';
import { tobaccoFactsSource } from './tobaccoFactsSource';

test('counts the cravings of each day, and the cigarettes among them when there were some', () => {
  const repo = inMemoryCravingRepository();
  const tobacco = tobaccoUseCases({ repo, clock: { now: () => new Date('2026-10-11T10:00:00Z') }, timezone: 'Europe/Paris' });
  const at = (day: string) => new Date(`${day}T10:00:00Z`);
  repo.add({ day: '2026-10-09', createdAt: at('2026-10-09'), resisted: true });
  repo.add({ day: '2026-10-09', createdAt: at('2026-10-09'), resisted: true });
  repo.add({ day: '2026-10-10', createdAt: at('2026-10-10'), resisted: true });
  repo.add({ day: '2026-10-10', createdAt: at('2026-10-10'), resisted: false });
  repo.add({ day: '2026-10-20', createdAt: at('2026-10-20'), resisted: false }); // out of the range

  let seen = new Map<string, DayFacts>();
  tobaccoFactsSource(tobacco).observeRange('2026-10-01', '2026-10-15', (facts) => (seen = facts), () => {});
  expect([...seen]).toEqual([
    ['2026-10-09', { cravings: 2 }],
    ['2026-10-10', { cravings: 2, smoked: 1 }],
  ]);
});
