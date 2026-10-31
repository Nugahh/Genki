import type { NewPlan, Plan } from '../domain/plan';
import type { PlanRepository } from '../application/ports';

/** PlanRepository kept in memory, for tests. */
export function inMemoryPlanRepository(): PlanRepository & { plans: Plan[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const repo = {
    plans: [] as Plan[],
    async create(plan: NewPlan) {
      repo.plans = [...repo.plans, { ...plan, id: String(nextId++) }];
      notify();
    },
    async update(plan: Plan) {
      repo.plans = repo.plans.map((p) => (p.id === plan.id ? plan : p));
      notify();
    },
    observeAll(onNext: (plans: Plan[]) => void) {
      const listener = () => onNext(repo.plans);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return repo;
}
