# Fiche d'un aliment, produits de marque et scan : conception

Date : 2026-11-01. Suite de `2026-11-01-suivi-mensuel-micronutriments-design.md` (chantiers A, la période Mois, et B, les micronutriments). Deux chantiers de plus, chacun avec son plan et sa revue : **C. la fiche d'un aliment à la Cronometer**, puis **D. les produits de marque (recherche et scan de code-barres)**. Ordre complet : A → B → C → D ; C utilise les fibres de B (glucides nets), D utilise la fiche de C et les nutriments de B.

## 1. Ce que veut l'utilisateur

- Une fiche d'aliment comme celle de Cronometer : quantité et taille de portion, **groupe** (petit-déjeuner, déjeuner, dîner, collations), **heure et jour** modifiables, **ligne « source de données »**, **anneau** de l'énergie avec la répartition protéines, glucides nets, lipides, et **objectifs de macros** (énergie, protéines, glucides nets, lipides).
- **Une seule barre de recherche** qui remonte par pertinence les aliments de Ciqual et les **produits de marque** (« coca » : canette, bouteille, Zéro…), avec la **quantité sur une ligne sous le nom**.
- **Scanner le code-barres** d'un produit.
- **Sources : Ciqual (ANSES) et Open Food Facts seulement.** Pas d'USDA ni d'autre base (choix de l'utilisateur). Les bases de Cronometer qui sont sous licence payante (NCCDB, Nutritionix) ne sont pas accessibles.

## 2. Chantier C : la fiche

### 2.1 Objectifs de macros (réglages)
- `Profile.goals` gagne **`carbsNetG`** (glucides nets) et **`fatG`** (lipides), à côté de `kcal`, `proteinG`, `waterMl`, `steps`.
- Valeurs par défaut et proposition (`proposeGoals`) : lipides à **30 % des calories** (÷ 9 pour les grammes, arrondis à 5 g) ; glucides nets : le **reste** des calories après les protéines et les lipides (÷ 4, arrondis à 5 g). Pour 2 200 kcal et 130 g de protéines : 75 g de lipides, 255 g de glucides nets.
- Bornes (domaine et règles Firestore) : lipides 0–500 g, glucides nets 0–1 000 g. `isGoals` accepte les deux clés ; l'écran Objectifs et la première configuration affichent six champs (calories, protéines, glucides nets, lipides, eau, pas).
- **Glucides nets = glucides − fibres.** Sans la valeur des fibres (aliment sans nutriments), les glucides nets valent les glucides et la fiche marque « partiel ».

### 2.2 La fiche (`FoodDetail`)
De haut en bas :
1. **Nom et marque**, **ligne de source** : « Ciqual (ANSES) », « Open Food Facts » ou « Mon aliment ».
2. **Quantité** (grammes, modifiable) et **taille de portion** (puces : « 100 g », « 1 canette 33 cl »…).
3. **Groupe** : un sélecteur à quatre segments, pré-choisi d'après l'heure comme aujourd'hui (`defaultMeal`).
4. **Heure et jour** : un sélecteur de date puis d'heure (bibliothèque `@react-native-community/datetimepicker`, module natif). Par défaut, maintenant. **Pas dans le futur**, pas au-delà de 365 jours dans le passé. Le jour de la ligne se calcule avec le fuseau du profil, à partir de l'instant choisi.
5. **Énergie** : un **anneau** (SVG) dont les trois arcs sont la part de l'énergie venant des protéines, des glucides nets et des lipides (4, 4 et 9 kcal par gramme), les **calories de la portion au centre**. Les teintes sont celles des graphiques (`colors.chart`). À côté : les grammes et le pourcentage de chaque macro, en texte (l'anneau n'est jamais seul). Le texte alternatif de l'anneau dit les trois pourcentages.
6. **Objectifs de macros, « avec cette portion »** : quatre lignes (énergie, protéines, glucides nets, lipides) : le total du jour **une fois la portion ajoutée** contre l'objectif, avec une barre fine. Le total du jour est celui des lignes du **jour choisi** à l'étape 4.
7. **Nutriments** (chantier B) : la liste repliable.
8. Le bouton « Ajouter à Déjeuner » (le nom du groupe choisi).

### 2.3 Modifier une ligne du journal
- Aujourd'hui, une ligne se modifie par sa quantité. Désormais **la fiche s'ouvre aussi sur une ligne existante** (quantité, groupe, heure et jour).
- Un changement de **jour** déplace la ligne : l'écriture retire ses macros du total de l'ancien jour et les ajoute à celui du nouveau, **dans le même `writeBatch`** (jamais en deux temps). Les nutriments ne sont pas des totaux stockés (chantier B) : rien d'autre à déplacer.
- Règles Firestore : la mise à jour d'une ligne peut changer `day`, `meal`, `createdAt`, `grams`, `macros`, `nutrients`, `updatedAt` ; les autres champs restent figés ; un horodatage dans le futur est refusé par le domaine (les règles bornent seulement le type).
- Si le total d'un des deux jours manque (document absent), l'écriture le crée par fusion.

### 2.4 Journal
La carte du journal (`MealsScreen`) ajoute « Glucides nets : x / y g » et « Lipides : x / y g » aux calories et protéines.

### 2.5 Tests
- Domaine : répartition de l'énergie (4/4/9), glucides nets avec et sans fibres, proposition des objectifs (30 % de lipides, reste en glucides), instant → jour dans le fuseau (passage de minuit, changement d'heure), refus du futur.
- Adaptateurs (émulateur) : règles des deux nouvelles clés d'objectif ; mise à jour d'une ligne qui change de jour, atomique (les deux totaux justes, ou aucun) ; refus d'une clé inconnue.
- Interface : sélecteur de groupe, de date et d'heure ; anneau (arcs, texte, texte alternatif) ; « avec cette portion » ; modification d'une ligne depuis le journal ; objectifs à six champs.

## 3. Chantier D : produits de marque et scan

### 3.1 Source et stockage
- **Open Food Facts** (base collaborative sous licence ODbL). Produit par code-barres : `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=…` ; recherche par nom : `GET https://search.openfoodfacts.org/search?q=…&langs=fr,en&page_size=30&fields=…` (Search-a-licious ; remplace `cgi/search.pl` le 2026-11-02, qui répondait 503 une fois sur deux à un client anonyme). Son index n'a ni vitamines et minéraux ni portion de l'étiquette : toucher un résultat lit le produit complet (API ci-dessus), avec repli sur les données de la liste. Limites officielles : 10 recherches et 15 lectures de produit par minute. Les champs et les clés ont été **vérifiés sur des réponses réelles** (Coca-Cola 330 ml : `quantity` « 330 ml », `serving_size` « 1 portion (330 ml) », `serving_quantity` 330, `nutriments` avec `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `sugars_100g`, `saturated-fat_100g`, `salt_100g` ; « coca cola » donne 2 279 produits, de 330 ml à 1,5 L).
- **Un produit qu'on utilise devient un aliment à soi** : un document `foods/{id}` avec en plus `source: 'off'`, `brand`, `barcode`, et `nutrients` (chantier B). Il est donc synchronisé entre les deux téléphones et disponible hors-ligne. Un produit jamais utilisé n'est pas conservé. `FoodRef.type` reste `custom` ; la fiche lit `source` pour la ligne « Open Food Facts ».
- **Règles** : `foods` accepte `source` (`off`), `brand` (texte court), `barcode` (chiffres, 8 à 14), `nutrients` (même carte bornée que pour les lignes).
- **Retrouver un code-barres sans réseau** : on cherche d'abord dans les `foods` de l'utilisateur (`barcode ==`), puis seulement sur Open Food Facts.

### 3.2 Conversion (domaine pur, `fromOpenFoodFacts`)
- Nom : `product_name_fr`, sinon `product_name`, sinon « Produit sans nom » ; marque : la première de `brands`.
- Pour 100 g : calories (`energy-kcal_100g`, sinon `energy-kj_100g` ÷ 4,184), protéines, glucides, lipides. **Un produit sans calories ou sans macros n'est pas proposé** (refus avec un message) : mieux vaut aucune ligne qu'une ligne fausse.
- Nutriments : Open Food Facts exprime les vitamines et minéraux en **grammes** pour 100 g ; conversion vers mg ou µg. Seules les clés du catalogue de B sont gardées. Une valeur absente reste absente.
- Portions : « 100 g » toujours ; la portion de l'étiquette (`serving_size`, `serving_quantity`) et l'emballage (`quantity`, `product_quantity`) quand leur unité se lit (g, kg, ml, cl, l). **1 ml compte pour 1 g** (approximation pour les boissons, dite à l'écran : « ≈ »).
- État : `other` (pas de cru ou cuit pour un produit).

### 3.3 Recherche mélangée
- Une **seule liste**, triée par **pertinence** (fonction pure de score : nom commençant par la requête > mot entier > contient ; la marque compte ; ex æquo : Ciqual, puis aliments perso, puis produits de marque).
- Ciqual et les aliments de l'utilisateur répondent **tout de suite**, hors-ligne. Les produits de marque arrivent quand le réseau répond et **se placent à leur rang** ; une ligne d'attente « Recherche de produits… » reste en bas de la liste pendant l'appel.
- La recherche réseau part après **700 ms sans frappe** et à partir de **3 caractères** ; elle est annulée si la requête change ; un **limiteur côté client** garantit au plus **10 requêtes par minute** (la limite d'Open Food Facts) ; délai d'attente de 8 s.
- Chaque ligne : le nom, et **dessous** la quantité (« 100 g », « 330 ml · Coca-Cola ») ; à droite, un petit libellé de source seulement pour les produits de marque.
- Hors-ligne ou erreur réseau : la liste ne montre que Ciqual et l'utilisateur, avec une ligne « Produits de marque indisponibles pour le moment (hors-ligne ou service occupé) » (texte, annoncé) et un bouton « Réessayer » : le point de recherche anonyme d'Open Food Facts répond parfois 503, constaté à la revue.

### 3.4 Scan
- Un bouton **caméra** dans l'écran d'ajout (`expo-camera`, `CameraView`), types EAN-13, EAN-8, UPC-A, UPC-E. La permission de la caméra n'est demandée **qu'au premier scan** ; un refus affiche comment la rendre dans les réglages d'Android.
- Un code lu : recherche locale, puis Open Food Facts ; la fiche s'ouvre. Un **produit inconnu** propose « Créer un aliment » avec le code-barres déjà rempli. Un produit trouvé sans calories ni macros dit pourquoi il n'est pas proposé. Hors-ligne et produit jamais utilisé : message clair.
- Les **QR codes** ne sont pas lus (ils ne servent pas pour les produits).

### 3.5 Vie privée, licence, politesse envers l'API
- Seuls le **texte cherché** et le **code-barres** partent vers Open Food Facts, sans identifiant du compte. L'en-tête `User-Agent` est `Genki/1.0 (personal app; github.com/Nugahh/Genki)` : **l'e-mail de l'utilisateur n'y figure pas**.
- La mention de la source (Open Food Facts, licence ODbL) s'ajoute dans le README et dans Réglages, à côté de celle de Ciqual. Les produits utilisés restent sous cette licence.
- Le README note la règle pour la suite : ne jamais lancer une recherche à chaque lettre tapée.

### 3.6 Tests
- Domaine : conversion de réponses **enregistrées** (Coca-Cola 330 ml, un produit sans calories, un produit en kJ seulement, un produit avec vitamines en grammes, une portion en cl) ; score de pertinence ; limiteur (11e requête dans la minute refusée ou retardée) ; lecture des quantités.
- Adaptateur : le client Open Food Facts contre un `fetch` simulé (en-tête, champs demandés, délai d'attente, réponse vide, erreur HTTP, JSON invalide).
- Règles et adaptateur Firestore (émulateur) : un aliment avec `source`, `brand`, `barcode`, `nutrients` ; refus d'un code-barres qui n'est pas numérique ou d'une source inconnue ; recherche par `barcode`.
- Interface : liste mélangée qui se réordonne à l'arrivée du réseau, ligne d'attente, ligne « indisponibles hors-ligne », bouton caméra, écran de scan (permission demandée, code lu, produit inconnu), fiche d'un produit.

## 4. Limites et risques
- **Qualité d'Open Food Facts** : base collaborative. Calories et macros presque toujours là ; vitamines et minéraux rares, donc « partiels » pour les produits de marque.
- **Réseau obligatoire** pour un produit nouveau ; ensuite hors-ligne.
- **1 ml = 1 g** pour les portions de boissons : approximation, signalée par « ≈ ».
- **Caméra** : nouveau module natif (`expo-camera`) ; reconstruction du client de développement. Le scan n'est vérifiable que sur un appareil avec caméra ; l'émulateur peut l'imiter, pas l'essayer ici.
- **Sélecteur de date et d'heure** : module natif (`@react-native-community/datetimepicker`), reconstruction du client.
- Un produit modifié ou corrigé sur Open Food Facts ne met pas à jour l'aliment déjà enregistré (principe des valeurs figées de la spec §4.5).

## 5. Hors de cette conception
USDA et autres bases (choix de l'utilisateur), lecture de QR codes, contribution à Open Food Facts (ajout ou correction d'un produit), photo du produit, Nutri-Score ou Eco-Score, listes de courses, aliments perso avec micronutriments saisis à la main.
