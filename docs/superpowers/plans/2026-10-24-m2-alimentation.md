# M2 — Alimentation : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suivre ses repas : base Ciqual embarquée et recherchable hors-ligne, cru/cuit, aliments personnalisés, favoris (repas types), journal par repas, calories et protéines sur l'écran Aujourd'hui (jalon M2 de la spec).

**Architecture:** Nouveau module `nutrition` (hexagonal : `domain`, `application`, `adapters`, `ui`). Ciqual est converti une fois en base SQLite en lecture seule, embarquée dans l'app (`assets/ciqual.db`) et lue par `expo-sqlite` : aucune lecture Firestore pour chercher un aliment. Les aliments personnalisés, les entrées de repas et les favoris vivent dans Firestore sous `users/{uid}` ; chaque ajout, modification ou suppression d'une entrée écrit l'entrée et les compteurs `days/{date}` (`kcal`, `proteinG`, `carbsG`, `fatG`, par `increment()`) dans le même `writeBatch`, avec des macros figées à la saisie.

**Tech Stack:** Expo SDK 58, React Native Paper 5, React Native Firebase 27 (API modulaire), `expo-sqlite` (ajouté à la tâche 3), `node:sqlite` de Node 24 (script de conversion et tests, aucune dépendance), Jest 30 + jest-expo + RNTL 14, Firebase émulateur + `@firebase/rules-unit-testing`.

Spec : `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md`. Plan précédent : `docs/superpowers/plans/2026-10-23-m0-m1-socle-hydratation.md` (mêmes conventions).

## Global Constraints

Exigences de la spec (texte d'origine) :
- « Alimentation : base Ciqual embarquée, variantes cru et cuit, portions, aliments personnalisés, favoris et repas types, journal par repas. » (jalon M2)
- « Table Ciqual de l'Anses convertie en base SQLite embarquée, lecture seule. Recherche instantanée et hors-ligne, 0 lecture Firestore. »
- « Ciqual n'est pas dans Firestore : il est embarqué dans l'application. Une entrée y renvoie par `foodRef = { type: 'ciqual', id }`. »
- `foods/{id}` : `name`, `state` (`raw`, `cooked`, `other`), `per100g` (`kcal`, `protein`, `carbs`, `fat`), `portions` (liste de `{ label, grams }`), `updatedAt`, `deletedAt`.
- `foodEntries/{id}` : `day`, `meal` (`breakfast`, `lunch`, `dinner`, `snack`), `foodRef` (`{ type: 'ciqual' ou 'custom', id }`), `foodName`, `grams`, `macros` (`kcal`, `protein`, `carbs`, `fat`, figées à la saisie), `createdAt`, `updatedAt`, `deletedAt`.
- `favoriteMeals/{id}` : `name`, `items` (liste de `{ foodRef, foodName, grams }`), `updatedAt`.
- `days/{YYYY-MM-DD}` : `waterMl`, `kcal`, `proteinG`, `carbsG`, `fatG`, `steps`, … `updatedAt`.
- Règles de modélisation : « Les entrées sont des ajouts » ; « Totaux du jour dérivés : `days/{date}` contient des compteurs mis à jour par `increment()` dans le même lot d'écriture que l'entrée. Chaque module n'écrit que ses propres champs (nutrition : `kcal` et macros, hydratation : `waterMl`, …) » ; « Suppressions douces : supprimer une entrée pose `deletedAt` et décrémente les totaux dans le même lot » ; « Jour de l'entrée : le champ `day` est calculé à la création avec le fuseau du profil, jamais avec celui du téléphone » ; « Macros figées : corriger un aliment ne réécrit pas l'historique ».
- « Repas : Journal du jour par repas (petit-déjeuner, déjeuner, dîner, collations) avec les totaux. « Ajouter » ouvre quatre entrées : Favoris, Récents, Recherche (Ciqual en local, instantanée), Créer un aliment. Après le choix : état cru ou cuit, portion (puces comme « 1 œuf » ou « 100 g », ou grammes libres), aperçu des macros, ajout. Glisser une ligne permet de la modifier ou de la supprimer. »
- « Boutons d'ajout rapide : +250 ml, +500 ml (contenants du profil) et « + Repas ». » ; « Calories : au-dessus de 105 % de l'objectif jusqu'à 110 %, la barre est orange ; au-delà de 110 %, rouge. »
- « Les règles valident les types, les bornes (par exemple `grams` entre 0 et 5 000) et la liste des champs autorisés. »
- Hexagonale : « Un module n'importe jamais les internes d'un autre. » (`dependency-cruiser`, `npm run lint:deps`) ; `domain/` sans Firebase ni React ; « Toutes les écritures multi-documents sont des lots (`writeBatch`), jamais des transactions. » ; les dépôts exposent `observe…` ; pas de conteneur d'injection (`composition.ts`).
- Interface en français, unités métriques, zones touchables d'au moins 48 dp avec libellé d'accessibilité, « Une écriture refusée par les règles affiche un message avec « Réessayer » et conserve la saisie » (`run(write)`).
- Consigne de l'utilisateur (ponytail) : le plus petit changement complet ; aucun code « pour plus tard ».

Contraintes d'outillage (vérifiées pendant M0/M1 et la préparation de M2) :
- Mêmes règles qu'en M0/M1 : `npx expo install` pour les paquets Expo ; RNTL 14 est asynchrone (`await render/fireEvent`) ; `firebase` (web, tests) figé à 13.0.0 ; tests d'émulateur dans `*.emulator.test.ts` (port 8088, `maxWorkers: 1`, alias `@react-native-firebase/firestore` → `firebase/firestore`) ; jamais de fichier de test dans `app/` ; sortie de test sans avertissement ; messages de commit conventionnels terminés par la ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Node 24 exécute le TypeScript directement (`node script.ts`, imports avec l'extension `.ts`, effacement des types seulement : pas d'`enum`) ; `node:sqlite` est utilisable sous Jest (il affiche un `ExperimentalWarning`, masqué par `NODE_OPTIONS=--disable-warning=ExperimentalWarning` dans le script `test`) ; Metro d'Expo prend déjà `.db` comme extension d'asset.
- Les sommes de macros sont des flottants arrondis à 0,1 : les règles tolèrent une dérive négative de 0,05 sur les compteurs de macros du jour (jamais sur `waterMl`) ; l'interface borne l'affichage à 0.
- Les données Ciqual sont **externes** : ne jamais exécuter ni importer un fichier téléchargé ; le script les lit comme texte. Source : Anses, Table Ciqual 2025 (`doi:10.57745/RDMHWY`, licence Etalab 2.0, version du 2025-11-03). Les trois fichiers sont déjà téléchargés dans `/private/tmp/claude-501/-Users-nugah-Desktop-42-Genki/0075675a-187a-4db4-9845-65f77c31d0a1/scratchpad/ciqual-data/` : `alim.xml` (sha256 `e0b1de25b3039028205e9d54a96892e403e1b313c2efeb41180fabe132627478`), `compo.xml` (`8c46a9032ece4eab4ffccc9dfcb0c490ec2f416aa664cc1ee013b241c6bdd4af`), `const.xml` (`3a231ea3e9836e4ac0b6ff94511e010210b2523d1b8b486c6b29e211066ba3f3`).

## Décisions de périmètre (M2)

- **Cru / cuit :** Ciqual ne relie pas un aliment cru à son équivalent cuit (« Riz blanc, cru » et « Riz blanc, cuit, sans sel ajouté » sont deux entrées sans lien). L'état est donc déduit du nom, affiché en pastille sur chaque résultat, et la recherche propose les filtres **Tous / Cru / Cuit**. Pas d'appariement automatique (fragile, et il induirait en erreur sur les calories). Écart assumé avec « Après le choix : état cru ou cuit » : le choix se fait avant, dans la recherche.
- **Valeurs Ciqual :** énergie = code 328 (kcal, règlement UE 1169/2011) ; protéines = 25003 (N × 6,25) ; glucides 31000 ; lipides 40000. « traces » et « < x » comptent pour 0 ; « - » (non déterminé) compte pour 0 pour les protéines, glucides et lipides. Si l'énergie manque (143 aliments sur 3 484), elle est estimée par Atwater (4 × protéines + 4 × glucides + 9 × lipides + 7 × alcool, code 60000) **seulement quand ces quatre valeurs sont connues** (59 aliments) ; les 84 autres sont écartés (une valeur inconnue comptée pour 0 sous-estimerait les calories : « Boeuf, jarret cru » sortirait à 38 kcal), soit 3 400 aliments dans la base. L'utilisateur crée un aliment personnalisé pour ceux qui manquent.
- **Portions :** Ciqual n'en fournit pas. Un aliment Ciqual propose la puce « 100 g » (plus la dernière quantité mangée, depuis Récents) et la saisie libre ; un aliment personnalisé apporte ses propres portions.
- **Favoris :** « Favoris » liste les **repas types** (`favoriteMeals`) ; un aliment favori est un repas type d'un seul élément. « Récents » = les aliments distincts des 50 dernières entrées.
- **Lignes du journal :** toucher une ligne ouvre ses actions (modifier la quantité, supprimer) au lieu du glissement : accessible et testable. Écart assumé avec « Glisser une ligne » ; le glissement pourra s'ajouter plus tard.
- **Aliments personnalisés :** création, modification et suppression douce (depuis la fiche de l'aliment). Les favoris qui pointent vers un aliment supprimé l'ignorent.
- **Objectifs :** `DEFAULT_PROFILE.goals` reçoit `kcal: 2200` et `proteinG: 130` (valeurs provisoires ; l'écran de première configuration et les réglages d'objectifs arrivent en M6).
- **Écran Aujourd'hui :** jauges Calories et Protéines (règles de couleur de la spec §9) et bouton « + Repas » (repas choisi selon l'heure). Toucher une jauge Calories ou Protéines ouvre l'onglet Repas, faute de Suivi › Nutrition (M4).
- **Journal :** la journée en cours seulement (l'historique viendra avec Suivi, M4).
- **Arrondis :** macros d'une entrée arrondies à 0,1 (calories comprises) ; affichage des calories à l'unité. Modifier la quantité d'une ligne recalcule depuis les macros **figées** de la ligne (jamais depuis l'aliment) : exact pour un ajustement modeste, approximatif pour une grosse correction (2 g → 200 g perd de la précision sur les petites macros, jusqu'à 0,05 × le rapport par champ).
- **Favoris et récents :** un aliment personnalisé supprimé est ignoré sans bruit ; l'écran d'ajout n'agit sur favoris et récents qu'une fois la liste des aliments personnalisés chargée (première réponse de `observeCustom`), pour ne pas confondre « supprimé » et « pas encore chargé ».
- Pas de scan de code-barres, pas de glissement, pas d'import/export des aliments (hors périmètre).

## File Structure

```
scripts/ciqual/convert.ts, convert.test.ts          conversion XML → lignes                          (T1)
scripts/build-ciqual.ts                             CLI : XML → assets/ciqual.db                     (T1)
assets/ciqual.db                                    base générée, committée                          (T1)
src/modules/nutrition/domain/normalize.ts (+test)   normalizeSearch                                  (T1)
src/modules/nutrition/domain/macros.ts (+test)      Macros, macrosFor, scaleMacros, sum/subtract     (T2)
src/modules/nutrition/domain/meal.ts (+test)        MEALS, defaultMeal                               (T2)
src/modules/nutrition/domain/food.ts (+test)        types, validateFood, matchCustom                 (T2)
src/modules/nutrition/application/ports.ts         FoodCatalog, FoodRepository, FoodEntryRepository, FavoriteMealRepository (T2)
src/modules/nutrition/application/mealUseCases.ts (+test), foodUseCases.ts (+test)                  (T2)
src/modules/nutrition/adapters/inMemory*.ts         dépôts et catalogue en mémoire                   (T2)
src/modules/nutrition/adapters/ciqualCatalog.ts (+test)                                              (T3)
src/platform/ciqual.ts                              ouverture de la base embarquée (expo-sqlite)     (T3)
firebase/firestore.rules (+ test)                   règles foods, foodEntries, favoriteMeals, days   (T4)
src/modules/nutrition/adapters/firestore*.ts (+emulator tests)                                       (T4)
src/modules/nutrition/ui/MealsScreen.tsx (+test), EntryActions.tsx                                   (T5)
src/modules/nutrition/ui/AddFoodScreen.tsx, FoodDetail.tsx, FoodForm.tsx, … (+tests)                 (T6)
src/modules/nutrition/index.ts                      API publique du module                           (T2, T5, T6)
src/modules/today/… DayTotals, gauges, TodayScreen   Calories, Protéines, « + Repas »                (T7)
src/composition.ts                                  la nutrition branchée dans l'application         (T7)
app/(app)/_layout.tsx                               AppProvider et pile du groupe (app)              (T7)
app/(app)/(tabs)/index.tsx                          onglet Aujourd'hui                               (T7)
app/(app)/(tabs)/repas.tsx                          onglet Repas                                     (T7)
app/(app)/add-food.tsx                              modale « Ajouter un aliment »                    (T7)
README.md                                           vérifications sur le téléphone                   (T7)
```

---

### Task 1: Conversion Ciqual → base SQLite embarquée

**Files:**
- Create: `src/modules/nutrition/domain/normalize.ts`
- Test: `src/modules/nutrition/domain/normalize.test.ts`
- Create: `scripts/ciqual/convert.ts`
- Test: `scripts/ciqual/convert.test.ts`
- Create: `scripts/build-ciqual.ts`
- Create: `assets/ciqual.db` (généré)
- Modify: `package.json` (scripts `build:ciqual` et `test`), `tsconfig.json` (`allowImportingTsExtensions`), `README.md` (section « Données alimentaires »)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `normalizeSearch(text: string): string` (minuscules, sans accents, `œ`→`oe`, tout sauf `a-z0-9` devient un espace, espaces réduits et rognés).
  - `convertCiqual(alimXml: string, compoXml: string): CiqualFood[]` avec `CiqualFood = { id: string; name: string; search: string; state: 'raw' | 'cooked' | 'other'; kcal: number; protein: number; carbs: number; fat: number }`.
  - `assets/ciqual.db` : table `foods(id TEXT PRIMARY KEY, name, search, state CHECK in ('raw','cooked','other'), kcal REAL, protein REAL, carbs REAL, fat REAL)` (valeurs pour 100 g) et table `meta(key, value)` (`source`, `version`, `licence`, `citation`).
  - `npm run build:ciqual -- <dossier contenant alim.xml et compo.xml> <version> [sortie]`.

- [ ] **Step 1: Écrire les tests qui échouent**

`src/modules/nutrition/domain/normalize.test.ts` :

```ts
import { normalizeSearch } from './normalize';

test.each([
  ['Œuf à la coque', 'oeuf a la coque'],
  ['Pomme de terre, sans peau, crue', 'pomme de terre sans peau crue'],
  ["Boeuf, steak haché 5% MG cuit", 'boeuf steak hache 5 mg cuit'],
  ['  Crème   brûlée  ', 'creme brulee'],
  ['', ''],
])('%s → %s', (input, expected) => {
  expect(normalizeSearch(input)).toBe(expected);
});
```

`scripts/ciqual/convert.test.ts` :

```ts
import { convertCiqual } from './convert';

const alim = (rows: [string, string][]) =>
  `<TABLE>${rows.map(([id, name]) => `<ALIM><alim_code> ${id} </alim_code><alim_nom_fr> ${name} </alim_nom_fr></ALIM>`).join('')}</TABLE>`;

const compo = (rows: [string, string, string][]) =>
  `<TABLE>${rows
    .map(([id, code, t]) => `<COMPO><alim_code> ${id} </alim_code><const_code> ${code} </const_code><teneur> ${t} </teneur><min missing=" " /></COMPO>`)
    .join('')}</TABLE>`;

const KCAL = '328';
const PROTEIN = '25003';
const CARBS = '31000';
const FAT = '40000';
const ALCOHOL = '60000';

const byId = (foods: ReturnType<typeof convertCiqual>) => Object.fromEntries(foods.map((f) => [f.id, f]));

test('reads the four macros with decimal commas and decodes entities in the name', () => {
  const foods = convertCiqual(
    alim([['9100', 'Riz blanc, cru'], ['4003', 'Pomme de terre, bouillie/cuite à l&apos;eau']]),
    compo([
      ['9100', KCAL, '354'], ['9100', PROTEIN, '7,1'], ['9100', CARBS, '78,5'], ['9100', FAT, '0,6'],
      ['4003', KCAL, '80'], ['4003', PROTEIN, '2'], ['4003', CARBS, '16'], ['4003', FAT, '0,1'],
    ]),
  );
  expect(byId(foods)['9100']).toEqual({
    id: '9100', name: 'Riz blanc, cru', search: 'riz blanc cru', state: 'raw', kcal: 354, protein: 7.1, carbs: 78.5, fat: 0.6,
  });
  expect(byId(foods)['4003'].name).toBe("Pomme de terre, bouillie/cuite à l'eau");
  expect(byId(foods)['4003'].state).toBe('cooked');
});

test('"traces" and "< x" count as 0, "-" counts as 0 for protein, carbs and fat', () => {
  const [food] = convertCiqual(
    alim([['1', 'Eau minérale']]),
    compo([['1', KCAL, '0'], ['1', PROTEIN, '&lt; 0,5'], ['1', CARBS, 'traces'], ['1', FAT, '-']]),
  );
  expect(food).toMatchObject({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test('estimates the energy with Atwater factors when Ciqual gives none but every macro is known', () => {
  const [food] = convertCiqual(
    alim([['2', 'Pain maison']]),
    compo([['2', KCAL, '-'], ['2', PROTEIN, '20'], ['2', CARBS, '10'], ['2', FAT, '5'], ['2', ALCOHOL, '0']]),
  );
  expect(food.kcal).toBe(165); // 4 × 20 + 4 × 10 + 9 × 5
});

test('drops a food whose energy is missing and some macro is undetermined (a floor is not an estimate)', () => {
  const macros = [PROTEIN, CARBS, FAT, ALCOHOL];
  for (const undetermined of macros) {
    const rows = macros.map((code): [string, string, string] => ['2', code, code === undetermined ? '-' : '5']);
    expect(convertCiqual(alim([['2', 'Boeuf, jarret cru']]), compo([['2', KCAL, '-'], ...rows]))).toEqual([]);
  }
});

test('"traces" and "< x" count as known zeros, and decimals are rounded to 0.1', () => {
  const [food] = convertCiqual(
    alim([['3', 'Huile aromatisée']]),
    compo([['3', KCAL, '-'], ['3', PROTEIN, 'traces'], ['3', CARBS, '&lt; 0,5'], ['3', FAT, '0'], ['3', ALCOHOL, '0']]),
  );
  expect(food).toMatchObject({ kcal: 0, protein: 0, carbs: 0, fat: 0 }); // kept: they are determined, not unknown
  const [rounded] = convertCiqual(
    alim([['4', 'X']]),
    compo([['4', KCAL, '100,04'], ['4', PROTEIN, '7,38'], ['4', CARBS, '12,34'], ['4', FAT, '0,56']]),
  );
  expect(rounded).toMatchObject({ kcal: 100, protein: 7.4, carbs: 12.3, fat: 0.6 });
});

test('an unrecognised or blank teneur throws instead of becoming a guess', () => {
  const convert = (teneur: string) => convertCiqual(alim([['6', 'X']]), compo([['6', FAT, teneur]]));
  expect(() => convert('abc')).toThrow('unrecognised Ciqual value: "abc"');
  expect(() => convert('')).toThrow('unrecognised Ciqual value: ""');
});

test('names come out in NFC, entities decoded and repeated spaces collapsed', () => {
  const nfd = 'Sardine,  grillée/poêlée à l&apos;huile'.normalize('NFD');
  const [food] = convertCiqual(alim([['5', nfd]]), compo([['5', KCAL, '100']]));
  expect(food.name).toBe("Sardine, grillée/poêlée à l'huile");
  expect(food.state).toBe('cooked');
});

test('counts alcohol (7 kcal/g) in the estimate', () => {
  const [food] = convertCiqual(
    alim([['3', 'Gin']]),
    compo([['3', KCAL, '-'], ['3', PROTEIN, '0'], ['3', CARBS, '0'], ['3', FAT, '0'], ['3', ALCOHOL, '40']]),
  );
  expect(food.kcal).toBe(280);
});

test('drops a food with no energy and no macro at all', () => {
  const foods = convertCiqual(
    alim([['4', 'Mystère']]),
    compo([['4', KCAL, '-'], ['4', PROTEIN, '-'], ['4', CARBS, '-'], ['4', FAT, '-']]),
  );
  expect(foods).toEqual([]);
});

test.each([
  ['Carotte, crue', 'raw'],
  ['Poulet, filet sans peau grillé/poêlé', 'cooked'],
  ['Pâtes sèches, standard, cuites, sans sel ajouté', 'cooked'],
  ['Riz blanc, précuit, cuit, sans sel ajouté', 'cooked'],
  ['Pomme de terre noisette, surgelée, à cuire', 'other'],
  ['Oeuf cru ou cuit', 'other'],
  ['Banane, pulpe, crue', 'raw'],
  ['Yaourt nature', 'other'],
])('%s is %s', (name, state) => {
  const [food] = convertCiqual(alim([['1', name]]), compo([['1', KCAL, '100']]));
  expect(food.state).toBe(state);
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run: `npx jest src/modules/nutrition/domain scripts/ciqual`
Expected: FAIL, « Cannot find module './normalize' » et « './convert' ».

- [ ] **Step 3: Écrire l'implémentation**

`src/modules/nutrition/domain/normalize.ts` :

```ts
/** Lower-case, accent-free text for matching: "Œuf à la coque" → "oeuf a la coque". */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
```

`scripts/ciqual/convert.ts` :

```ts
// Run by Node 24 (type stripping), so imports carry their .ts extension.
import { normalizeSearch } from '../../src/modules/nutrition/domain/normalize.ts';

export type CiqualFood = {
  id: string;
  name: string;
  search: string;
  state: 'raw' | 'cooked' | 'other';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Ciqual 2025 constituent codes (const_*.xml).
const KCAL = '328'; // Energie, Règlement UE N° 1169/2011 (kcal/100 g)
const PROTEIN = '25003'; // Protéines, N x 6.25 (g/100 g)
const CARBS = '31000'; // Glucides (g/100 g)
const FAT = '40000'; // Lipides (g/100 g)
const ALCOHOL = '60000'; // Alcool (éthanol) (g/100 g)
const WANTED = new Set([KCAL, PROTEIN, CARBS, FAT, ALCOHOL]);

// Both files list a food's fields in this order; convertCiqual's caller checks the count.
const ALIM = /<ALIM>\s*<alim_code>\s*(\d+)\s*<\/alim_code>\s*<alim_nom_fr>\s*([\s\S]*?)\s*<\/alim_nom_fr>/g;
const COMPO = /<COMPO>\s*<alim_code>\s*(\d+)\s*<\/alim_code>\s*<const_code>\s*(\d+)\s*<\/const_code>\s*<teneur>\s*([\s\S]*?)\s*<\/teneur>/g;

const ENTITIES: Record<string, string> = { apos: "'", quot: '"', lt: '<', gt: '>', amp: '&' };
const decode = (s: string) => s.replace(/&(apos|quot|lt|gt|amp);/g, (_, e: string) => ENTITIES[e]);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** A teneur as a number: "12,5" → 12.5, "traces" and "< 0,5" → 0, "-" (not determined) → undefined. Anything else throws. */
function amount(teneur: string): number | undefined {
  const t = decode(teneur).trim();
  if (t === '-') return undefined;
  if (t === 'traces' || t.startsWith('<')) return 0;
  const n = Number(t.replace(',', '.'));
  // A blank or unknown form would be silently wrong: a format change must be loud.
  if (t === '' || !Number.isFinite(n)) throw new Error(`unrecognised Ciqual value: "${teneur}"`);
  return n;
}

// \b ignores accents, so letters are delimited explicitly.
const word = (alternatives: string) => new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, 'u');
const RAW = word('cru|crue|crus|crues');
const COOKED = word(
  'cuit|cuite|cuits|cuites|bouilli|bouillie|bouillis|bouillies|grillé|grillée|grillés|grillées|rôti|rôtie|rôtis|rôties|' +
    'poêlé|poêlée|poêlés|poêlées|frit|frite|frits|frites|braisé|braisée|braisés|braisées|vapeur|sauté|sautée|sautés|sautées',
);

/** Ciqual does not link a raw food to its cooked twin: the state comes from the name. Both words → other. */
function stateOf(name: string): CiqualFood['state'] {
  const s = name.toLowerCase();
  const raw = RAW.test(s);
  const cooked = COOKED.test(s);
  if (raw === cooked) return 'other';
  return raw ? 'raw' : 'cooked';
}

/**
 * Energy in kcal/100 g: Ciqual's own, else Atwater (4/4/9, alcohol 7) but only when all four are determined:
 * an undetermined value counted as 0 would understate the calories (a floor, not an estimate).
 */
function energy(v: Record<string, number | undefined>): number | undefined {
  if (v[KCAL] !== undefined) return v[KCAL];
  const [p, c, f, a] = [v[PROTEIN], v[CARBS], v[FAT], v[ALCOHOL]];
  if (p === undefined || c === undefined || f === undefined || a === undefined) return undefined;
  return 4 * p + 4 * c + 9 * f + 7 * a;
}

export function convertCiqual(alimXml: string, compoXml: string): CiqualFood[] {
  const values = new Map<string, Record<string, number | undefined>>();
  for (const [, id, code, teneur] of compoXml.matchAll(COMPO)) {
    if (!WANTED.has(code)) continue;
    const v = values.get(id) ?? {};
    v[code] = amount(teneur);
    values.set(id, v);
  }
  const foods: CiqualFood[] = [];
  for (const [, id, rawName] of alimXml.matchAll(ALIM)) {
    const v = values.get(id) ?? {};
    const kcal = energy(v);
    if (kcal === undefined) continue;
    const name = decode(rawName).replace(/\s+/g, ' ').normalize('NFC');
    foods.push({
      id,
      name,
      search: normalizeSearch(name),
      state: stateOf(name),
      kcal: round1(kcal),
      protein: round1(v[PROTEIN] ?? 0),
      carbs: round1(v[CARBS] ?? 0),
      fat: round1(v[FAT] ?? 0),
    });
  }
  return foods;
}
```

`scripts/build-ciqual.ts` :

```ts
// Builds the read-only food database shipped with the app from the Anses Ciqual XML files:
//   npm run build:ciqual -- <dir with alim.xml and compo.xml> <version, e.g. 2025-11-03> [output]
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { convertCiqual } from './ciqual/convert.ts';

const [dir, version, out = 'assets/ciqual.db'] = process.argv.slice(2);
if (!dir || !version) {
  console.error('usage: build-ciqual <dir with alim.xml and compo.xml> <version> [output]');
  process.exit(1);
}

const read = (file: string) => readFileSync(join(dir, file), 'utf8');
const foods = convertCiqual(read('alim.xml'), read('compo.xml'));
if (foods.length < 3000) throw new Error(`unexpected Ciqual format: only ${foods.length} foods converted`);

// Built beside the target and renamed over it: a failure never leaves a broken database behind.
const tmp = `${out}.tmp`;
rmSync(tmp, { force: true });
const db = new DatabaseSync(tmp);
db.exec(`
  CREATE TABLE foods (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, search TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('raw', 'cooked', 'other')),
    kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  BEGIN;
`);
const insert = db.prepare('INSERT INTO foods VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
for (const f of foods) insert.run(f.id, f.name, f.search, f.state, f.kcal, f.protein, f.carbs, f.fat);
const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
meta.run('source', 'Anses, Table de composition nutritionnelle des aliments Ciqual 2025 (doi:10.57745/RDMHWY)');
meta.run('version', version);
meta.run('licence', 'Licence Ouverte Etalab 2.0');
meta.run('citation', `Anses. 2025. Table de composition nutritionnelle des aliments Ciqual (version ${version}).`);
db.exec('COMMIT; VACUUM;');
db.close();
renameSync(tmp, out);
console.log(`${out}: ${foods.length} foods`);
```

Dans `package.json`, remplacer les scripts `lint` (il couvre aussi `scripts/`) et `test`, et ajouter `build:ciqual` :

```json
    "lint": "expo lint src app scripts",
    "test": "NODE_OPTIONS=--disable-warning=ExperimentalWarning jest",
    "build:ciqual": "NODE_NO_WARNINGS=1 node scripts/build-ciqual.ts",
```

Dans `tsconfig.json`, ajouter `"allowImportingTsExtensions": true` à `compilerOptions` (le script importe `./ciqual/convert.ts`).

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `npx jest src/modules/nutrition/domain scripts/ciqual && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS (2 suites, 22 tests : 5 pour `normalize`, 17 pour `convert`), aucune erreur.

- [ ] **Step 5: Générer la base et vérifier son contenu**

Run :

```bash
npm run build:ciqual -- /private/tmp/claude-501/-Users-nugah-Desktop-42-Genki/0075675a-187a-4db4-9845-65f77c31d0a1/scratchpad/ciqual-data 2025-11-03
ls -l assets/ciqual.db
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('assets/ciqual.db', { readOnly: true });
console.log(db.prepare('select state, count(*) n from foods group by state').all());
console.log(db.prepare(\"select id, name, kcal, protein, carbs, fat from foods where id in ('9100','6001','22000')\").all());
console.log(db.prepare('select * from meta').all());"
```

Expected : `assets/ciqual.db: 3400 foods` (3 341 avec énergie Ciqual + 59 estimées) ; fichier de moins de 1 Mo ; état `raw` 622, `cooked` 541, `other` 2 237 ; « Riz blanc, cru » avec environ 350 kcal. Noter N dans le rapport.

- [ ] **Step 6: Documenter les données dans le README**

Ajouter à `README.md` une section « Données alimentaires » : source (table Ciqual 2025 de l'Anses, `doi:10.57745/RDMHWY`, licence Etalab 2.0, citation « Anses. 2025. Ciqual French food composition table »), fichiers d'entrée (`alim_*.xml` et `compo_*.xml`, téléchargeables sur `entrepot.recherche.data.gouv.fr`), règles de conversion (résumées depuis « Décisions de périmètre »), commande `npm run build:ciqual -- <dossier> <version>`, et le fait que `assets/ciqual.db` est committée (la régénérer change l'application : refaire un build natif ; modifier `normalizeSearch` impose aussi de la régénérer, car la colonne `search` en garde le résultat).

- [ ] **Step 7: Vérifier l'ensemble puis commit**

Run: `npm test && npm run typecheck && npm run lint && npm run lint:deps`
Expected: tout passe, sortie sans avertissement.

```bash
git add src/modules/nutrition scripts assets/ciqual.db package.json tsconfig.json README.md
git commit -m "feat: convert the Ciqual 2025 table into the embedded food database (M2)"
```

---

### Task 2: Domaine, ports, cas d'usage et dépôts en mémoire du module nutrition

**Files:**
- Create: `src/modules/nutrition/domain/macros.ts`, `meal.ts`, `food.ts` (+ tests `macros.test.ts`, `meal.test.ts`, `food.test.ts`)
- Create: `src/modules/nutrition/application/ports.ts`
- Create: `src/modules/nutrition/application/mealUseCases.ts` (+ `mealUseCases.test.ts`), `foodUseCases.ts` (+ `foodUseCases.test.ts`)
- Create: `src/modules/nutrition/adapters/inMemoryFoodEntryRepository.ts`, `inMemoryFavoriteMealRepository.ts`, `inMemoryFoodRepository.ts`, `inMemoryFoodCatalog.ts`
- Create: `src/modules/nutrition/index.ts`

**Interfaces:**
- Consumes: `dayKey`, `Clock` de `@/shared/clock` ; `normalizeSearch` de `domain/normalize` (tâche 1).
- Produces (exacts, les tâches 3 à 7 s'y appuient) :
  - `domain/macros.ts` : `Macros = { kcal: number; protein: number; carbs: number; fat: number }`, `ZERO_MACROS`, `macrosFor(per100g: Macros, grams: number): Macros`, `scaleMacros(macros: Macros, from: number, to: number): Macros`, `sumMacros(list: Macros[]): Macros`, `subtractMacros(a: Macros, b: Macros): Macros` (tout arrondi à 0,1).
  - `domain/meal.ts` : `MEALS = ['breakfast','lunch','dinner','snack'] as const`, `Meal`, `defaultMeal(hour: number): Meal`.
  - `domain/food.ts` : `FoodState`, `FoodRef`, `Portion`, `Food`, `FoodInput = Omit<Food, 'ref'>`, `FoodEntry`, `NewFoodEntry = Omit<FoodEntry, 'id'>`, `FavoriteItem`, `FavoriteMeal`, `NewFavoriteMeal = Omit<FavoriteMeal, 'id'>`, `RecentFood = { ref: FoodRef; name: string; grams: number }`, `validateFood(food: FoodInput): string | null`, `matchCustom(foods: Food[], query: string, state?: 'raw' | 'cooked'): Food[]`.
  - `application/ports.ts` :
    - `FoodCatalog { search(query: string, options?: { state?: 'raw' | 'cooked'; limit?: number }): Promise<Food[]>; get(id: string): Promise<Food | undefined> }`
    - `FoodRepository { create(food: FoodInput): Promise<void>; update(id: string, food: FoodInput): Promise<void>; remove(id: string): Promise<void>; observeAll(onNext: (foods: Food[]) => void, onError: (error: Error) => void): () => void }`
    - `FoodEntryRepository { add(entry: NewFoodEntry): Promise<void>; updateGrams(entry: FoodEntry, grams: number, macros: Macros): Promise<void>; remove(entry: FoodEntry): Promise<void>; observeDay(day: string, onNext, onError): () => void; observeRecent(limit: number, onNext, onError): () => void }` (les observateurs reçoivent `FoodEntry[]`, entrées supprimées exclues)
    - `FavoriteMealRepository { create(meal: NewFavoriteMeal): Promise<void>; remove(id: string): Promise<void>; observeAll(onNext: (meals: FavoriteMeal[]) => void, onError): () => void }`
  - `application/mealUseCases.ts` : `mealUseCases({ entries, favorites, clock, timezone })` → `{ logFood(meal: Meal, food: Pick<Food,'ref'|'name'|'per100g'>, grams: number): Promise<void>; changeGrams(entry: FoodEntry, grams: number): Promise<void>; removeEntry(entry: FoodEntry): Promise<void>; observeDay(day, onNext, onError): () => void` (entrées triées de la plus ancienne à la plus récente)`; observeRecent(onNext: (recents: RecentFood[]) => void, onError): () => void; observeFavorites(onNext, onError): () => void; saveFavorite(name: string, entries: FoodEntry[]): Promise<void>; removeFavorite(id: string): Promise<void>; logFavorite(favorite: FavoriteMeal, meal: Meal, resolve: (ref: FoodRef) => Promise<Food | undefined>): Promise<void> }` ; `type MealUseCases = ReturnType<typeof mealUseCases>`.
  - `application/foodUseCases.ts` : `foodUseCases({ catalog, repo })` → `{ searchCatalog(query: string, state?: 'raw' | 'cooked'): Promise<Food[]>; resolve(ref: FoodRef, custom: Food[]): Promise<Food | undefined>; observeCustom(onNext, onError): () => void; create(food: FoodInput): Promise<void>; update(id: string, food: FoodInput): Promise<void>; remove(id: string): Promise<void> }` ; `type FoodUseCases`.
  - Dépôts en mémoire : `inMemoryFoodEntryRepository(): FoodEntryRepository & { entries: FoodEntry[] }`, `inMemoryFavoriteMealRepository(): FavoriteMealRepository`, `inMemoryFoodRepository(): FoodRepository`, `inMemoryFoodCatalog(foods: Food[]): FoodCatalog`.
  - `index.ts` : exporte `mealUseCases`, `foodUseCases`, `type MealUseCases`, `type FoodUseCases`, les quatre dépôts en mémoire, `MEALS`, `defaultMeal`, `type Meal`, `type Food` (les écrans des tâches 5 à 7 sont ajoutés aux exports par ces tâches).

- [ ] **Step 1: Écrire les tests du domaine qui échouent**

`src/modules/nutrition/domain/macros.test.ts` :

```ts
import { macrosFor, scaleMacros, subtractMacros, sumMacros } from './macros';

const rice = { kcal: 354, protein: 7.1, carbs: 78.5, fat: 0.6 };

test('macrosFor scales per-100 g values to the quantity, rounded to 0.1', () => {
  expect(macrosFor(rice, 200)).toEqual({ kcal: 708, protein: 14.2, carbs: 157, fat: 1.2 });
  expect(macrosFor(rice, 33)).toEqual({ kcal: 116.8, protein: 2.3, carbs: 25.9, fat: 0.2 });
});

test('scaleMacros rescales an entry from its own frozen values, not from the food', () => {
  expect(scaleMacros({ kcal: 708, protein: 14.2, carbs: 157, fat: 1.2 }, 200, 100)).toEqual({ kcal: 354, protein: 7.1, carbs: 78.5, fat: 0.6 });
});

test('sumMacros adds up and subtractMacros takes away, without float noise', () => {
  const a = { kcal: 0.1, protein: 0.1, carbs: 0.1, fat: 0.1 };
  const b = { kcal: 0.2, protein: 0.2, carbs: 0.2, fat: 0.2 };
  expect(sumMacros([a, b])).toEqual({ kcal: 0.3, protein: 0.3, carbs: 0.3, fat: 0.3 });
  expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  expect(subtractMacros(b, a)).toEqual(a);
});
```

`src/modules/nutrition/domain/meal.test.ts` :

```ts
import { defaultMeal, MEALS } from './meal';

test('the four meals, in day order', () => {
  expect(MEALS).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
});

test.each([
  [3.9, 'snack'],
  [4, 'breakfast'],
  [10.4, 'breakfast'],
  [10.5, 'lunch'],
  [14.9, 'lunch'],
  [15, 'snack'],
  [17.9, 'snack'],
  [18, 'dinner'],
  [23.9, 'dinner'],
])('at %s h the default meal is %s', (hour, meal) => {
  expect(defaultMeal(hour)).toBe(meal);
});
```

`src/modules/nutrition/domain/food.test.ts` :

```ts
import { matchCustom, validateFood, type Food, type FoodInput } from './food';

const input = (over: Partial<FoodInput> = {}): FoodInput => ({
  name: 'Pain de mie complet',
  state: 'other',
  per100g: { kcal: 250, protein: 9, carbs: 45, fat: 4 },
  portions: [{ label: '1 tranche', grams: 30 }],
  ...over,
});

describe('validateFood', () => {
  test('accepts a sound food', () => expect(validateFood(input())).toBeNull());

  test.each<[string, Partial<FoodInput>]>([
    ['an empty name', { name: '   ' }],
    ['a name over 100 characters', { name: 'x'.repeat(101) }],
    ['a negative value', { per100g: { kcal: 100, protein: -1, carbs: 0, fat: 0 } }],
    ['a NaN value', { per100g: { kcal: Number.NaN, protein: 0, carbs: 0, fat: 0 } }],
    ['more than 900 kcal per 100 g', { per100g: { kcal: 901, protein: 0, carbs: 0, fat: 0 } }],
    ['macros above 100 g per 100 g', { per100g: { kcal: 400, protein: 60, carbs: 60, fat: 0 } }],
    ['21 portions', { portions: Array.from({ length: 21 }, (_, i) => ({ label: `p${i}`, grams: 10 })) }],
    ['a portion without a name', { portions: [{ label: ' ', grams: 10 }] }],
    ['a portion of 0 g', { portions: [{ label: 'rien', grams: 0 }] }],
    ['a portion over 5 000 g', { portions: [{ label: 'énorme', grams: 5001 }] }],
  ])('rejects %s', (_, over) => {
    expect(validateFood(input(over))).toEqual(expect.any(String));
  });
});

describe('matchCustom', () => {
  const food = (id: string, name: string, state: Food['state'] = 'other'): Food => ({
    ref: { type: 'custom', id }, name, state, per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, portions: [],
  });
  const foods = [food('1', 'Œuf dur maison'), food('2', 'Riz basmati cuit', 'cooked'), food('3', 'Riz basmati cru', 'raw')];

  test('ignores accents, case and ligatures, and needs every term', () => {
    expect(matchCustom(foods, 'oeuf').map((f) => f.ref.id)).toEqual(['1']);
    expect(matchCustom(foods, 'RIZ cuit').map((f) => f.ref.id)).toEqual(['2']);
  });

  test('filters by state and returns nothing for a blank query', () => {
    expect(matchCustom(foods, 'riz', 'raw').map((f) => f.ref.id)).toEqual(['3']);
    expect(matchCustom(foods, '  ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Écrire les tests des cas d'usage qui échouent**

`src/modules/nutrition/application/mealUseCases.test.ts` :

```ts
import { inMemoryFavoriteMealRepository } from '../adapters/inMemoryFavoriteMealRepository';
import { inMemoryFoodEntryRepository } from '../adapters/inMemoryFoodEntryRepository';
import type { Food, FoodEntry } from '../domain/food';
import { mealUseCases } from './mealUseCases';

const rice: Food = {
  ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw',
  per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 }, portions: [],
};
const egg: Food = {
  ref: { type: 'custom', id: 'e1' }, name: 'Oeuf', state: 'other',
  per100g: { kcal: 140, protein: 12, carbs: 1, fat: 10 }, portions: [{ label: '1 œuf', grams: 60 }],
};

function setup(now = '2026-10-24T09:00:00Z') {
  const clock = { now: () => new Date(now) };
  const entries = inMemoryFoodEntryRepository();
  const favorites = inMemoryFavoriteMealRepository();
  const meals = mealUseCases({ entries, favorites, clock, timezone: 'Europe/Paris' });
  return { clock, entries, favorites, meals };
}

const latest = (entries: { entries: FoodEntry[] }) => entries.entries[entries.entries.length - 1];

test('logFood freezes the macros of the quantity and uses the profile-zone day', async () => {
  const { entries, meals } = setup('2026-10-24T22:10:00Z'); // 00:10 in Paris, already the 25th
  await meals.logFood('snack', rice, 200);
  expect(latest(entries)).toMatchObject({
    day: '2026-10-25', meal: 'snack', foodRef: rice.ref, foodName: 'Riz blanc, cru', grams: 200,
    macros: { kcal: 700, protein: 14, carbs: 156, fat: 1.2 },
  });
});

test('changeGrams rescales the frozen macros of the entry', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 200);
  await meals.changeGrams(latest(entries), 100);
  expect(latest(entries)).toMatchObject({ grams: 100, macros: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 } });
});

test('removeEntry takes the entry out of the day', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  await meals.removeEntry(latest(entries));
  expect(entries.entries).toEqual([]);
});

test('the day journal lists entries oldest first', async () => {
  const { clock, meals } = setup();
  const seen: string[][] = [];
  meals.observeDay('2026-10-24', (list) => seen.push(list.map((e) => e.foodName)), () => {});
  await meals.logFood('breakfast', egg, 60);
  clock.now = () => new Date('2026-10-24T10:00:00Z');
  await meals.logFood('lunch', rice, 100);
  expect(seen[seen.length - 1]).toEqual(['Oeuf', 'Riz blanc, cru']);
});

test('recents are the distinct foods of the latest entries, newest first, with their last quantity', async () => {
  const { clock, meals } = setup();
  let recents: { name: string; grams: number }[] = [];
  meals.observeRecent((list) => (recents = list), () => {});
  await meals.logFood('breakfast', egg, 60);
  clock.now = () => new Date('2026-10-24T10:00:00Z');
  await meals.logFood('lunch', rice, 150);
  clock.now = () => new Date('2026-10-24T11:00:00Z');
  await meals.logFood('lunch', egg, 120);
  expect(recents.map((r) => [r.name, r.grams])).toEqual([['Oeuf', 120], ['Riz blanc, cru', 150]]);
});

test('a saved favorite keeps the foods and quantities of the meal, and logs them back', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 150);
  await meals.logFood('lunch', egg, 120);
  await meals.saveFavorite('  Déjeuner habituel ', entries.entries);
  let favorites: { id: string; name: string; items: unknown[] }[] = [];
  meals.observeFavorites((list) => (favorites = list), () => {});
  expect(favorites).toHaveLength(1);
  expect(favorites[0]).toMatchObject({ name: 'Déjeuner habituel' });
  expect(favorites[0].items).toEqual([
    { foodRef: rice.ref, foodName: 'Riz blanc, cru', grams: 150 },
    { foodRef: egg.ref, foodName: 'Oeuf', grams: 120 },
  ]);

  const byRef = new Map([rice, egg].map((f) => [f.ref.id, f]));
  await meals.logFavorite(favorites[0] as never, 'dinner', async (ref) => byRef.get(ref.id));
  expect(entries.entries.filter((e) => e.meal === 'dinner').map((e) => [e.foodName, e.grams, e.macros.kcal])).toEqual([
    ['Riz blanc, cru', 150, 525],
    ['Oeuf', 120, 168],
  ]);
});

test('logFavorite skips foods that no longer exist', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  await meals.saveFavorite('Test', entries.entries);
  let favorite!: Parameters<typeof meals.logFavorite>[0];
  meals.observeFavorites(([first]) => (favorite = first), () => {});
  await meals.logFavorite(favorite, 'dinner', async () => undefined);
  expect(entries.entries.filter((e) => e.meal === 'dinner')).toEqual([]);
});

test('logFavorite starts every write without waiting for the server (offline writes never settle)', async () => {
  const { entries, meals } = setup();
  const add = jest.spyOn(entries, 'add').mockImplementation(() => new Promise(() => {}));
  const favorite = {
    id: 'f1', name: 'Deux', items: [
      { foodRef: rice.ref, foodName: rice.name, grams: 100 },
      { foodRef: egg.ref, foodName: egg.name, grams: 60 },
    ],
  };
  void meals.logFavorite(favorite, 'lunch', async (ref) => (ref.id === '9100' ? rice : egg));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(add).toHaveBeenCalledTimes(2);
});

test('writes reject instead of throwing synchronously', async () => {
  const { entries, meals } = setup();
  jest.spyOn(entries, 'add').mockImplementation(() => {
    throw new Error('boom');
  });
  await expect(meals.logFood('lunch', rice, 100)).rejects.toThrow('boom');
});
```

`src/modules/nutrition/application/foodUseCases.test.ts` :

```ts
import { inMemoryFoodCatalog } from '../adapters/inMemoryFoodCatalog';
import { inMemoryFoodRepository } from '../adapters/inMemoryFoodRepository';
import type { Food, FoodInput } from '../domain/food';
import { foodUseCases } from './foodUseCases';

const ciqualRice: Food = {
  ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw',
  per100g: { kcal: 354, protein: 7, carbs: 78, fat: 0.6 }, portions: [],
};
const input: FoodInput = { name: '  Pain maison ', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 }, portions: [] };

const setup = () => ({ foods: foodUseCases({ catalog: inMemoryFoodCatalog([ciqualRice]), repo: inMemoryFoodRepository() }) });

test('searches the catalog, with an optional state', async () => {
  const { foods } = setup();
  expect(await foods.searchCatalog('riz')).toEqual([ciqualRice]);
  expect(await foods.searchCatalog('riz', 'cooked')).toEqual([]);
});

test('create trims and validates; an invalid food is rejected before any write', async () => {
  const { foods } = setup();
  await foods.create(input);
  let custom: Food[] = [];
  foods.observeCustom((list) => (custom = list), () => {});
  expect(custom.map((f) => f.name)).toEqual(['Pain maison']);
  await expect(foods.create({ ...input, name: ' ' })).rejects.toThrow(/nom/i);
  expect(custom).toHaveLength(1);
});

test('update and remove change the custom list', async () => {
  const { foods } = setup();
  await foods.create(input);
  let custom: Food[] = [];
  foods.observeCustom((list) => (custom = list), () => {});
  await foods.update(custom[0].ref.id, { ...input, name: 'Pain de mie' });
  expect(custom[0].name).toBe('Pain de mie');
  await foods.remove(custom[0].ref.id);
  expect(custom).toEqual([]);
});

test('resolve finds a Ciqual food in the catalog and a custom one in the list the caller holds', async () => {
  const { foods } = setup();
  const custom: Food = { ...ciqualRice, ref: { type: 'custom', id: 'c1' }, name: 'Perso' };
  expect(await foods.resolve({ type: 'ciqual', id: '9100' }, [])).toEqual(ciqualRice);
  expect(await foods.resolve({ type: 'custom', id: 'c1' }, [custom])).toEqual(custom);
  expect(await foods.resolve({ type: 'custom', id: 'gone' }, [custom])).toBeUndefined();
});
```

- [ ] **Step 3: Lancer les tests et vérifier qu'ils échouent**

Run: `npx jest src/modules/nutrition`
Expected: FAIL, modules introuvables.

- [ ] **Step 4: Écrire le domaine**

`src/modules/nutrition/domain/macros.ts` :

```ts
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const round1 = (n: number) => Math.round(n * 10) / 10;
const map = (m: Macros, f: (n: number) => number): Macros => ({ kcal: f(m.kcal), protein: f(m.protein), carbs: f(m.carbs), fat: f(m.fat) });

/** Macros of `grams` of a food given per 100 g, rounded to 0.1: frozen into the entry (spec §4 rule 5). */
export function macrosFor(per100g: Macros, grams: number): Macros {
  return map(per100g, (n) => round1((n * grams) / 100));
}

/** The same entry at another quantity, from its own frozen values: never from the food's current ones. */
export function scaleMacros(macros: Macros, from: number, to: number): Macros {
  return map(macros, (n) => round1((n * to) / from));
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce((sum, m) => ({ kcal: round1(sum.kcal + m.kcal), protein: round1(sum.protein + m.protein), carbs: round1(sum.carbs + m.carbs), fat: round1(sum.fat + m.fat) }), ZERO_MACROS);
}

/** `a − b`, rounded: the delta a day total moves by when an entry changes. */
export function subtractMacros(a: Macros, b: Macros): Macros {
  return { kcal: round1(a.kcal - b.kcal), protein: round1(a.protein - b.protein), carbs: round1(a.carbs - b.carbs), fat: round1(a.fat - b.fat) };
}
```

`src/modules/nutrition/domain/meal.ts` :

```ts
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

/** The meal a food is most likely for at this hour (profile time zone): small hours and mid-afternoon are snacks. */
export function defaultMeal(hour: number): Meal {
  if (hour < 4) return 'snack';
  if (hour < 10.5) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}
```

`src/modules/nutrition/domain/food.ts` :

```ts
import type { Macros } from './macros';
import type { Meal } from './meal';
import { normalizeSearch } from './normalize';

export type FoodState = 'raw' | 'cooked' | 'other';
export type FoodRef = { type: 'ciqual' | 'custom'; id: string };
export type Portion = { label: string; grams: number };
export type Food = { ref: FoodRef; name: string; state: FoodState; per100g: Macros; portions: Portion[] };
/** What the user types to create or edit a custom food. */
export type FoodInput = Omit<Food, 'ref'>;

export type FoodEntry = {
  id: string;
  day: string;
  meal: Meal;
  foodRef: FoodRef;
  foodName: string;
  grams: number;
  /** Frozen when the entry was logged (spec §4 rule 5). */
  macros: Macros;
  createdAt: Date;
};
export type NewFoodEntry = Omit<FoodEntry, 'id'>;

export type FavoriteItem = { foodRef: FoodRef; foodName: string; grams: number };
/** A "repas type": a few foods with quantities, logged back in one tap. */
export type FavoriteMeal = { id: string; name: string; items: FavoriteItem[] };
export type NewFavoriteMeal = Omit<FavoriteMeal, 'id'>;

export type RecentFood = { ref: FoodRef; name: string; grams: number };

/** A French message for the first problem with a custom food, or null. Bounds mirror the Firestore rules. */
export function validateFood(food: FoodInput): string | null {
  const name = food.name.trim();
  if (name.length === 0 || name.length > 100) return 'Le nom doit faire entre 1 et 100 caractères.';
  const values = Object.values(food.per100g);
  if (!values.every(Number.isFinite) || values.some((n) => n < 0)) return 'Les valeurs nutritionnelles doivent être des nombres positifs.';
  const { kcal, protein, carbs, fat } = food.per100g;
  if (kcal > 900) return 'Plus de 900 kcal pour 100 g n’est pas possible.';
  if (protein > 100 || carbs > 100 || fat > 100 || protein + carbs + fat > 100.5) return 'Protéines, glucides et lipides dépassent 100 g pour 100 g.';
  if (food.portions.length > 20) return '20 portions au maximum.';
  if (food.portions.some((p) => p.label.trim().length === 0 || !(p.grams > 0 && p.grams <= 5000))) {
    return 'Chaque portion a un nom et un poids entre 0 et 5 000 g.';
  }
  return null;
}

/** The custom foods matching every term of `query` (accents and case ignored), by name. */
export function matchCustom(foods: Food[], query: string, state?: 'raw' | 'cooked'): Food[] {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [];
  return foods
    .filter((f) => (!state || f.state === state) && terms.every((t) => normalizeSearch(f.name).includes(t)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
```

- [ ] **Step 5: Écrire les ports, les cas d'usage et les dépôts en mémoire**

`src/modules/nutrition/application/ports.ts` :

```ts
import type { FavoriteMeal, Food, FoodEntry, FoodInput, NewFavoriteMeal, NewFoodEntry } from '../domain/food';
import type { Macros } from '../domain/macros';

type Observe<T> = (onNext: (value: T) => void, onError: (error: Error) => void) => () => void;

/** The embedded Ciqual table: read-only, instant, offline. */
export interface FoodCatalog {
  search(query: string, options?: { state?: 'raw' | 'cooked'; limit?: number }): Promise<Food[]>;
  get(id: string): Promise<Food | undefined>;
}

/** The user's own foods. Writes settle once the server has them; observers see them at once. */
export interface FoodRepository {
  create(food: FoodInput): Promise<void>;
  update(id: string, food: FoodInput): Promise<void>;
  /** Soft delete. */
  remove(id: string): Promise<void>;
  observeAll: Observe<Food[]>;
}

export interface FoodEntryRepository {
  /** Also adds the entry's macros to the day totals. */
  add(entry: NewFoodEntry): Promise<void>;
  /** Also moves the day totals by the difference between `macros` and the entry's current ones. */
  updateGrams(entry: FoodEntry, grams: number, macros: Macros): Promise<void>;
  /** Soft delete; also takes the entry's macros off the day totals. */
  remove(entry: FoodEntry): Promise<void>;
  /** Live entries of `day`, deleted ones excluded. */
  observeDay(day: string, onNext: (entries: FoodEntry[]) => void, onError: (error: Error) => void): () => void;
  /** The latest live entries, newest first. */
  observeRecent(limit: number, onNext: (entries: FoodEntry[]) => void, onError: (error: Error) => void): () => void;
}

export interface FavoriteMealRepository {
  create(meal: NewFavoriteMeal): Promise<void>;
  remove(id: string): Promise<void>;
  observeAll: Observe<FavoriteMeal[]>;
}
```

`src/modules/nutrition/application/mealUseCases.ts` :

```ts
import { dayKey, type Clock } from '@/shared/clock';
import type { FavoriteMeal, Food, FoodEntry, FoodRef, RecentFood } from '../domain/food';
import { macrosFor, scaleMacros } from '../domain/macros';
import type { Meal } from '../domain/meal';
import type { FavoriteMealRepository, FoodEntryRepository } from './ports';

const RECENT_WINDOW = 50;
const RECENT_SHOWN = 20;
const oldestFirst = (a: FoodEntry, b: FoodEntry) => a.createdAt.getTime() - b.createdAt.getTime();

export function mealUseCases(deps: { entries: FoodEntryRepository; favorites: FavoriteMealRepository; clock: Clock; timezone: string }) {
  const { entries, favorites, clock, timezone } = deps;

  // Writes are never awaited one after the other: offline, a write only settles once the server has it.
  const log = (meal: Meal, food: Pick<Food, 'ref' | 'name' | 'per100g'>, grams: number, now: Date) =>
    entries.add({ day: dayKey(now, timezone), meal, foodRef: food.ref, foodName: food.name, grams, macros: macrosFor(food.per100g, grams), createdAt: now });

  return {
    async logFood(meal: Meal, food: Pick<Food, 'ref' | 'name' | 'per100g'>, grams: number) {
      return log(meal, food, grams, clock.now());
    },
    async changeGrams(entry: FoodEntry, grams: number) {
      return entries.updateGrams(entry, grams, scaleMacros(entry.macros, entry.grams, grams));
    },
    async removeEntry(entry: FoodEntry) {
      return entries.remove(entry);
    },
    /** The day's entries, oldest first. */
    observeDay(day: string, onNext: (list: FoodEntry[]) => void, onError: (error: Error) => void) {
      return entries.observeDay(day, (list) => onNext([...list].sort(oldestFirst)), onError);
    },
    /** The distinct foods of the latest entries, newest first, each with its last quantity. */
    observeRecent(onNext: (recents: RecentFood[]) => void, onError: (error: Error) => void) {
      return entries.observeRecent(
        RECENT_WINDOW,
        (list) => {
          const seen = new Set<string>();
          const recents: RecentFood[] = [];
          for (const e of [...list].sort((a, b) => oldestFirst(b, a))) {
            const key = `${e.foodRef.type}:${e.foodRef.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            recents.push({ ref: e.foodRef, name: e.foodName, grams: e.grams });
          }
          onNext(recents.slice(0, RECENT_SHOWN));
        },
        onError,
      );
    },
    observeFavorites: favorites.observeAll,
    async saveFavorite(name: string, list: FoodEntry[]) {
      return favorites.create({ name: name.trim(), items: list.map(({ foodRef, foodName, grams }) => ({ foodRef, foodName, grams })) });
    },
    async removeFavorite(id: string) {
      return favorites.remove(id);
    },
    /** Logs every food of the favorite that still exists (looked up through `resolve`) into `meal`. */
    async logFavorite(favorite: FavoriteMeal, meal: Meal, resolve: (ref: FoodRef) => Promise<Food | undefined>) {
      const now = clock.now();
      const foods = await Promise.all(favorite.items.map((item) => resolve(item.foodRef)));
      const writes = favorite.items.flatMap((item, i) => (foods[i] ? [log(meal, foods[i], item.grams, now)] : []));
      await Promise.all(writes);
    },
  };
}

export type MealUseCases = ReturnType<typeof mealUseCases>;
```

`src/modules/nutrition/application/foodUseCases.ts` :

```ts
import type { Food, FoodInput, FoodRef } from '../domain/food';
import { validateFood } from '../domain/food';
import type { FoodCatalog, FoodRepository } from './ports';

export function foodUseCases(deps: { catalog: FoodCatalog; repo: FoodRepository }) {
  const { catalog, repo } = deps;
  const checked = (food: FoodInput): FoodInput => {
    const problem = validateFood(food);
    if (problem) throw new Error(problem);
    return { ...food, name: food.name.trim() };
  };

  return {
    async searchCatalog(query: string, state?: 'raw' | 'cooked') {
      return catalog.search(query, { state });
    },
    /** A food by reference: Ciqual from the catalog, a custom one from the live list the caller holds. */
    async resolve(ref: FoodRef, custom: Food[]): Promise<Food | undefined> {
      return ref.type === 'ciqual' ? catalog.get(ref.id) : custom.find((f) => f.ref.id === ref.id);
    },
    observeCustom: repo.observeAll,
    async create(food: FoodInput) {
      return repo.create(checked(food));
    },
    async update(id: string, food: FoodInput) {
      return repo.update(id, checked(food));
    },
    async remove(id: string) {
      return repo.remove(id);
    },
  };
}

export type FoodUseCases = ReturnType<typeof foodUseCases>;
```

`src/modules/nutrition/adapters/inMemoryFoodEntryRepository.ts` :

```ts
import type { FoodEntryRepository } from '../application/ports';
import type { FoodEntry, NewFoodEntry } from '../domain/food';

/** FoodEntryRepository kept in memory, for tests. `entries` is what it stores. */
export function inMemoryFoodEntryRepository(): FoodEntryRepository & { entries: FoodEntry[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  };

  const repo = {
    entries: [] as FoodEntry[],
    async add(entry: NewFoodEntry) {
      repo.entries = [...repo.entries, { ...entry, id: String(nextId++) }];
      notify();
    },
    async updateGrams(entry: FoodEntry, grams: number, macros: FoodEntry['macros']) {
      repo.entries = repo.entries.map((e) => (e.id === entry.id ? { ...e, grams, macros } : e));
      notify();
    },
    async remove(entry: FoodEntry) {
      repo.entries = repo.entries.filter((e) => e.id !== entry.id);
      notify();
    },
    observeDay(day: string, onNext: (entries: FoodEntry[]) => void) {
      return subscribe(() => onNext(repo.entries.filter((e) => e.day === day)));
    },
    observeRecent(limit: number, onNext: (entries: FoodEntry[]) => void) {
      return subscribe(() => onNext([...repo.entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)));
    },
  };
  return repo;
}
```

Même schéma pour les trois autres (chacun garde son tableau, notifie ses observateurs à chaque écriture, ses méthodes sont `async`, `observeAll` appelle le rappel tout de suite) :
- `inMemoryFavoriteMealRepository(): FavoriteMealRepository` : `create` ajoute `{ ...meal, id: String(nextId++) }`, `remove` filtre par id.
- `inMemoryFoodRepository(): FoodRepository` : `create` ajoute `{ ref: { type: 'custom', id: String(nextId++) }, ...food }`, `update(id, food)` remplace par `{ ref: { type: 'custom', id }, ...food }`, `remove` filtre par `ref.id`.
- `inMemoryFoodCatalog(foods: Food[]): FoodCatalog` : `search(query, { state, limit = 30 })` filtre avec `matchCustom(foods, query, state)` (limité à `limit`) ; `get(id)` cherche par `ref.id`.

`src/modules/nutrition/index.ts` :

```ts
export { inMemoryFavoriteMealRepository } from './adapters/inMemoryFavoriteMealRepository';
export { inMemoryFoodCatalog } from './adapters/inMemoryFoodCatalog';
export { inMemoryFoodEntryRepository } from './adapters/inMemoryFoodEntryRepository';
export { inMemoryFoodRepository } from './adapters/inMemoryFoodRepository';
export { foodUseCases, type FoodUseCases } from './application/foodUseCases';
export { mealUseCases, type MealUseCases } from './application/mealUseCases';
export type { Food } from './domain/food';
export { defaultMeal, MEALS, type Meal } from './domain/meal';
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `npm test && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS (tests du module nutrition : 5 suites de domaine ou d'application plus les anciennes), aucune violation de dépendance (le domaine n'importe que du domaine).

- [ ] **Step 7: Commit**

```bash
git add src/modules/nutrition
git commit -m "feat: nutrition domain, ports, meal and food use cases with in-memory adapters (M2)"
```

---

### Task 3: Catalogue Ciqual (expo-sqlite) et ouverture de la base embarquée

**Files:**
- Create: `src/modules/nutrition/adapters/ciqualCatalog.ts`
- Test: `src/modules/nutrition/adapters/ciqualCatalog.test.ts`
- Create: `src/platform/ciqual.ts`
- Modify: `package.json` (dépendance `expo-sqlite`), `app.json` (seulement si la documentation de `expo-sqlite` SDK 58 l'exige)

**Interfaces:**
- Consumes: `FoodCatalog` (tâche 2), `normalizeSearch`, `assets/ciqual.db` (tâche 1).
- Produces:
  - `type SqlReader = { getAllAsync<T>(sql: string, params: (string | number)[]): Promise<T[]> }` (compatible avec `SQLiteDatabase` d'`expo-sqlite`).
  - `ciqualCatalog(open: () => Promise<SqlReader>): FoodCatalog` (la base est ouverte à la première recherche, puis gardée).
  - `src/platform/ciqual.ts` : `openCiqual(): Promise<SqlReader>` (copie la base embarquée dans le stockage de l'app à la première ouverture, sous un nom contenant la version, puis l'ouvre en lecture).

- [ ] **Step 1: Écrire les tests qui échouent**

`src/modules/nutrition/adapters/ciqualCatalog.test.ts` :

```ts
import { DatabaseSync } from 'node:sqlite';
import { ciqualCatalog, type SqlReader } from './ciqualCatalog';

// The real embedded table, opened read-only through Node's SQLite.
const db = new DatabaseSync('assets/ciqual.db', { readOnly: true });
afterAll(() => db.close());
const reader: SqlReader = {
  getAllAsync: async (sql, params = []) => db.prepare(sql).all(...params) as never,
};
const catalog = ciqualCatalog(async () => reader);

const names = async (query: string, state?: 'raw' | 'cooked') => (await catalog.search(query, { state })).map((f) => f.name);

test('finds foods by name, ignoring accents, case and the œ ligature', async () => {
  expect(await names('RIZ blanc')).toContain('Riz blanc, cru');
  const oeuf = await names('œuf');
  expect(oeuf).toContain('Oeuf cru');
  expect(await names('oeuf')).toEqual(oeuf);
});

test('needs every term and puts names starting with the first term first', async () => {
  const results = await names('poulet filet');
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((n) => /poulet/i.test(n) && /filet/i.test(n))).toBe(true);
  const riz = await names('riz');
  expect(riz[0].toLowerCase().startsWith('riz')).toBe(true);
});

test('the state filter keeps raw or cooked foods only', async () => {
  const cooked = await catalog.search('riz', { state: 'cooked' });
  expect(cooked.length).toBeGreaterThan(0);
  expect(cooked.every((f) => f.state === 'cooked')).toBe(true);
  const raw = await catalog.search('riz', { state: 'raw' });
  expect(raw.map((f) => f.name)).toContain('Riz blanc, cru');
});

test('a blank query finds nothing and the limit is honored', async () => {
  expect(await catalog.search('   ')).toEqual([]);
  expect(await catalog.search('a', { limit: 5 })).toHaveLength(5);
});

test('get returns a food with its per-100 g macros and a Ciqual reference', async () => {
  const rice = await catalog.get('9100');
  expect(rice).toMatchObject({ ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw', portions: [] });
  expect(rice!.per100g.kcal).toBeGreaterThan(300);
  expect(rice!.per100g.kcal).toBeLessThan(400);
  expect(rice!.per100g.protein).toBeGreaterThan(5);
  expect(await catalog.get('does-not-exist')).toBeUndefined();
});

test('opens the database once, on first use', async () => {
  const open = jest.fn(async () => reader);
  const lazy = ciqualCatalog(open);
  expect(open).not.toHaveBeenCalled();
  await lazy.search('riz');
  await lazy.get('9100');
  expect(open).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `npx jest src/modules/nutrition/adapters/ciqualCatalog`
Expected: FAIL, « Cannot find module './ciqualCatalog' ».

- [ ] **Step 3: Écrire le catalogue**

`src/modules/nutrition/adapters/ciqualCatalog.ts` :

```ts
import type { FoodCatalog } from '../application/ports';
import type { Food, FoodState } from '../domain/food';
import { normalizeSearch } from '../domain/normalize';

/** The one method of expo-sqlite's database this adapter needs, so tests can run on Node's SQLite. */
export type SqlReader = { getAllAsync<T>(sql: string, params: (string | number)[]): Promise<T[]> };

type Row = { id: string; name: string; state: FoodState; kcal: number; protein: number; carbs: number; fat: number };
const COLUMNS = 'id, name, state, kcal, protein, carbs, fat';

const toFood = (r: Row): Food => ({
  ref: { type: 'ciqual', id: r.id },
  name: r.name,
  state: r.state,
  per100g: { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat },
  portions: [],
});

/** The embedded Ciqual table. `open` runs on first use and its database is kept. */
export function ciqualCatalog(open: () => Promise<SqlReader>): FoodCatalog {
  let db: Promise<SqlReader> | undefined;
  // A failed open (storage, asset not reachable yet) must not stick until the app restarts.
  const reader = () =>
    (db ??= open().catch((error) => {
      db = undefined;
      throw error;
    }));

  return {
    async search(query, { state, limit = 30 } = {}) {
      // Terms hold only [a-z0-9] after normalizing, so they carry no LIKE wildcard.
      const terms = normalizeSearch(query).split(' ').filter(Boolean);
      if (terms.length === 0) return [];
      const where = [...terms.map(() => 'search LIKE ?'), ...(state ? ['state = ?'] : [])].join(' AND ');
      const params: (string | number)[] = [...terms.map((t) => `%${t}%`), ...(state ? [state] : [])];
      // Names starting with the first term, then names with a word starting with it, then the rest; shorter first.
      const rows = await (await reader()).getAllAsync<Row>(
        `SELECT ${COLUMNS} FROM foods WHERE ${where}
         ORDER BY CASE WHEN search LIKE ? THEN 0 WHEN search LIKE ? THEN 1 ELSE 2 END, length(name), name
         LIMIT ?`,
        [...params, `${terms[0]}%`, `% ${terms[0]}%`, limit],
      );
      return rows.map(toFood);
    },
    async get(id) {
      const [row] = await (await reader()).getAllAsync<Row>(`SELECT ${COLUMNS} FROM foods WHERE id = ?`, [id]);
      return row ? toFood(row) : undefined;
    },
  };
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `npx jest src/modules/nutrition/adapters/ciqualCatalog && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS (6 tests), aucune erreur.

- [ ] **Step 5: Installer expo-sqlite et ouvrir la base embarquée**

Run: `npx expo install expo-sqlite`

Lire la documentation `https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/` et les types installés (`node_modules/expo-sqlite/build/`) pour trouver l'API **sans composant** qui copie une base embarquée vers le stockage de l'app puis l'ouvre (par exemple `importDatabaseFromAssetAsync` puis `openDatabaseAsync`, ou l'équivalent de `assetSource`). Écrire `src/platform/ciqual.ts` :

```ts
import { openDatabaseAsync, ... } from 'expo-sqlite';
import type { SqlReader } from '@/modules/nutrition/adapters/ciqualCatalog';

// Bump the version in the file name when assets/ciqual.db is rebuilt: the app then installs the new copy.
const DATABASE = 'ciqual-2025-11-03.db';

export async function openCiqual(): Promise<SqlReader> { /* copy the asset on first run, then open it read-only */ }
```

Contraintes : `require('../../assets/ciqual.db')` pour l'asset ; la copie n'a lieu qu'une fois (pas de recopie à chaque lancement) ; le résultat est un `SQLiteDatabase`, qui satisfait `SqlReader`. Ne pas modifier `app.json` sauf si la documentation l'exige (dans ce cas, le dire dans le rapport).

- [ ] **Step 6: Vérifier le bundle Android et le reste**

Run: `npx expo export --platform android --output-dir /private/tmp/claude-501/-Users-nugah-Desktop-42-Genki/0075675a-187a-4db4-9845-65f77c31d0a1/scratchpad/export-m2` (le bundle doit réussir et inclure `ciqual.db` parmi les assets ; faire un `ls` du dossier de sortie pour le montrer), puis `npm test && npm run typecheck && npm run lint && npm run lint:deps && npx expo-doctor`.
Expected: tout passe (expo-doctor 20/20). Le test natif (copie et ouverture sur téléphone) n'est pas faisable ici : le noter parmi les points à vérifier sur téléphone.

- [ ] **Step 7: Commit**

```bash
git add src/modules/nutrition/adapters src/platform/ciqual.ts package.json package-lock.json app.json
git commit -m "feat: Ciqual food catalog on the embedded SQLite database (M2)"
```

---

### Task 4: Règles Firestore et adaptateurs (aliments, entrées, favoris, totaux du jour)

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `firebase/firestore.rules.emulator.test.ts`
- Create: `src/modules/nutrition/adapters/firestoreFoodEntryRepository.ts`, `firestoreFoodRepository.ts`, `firestoreFavoriteMealRepository.ts`
- Test: `firestoreFoodEntryRepository.emulator.test.ts`, `firestoreFoodRepository.emulator.test.ts`, `firestoreFavoriteMealRepository.emulator.test.ts` (même dossier)
- Modify: `src/modules/today/application/ports.ts`, `src/modules/today/adapters/firestoreDayTotals.ts`, `src/modules/today/adapters/firestoreDayTotals.emulator.test.ts`

**Interfaces:**
- Consumes: ports et types de la tâche 2 ; `subtractMacros`, `ZERO_MACROS`, `Macros` ; le modèle de M1 (`firestoreWaterRepository.ts` : `moveDayTotal`, `Timestamp.fromDate/now`, `writeBatch`, filtre `deletedAt === null` côté client).
- Produces:
  - `firestoreFoodEntryRepository(db: Firestore, uid: string): FoodEntryRepository`, `firestoreFoodRepository(db, uid): FoodRepository`, `firestoreFavoriteMealRepository(db, uid): FavoriteMealRepository`.
  - `DayTotals = { waterMl: number; kcal: number; proteinG: number; carbsG: number; fatG: number }` (chaque champ absent vaut 0, borné à 0 au minimum).
  - Règles : `foodEntries` (création exacte ; mise à jour = quantité *ou* suppression douce unique), `foods` (création ; modification *ou* suppression douce), `favoriteMeals` (création, modification, suppression), `days` (champs optionnels `waterMl` ≥ 0 et `kcal`/`proteinG`/`carbsG`/`fatG` ≥ −0,05).

- [ ] **Step 1: Écrire les règles**

Dans `firebase/firestore.rules`, après `isDayKey`, ajouter les fonctions :

```
    function isShortText(value, max) {
      return value is string && value.size() > 0 && value.size() <= max;
    }

    function isFoodRef(ref) {
      return ref is map
        && ref.keys().hasOnly(['type', 'id'])
        && ref.type in ['ciqual', 'custom']
        && isShortText(ref.id, 64);
    }

    // Per-entry macros: grams are capped at 5 000, so no entry goes past 50 000 kcal.
    function isEntryMacros(m) {
      return m is map
        && m.keys().hasOnly(['kcal', 'protein', 'carbs', 'fat'])
        && m.kcal is number && m.kcal >= 0 && m.kcal <= 50000
        && m.protein is number && m.protein >= 0 && m.protein <= 5000
        && m.carbs is number && m.carbs >= 0 && m.carbs <= 5000
        && m.fat is number && m.fat >= 0 && m.fat <= 5000;
    }

    function isGrams(value) {
      return value is number && value > 0 && value <= 5000;
    }

    function isPer100g(m) {
      return m is map
        && m.keys().hasOnly(['kcal', 'protein', 'carbs', 'fat'])
        && m.kcal is number && m.kcal >= 0 && m.kcal <= 900
        && m.protein is number && m.protein >= 0 && m.protein <= 100
        && m.carbs is number && m.carbs >= 0 && m.carbs <= 100
        && m.fat is number && m.fat >= 0 && m.fat <= 100;
    }

    // A day total field is optional; macro totals tolerate a tiny negative drift (sums of 0.1-rounded floats).
    function atLeast(data, field, min) {
      return !(field in data) || (data[field] is number && data[field] >= min);
    }
```

Remplacer le bloc `days` et ajouter les trois collections (après `waterEntries`) :

```
    match /users/{uid}/days/{day} {
      allow create, update: if isOwner(uid)
        && isDayKey(day)
        && request.resource.data.keys().hasOnly(['waterMl', 'kcal', 'proteinG', 'carbsG', 'fatG', 'updatedAt'])
        && request.resource.data.updatedAt is timestamp
        && atLeast(request.resource.data, 'waterMl', 0)
        && atLeast(request.resource.data, 'kcal', -0.05)
        && atLeast(request.resource.data, 'proteinG', -0.05)
        && atLeast(request.resource.data, 'carbsG', -0.05)
        && atLeast(request.resource.data, 'fatG', -0.05);
    }

    match /users/{uid}/foodEntries/{entryId} {
      allow create: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['day', 'meal', 'foodRef', 'foodName', 'grams', 'macros', 'createdAt', 'updatedAt', 'deletedAt'])
        && isDayKey(request.resource.data.day)
        && request.resource.data.meal in ['breakfast', 'lunch', 'dinner', 'snack']
        && isFoodRef(request.resource.data.foodRef)
        && isShortText(request.resource.data.foodName, 200)
        && isGrams(request.resource.data.grams)
        && isEntryMacros(request.resource.data.macros)
        && request.resource.data.createdAt is timestamp
        && request.resource.data.updatedAt is timestamp
        && request.resource.data.deletedAt == null;
      // Either a soft delete (once: the batch moving the day totals fails with it) or a quantity change.
      allow update: if isOwner(uid)
        && resource.data.deletedAt == null
        && (
          (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedAt'])
            && request.resource.data.deletedAt is timestamp)
          || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['grams', 'macros', 'updatedAt'])
            && isGrams(request.resource.data.grams)
            && isEntryMacros(request.resource.data.macros)
            && request.resource.data.updatedAt is timestamp)
        );
    }

    match /users/{uid}/foods/{foodId} {
      allow create: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['name', 'state', 'per100g', 'portions', 'updatedAt', 'deletedAt'])
        && isFoodFields(request.resource.data)
        && request.resource.data.deletedAt == null;
      allow update: if isOwner(uid)
        && resource.data.deletedAt == null
        && (
          (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedAt'])
            && request.resource.data.deletedAt is timestamp)
          || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'state', 'per100g', 'portions', 'updatedAt'])
            && isFoodFields(request.resource.data))
        );
    }

    match /users/{uid}/favoriteMeals/{mealId} {
      allow create, update: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['name', 'items', 'updatedAt'])
        && isShortText(request.resource.data.name, 100)
        && request.resource.data.items is list
        && request.resource.data.items.size() >= 1
        && request.resource.data.items.size() <= 50
        && request.resource.data.updatedAt is timestamp;
      allow delete: if isOwner(uid);
    }
```

Et la fonction manquante, avec les autres :

```
    function isFoodFields(d) {
      return isShortText(d.name, 100)
        && d.state in ['raw', 'cooked', 'other']
        && isPer100g(d.per100g)
        && d.portions is list
        && d.portions.size() <= 20
        && d.updatedAt is timestamp;
    }
```

- [ ] **Step 2: Étendre les tests de règles (ils échouent d'abord)**

Dans `firebase/firestore.rules.emulator.test.ts`, dans le test « documents without validation yet stay closed to writes », remplacer l'exemple `users/alice/foods/f1` (désormais validé) par une collection encore fermée : `users/alice/workoutLogs/w1`. Puis ajouter, avec les mêmes aides (`db`, `seed`, `assertSucceeds/assertFails`, `Timestamp`) :

```ts
const macros = { kcal: 350, protein: 7, carbs: 78, fat: 0.6 };
const foodEntry = () => ({
  day: '2026-10-24', meal: 'lunch', foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru',
  grams: 100, macros, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), deletedAt: null,
});
const customFood = () => ({
  name: 'Pain maison', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 },
  portions: [{ label: '1 tranche', grams: 30 }], updatedAt: Timestamp.now(), deletedAt: null,
});

describe('foodEntries', () => {
  test('the owner creates a sound entry, another user cannot', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), foodEntry()));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/foodEntries/e2'), foodEntry()));
  });

  test.each<[string, object]>([
    ['grams is 0', { grams: 0 }],
    ['grams is above 5 000', { grams: 5001 }],
    ['the meal is unknown', { meal: 'brunch' }],
    ['the day is not a date', { day: 'hier' }],
    ['the food reference type is unknown', { foodRef: { type: 'usda', id: '1' } }],
    ['the food name is empty', { foodName: '' }],
    ['a macro is negative', { macros: { ...macros, fat: -1 } }],
    ['a macro is missing', { macros: { kcal: 1, protein: 1, carbs: 1 } }],
    ['deletedAt is already set', { deletedAt: Timestamp.now() }],
    ['an unknown field is present', { note: 'x' }],
  ])('rejects an entry when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), { ...foodEntry(), ...override }));
  });

  test('the quantity can change but nothing else, and the entry is soft-deleted once', async () => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    const ref = doc(db('alice'), 'users/alice/foodEntries/e1');
    await assertFails(updateDoc(ref, { foodName: 'Autre' }));
    await assertFails(updateDoc(ref, { grams: 0, macros, updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { grams: 200, macros, updatedAt: Timestamp.now(), meal: 'dinner' }));
    await assertSucceeds(updateDoc(ref, { grams: 200, macros: { ...macros, kcal: 700 }, updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { grams: 100, macros, updatedAt: Timestamp.now() }));
  });

  test('another user cannot update an entry', async () => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    await assertFails(updateDoc(doc(db('bob'), 'users/alice/foodEntries/e1'), { deletedAt: Timestamp.now() }));
  });
});

describe('foods', () => {
  test('the owner creates, edits and soft-deletes a custom food', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foods/f1'), customFood()));
    const ref = doc(db('alice'), 'users/alice/foods/f1');
    await assertSucceeds(updateDoc(ref, { name: 'Pain de mie', updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { deletedAt: null, name: 'x', updatedAt: Timestamp.now(), foo: 1 }));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { name: 'Trop tard', updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['the name is empty', { name: '' }],
    ['the state is unknown', { state: 'frozen' }],
    ['kcal per 100 g is above 900', { per100g: { kcal: 901, protein: 0, carbs: 0, fat: 0 } }],
    ['a macro per 100 g is above 100', { per100g: { kcal: 400, protein: 101, carbs: 0, fat: 0 } }],
    ['there are 21 portions', { portions: Array.from({ length: 21 }, () => ({ label: 'p', grams: 1 })) }],
    ['portions is not a list', { portions: 'une' }],
  ])('rejects a food when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foods/f1'), { ...customFood(), ...override }));
  });

  test('another user cannot write', async () => {
    await assertFails(setDoc(doc(db('bob'), 'users/alice/foods/f1'), customFood()));
  });
});

describe('favoriteMeals', () => {
  const favorite = () => ({
    name: 'Déjeuner habituel', items: [{ foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru', grams: 150 }], updatedAt: Timestamp.now(),
  });

  test('the owner creates, edits and deletes a favorite', async () => {
    const ref = doc(db('alice'), 'users/alice/favoriteMeals/m1');
    await assertSucceeds(setDoc(ref, favorite()));
    await assertSucceeds(setDoc(ref, { ...favorite(), name: 'Autre nom' }));
    await assertSucceeds(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['the name is empty', { name: '' }],
    ['there are no items', { items: [] }],
    ['there are 51 items', { items: Array.from({ length: 51 }, () => ({ foodRef: { type: 'ciqual', id: '1' }, foodName: 'x', grams: 1 })) }],
    ['an unknown field is present', { note: 'x' }],
  ])('rejects a favorite when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/favoriteMeals/m1'), { ...favorite(), ...override }));
  });

  test('another user cannot delete', async () => {
    await seed('users/alice/favoriteMeals/m1', favorite());
    await assertFails(deleteDoc(doc(db('bob'), 'users/alice/favoriteMeals/m1')));
  });
});

describe('days (nutrition totals)', () => {
  test('accepts macro totals moved by increment(), with or without water', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: increment(350), proteinG: increment(7), carbsG: increment(78), fatG: increment(0.6), updatedAt: Timestamp.now() }, { merge: true }));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-25'), { waterMl: increment(250), updatedAt: Timestamp.now() }, { merge: true }));
  });

  test('tolerates a drift of 0.01 below zero on macros but rejects 0.1, and never on water', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: -0.01, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: -0.1, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { waterMl: -0.01, updatedAt: Timestamp.now() }));
  });

  test('rejects a total that is not a number', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { proteinG: '12', updatedAt: Timestamp.now() }));
  });
});
```

Run: `npm run test:emulator`
Expected: FAIL avec les anciennes règles ; les ajouts de la section précédente (règles) font passer ces tests. Après l'étape 1, tous les tests de règles doivent passer (les 17 existants, dont celui sur `foods/f1` à ajuster, plus les nouveaux). Vérifier que `jest` n'affiche aucun avertissement (le fichier garde son `setLogLevel('error')`).

- [ ] **Step 3: Écrire les tests d'adaptateurs qui échouent**

Même mise en place que `firestoreWaterRepository.emulator.test.ts` (`initializeTestEnvironment` avec les règles du dépôt, `phone()` = un client, `afterEach(clearFirestore)`), avec `setLogLevel('error')` si des avertissements de refus apparaissent.

`src/modules/nutrition/adapters/firestoreFoodEntryRepository.emulator.test.ts` — cas obligatoires :

```ts
const rice = { kcal: 350, protein: 7, carbs: 78, fat: 0.6 };
const entry = (over = {}) => ({
  day: '2026-10-24', meal: 'lunch' as const, foodRef: { type: 'ciqual' as const, id: '9100' }, foodName: 'Riz blanc, cru',
  grams: 100, macros: rice, createdAt: new Date('2026-10-24T10:00:00Z'), ...over,
});
const dayDoc = async (db: Firestore) => (await getDocFromServer(doc(db, 'users/alice/days/2026-10-24'))).data();
```

1. **ajout** : après `add(entry())`, `dayDoc` vaut `kcal: 350, proteinG: 7, carbsG: 78, fatG: 0.6` ; `observeDay` renvoie l'entrée complète (`id` généré, `createdAt` de type `Date`, `macros` figées).
2. **deux téléphones hors-ligne** (le scénario clé de la spec, comme pour l'eau) : chacun ajoute une entrée hors-ligne (`disableNetwork`), retour du réseau, `kcal` du jour = la somme.
3. **modification de quantité** : `add(entry({ grams: 200, macros: double }))` puis `updateGrams(e, 100, rice)` → `observeDay` montre `grams: 100`, le total du jour redevient celui de 100 g.
4. **suppression** : `remove(e)` → l'entrée disparaît de `observeDay` et de `observeRecent`, le total du jour redescend à 0 (comparer avec `toBeCloseTo(0)`).
5. **suppression hors-ligne depuis deux téléphones** : un seul `remove` réussit (l'autre est refusé par la règle « une seule fois »), total final = 0 ; prévoir deux entrées pour que la preuve ne repose pas sur la borne `>= -0.05` (retirer 100 g d'une entrée de 100 g quand une autre de 200 g existe : le total final doit valoir celui de 200 g).
6. **entrée refusée** : `add(entry({ grams: 6000 }))` est rejeté et `dayDoc` reste `undefined` (un seul lot).
7. **récents** : `observeRecent(2, …)` renvoie les deux dernières entrées, la plus récente d'abord (`createdAt` distincts).

`firestoreFoodRepository.emulator.test.ts` : `create` → `observeAll` renvoie l'aliment avec `ref: { type: 'custom', id }` (id généré), `portions` et `per100g` intacts ; `update` change le nom ; `remove` le retire de `observeAll` ; un aliment invalide (`per100g.kcal: 1000`) est rejeté.

`firestoreFavoriteMealRepository.emulator.test.ts` : `create` → `observeAll` renvoie `{ id, name, items }` ; `remove` supprime ; un favori sans élément est rejeté.

`src/modules/today/adapters/firestoreDayTotals.emulator.test.ts` : ajouter un cas : un document `days/2026-10-23` avec `kcal: 1200.4, proteinG: 80, carbsG: 130, fatG: 40` est lu en `{ waterMl: 0, kcal: 1200.4, proteinG: 80, carbsG: 130, fatG: 40 }`, et une valeur légèrement négative (`kcal: -0.03`) est lue `0`.

- [ ] **Step 4: Lancer les tests et vérifier qu'ils échouent**

Run: `npm run test:emulator`
Expected: FAIL, modules `firestoreFoodEntryRepository`, etc. introuvables ; l'ancien type `DayTotals` n'a pas les nouveaux champs.

- [ ] **Step 5: Écrire les adaptateurs**

`src/modules/nutrition/adapters/firestoreFoodEntryRepository.ts` :

```ts
import {
  collection, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where, writeBatch,
  type Firestore, type QueryDocumentSnapshot, type WriteBatch,
} from '@react-native-firebase/firestore';
import type { FoodEntryRepository } from '../application/ports';
import type { FoodEntry } from '../domain/food';
import { subtractMacros, ZERO_MACROS, type Macros } from '../domain/macros';

/** Entries in `users/{uid}/foodEntries`; each write moves `days/{day}` in the same batch (spec §4). */
export function firestoreFoodEntryRepository(db: Firestore, uid: string): FoodEntryRepository {
  const entries = collection(db, 'users', uid, 'foodEntries');

  // increment() adds up on the server: entries logged offline on two phones sum instead of overwriting.
  const moveDayTotals = (batch: WriteBatch, day: string, m: Macros) =>
    batch.set(
      doc(db, 'users', uid, 'days', day),
      { kcal: increment(m.kcal), proteinG: increment(m.protein), carbsG: increment(m.carbs), fatG: increment(m.fat), updatedAt: serverTimestamp() },
      { merge: true },
    );

  const toEntry = (d: QueryDocumentSnapshot): FoodEntry => {
    const data = d.data();
    return { id: d.id, day: data.day, meal: data.meal, foodRef: data.foodRef, foodName: data.foodName, grams: data.grams, macros: data.macros, createdAt: data.createdAt.toDate() };
  };
  const live = (docs: QueryDocumentSnapshot[]) => docs.filter((d) => d.data().deletedAt === null).map(toEntry);

  return {
    add(entry) {
      const batch = writeBatch(db);
      const at = Timestamp.fromDate(entry.createdAt);
      batch.set(doc(entries), {
        day: entry.day, meal: entry.meal, foodRef: entry.foodRef, foodName: entry.foodName,
        grams: entry.grams, macros: entry.macros, createdAt: at, updatedAt: at, deletedAt: null,
      });
      moveDayTotals(batch, entry.day, entry.macros);
      return batch.commit();
    },
    updateGrams(entry, grams, macros) {
      const batch = writeBatch(db);
      batch.update(doc(entries, entry.id), { grams, macros, updatedAt: Timestamp.now() });
      moveDayTotals(batch, entry.day, subtractMacros(macros, entry.macros));
      return batch.commit();
    },
    remove(entry) {
      const batch = writeBatch(db);
      // Timestamp.now(), not serverTimestamp(): a pending server timestamp reads as null and the entry would stay listed offline.
      batch.update(doc(entries, entry.id), { deletedAt: Timestamp.now() });
      moveDayTotals(batch, entry.day, subtractMacros(ZERO_MACROS, entry.macros));
      return batch.commit();
    },
    observeDay(day, onNext, onError) {
      return onSnapshot(query(entries, where('day', '==', day)), (snapshot) => onNext(live(snapshot.docs)), onError);
    },
    observeRecent(max, onNext, onError) {
      return onSnapshot(query(entries, orderBy('createdAt', 'desc'), limit(max)), (snapshot) => onNext(live(snapshot.docs)), onError);
    },
  };
}
```

`src/modules/nutrition/adapters/firestoreFoodRepository.ts` :

```ts
import { collection, doc, onSnapshot, setDoc, Timestamp, updateDoc, type Firestore } from '@react-native-firebase/firestore';
import type { FoodRepository } from '../application/ports';
import type { Food, FoodInput } from '../domain/food';

/** Custom foods in `users/{uid}/foods`. */
export function firestoreFoodRepository(db: Firestore, uid: string): FoodRepository {
  const foods = collection(db, 'users', uid, 'foods');
  const fields = (food: FoodInput) => ({
    name: food.name, state: food.state, per100g: food.per100g, portions: food.portions, updatedAt: Timestamp.now(),
  });

  return {
    create: (food) => setDoc(doc(foods), { ...fields(food), deletedAt: null }),
    update: (id, food) => updateDoc(doc(foods, id), fields(food)),
    remove: (id) => updateDoc(doc(foods, id), { deletedAt: Timestamp.now() }),
    observeAll(onNext, onError) {
      return onSnapshot(
        foods,
        (snapshot) =>
          onNext(
            snapshot.docs
              .filter((d) => d.data().deletedAt === null)
              .map((d): Food => ({ ref: { type: 'custom', id: d.id }, name: d.data().name, state: d.data().state, per100g: d.data().per100g, portions: d.data().portions })),
          ),
        onError,
      );
    },
  };
}
```

`src/modules/nutrition/adapters/firestoreFavoriteMealRepository.ts` : même forme sur `users/{uid}/favoriteMeals` : `create: (meal) => setDoc(doc(meals), { name: meal.name, items: meal.items, updatedAt: Timestamp.now() })`, `remove: (id) => deleteDoc(doc(meals, id))`, `observeAll` renvoie `{ id, name, items }` pour chaque document.

Dans `src/modules/today/application/ports.ts`, remplacer `DayTotals` par :

```ts
/** The `days/{date}` totals the Today screen shows; a missing field reads as 0. */
export type DayTotals = { waterMl: number; kcal: number; proteinG: number; carbsG: number; fatG: number };
```

Dans `src/modules/today/adapters/firestoreDayTotals.ts`, lire les cinq champs :

```ts
const total = (value: unknown) => Math.max(0, typeof value === 'number' ? value : 0);
// … dans le rappel :
const data = snapshot.data();
onNext(
  { waterMl: total(data?.waterMl), kcal: total(data?.kcal), proteinG: total(data?.proteinG), carbsG: total(data?.carbsG), fatG: total(data?.fatG) },
  { hasPendingWrites: snapshot.metadata.hasPendingWrites, fromCache: snapshot.metadata.fromCache },
);
```

Mettre à jour les endroits qui construisent un `DayTotals` (tests de `TodayScreen`, `SyncIcon`, `navigation.test.tsx`) pour que `npm run typecheck` passe (ajouter `kcal: 0, proteinG: 0, carbsG: 0, fatG: 0` aux littéraux).

- [ ] **Step 6: Lancer toute la vérification**

Run: `npm run test:emulator && npm test && npm run typecheck && npm run lint && npm run lint:deps`
Expected: tout passe, sortie sans avertissement. Prouver que les nouveaux tests mordent (mutation temporaire puis retour byte-identique) : 1) retirer le décrément du lot dans `remove` → le test 4 échoue ; 2) retirer la règle `resource.data.deletedAt == null` des `foodEntries` → le test 5 échoue ; 3) faire passer `add` en deux `commit()` séparés → le test 6 échoue.

- [ ] **Step 7: Commit**

```bash
git add firebase src/modules/nutrition/adapters src/modules/today
git commit -m "feat: Firestore rules and adapters for foods, entries, favorites and nutrition day totals (M2)"
```

---

### Task 5: Onglet Repas — journal du jour, actions sur une ligne, enregistrement d'un favori

**Files:**
- Create: `src/modules/nutrition/ui/MealsScreen.tsx`, `EntryActions.tsx`
- Test: `src/modules/nutrition/ui/MealsScreen.test.tsx`
- Create: `src/modules/nutrition/ui/format.ts` (formats français partagés avec la tâche 6)
- Modify: `src/modules/nutrition/index.ts`

**Interfaces:**
- Consumes: `MealUseCases`, `FoodEntry`, `MEALS`, `Meal`, `sumMacros` ; `Profile` de `@/modules/settings` (ajouter `kcal` et `proteinG` à `Profile.goals` et à `DEFAULT_PROFILE` : `kcal: 2200`, `proteinG: 130`) ; `dayKey`, `Clock`, `useNow`.
- Produces:
  - `format.ts` : `MEAL_LABELS: Record<Meal, string>` (`breakfast` « Petit-déjeuner », `lunch` « Déjeuner », `dinner` « Dîner », `snack` « Collations »), `kcalText(kcal: number): string` (entier, séparateur français), `gramsText(g: number): string` (une décimale au plus, virgule), `macrosText(m: Macros): string` → `« 350 kcal · 7 g de protéines · 78 g de glucides · 0,6 g de lipides »`.
  - `MealsScreen` : props `{ profile: Profile; clock: Clock; meals: MealUseCases; onAdd: (meal: Meal) => void; run: (write: () => Promise<void>) => void }`.
  - `EntryActions` : props `{ entry: FoodEntry | null; onDismiss: () => void; onChangeGrams: (entry: FoodEntry, grams: number) => void; onRemove: (entry: FoodEntry) => void }`.

Comportement de `MealsScreen` (textes exacts) :
- En-tête des totaux du jour : « Calories : {kcal} / {objectif} kcal », « Protéines : {g} / {objectif} g », et « Glucides {g} g · Lipides {g} g » (sommes des entrées du jour, via `meals.observeDay(dayKey(now, profile.timezone), …)`).
- Une section par repas, dans l'ordre de `MEALS`, avec le libellé, le sous-total « {kcal} kcal », un bouton « Ajouter » (`accessibilityLabel` `Ajouter à {libellé}`, hauteur ≥ 48 dp) qui appelle `onAdd(meal)`, et la liste des entrées du repas : titre = `foodName`, description = `{grams} g · {kcal} kcal`, `accessibilityLabel` = `{foodName}, {grams} g`, toucher = ouvre `EntryActions`. Section vide : « Rien pour l’instant. »
- Section non vide : bouton « Enregistrer comme favori » (`accessibilityLabel` `Enregistrer {libellé} comme favori`) → boîte de dialogue « Nom du favori » (champ prérempli avec le libellé du repas, boutons « Annuler » / « Enregistrer », désactivé si vide) → `run(() => meals.saveFavorite(nom, entréesDuRepas))`.
- `EntryActions` : boîte de dialogue au nom de l'entrée avec trois actions : « Modifier la quantité » (affiche un champ « Quantité (g) » prérempli et deux boutons « Annuler » / « Enregistrer », désactivé si la valeur n'est pas dans ]0 ; 5 000]), « Supprimer », « Annuler ». Virgule ou point acceptés comme séparateur décimal. `onChangeGrams` et `onRemove` passent par `run(…)` dans `MealsScreen`.

- [ ] **Step 1: Écrire le test qui échoue**

`src/modules/nutrition/ui/MealsScreen.test.tsx` — mise en place :

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { inMemoryFavoriteMealRepository } from '../adapters/inMemoryFavoriteMealRepository';
import { inMemoryFoodEntryRepository } from '../adapters/inMemoryFoodEntryRepository';
import { mealUseCases } from '../application/mealUseCases';
import { MealsScreen } from './MealsScreen';

const clock = { now: () => new Date('2026-10-24T10:00:00Z') }; // 13:00 in Paris
const rice = { ref: { type: 'ciqual' as const, id: '9100' }, name: 'Riz blanc, cru', per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 } };

async function setup() {
  const entries = inMemoryFoodEntryRepository();
  const favorites = inMemoryFavoriteMealRepository();
  const meals = mealUseCases({ entries, favorites, clock, timezone: DEFAULT_PROFILE.timezone });
  const onAdd = jest.fn();
  await render(
    <PaperProvider>
      <MealsScreen profile={DEFAULT_PROFILE} clock={clock} meals={meals} onAdd={onAdd} run={(write) => void write()} />
    </PaperProvider>,
  );
  return { entries, favorites, meals, onAdd };
}
```

Cas obligatoires (écrire le code complet de chacun, sur ce modèle) :
1. **journal et totaux** : `await act(async () => { await meals.logFood('lunch', rice, 200); })` puis le titre « Riz blanc, cru », la description « 200 g · 700 kcal » sous Déjeuner et l'en-tête « Calories : 700 / {2200 en format fr} kcal » sont à l'écran ; un repas vide affiche « Rien pour l’instant. ».
2. **ajouter** : toucher `Ajouter à Dîner` appelle `onAdd('dinner')`.
3. **modifier la quantité** : toucher la ligne `Riz blanc, cru, 200 g` ouvre les actions ; « Modifier la quantité » → saisir `150` (et un test avec `150,5`) → « Enregistrer » → la ligne affiche `150 g · 525 kcal` ; une valeur `0` ou vide désactive « Enregistrer ».
4. **supprimer** : toucher la ligne puis « Supprimer » retire la ligne, les totaux repassent à 0.
5. **favori** : sous Déjeuner, « Enregistrer comme favori » → le champ est prérempli « Déjeuner » → saisir « Riz du midi » → « Enregistrer » → `favorites` contient un favori nommé « Riz du midi » avec l'élément riz 200 g (lire par `meals.observeFavorites`).
6. **jour** : une entrée d'un autre jour (`day: '2026-10-23'`) n'apparaît pas.

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `npx jest src/modules/nutrition/ui`
Expected: FAIL, « Cannot find module './MealsScreen' ».

- [ ] **Step 3: Écrire les composants**

Écrire `format.ts`, `EntryActions.tsx` et `MealsScreen.tsx` selon la description ci-dessus, avec React Native Paper (`List.Item`, `Dialog`, `Portal`, `TextInput`, `Button`, `Text`, `Surface`/`Card`), en suivant les conventions de `src/modules/today/ui/TodayScreen.tsx` et `src/modules/hydration/ui/WaterSheet.tsx` (props de type `run`, `useNow(clock)`, abonnement dans `useEffect` avec nettoyage, `accessibilityLabel` français, cibles ≥ 48 dp). Les boîtes de dialogue sont des `Dialog` dans un `Portal`. Le calcul des totaux utilise `sumMacros`. Ajouter `MealsScreen` aux exports de `src/modules/nutrition/index.ts`, ainsi que `type Meal` s'il n'y est pas.

Dans `src/modules/settings/domain/profile.ts`, étendre `goals` : `goals: { waterMl: number; kcal: number; proteinG: number }` avec `kcal: 2200, proteinG: 130` dans `DEFAULT_PROFILE` (commentaire : valeurs provisoires jusqu'à l'écran de configuration, M6).

- [ ] **Step 4: Lancer les tests et la vérification complète**

Run: `npm test && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS, sortie sans avertissement ; prouver qu'un test mord (par exemple faire ignorer le filtre de jour dans `MealsScreen` et voir le cas 6 échouer, puis restaurer).

- [ ] **Step 5: Commit**

```bash
git add src/modules/nutrition src/modules/settings
git commit -m "feat: Meals screen with the day journal, row actions and saving a favorite (M2)"
```

---

### Task 6: Flux « Ajouter un aliment » — favoris, récents, recherche, création, fiche de l'aliment

**Files:**
- Create: `src/modules/nutrition/ui/AddFoodScreen.tsx`, `FoodSearch.tsx`, `FoodDetail.tsx`, `FoodForm.tsx`, `FavoritesList.tsx`, `RecentsList.tsx`
- Test: `AddFoodScreen.test.tsx`, `FoodForm.test.tsx` (même dossier)
- Modify: `src/modules/nutrition/index.ts`

**Interfaces:**
- Consumes: `MealUseCases`, `FoodUseCases`, `Food`, `FoodInput`, `FavoriteMeal`, `RecentFood`, `matchCustom`, `validateFood`, `macrosFor`, `Meal`, `format.ts` (tâche 5), les dépôts en mémoire et `inMemoryFoodCatalog` pour les tests.
- Produces: `AddFoodScreen` : props `{ meal: Meal; meals: MealUseCases; foods: FoodUseCases; run: (write: () => Promise<void>) => void; onDone: () => void }`.

Comportement (textes exacts) :
- Quatre segments (`SegmentedButtons` de Paper) : « Favoris », « Récents », « Recherche », « Créer ». Segment initial : « Recherche ». L'écran garde l'aliment sélectionné (`Food | null`) : quand il existe, la **fiche** remplace le contenu des segments.
- L'écran s'abonne aux aliments personnalisés (`foods.observeCustom`) pour la durée de son affichage ; cette liste sert à la recherche, à la résolution des récents/favoris et à la fiche. Tant que la première liste n'est pas arrivée (`null`), toucher un favori ou un récent ne fait rien (les lignes sont désactivées).
- **Recherche** : champ « Rechercher un aliment » ; pastilles de filtre « Tous » (défaut), « Cru », « Cuit » ; résultats = aliments personnalisés correspondants (`matchCustom`) puis résultats Ciqual (`foods.searchCatalog`), chaque ligne : nom, pastille « cru » ou « cuit » selon l'état (rien pour `other`), description `{kcal} kcal / 100 g` ; recherche vide : « Tapez le nom d’un aliment. » ; aucun résultat : « Aucun aliment trouvé. ». Les réponses du catalogue arrivées en retard (requête dépassée) sont ignorées. Toucher une ligne ouvre la fiche.
- **Fiche** (`FoodDetail`) : nom et pastille d'état ; puces de quantité : une par portion de l'aliment (`{label} ({grams} g)`), « 100 g », et la quantité de « Récents » quand la fiche vient de là ; champ « Quantité (g) » (virgule ou point), valeur initiale = 100 g (ou la quantité préremplie) ; aperçu `macrosText(macrosFor(per100g, grams))` ; bouton « Ajouter à {libellé du repas} » (désactivé si la quantité n'est pas dans ]0 ; 5 000]) → `run(() => meals.logFood(meal, food, grams))` puis `onDone()`. Pour un aliment personnalisé : boutons « Modifier l’aliment » (ouvre `FoodForm` prérempli, enregistrer = `foods.update`) et « Supprimer l’aliment » (`foods.remove`, retour à la recherche). Bouton « Retour » à la liste.
- **Récents** : liste `meals.observeRecent` (nom + `{grams} g`) ; toucher résout l'aliment (`foods.resolve(ref, custom)`) et ouvre la fiche avec la quantité préremplie ; s'il n'existe plus : « Cet aliment n’existe plus. ». Liste vide : « Aucun aliment récent. ».
- **Favoris** : liste `meals.observeFavorites` (nom + noms des aliments séparés par « , ») ; toucher → `run(() => meals.logFavorite(favori, meal, (ref) => foods.resolve(ref, custom)))` puis `onDone()` ; chaque ligne a un bouton « Supprimer le favori {nom} » (`meals.removeFavorite`). Liste vide : « Aucun favori. Enregistrez un repas depuis le journal. ».
- **Créer** (`FoodForm`) : champs « Nom », état en `SegmentedButtons` (« Cru » / « Cuit » / « Autre », défaut « Autre »), « Calories pour 100 g », « Protéines pour 100 g », « Glucides pour 100 g », « Lipides pour 100 g », portions (lignes « Nom de la portion » + « Poids (g) », bouton « Ajouter une portion », bouton de suppression par ligne) ; « Enregistrer » est actif si le formulaire est valide ; sinon le message de `validateFood` s'affiche. Enregistrer = `run(() => foods.create(input))` puis retour au segment « Recherche » avec le nom saisi dans le champ. Nombres : virgule ou point. Le même composant sert à la modification (valeurs initiales, `onSubmit`, libellé du bouton).

- [ ] **Step 1: Écrire les tests qui échouent**

`FoodForm.test.tsx` : le formulaire vide a « Enregistrer » désactivé ; remplir nom + valeurs valides l'active et appelle `onSubmit` avec un `FoodInput` exact (état par défaut `other`, nombres convertis depuis `12,5`, portions rognées) ; 901 kcal affiche « Plus de 900 kcal pour 100 g n’est pas possible. » ; ajouter puis supprimer une portion.

`AddFoodScreen.test.tsx` — mise en place avec `inMemoryFoodCatalog` (contenant au moins « Riz blanc, cru » état `raw` et « Riz blanc, cuit, sans sel ajouté » état `cooked`, macros réalistes), `inMemoryFoodRepository`, `inMemoryFoodEntryRepository`, `inMemoryFavoriteMealRepository`, `foodUseCases`, `mealUseCases`, `run={(w) => void w()}`, `onDone` espion. Cas obligatoires (code complet) :
1. **recherche → fiche → ajout** : saisir « riz », voir les deux résultats avec leur pastille « cru » / « cuit » et `350 kcal / 100 g`, toucher « Riz blanc, cru », saisir `200` dans « Quantité (g) », voir l'aperçu `700 kcal · 14 g de protéines · …`, toucher « Ajouter à Déjeuner » : `entries.entries` contient une entrée `grams: 200, meal: 'lunch'` avec les macros figées, `onDone` appelé.
2. **filtre cuit** : la pastille « Cuit » ne laisse que « Riz blanc, cuit, sans sel ajouté ».
3. **puce de portion** : un aliment personnalisé avec la portion « 1 tranche » (30 g) : toucher la puce `1 tranche (30 g)` règle la quantité à 30.
4. **créer** : dans « Créer », remplir un aliment valide → enregistrer : l'aliment apparaît dans la recherche du nom saisi (la liste des aliments personnalisés est mise à jour), segment « Recherche » actif.
5. **modifier / supprimer un aliment personnalisé** depuis sa fiche.
6. **récents** : après avoir ajouté un aliment, le segment « Récents » le liste avec sa quantité ; le toucher ouvre la fiche avec cette quantité préremplie ; un récent dont l'aliment personnalisé a été supprimé affiche « Cet aliment n’existe plus. ».
7. **favoris** : un favori créé via `meals.saveFavorite` s'affiche ; le toucher ajoute ses aliments dans le repas de l'écran et appelle `onDone` ; « Supprimer le favori … » le retire.
8. **une recherche en retard est ignorée** : deux recherches successives dont la première répond après la seconde (catalogue factice à promesses contrôlées) n'affichent que les résultats de la seconde.

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run: `npx jest src/modules/nutrition/ui`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Écrire les composants**

Écrire `FoodForm`, `FoodDetail`, `FoodSearch`, `RecentsList`, `FavoritesList` et `AddFoodScreen` selon la description, dans le style des écrans existants (React Native Paper ; abonnements dans `useEffect` avec nettoyage ; libellés d'accessibilité en français ; cibles ≥ 48 dp ; messages d'erreur sous les champs avec `HelperText`). Un petit helper `parseNumber(text): number` (virgule ou point, `NaN` si vide ou invalide) sera partagé avec la tâche 5 (dans `ui/format.ts`). Exporter `AddFoodScreen` depuis `src/modules/nutrition/index.ts`.

- [ ] **Step 4: Lancer les tests et la vérification complète**

Run: `npm test && npm run typecheck && npm run lint && npm run lint:deps`
Expected: PASS, sortie sans avertissement ; prouver qu'au moins deux tests mordent (par exemple : ignorer le filtre d'état ; ne pas ignorer la réponse en retard) puis restaurer.

- [ ] **Step 5: Commit**

```bash
git add src/modules/nutrition
git commit -m "feat: add-food flow with favorites, recents, Ciqual search, custom foods and quantity (M2)"
```

---

### Task 7: Aujourd'hui, composition, routes et README

**Files:**
- Modify: `src/modules/today/domain/gauge.ts` (+ `gauge.test.ts`), `src/modules/today/ui/GaugeBar.tsx`, `TodayScreen.tsx` (+ `TodayScreen.test.tsx`)
- Modify: `src/composition.ts`, `src/appContext.tsx` (seulement si nécessaire)
- Move/Create (routes) : voir ci-dessous
- Modify: `src/navigation.test.tsx`, `README.md`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces:
  - `calorieColor(value: number, goal: number, hour: number): GaugeColor` dans `today/domain/gauge.ts` : rouge au-delà de 110 % de l'objectif, orange au-delà de 105 %, sinon la couleur de rythme `paceColor`.
  - `GaugeBar` : prop `icon: 'plus' | 'chevron-right'` (rétablie : « plus ajoute, chevron ouvre », spec §6).
  - `TodayScreen` : nouvelles props `onAddMeal: () => void` et `onOpenMeals: () => void` ; jauges Eau (`plus`, ouvre le volet), Calories et Protéines (`chevron-right`, `onOpenMeals`) ; rangée de boutons : boutons d'eau puis « + Repas » (`accessibilityLabel` `Ajouter un repas`, ≥ 48 dp, `onAddMeal`).
  - `compose(uid)` ajoute `nutrition: { meals: MealUseCases; foods: FoodUseCases }`.
  - Routes : `app/(app)/_layout.tsx` (fournisseur `AppProvider` + `Stack`), `app/(app)/(tabs)/_layout.tsx`, `app/(app)/(tabs)/index.tsx` (Aujourd'hui), `app/(app)/(tabs)/repas.tsx` (onglet Repas), `app/(app)/add-food.tsx` (modale).

- [ ] **Step 1: Écrire les tests qui échouent (domaine et écran)**

`today/domain/gauge.test.ts` : ajouter

```ts
describe('calorieColor', () => {
  const GOAL = 2000;
  test.each<[number, number, GaugeColor]>([
    [2000, 23, 'green'], // pace 1.0
    [2100, 23, 'green'], // exactly 105 %: not above
    [2101, 23, 'orange'],
    [2200, 23, 'orange'], // exactly 110 %: not above
    [2201, 23, 'red'],
    [900, 15, 'green'], // no overshoot: the pace decides; 15 h expects half the goal, 900 / 1 000 = 0.9
    [600, 15, 'orange'], // pace 0.6
    [500, 15, 'red'], // pace 0.5
  ])('%s kcal at %s h is %s', (value, hour, color) => {
    expect(calorieColor(value, GOAL, hour)).toBe(color);
  });

  test('without a goal, only the pace rule applies', () => {
    expect(calorieColor(100, 0, 12)).toBe('green');
  });
});
```

`TodayScreen.test.tsx` : étendre le montage (profil par défaut, un `dayTotals` factice qui émet `{ waterMl, kcal, proteinG, carbsG, fatG }`) et ajouter :
1. les jauges Calories et Protéines s'affichent avec le texte `{kcal} / {objectif} kcal` (valeurs formatées en français avec `toLocaleString('fr-FR')` pour éviter une dépendance au séparateur) ;
2. toucher la jauge Calories appelle `onOpenMeals` ;
3. toucher « + Repas » (`Ajouter un repas`) appelle `onAddMeal` ;
4. la jauge Calories est rouge au-delà de 110 % (vérifier `accessibilityValue` `en retard`, ou une autre trace stable de la couleur, comme pour la jauge d'eau).

`src/navigation.test.tsx` : le mock de `@/composition` renvoie aussi `nutrition` (use cases sur dépôts en mémoire) ; ajouter un test : connecté, l'onglet « Repas » mène à l'écran avec « Petit-déjeuner » ; et un test : « + Repas » sur Aujourd'hui ouvre l'écran « Ajouter un aliment » avec le segment « Recherche » actif (champ « Rechercher un aliment ») ; chercher « riz » (catalogue en mémoire qui contient « Riz blanc, cru ») puis ouvrir la fiche affiche « Ajouter à {libellé du repas par défaut selon l'heure du faux horloge} » (ce bouton n'existe que sur la fiche d'un aliment).

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run: `npx jest src/modules/today src/navigation`
Expected: FAIL (`calorieColor` introuvable, props manquantes).

- [ ] **Step 3: Écrire l'implémentation**

`today/domain/gauge.ts` :

```ts
/** Calories: above 110 % of the goal is red, above 105 % orange (spec §9); otherwise the pace decides. */
export function calorieColor(value: number, goal: number, hour: number): GaugeColor {
  if (goal > 0) {
    const ratio = value / goal;
    if (ratio > 1.1) return 'red';
    if (ratio > 1.05) return 'orange';
  }
  return paceColor(value, goal, hour);
}
```

`GaugeBar` : rétablir la prop `icon: 'plus' | 'chevron-right'` (utilisée par `<Icon source={icon} />`) ; `TodayScreen` : lire `totals` (`DayTotals` complet), afficher les trois jauges (Eau en premier), les boutons d'eau et « + Repas » sur la même rangée enveloppée ; objectifs depuis `profile.goals` ; textes `Calories : {kcal} / {objectif} kcal` et `Protéines : {g} / {objectif} g` (affichés par le libellé d'accessibilité de `GaugeBar` selon son format existant) ; progression `Math.min(value / goal, 1)` ; `calorieColor` pour les calories, `paceColor` pour les protéines.

`src/composition.ts` : ajouter

```ts
import { ciqualCatalog } from '@/modules/nutrition/adapters/ciqualCatalog';
import { firestoreFavoriteMealRepository } from '@/modules/nutrition/adapters/firestoreFavoriteMealRepository';
import { firestoreFoodEntryRepository } from '@/modules/nutrition/adapters/firestoreFoodEntryRepository';
import { firestoreFoodRepository } from '@/modules/nutrition/adapters/firestoreFoodRepository';
import { foodUseCases, mealUseCases } from '@/modules/nutrition';
import { openCiqual } from '@/platform/ciqual';
// … dans compose(uid) :
nutrition: {
  meals: mealUseCases({
    entries: firestoreFoodEntryRepository(db, uid),
    favorites: firestoreFavoriteMealRepository(db, uid),
    clock: systemClock,
    timezone: profile.timezone,
  }),
  foods: foodUseCases({ catalog: ciqualCatalog(openCiqual), repo: firestoreFoodRepository(db, uid) }),
},
```

Routes : déplacer `app/(tabs)/` vers `app/(app)/(tabs)/` ; créer `app/(app)/_layout.tsx` qui porte le `AppProvider` (le code `useAuthUser` + `useMemo(() => compose(uid), [uid])` qui se trouve aujourd'hui dans `app/(tabs)/_layout.tsx`) et un `Stack` (`headerShown: false`) avec l'écran `(tabs)` et l'écran `add-food` (`presentation: 'modal'`, `headerShown: true`, `title: 'Ajouter un aliment'`) ; `app/(app)/(tabs)/_layout.tsx` ne garde que les `Tabs` (Aujourd'hui, Repas avec l'icône `silverware-fork-knife`, `SyncIcon` à droite de l'en-tête) ; `app/_layout.tsx` déclare désormais `<Stack.Screen name="(app)" />` dans la garde `signedIn`. `app/(app)/(tabs)/index.tsx` passe `onAddMeal={() => router.push({ pathname: '/add-food', params: { meal: defaultMeal(hourOfDay(clock.now(), profile.timezone)) } })}` et `onOpenMeals={() => router.navigate('/repas')}` ; `app/(app)/(tabs)/repas.tsx` rend `MealsScreen` (`onAdd={(meal) => router.push({ pathname: '/add-food', params: { meal } })}`) ; `app/(app)/add-food.tsx` lit `meal` (valeur invalide → `snack`) avec `useLocalSearchParams`, rend `AddFoodScreen` et `onDone={() => router.back()}`. Les routes typées (`experiments.typedRoutes`) doivent compiler : exécuter `npx expo customize tsconfig.json` ou lancer `npx expo start` brièvement n'est pas nécessaire ; si `router.push` se plaint des chemins, caster le chemin en `as never` avec un commentaire.

README : mettre à jour la section d'état (M0, M1 et M2) et rappeler que M2 ajoute du code natif (`expo-sqlite`) : refaire `npm run android` après la mise à jour.

- [ ] **Step 4: Vérification complète**

Run: `npm test && npm run typecheck && npm run lint && npm run lint:deps && npm run test:emulator && npx expo-doctor`
Expected: tout passe, sortie sans avertissement. Puis `npx expo export --platform android --output-dir /private/tmp/claude-501/-Users-nugah-Desktop-42-Genki/0075675a-187a-4db4-9845-65f77c31d0a1/scratchpad/export-m2` doit réussir (le contrôleur lance ensuite le build Gradle natif).

- [ ] **Step 5: Commit**

```bash
git add -A src app README.md
git commit -m "feat: Calories and protein gauges, Meals tab and add-food modal wired into the app (M2)"
```

---

## Vérification finale (contrôleur)

- [ ] `npm run lint && npm run typecheck && npm test && npm run lint:deps && npm run test:emulator && npx expo-doctor` : tout passe.
- [ ] Build natif de contrôle : `npx expo prebuild --platform android` (faux `google-services.dev.json` dans une copie du dépôt) puis `./gradlew assembleDebug` avec le JDK d'Android Studio : doit réussir (expo-sqlite ajoute du code natif).
- [ ] Revue finale de toute la branche, et revue ponytail du code inutile.
- [ ] Points à vérifier sur téléphone (à ajouter au README) : la base Ciqual s'ouvre et la recherche répond ; ajout hors-ligne d'un repas sur deux téléphones → somme des calories ; la modification et la suppression d'une ligne ; le texte « traces »/« < x » n'apparaît nulle part.
