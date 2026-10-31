import type { MilestoneRepository } from '../application/ports';
import type { Milestone, NewMilestone } from '../domain/milestone';

/** MilestoneRepository kept in memory, for tests. */
export function inMemoryMilestoneRepository(): MilestoneRepository & { milestones: Milestone[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const repo = {
    milestones: [] as Milestone[],
    async create(milestone: NewMilestone) {
      repo.milestones = [...repo.milestones, { ...milestone, id: String(nextId++) }];
      notify();
    },
    async remove(id: string) {
      repo.milestones = repo.milestones.filter((m) => m.id !== id);
      notify();
    },
    async markAchieved(id: string, at: Date) {
      repo.milestones = repo.milestones.map((m) => (m.id === id ? { ...m, achievedAt: at } : m));
      notify();
    },
    async list() {
      return repo.milestones;
    },
    observeAll(onNext: (milestones: Milestone[]) => void) {
      const listener = () => onNext(repo.milestones);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return repo;
}
