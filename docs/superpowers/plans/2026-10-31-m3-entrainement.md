# M3 Entraînement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The repository code is the reference where this plan and the code differ.

**Goal:** Suivre les séances : un programme en phases (créé depuis un modèle de départ, modifiable), un journal de séance pré-rempli avec la dernière charge et la charge à viser, un chrono de repos, la progression suggérée à la fin, des paliers atteints, l'historique par exercice, et une carte « Séance du jour » sur Aujourd'hui.

**Architecture:** Nouveau module `src/modules/training/{domain,application,adapters,ui}` suivant les modules existants. Le domaine est pur (progression, paliers, position dans le programme, modèle de départ, validation). Trois ports (`PlanRepository`, `WorkoutRepository`, `MilestoneRepository`) avec adaptateurs Firestore et en mémoire. Un seul programme actif en M3. Le brouillon d'une séance vit en mémoire dans l'écran (pas de persistance en cours de séance) ; seule la séance terminée est écrite.

**Tech Stack:** Expo Router (nouvel onglet Sport, routes `workout`, `plan`, `exercise`), React Native Paper, Firestore (RN Firebase), Jest + RNTL, émulateur Firestore pour règles et adaptateurs.

## Global Constraints

- Français dans l'interface, code et commentaires en anglais. Métrique (kg), formats fr-FR.
- Spec §4 : `plans/{id}` = `name`, `active`, `phases[{ name, weeks, sessions[{ name, exercises[{ exerciseId, name, sets, reps, incrementKg }] }] }]`. **Extension de M3 : `startDay` (YYYY-MM-DD, fuseau du profil)** pour calculer la phase et la semaine en cours.
- Spec §4 : `workoutLogs/{id}` = `day`, `planId`, `sessionName`, `exerciseIds`, `sets[{ exerciseId, setNo, reps, kg }]`, `durationMin`, `createdAt`, `deletedAt` (écrit à `null`, pas de suppression dans M3). `milestones/{id}` = `metric`, `target`, `direction` (`up`|`down`), `label`, `achievedAt`.
- Spec §4.6 : le pré-remplissage est la requête `workoutLogs` avec `exerciseIds array-contains X`, tri `day` décroissant, limite 1 ; index composite dans `firebase/firestore.indexes.json`.
- Spec §9 progression : si toutes les séries prévues atteignent les répétitions prévues, charge suggérée = charge + `incrementKg` (2,5 par défaut), sinon la charge est conservée. Paliers : atteints quand la dernière valeur franchit la cible dans le sens indiqué ; `achievedAt` posé à l'enregistrement de la séance.
- Spec §8/§9 : l'application ne donne pas de conseil médical : le modèle de départ s'accompagne du rappel de consulter un professionnel avant de reprendre une activité intense.
- Écritures par `writeBatch` ou écriture simple (aucune transaction) ; jamais attendues en série (`run(write)` ; hors-ligne elles ne se règlent qu'au retour du réseau).
- Cibles tactiles 48 dp, libellés d'accessibilité en français qui commencent par le texte visible, messages d'état avec `accessibilityLiveRegion="polite"`, couleurs et polices uniquement par le thème (`src/theme.ts`), pas de valeur de couleur dans un écran.
- Un module n'importe pas les internes d'un autre (`dependency-cruiser`) ; `domain/` est du TypeScript pur.
- Avant de conclure : `npm run lint`, `npm run typecheck`, `npm test`, `npm run lint:deps`, et `npm run test:emulator` (Firestore touché).

## Décisions de M3

1. **Un seul programme actif.** Créer depuis le modèle quand un programme existe le remplace après confirmation (même document, nouveau contenu, nouveau `startDay`).
2. **Édition du programme** : renommer le programme, modifier un exercice (nom, séries, répétitions, incrément), ajouter ou retirer un exercice d'une séance. Ajouter ou retirer des phases et des séances n'est pas dans M3 (`shortcut:` noté dans le code de l'écran).
3. **Paliers** sur les exercices seulement : métriques `exercise:<exerciseId>:reps` (meilleure série) et `exercise:<exerciseId>:kg` (charge max). Les paliers sur les mesures du corps viennent avec M4 et M6.
4. **Chrono de repos** : compte à rebours visuel de 90 s qui démarre quand une série est cochée, avec « Passer ». Pas de notification ni de vibration (aucun module natif ajouté).
5. **Brouillon de séance en mémoire** : quitter l'écran en cours de séance la perd, après confirmation (`shortcut:` noté ; à persister si les interruptions deviennent fréquentes).
6. **Séance suivante** : la séance qui suit, dans la phase en cours, celle de la dernière séance enregistrée (cyclique) ; la première si elle n'est pas de cette phase.
7. **Exercice = nom** : `exerciseId` est le nom sans accents, en minuscules, avec des tirets : deux programmes qui nomment pareil un exercice partagent son historique.

---

### Task 1: Domaine — programme, position, séance suivante, validation

**Files:**
- Create: `src/modules/training/domain/plan.ts`, `src/modules/training/domain/plan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PlannedExercise = { exerciseId: string; name: string; sets: number; reps: number; incrementKg: number };
  export type PlannedSession = { name: string; exercises: PlannedExercise[] };
  export type Phase = { name: string; weeks: number; sessions: PlannedSession[] };
  export type Plan = { id: string; name: string; active: boolean; startDay: string; phases: Phase[] };
  export type NewPlan = Omit<Plan, 'id'>;
  export const exerciseIdOf: (name: string) => string; // « Squat gobelet » → 'squat-gobelet'
  export const validatePlan: (plan: NewPlan) => string | null; // a French message, or null
  export type Position = { phaseIndex: number; week: number } | { finished: true };
  export const planPosition: (plan: Plan, today: string) => Position;
  export const nextSession: (phase: Phase, lastSessionName?: string) => PlannedSession;
  ```
- Limites de `validatePlan` (les mêmes que les règles Firestore) : nom 1 à 100 caractères ; 1 à 12 phases ; `weeks` entier 1 à 52 ; 1 à 14 séances par phase ; 1 à 20 exercices par séance ; `sets` entier 1 à 20 ; `reps` entier 1 à 1 000 ; `incrementKg` 0 à 50 ; noms de phase, de séance et d'exercice de 1 à 100 caractères.

- [ ] **Step 1: Write the failing tests** (`plan.test.ts`)
  - `exerciseIdOf('Squat gobelet')` = `'squat-gobelet'` ; `exerciseIdOf('  Développé  couché (haltères) ')` = `'developpe-couche-halteres'`.
  - `planPosition` avec un programme de phases de 4 et 6 semaines et `startDay` `'2026-11-02'` : le `'2026-11-02'` → phase 0 semaine 1 ; `'2026-11-08'` → phase 0 semaine 1 ; `'2026-11-09'` → phase 0 semaine 2 ; `'2026-11-30'` → phase 1 semaine 1 ; `'2026-12-28'` → phase 1 semaine 5 ; `'2027-01-11'` → `{ finished: true }` ; `'2026-10-30'` (avant le début) → phase 0 semaine 1.
  - `nextSession` : sans dernière séance → la première ; après la première → la deuxième ; après la dernière → la première ; un nom inconnu → la première.
  - `validatePlan` : un programme valide → `null` ; chaque limite dépassée (0 phase, 13 phases, `weeks` 0 et 53, `sets` 0 et 21, `reps` 0 et 1 001, `incrementKg` −1 et 51, nom vide, nom de 101 caractères, séance sans exercice, `sets` non entier) → un message non vide.

- [ ] **Step 2: Run to see them fail** (`npx jest src/modules/training/domain/plan.test.ts`) — modules absents.
- [ ] **Step 3: Implement** `plan.ts` : calcul des jours entre deux clés `YYYY-MM-DD` avec `Date.UTC` (pas de fuseau : ce sont des clés de jour) ; semaine = `Math.floor(jours / 7) + 1`, bornée à 1 avant le début ; la phase est trouvée en cumulant les `weeks`.
- [ ] **Step 4: Run tests green; commit** `feat: training plan domain, position and validation (M3)`.

### Task 2: Domaine — progression, préremplissage, paliers, séance enregistrée

**Files:**
- Create: `src/modules/training/domain/progression.ts`, `milestone.ts`, `workout.ts`, et leurs `.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // workout.ts
  export type LoggedSet = { exerciseId: string; setNo: number; reps: number; kg: number };
  export type WorkoutLog = { id: string; day: string; planId: string; sessionName: string; exerciseIds: string[]; sets: LoggedSet[]; durationMin: number; createdAt: Date };
  export type NewWorkoutLog = Omit<WorkoutLog, 'id'>;
  export const validateWorkout: (log: NewWorkoutLog) => string | null; // ≥ 1 série, reps 0..1000, kg 0..1000, setNo ≥ 1
  // progression.ts
  export const suggestedKg: (last: LoggedSet[], exercise: PlannedExercise) => number;
  export type DraftSet = { kg: number; reps: number };
  export const prefillSets: (exercise: PlannedExercise, last: LoggedSet[]) => DraftSet[]; // exercise.sets entries
  export type Suggestion = { exerciseId: string; name: string; fromKg: number; toKg: number };
  export const suggestionsFor: (exercises: PlannedExercise[], done: LoggedSet[]) => Suggestion[];
  // milestone.ts
  export type Direction = 'up' | 'down';
  export type Milestone = { id: string; metric: string; target: number; direction: Direction; label: string; achievedAt?: Date };
  export type NewMilestone = Omit<Milestone, 'id' | 'achievedAt'>;
  export const exerciseMetric: (exerciseId: string, kind: 'reps' | 'kg') => string; // 'exercise:squat-gobelet:kg'
  export const isReached: (m: Pick<Milestone, 'target' | 'direction'>, value: number) => boolean;
  export const reachedBy: (milestones: Milestone[], done: LoggedSet[]) => Milestone[]; // not yet achieved, crossed by this workout
  export const validateMilestone: (m: NewMilestone) => string | null;
  ```
- Règles : `suggestedKg` = 0 sans historique ; sinon la charge maximale de l'historique, plus `incrementKg` quand `last.length >= exercise.sets` et que toutes les séries ont `reps >= exercise.reps` ; arrondi à 0,01. `prefillSets` : `exercise.sets` entrées, `kg = suggestedKg(...)`, `reps = exercise.reps`. `suggestionsFor` : un élément par exercice **dont la charge change** (`toKg > fromKg`), `fromKg` = charge max de la séance. `reachedBy` : valeur d'un palier `exercise:X:reps` = meilleure série de X dans la séance, `…:kg` = charge max ; ignore les paliers déjà atteints et ceux dont l'exercice n'a pas de série.
- Limites de `validateMilestone` : `label` 1 à 100 caractères ; `target` nombre fini entre 0 et 100 000 ; `metric` de la forme `exercise:<id>:(reps|kg)`.

- [ ] **Step 1: Write the failing tests** — pour chaque règle : sans historique (0) ; toutes séries atteintes (charge + incrément) ; une série manquée (charge conservée) ; moins de séries que prévu (conservée) ; incrément 0 (poids du corps : charge inchangée, donc aucune suggestion) ; `prefillSets` longueur et valeurs ; `suggestionsFor` ne liste que les exercices dont la charge monte ; `isReached` dans les deux sens et à l'égalité ; `reachedBy` : atteint, déjà atteint, non atteint, sens `down`, exercice absent de la séance ; validations (bornes et métrique mal formée).
- [ ] **Step 2: Run red; Step 3: Implement; Step 4: green; commit** `feat: training progression, prefill and milestones domain (M3)`.

### Task 3: Domaine — modèle de départ

**Files:**
- Create: `src/modules/training/domain/template.ts`, `template.test.ts`

**Interfaces:**
- Produces: `export const starterPlan: (startDay: string) => NewPlan` (nom « Reprise progressive », `active: true`, `startDay`).
- Contenu : 3 phases (« Reprise » 4 semaines, « Construction » 6 semaines, « Force et explosivité » 6 semaines), chacune avec 3 séances (« Séance A — Haut du corps », « Séance B — Bas du corps », « Séance C — Corps entier ») de 4 à 5 exercices. Poids du corps avec `incrementKg: 0` (pompes, tractions assistées, dips, gainage en secondes, sauts) ; haltères et barre avec `incrementKg: 2.5`. Tous les `exerciseId` sont `exerciseIdOf(name)`.

- [ ] **Step 1: Failing tests** — le modèle passe `validatePlan` ; 3 phases de 4, 6 et 6 semaines ; chaque phase a 3 séances ; les `exerciseId` sont ceux de `exerciseIdOf(name)` ; deux exercices de même nom ont le même identifiant dans toutes les phases (historique partagé) ; le gainage est en secondes (le nom l'indique).
- [ ] **Step 2–4: Implement with a small `ex(name, sets, reps, incrementKg)` helper; green; commit** `feat: starter training plan (M3)`.

### Task 4: Ports, cas d'usage et adaptateurs en mémoire

**Files:**
- Create: `src/modules/training/application/ports.ts`, `trainingUseCases.ts`, `trainingUseCases.test.ts`
- Create: `src/modules/training/adapters/inMemoryPlanRepository.ts`, `inMemoryWorkoutRepository.ts`, `inMemoryMilestoneRepository.ts`
- Create: `src/modules/training/index.ts` (API publique, rempli aux tâches suivantes)

**Interfaces:**
- Produces:
  ```ts
  export interface PlanRepository {
    create(plan: NewPlan): Promise<void>;
    update(plan: Plan): Promise<void>;
    observeAll(onNext: (plans: Plan[]) => void, onError: (e: Error) => void): () => void;
  }
  export interface WorkoutRepository {
    add(log: NewWorkoutLog): Promise<void>;
    /** The latest workout that holds the exercise (day, newest first), or undefined. */
    latestWithExercise(exerciseId: string): Promise<WorkoutLog | undefined>;
    /** The workouts that hold the exercise, newest first. */
    history(exerciseId: string, max: number): Promise<WorkoutLog[]>;
    observeLatest(onNext: (log: WorkoutLog | undefined) => void, onError: (e: Error) => void): () => void;
  }
  export interface MilestoneRepository {
    create(m: NewMilestone): Promise<void>;
    remove(id: string): Promise<void>;
    markAchieved(id: string, at: Date): Promise<void>;
    list(): Promise<Milestone[]>;
    observeAll(onNext: (ms: Milestone[]) => void, onError: (e: Error) => void): () => void;
  }
  export type DraftExercise = { exercise: PlannedExercise; last: LoggedSet[]; sets: DraftSet[] };
  export type WorkoutSummary = { suggestions: Suggestion[]; achieved: Milestone[] };
  trainingUseCases({ plans, workouts, milestones, clock, timezone }) → {
    observePlans, observeLatestWorkout, observeMilestones,
    startFromTemplate(existing?: Plan): Promise<void>,   // create, or update the existing plan's content
    savePlan(plan: Plan): Promise<void>,                  // validatePlan, then update; rejects with the message
    startWorkout(session: PlannedSession): Promise<DraftExercise[]>,
    finishWorkout(input: { plan: Plan; session: PlannedSession; done: LoggedSet[]; startedAt: Date }): Promise<WorkoutSummary>,
    exerciseHistory(exerciseId: string): Promise<WorkoutLog[]>,  // 20 last
    addMilestone(m: NewMilestone): Promise<void>,         // validateMilestone, then create
    removeMilestone(id: string): Promise<void>,
  }
  ```
- Règles : `finishWorkout` calcule `day` avec `dayKey(now, timezone)`, `durationMin` = minutes arrondies entre `startedAt` et maintenant (au moins 1), `exerciseIds` = les `exerciseId` distincts des séries faites, rejette une séance sans série faite ; il enregistre la séance, puis lit les paliers (`list`), marque atteints ceux que `reachedBy` renvoie (`markAchieved(id, now)`), et renvoie `{ suggestions: suggestionsFor(session exercises, done), achieved }`. `startWorkout` appelle `latestWithExercise` pour chaque exercice (en parallèle) et `prefillSets`.

- [ ] **Step 1: Failing tests** (adaptateurs en mémoire, horloge fixe) — `startFromTemplate` crée un programme actif avec `startDay` du jour du profil ; avec un programme existant il remplace son contenu sans changer l'id ; `savePlan` refuse un programme invalide (message) et accepte un valide ; `startWorkout` préremplit avec la charge suggérée après une séance réussie (charge + incrément), garde la charge après une séance manquée, vide sans historique ; `finishWorkout` écrit le journal (jour, durée, exercices, séries), renvoie les suggestions et marque atteint un palier franchi (et pas deux fois) ; refuse une séance sans série ; `history` renvoie les plus récentes d'abord ; `observeLatestWorkout` suit les ajouts.
- [ ] **Step 2–4: Implement; green; commit** `feat: training ports, use cases and in-memory adapters (M3)`.

### Task 5: Adaptateurs Firestore, règles, index

**Files:**
- Create: `src/modules/training/adapters/firestorePlanRepository.ts`, `firestoreWorkoutRepository.ts`, `firestoreMilestoneRepository.ts`, et leurs `*.emulator.test.ts`
- Modify: `firebase/firestore.rules` (3 blocs), `firebase/firestore.rules.emulator.test.ts`, `firebase.json` (clé `indexes`)
- Create: `firebase/firestore.indexes.json`

**Règles à écrire** (même style que les blocs existants, fonctions d'aide pour la forme) :
- `plans/{id}` : `create, update` par le propriétaire ; clés exactes `name, active, startDay, phases, updatedAt` ; `name` 1–100 ; `active` booléen ; `startDay` jour valide ; `phases` liste de 1 à 12 (la forme interne n'est validée qu'au niveau de la taille de la liste, la forme détaillée l'est dans le domaine) ; `updatedAt` timestamp ; `delete` par le propriétaire.
- `workoutLogs/{id}` : `create` seulement ; clés exactes `day, planId, sessionName, exerciseIds, sets, durationMin, createdAt, deletedAt` ; `day` valide ; `planId` et `sessionName` 1–100 ; `exerciseIds` liste de 1 à 20 ; `sets` liste de 1 à 200 ; `durationMin` entier 1–1 440 ; `createdAt` timestamp ; `deletedAt == null`. Pas d'`update` ni de `delete` en M3.
- `milestones/{id}` : `create` avec clés `metric, target, direction, label` ; `metric` 1–100, `target` nombre 0–100 000, `direction in ['up','down']`, `label` 1–100 ; `update` seulement pour poser `achievedAt` (timestamp) une fois : `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['achievedAt'])` et `!('achievedAt' in resource.data)` ; `delete` par le propriétaire.
- Index : `workoutLogs` : `exerciseIds` (tableau contient) + `day` décroissant.

- [ ] **Step 1: Failing rules tests** (accepté / refusé pour chaque règle, dont : propriétaire seulement, clé en trop, liste trop longue, `deletedAt` non nul, `update` d'un journal refusé, `achievedAt` posé une fois puis refusé une deuxième fois, autre champ modifié refusé).
- [ ] **Step 2: Adapters + emulator tests** — les trois dépôts passent les mêmes cas que leurs jumeaux en mémoire ; `latestWithExercise` et `history` utilisent `where('exerciseIds','array-contains', id)` + `orderBy('day','desc')` ; `observeLatest` ordonne par `createdAt` décroissant, limite 1 ; les écritures hors-ligne de deux clients se retrouvent (un journal par téléphone).
- [ ] **Step 3: green (`npm run test:emulator`); commit** `feat: Firestore plans, workouts and milestones, rules and index (M3)`.

### Task 6: Écran Sport (onglet), programme et paliers

**Files:**
- Create: `src/modules/training/ui/SportScreen.tsx`, `SportScreen.test.tsx`, `MilestonesSection.tsx`, `MilestoneForm.tsx`
- Modify: `app/(app)/(tabs)/_layout.tsx` (3ᵉ onglet « Sport », icône `dumbbell`), `src/modules/training/index.ts`, `src/composition.ts`, `src/navigation.test.tsx` (la composition simulée reçoit `training`)
- Create: `app/(app)/(tabs)/sport.tsx`

**Comportement :**
- Sans programme : carte « Aucun programme » avec « Partir du modèle » (crée le modèle, `startFromTemplate`) et le rappel « Ce modèle est un point de départ à adapter. Consulte un professionnel avant de reprendre une activité intense. »
- Avec programme : titre (nom, « Phase 1 — Reprise · semaine 2 sur 4 », ou « Programme terminé » quand `finished`), la liste des séances de la phase en cours avec un bouton « Démarrer » (la séance suivante est marquée « Prochaine »), un bouton « Modifier le programme » (→ `/plan`), « Repartir du modèle » avec confirmation (« Remplacer le programme ? »).
- Paliers : liste (libellé, cible, ✓ atteint avec la date), « Ajouter un palier » (formulaire : exercice du programme, `Répétitions` ou `Charge`, cible, sens, libellé proposé, validation `validateMilestone`), suppression avec confirmation.
- `onStart(session)` ouvre `/workout?session=<index>` ; `onEditPlan` ouvre `/plan`.

- [ ] Tests RNTL : état vide et création depuis le modèle ; position (phase et semaine) ; « Prochaine » ; « Démarrer » appelle `onStart` avec la bonne séance ; ajout et suppression d'un palier ; message d'erreur annoncé (`accessibilityLiveRegion`) ; navigation vers l'onglet Sport. Commit `feat: Sport tab with the programme and milestones (M3)`.

### Task 7: Écran de séance, chrono, résumé

**Files:**
- Create: `src/modules/training/ui/WorkoutScreen.tsx`, `WorkoutScreen.test.tsx`, `RestTimer.tsx`, `WorkoutSummary.tsx`
- Create: `app/(app)/workout.tsx` (pile, titre « Séance »)

**Comportement :**
- Charge le brouillon avec `startWorkout(session)` ; état « Chargement… » puis les exercices : nom, « Dernière fois : 3 × 8 à 20 kg » (ou « Première fois »), « À viser : 22,5 kg » quand la charge suggérée dépasse la dernière, puis une ligne par série : numéro, champ `kg` (clavier décimal), champ `reps` (clavier numérique), case « fait » (48 dp).
- Cocher une série démarre le `RestTimer` (90 s, « Repos 1:30 », « Passer ») ; le décompte utilise `useNow`-like interval d'une seconde et ne dépend pas de l'horloge de l'application.
- « Terminer » (désactivé tant qu'aucune série n'est cochée) appelle `finishWorkout` avec les séries cochées, puis affiche `WorkoutSummary` : « Bravo, séance enregistrée », durée, la liste « À viser la prochaine fois : Squat gobelet 22,5 kg (+2,5) », les paliers atteints (« Palier atteint : 10 tractions »), et « Retour » (`router.back`).
- Retour système ou bouton « Quitter » avec des séries cochées : confirmation « Abandonner la séance ? ».
- Valeurs invalides (kg ou reps hors bornes) : message « kg entre 0 et 1 000, répétitions entre 0 et 1 000. » et « Terminer » désactivé.

- [ ] Tests RNTL (cas d'usage en mémoire) : préremplissage avec la charge à viser ; cocher une série affiche le chrono ; « Passer » le masque ; terminer écrit le journal et affiche suggestions et paliers ; « Terminer » désactivé sans série cochée ; confirmation d'abandon ; messages annoncés. Commit `feat: workout screen with rest timer and summary (M3)`.

### Task 8: Éditeur de programme et historique par exercice

**Files:**
- Create: `src/modules/training/ui/PlanScreen.tsx`, `PlanScreen.test.tsx`, `ExerciseForm.tsx`, `ExerciseHistoryScreen.tsx`, `ExerciseHistoryScreen.test.tsx`
- Create: `app/(app)/plan.tsx`, `app/(app)/exercise.tsx`

**Comportement :**
- `PlanScreen` : nom du programme (champ), puis phases (nom, semaines) et leurs séances, chaque exercice en ligne « Squat gobelet · 3 × 10 · +2,5 kg » ; toucher un exercice ouvre `ExerciseForm` (nom, séries, répétitions, incrément en kg) avec « Enregistrer » (désactivé si `validatePlan` refuse, message annoncé) et « Supprimer l'exercice » (confirmation ; refusée si c'est le dernier de la séance) ; « Ajouter un exercice » par séance ; « Historique » sur un exercice ouvre `/exercise?id=`. Enregistrer appelle `savePlan` via `run`.
- `ExerciseHistoryScreen` : les 20 dernières séances qui contiennent l'exercice (jour fr-FR, séries « 8 × 20 kg · 8 × 20 kg · 6 × 20 kg »), « Aucune séance pour cet exercice. » sinon.

- [ ] Tests RNTL : modification d'un exercice (écriture par `run`, id d'exercice recalculé du nom), ajout et suppression, refus de supprimer le dernier, validation, navigation vers l'historique, historique vide et rempli. Commit `feat: plan editor and exercise history (M3)`.

### Task 9: Carte « Séance du jour » sur Aujourd'hui

**Files:**
- Modify: `src/modules/today/ui/TodayScreen.tsx` (+ test), `app/(app)/(tabs)/index.tsx`
- Create: `src/modules/training/ui/useNextSession.ts` (+ test), exportée par l'index du module

**Comportement :** `useNextSession(training, clock, timezone)` observe le programme et la dernière séance et renvoie `{ title, subtitle, index } | undefined` (« Séance A — Haut du corps », « Phase 1 — Reprise · semaine 2 »). `TodayScreen` reçoit `session?: { title; subtitle; onStart }` et affiche, sous les jauges, une carte avec une icône d'haltère et un bouton « Démarrer » ; rien sans programme actif ou quand il est terminé.

- [ ] Tests : la carte n'existe que s'il y a une séance ; « Démarrer » appelle `onStart` ; `useNextSession` change quand une séance est enregistrée (la suivante). Commit `feat: today's session card on the Today screen (M3)`.

### Task 10: Documentation, déploiement, revue

- [ ] README : section « À vérifier sur le téléphone avant M4 » pour M3 (créer le programme depuis le modèle, une séance complète hors-ligne, la charge à viser à la 2ᵉ séance, un palier, l'historique), et la commande `npx firebase deploy --only firestore:rules,firestore:indexes --project <id>` à lancer **avant** d'installer M3 (l'index doit être construit avant la première lecture).
- [ ] DESIGN.md : l'onglet Sport, l'écran de séance, la carte « Séance du jour » ; `.impeccable/design.json` régénéré.
- [ ] Revue indépendante de la branche par un sous-agent, puis corrections ; fusion dans `main` après les contrôles complets.
