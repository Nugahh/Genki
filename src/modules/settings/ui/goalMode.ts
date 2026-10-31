import type { GoalMode } from '../domain/profile';

export const GOAL_MODES: { value: GoalMode; label: string }[] = [
  { value: 'deficit', label: 'Déficit' },
  { value: 'maintenance', label: 'Maintien' },
  { value: 'surplus', label: 'Surplus' },
];

const TEXT: Record<GoalMode, string> = { deficit: 'déficit', maintenance: 'maintien', surplus: 'surplus' };
export const goalModeText = (mode: GoalMode) => TEXT[mode];
