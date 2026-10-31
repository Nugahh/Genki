import { exerciseIdOf, type NewPlan, type PlannedExercise, type PlannedSession } from './plan';

const ex = (name: string, sets: number, reps: number, incrementKg: number): PlannedExercise => ({ exerciseId: exerciseIdOf(name), name, sets, reps, incrementKg });
const session = (name: string, ...exercises: PlannedExercise[]): PlannedSession => ({ name, exercises });

/** A starting point for coming back to training after a long break: three phases of three full sessions. It is meant to be changed in the app. */
export function starterPlan(startDay: string): NewPlan {
  return {
    name: 'Reprise progressive',
    active: true,
    startDay,
    phases: [
      {
        name: 'Reprise',
        weeks: 4,
        sessions: [
          session('Séance A — Haut du corps', ex('Pompes', 3, 8, 0), ex('Rowing haltère', 3, 10, 2.5), ex('Développé militaire haltères', 3, 10, 2.5), ex('Tractions assistées', 3, 5, 0), ex('Gainage planche (secondes)', 3, 30, 0)),
          session('Séance B — Bas du corps', ex('Squat gobelet', 3, 10, 2.5), ex('Fentes alternées', 3, 8, 2.5), ex('Soulevé de terre roumain', 3, 10, 2.5), ex('Montée de bassin', 3, 12, 2.5), ex('Mollets debout', 3, 15, 0)),
          session('Séance C — Corps entier', ex('Développé couché haltères', 3, 10, 2.5), ex('Squat gobelet', 3, 10, 2.5), ex('Rowing haltère', 3, 10, 2.5), ex('Dips sur banc', 3, 8, 0), ex('Gainage latéral (secondes)', 3, 20, 0)),
        ],
      },
      {
        name: 'Construction',
        weeks: 6,
        sessions: [
          session('Séance A — Haut du corps', ex('Pompes', 4, 10, 0), ex('Rowing haltère', 4, 8, 2.5), ex('Développé militaire haltères', 4, 8, 2.5), ex('Tractions', 4, 5, 0), ex('Gainage planche (secondes)', 4, 40, 0)),
          session('Séance B — Bas du corps', ex('Squat gobelet', 4, 8, 2.5), ex('Fentes marchées', 4, 8, 2.5), ex('Soulevé de terre roumain', 4, 8, 2.5), ex('Montée de bassin', 4, 10, 2.5), ex('Mollets debout', 4, 15, 0)),
          session('Séance C — Corps entier', ex('Développé couché haltères', 4, 8, 2.5), ex('Squat bulgare', 3, 8, 2.5), ex('Rowing haltère', 4, 8, 2.5), ex('Dips sur banc', 4, 10, 0), ex('Gainage latéral (secondes)', 3, 30, 0)),
        ],
      },
      {
        name: 'Force et explosivité',
        weeks: 6,
        sessions: [
          session('Séance A — Haut du corps', ex('Pompes explosives', 4, 6, 0), ex('Tractions', 4, 6, 0), ex('Développé militaire haltères', 4, 6, 2.5), ex('Rowing haltère', 4, 6, 2.5), ex('Gainage planche (secondes)', 4, 45, 0)),
          session('Séance B — Bas du corps', ex('Squat gobelet', 4, 6, 2.5), ex('Soulevé de terre', 4, 5, 5), ex('Sauts sur box', 4, 5, 0), ex('Montée de bassin', 4, 8, 2.5)),
          session('Séance C — Corps entier', ex('Développé couché haltères', 4, 6, 2.5), ex('Sauts verticaux', 4, 5, 0), ex('Dips sur banc', 4, 12, 0), ex('Rowing haltère', 4, 6, 2.5), ex('Gainage latéral (secondes)', 3, 40, 0)),
        ],
      },
    ],
  };
}
