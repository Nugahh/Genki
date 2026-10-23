# M0–M1 — Socle et hydratation : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une app Android (build de développement Expo) où l'on se connecte avec Google et où l'on suit son eau du jour sur deux téléphones, hors-ligne compris (jalons M0 et M1 de la spec).

**Architecture:** Hexagonale par module (`src/modules/<module>/{domain,application,adapters,ui}`), assemblée à la main dans `src/composition.ts`. L'app parle directement à Firestore (React Native Firebase, API modulaire) avec la persistance locale ; chaque ajout ou retrait d'eau écrit l'entrée et `days/{date}.waterMl` (par `increment()`) dans le même `writeBatch`. Les adaptateurs Firestore sont testés sur l'émulateur avec le SDK web, dont l'API modulaire est identique (alias Jest).

**Tech Stack:** Expo SDK 58 (React Native 0.88, React 19.3, TypeScript 6), expo-router 58, React Native Paper 5 (Material 3), React Native Firebase 27 (app, auth, firestore), @react-native-google-signin/google-signin 16, Jest 30 + jest-expo 58 + @testing-library/react-native 14, @firebase/rules-unit-testing 6 + firebase 13.0.0 + firebase-tools 15, dependency-cruiser 18, GitHub Actions.

Spec : `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md`.

## Global Constraints

Exigences de la spec (texte d'origine) :
- Interface en français, unités métriques (kg, cm, L, kcal), dates au format français.
- Développeur unique, coût d'exploitation nul (formule gratuite Spark de Firebase) ; aucune fonction serveur ; « Il n'y a pas de backend ni d'API REST ».
- Données de santé : confidentialité par défaut, région européenne. « La base est fermée par défaut. Seul le propriétaire accède à `users/{uid}/**`. Les règles valident les types, les bornes (par exemple `grams` entre 0 et 5 000) et la liste des champs autorisés. »
- « Tout est rangé sous `users/{uid}`. Les identifiants sont des UUID générés par l'application pour pouvoir créer des données hors-ligne sans collision. » (Le plan prend les identifiants automatiques Firestore, voir « Décisions de périmètre ».)
- « `domain/` : TypeScript pur, sans Firebase ni React. » « Un module n'importe jamais les internes d'un autre. Il passe par son interface publique […]. `dependency-cruiser` fait respecter cette règle dans la CI. »
- « Pas de conteneur d'injection de dépendances : `composition.ts` branche tout à la main. »
- « Les dépôts exposent une méthode `observe` » ; « Toutes les écritures multi-documents sont des lots (`writeBatch`), jamais des transactions. »
- « Le champ `day` est calculé à la création avec le fuseau du profil, jamais avec celui du téléphone. »
- « Suppressions douces : supprimer une entrée pose `deletedAt` et décrémente les totaux dans le même lot. Les requêtes ignorent les entrées supprimées. »
- « Les zones touchables font au moins 48 dp, avec un effet d'appui et un libellé d'accessibilité. » « Un chevron signale « ouvre », un plus signale « ajoute ». »
- « Une écriture refusée par les règles affiche un message avec « Réessayer » et conserve la saisie. »
- Jauges : « Journée active de 7 h à 23 h. Progression attendue à l'heure `h` : `attendu = clamp((h − 7) / 16, 0, 1)`. `rythme = progression réelle / attendu`. Avant 7 h, la couleur est verte. Vert si `rythme ≥ 0,9`, orange si `0,6 ≤ rythme < 0,9`, rouge si `rythme < 0,6`. Le trait de la barre marque `attendu`. »
- « Une icône nuage indique l'état de synchro : à jour, en attente (écritures non envoyées), hors-ligne ou erreur. L'état se déduit des métadonnées des snapshots (`hasPendingWrites`, `fromCache`). »
- Profil : `timezone` (défaut `Europe/Paris`), eau 2,5 L par défaut, `waterContainers` (liste de `{ label, ml }`, défaut 250 et 500).
- Consigne de l'utilisateur (ponytail) : le plus petit changement complet ; aucun code « pour plus tard ».

Contraintes d'outillage (établies pendant la tâche 1, vérifiées) :
- Ajouter un paquet Expo avec `npx expo install`. `firebase` (SDK web, tests seulement) reste figé à **13.0.0**, la version exacte embarquée par React Native Firebase 27 : sinon les paquets compat se dédoublent et `@firebase/rules-unit-testing` casse (`this.getApp(...).firestore is not a function`).
- TypeScript 6 n'inclut plus les `@types` d'office : `tsconfig.json` liste `"types": ["jest", "node"]`.
- RNTL 14 : `render`, `fireEvent.*` et `renderRouter` sont asynchrones, toujours les `await`.
- `jest.setup.js` fait passer les polices d'icônes pour chargées (incompatibilité jest-expo / RN 0.88 sur le registre d'assets) : ne pas le retirer.
- Tests d'émulateur : fichiers `*.emulator.test.ts`, lancés par `npm run test:emulator`, exclus de `npm test`. Port Firestore de l'émulateur : **8088** (8080 est pris par Docker sur la machine de dev).
- Rien dans `app/` qui ne soit une route : un test placé dans `app/` deviendrait un écran.
- Imports : `@/…` (= `src/…`) d'un dossier à l'autre, chemins relatifs à l'intérieur d'un module. Les adaptateurs Firestore n'importent à l'exécution que `@react-native-firebase/firestore` (aliasé vers `firebase/firestore` dans les tests d'émulateur).
- Commits : messages conventionnels, terminés par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Décisions de périmètre (M0–M1)

- **Identifiants** : identifiants automatiques Firestore (`doc(collection(…))`), tirés au hasard sur le téléphone, hors-ligne et sans collision, soit la garantie que la spec demande aux UUID, sans dépendance de plus.
- **Profil** : rien n'écrit `users/{uid}` avant M6 (réglages). M1 lit donc `DEFAULT_PROFILE` (constantes du module settings), et les règles gardent le document profil fermé en écriture.
- **Écran Aujourd'hui** : seule la jauge Eau existe en M1. Les jauges Calories, Protéines et Pas arrivent avec leurs données (M2, M5), et la règle « calories au-delà de 105 % » avec la jauge Calories.
- **Événements** : pas de bus (`WaterAdded`…) en M1. L'écran observe Firestore directement, et le bus arrivera avec son premier abonné (paliers, M3).
- Pas de déconnexion ni d'écran Réglages (M6). Pas de `expo-material3-theme`, Reanimated, Skia ni Victory (aucun usage en M1).
- Ce que seul l'utilisateur peut faire (projets Firebase, SHA-1, fichiers `google-services`) est décrit dans le `README.md` (tâche 7).

## File Structure

```
app.config.ts                                   variantes dev/prod, ID client Web Google        (T1 ✅)
.dependency-cruiser.cjs                         règles d'étanchéité des modules                 (T1 ✅)
jest.setup.js                                   polices d'icônes en test                        (T1 ✅)
src/shared/clock.ts                             Clock, dayKey, hourOfDay                        (T1 ✅)
firebase.json                                   règles + émulateur (port 8088)                  (T2)
firebase/firestore.rules                        règles M1                                       (T2)
firebase/firestore.rules.emulator.test.ts                                                       (T2)
jest.emulator.config.js                                                                         (T2)
.github/workflows/ci.yml                                                                        (T2)
src/modules/today/domain/gauge.ts               expectedProgress, paceColor                     (T3)
src/modules/today/domain/sync.ts                SyncMeta, syncStatus                            (T3)
src/modules/settings/domain/profile.ts          Profile, DEFAULT_PROFILE                        (T4)
src/modules/settings/index.ts                                                                   (T4)
src/modules/hydration/application/ports.ts      WaterEntry, WaterRepository                     (T4)
src/modules/hydration/application/waterUseCases.ts   addWater, removeWater, observeDay          (T4)
src/modules/hydration/adapters/inMemoryWaterRepository.ts                                       (T4)
src/modules/hydration/index.ts                                                                  (T4, T6)
src/modules/hydration/adapters/firestoreWaterRepository.ts                                      (T5)
src/modules/today/application/ports.ts          DayTotals, DayTotalsRepository                  (T5)
src/modules/today/adapters/firestoreDayTotals.ts                                                (T5)
src/shared/useNow.ts                            heure courante, rafraîchie chaque minute        (T6)
src/modules/today/ui/GaugeBar.tsx, SyncIcon.tsx, TodayScreen.tsx                                (T6)
src/modules/hydration/ui/WaterButtons.tsx, WaterSheet.tsx                                       (T6)
src/modules/today/index.ts                                                                      (T6)
src/platform/firebase.ts                        Firestore (cache illimité), Google, useAuthUser (T7)
src/composition.ts                              compose(uid)                                    (T7)
src/appContext.tsx                              AppProvider, useApp, « Réessayer »              (T7)
app/_layout.tsx, app/sign-in.tsx, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx                  (T7)
src/navigation.test.tsx                                                                         (T7)
README.md                                                                                       (T7)
```

---

### Task 1: Socle, outillage et horloge du profil (M0) — ✅ fait par le contrôleur, commit `18d5643`

Déjà livré (à relire avec le reste) : app Expo SDK 58 (template `blank-typescript`), dépendances (`expo-router`, `expo-dev-client`, `react-native-paper`, `@expo/vector-icons`, `expo-font`, `expo-asset`, React Native Firebase 27, Google Sign-In ; en dev : jest-expo, RNTL 14, ESLint 9, dependency-cruiser, firebase 13.0.0, rules-unit-testing, firebase-tools), `package.json` (`main: expo-router/entry`, scripts `android`, `lint`, `typecheck`, `test`, `lint:deps`, config Jest), `tsconfig.json`, `app.config.ts` (variantes `com.nugah.genki.dev` / `com.nugah.genki`, fichier `google-services.dev.json` / `google-services.json`, `extra.googleWebClientId` lu dans le fichier), `google-services.example.json`, `.gitignore`, `.dependency-cruiser.cjs` (règles `module-internals`, `pure-domain`, `no-circular`, vérifiées sur une violation volontaire), `jest.setup.js`, `src/shared/clock.ts` + tests (`dayKey`, `hourOfDay`, changements d'heure de mars et d'octobre 2026).

Interfaces produites :
- `src/shared/clock.ts` : `interface Clock { now(): Date }`, `const systemClock: Clock`, `dayKey(date: Date, timeZone: string): string` (`YYYY-MM-DD`), `hourOfDay(date: Date, timeZone: string): number` (14:30 → 14.5).
- Scripts : `npm run lint`, `npm run typecheck`, `npm test`, `npm run lint:deps`.

Vérification : `npm run lint && npm run typecheck && npm test && npm run lint:deps && npx expo-doctor` → tout passe (7 tests, 20/20 checks).

---

### Task 2: Règles Firestore, harnais d'émulateur et CI (M0)

**Files:**
- Create: `firebase.json`
- Create: `firebase/firestore.rules`
- Create: `jest.emulator.config.js`
- Create: `firebase/firestore.rules.emulator.test.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (script `test:emulator`)

**Interfaces:**
- Consumes: rien.
- Produces: `npm run test:emulator` (lance l'émulateur Firestore sur 8088 puis Jest avec `jest.emulator.config.js`, qui prend tous les `*.emulator.test.ts` et aliase `@react-native-firebase/firestore` → `firebase/firestore`). Règles M1 : lecture propriétaire partout sous `users/{uid}`, écriture seulement sur `waterEntries` et `days`.

- [ ] **Step 1: Écrire la config Firebase et le harnais de test**

`firebase.json` :

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules"
  },
  "emulators": {
    "firestore": {
      "port": 8088
    },
    "ui": {
      "enabled": false
    },
    "singleProjectMode": true
  }
}
```

`jest.emulator.config.js` :

```js
// Firestore rules and adapter tests against the emulator: `npm run test:emulator`.
const { transform } = require('jest-expo/node/jest-preset');

module.exports = {
  testEnvironment: 'node',
  // jest-expo only compiles TypeScript here; modules resolve as in plain Node.
  transform,
  testMatch: ['<rootDir>/**/*.emulator.test.ts'],
  moduleNameMapper: {
    // React Native Firebase's modular API mirrors the web SDK: adapters run on it against the emulator.
    '^@react-native-firebase/firestore$': 'firebase/firestore',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
};
```

Dans `package.json`, ajouter à `scripts` (après `lint:deps`) :

```json
    "test:emulator": "firebase emulators:exec --only firestore --project demo-genki \"jest -c jest.emulator.config.js\""
```

Écrire `firebase/firestore.rules` avec tout fermé, pour voir les tests échouer :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Écrire les tests de règles**

`firebase/firestore.rules.emulator.test.ts` :

```ts
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, increment, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-genki',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});
afterEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

// rules-unit-testing hands out compat instances; the modular functions accept them.
const db = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

const seed = (path: string, data: object) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore() as unknown as Firestore, path), data));

const entry = () => ({ day: '2026-10-23', ml: 250, createdAt: Timestamp.now(), deletedAt: null });

describe('ownership', () => {
  test('the owner reads and writes their own data', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), entry()));
    await assertSucceeds(getDoc(doc(db('alice'), 'users/alice/waterEntries/e1')));
  });

  test('another user or a signed-out client gets nothing', async () => {
    await seed('users/alice/waterEntries/e1', entry());
    await assertFails(getDoc(doc(db('bob'), 'users/alice/waterEntries/e1')));
    await assertFails(getDoc(doc(db(), 'users/alice/waterEntries/e1')));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/waterEntries/e2'), entry()));
  });

  test('documents without validation yet stay closed to writes', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice'), { timezone: 'Europe/Paris' }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foods/f1'), { name: 'Riz' }));
  });
});

describe('waterEntries', () => {
  test.each<[string, object]>([
    ['ml is zero', { ml: 0 }],
    ['ml is above 5 000', { ml: 5001 }],
    ['ml is a string', { ml: '250' }],
    ['day is not YYYY-MM-DD', { day: '23/10/2026' }],
    ['createdAt is not a timestamp', { createdAt: 'now' }],
    ['deletedAt is already set', { deletedAt: Timestamp.now() }],
    ['an unknown field is present', { note: 'hi' }],
  ])('rejects an entry when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), { ...entry(), ...override }));
  });

  test('rejects an entry with a missing field', async () => {
    await assertFails(
      setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), { day: '2026-10-23', ml: 250, deletedAt: null }),
    );
  });

  test('an entry is soft-deleted once, and nothing else about it changes', async () => {
    await seed('users/alice/waterEntries/e1', entry());
    const ref = doc(db('alice'), 'users/alice/waterEntries/e1');
    await assertFails(updateDoc(ref, { ml: 500 }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    // A second delete would take the glass off the day total twice.
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.now() }));
  });
});

describe('days', () => {
  test('accepts a water total moved by increment()', async () => {
    await assertSucceeds(
      setDoc(
        doc(db('alice'), 'users/alice/days/2026-10-23'),
        { waterMl: increment(250), updatedAt: Timestamp.now() },
        { merge: true },
      ),
    );
  });

  test.each<[string, object]>([
    ['the water total goes negative', { waterMl: -1, updatedAt: Timestamp.now() }],
    ['an unknown field is present', { waterMl: 250, updatedAt: Timestamp.now(), foo: 1 }],
    ['updatedAt is missing', { waterMl: 250 }],
  ])('rejects a day when %s', async (_, data) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-23'), data));
  });

  test('rejects a day id that is not a date', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/today'), { waterMl: 250, updatedAt: Timestamp.now() }));
  });
});
```

- [ ] **Step 3: Lancer les tests et vérifier qu'ils échouent**

Run: `npm run test:emulator`
Expected: FAIL. Les tests `assertSucceeds` échouent (tout est fermé) ; les `assertFails` passent.

- [ ] **Step 4: Écrire les règles M1**

Remplacer `firebase/firestore.rules` par :

```
rules_version = '2';

// Closed by default: only the owner reaches users/{uid}/**, and a collection
// accepts writes only once its milestone validates them here (spec §8).
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    function isDayKey(value) {
      return value is string && value.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
    }

    match /users/{uid}/{document=**} {
      allow read: if isOwner(uid);
    }

    match /users/{uid}/waterEntries/{entryId} {
      allow create: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['day', 'ml', 'createdAt', 'deletedAt'])
        && isDayKey(request.resource.data.day)
        && request.resource.data.ml is number
        && request.resource.data.ml > 0
        && request.resource.data.ml <= 5000
        && request.resource.data.createdAt is timestamp
        && request.resource.data.deletedAt == null;
      // Soft delete only, and only once: the batch moving the day total fails with it.
      allow update: if isOwner(uid)
        && resource.data.deletedAt == null
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedAt'])
        && request.resource.data.deletedAt is timestamp;
    }

    match /users/{uid}/days/{day} {
      allow create, update: if isOwner(uid)
        && isDayKey(day)
        && request.resource.data.keys().hasOnly(['waterMl', 'updatedAt'])
        && request.resource.data.waterMl is number
        && request.resource.data.waterMl >= 0
        && request.resource.data.updatedAt is timestamp;
    }
  }
}
```

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

Run: `npm run test:emulator`
Expected: PASS, 17 tests (1 suite).

- [ ] **Step 6: Écrire la CI**

`.github/workflows/ci.yml` :

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      # The Firestore emulator runs on Java.
      - uses: actions/setup-java@v6
        with:
          distribution: temurin
          java-version: 21
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run lint:deps
      - run: npm run test:emulator
```

- [ ] **Step 7: Vérifier l'ensemble**

Run: `npm run lint && npm run typecheck && npm test && npm run lint:deps && npm run test:emulator`
Expected: tout passe.

- [ ] **Step 8: Commit**

```bash
git add firebase.json firebase/ jest.emulator.config.js .github/ package.json
git commit -m "feat: closed-by-default Firestore rules with emulator tests and CI (M0)"
```

---

### Task 3: Règles du domaine : couleur des jauges et état de synchro (M1)

**Files:**
- Create: `src/modules/today/domain/gauge.ts`
- Test: `src/modules/today/domain/gauge.test.ts`
- Create: `src/modules/today/domain/sync.ts`
- Test: `src/modules/today/domain/sync.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `type GaugeColor = 'green' | 'orange' | 'red'`
  - `expectedProgress(hour: number): number` (0 à 1)
  - `paceColor(value: number, goal: number, hour: number): GaugeColor`
  - `type SyncMeta = { hasPendingWrites: boolean; fromCache: boolean }`
  - `type SyncStatus = 'synced' | 'pending' | 'offline' | 'error'`
  - `syncStatus(meta: SyncMeta, failed: boolean): SyncStatus`

- [ ] **Step 1: Écrire les tests qui échouent**

`src/modules/today/domain/gauge.test.ts` :

```ts
import { expectedProgress, paceColor, type GaugeColor } from './gauge';

describe('expectedProgress', () => {
  test.each<[number, number]>([
    [3, 0],
    [7, 0],
    [15, 0.5],
    [23, 1],
    [23.5, 1],
  ])('at %s h, %s of the goal is expected', (hour, expected) => {
    expect(expectedProgress(hour)).toBe(expected);
  });
});

describe('paceColor', () => {
  const GOAL = 2500;

  test('is green before 7 h, whatever the progress', () => {
    expect(paceColor(0, GOAL, 6.9)).toBe('green');
  });

  test.each<[number, GaugeColor]>([
    [2250, 'green'], // pace 0.9
    [2249, 'orange'],
    [1500, 'orange'], // pace 0.6
    [1499, 'red'],
  ])('at 23 h, %s ml out of 2 500 is %s', (value, color) => {
    expect(paceColor(value, GOAL, 23)).toBe(color);
  });

  test('compares progress with what is expected at that hour', () => {
    // At 15 h half the goal is expected: 1 150 ml is a 0.92 pace, 1 100 ml a 0.88 pace.
    expect(paceColor(1150, GOAL, 15)).toBe('green');
    expect(paceColor(1100, GOAL, 15)).toBe('orange');
  });

  test('is green when there is no goal', () => {
    expect(paceColor(0, 0, 15)).toBe('green');
  });
});
```

`src/modules/today/domain/sync.test.ts` :

```ts
import { syncStatus, type SyncMeta, type SyncStatus } from './sync';

test.each<[SyncMeta, boolean, SyncStatus]>([
  [{ hasPendingWrites: false, fromCache: false }, false, 'synced'],
  [{ hasPendingWrites: true, fromCache: true }, false, 'pending'],
  [{ hasPendingWrites: true, fromCache: false }, false, 'pending'],
  [{ hasPendingWrites: false, fromCache: true }, false, 'offline'],
  [{ hasPendingWrites: false, fromCache: false }, true, 'error'],
])('%o with failed=%s is %s', (meta, failed, status) => {
  expect(syncStatus(meta, failed)).toBe(status);
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run: `npx jest src/modules/today/domain`
Expected: FAIL, « Cannot find module './gauge' » et « './sync' ».

- [ ] **Step 3: Écrire l'implémentation minimale**

`src/modules/today/domain/gauge.ts` :

```ts
export type GaugeColor = 'green' | 'orange' | 'red';

/** Share of the daily goal expected by `hour`: the active day runs from 7 h to 23 h (spec §9). */
export function expectedProgress(hour: number): number {
  return Math.min(Math.max((hour - 7) / 16, 0), 1);
}

/** Gauge color from the pace, actual progress / expected progress (spec §9). */
export function paceColor(value: number, goal: number, hour: number): GaugeColor {
  const expected = expectedProgress(hour);
  if (expected === 0 || goal <= 0) return 'green';
  const pace = value / goal / expected;
  if (pace >= 0.9) return 'green';
  return pace >= 0.6 ? 'orange' : 'red';
}
```

`src/modules/today/domain/sync.ts` :

```ts
/** Firestore snapshot metadata, the source of the sync state (spec §6). */
export type SyncMeta = { hasPendingWrites: boolean; fromCache: boolean };

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';

export function syncStatus(meta: SyncMeta, failed: boolean): SyncStatus {
  if (failed) return 'error';
  if (meta.hasPendingWrites) return 'pending';
  return meta.fromCache ? 'offline' : 'synced';
}
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `npx jest src/modules/today/domain && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS (2 suites, 17 tests), aucune violation.

- [ ] **Step 5: Commit**

```bash
git add src/modules/today/domain
git commit -m "feat: gauge pace colors and sync status rules (M1)"
```

---

### Task 4: Module hydratation : ports, cas d'usage, dépôt en mémoire, profil par défaut (M1)

**Files:**
- Create: `src/modules/settings/domain/profile.ts`
- Create: `src/modules/settings/index.ts`
- Create: `src/modules/hydration/application/ports.ts`
- Create: `src/modules/hydration/application/waterUseCases.ts`
- Test: `src/modules/hydration/application/waterUseCases.test.ts`
- Create: `src/modules/hydration/adapters/inMemoryWaterRepository.ts`
- Create: `src/modules/hydration/index.ts`

**Interfaces:**
- Consumes: `dayKey`, `type Clock` de `@/shared/clock`.
- Produces:
  - `@/modules/settings` : `type WaterContainer = { label: string; ml: number }`, `type Profile = { timezone: string; goals: { waterMl: number }; waterContainers: WaterContainer[] }`, `DEFAULT_PROFILE: Profile`.
  - `@/modules/hydration` :
    - `type WaterEntry = { id: string; day: string; ml: number; createdAt: Date }`
    - `type NewWaterEntry = Omit<WaterEntry, 'id'>`
    - `interface WaterRepository { add(entry: NewWaterEntry): Promise<void>; remove(entry: WaterEntry): Promise<void>; observeDay(day: string, onNext: (entries: WaterEntry[]) => void, onError: (error: Error) => void): () => void }`
    - `waterUseCases(repo: WaterRepository, clock: Clock, timezone: string)` → `{ addWater(ml: number): Promise<void>; removeWater(entry: WaterEntry): Promise<void>; observeDay(day, onNext, onError): () => void }` (journal du plus récent au plus ancien)
    - `type Hydration = ReturnType<typeof waterUseCases>`
    - `inMemoryWaterRepository(): WaterRepository & { entries: WaterEntry[] }`

- [ ] **Step 1: Écrire le profil par défaut et les ports**

`src/modules/settings/domain/profile.ts` :

```ts
export type WaterContainer = { label: string; ml: number };

/** The part of `users/{uid}` this milestone reads. Nothing writes the profile before M6, so the defaults are the profile. */
export type Profile = {
  timezone: string;
  goals: { waterMl: number };
  waterContainers: WaterContainer[];
};

export const DEFAULT_PROFILE: Profile = {
  timezone: 'Europe/Paris',
  goals: { waterMl: 2500 },
  waterContainers: [
    { label: 'Verre', ml: 250 },
    { label: 'Bouteille', ml: 500 },
  ],
};
```

`src/modules/settings/index.ts` :

```ts
export { DEFAULT_PROFILE, type Profile, type WaterContainer } from './domain/profile';
```

`src/modules/hydration/application/ports.ts` :

```ts
export type WaterEntry = { id: string; day: string; ml: number; createdAt: Date };

export type NewWaterEntry = Omit<WaterEntry, 'id'>;

export interface WaterRepository {
  /** Settles once the server has the write: offline it stays pending while observers already see it. */
  add(entry: NewWaterEntry): Promise<void>;
  /** Soft delete: sets `deletedAt` and takes the glass off the day total. */
  remove(entry: WaterEntry): Promise<void>;
  /** Live entries of `day`, deleted ones excluded. Returns the unsubscribe function. */
  observeDay(day: string, onNext: (entries: WaterEntry[]) => void, onError: (error: Error) => void): () => void;
}
```

- [ ] **Step 2: Écrire le test qui échoue**

`src/modules/hydration/application/waterUseCases.test.ts` :

```ts
import { inMemoryWaterRepository } from '../adapters/inMemoryWaterRepository';
import type { WaterEntry } from './ports';
import { waterUseCases } from './waterUseCases';

test('a glass logged at 23:50 in Paris stays on that day', async () => {
  const repo = inMemoryWaterRepository();
  const lateEvening = { now: () => new Date('2026-10-24T21:50:00Z') };
  await waterUseCases(repo, lateEvening, 'Europe/Paris').addWater(250);
  expect(repo.entries).toEqual([expect.objectContaining({ day: '2026-10-24', ml: 250 })]);
});

test('the day journal lists live glasses newest first and drops removed ones', async () => {
  const repo = inMemoryWaterRepository();
  const clock = { now: () => new Date('2026-10-23T08:00:00Z') };
  const water = waterUseCases(repo, clock, 'Europe/Paris');
  await water.addWater(250);
  clock.now = () => new Date('2026-10-23T09:00:00Z');
  await water.addWater(500);

  let journal: WaterEntry[] = [];
  water.observeDay('2026-10-23', (entries) => (journal = entries), () => {});
  expect(journal.map((e) => e.ml)).toEqual([500, 250]);

  await water.removeWater(journal[0]);
  expect(journal.map((e) => e.ml)).toEqual([250]);
});
```

- [ ] **Step 3: Lancer le test et vérifier qu'il échoue**

Run: `npx jest src/modules/hydration`
Expected: FAIL, « Cannot find module '../adapters/inMemoryWaterRepository' ».

- [ ] **Step 4: Écrire l'implémentation minimale**

`src/modules/hydration/adapters/inMemoryWaterRepository.ts` :

```ts
import type { NewWaterEntry, WaterEntry, WaterRepository } from '../application/ports';

/** WaterRepository kept in memory, for tests. `entries` is what it stores. */
export function inMemoryWaterRepository(): WaterRepository & { entries: WaterEntry[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const repo = {
    entries: [] as WaterEntry[],
    async add(entry: NewWaterEntry) {
      repo.entries = [...repo.entries, { ...entry, id: String(nextId++) }];
      notify();
    },
    async remove(entry: WaterEntry) {
      repo.entries = repo.entries.filter((e) => e.id !== entry.id);
      notify();
    },
    observeDay(day: string, onNext: (entries: WaterEntry[]) => void) {
      const listener = () => onNext(repo.entries.filter((e) => e.day === day));
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return repo;
}
```

`src/modules/hydration/application/waterUseCases.ts` :

```ts
import { dayKey, type Clock } from '@/shared/clock';
import type { WaterEntry, WaterRepository } from './ports';

export function waterUseCases(repo: WaterRepository, clock: Clock, timezone: string) {
  return {
    addWater(ml: number) {
      const now = clock.now();
      return repo.add({ day: dayKey(now, timezone), ml, createdAt: now });
    },
    removeWater: (entry: WaterEntry) => repo.remove(entry),
    /** The day's glasses, newest first. */
    observeDay(day: string, onNext: (entries: WaterEntry[]) => void, onError: (error: Error) => void) {
      return repo.observeDay(
        day,
        (entries) => onNext([...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
        onError,
      );
    },
  };
}

export type Hydration = ReturnType<typeof waterUseCases>;
```

`src/modules/hydration/index.ts` :

```ts
export type { NewWaterEntry, WaterEntry, WaterRepository } from './application/ports';
export { waterUseCases, type Hydration } from './application/waterUseCases';
export { inMemoryWaterRepository } from './adapters/inMemoryWaterRepository';
```

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

Run: `npx jest src/modules/hydration && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS (2 tests), aucune violation.

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings src/modules/hydration
git commit -m "feat: hydration use cases on a water repository port, default profile (M1)"
```

---

### Task 5: Adaptateurs Firestore (eau, totaux du jour) testés sur l'émulateur (M1)

**Files:**
- Create: `src/modules/hydration/adapters/firestoreWaterRepository.ts`
- Test: `src/modules/hydration/adapters/firestoreWaterRepository.emulator.test.ts`
- Create: `src/modules/today/application/ports.ts`
- Create: `src/modules/today/adapters/firestoreDayTotals.ts`
- Test: `src/modules/today/adapters/firestoreDayTotals.emulator.test.ts`

**Interfaces:**
- Consumes: `WaterRepository`, `NewWaterEntry`, `WaterEntry` (`../application/ports`, tâche 4) ; `SyncMeta` (`../domain/sync`, tâche 3) ; `npm run test:emulator` et les règles (tâche 2).
- Produces:
  - `firestoreWaterRepository(db: Firestore, uid: string): WaterRepository` (`Firestore` de `@react-native-firebase/firestore`)
  - `type DayTotals = { waterMl: number }`
  - `interface DayTotalsRepository { observe(day: string, onNext: (totals: DayTotals, sync: SyncMeta) => void, onError: (error: Error) => void): () => void }`
  - `firestoreDayTotals(db: Firestore, uid: string): DayTotalsRepository`

- [ ] **Step 1: Écrire le port des totaux du jour**

`src/modules/today/application/ports.ts` :

```ts
import type { SyncMeta } from '../domain/sync';

/** The `days/{date}` totals this milestone shows. */
export type DayTotals = { waterMl: number };

export interface DayTotalsRepository {
  /** Live totals of `day` (0 when nothing was logged) with their snapshot metadata. Returns the unsubscribe function. */
  observe(day: string, onNext: (totals: DayTotals, sync: SyncMeta) => void, onError: (error: Error) => void): () => void;
}
```

- [ ] **Step 2: Écrire les tests d'émulateur qui échouent**

`src/modules/hydration/adapters/firestoreWaterRepository.emulator.test.ts` :

```ts
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, getDocFromServer, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { WaterEntry } from '../application/ports';
import { firestoreWaterRepository } from './firestoreWaterRepository';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-genki',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});
afterEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

// Each authenticated context is a separate client: a phone.
const phone = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;
// The adapter is typed for React Native Firebase; here it runs on the web SDK (jest.emulator.config.js).
const waterOn = (db: Firestore) => firestoreWaterRepository(db as never, 'alice');
const glass = (ml: number) => ({ day: '2026-10-23', ml, createdAt: new Date('2026-10-23T10:00:00Z') });

const serverTotal = async (db: Firestore) =>
  (await getDocFromServer(doc(db, 'users/alice/days/2026-10-23'))).data()?.waterMl;

const journal = (db: Firestore) =>
  new Promise<WaterEntry[]>((resolve, reject) => {
    const stop = waterOn(db).observeDay(
      '2026-10-23',
      (entries) => {
        stop();
        resolve(entries);
      },
      reject,
    );
  });

test('two phones adding water offline end up with the sum (spec §10)', async () => {
  const [a, b] = [phone(), phone()];
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const writes = [waterOn(a).add(glass(250)), waterOn(b).add(glass(500))];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  await Promise.all(writes);
  expect(await serverTotal(a)).toBe(750);
});

test('removing a glass hides it from the journal and takes it off the total', async () => {
  const db = phone();
  await waterOn(db).add(glass(250));
  await waterOn(db).add(glass(500));
  const quarter = (await journal(db)).find((e) => e.ml === 250);
  await waterOn(db).remove(quarter!);
  expect((await journal(db)).map((e) => e.ml)).toEqual([500]);
  expect(await serverTotal(db)).toBe(500);
});

test('a glass removed offline on two phones comes off the total once', async () => {
  const [a, b] = [phone(), phone()];
  await waterOn(a).add(glass(250));
  const [entry] = await journal(a);
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const removals = [waterOn(a).remove(entry), waterOn(b).remove(entry)];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  const results = await Promise.allSettled(removals);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect(await serverTotal(a)).toBe(0);
});
```

`src/modules/today/adapters/firestoreDayTotals.emulator.test.ts` :

```ts
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { SyncMeta } from '../domain/sync';
import { firestoreDayTotals } from './firestoreDayTotals';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-genki',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});
afterEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

const phone = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;

/** Resolves on the first snapshot of today's totals that matches. */
const totalsUntil = (db: Firestore, matches: (waterMl: number, sync: SyncMeta) => boolean) =>
  new Promise<void>((resolve, reject) => {
    // The adapter is typed for React Native Firebase; here it runs on the web SDK (jest.emulator.config.js).
    const stop = firestoreDayTotals(db as never, 'alice').observe(
      '2026-10-23',
      (totals, sync) => {
        if (!matches(totals.waterMl, sync)) return;
        stop();
        resolve();
      },
      reject,
    );
  });

test('a day without data reads as zero once the server answered', async () => {
  await totalsUntil(phone(), (waterMl, sync) => waterMl === 0 && !sync.fromCache);
});

test('a write is pending offline, then synced once the server has it', async () => {
  const db = phone();
  await disableNetwork(db);
  const pending = totalsUntil(db, (waterMl, sync) => waterMl === 250 && sync.hasPendingWrites);
  const write = setDoc(doc(db, 'users/alice/days/2026-10-23'), { waterMl: 250, updatedAt: serverTimestamp() });
  await pending;
  await enableNetwork(db);
  await write;
  await totalsUntil(db, (waterMl, sync) => waterMl === 250 && !sync.hasPendingWrites && !sync.fromCache);
});
```

- [ ] **Step 3: Lancer les tests et vérifier qu'ils échouent**

Run: `npm run test:emulator`
Expected: FAIL, « Cannot find module './firestoreWaterRepository' » et « './firestoreDayTotals' » (les tests de règles passent).

- [ ] **Step 4: Écrire les adaptateurs**

`src/modules/hydration/adapters/firestoreWaterRepository.ts` :

```ts
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from '@react-native-firebase/firestore';
import type { NewWaterEntry, WaterEntry, WaterRepository } from '../application/ports';

/** Glasses in `users/{uid}/waterEntries`; each write moves `days/{day}.waterMl` in the same batch (spec §4). */
export function firestoreWaterRepository(db: Firestore, uid: string): WaterRepository {
  const entries = collection(db, 'users', uid, 'waterEntries');

  // increment() adds up on the server: glasses logged offline on two phones sum instead of overwriting.
  const moveDayTotal = (batch: WriteBatch, day: string, ml: number) =>
    batch.set(
      doc(db, 'users', uid, 'days', day),
      { waterMl: increment(ml), updatedAt: serverTimestamp() },
      { merge: true },
    );

  return {
    add(entry: NewWaterEntry) {
      const batch = writeBatch(db);
      batch.set(doc(entries), {
        day: entry.day,
        ml: entry.ml,
        createdAt: Timestamp.fromDate(entry.createdAt),
        deletedAt: null,
      });
      moveDayTotal(batch, entry.day, entry.ml);
      return batch.commit();
    },

    remove(entry: WaterEntry) {
      const batch = writeBatch(db);
      batch.update(doc(entries, entry.id), { deletedAt: Timestamp.now() });
      moveDayTotal(batch, entry.day, -entry.ml);
      return batch.commit();
    },

    observeDay(day, onNext, onError) {
      return onSnapshot(
        query(entries, where('day', '==', day)),
        (snapshot) =>
          onNext(
            snapshot.docs
              .filter((d) => d.data().deletedAt === null)
              .map((d) => ({ id: d.id, day, ml: d.data().ml, createdAt: d.data().createdAt.toDate() })),
          ),
        onError,
      );
    },
  };
}
```

`src/modules/today/adapters/firestoreDayTotals.ts` :

```ts
import { doc, onSnapshot, type Firestore } from '@react-native-firebase/firestore';
import type { DayTotalsRepository } from '../application/ports';

export function firestoreDayTotals(db: Firestore, uid: string): DayTotalsRepository {
  return {
    observe(day, onNext, onError) {
      return onSnapshot(
        doc(db, 'users', uid, 'days', day),
        // Metadata changes too: the sync icon follows hasPendingWrites and fromCache (spec §6).
        { includeMetadataChanges: true },
        (snapshot) =>
          onNext(
            { waterMl: snapshot.data()?.waterMl ?? 0 },
            { hasPendingWrites: snapshot.metadata.hasPendingWrites, fromCache: snapshot.metadata.fromCache },
          ),
        onError,
      );
    },
  };
}
```

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

Run: `npm run test:emulator && npm run typecheck && npm run lint && npm run lint:deps && npm test`
Expected: PASS (3 suites d'émulateur, 22 tests ; tests unitaires inchangés), aucune violation.

- [ ] **Step 6: Commit**

```bash
git add src/modules/hydration/adapters src/modules/today/application src/modules/today/adapters
git commit -m "feat: Firestore water and day-total adapters, offline two-phone scenario on the emulator (M1)"
```

---

### Task 6: Écran Aujourd'hui : jauge Eau, ajouts rapides, volet du jour, icône de synchro (M1)

**Files:**
- Create: `src/shared/useNow.ts`
- Create: `src/modules/today/ui/GaugeBar.tsx`
- Create: `src/modules/today/ui/SyncIcon.tsx`
- Create: `src/modules/today/ui/TodayScreen.tsx`
- Test: `src/modules/today/ui/TodayScreen.test.tsx`
- Create: `src/modules/today/index.ts`
- Create: `src/modules/hydration/ui/WaterButtons.tsx`
- Create: `src/modules/hydration/ui/WaterSheet.tsx`
- Modify: `src/modules/hydration/index.ts`

**Interfaces:**
- Consumes: `dayKey`, `hourOfDay`, `Clock` (`@/shared/clock`) ; `expectedProgress`, `paceColor`, `GaugeColor`, `syncStatus`, `SyncMeta`, `SyncStatus` (`../domain/…`) ; `DayTotalsRepository` (`../application/ports`) ; `Hydration`, `WaterEntry`, `inMemoryWaterRepository`, `waterUseCases` (`@/modules/hydration`) ; `Profile`, `WaterContainer`, `DEFAULT_PROFILE` (`@/modules/settings`).
- Produces:
  - `useNow(clock: Clock): Date`
  - `@/modules/today` : `TodayScreen` (props `{ profile: Profile; clock: Clock; dayTotals: DayTotalsRepository; hydration: Hydration; run: (write: () => Promise<void>) => void }`), `SyncIcon` (props `{ dayTotals: DayTotalsRepository; clock: Clock; timezone: string; writeFailed: boolean }`), `type DayTotalsRepository`.
  - `@/modules/hydration` exporte en plus `WaterButtons`, `WaterSheet`.

- [ ] **Step 1: Écrire le test d'écran qui échoue**

`src/modules/today/ui/TodayScreen.test.tsx` :

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { inMemoryWaterRepository, waterUseCases } from '@/modules/hydration';
import { DEFAULT_PROFILE } from '@/modules/settings';
import type { DayTotalsRepository } from '../application/ports';
import { TodayScreen } from './TodayScreen';

// 15:00 in Paris: half of the daily water goal is expected by now.
const clock = { now: () => new Date('2026-10-23T13:00:00Z') };

function renderToday() {
  const water = inMemoryWaterRepository();
  // Day totals as Firestore keeps them: the sum of the day's live glasses.
  const dayTotals: DayTotalsRepository = {
    observe: (day, onNext) =>
      water.observeDay(
        day,
        (entries) =>
          onNext({ waterMl: entries.reduce((sum, e) => sum + e.ml, 0) }, { hasPendingWrites: false, fromCache: false }),
        () => {},
      ),
  };
  return render(
    <PaperProvider>
      <TodayScreen
        profile={DEFAULT_PROFILE}
        clock={clock}
        dayTotals={dayTotals}
        hydration={waterUseCases(water, clock, DEFAULT_PROFILE.timezone)}
        run={(write) => void write()}
      />
    </PaperProvider>,
  );
}

test('a quick-add button fills the water gauge', async () => {
  await renderToday();
  expect(screen.getByLabelText('Eau : 0 / 2,5 L')).toBeTruthy();
  await fireEvent.press(screen.getByText('+500 ml'));
  expect(screen.getByLabelText('Eau : 0,5 / 2,5 L')).toBeTruthy();
});

test('the water gauge opens the day sheet, where a glass can be removed', async () => {
  await renderToday();
  await fireEvent.press(screen.getByText('+250 ml'));
  await fireEvent.press(screen.getByLabelText('Eau : 0,25 / 2,5 L'));
  await fireEvent.press(screen.getByLabelText('Supprimer 250 ml de 15:00'));
  expect(screen.getByText('Aucun verre aujourd’hui.')).toBeTruthy();
  // The gauge sits behind the open sheet.
  expect(screen.getByLabelText('Eau : 0 / 2,5 L', { includeHiddenElements: true })).toBeTruthy();
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `npx jest src/modules/today/ui`
Expected: FAIL, « Cannot find module './TodayScreen' ».

- [ ] **Step 3: Écrire les composants**

`src/shared/useNow.ts` :

```ts
import { useEffect, useState } from 'react';
import type { Clock } from './clock';

/** Current time, refreshed every minute so the day key and gauge paces follow the clock. */
export function useNow(clock: Clock): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 60_000);
    return () => clearInterval(id);
  }, [clock]);
  return now;
}
```

`src/modules/today/ui/GaugeBar.tsx` :

```tsx
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import type { GaugeColor } from '../domain/gauge';

const COLORS: Record<GaugeColor, string> = { green: '#2E7D32', orange: '#EF6C00', red: '#C62828' };

type Props = {
  label: string;
  /** Value shown on the right, e.g. "1,25 / 2,5 L". */
  text: string;
  /** Progress toward the goal; drawn full from 1. */
  progress: number;
  /** Where the user should be by now, from 0 to 1. */
  expected: number;
  color: GaugeColor;
  /** "plus" adds, "chevron-right" opens (spec §6). */
  icon: 'plus' | 'chevron-right';
  onPress: () => void;
};

export function GaugeBar({ label, text, progress, expected, color, icon, onPress }: Props) {
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${text}`}
      style={styles.touch}
    >
      <View style={styles.content}>
        <View style={styles.row}>
          <Text variant="titleMedium">{label}</Text>
          <View style={styles.row}>
            <Text variant="bodyLarge">{text}</Text>
            <Icon source={icon} size={24} />
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: COLORS[color] }]} />
          <View style={[styles.marker, { left: `${expected * 100}%` }]} />
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: 48, borderRadius: 12, padding: 12 },
  content: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  track: { height: 12, borderRadius: 6, backgroundColor: '#E0E0E0', overflow: 'hidden' },
  fill: { height: '100%' },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#212121' },
});
```

`src/modules/today/ui/SyncIcon.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { DayTotalsRepository } from '../application/ports';
import { syncStatus, type SyncMeta, type SyncStatus } from '../domain/sync';

const LOOK: Record<SyncStatus, { icon: string; label: string }> = {
  synced: { icon: 'cloud-check-outline', label: 'Synchronisé' },
  pending: { icon: 'cloud-upload-outline', label: 'En attente d’envoi' },
  offline: { icon: 'cloud-off-outline', label: 'Hors-ligne' },
  error: { icon: 'cloud-alert', label: 'Erreur de synchronisation' },
};

type Props = { dayTotals: DayTotalsRepository; clock: Clock; timezone: string; writeFailed: boolean };

/** Top-bar cloud, from today's totals snapshot metadata (spec §6): every write of the day touches that document. */
export function SyncIcon({ dayTotals, clock, timezone, writeFailed }: Props) {
  const day = dayKey(useNow(clock), timezone);
  const [meta, setMeta] = useState<SyncMeta>({ hasPendingWrites: false, fromCache: true });
  const [listenFailed, setListenFailed] = useState(false);

  useEffect(
    () =>
      dayTotals.observe(
        day,
        (_, sync) => {
          setMeta(sync);
          setListenFailed(false);
        },
        () => setListenFailed(true),
      ),
    [dayTotals, day],
  );

  const look = LOOK[syncStatus(meta, writeFailed || listenFailed)];
  return (
    <View accessible accessibilityLabel={look.label} style={styles.icon}>
      <Icon source={look.icon} size={24} />
    </View>
  );
}

const styles = StyleSheet.create({ icon: { marginHorizontal: 16 } });
```

`src/modules/hydration/ui/WaterButtons.tsx` :

```tsx
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import type { WaterContainer } from '@/modules/settings';

type Props = { containers: WaterContainer[]; onAdd: (ml: number) => void };

/** One-tap add buttons, one per container of the profile. */
export function WaterButtons({ containers, onAdd }: Props) {
  return (
    <View style={styles.row}>
      {containers.map((c) => (
        <Button
          key={c.label}
          mode="contained-tonal"
          icon="cup-water"
          onPress={() => onAdd(c.ml)}
          accessibilityLabel={`Ajouter ${c.ml} ml (${c.label})`}
          contentStyle={styles.button}
        >
          +{c.ml} ml
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48 },
});
```

`src/modules/hydration/ui/WaterSheet.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { IconButton, List, Modal, Portal, Text } from 'react-native-paper';
import type { WaterContainer } from '@/modules/settings';
import type { WaterEntry } from '../application/ports';
import type { Hydration } from '../application/waterUseCases';
import { WaterButtons } from './WaterButtons';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  day: string;
  timezone: string;
  containers: WaterContainer[];
  hydration: Hydration;
  run: (write: () => Promise<void>) => void;
};

/** Quick-add sheet: the add buttons and the day's glasses, no stats page (spec §6). */
export function WaterSheet({ visible, onDismiss, day, timezone, containers, hydration, run }: Props) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => hydration.observeDay(day, setEntries, () => {}), [hydration, day]);

  const time = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} overlayAccessibilityLabel="Fermer" contentContainerStyle={styles.sheet}>
        <Text variant="titleLarge">Eau</Text>
        <WaterButtons containers={containers} onAdd={(ml) => run(() => hydration.addWater(ml))} />
        <ScrollView style={styles.list}>
          {entries.length === 0 && <Text>Aucun verre aujourd’hui.</Text>}
          {entries.map((entry) => (
            <List.Item
              key={entry.id}
              title={`${entry.ml} ml`}
              description={time(entry.createdAt)}
              right={() => (
                <IconButton
                  icon="delete-outline"
                  accessibilityLabel={`Supprimer ${entry.ml} ml de ${time(entry.createdAt)}`}
                  onPress={() => run(() => hydration.removeWater(entry))}
                />
              )}
            />
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: { margin: 16, padding: 16, gap: 12, borderRadius: 16, backgroundColor: 'white' },
  list: { maxHeight: 360 },
});
```

Ajouter à `src/modules/hydration/index.ts` :

```ts
export { WaterButtons } from './ui/WaterButtons';
export { WaterSheet } from './ui/WaterSheet';
```

`src/modules/today/ui/TodayScreen.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { WaterButtons, WaterSheet, type Hydration } from '@/modules/hydration';
import type { Profile } from '@/modules/settings';
import { dayKey, hourOfDay, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { DayTotalsRepository } from '../application/ports';
import { expectedProgress, paceColor } from '../domain/gauge';
import { GaugeBar } from './GaugeBar';

type Props = {
  profile: Profile;
  clock: Clock;
  dayTotals: DayTotalsRepository;
  hydration: Hydration;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
};

const liters = (ml: number) => (ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function TodayScreen({ profile, clock, dayTotals, hydration, run }: Props) {
  const now = useNow(clock);
  const day = dayKey(now, profile.timezone);
  const hour = hourOfDay(now, profile.timezone);
  const [waterMl, setWaterMl] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Listener errors show on the SyncIcon, which watches the same document.
  useEffect(() => dayTotals.observe(day, (totals) => setWaterMl(totals.waterMl), () => {}), [dayTotals, day]);

  const goal = profile.goals.waterMl;
  const addWater = (ml: number) => run(() => hydration.addWater(ml));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GaugeBar
        label="Eau"
        text={`${liters(waterMl)} / ${liters(goal)} L`}
        progress={goal > 0 ? waterMl / goal : 1}
        expected={expectedProgress(hour)}
        color={paceColor(waterMl, goal, hour)}
        icon="plus"
        onPress={() => setSheetOpen(true)}
      />
      <WaterButtons containers={profile.waterContainers} onAdd={addWater} />
      <WaterSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        day={day}
        timezone={profile.timezone}
        containers={profile.waterContainers}
        hydration={hydration}
        run={run}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 16 } });
```

`src/modules/today/index.ts` :

```ts
export type { DayTotals, DayTotalsRepository } from './application/ports';
export { SyncIcon } from './ui/SyncIcon';
export { TodayScreen } from './ui/TodayScreen';
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `npm test && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS (tous les tests unitaires, dont les 2 de `TodayScreen`), aucune violation, aucun avertissement d'icône dans la sortie Jest.

- [ ] **Step 5: Commit**

```bash
git add src/shared/useNow.ts src/modules/today src/modules/hydration
git commit -m "feat: Today screen with water gauge, quick add, day sheet and sync icon (M1)"
```

---

### Task 7: Assemblage : Firebase, connexion Google, routes, README (M0 + M1)

**Files:**
- Create: `src/platform/firebase.ts`
- Create: `src/composition.ts`
- Create: `src/appContext.tsx`
- Create: `app/_layout.tsx`
- Create: `app/sign-in.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Test: `src/navigation.test.tsx`
- Create: `README.md`
- Modify: `package.json` (retirer `expo-status-bar`, inutilisé)

**Interfaces:**
- Consumes: `firestoreWaterRepository` (`@/modules/hydration/adapters/firestoreWaterRepository`), `waterUseCases` (`@/modules/hydration`), `DEFAULT_PROFILE` (`@/modules/settings`), `firestoreDayTotals` (`@/modules/today/adapters/firestoreDayTotals`), `TodayScreen`, `SyncIcon` (`@/modules/today`), `systemClock` (`@/shared/clock`).
- Produces:
  - `@/platform/firebase` : `db: Firestore`, `signInWithGoogle(): Promise<void>`, `useAuthUser(): User | null`.
  - `@/composition` : `compose(uid: string)` → `{ profile, clock, hydration, dayTotals }`, `type App = ReturnType<typeof compose>`.
  - `@/appContext` : `AppProvider` (props `{ app: App; children: ReactNode }`), `useApp(): { app: App; run: (write: () => Promise<void>) => void; writeFailed: boolean }`.

- [ ] **Step 1: Écrire le test de navigation qui échoue**

`src/navigation.test.tsx` :

```tsx
import { renderRouter, screen } from 'expo-router/testing-library';
import type { App } from '@/composition';
import { useAuthUser } from '@/platform/firebase';

jest.mock('@/platform/firebase', () => ({ useAuthUser: jest.fn(), signInWithGoogle: jest.fn() }));

// The real composition needs native Firebase: wire the app on in-memory adapters instead.
jest.mock('@/composition', () => {
  const { inMemoryWaterRepository, waterUseCases } = jest.requireActual('@/modules/hydration');
  const { DEFAULT_PROFILE } = jest.requireActual('@/modules/settings');
  const clock = { now: () => new Date('2026-10-23T13:00:00Z') };
  return {
    compose: (): App => ({
      profile: DEFAULT_PROFILE,
      clock,
      hydration: waterUseCases(inMemoryWaterRepository(), clock, DEFAULT_PROFILE.timezone),
      dayTotals: {
        observe: (_day, onNext) => {
          onNext({ waterMl: 0 }, { hasPendingWrites: false, fromCache: false });
          return () => {};
        },
      },
    }),
  };
});

const signedInAs = (user: { uid: string } | null) => jest.mocked(useAuthUser).mockReturnValue(user as never);

test('a signed-out user lands on the Google sign-in', async () => {
  signedInAs(null);
  await renderRouter();
  expect(screen.getByText('Se connecter avec Google')).toBeTruthy();
});

test('a signed-in user lands on Today, with the sync icon in the top bar', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.getByLabelText('Eau : 0 / 2,5 L')).toBeTruthy();
  expect(screen.getByLabelText('Synchronisé')).toBeTruthy();
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `npx jest src/navigation.test.tsx`
Expected: FAIL (`@/platform/firebase`, `@/composition` et les routes n'existent pas).

- [ ] **Step 3: Écrire la plateforme, la composition et le contexte**

`src/platform/firebase.ts` :

```ts
import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  type User,
} from '@react-native-firebase/auth';
import { CACHE_SIZE_UNLIMITED, initializeFirestore } from '@react-native-firebase/firestore';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

// Offline persistence is on by default natively; the data is tiny, so the cache never evicts (spec §8).
export const db = initializeFirestore(getApp(), { cacheSizeBytes: CACHE_SIZE_UNLIMITED });

GoogleSignin.configure({ webClientId: Constants.expoConfig?.extra?.googleWebClientId });

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return; // the account picker was closed
  const { idToken } = response.data;
  if (!idToken) throw new Error('Google n’a pas renvoyé de jeton : vérifiez le client Web dans google-services.');
  await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
}

/** The signed-in user, or null. React Native Firebase restores the session synchronously at startup, offline too. */
export function useAuthUser(): User | null {
  const [user, setUser] = useState(() => getAuth().currentUser);
  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);
  return user;
}
```

`src/composition.ts` :

```ts
import { firestoreWaterRepository } from '@/modules/hydration/adapters/firestoreWaterRepository';
import { waterUseCases } from '@/modules/hydration';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { firestoreDayTotals } from '@/modules/today/adapters/firestoreDayTotals';
import { db } from '@/platform/firebase';
import { systemClock } from '@/shared/clock';

/** Plugs the adapters into the use cases for the signed-in user, by hand (spec §5). */
export function compose(uid: string) {
  const profile = DEFAULT_PROFILE;
  return {
    profile,
    clock: systemClock,
    hydration: waterUseCases(firestoreWaterRepository(db, uid), systemClock, profile.timezone),
    dayTotals: firestoreDayTotals(db, uid),
  };
}

export type App = ReturnType<typeof compose>;
```

`src/appContext.tsx` :

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';
import type { App } from './composition';

type Write = () => Promise<void>;
type AppContextValue = { app: App; run: (write: Write) => void; writeFailed: boolean };

const AppContext = createContext<AppContextValue | null>(null);

/** Provides the composed app and runs its writes: a rejected write is kept and offered again (spec §8). */
export function AppProvider({ app, children }: { app: App; children: ReactNode }) {
  const [failed, setFailed] = useState<Write | null>(null);
  // Not awaited: offline, a write only settles once the server has it.
  const run = useCallback((write: Write) => {
    write().catch(() => setFailed(() => write));
  }, []);
  const value = useMemo(() => ({ app, run, writeFailed: failed !== null }), [app, run, failed]);

  const retry = () => {
    const write = failed;
    setFailed(null);
    if (write) run(write);
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <Snackbar
        visible={failed !== null}
        onDismiss={() => setFailed(null)}
        duration={Number.POSITIVE_INFINITY}
        action={{ label: 'Réessayer', onPress: retry }}
        onIconPress={() => setFailed(null)}
        iconAccessibilityLabel="Fermer"
      >
        L’enregistrement a échoué.
      </Snackbar>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}
```

- [ ] **Step 4: Écrire les routes**

`app/_layout.tsx` :

```tsx
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useAuthUser } from '@/platform/firebase';

export default function RootLayout() {
  const signedIn = useAuthUser() !== null;
  return (
    <PaperProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </PaperProvider>
  );
}
```

`app/sign-in.tsx` :

```tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { signInWithGoogle } from '@/platform/firebase';

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = () => {
    setBusy(true);
    setError(null);
    signInWithGoogle()
      .catch((e: unknown) => setError(`La connexion a échoué. ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => setBusy(false));
  };

  return (
    <View style={styles.screen}>
      <Text variant="headlineMedium">Genki</Text>
      <Button mode="contained" icon="google" onPress={signIn} loading={busy} disabled={busy} contentStyle={styles.button}>
        Se connecter avec Google
      </Button>
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  button: { minHeight: 48 },
});
```

`app/(tabs)/_layout.tsx` :

```tsx
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Icon } from 'react-native-paper';
import { AppProvider, useApp } from '@/appContext';
import { compose } from '@/composition';
import { SyncIcon } from '@/modules/today';
import { useAuthUser } from '@/platform/firebase';

function HeaderSync() {
  const { app, writeFailed } = useApp();
  return <SyncIcon dayTotals={app.dayTotals} clock={app.clock} timezone={app.profile.timezone} writeFailed={writeFailed} />;
}

export default function TabsLayout() {
  const uid = useAuthUser()?.uid;
  const app = useMemo(() => (uid ? compose(uid) : null), [uid]);
  if (!app) return null; // signed out: the root guard is leaving this screen

  return (
    <AppProvider app={app}>
      <Tabs screenOptions={{ headerRight: () => <HeaderSync /> }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Aujourd’hui',
            tabBarIcon: ({ color, size }) => <Icon source="calendar-today" color={color} size={size} />,
          }}
        />
      </Tabs>
    </AppProvider>
  );
}
```

`app/(tabs)/index.tsx` :

```tsx
import { useApp } from '@/appContext';
import { TodayScreen } from '@/modules/today';

export default function Today() {
  const { app, run } = useApp();
  return (
    <TodayScreen profile={app.profile} clock={app.clock} dayTotals={app.dayTotals} hydration={app.hydration} run={run} />
  );
}
```

- [ ] **Step 5: Retirer la dépendance inutilisée**

Run: `npm uninstall expo-status-bar`
Expected: `expo-status-bar` disparaît de `package.json` (rien ne l'importe).

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `npm test && npm run typecheck && npm run lint && npm run lint:deps && npm run test:emulator && npx expo-doctor`
Expected: PASS partout ; `navigation.test.tsx` passe (2 tests) ; expo-doctor 20/20.

- [ ] **Step 7: Écrire le README**

`README.md` :

````markdown
# Genki

Application mobile personnelle de suivi : hydratation, alimentation, sport. Spec : `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md`.

État : M0 (socle, connexion Google, règles) et M1 (eau sur l'écran Aujourd'hui, hors-ligne, synchro entre deux téléphones).

## Prérequis

- Node 24 et npm 11.
- Android Studio (SDK Android). Gradle tourne avec le JDK 21 fourni par Android Studio :

  ```bash
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  ```

- Java 21 ou plus pour l'émulateur Firestore (tests).

## Mise en place Firebase (une fois par projet)

Deux projets sur la formule Spark (gratuite) : un pour le dev, un pour la prod.

1. [Console Firebase](https://console.firebase.google.com) → Ajouter un projet (par exemple `genki-dev`, puis `genki-prod`). Google Analytics n'est pas utile.
2. Firestore Database → Créer une base → mode production → emplacement `europe-west9` (Paris). Ce choix est définitif.
3. Authentication → Méthodes de connexion → Google → Activer.
4. Paramètres du projet → Ajouter une application Android, nom de package `com.nugah.genki.dev` (projet dev) ou `com.nugah.genki` (projet prod). Ajouter l'empreinte SHA-1 de la clé de signature. La clé de debug est créée au premier build Android :

   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
   ```

5. Télécharger `google-services.json` après l'étape 3. Il doit contenir un `oauth_client` de `client_type` 3 (client Web), sans quoi la connexion Google échoue. Le placer à la racine du dépôt sous le nom `google-services.dev.json` (projet dev) ou `google-services.json` (projet prod). Ces fichiers ne vont pas dans git ; `google-services.example.json` montre leur forme.
6. Déployer les règles :

   ```bash
   npx firebase login
   npx firebase deploy --only firestore:rules --project <id-du-projet>
   ```

## Lancer l'application

Téléphone Android en USB (débogage USB activé) ou émulateur Android.

- Variante dev (projet dev) : `npm run android` construit l'app native et l'installe. Ensuite, `npm start` suffit pour recharger le JavaScript.
- Variante prod (projet prod) : `APP_VARIANT=production npx expo run:android --variant release`.

Les deux variantes s'installent côte à côte (`Genki (dev)` et `Genki`).

## Vérifications

```bash
npm run lint && npm run typecheck && npm test && npm run lint:deps
npm run test:emulator   # règles et adaptateurs Firestore, émulateur sur le port 8088
```

La CI GitHub Actions lance les mêmes commandes.

## À vérifier sur le téléphone avant M2 (spec §11)

Deux téléphones connectés au même compte Google : couper le réseau sur les deux, ajouter de l'eau sur chacun, rétablir le réseau. Les deux doivent afficher la somme, et l'icône nuage repasser à « Synchronisé ».
````

- [ ] **Step 8: Commit**

```bash
git add src/platform src/composition.ts src/appContext.tsx src/navigation.test.tsx app README.md package.json package-lock.json
git commit -m "feat: Google sign-in, app composition, routes and setup guide (M0, M1)"
```

---

## Vérification finale (contrôleur)

- [ ] `npm run lint && npm run typecheck && npm test && npm run lint:deps && npm run test:emulator && npx expo-doctor` : tout passe.
- [ ] Build natif Android de contrôle avec un faux `google-services.dev.json` (copie de l'exemple) : `npx expo prebuild --platform android --clean`, puis `cd android && ./gradlew assembleDebug` avec `JAVA_HOME` du JBR d'Android Studio. Le build doit réussir. Supprimer ensuite le faux fichier et le dossier `android/` (sinon la fausse config resterait embarquée).
- [ ] Revue finale de toute la branche (superpowers:requesting-code-review), et revue ponytail du code inutile, en parallèle.
