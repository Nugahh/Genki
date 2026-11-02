# Compléments (chantier G) : plan d'implémentation

> **Pour les agents :** exécuter tâche par tâche, TDD, une validation et un commit par tâche.

**But :** créer à la main un complément (whey, magnésium, créatine, vitamine D…) avec ses micronutriments, en saisissant les valeurs pour 100 g **ou pour une portion** (une gélule, une mesure).

**Spec :** `docs/superpowers/specs/2026-11-02-onglets-ajout-aliment-design.md` §4.

## Contraintes globales
- Valeurs de l'utilisateur : macros arrondies à 0,1, micronutriments à trois chiffres significatifs (comme partout). Un micronutriment : nombre de 0 à 1 000 000, et pas plus de 100 g pour 100 g quand son unité est le gramme.
- Une portion : poids de 0 (exclu) à 5 000 g. En saisie « pour une portion », l'aliment enregistré a ses valeurs pour 100 g (`per100g`, `nutrients`) et une portion « 1 portion » de ce poids (sauf si une portion du même poids existe).
- Les règles laissent modifier `nutrients` d'un aliment (borné comme à la création) ; retirer tous les micronutriments supprime le champ.
- Textes en français, tutoiement, zones de 48 dp. Les cinq vérifications avant de conclure.

### Tâche 1 : domaine, règles et dépôt
- [ ] Tests : `validateFood` (micronutriments valides, négatif, trop grand, gramme au-delà de 100), dépôt Firestore (modifier, ajouter puis retirer les micronutriments), règles (modification de `nutrients` acceptée, bornes tenues, `source`/`brand`/`barcode` toujours figés).
- [ ] Code : `food.ts`, `firestoreFoodRepository.ts` (`deleteField`), `firestore.rules`.

### Tâche 2 : le formulaire
- [ ] Tests : bascule « Pour 100 g » / « Pour une portion », conversion en valeurs pour 100 g, portion ajoutée, poids de portion invalide, ajout et retrait d'un micronutriment, valeurs d'un aliment à modifier, aliment d'Open Food Facts gardé tel quel, de bout en bout (créer un complément, ouvrir sa fiche, voir ses nutriments).
- [ ] Code : `FoodForm.tsx`, `MicronutrientFields.tsx`.

### Tâche 3 : documents
- [ ] README, `DESIGN.md`, spec principale ; les cinq vérifications ; revue.
