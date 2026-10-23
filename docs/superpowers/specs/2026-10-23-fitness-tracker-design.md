# Application de suivi sport, alimentation et hydratation : spécification de design

Date : 2026-10-23
Statut : en attente de relecture
Emplacement conseillé dans le dépôt : `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md`

---

## 1. Contexte et objectifs

### Besoin
Reprendre le sport après dix ans sans pratique (ancien niveau élevé : parkour, basket, handball, gymnastique), perdre de la graisse (notamment viscérale), reconstruire force, volume et explosivité sans perdre en agilité, et arrêter de fumer. Les priorités du suivi sont, dans l'ordre : hydratation et alimentation, puis le programme d'entraînement, puis le reste (poids, pas, tabac).

### Outil visé
Une application mobile personnelle, Android d'abord, iPhone ensuite, utilisable sur deux téléphones avec synchronisation automatique et fonctionnement hors-ligne. L'accès depuis un PC n'est pas un objectif du MVP.

### Critères de réussite
1. L'application s'ouvre chaque jour sans friction et une seule saisie (un tap) suffit pour l'eau et les repas habituels.
2. L'écran d'accueil montre en un coup d'œil où en sont l'eau, les calories, les protéines, les pas, le poids, les jours sans tabac et la séance du jour.
3. Chaque séance affiche les charges de la dernière fois pré-remplies, et l'application indique la charge à viser.
4. Les données sont identiques sur deux téléphones et rien n'est perdu en cas de perte d'un appareil.
5. Tout fonctionne sans réseau (salle de sport) et se synchronise au retour du réseau.

### Contraintes
- Usage personnel d'abord, mais toutes les données sont rangées sous un `uid` pour pouvoir inviter des amis plus tard.
- Développeur unique, coût d'exploitation nul (formule gratuite Spark de Firebase).
- Données de santé : confidentialité par défaut, région européenne.
- Hexagonale et modules étanches dans l'application, pour pouvoir brancher et débrancher des fonctions.
- Interface en français, unités métriques (kg, cm, L, kcal), dates au format français.

---

## 2. Périmètre

### Dans le MVP (jalons M0 à M6)
- Alimentation : base Ciqual embarquée, variantes cru et cuit, portions, aliments personnalisés, favoris et repas types, journal par repas.
- Hydratation : ajout rapide en un tap, contenants personnalisables.
- Entraînement : programme en phases, journal de séance avec pré-remplissage, progression suggérée, paliers (jalons chiffrés).
- Suivi : poids, tour de taille, pas, tabac, calories et macros, volume d'entraînement, avec vues Jour, Semaine, Année et stats personnalisables.
- Écran « Aujourd'hui » avec jauges en barres colorées selon le rythme, tous les indicateurs cliquables.
- Pas via Health Connect (Fitbit ou téléphone), bouton de synchro manuel, réglages de source.
- Export et import JSON, objectifs avec garde-fous.

### Hors MVP
- Arbre de compétences façon parkour.
- Assistant LLM (un port `Assistant` est prévu, sans implémentation).
- Amis et multi-utilisateurs (les règles de sécurité et le modèle le permettent déjà).
- Google Health API (adaptateur futur, voir section 8).
- iPhone : jalon M7 (HealthKit, connexion avec Apple).
- Scan de code-barres (Open Food Facts, adaptateur futur de `FoodCatalog`).
- Lecture du poids depuis une balance connectée via Health Connect.
- Plan Blaze, sauvegardes gérées et récupération à un instant donné.

### Il n'y a pas de backend ni d'API REST
L'application parle directement à Firestore par le SDK. REST n'apparaîtra que comme client de services tiers si on les ajoute un jour.

---

## 3. Décisions d'architecture

| Sujet | Choix | Raison |
|---|---|---|
| Client | Expo (React Native), TypeScript strict, build de développement natif | Un code pour Android et iPhone, et Firebase natif et Health Connect exigent du code natif (pas Expo Go) |
| Interface | React Native Paper (Material 3), Reanimated et Skia pour les animations, Victory Native pour les graphiques | Composants prêts à l'emploi, look Android natif, couleur dynamique possible avec `expo-material3-theme` |
| Données et synchro | Cloud Firestore avec persistance locale (React Native Firebase) | Hors-ligne et synchro de deux téléphones sans serveur à écrire |
| Formule Firebase | Spark (gratuite) | Tout le MVP tient dans les quotas gratuits, aucune fonction serveur |
| Région | Paris, `europe-west9` (région simple) | Données en France, choix définitif à la création de la base |
| Authentification | Firebase Auth, connexion Google | Un compte, deux téléphones |
| Pas et santé | Health Connect (Android) derrière le port `HealthDataSource`, HealthKit en M7 | Pas de serveur, pas de validation Google |
| Aliments | Table Ciqual de l'Anses convertie en base SQLite embarquée, lecture seule | Recherche instantanée et hors-ligne, 0 lecture Firestore |
| Architecture du code | Hexagonale dans l'application, modules étanches, un fichier `composition.ts` qui assemble tout | Flexibilité et testabilité sans conteneur d'injection |

### Alternatives écartées
- FastAPI et PostgreSQL sur Lightsail : environ 12 $ par mois, et la synchro hors-ligne serait à écrire.
- Flutter et Kotlin ou Swift natifs : mêmes capacités, mais Expo a été retenu pour TypeScript et la rapidité d'un MVP solo.
- PWA et Next.js : le besoin est mobile, avec accès natif à la santé.
- Google Health API : accès fermé aux nouveaux projets, validation de sécurité et serveur requis. L'ancienne API Fitbit s'éteint le 30 octobre 2026.
- Microservices : coût et complexité sans bénéfice pour un seul utilisateur. L'isolement des fonctions vient des modules.
- Django et autres frameworks serveur : sans objet, puisqu'il n'y a pas de serveur.

---

## 4. Modèle de données Firestore

Tout est rangé sous `users/{uid}`. Les identifiants sont des UUID générés par l'application pour pouvoir créer des données hors-ligne sans collision.

### Document `users/{uid}` (profil)
`timezone` (défaut `Europe/Paris`), `sex` (`male` ou `female`, pour la formule des objectifs), `birthYear`, `heightCm`, `activityLevel` (`sedentary`, `light` ou `active`), `goals` (`kcal`, `proteinG`, `waterMl`, `steps`), `quitDate` (optionnel), `cigarettesPerDay` (optionnel), `packSize` (défaut 20), `packPrice` (optionnel), `ui` (`hubMetrics` : liste ordonnée d'identifiants de métriques, `period` : `day`, `week` ou `year`), `waterContainers` (liste de `{ label, ml }`, défaut 250 et 500), `createdAt`.

### Sous-collections

| Collection | Champs principaux |
|---|---|
| `foods/{id}` | `name`, `state` (`raw`, `cooked`, `other`), `per100g` (`kcal`, `protein`, `carbs`, `fat`), `portions` (liste de `{ label, grams }`), `updatedAt`, `deletedAt` |
| `foodEntries/{id}` | `day`, `meal` (`breakfast`, `lunch`, `dinner`, `snack`), `foodRef` (`{ type: 'ciqual' ou 'custom', id }`), `foodName`, `grams`, `macros` (`kcal`, `protein`, `carbs`, `fat`, figées à la saisie), `createdAt`, `updatedAt`, `deletedAt` |
| `favoriteMeals/{id}` | `name`, `items` (liste de `{ foodRef, foodName, grams }`), `updatedAt` |
| `waterEntries/{id}` | `day`, `ml`, `createdAt`, `deletedAt` |
| `days/{YYYY-MM-DD}` | `waterMl`, `kcal`, `proteinG`, `carbsG`, `fatG`, `steps`, `stepsSource`, `stepsSyncedAt`, `weightKg`, `waistCm`, `updatedAt` |
| `plans/{id}` | `name`, `active`, `phases` (liste de `{ name, weeks, sessions: [{ name, exercises: [{ exerciseId, name, sets, reps, incrementKg }] }] }`) |
| `workoutLogs/{id}` | `day`, `planId`, `sessionName`, `exerciseIds` (liste), `sets` (liste de `{ exerciseId, setNo, reps, kg }`), `durationMin`, `createdAt`, `deletedAt` |
| `milestones/{id}` | `metric`, `target`, `direction` (`up` ou `down`), `label`, `achievedAt` |
| `cravings/{id}` | `day`, `createdAt`, `resisted` (booléen) |
| `devices/{id}` | `name`, `stepsWriter` (booléen), `lastStepsSyncAt` |

### Règles de modélisation
1. **Les entrées sont des ajouts** : repas, verres d'eau, séries et envies sont créés une fois avec leur UUID. Deux téléphones ne se marchent donc pas dessus.
2. **Totaux du jour dérivés** : `days/{date}` contient des compteurs mis à jour par `increment()` dans le même lot d'écriture que l'entrée. Chaque module n'écrit que ses propres champs (nutrition : `kcal` et macros, hydratation : `waterMl`, activité : `steps`, corps : `weightKg` et `waistCm`).
3. **Suppressions douces** : supprimer une entrée pose `deletedAt` et décrémente les totaux dans le même lot. Les requêtes ignorent les entrées supprimées.
4. **Jour de l'entrée** : le champ `day` est calculé à la création avec le fuseau du profil, jamais avec celui du téléphone, pour qu'un repas à 23h50 reste dans le bon jour.
5. **Macros figées** : corriger un aliment ne réécrit pas l'historique.
6. **Pré-remplissage des séances** : « dernière séance contenant l'exercice X » est la requête `workoutLogs` avec `exerciseIds array-contains X`, tri `day` décroissant, limite 1. Elle exige un index composite déclaré dans `firebase/firestore.indexes.json`.
7. **Ciqual n'est pas dans Firestore** : il est embarqué dans l'application. Une entrée y renvoie par `foodRef = { type: 'ciqual', id }`.
8. **Poids et tour de taille** : un champ par jour dans `days/{date}`, saisis à la main.

---

## 5. Architecture de l'application (hexagonale)

### Arborescence
```
src/
  modules/
    nutrition/   domain/  application/  adapters/  ui/
    hydration/   ...
    training/    ...
    body/        poids et tour de taille
    activity/    pas et sources de santé
    tobacco/     jours sans fumer, envies, économies
    stats/       lecture seule : registre de métriques, hub, détails
    today/       écran d'accueil (agrège les autres modules)
    settings/    profil, objectifs, export et import
  shared/        horloge (fuseau du profil), UUID, types communs
  platform/      Firebase, base Ciqual locale, Health Connect, notifications
  composition.ts assemble adaptateurs et cas d'usage
app/             écrans et routes Expo Router
firebase/        règles, index, configuration des émulateurs
docs/            spec, plan, décisions d'architecture
```

### Couches d'un module
- `domain/` : TypeScript pur, sans Firebase ni React.
- `application/` : cas d'usage (`logMeal`, `addWater`, `finishWorkout`, `syncSteps`…) et ports (interfaces).
- `adapters/` : implémentations des ports (Firestore, SQLite, Health Connect) et versions en mémoire pour les tests.
- `ui/` : écrans et hooks React Native.

### Ports
`FoodCatalog`, `FoodRepository`, `FoodEntryRepository`, `WaterRepository`, `PlanRepository`, `WorkoutRepository`, `MilestoneRepository`, `BodyMetricsRepository`, `DayTotalsRepository`, `CravingRepository`, `SettingsRepository`, `HealthDataSource`, `Clock`, `Notifier`, et `Assistant` (déclaré, non implémenté).

### Règles de fonctionnement
1. Un module n'importe jamais les internes d'un autre. Il passe par son interface publique ou par des événements (`MealLogged`, `WaterAdded`, `WorkoutCompleted`, `StepsSynced`). L'écran Aujourd'hui et les paliers les écoutent. `dependency-cruiser` fait respecter cette règle dans la CI.
2. Les dépôts exposent une méthode `observe` : l'interface se met à jour instantanément, même hors-ligne, parce que Firestore notifie aussi les écritures locales.
3. Toutes les écritures multi-documents sont des lots (`writeBatch`), jamais des transactions.
4. Pas de conteneur d'injection de dépendances : `composition.ts` branche tout à la main.
5. Le code reste léger pour le CRUD pur (programmes, paliers) : un dépôt et un cas d'usage simples. L'effort d'architecture va aux calculs ayant de vraies règles (nutrition, progression, stats, couleur des jauges).

---

## 6. Écrans et navigation

### Navigation
Barre du bas à quatre onglets : Aujourd'hui, Repas, Sport, Suivi. Les réglages s'ouvrent par l'icône en haut à droite. Une icône nuage indique l'état de synchro : à jour, en attente (écritures non envoyées), hors-ligne ou erreur. L'état se déduit des métadonnées des snapshots (`hasPendingWrites`, `fromCache`).

### Routes (Expo Router)
```
app/(tabs)/index.tsx                 Aujourd'hui
app/(tabs)/repas.tsx                 Repas
app/(tabs)/sport.tsx                 Sport
app/(tabs)/suivi/index.tsx           hub Suivi
app/(tabs)/suivi/[section].tsx       nutrition | activite | corps | tabac | entrainement | eau
app/settings/...                     réglages
```
L'option `backBehavior="history"` des onglets doit faire revenir de Suivi à Aujourd'hui quand on y arrive depuis l'accueil. Elle est à vérifier pendant M4. Retoucher l'onglet Suivi renvoie au hub.

### Aujourd'hui
- **Jauges en barres** pour Eau, Calories, Protéines et Pas. Chaque barre porte un trait « où tu devrais en être à cette heure » et change de couleur selon le rythme (règles en section 9). La jauge des pas affiche sa source et l'heure de la dernière synchro.
- **Boutons d'ajout rapide** : +250 ml, +500 ml (contenants du profil) et « + Repas ».
- **Carte Séance du jour** avec un bouton « Démarrer ».
- **Cartes Poids** (valeur du jour et moyenne sur 7 jours, saisie en un tap) et **Sans tabac** (jours, record).
- Style Material 3 avec React Native Paper.

### Tout est touchable

| On touche (Aujourd'hui) | Destination | À l'arrivée |
|---|---|---|
| Calories | Suivi › Nutrition | courbe Calories |
| Protéines | Suivi › Nutrition | même écran, courbe Protéines |
| Pas | Suivi › Activité | courbe Pas, source et bouton Synchroniser |
| Poids | Suivi › Corps | courbe Poids (le tour de taille est une puce) |
| Sans tabac | Suivi › Tabac | jours sans fumer, envies |
| Eau (le +) | volet d'ajout rapide | boutons et journal du jour, sans page de stats |
| Séance du jour | onglet Sport | « Démarrer » lance la séance |

Un chevron signale « ouvre », un plus signale « ajoute ». Les zones touchables font au moins 48 dp, avec un effet d'appui et un libellé d'accessibilité.

### Repas
Journal du jour par repas (petit-déjeuner, déjeuner, dîner, collations) avec les totaux. « Ajouter » ouvre quatre entrées : Favoris, Récents, Recherche (Ciqual en local, instantanée), Créer un aliment. Après le choix : état cru ou cuit, portion (puces comme « 1 œuf » ou « 100 g », ou grammes libres), aperçu des macros, ajout. Glisser une ligne permet de la modifier ou de la supprimer.

### Sport
Programme (phase en cours, semaines, séances) et journal de séance : exercices, séries pré-remplies avec la dernière valeur (kg et reps), chrono de repos, bouton Terminer. À la fin, l'application affiche la progression suggérée et les paliers atteints. Historique par exercice.

### Suivi
- **Hub** : cartes de métriques avec mini-courbe, valeur et variation sur la période choisie, sélecteur Jour, Semaine, Année. Le bouton « Modifier » masque, ajoute et réordonne les cartes. La liste ordonnée est enregistrée dans `users/{uid}.ui`, donc commune aux deux téléphones.
- **Détail d'une rubrique** : sélecteur de période partagé, puces pour choisir la courbe affichée, graphique avec la ligne d'objectif, résumé (moyenne, jours dans la cible, meilleur jour), contenu propre à la rubrique. L'icône de réglages permet de choisir les courbes affichées.

| Rubrique | Contenu |
|---|---|
| Nutrition | calories, protéines, glucides ou lipides ; répartition des macros ; lien vers le journal du jour ; en vue Jour, détail par repas |
| Activité | pas par période, moyenne, jours où l'objectif est atteint, record, source et heure de synchro, bouton Synchroniser |
| Corps | poids et moyenne sur 7 jours, tour de taille, variation sur la période, saisie rapide |
| Tabac | jours sans fumer, record, argent économisé, journal et graphique des envies |
| Entraînement | volume, séances faites contre prévues, paliers |
| Eau | optionnelle, ajoutable depuis « Ajouter une stat » |

### Registre de métriques
Un registre unique alimente l'accueil, le hub et les détails. Chaque entrée est une `MetricDefinition` : identifiant, rubrique, libellé, unité, couleur, objectif (lu dans le profil), calcul de la série par période, résumés et règle « dans la cible ». Ajouter une stat revient à ajouter une définition.

### États vides et période
La période choisie (Jour, Semaine ou Année) est partagée entre les écrans et vaut Semaine au départ. Semaine : la semaine calendaire (lundi à dimanche), avec des flèches pour remonter aux semaines précédentes. Année : l'année civile, une barre par mois (moyenne journalière du mois). Jour : le détail de la journée quand il existe (repas, verres d'eau, séance) ; pour les pas, le poids et le tour de taille, qui n'ont qu'une valeur par jour, la vue affiche la valeur du jour et la compare à la veille. Une rubrique sans données propose l'action utile (par exemple, pour les pas : connecter le Fitbit ou autoriser Health Connect, avec un lien vers Réglages › Pas).

### Réglages
Objectifs (calories, protéines, eau, pas), fuseau horaire, contenants d'eau, prix du paquet, Pas (voir section 7), Sécurité (verrouillage biométrique optionnel), Données (export et import JSON, recalcul des totaux, suppression du compte et des données), connexion.

### Première configuration
Écran court : poids, taille, année de naissance, sexe (pour la formule des objectifs), niveau d'activité, objectif. Si l'utilisateur fume, il renseigne aussi le nombre de cigarettes par jour, la taille du paquet et son prix. L'application propose des objectifs (règles en section 9), que l'utilisateur peut modifier.

---

## 7. Pas et santé

### Principe
La lecture se fait sur le téléphone, via Health Connect, sans serveur. Sur Android 14 et plus, Health Connect compte aussi les pas du téléphone dès qu'une application a la permission de lire les pas. Le téléphone y est une source à part, de priorité la plus basse par défaut. L'agrégat que lit l'application applique la priorité choisie dans Health Connect : le Fitbit prime sur le téléphone quand il écrit, et le téléphone prend le relais sinon.

### Chaîne de données
Tracker Fitbit → application Fitbit (Google Health) → Health Connect → notre application → `days/{date}.steps` sur Firestore.

### Conditions
- L'écriture vers Health Connect n'est pas activée par défaut dans l'application Fitbit : elle se coche à la main.
- Notre application demande sa propre permission de lecture des pas.
- Android 14 ou plus pour le comptage natif du téléphone. Sur un Android plus ancien, une application comme Google Fit ou Samsung Health doit compter les pas.
- Le tracker se synchronise avec le téléphone toutes les 15 minutes environ quand l'application Fitbit est ouverte et le Bluetooth actif. La jauge n'est donc pas en direct.
- Lecture de Health Connect : au premier plan par défaut. La synchro se fait à l'ouverture de l'application et au bouton. La lecture en arrière-plan demande une permission supplémentaire (ajout possible plus tard).
- Historique : une application peut lire jusqu'à 30 jours avant sa première autorisation, à condition que des données aient déjà été écrites.
- Depuis la mise à jour de juin 2026, les pas natifs du téléphone ont un nom d'origine synthétique. Il ne faut jamais filtrer sur l'ancien nom (`android`).

### Bouton Synchroniser
Il lit le total du jour dans Health Connect et met à jour Firestore. Il est sur la jauge des pas (geste de rafraîchissement ou icône) et dans les réglages. Il ne force pas le tracker à envoyer ses données au téléphone : il propose un lien pour ouvrir l'application Fitbit, si Android le permet.

### Réglages › Pas
- **Fitbit** : un écran guidé en trois lignes d'état : permission de lecture accordée, source Fitbit détectée avec l'heure de la dernière donnée, et les étapes pour activer l'écriture dans l'application Fitbit. Si le Fitbit n'est pas détecté, l'écran indique « le téléphone compte les pas ».
- **Sources détectées** : la liste des applications qui écrivent des pas, avec l'heure de la dernière donnée.
- **Ouvrir Health Connect** : raccourci vers les réglages de priorité (seul l'utilisateur peut les modifier).
- **Ce téléphone envoie les pas** : un seul appareil écrit dans `days/{date}`, signalé par `devices/{id}.stepsWriter`.
- **Mode de source** : Automatique (agrégat Health Connect sans filtre) par défaut. Un mode « Fitbit uniquement » par filtre d'origine est repoussé après le MVP.

---

## 8. Synchro, hors-ligne et sécurité

### Authentification
Firebase Auth avec connexion Google. La session reste ouverte hors-ligne et le jeton se renouvelle au retour du réseau. Pour l'iPhone (M7), la connexion avec Apple sera ajoutée si l'App Store l'exige.

### Règles de sécurité Firestore
La base est fermée par défaut. Seul le propriétaire accède à `users/{uid}/**`. Les règles valident les types, les bornes (par exemple `grams` entre 0 et 5 000) et la liste des champs autorisés. Elles sont testées sur l'émulateur avec `@firebase/rules-unit-testing`. App Check (Play Integrity) est activé une fois l'application stable.

### Hors-ligne
- Persistance locale activée avec React Native Firebase, cache non limité (les données sont minuscules).
- Les écritures sont mises en file et rejouées au retour du réseau.
- Pas de transactions (elles échouent hors-ligne). Les compteurs utilisent `increment()`, qui s'additionne côté serveur : deux ajouts d'eau faits sur deux téléphones hors-ligne se somment.
- En cas de modification simultanée de la même fiche, la dernière écriture gagne.
- Un bouton « Recalculer les totaux » (Réglages › Données) reconstruit `days/{date}` à partir des entrées si un total dérive.
- La première installation sur un second téléphone demande une connexion pour télécharger l'historique.
- Les lectures servies par le cache local ne comptent pas dans les quotas.

### Données et confidentialité
- Région `europe-west9` (Paris), définitive à la création de la base.
- Les documents ne contiennent que l'`uid`, ni nom ni e-mail.
- Le chiffrement du stockage est actif par défaut sur les Android récents. Un verrouillage biométrique de l'application est proposé en option.
- Pour un usage strictement personnel, le RGPD est léger (ceci n'est pas un avis juridique). Si l'application est ouverte à des amis, consentement, politique de confidentialité et suppression de compte deviennent nécessaires.
- Aucun secret n'est stocké dans l'application.

### Sauvegarde et export
- Export JSON (Réglages › Données) partagé vers Drive ou Fichiers, avec un rappel mensuel optionnel, et import de restauration validé par schéma.
- Téléphone perdu : se reconnecter avec Google sur un nouvel appareil restaure tout depuis Firestore. Seules les écritures non synchronisées sont perdues.
- Sauvegardes planifiées et récupération à un instant donné (sept jours) exigent le plan Blaze : facultatif, pour plus tard.

### Erreurs
Une écriture refusée par les règles affiche un message avec « Réessayer » et conserve la saisie.

### Google Health API (évolution)
Elle est conçue comme un second adaptateur de `HealthDataSource`. Elle suppose un accès ouvert aux nouveaux projets, une revue de sécurité des permissions sensibles et un petit serveur (donc Blaze).

---

## 9. Règles du domaine

Ces règles sont des fonctions pures, couvertes par des tests unitaires.

### Couleur des jauges (Aujourd'hui)
- Journée active de 7 h à 23 h. Progression attendue à l'heure `h` : `attendu = clamp((h − 7) / 16, 0, 1)`.
- `rythme = progression réelle / attendu`. Avant 7 h, la couleur est verte.
- Vert si `rythme ≥ 0,9`, orange si `0,6 ≤ rythme < 0,9`, rouge si `rythme < 0,6`.
- Calories : au-dessus de 105 % de l'objectif jusqu'à 110 %, la barre est orange ; au-delà de 110 %, rouge.
- Le trait de la barre marque `attendu`.

### Couleur des graphiques (Suivi)
Pour un jour terminé : vert à partir de 90 % de l'objectif, orange de 60 % à 89 %, rouge en dessous. Pour les calories : vert de 90 % à 105 %, orange de 60 % à 89 % ou de 106 % à 110 %, rouge sinon. Le jour en cours est dessiné en pointillé. Les moyennes et les décomptes « dans la cible » ne comptent que les jours terminés. « Dans la cible » vaut 90 % de l'objectif ou plus, sauf pour les calories : de 90 % à 105 %.

### Objectifs proposés à la configuration
- Dépense estimée : Mifflin-St Jeor multipliée par le facteur d'activité (sédentaire 1,2, légèrement actif 1,375, actif 1,55).
- Calories proposées : dépense moins 400 kcal.
- Protéines : 1,7 g par kg de poids, arrondi à 5 g.
- Eau : 2,5 L par défaut.
- Pas : 8 000 par défaut.
- L'utilisateur peut saisir ses propres valeurs.

### Garde-fous
Constantes du domaine, non modifiables depuis l'interface, couvertes par des tests :
- plancher de calories proposées : 1 500 kcal par jour,
- plafond de perte de poids proposée : 1 % du poids de corps par semaine,
- perte visée par défaut : 0,3 à 0,5 kg par semaine.

L'application ne donne pas de conseil médical : elle affiche un rappel de consulter un professionnel avant de changer de régime ou de reprendre une activité intense.

### Progression des charges
Si toutes les séries d'un exercice atteignent le nombre de répétitions prévu, la charge suggérée pour la fois suivante est `charge + incrementKg` (2,5 kg par défaut, modifiable par exercice). Sinon, la charge est conservée.

### Paliers
Un palier est un jalon chiffré `{ metric, target, direction }` (par exemple 10 tractions, tour de taille inférieur à 90 cm). Il est atteint quand la dernière valeur de la métrique franchit la cible dans le sens indiqué. L'atteinte est détectée à l'enregistrement de la séance ou de la mesure, puis `achievedAt` est posé.

### Autres calculs
Moyenne glissante sur 7 jours (poids), jours sans tabac depuis `quitDate`, économies (jours sans fumer × `cigarettesPerDay` × `packPrice` / `packSize`, si renseignés), clé de jour dans le fuseau du profil (changements d'heure inclus).

---

## 10. Build, tests et jalons

### Environnement
- Expo avec build de développement natif. Build local avec `expo run:android` sur Mac, ou EAS Build.
- Deux projets Firebase (dev et prod), tous deux sur Spark, avec deux variantes de l'application installables côte à côte.
- `google-services.json` hors de git, avec un fichier d'exemple.
- CI (GitHub Actions) : lint, vérification des types, tests unitaires, tests des règles sur l'émulateur, `dependency-cruiser`.

### Stratégie de tests
- Domaine : le gros des tests, en TDD.
- Cas d'usage : avec des adaptateurs en mémoire, sans réseau.
- Adaptateurs Firestore : sur l'émulateur, avec les tests des règles (accepté ou refusé). Scénario clé : coupure réseau sur deux clients qui font chacun des ajouts d'eau, puis retour du réseau, et le total doit être la somme.
- Interface : tests de composants pour les jauges et la navigation, puis flux Maestro plus tard.
- Santé : fausse source pour `HealthDataSource`, puis essai manuel sur le téléphone.

### Jalons

| Jalon | Contenu | Utilisable à la fin |
|---|---|---|
| M0 | Dépôt, CI, deux projets Firebase, connexion Google, règles de base, assemblage des modules | se connecter |
| M1 | Hydratation et écran Aujourd'hui : jauges en barres, ajouts rapides, synchro et icône d'état | suivre l'eau sur deux téléphones |
| M2 | Alimentation : import Ciqual, recherche, cru et cuit, portions, aliments perso, favoris, journal Repas | suivre eau et repas |
| M3 | Entraînement : programme, journal de séance pré-rempli, progression, paliers | suivre les séances |
| M4 | Suivi : registre de métriques, hub, détails par rubrique, périodes, personnalisation | voir les courbes |
| M5 | Pas : Health Connect, bouton Synchroniser, Réglages › Pas | brancher le Fitbit |
| M6 | Tabac, réglages, objectifs avec garde-fous, export et import JSON, finitions | version complète |
| M7 | iPhone : build iOS, HealthKit, connexion avec Apple | utiliser l'application sur iPhone |

Chaque jalon donne lieu à son propre plan d'implémentation, en commençant par M0 et M1. Chaque jalon se termine par des tests verts et un essai hors-ligne sur le téléphone. M1 est la plus petite tranche qui traverse toute la pile (authentification, règles, hors-ligne, synchro, interface) et sert de test grandeur nature.

---

## 11. Risques et vérifications précoces

| Vérification | Quand |
|---|---|
| React Native Firebase avec Expo : écrire hors-ligne, puis revenir en ligne, sur le téléphone | avant M1 |
| Import Ciqual : format du fichier et façon dont les variantes cru et cuit sont nommées | avant M2 |
| Bibliothèque Health Connect pour Expo : maintenance et plugin de configuration | avant M5 |
| Retour entre onglets avec `backBehavior="history"` | pendant M4 |
| Scénario deux clients hors-ligne avec `increment()` sur l'émulateur | pendant M1 |

---

## 12. Références

- Android Developers, Health Connect : pas, données agrégées, lecture.
- Aide Google, pas avec Health Connect et priorité des sources.
- Firebase et Google Cloud : plans tarifaires, transactions et écritures groupées, localisations de Firestore, sauvegardes.
- Documentation Google Health API : fin de l'API Fitbit au 30 octobre 2026, accès fermé aux nouveaux projets.
- Anses : table de composition nutritionnelle Ciqual (données ouvertes).
- React Native Paper, `expo-material3-theme`, React Native Firebase, `react-native-health-connect`.
