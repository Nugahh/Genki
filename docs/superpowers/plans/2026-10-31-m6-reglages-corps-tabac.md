# M6 Réglages, corps, tabac et données Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The repository code is the reference where this plan and the code differ.

**Goal:** Terminer le MVP hors pas : un vrai profil (taille, sexe, naissance, activité) et des objectifs avec modes et garde-fous, les réglages (objectifs, profil, contenants d'eau, tabac, données), la première configuration, le poids et le tour de taille saisis en un tap avec leurs paliers, le suivi du tabac (jours sans fumer, record, économies, envies), la couleur des jauges de calories selon le mode d'objectif, l'export et l'import JSON et le recalcul des totaux.

**Architecture:** Le module `settings` devient le propriétaire du profil complet (`users/{uid}`) : domaine pur (profil, validation, formule Mifflin-St Jeor, propositions d'objectifs, garde-fous), port `ProfileRepository` (observer / fusionner) avec adaptateurs Firestore et en mémoire, hook `useProfile` qui rend le profil enregistré fusionné sur `DEFAULT_PROFILE`. Deux nouveaux modules : `body` (poids et tour de taille par jour, moyenne glissante sur 7 jours, paliers du corps) et `tobacco` (envies, jours sans fumer, record, économies). Un module `data` porte l'export, l'import et le recalcul. Le Suivi gagne une rubrique Tabac et ses métriques ; il lit les objectifs en paramètre au lieu de les figer à la composition.

**Tech Stack:** Expo Router (routes `settings/*`, `setup`), React Native Paper, Firestore (RN Firebase), `expo-file-system` + `expo-sharing` (export) et `expo-document-picker` (import) — modules natifs : reconstruire le client de développement.

## Global Constraints

- Français dans l'interface, code et commentaires en anglais. Métrique (kg, cm, L, kcal), dates et nombres au format français.
- Spec §4 profil `users/{uid}` = `timezone`, `sex` (`male`|`female`), `birthYear`, `heightCm`, `activityLevel` (`sedentary`|`light`|`active`), `goals` (`kcal`, `proteinG`, `waterMl`, `steps`), `quitDate` (optionnel), `cigarettesPerDay` (optionnel), `packSize` (défaut 20), `packPrice` (optionnel), `ui`, `waterContainers` (liste de `{ label, ml }`), `createdAt`. **Extension de M6 : `goalMode` (`deficit`|`maintenance`|`surplus`)**, et `weeklyLossKg` (optionnel, perte visée par semaine).
- Spec §4 `days/{date}` : `weightKg` et `waistCm` sont écrits par le module corps (un champ par jour, saisis à la main, par fusion) ; `cravings/{id}` = `day`, `createdAt`, `resisted` (booléen).
- Spec §9 objectifs proposés : dépense = Mifflin-St Jeor × facteur d'activité (sédentaire 1,2, légèrement actif 1,375, actif 1,55) ; calories proposées = dépense − 400 ; protéines 1,7 g/kg arrondi à 5 g ; eau 2,5 L ; pas 8 000 ; l'utilisateur peut saisir ses valeurs.
- Spec §9 garde-fous (constantes du domaine, non modifiables depuis l'interface) : plancher de calories proposées 1 500 kcal/jour ; plafond de perte proposée 1 % du poids de corps par semaine ; perte visée par défaut 0,3 à 0,5 kg par semaine. Rappel de consulter un professionnel avant de changer de régime ou de reprendre une activité intense.
- Décision de l'utilisateur : la jauge Calories a pour but l'objectif choisi (déficit, maintien ou surplus, à partir du profil) et **ses couleurs suivent le mode**. Déficit : on ne manque pas le rythme en mangeant moins, seul le dépassement compte (orange au-dessus de 105 %, rouge au-dessus de 110 %). Maintien : la règle actuelle (rythme, puis dépassement). Surplus : le rythme seul, sans pénalité de dépassement. Les graphiques du Suivi suivent le même mode.
- Spec §9 jours sans tabac depuis `quitDate` ; économies = jours sans fumer × `cigarettesPerDay` × `packPrice` / `packSize` quand ils sont renseignés ; spec §6 Tabac : jours sans fumer, record, argent économisé, journal et graphique des envies.
- Spec §9 paliers : atteints à l'enregistrement de la séance **ou de la mesure** ; `achievedAt` posé une fois ; écritures par `writeBatch`, jamais attendues en série (`run(write)`).
- Spec §8 export JSON partagé vers Drive ou Fichiers, import de restauration validé par schéma, « Recalculer les totaux » reconstruit `days/{date}` à partir des entrées.
- Cibles tactiles 48 dp, libellés d'accessibilité en français qui commencent par le texte visible, messages d'état avec `accessibilityLiveRegion="polite"`, couleurs et polices uniquement par le thème ; un module n'importe pas les internes d'un autre ; `domain/` est du TypeScript pur.
- Avant de conclure : `npm run lint`, `npm run typecheck`, `npm test`, `npm run lint:deps`, `npm run test:emulator`. Ajout de paquet : `npx expo install`, après lecture de la doc Expo SDK 58 du module.

## Décisions de M6

1. **Fuseau horaire en lecture seule.** Les cas d'usage fixent le fuseau à la composition ; le rendre modifiable demande de composer après la lecture du profil. `shortcut:` noté dans l'écran (« Europe/Paris »), à lever si l'on voyage.
2. **Pas de suppression du compte ni de verrouillage biométrique** : les règles interdisent déjà de supprimer des séances et des verres (suppressions douces), et la biométrie ajoute un module natif de plus. Hors de M6, signalé dans le rapport.
3. **Profil vivant.** `useProfile(settings)` rend le profil enregistré sur les valeurs par défaut ; les routes le passent aux écrans, qui prennent déjà `profile` en propriété. `app.profile` reste le profil par défaut, utilisé seulement pour le fuseau à la composition.
4. **Les objectifs vont en paramètre du Suivi** (`observeMetric(def, goals, …)`) au lieu d'être figés dans `trackingUseCases` : changer un objectif change les couleurs au prochain instantané.
5. **Première configuration** : écran `setup` proposé tant que le profil n'a pas de `createdAt` ; « Passer » le pose avec les valeurs par défaut. Le poids saisi devient la première mesure du jour.
6. **Paliers du corps** : métriques `weightKg` et `waistCm`, sens `up` ou `down` au choix dans le formulaire (le sens manquait en M3).
7. **Tabac** : une rechute (`resisted: false`) remet la série courante à zéro ; le record est la plus longue série entre `quitDate`, les rechutes et aujourd'hui ; les économies comptent les jours sans fumer (jours depuis `quitDate` moins les jours de rechute).
8. **Import dans un compte** : les documents sont écrits par identifiant et par lots de 400 ; les règles tranchent (un document supprimé en douceur n'est pas recréé) ; les documents déjà présents et immuables (verres, séances) font échouer leur lot, avec le message. Pensé pour restaurer un compte vide ; `shortcut:` noté.

---

### Task 1: Domaine — profil, objectifs proposés, garde-fous, modes de calories

**Files:**
- Create: `src/modules/settings/domain/goals.ts`, `goals.test.ts`
- Modify: `src/modules/settings/domain/profile.ts` (+ `profile.test.ts`), `src/modules/today/domain/gauge.ts` (+ test), `src/modules/tracking/domain/metric.ts`, `series.ts` (+ tests)

**Interfaces:**
- Produces: `type Sex`, `ActivityLevel`, `GoalMode = 'deficit' | 'maintenance' | 'surplus'`; `type Profile` (champs de la spec + `goalMode`, `weeklyLossKg?`, `createdAt?`) ; `DEFAULT_PROFILE` ; `validateProfile(profile): string | null` (bornes : taille 100–250, naissance 1900–année en cours, kcal 800–10 000, protéines 0–500, eau 500–10 000, pas 0–100 000, `packSize` 1–100, `packPrice` 0–100, `cigarettesPerDay` 0–200, contenants 1–6 avec `ml` 1–5 000, libellé 1–30) ; `GUARDRAILS = { minKcal: 1500, maxWeeklyLossPct: 1, defaultWeeklyLossKg: 0.4, deficitKcal: 400, surplusKcal: 250 }` ; `bmr(sex, weightKg, heightCm, age)`, `dailyEnergy(profile, weightKg, year)`, `proposeGoals({ profile, weightKg, year }): { goals: Goals; notes: string[] }` — notes en français quand un garde-fou borne la proposition (« Plancher de 1 500 kcal appliqué », « Perte limitée à 1 % du poids par semaine ») et le rappel de consulter un professionnel.
- Les couleurs de calories : `calorieColor(kcal, goal, hour, mode)` et `toneOf(def, goals, value)` prennent le mode (`Goals.kcalMode`) ; sans mode, `maintenance`.

- [ ] **Step 1: Tests** — Mifflin-St Jeor (homme 80 kg, 180 cm, 30 ans = 1 780 ; femme = −161 au lieu de +5) ; proposition en déficit (−400), maintien (= dépense), surplus (+250) ; plancher 1 500 (note) ; perte demandée 1,2 kg/semaine pour 80 kg bornée à 0,8 (note) ; protéines 1,7 × poids arrondi à 5 ; `validateProfile` (une borne par ligne de `test.each`) ; `calorieColor` : déficit vert à 40 % du rythme, orange à 106 %, rouge à 111 % ; maintien inchangé (tests existants) ; surplus rouge à 50 % du rythme, vert à 120 % ; `toneOf` calories par mode (déficit : bon de 0,8 à 1,05, à surveiller de 0,5 à 0,8 ou 1,05 à 1,10 ; surplus : bon à partir de 0,95).
- [ ] **Step 2–5:** Rouge, implémenter, vert, commit `feat: profile, goals proposals, guard-rails and calorie modes (M6)`.

### Task 2: Profil vivant — port, règles, adaptateurs, hook, composition

**Files:**
- Modify: `src/modules/settings/application/ports.ts` (+ `observeProfile`, `saveProfile`), `settingsUseCases.ts`, `adapters/firestoreProfileRepository.ts`, `adapters/inMemoryProfileRepository.ts`, `index.ts`, `firebase/firestore.rules` (+ test), `src/composition.ts`, `src/navigation.test.tsx`, `src/modules/tracking/application/trackingUseCases.ts` (+ tests, `SuiviHub`, `SectionScreen`), `app/(app)/(tabs)/*`
- Create: `src/modules/settings/ui/useProfile.ts` (+ test)

**Interfaces:**
- Produces: `ProfileRepository.observeProfile(onNext: (stored: Partial<Profile>) => void, onError)`, `saveProfile(patch: Partial<Profile>): Promise<void>` (fusion) ; `settings.saveProfile(patch)` valide le profil fusionné puis écrit ; `useProfile(settings): Profile` (valeurs enregistrées sur `DEFAULT_PROFILE`, `goals` fusionnés champ par champ) ; `trackingUseCases` n'a plus `goals` ; `observeMetric(def, goals, period, anchor, onNext, onError)` ; `SuiviHub` et `SectionScreen` prennent `goals`.
- Règle `users/{uid}` : clés permises = celles de la spec + `goalMode` + `weeklyLossKg` ; types et bornes de chaque champ ; `waterContainers` liste de 1 à 6 ; `ui` inchangé.

- [ ] **Step 1: Tests** — fusion du profil enregistré sur les défauts (objectifs champ par champ) ; `saveProfile` refuse une valeur hors borne avec son message ; règles : le propriétaire écrit chaque champ valide, une valeur hors borne est refusée, un champ inconnu aussi, `sex: 'x'` refusé, un autre utilisateur non ; émulateur : fusion de deux écritures, un second téléphone voit le profil ; le Suivi recalcule avec d'autres objectifs.
- [ ] **Step 2–5:** Rouge, implémenter, vert (unitaires + émulateur), commit `feat: the whole profile in users/{uid} (M6)`.

### Task 3: Réglages — liste, objectifs, profil, eau

**Files:**
- Create: `app/(app)/settings/_layout.tsx`, `index.tsx`, `goals.tsx`, `profile.tsx`, `water.tsx`, `src/modules/settings/ui/SettingsScreen.tsx`, `GoalsScreen.tsx`, `ProfileScreen.tsx`, `WaterContainersScreen.tsx` et leurs tests
- Modify: `src/HeaderSync.tsx` (icône d'engrenage « Réglages » à droite du nuage), `app/(app)/_layout.tsx` (pile `settings`), `src/navigation.test.tsx`

**Interfaces:**
- Produces: `SettingsScreen({ profile, onOpen(page) })` (liste : Objectifs, Profil, Eau, Tabac, Données ; une ligne de fuseau en lecture seule) ; `GoalsScreen({ profile, weightKg?, year, onSave(patch) })` — mode (3 segments), quatre champs, bouton « Proposer à partir de mon profil » qui remplit les champs et affiche les notes des garde-fous, avertissement non bloquant sous 1 500 kcal ; `ProfileScreen` (sexe, année de naissance, taille, activité) ; `WaterContainersScreen` (liste modifiable, 1 à 6).

- [ ] **Step 1: Tests** — les champs reflètent le profil ; « Proposer » remplit selon le mode et montre les notes ; une valeur invalide désactive « Enregistrer » avec le message ; l'enregistrement appelle `onSave` avec le patch ; l'engrenage ouvre Réglages ; contenants : ajouter, renommer, supprimer, 6 au plus.
- [ ] **Step 2–5:** Rouge, implémenter, vert, commit `feat: settings screens for goals, profile and water (M6)`.

### Task 4: Première configuration

**Files:**
- Create: `app/(app)/setup.tsx`, `src/modules/settings/ui/SetupScreen.tsx` (+ test)
- Modify: `app/(app)/_layout.tsx` (redirection tant que `createdAt` manque), `src/navigation.test.tsx`

**Interfaces:**
- Produces: `SetupScreen({ profile, onDone(patch, weightKg?) })` — poids, taille, naissance, sexe, activité, mode ; objectifs proposés montrés avec leurs notes, modifiables ; « Terminer » pose `createdAt` ; « Passer » le pose avec les valeurs par défaut.

- [ ] **Step 1: Tests** — l'écran propose les objectifs du profil saisi ; le mode change la proposition ; « Terminer » enregistre profil, objectifs et poids du jour ; « Passer » ne change que `createdAt` ; une fois fait, l'application ouvre Aujourd'hui.
- [ ] **Step 2–5:** Rouge, implémenter, vert, commit `feat: first-run setup (M6)`.

### Task 5: Corps — poids, tour de taille, moyenne sur 7 jours, paliers du corps

**Files:**
- Create: `src/modules/body/{domain,application,adapters,ui}/…`, `index.ts`
- Modify: `firebase/firestore.rules` (clés `weightKg`, `waistCm` de `days`, bornes 20–400 et 30–300) + test, `src/modules/training/domain/milestone.ts` (+ `weightKg`, `waistCm`), `MilestoneForm.tsx` (choix du corps et du sens), `src/modules/today/ui/TodayScreen.tsx` (carte Poids), `src/composition.ts`, routes, `src/navigation.test.tsx`

**Interfaces:**
- Produces: `rollingMean(values: (number | undefined)[]): number | undefined` (7 derniers jours avec valeur) ; `interface BodyRepository { observeRecent(to: string, onNext: (days: Map<string, BodyDay>) => void, onError): () => void; save(day: string, measure: { weightKg?: number; waistCm?: number }, reachedMilestoneIds?: string[]): Promise<void> }` — `save` fusionne dans `days/{day}` et pose `achievedAt` des paliers atteints dans le même lot ; `bodyUseCases` : `save` valide, détecte les paliers atteints (`isReached` sur la mesure), `observeRecent` ; `BodyCard({ today, average, onSave, onOpen })` sur Aujourd'hui (valeur du jour, moyenne sur 7 jours, saisie en un tap : un champ numérique et « Enregistrer ») ; extras de la rubrique Corps : saisie du poids et du tour de taille du jour.

- [ ] **Step 1: Tests** — moyenne glissante (jours sans valeur ignorés, rien → `undefined`) ; `save` fusionne sans toucher aux totaux du jour ; un palier « tour de taille sous 90 cm » est posé par la mesure qui le franchit, une seule fois ; règles : bornes et champs ; émulateur : lot atomique (mesure + palier) ; la carte montre la valeur et la moyenne, la saisie appelle `onSave` ; le formulaire de palier propose le sens.
- [ ] **Step 2–5:** Rouge, implémenter, vert, commit `feat: weight, waist and body milestones (M6)`.

### Task 6: Jauges et graphiques de calories selon le mode

**Files:**
- Modify: `src/modules/today/ui/TodayScreen.tsx` (+ test), `app/(app)/(tabs)/index.tsx`, `src/modules/tracking/ui/*` (le mode passe par `goals`)

- [ ] **Step 1: Tests** — la jauge Calories d'un profil en déficit reste verte à 40 % du rythme et passe orange au-dessus de 105 % ; en surplus elle devient rouge en retard ; le libellé parlé dit le mode (« objectif de déficit ») ; un graphique de calories colore ses jours selon le mode.
- [ ] **Step 2–5:** Rouge, brancher `goals.kcalMode` jusqu'aux fonctions de couleur, vert, commit `feat: calorie colours follow the goal mode (M6)`.

### Task 7: Tabac — envies, série, record, économies

**Files:**
- Create: `src/modules/tobacco/{domain,application,adapters,ui}/…`, `index.ts`, `app/(app)/settings/tobacco.tsx`
- Modify: `firebase/firestore.rules` (collection `cravings`) + test, `src/modules/tracking/domain/{metric,metrics,period}.ts` (rubrique `tabac`, `DayFacts.cravings` et `smoked`, métriques « Envies » et « Cigarettes fumées »), `TodayScreen.tsx` (carte Sans tabac), `src/composition.ts`, routes, `src/navigation.test.tsx`

**Interfaces:**
- Produces: `streaks(quitDate, relapseDays, today): { current: number; record: number; smokeFreeDays: number }` ; `savings(smokeFreeDays, profile): number | undefined` ; `interface CravingRepository { add(craving): { id; saved }; observeBetween(from, to, onNext, onError) }` ; `tobaccoUseCases` : `logCraving(resisted)`, `observeStreak(onNext)` ; `FactsSource` des envies (compte par jour) pour le Suivi ; extras de la rubrique : trois chiffres (jours, record, économies), boutons « Envie résistée » et « J'ai fumé » (avec « Annuler »), historique des envies du jour ; réglages Tabac : date d'arrêt, cigarettes par jour, taille et prix du paquet.

- [ ] **Step 1: Tests** — séries : sans rechute `current = record = jours depuis quitDate` ; une rechute remet `current` à zéro et garde le record ; deux rechutes le même jour comptent une ; `quitDate` future → 0 ; économies avec et sans prix ; règles et émulateur de `cravings` (création seule, bornes, champs) ; la carte Sans tabac et la rubrique montrent les bons chiffres ; la saisie d'une envie passe par `run`.
- [ ] **Step 2–5:** Rouge, implémenter, vert, commit `feat: tobacco tracking (M6)`.

### Task 8: Données — export, import, recalcul des totaux

**Files:**
- Create: `src/modules/data/{domain,application,adapters,ui}/…`, `index.ts`, `app/(app)/settings/data.tsx`
- Modify: `package.json` (via `npx expo install expo-file-system expo-sharing expo-document-picker`), `firebase/firestore.rules` si l'import l'exige, `src/composition.ts`

**Interfaces:**
- Produces: `exportDocument(collections, profile, now): BackupFile` et `parseBackup(text): { ok: true; backup } | { ok: false; error }` (version 1, schéma vérifié à la main : collections connues, `id` texte, horodatages ISO) ; `interface BackupStore { readAll(): Promise<RawCollections>; writeAll(collections, onProgress): Promise<void> }` ; `recomputeTotals(entries): Map<day, Totals>` (domaine pur : somme des entrées non supprimées par jour, jours sans entrée remis à zéro) ; `dataUseCases` : `exportBackup()`, `importBackup(text)`, `recomputeTotals()` ; écran Données : Exporter (partage du fichier), Importer (sélecteur de fichier, confirmation, résumé), Recalculer les totaux (confirmation, « n jours corrigés »).

- [ ] **Step 1: Tests** — aller-retour : l'export d'une base d'essai se réimporte à l'identique (horodatages, listes imbriquées) ; `parseBackup` refuse un fichier d'une autre version, une collection inconnue, un horodatage invalide, du texte qui n'est pas du JSON ; les documents supprimés en douceur ne sont pas réécrits ; lots de 400 ; recalcul : un total qui dérive est corrigé, un jour sans entrée repasse à zéro, les autres champs du jour (poids) sont intacts ; émulateur : export puis import dans un compte vide restitue les totaux.
- [ ] **Step 2–5:** Rouge, implémenter, vert, commit `feat: JSON export, import and totals recalculation (M6)`.

### Task 9: Documentation, vérifications, revue, fusion

- [ ] README : état, section « À vérifier sur le téléphone avant M7 » (déployer règles et index, reconstruire le client : `react-native-svg`, `expo-file-system`, `expo-sharing`, `expo-document-picker`), puces de vérification des réglages, du poids, du tabac, de l'export ; `DESIGN.md` et `.impeccable/design.json` (carte Poids, carte Sans tabac, engrenage, écrans de réglages) ; spec : note sur `goalMode` et `weeklyLossKg`.
- [ ] `npm run lint && npm run typecheck && npm test && npm run lint:deps && npm run test:emulator`.
- [ ] Revue indépendante (sous-agent Sonnet, paquet `review-package`), corrections Critical/Important, relance des contrôles.
- [ ] Fusion `--ff-only` dans `main`, poussée, vérification de la CI.

## Limites connues de M6 (à noter dans le code par `shortcut:`)

- Fuseau horaire en lecture seule ; pas de suppression du compte ; pas de verrouillage biométrique ; pas de rappel mensuel d'export.
- L'import restaure un compte vide : les documents immuables déjà présents font échouer leur lot.
- La rubrique Tabac ne retient pas l'heure d'une envie au-delà de `createdAt`.
