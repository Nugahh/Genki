# Chantier A : la période Mois Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The repository code is the reference where this plan and the code differ.

**Goal:** Ajouter la période **Mois** à tout le Suivi : le sélecteur devient Jour · Semaine · Mois · Année, un mois montre une barre par jour (28 à 31) avec des flèches de mois en mois, pour toutes les statistiques (calories, eau, pas, poids, tabac, séances…).

**Architecture:** Aucun nouveau module ni nouvelle source. `Period` gagne `'month'` dans le domaine du Suivi ; `bucketsFor`, `shiftAnchor` et `periodTitle` savent le mois ; le reste du Suivi (cas d'usage, séries, résumés, écrans) est déjà générique en la période. La préférence `ui.period` accepte `'month'` (domaine des réglages, adaptateur, règles Firestore). Le graphique espace ses étiquettes selon la place disponible.

**Tech Stack:** TypeScript pur pour le domaine, React Native Paper (`SegmentedButtons`), `react-native-svg`, Jest + RNTL, émulateur Firestore pour les règles.

Spec : `docs/superpowers/specs/2026-11-01-suivi-mensuel-micronutriments-design.md` §2.

## Global Constraints

- Français dans l'interface, code et commentaires en anglais ; cibles 48 dp, libellés d'accessibilité en français qui commencent par le texte visible, états annoncés avec `accessibilityLiveRegion="polite"`, couleurs par le thème.
- Spec §6 : un mois est le **mois calendaire** de la date choisie ; une **barre par jour** ; le jour en cours est en pointillé ; moyennes et décomptes « dans la cible » sur les **jours terminés** ; la période d'avant sert à la variation (« par rapport au mois précédent ») ; flèche suivante désactivée sur le mois en cours.
- Étiquettes sous les barres : le numéro du jour, une sur cinq (1, 6, 11…) quand la place manque ; le texte lu dit « 3 novembre » (« 1er novembre » pour le premier).
- La valeur par défaut de `ui.period` reste `week`. Les anciennes valeurs enregistrées (`day`, `week`, `year`) restent valides.
- Un module n'importe pas les internes d'un autre ; `domain/` est du TypeScript pur.
- Avant de conclure : `npm run lint` (avec `--no-cache` si besoin), `npm run typecheck`, `npm test`, `npm run lint:deps`, `npm run test:emulator`.

---

### Task 1: Domaine — le mois dans `period.ts`

**Files:**
- Modify: `src/modules/tracking/domain/period.ts`, `src/modules/tracking/domain/period.test.ts`

**Interfaces:**
- Produces: `Period = 'day' | 'week' | 'month' | 'year'` ; `bucketsFor('month', anchor)` : un seau par jour du mois de `anchor` (`key` = jour, `label` = numéro du jour, `spoken` = « 3 novembre », `from` = `to` = jour) ; `shiftAnchor('month', anchor, ±1)` : même quantième le mois d'à côté, ramené au dernier jour si ce mois est plus court ; `periodTitle('month', anchor)` : « novembre 2026 ».

- [ ] **Step 1: Tests (rouges)** — ajouter à `period.test.ts` :

```ts
describe('the month', () => {
  test('is one bucket per day of the calendar month, numbered', () => {
    const buckets = bucketsFor('month', '2026-11-15');
    expect(buckets).toHaveLength(30);
    expect(buckets[0]).toEqual({ key: '2026-11-01', label: '1', spoken: '1er novembre', from: '2026-11-01', to: '2026-11-01' });
    expect(buckets[2]).toMatchObject({ label: '3', spoken: '3 novembre' });
    expect(buckets[29]).toMatchObject({ key: '2026-11-30', label: '30' });
  });

  test.each([
    ['2026-10-15', 31],
    ['2026-02-10', 28],
    ['2028-02-10', 29], // a leap year
  ])('around %s has %i days', (anchor, days) => expect(bucketsFor('month', anchor)).toHaveLength(days));

  test('spans the first day to the last', () => {
    expect(rangeOf(bucketsFor('month', '2026-11-15'))).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });

  test.each([
    ['2026-11-15', -1, '2026-10-15'],
    ['2026-11-15', 1, '2026-12-15'],
    ['2026-12-20', 1, '2027-01-20'], // into the next year
    ['2026-01-20', -1, '2025-12-20'], // back into the last
    ['2026-03-31', -1, '2026-02-28'], // February is shorter
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-03-31', -1, '2028-02-29'],
  ])('shiftAnchor from %s by %i is %s', (anchor, step, expected) => expect(shiftAnchor('month', anchor, step as -1 | 1)).toBe(expected));

  test('is titled by its month and year', () => {
    expect(periodTitle('month', '2026-11-15')).toBe('novembre 2026');
    expect(periodTitle('month', '2027-01-03')).toBe('janvier 2027');
  });
});
```

- [ ] **Step 2:** `npx jest src/modules/tracking/domain/period` → échec attendu.
- [ ] **Step 3: Implémenter** dans `period.ts` :

```ts
export type Period = 'day' | 'week' | 'month' | 'year';
```

et, dans `bucketsFor`, avant le `return` des mois de l'année :

```ts
  if (period === 'month') {
    const year = Number(anchor.slice(0, 4));
    const month = Number(anchor.slice(5, 7)) - 1;
    const days = Number(lastDayOfMonth(year, month).slice(8, 10));
    const prefix = anchor.slice(0, 8);
    return Array.from({ length: days }, (_, i) => {
      const n = i + 1;
      const day = `${prefix}${String(n).padStart(2, '0')}`;
      return { key: day, label: String(n), spoken: `${n === 1 ? '1er' : n} ${MONTHS[month]}`, from: day, to: day };
    });
  }
```

`shiftAnchor` : remplacer la branche des années par une branche commune aux mois et aux années :

```ts
  if (period === 'month') {
    const index = Number(anchor.slice(0, 4)) * 12 + (Number(anchor.slice(5, 7)) - 1) + step;
    const year = Math.floor(index / 12);
    const month = index % 12;
    const last = Number(lastDayOfMonth(year, month).slice(8, 10));
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(Number(anchor.slice(8, 10)), last)).padStart(2, '0')}`;
  }
```

(placée avant la branche existante de l'année, qui reste). `periodTitle` : ajouter `if (period === 'month') return \`${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}\`;`.

- [ ] **Step 4:** Vert. **Step 5:** Commit `feat: the month in the Suivi periods (domain)`.

---

### Task 2: La préférence `ui.period` accepte `month`

**Files:**
- Modify: `src/modules/settings/domain/ui.ts` (+ `ui.test.ts`), `src/modules/settings/adapters/firestoreProfileRepository.ts` (+ test émulateur), `firebase/firestore.rules` (+ `firestore.rules.emulator.test.ts`)

- [ ] **Step 1: Tests (rouges)** — `ui.test.ts` : `validateUi({ period: 'month' })` est `null`, `validateUi({ period: 'quarter' as never })` donne `'La période doit être le jour, la semaine, le mois ou l’année.'`. Règles : le propriétaire écrit `ui.period` à `'month'` ; `'quarter'` est refusé. Adaptateur (émulateur) : `saveUi({ period: 'month' })` puis `observeUi` rend `{ period: 'month' }`.
- [ ] **Step 2:** Rouge. **Step 3: Implémenter** :
  - `ui.ts` : `export type UiPeriod = 'day' | 'week' | 'month' | 'year';` ; la liste de validation ; le message ci-dessus.
  - `firestoreProfileRepository.ts` : `const PERIODS = ['day', 'week', 'month', 'year'];`.
  - `firestore.rules` : `ui.period in ['day', 'week', 'month', 'year']`.
- [ ] **Step 4:** Vert (`npx jest src/modules/settings` puis `npm run test:emulator`). **Step 5:** Commit `feat: the month is a valid period preference`.

---

### Task 3: Interface — sélecteur, graphique, textes

**Files:**
- Modify: `src/modules/tracking/ui/PeriodPicker.tsx`, `SeriesChart.tsx`, `changeText.ts` (+ leurs tests : `SeriesChart.test.tsx`, `SuiviHub.test.tsx`, `SectionScreen.test.tsx`, nouveau `PeriodPicker.test.tsx`)

**Interfaces:**
- `PeriodPicker` : quatre segments Jour · Semaine · Mois · Année. `BEFORE.month = 'le mois précédent'`. `SeriesChart` : les étiquettes sont affichées une sur `step`, avec `step = slot >= 28 ? 1 : slot >= 14 ? 2 : 5` (`slot` = largeur d'un seau).

- [ ] **Step 1: Tests (rouges)** :
  - `PeriodPicker.test.tsx` : les quatre libellés sont là dans l'ordre ; toucher « Mois » appelle `onPeriod('month')` ; la période choisie est cochée.
  - `SeriesChart.test.tsx` : un mois de 30 barres (`bucketsFor('month', '2026-11-15')`, valeurs sur quelques jours) dessine **une barre par seau qui a une valeur** et, sur 320 dp, des étiquettes **1, 6, 11, 16, 21, 26** seulement (et pas « 2 ») ; une semaine garde ses sept étiquettes ; une année garde un mois sur deux.
  - `SectionScreen.test.tsx` : avec `ui={{ period: 'month' }}`, le titre est « novembre 2026 », la flèche précédente mène à « octobre 2026 » (31 jours), la flèche suivante est désactivée sur le mois en cours, et la ligne de variation dit « par rapport au mois précédent ».
  - `SuiviHub.test.tsx` : toucher « Mois » appelle `onUiChange({ period: 'month' })` ; avec `ui.period = 'month'` le titre du hub est « novembre 2026 » et la carte Calories donne la moyenne des jours terminés du mois.
- [ ] **Step 2:** Rouge. **Step 3: Implémenter** :
  - `PeriodPicker.tsx` : ajouter `{ value: 'month', label: 'Mois', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true }` entre Semaine et Année ; si le libellé « Semaine » déborde sur 360 dp, mettre `showSelectedCheck: false` sur les quatre (à vérifier sur appareil, noté au README).
  - `changeText.ts` : `month: 'le mois précédent'`.
  - `SeriesChart.tsx` : remplacer la règle d'espacement `slot < 28 && i % 2 === 1` par `i % labelStep !== 0` avec `const labelStep = slot >= 28 ? 1 : slot >= 14 ? 2 : 5;` (commentaire : « un mois n'a pas la place de ses 31 étiquettes »).
- [ ] **Step 4:** Vert. **Step 5:** Commit `feat: the Month period in the Suivi screens`.

---

### Task 4: Documentation, vérifications, revue, fusion

- [ ] README : le Suivi a quatre périodes (puce « Suivi (M4) » : « Jour / Semaine / Mois / Année ») ; ajouter à la liste de vérification sur téléphone : « les quatre segments de la période tiennent sur 360 dp ; un mois a une barre fine par jour et une étiquette sur cinq ». `DESIGN.md` : la phrase du sélecteur. Spec principale `§6 États vides et période` : ajouter le Mois (« Mois : le mois calendaire, une barre par jour, flèches de mois en mois »).
- [ ] `npm run lint -- --no-cache && npm run typecheck && npm test && npm run lint:deps && npm run test:emulator`.
- [ ] Revue indépendante (sous-agent Sonnet, paquet `review-package`), corrections, relance des contrôles, fusion `--ff-only` dans `main`, poussée, vérification de la CI.

## Limites connues

- Quatre segments sur 360 dp : à vérifier sur appareil (voir Task 3).
- Un mois lit ~62 jours de documents par statistique (le mois et le précédent) : acceptable, servi par le cache local.
