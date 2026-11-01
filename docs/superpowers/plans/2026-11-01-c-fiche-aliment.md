# Fiche d'un aliment (chantier C) : plan d'implémentation

> **Pour les agents :** exécuter tâche par tâche, TDD, une validation et un commit par tâche.

**But :** une fiche d'aliment à la Cronometer : quantité et portion, groupe, heure et jour, ligne de source, anneau de l'énergie, objectifs de macros « avec cette portion », et la même fiche pour modifier une ligne du journal (y compris son jour, de façon atomique).

**Architecture :** `settings` gagne deux objectifs (`carbsNetG`, `fatG`). `nutrition` gagne un domaine de portion (glucides nets, répartition de l'énergie, instant valide), un cas d'usage `updateEntry` (quantité, groupe, instant) servi par un dépôt qui déplace les totaux de jour dans le même lot, et une fiche partagée (`PortionSheet`) utilisée pour un aliment neuf (`FoodDetail`) comme pour une ligne existante (`EntryDetail`). Le sélecteur natif de date et d'heure est derrière une fonction injectée (`pickWhen`).

**Spec :** `docs/superpowers/specs/2026-11-01-fiche-aliment-marques-design.md` §2.

## Contraintes globales

- Objectifs : lipides = 30 % des calories ÷ 9 arrondis à 5 g ; glucides nets = (70 % des calories − 4 × protéines) ÷ 4 arrondis à 5 g, non négatifs. Pour 2 200 kcal et 130 g de protéines : 75 g et 255 g. Bornes : lipides 0–500 g, glucides nets 0–1 000 g (domaine et règles). Défaut du profil : 75 g et 255 g.
- Glucides nets = glucides − fibres (jamais négatifs) ; sans la valeur des fibres, ils valent les glucides et la fiche marque « partiel ».
- Instant d'une ligne : pas dans le futur, pas plus de 365 jours dans le passé ; le jour se calcule avec le fuseau du profil.
- Une modification de ligne qui change de jour retire ses macros du total de l'ancien jour et les ajoute à celui du nouveau **dans le même `writeBatch`**. Les règles laissent changer `day`, `meal`, `createdAt`, `grams`, `macros`, `nutrients`, `updatedAt` ; rien d'autre.
- L'anneau n'est jamais seul : grammes et pourcentages en texte, et un texte alternatif qui dit les trois pourcentages. Zones tactiles de 48 dp. Textes en français, code et commentaires en anglais.
- `@react-native-community/datetimepicker` s'installe avec `npx expo install` (module natif : reconstruction du client de développement).
- Avant de conclure : `npm run lint -- --no-cache`, `npm run typecheck`, `npm test`, `npm run lint:deps`, `npm run test:emulator`.

## Fichiers

- `settings` : `domain/profile.ts`, `domain/goals.ts`, `adapters/firestoreProfileRepository.ts`, `ui/GoalsScreen.tsx`, `ui/SetupScreen.tsx`, `firebase/firestore.rules` (+ leurs tests).
- `nutrition/domain` : `portion.ts` (+ test) ; `food.ts` (`isValidLoggedAt`).
- `nutrition/application` : `ports.ts`, `mealUseCases.ts` (`logFood(…, at?)`, `updateEntry`).
- `nutrition/adapters` : dépôts de lignes (mémoire, Firestore : `update` à la place de `updateGrams`), règles.
- `nutrition/ui` : `EnergyRing.tsx`, `GoalsWithPortion.tsx`, `MealPicker.tsx`, `WhenPicker.tsx`, `PortionSheet.tsx`, `FoodDetail.tsx`, `EntryDetail.tsx`, `MealsScreen.tsx` (la ligne ouvre la fiche, `EntryActions` disparaît), `AddFoodScreen.tsx`.
- `src/platform/dateTimePicker.ts`, routes `add-food.tsx` et `repas.tsx`, `package.json`.

---

### Tâche 1 : objectifs de glucides nets et de lipides

- [ ] Tests : `proposeGoals` (2 200 kcal / 130 g → 75 et 255 ; plancher 1 500 kcal ; protéines très hautes → glucides à 0), `validateProfile` (bornes des deux champs), dépôt Firestore (lecture sans les deux clés → valeurs par défaut ; écriture), règles (clés acceptées, 501 g et 1 001 g refusés), `GoalsScreen` et `SetupScreen` (six champs, « Proposer » les remplit).
- [ ] Code : `Goals` + `carbsNetG`, `fatG` ; `DEFAULT_PROFILE.goals` ; `proposeGoals` ; `validateProfile` ; `firestoreProfileRepository` ; `isGoals` ; les deux écrans. Corriger les objets `goals` des tests existants.
- [ ] Commit `feat: net carbs and fat goals`.

### Tâche 2 : domaine de la portion, cas d'usage et dépôt

**Produit :**
```ts
netCarbs(macros: Macros, nutrients?: Nutrients): { grams: number; partial: boolean }   // portion.ts
energySplit(protein: number, netCarbs: number, fat: number): { proteinPct: number; carbsPct: number; fatPct: number } | undefined
isValidLoggedAt(at: Date, now: Date): boolean                                          // food.ts
type EntryChange = { grams: number; meal: Meal; day: string; createdAt: Date; macros: Macros; nutrients?: Nutrients }
FoodEntryRepository.update(entry: FoodEntry, change: EntryChange): Promise<void>       // remplace updateGrams
mealUseCases.logFood(meal, food, grams, at?: Date) ; mealUseCases.updateEntry(entry, { grams, meal, at })
```
- [ ] Tests : `netCarbs` (avec fibres, fibres supérieures aux glucides, sans fibres → partiel), `energySplit` (4/4/9, somme 100, tout à 0 → `undefined`), `isValidLoggedAt` (maintenant, demain, il y a 365 et 366 jours), cas d'usage (`logFood` à une heure passée : jour et `createdAt` ; refus du futur ; `updateEntry` : quantité mise à l'échelle depuis les valeurs figées, groupe, jour recalculé avec le fuseau, passage de minuit), émulateur : `update` même jour (total = delta), `update` autre jour (ancien jour moins, nouveau jour plus, un seul lot ; une ligne refusée par les règles ne bouge aucun total), jour sans document de total (créé par fusion), règles (`day` invalide, `meal` inconnu, `createdAt` non horodatage, clé hors liste refusés).
- [ ] Code : domaine, `ports.ts`, `mealUseCases.ts` (`changeGrams` passe par `update`), dépôts en mémoire et Firestore, règles.
- [ ] Commit `feat: a journal entry can change its group and its time`.

### Tâche 3 : la fiche

- [ ] `npx expo install @react-native-community/datetimepicker` ; `src/platform/dateTimePicker.ts` : `pickWhen(mode: 'date' | 'time', value: Date, bounds: { min: Date; max: Date }): Promise<Date | undefined>` par `DateTimePickerAndroid.open`.
- [ ] Tests : `EnergyRing` (arcs, texte, texte alternatif), `GoalsWithPortion` (total du jour choisi + portion contre l'objectif ; la ligne en cours de modification n'est pas comptée deux fois), `MealPicker` (quatre groupes, coche), `WhenPicker` (affiche jour et heure ; un choix appelle `onChange` ; refuse le futur), `PortionSheet` (quantité invalide, source, ajout avec groupe et instant choisis), `FoodDetail` (ligne de source Ciqual / Mon aliment ; ajouter ; modifier et supprimer un aliment perso), `EntryDetail` (quantité, groupe, jour et heure ; enregistrer appelle `updateEntry` ; supprimer), `MealsScreen` (la ligne ouvre la fiche ; la carte affiche glucides nets et lipides).
- [ ] Code : les composants, `FoodDetail` réécrit au-dessus de `PortionSheet`, `EntryDetail`, `MealsScreen` (état `selected` → fiche à la place de la liste), `AddFoodScreen` (prop `pickWhen`, objectifs), routes ; supprimer `EntryActions` et ses tests.
- [ ] Commit `feat: the food sheet with group, time, energy ring and goals`.

### Tâche 4 : documents

- [ ] README (état, objectifs à six champs, vérifications sur téléphone : sélecteurs natifs, anneau, modification d'un jour ; **reconstruire le client** pour le sélecteur ; règles à redéployer), `DESIGN.md` (anneau, ligne d'objectif), spec principale.
- [ ] Les cinq vérifications ; commit `docs: the food sheet`.

## Hors de ce plan

Le retour matériel d'Android sur la fiche d'une ligne (il quitte l'onglet au lieu de revenir à la liste), un sélecteur d'heure personnalisé (le natif suffit), les objectifs en pourcentage, la modification d'une ligne d'un autre jour que le jour courant depuis le journal (le journal n'affiche que le jour courant).
