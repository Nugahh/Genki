# La page « Ajouter un aliment » en trois onglets : conception

Date : 2026-11-02. Brief établi avec le skill Impeccable (`shape`), puis confirmé par l'utilisateur (« fais-le »). Trois chantiers, chacun avec son plan, sa revue et sa fusion : **E** les onglets et l'étoile, **G** les compléments, **F** les repas et les recettes.

## 1. Ce que veut l'utilisateur
Une page à la Cronometer : des onglets **Tout**, **Favoris**, **Personnalisé** (créer un repas, une recette, un aliment). Retrouver des compléments (whey ESN, magnésium…) dans la recherche, ou les créer soi-même.

## 2. Décisions
- **Favoris** = les aliments marqués d'une **étoile** sur leur fiche. Les repas enregistrés d'aujourd'hui (« favoris » du journal) passent sous Personnalisé › **Repas** et se nomment « repas » partout.
- **Recettes complètes** : ingrédients en grammes, poids final après cuisson, nombre de portions ; la recette devient un aliment par 100 g.
- **Compléments à la main** avec micronutriments dans « Créer un aliment », saisie pour 100 g **ou pour une portion** dont on donne le poids. La règle sur Open Food Facts ne change pas (un produit sans calories ni macros n'est pas proposé) : la whey y est, le magnésium et la créatine presque jamais.
- **Onglets** : une rangée de trois onglets de 48 dp, libellé en Ink, trait de 3 dp en Ink sous l'onglet actif (pas de bleu en plus), état « sélectionné » annoncé.

## 3. Chantier E : onglets et étoile
- **Tout** : le champ de recherche et, à côté, le bouton scan (icône de 48 dp) ; les filtres Tous / Cru / Cuit ; les résultats. Sans texte tapé, la liste montre **Récents** (aujourd'hui un onglet à part) avec la dernière quantité.
- **Favoris** : les aliments étoilés, chacun ouvrant sa fiche. Vide : « Touche l'étoile sur la fiche d'un aliment pour le retrouver ici. »
- **Personnalisé** : deux pastilles **Aliments · Repas** (Recettes s'y ajoute au chantier F), la liste correspondante, et un bouton tonal en tête (« Créer un aliment » ; « Créer un repas » arrive avec F). Repas : toucher une ligne ajoute ses aliments au repas de l'écran, comme avant ; la corbeille la supprime.
- **Étoile** sur la fiche, à côté du nom (48 dp, « Mettre en favori » / « Retirer des favoris »). Un produit de marque pas encore à soi devient un aliment à soi quand on l'étoile.
- **Données** : `users/{uid}/starredFoods/{type}_{id}` = `foodRef`, `foodName`, `updatedAt`. Créer = étoiler, supprimer = retirer (comme `favoriteMeals`). Règles : créer et modifier avec ces trois champs, supprimer. Inclus dans la sauvegarde JSON.
- **Vocabulaire** : « Enregistrer comme favori » devient « Enregistrer comme repas », « Nom du favori » « Nom du repas », « Supprimer le favori » « Supprimer le repas ».

## 4. Chantier G : compléments
- Le formulaire « Créer un aliment » gagne **Valeurs pour : 100 g | 1 portion de [ ] g** (les macros et les micronutriments sont convertis en valeurs pour 100 g à l'enregistrement) et une section **Micronutriments** : « Ajouter un micronutriment » ouvre la liste des 26, chacun une ligne (nom, unité, montant) qu'on retire.
- Les règles de modification d'un aliment acceptent `nutrients` (bornés comme à la création). Les micronutriments d'un aliment à soi comptent dans le Suivi comme ceux de Ciqual.

## 5. Chantier F : repas et recettes
- Un **sélecteur d'ingrédients** réutilisable (recherche, récents, favoris, quantité en grammes).
- **Créer un repas** : un nom et des aliments en grammes (modèle des repas actuels).
- **Créer une recette** : nom, ingrédients en grammes, poids final (par défaut la somme), nombre de portions. L'aliment obtenu : macros pour 100 g = totaux ÷ poids final × 100 ; une portion = poids final ÷ portions ; **un micronutriment n'y figure que si tous les ingrédients l'ont** (un total qui sous-estimerait en silence serait faux). La recette garde sa liste d'ingrédients pour être modifiée.
- Personnalisé gagne la pastille **Recettes**.

## 6. Hors de cette conception
Étoile dans les résultats de recherche, modification d'un repas enregistré, recettes imbriquées, ordre manuel des favoris, import d'une recette depuis une page web.
