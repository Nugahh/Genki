# Onglets et étoile (chantier E) : plan d'implémentation

> **Pour les agents :** exécuter tâche par tâche, TDD, une validation et un commit par tâche.

**But :** la page « Ajouter un aliment » en trois onglets (Tout, Favoris, Personnalisé) et l'étoile qui met un aliment en favori.

**Architecture :** un composant partagé `Tabs` (rangée d'onglets Material). Une nouvelle collection `starredFoods` servie par un port, un dépôt Firestore et un cas d'usage `starredFoods`. `AddFoodScreen` choisit l'onglet ; `FoodDetail` porte l'étoile.

**Spec :** `docs/superpowers/specs/2026-11-02-onglets-ajout-aliment-design.md` §2 et §3.

## Contraintes globales
- Onglets de 48 dp, trait de 3 dp en Ink sous l'actif, `accessibilityRole` « tab » avec l'état sélectionné, rangée « tablist » ; aucune couleur écrite en dur.
- Étoile : `users/{uid}/starredFoods/{type}_{id}`, champs `foodRef`, `foodName` (200 caractères au plus), `updatedAt` ; suppression par le propriétaire ; incluse dans la sauvegarde JSON.
- Le scan, la recherche unique, la fiche, les produits de marque ne changent pas de comportement. Textes en français, tutoiement.
- Avant de conclure : `npm run lint -- --no-cache`, `npm run typecheck`, `npm test`, `npm run lint:deps`, `npm run test:emulator`.

### Tâche 1 : le composant `Tabs`
- [ ] Tests : trois onglets dans l'ordre, l'actif annoncé « sélectionné », toucher un autre appelle `onChange`, zones de 48 dp, trait sous l'actif seulement.
- [ ] Code : `src/shared/Tabs.tsx`.

### Tâche 2 : les aliments étoilés (données)
- [ ] Tests : cas d'usage (étoiler, retirer, liste triée par nom, étoile déjà là sans doublon), dépôt Firestore et règles (émulateur : créer, relire, supprimer, clé inconnue refusée, autre utilisateur refusé), sauvegarde (la collection est exportée et restaurée).
- [ ] Code : `ports.ts` (`StarredFoodRepository`), `starredFoods.ts` (cas d'usage), dépôts en mémoire et Firestore, règles, `COLLECTIONS` de la sauvegarde, composition.

### Tâche 3 : la page
- [ ] Tests : les trois onglets et l'onglet par défaut (Tout), Récents sous le champ quand rien n'est tapé, le bouton scan à côté du champ, Favoris (liste, vide, ouvrir une fiche, aliment disparu), Personnalisé (pastilles, créer un aliment, repas), l'étoile de la fiche (étoiler, retirer, produit de marque adopté), le vocabulaire « repas ».
- [ ] Code : `AddFoodScreen`, `FoodSearch` (Récents quand le champ est vide, bouton scan), `StarredList`, `CustomFoodsList`, `FoodDetail` (étoile), `MealsScreen` et `FavoritesList` (vocabulaire).

### Tâche 4 : documents
- [ ] README, `DESIGN.md` (onglets, étoile), spec principale. Les cinq vérifications.
