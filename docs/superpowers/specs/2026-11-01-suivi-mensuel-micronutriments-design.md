# Période Mois et micronutriments : conception

Date : 2026-11-01. Complète la spec principale (`2026-10-23-fitness-tracker-design.md`, §6 Suivi, §9 règles du domaine). Deux chantiers, chacun avec son plan et sa revue : **A. la période Mois** (tout le Suivi), puis **B. les micronutriments**. Le scan de code-barres est un troisième chantier, conçu après (il a besoin du modèle de nutriments de B).

## 1. Ce que veut l'utilisateur

- Voir les **vitamines, minéraux et autres nutriments** de ce qu'il mange, comme dans Cronometer : sur la fiche d'un aliment, dans le journal du jour, et dans le Suivi, avec le **pourcentage de l'apport de référence**.
- Voir ces nutriments **par jour, par semaine et par mois**. La période **Mois s'ajoute** à Jour, Semaine et Année, pour **toutes** les statistiques du Suivi (calories, eau, pas, poids, tabac…), pas seulement pour les nutriments.
- Repères **selon son profil** (sexe, âge), d'après l'ANSES.
- Choix explicites de la conception : ~25 nutriments, pas de vue Année pour les nutriments, pas de rattrapage des repas déjà saisis, aliments perso sans micronutriments.

## 2. Chantier A : la période Mois

### Comportement
- `Period` devient `'day' | 'week' | 'month' | 'year'`. Le sélecteur affiche **Jour · Semaine · Mois · Année**, partagé par tous les écrans du Suivi (`ui.period`, règles Firestore et validation comprises). La valeur par défaut reste Semaine.
- Un mois est le **mois calendaire** de la date choisie : **une barre par jour** (28 à 31). Les flèches reculent de mois en mois, la flèche suivante est désactivée sur le mois en cours. Titre : « novembre 2026 ».
- Comme pour la semaine : le jour en cours est en pointillé, les moyennes et décomptes « dans la cible » ne comptent que les **jours terminés**, la période d'avant sert à la variation (« par rapport au mois précédent »).
- Étiquettes sous les barres : le numéro du jour (1…31), **une sur cinq** (1, 6, 11…) pour rester lisible ; le texte lu à voix haute dit « 3 novembre ». La largeur d'une barre se déduit de la place disponible (une barre de ~7 dp sur 360 dp est acceptable : le graphique reste en barres fines).
- Le sélecteur passe en deux rangées de deux (Jour · Semaine, Mois · Année), comme l'ajout d'aliment : sur 360 dp, quatre segments en ligne coupent « Semaine » (82 dp par segment pour 88 dp de libellé et de marges), et la coche du segment choisi n'y tient pas non plus. À vérifier sur appareil.

### Domaine (`tracking/domain/period.ts`)
`bucketsFor('month', anchor)` : un seau par jour du mois (`key` = jour, `label` = numéro, `spoken` = « 3 novembre »). `shiftAnchor('month', anchor, ±1)` : même quantième le mois d'à côté, ramené au dernier jour si le mois est plus court. `periodTitle('month', anchor)` : « novembre 2026 ». `rangeOf` et le reste sont inchangés. Les tests couvrent février bissextile, le 31 qui recule vers un mois de 30 jours, le passage d'année.

### Données
La lecture de la période et de la précédente couvre ~62 jours : chaque statistique du hub lit ~62 documents `days` (≈ 6 cartes × 62 = ~370 lectures à l'ouverture sur Mois, servies par le cache local ensuite). C'est acceptable ; pas de changement de source.

## 3. Chantier B : les micronutriments

### 3.1 Nutriments suivis (25) et codes Ciqual
Les codes sont ceux de la table Ciqual 2025 (`const_2025_11_03.xml`), vérifiés dans le fichier. Le pourcentage est la part des 3 484 aliments qui ont une valeur.

| Nutriment | Unité | Code Ciqual | Couverture |
|---|---|---|---|
| Fibres | g | 34100 | 98 % |
| Sucres | g | 32000 | 94 % |
| Graisses saturées | g | 40302 | 93 % |
| Sel | g | 10004 | 95 % |
| Vitamine A (équivalents rétinol) | µg | 51104 | 55 % |
| Vitamine D | µg | 52100 | 62 % |
| Vitamine E (alpha-tocophérol, sinon vitamine E) | mg | 71010, sinon 53100 | 50 % / 17 % |
| Vitamine K (K1) | µg | 54101 | 45 % |
| Vitamine C | mg | 55100 | 69 % |
| Vitamine B1 (thiamine) | mg | 56100 | 72 % |
| Vitamine B2 (riboflavine) | mg | 56200 | 71 % |
| Vitamine B3 (niacine) | mg | 56310 | 73 % |
| Vitamine B5 | mg | 56400 | 67 % |
| Vitamine B6 | mg | 56500 | 73 % |
| Vitamine B9 (folates totaux) | µg | 56700 | 44 % |
| Vitamine B12 | µg | 56600 | 62 % |
| Calcium | mg | 10200 | 78 % |
| Fer | mg | 10260 | 76 % |
| Magnésium | mg | 10120 | 74 % |
| Potassium | mg | 10190 | 75 % |
| Zinc | mg | 10300 | 74 % |
| Sélénium | µg | 10340 | 60 % |
| Iode | µg | 10530 | 61 % |
| Phosphore | mg | 10150 | 73 % |
| Cuivre | mg | 10290 | 71 % |
| Manganèse | mg | 10251 | 69 % |

(26 lignes : le manganèse et le cuivre complètent la liste de départ ; « ~25 » du choix de l'utilisateur.) Le sodium n'est pas suivi à part : le sel le remplace.

**Une case vide dans Ciqual (« - ») est une valeur absente, jamais zéro.** « traces » et « < x » valent 0 (comme dans le convertisseur actuel).

### 3.2 Repères d'apport (domaine pur, `nutrition/domain/references.ts`)
Source : ANSES, *Actualisation des repères du PNNS : élaboration des références nutritionnelles* (2016), tableaux 26 (hommes) et 27 (femmes) ; la **RNP** quand elle existe, sinon l'**apport satisfaisant (AS)**. Repères pour **adultes de 18 ans et plus** ; sous 18 ans, aucune référence n'est proposée (« repères pour adultes »).

| Nutriment | Homme | Femme | Remarque |
|---|---|---|---|
| Vitamine A | 750 µg | 650 µg | RNP |
| Vitamine D | 15 µg | 15 µg | RNP |
| Vitamine E | 10,5 mg | 9,9 mg | AS |
| Vitamine K | 70 µg | 70 µg | AS de l'EFSA (2017) : l'ANSES n'en fixe pas |
| Vitamine C | 110 mg | 110 mg | RNP |
| Vitamine B1 | 1,5 mg | 1,2 mg | AS |
| Vitamine B2 | 1,8 mg | 1,5 mg | AS |
| Vitamine B3 | 17,4 mg | 14 mg | RNP (équivalents niacine) |
| Vitamine B5 | 5,8 mg | 4,7 mg | AS |
| Vitamine B6 | 1,8 mg | 1,5 mg | AS |
| Vitamine B9 | 330 µg | 330 µg | RNP (équivalents folate alimentaire) |
| Vitamine B12 | 4 µg | 4 µg | AS |
| Calcium | 1000 mg avant 25 ans, 950 mg ensuite | idem | RNP |
| Fer | 11 mg | 11 mg | RNP ; 16 mg pour une femme à pertes élevées : non géré |
| Magnésium | 420 mg | 360 mg | AS |
| Potassium | 3510 mg | 3510 mg | repère de l'OMS (2012) : l'ANSES le renvoie à un rapport Na/K de 1 |
| Zinc | 11,7 mg | 9,3 mg | RNP pour une alimentation à 600 mg de phytates par jour (valeur médiane de l'ANSES) |
| Sélénium | 70 µg | 70 µg | AS |
| Iode | 150 µg | 150 µg | AS |
| Phosphore | 700 mg | 700 mg | AS |
| Cuivre | 1,3 mg | 1 mg | RNP |
| Manganèse | 2,8 mg | 2,5 mg | AS |
| Fibres | 30 g | 30 g | apport optimal chez l'adulte (ANSES) |
| **À limiter** | | | |
| Sel | 5 g | 5 g | correspond au sodium de 2 000 mg retenu par l'ANSES pour un rapport Na/K de 1 |
| Graisses saturées | 12 % de l'objectif de calories (÷ 9 pour les grammes) | idem | repère de l'ANSES sur les lipides |
| Sucres | 100 g | 100 g | repère du PNNS (hors lactose) ; Ciqual compte le lactose : indicatif |

- Les repères sont des **valeurs fixes du code**, citées avec leur source en commentaire, couvertes par des tests. Aucun n'est réglable depuis l'interface (comme les garde-fous de la spec §9).
- Un nutriment est « **à atteindre** » (vitamines, minéraux, fibres) ou « **à limiter** » (sel, graisses saturées, sucres).
- L'application n'est pas un avis médical (rappel de la spec §9, affiché sous la vue Micronutriments).

### 3.3 Couleur et lecture
- À atteindre : vert à partir de 90 % du repère, orange de 60 à 89 %, rouge en dessous (comme les graphiques du Suivi).
- À limiter : vert jusqu'à 100 %, orange jusqu'à 120 %, rouge au-delà.
- **Jamais la couleur seule** : chaque ligne porte son pourcentage en texte, lu à voix haute avec l'état (« dans la cible », « loin de la cible »).
- Une valeur **partielle** (au moins un repas du jour n'a pas ce nutriment, ou le repas est antérieur à la mise à jour) s'écrit « au moins 12 mg » et la barre est marquée « partiel ». Le pourcentage d'un total partiel est un **minimum**, jamais coloré en rouge pour ce seul motif : la couleur d'un nutriment partiel reste neutre tant qu'il n'a pas atteint son repère.

### 3.4 Données
- **Base Ciqual** : le convertisseur (`scripts/ciqual/convert.ts`) garde les 26 constituants du tableau 3.1 en plus des 5 actuels. Les fichiers sources sont téléchargés de data.gouv.fr (DOI 10.57745/RDMHWY), la base régénérée porte une nouvelle version (le nom du fichier en change : l'application recopie la nouvelle). Chaque aliment gagne une colonne `nutrients` (JSON de `{ id: valeur pour 100 g }`, absent si inconnu). Taille attendue : ~0,5 Mo → ~1,5 Mo.
- **Une ligne du journal** (`foodEntries`) gagne un champ optionnel `nutrients: { [id]: number }` : les valeurs de **la portion**, figées à la saisie (principe de la spec §4.5). Changer la quantité met ces valeurs à l'échelle, avec **trois chiffres significatifs** (les microgrammes d'une vitamine s'arrondissent mal à 0,1).
- **Aliments perso** (`foods`) : pas de nutriments, leurs lignes n'en ont pas et comptent comme partielles. **Repas favoris** : chaque ligne garde ses nutriments.
- **Règles Firestore** : `nutrients` est une carte aux clés limitées à la liste des 26 identifiants, chaque valeur un nombre de 0 à 1 000 000.
- **Aucun total stocké** : le total du jour se calcule avec les lignes du jour déjà chargées ; le total d'une semaine ou d'un mois, par **une requête de plage** sur `foodEntries` (champ `day`, sans index composite : on écarte côté client les lignes supprimées). Rien à recalculer, rien à faire dériver.

### 3.5 Suivi
- **Nouvelle source de faits** `meals` (`tracking`) : les nutriments de chaque jour (somme de ses lignes), avec pour chacun un drapeau « partiel ». Elle s'ajoute à `days`, `training` et `tobacco`.
- **Registre** : un `MetricDefinition` par nutriment, **généré** à partir du catalogue (section `micro` « Micronutriments », source `meals`, repère selon le profil, `dayCompare: false`). Les nutriments n'ont pas de carte sur le hub (le mois remplace l'année, et une carte ne dirait pas qu'un total est partiel). Un jour avec des repas dont aucun n'a le nutriment compte 0 (un minimum, marqué partiel) : la moyenne reste une borne basse. `Goals` reçoit les repères du profil (sexe, âge, objectif de calories pour les graisses saturées).
- **Écran** : dans Suivi › Nutrition, un bouton « Micronutriments » sous la répartition de l'énergie (la rubrique `micro` n'a pas de puces : 26 nutriments se choisissent dans la liste). Il montre la liste groupée (À atteindre : Vitamines, Minéraux, Fibres ; À limiter) avec une barre fine en % ; jour : le total ; semaine ou mois : la moyenne des jours terminés qui ont des repas. Toucher un nutriment ouvre sa courbe par jour (barres, ligne de repère, résumé) dans l'écran de section existant.
- **Fiche d'un aliment** : une liste repliable « Nutriments » pour la portion choisie, avec le pourcentage du repère.
- **Journal du jour** : une carte « Nutriments du jour » (les trois moins couverts par rapport à leur repère) qui ouvre la vue Micronutriments du jour.

## 4. Erreurs et limites
- Profil sans sexe ou âge valides, ou moins de 18 ans : la vue Micronutriments affiche les totaux sans pourcentage, avec la mention « repères pour adultes ».
- Les repas saisis **avant** la mise à jour n'ont pas de nutriments : ils comptent comme partiels (pas de rattrapage, choix de l'utilisateur).
- Beaucoup d'aliments Ciqual n'ont pas la vitamine E, K, B9 : leurs totaux sont souvent partiels. C'est dit à l'écran, pas caché.
- Pas de vue Année pour les nutriments (lecture de ~2 000 repas ; choix de l'utilisateur).
- Pas de nutriments pour les aliments perso (champs optionnels plus tard si besoin).
- Valeurs de référence : un avis de l'ANSES plus récent pourrait les réviser ; la table est une constante du code, mise à jour avec un test.

## 5. Tests
- **Domaine** : conversion Ciqual (valeurs absentes, traces, vitamine E de repli), mise à l'échelle des nutriments, somme avec drapeau partiel, choix du repère par sexe et âge (calcium avant et après 25 ans), tons à atteindre et à limiter, le Mois (février bissextile, fin de mois, passage d'année).
- **Adaptateurs** (émulateur) : règles de `nutrients` (clé inconnue, valeur négative, trop grande), requête de plage sur `foodEntries`.
- **Interface** : le sélecteur à quatre périodes, le graphique de 31 barres et ses étiquettes, la vue Micronutriments (groupes, partiel, couleur et texte), la fiche d'un aliment, la carte du journal.
- **Régénération de la base** : un test vérifie que chaque identifiant du catalogue correspond à un code Ciqual du convertisseur.

## 6. Hors de cette conception
Scan de code-barres (conçu ensuite, avec Open Food Facts), rattrapage des anciens repas, vue Année des nutriments, nutriments des aliments perso, repères pour les moins de 18 ans, régimes particuliers (pertes de fer élevées, grossesse), réglage des repères par l'utilisateur.
