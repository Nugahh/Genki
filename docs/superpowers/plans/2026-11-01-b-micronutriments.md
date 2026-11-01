# Micronutriments (chantier B) : plan d'implémentation

> **Pour les agents :** exécuter tâche par tâche (superpowers:subagent-driven-development ou executing-plans), TDD, une validation et un commit par tâche.

**But :** suivre 26 nutriments (vitamines, minéraux, fibres, sel, graisses saturées, sucres) pour chaque aliment Ciqual : sur la fiche, dans le journal et dans le Suivi (jour, semaine, mois), avec le pourcentage du repère ANSES du profil.

**Architecture :** `nutrition` possède le catalogue, les repères et le calcul (domaine pur) ; les lignes du journal portent les valeurs de la portion (`nutrients`) ; `tracking` lit les lignes par plage de jours (nouvelle source `meals`) et en tire un `MetricDefinition` par nutriment. Aucun total n'est stocké.

**Spec :** `docs/superpowers/specs/2026-11-01-suivi-mensuel-micronutriments-design.md` §3 à §5.

## Contraintes globales

- Les 26 nutriments, leurs unités et leurs codes Ciqual sont ceux du tableau §3.1 de la spec ; vitamine E = 71010, sinon 53100.
- Une case Ciqual vide (`-`) est une valeur **absente**, jamais 0 ; « traces » et « < x » valent 0.
- Les repères sont ceux du tableau §3.2 (valeurs fixes du code, source en commentaire), pour les **18 ans et plus** ; en dessous, ou sans profil valide : aucun repère, donc aucun pourcentage.
- Tons : à atteindre vert ≥ 90 %, orange 60–89 %, rouge en dessous ; à limiter vert ≤ 100 %, orange ≤ 120 %, rouge au-delà. Un total **partiel** à atteindre qui n'a pas atteint son repère reste neutre ; jamais la couleur seule (pourcentage en texte, état lu à voix haute).
- `foodEntries.nutrients` : carte facultative aux clés limitées aux 26 identifiants, valeurs de 0 à 1 000 000. Mise à l'échelle à **trois chiffres significatifs**.
- Aliments perso : pas de nutriments (leurs lignes comptent comme partielles). Anciens repas : pas de rattrapage.
- Requête de plage sur `foodEntries` par `day` seul (pas d'index composite) ; les lignes supprimées sont écartées côté client.
- Pas de vue Année pour les nutriments. Textes à l'écran en français, code et commentaires en anglais.
- Règles de dépendances : un module n'en utilise un autre que par son `index.ts` ; `domain/` n'importe rien d'extérieur à `domain/`.
- Avant de conclure : `npm run lint -- --no-cache`, `npm run typecheck`, `npm test`, `npm run lint:deps`, `npm run test:emulator`.

## Identifiants

`fiber sugars saturatedFat salt vitA vitD vitE vitK vitC vitB1 vitB2 vitB3 vitB5 vitB6 vitB9 vitB12 calcium iron magnesium potassium zinc selenium iodine phosphorus copper manganese`.
Groupes : `vitamins` (vitA…vitB12), `minerals` (calcium…manganese), `fiber`, `limit` (salt, saturatedFat, sugars).

## Fichiers

- Créer `src/modules/nutrition/domain/nutrients.ts` (+ test) : catalogue, `Nutrients`, `nutrientsFor`, `scaleNutrients`, `sumNutrients`.
- Créer `src/modules/nutrition/domain/references.ts` (+ test) : `referencesFor(who, kcalGoal)`.
- Modifier `scripts/ciqual/convert.ts` (+ test), `scripts/build-ciqual.ts`, `src/modules/nutrition/adapters/ciqualCatalog.ts` (+ test), `src/platform/ciqual.ts`, régénérer `assets/ciqual.db`.
- Modifier `food.ts`, `mealUseCases.ts`, `ports.ts`, les deux dépôts de lignes (mémoire, Firestore), `firebase/firestore.rules` (+ tests émulateur), `src/modules/nutrition/index.ts`.
- `tracking` : `domain/metric.ts`, `domain/series.ts`, `domain/metrics.ts`, `adapters/mealsFactsSource.ts`, `application/registry.ts`, `application/trackingUseCases.ts`, `ui/goalsOf.ts`, `ui/MicronutrientsScreen.tsx`, `ui/SectionScreen.tsx`, `ui/NutritionExtras.tsx`, `src/theme.ts`, `src/composition.ts`, route `app/(app)/(tabs)/suivi/[section].tsx`.
- `nutrition/ui` : `FoodDetail.tsx` (liste « Nutriments »), `MealsScreen.tsx` (carte « Nutriments du jour »).

---

### Tâche 1 : catalogue, calcul et repères (domaine pur)

**Produit :**
```ts
export type NutrientId = 'fiber' | 'sugars' | /* … les 26 … */;
export type NutrientGroup = 'vitamins' | 'minerals' | 'fiber' | 'limit';
export type NutrientInfo = { id: NutrientId; label: string; unit: 'g' | 'mg' | 'µg'; group: NutrientGroup };
export const NUTRIENTS: readonly NutrientInfo[]; // dans l'ordre d'affichage
export type Nutrients = Partial<Record<NutrientId, number>>;
export const nutrientsFor: (per100g: Nutrients, grams: number) => Nutrients;           // 3 chiffres significatifs
export const scaleNutrients: (n: Nutrients, from: number, to: number) => Nutrients;    // idem, from > 0
export const sumNutrients: (list: (Nutrients | undefined)[]) => { totals: Nutrients; incomplete: NutrientId[] };
export type Who = { sex: 'male' | 'female'; age: number };
export const referencesFor: (who: Who, kcalGoal: number) => Nutrients; // {} sous 18 ans ou âge invalide
```
`incomplete` : les identifiants qu'au moins une ligne n'a pas (ligne sans `nutrients` comprise). Liste vide : aucun total, rien d'incomplet.
`referencesFor` : table §3.2 ; calcium 1 000 mg avant 25 ans puis 950 ; graisses saturées = `12 % × kcalGoal ÷ 9` arrondi à 0,1 g.

- [ ] **Étape 1 : tests** (`nutrients.test.ts`, `references.test.ts`) : 26 identifiants distincts et groupés ; `nutrientsFor` (0,00123 mg/100 g × 50 g, 2 345 mg × 3 g → 3 chiffres) ; `scaleNutrients` aller-retour ; `sumNutrients` (somme, ligne sans nutriments → tout incomplet, nutriment absent d'une ligne → incomplet pour lui seul, liste vide) ; `referencesFor` homme et femme, calcium à 24 et 25 ans, 17 ans → `{}`, âge `NaN` → `{}`, graisses saturées pour 2 200 kcal = 29,3 g.
- [ ] **Étape 2 :** voir les tests échouer (`npx jest src/modules/nutrition/domain`).
- [ ] **Étape 3 :** écrire `nutrients.ts` et `references.ts` (la table des repères avec la source ANSES 2016 en commentaire).
- [ ] **Étape 4 :** tests verts ; commit `feat: nutrient catalogue, scaling and ANSES references (domain)`.

### Tâche 2 : la base Ciqual porte les nutriments

- [ ] **Étape 1 : tests** (`convert.test.ts`) : un aliment avec 71010 vide et 53100 renseigné prend 53100 ; avec 71010 renseigné, 71010 ; une case `-` laisse le nutriment absent (pas 0), « traces » et « < 0,5 » donnent 0 ; un aliment sans aucun nutriment n'a pas de clé `nutrients` ; les valeurs sont arrondies à 3 chiffres significatifs ; **chaque identifiant du catalogue a un code** (`CODES: Record<NutrientId, string[]>` rend l'oubli impossible à la compilation, et un test vérifie qu'aucun code n'est partagé).
- [ ] **Étape 2 :** `convert.ts` : `CODES`, `WANTED` élargi, `CiqualFood.nutrients?`. `build-ciqual.ts` : colonne `nutrients TEXT` (JSON ou NULL). `ciqualCatalog.ts` : colonne lue, `Food.nutrients` rempli (test avec Node SQLite). `food.ts` : `Food.nutrients?: Nutrients` (pour 100 g).
- [ ] **Étape 3 :** régénérer : `npm run build:ciqual -- <scratchpad>/ciqual-src 2025-11-03` ; vérifier le nombre d'aliments (3 484) et la taille ; nom du fichier de `src/platform/ciqual.ts` : `ciqual-2025-11-03-r2.db` (adapter `ciqual.test.ts`).
- [ ] **Étape 4 :** tests verts ; commit `feat: Ciqual database with 26 nutrients`.

### Tâche 3 : une ligne du journal porte ses nutriments

- [ ] **Étape 1 : tests** : `mealUseCases` (`logFood` fige `nutrients` de la portion ; sans nutriments dans l'aliment, la ligne n'en a pas ; `changeGrams` met à l'échelle ; `logFavorite` les retrouve par le catalogue ; `observeBetween(from, to)` rend les lignes vivantes de la plage), dépôt en mémoire, **émulateur** : écriture et relecture de `nutrients`, plage de jours (borne basse et haute incluses, ligne supprimée écartée, aucun index composite requis).
- [ ] **Étape 2 :** `FoodEntry.nutrients?`, `FoodEntryRepository.updateGrams(entry, grams, macros, nutrients?)` et `observeRange(from, to, …)`, `mealUseCases.observeBetween`. Firestore : `add`/`updateGrams` n'écrivent `nutrients` que s'il existe (`undefined` est refusé par le SDK), `toEntry` le relit, `where('day', '>=', from)` + `where('day', '<=', to)`.
- [ ] **Étape 3 : règles** : `isEntryNutrients` (clés limitées aux 26, chaque valeur nombre de 0 à 1 000 000) ; `create` accepte la clé `nutrients` ; `update` de quantité accepte `['grams', 'macros', 'nutrients', 'updatedAt']`. Tests des règles : clé inconnue refusée, valeur négative refusée, valeur à 1 000 001 refusée, ligne sans `nutrients` acceptée.
- [ ] **Étape 4 :** `index.ts` de `nutrition` exporte `NUTRIENTS`, `sumNutrients`, `referencesFor`, `nutrientsFor` et les types. Vérifier que l'export et l'import de sauvegarde (`data`) laissent passer `nutrients` (test).
- [ ] **Étape 5 :** `npm run test:emulator` ; commit `feat: journal entries keep their nutrients`.

### Tâche 4 : le Suivi lit les nutriments (domaine, source, registre)

**Produit :** `DayFacts.nutrients?: Record<string, number>` et `incomplete?: string[]` ; `Goals.nutrients?: Record<string, number>` (les repères) ; `SourceId` + `'meals'` ; `SectionId` + `'micro'` (« Micronutriments ») ; `Tint` + `'micro'` ; `MetricDefinition.target` + `'atMost'` ; `MetricDefinition.incomplete?: (facts) => boolean` ; `toneOf(def, goals, value, incomplete = false)` ; `MetricView.incomplete?: boolean` ; `trackingUseCases.observeMicronutrients(goals, period, anchor, onNext, onError)` rend les lignes `{ id, value?, incomplete, reference?, pct?, tone }`.

- [ ] **Étape 1 : tests** : `series` (`atMost` : 100 % bon, 120 % orange, 121 % rouge ; à atteindre incomplet sous le repère → `none`, au repère → `good` ; à limiter incomplet au-dessus de la limite → rouge) ; `mealsFactsSource` (somme par jour, `incomplete` par jour, jour sans ligne absent) ; registre (26 nutriments, `section: 'micro'`, `value` lit `nutrients`, `goal` lit `Goals.nutrients`, `format` en unité du nutriment) ; `observeMicronutrients` (un seul abonnement à `meals` pour les 26 lignes ; jour : le total, tonalité `none` pour aujourd'hui ; semaine : moyenne des jours terminés ; sans repère : `pct` absent) ; `observeMetric` pose `view.incomplete`.
- [ ] **Étape 2 :** extraire de `observeMetric` le calcul pur d'une vue (`viewOf(def, goals, period, anchor, facts, today)`) que les deux méthodes appellent. `domain/metrics.ts` garde les statistiques de base et la section `micro` ; `application/registry.ts` ajoute `nutrientMetric(info)` pour chaque entrée de `NUTRIENTS` (import de `@/modules/nutrition`) et exporte `ALL_METRICS`, `findMetric`, `metricsIn`. `HubEditor`, `SectionScreen`, `SuiviHub`, `TrainingExtras`, `resolveUi` passent au registre.
- [ ] **Étape 3 :** `goalsOf(profile, year = new Date().getFullYear())` ajoute `nutrients: referencesFor({ sex, age: year - birthYear }, profile.goals.kcal)` ; `composition.ts` ajoute la source `meals` ; couleur `chart.micro` dans `theme.ts` (4,5:1 sur la page, distincte des autres) et son test de contraste.
- [ ] **Étape 4 :** tests verts ; commit `feat: nutrients in the Suivi registry and sources`.

### Tâche 5 : l'écran Micronutriments

- [ ] **Étape 1 : tests** (`MicronutrientsScreen.test.tsx`, `SectionScreen.test.tsx`, `extras.test.tsx`) : groupes « À atteindre » (Vitamines, Minéraux, Fibres) et « À limiter » ; chaque ligne dit sa valeur, son pourcentage en texte et son état (« dans la cible », « loin de la cible », « partiel ») ; une valeur incomplète s'écrit « au moins … » ; sans repère, « repères pour adultes » et pas de pourcentage ; jour, semaine et mois sélectionnables ; toucher une ligne ouvre `onOpen(id)` ; la mention « Repères de l'ANSES pour adultes, pas un avis médical » ; `SectionScreen` : au plus six statistiques en puces (les nutriments se choisissent dans la liste) et la ligne « Valeur partielle : … » quand `view.incomplete` ; `NutritionExtras` : le bouton « Micronutriments ».
- [ ] **Étape 2 :** `MicronutrientsScreen` (sélecteur de période, barres fines en %), export dans `tracking/index.ts`, route `[section].tsx` (`micro` sans `metric` : la liste ; avec `metric` : `SectionScreen`), bouton dans `NutritionExtras` qui navigue vers `/suivi/micro`.
- [ ] **Étape 3 :** tests verts ; commit `feat: the Micronutriments screen`.

### Tâche 6 : fiche d'un aliment, journal, documents

- [ ] **Étape 1 : tests** : `FoodDetail` (liste repliable « Nutriments » pour la portion saisie, pourcentage du repère ; aliment perso : aucune liste), `MealsScreen` (carte « Nutriments du jour » : les trois nutriments à atteindre les moins couverts, elle ouvre la vue Micronutriments ; pas de carte sans repère ni sans repas).
- [ ] **Étape 2 :** `FoodDetail` reçoit `references` et `MealsScreen` reçoit `references` et `onOpenNutrients` (les écrans de `app/` les passent depuis `goalsOf`).
- [ ] **Étape 3 :** `README.md` (état, régénération de la base, **règles à redéployer** pour `nutrients`, vérifications sur téléphone : liste, valeurs partielles, TalkBack), `DESIGN.md` (ligne de nutriment, couleur jamais seule), spec principale §4.
- [ ] **Étape 4 :** les cinq vérifications ; commit `feat: nutrients on the food sheet and the journal`.

## Hors de ce plan

Le calcul sur trois chiffres significatifs d'une longue chaîne de changements de quantité (la précision se dégrade, comme pour les macros) ; la suppression de l'ancienne copie de la base dans le stockage de l'application (1 Mo) ; des nutriments pour les aliments perso ; les repères des moins de 18 ans.
