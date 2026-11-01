# Genki

Application mobile personnelle de suivi : hydratation, alimentation, sport. Spec : `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md`.

État : M0 (socle, connexion Google, règles), M1 (eau sur l'écran Aujourd'hui, hors-ligne, synchro entre deux téléphones), M2 (alimentation : base Ciqual embarquée, journal par repas, favoris, aliments personnalisés, jauges Calories et Protéines sur l'écran Aujourd'hui), M3 (entraînement : programme, séances, progression, jalons) M4 (Suivi : hub de statistiques, courbes par rubrique, périodes jour, semaine, mois, année) M5 (pas : Health Connect, jauge Pas, synchro, Réglages › Pas) et M6 (réglages : profil, objectifs avec mode et garde-fous, contenants d'eau, première configuration ; poids et tour de taille ; tabac ; export et import JSON, recalcul des totaux).

M2 ajoute du code natif (`expo-sqlite`) : après la mise à jour, refaire `npm run android`. Recharger le JavaScript ne suffit pas. Avant d'installer M2, redéployer aussi les règles Firestore sur les deux projets Firebase (`npx firebase deploy --only firestore:rules --project <id>`) : celles des serveurs refuseraient toute écriture d'alimentation (détail dans « À vérifier sur le téléphone avant M5 »).

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
4. Paramètres du projet → Ajouter une application Android, nom de package `com.nugah.genki.dev` (projet dev) ou `com.nugah.genki` (projet prod). Ajouter l'empreinte SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, la même dans les deux projets : `npx expo prebuild` copie la clé de debug d'Expo dans `android/app/debug.keystore`, et les deux variantes sont signées avec elle. Pour la vérifier après le premier prebuild :

   ```bash
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android
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

Les deux variantes s'installent côte à côte (`Genki (dev)` et `Genki`). Le nom de package et le fichier `google-services` sont figés dans le dossier `android/` généré : pour changer de variante, le régénérer d'abord, avec `npx expo prebuild --clean --platform android` (préfixé de `APP_VARIANT=production` pour la prod).

## Données alimentaires

Les aliments viennent de la table Ciqual 2025 de l'Anses (`doi:10.57745/RDMHWY`, Licence Ouverte Etalab 2.0). Citation : « Anses. 2025. Ciqual French food composition table ». Elle est convertie en une base SQLite en lecture seule, `assets/ciqual.db`, embarquée dans l'application : recherche hors-ligne, aucune lecture Firestore.

`assets/ciqual.db` est committée. La régénérer change l'application : refaire ensuite un build natif (`npm run android`). `normalizeSearch` (`src/modules/nutrition/domain/normalize.ts`) sert à la conversion comme à la recherche, et la colonne `search` de la base en garde le résultat : modifier cette fonction impose de régénérer `assets/ciqual.db`.

Pour la régénérer, télécharger `alim_*.xml` et `compo_*.xml` sur `entrepot.recherche.data.gouv.fr`, les placer dans un dossier sous les noms `alim.xml` et `compo.xml`, puis :

```bash
npm run build:ciqual -- <dossier> <version, par exemple 2025-11-03> [sortie]
```

Le téléphone copie la base une seule fois, sous le nom `ciqual-<version>.db` (constante `DATABASE` de `src/platform/ciqual.ts`). Quand `assets/ciqual.db` change alors que des téléphones l'ont déjà installée, donner un nouveau libellé de version à `build:ciqual` (par exemple `2025-11-03.2`) et mettre la constante à jour, sinon ils gardent l'ancienne copie. Le test `src/platform/ciqual.test.ts` échoue quand les deux divergent.

Règles de conversion (`scripts/ciqual/convert.ts`), valeurs pour 100 g arrondies à 0,1 :

- Énergie : code 328 (kcal, règlement UE 1169/2011) ; protéines : 25003 (N × 6,25) ; glucides : 31000 ; lipides : 40000.
- « traces » et « < x » comptent pour 0 ; « - » (non déterminé) compte pour 0 pour les protéines, glucides et lipides.
- Si l'énergie manque (143 aliments sur 3 484), elle est estimée par Atwater : 4 × protéines + 4 × glucides + 9 × lipides + 7 × alcool (code 60000), mais seulement quand ces quatre valeurs sont connues : 59 aliments. Les 84 autres sont écartés (Ciqual ne donne pas l'énergie et une valeur n'est pas déterminée : la compter pour 0 sous-estimerait les calories), d'où 3 400 aliments dans la base.
- Ciqual ne relie pas un aliment cru à son équivalent cuit : l'état (cru, cuit ou autre) est déduit du nom. Un nom qui contient les deux (« cru ou cuit ») ou aucun est « autre ».

## Vérifications

```bash
npm run lint && npm run typecheck && npm test && npm run lint:deps
npm run test:emulator   # règles et adaptateurs Firestore, émulateur sur le port 8088
```

La CI GitHub Actions lance les mêmes commandes.

## À vérifier sur le téléphone avant M5

Ce que Jest ne montre pas : le natif, le réseau et la mise en page. D'abord :

1. **Redéployer les règles Firestore avant d'installer M2.** Les règles des serveurs (celles de M1) n'ont aucun `match` pour `foodEntries`, `foods` et `favoriteMeals`, et limitent `days` aux champs de l'eau : toute écriture d'alimentation serait refusée (hors-ligne, les entrées s'affichent dans le journal puis disparaissent au retour du réseau). Les déployer sur les deux projets Firebase, dev et prod, avec `npx firebase deploy --only firestore:rules --project <id>`. Les nouvelles règles acceptent toujours les écritures d'eau de M1 : les déployer d'abord est sans risque.
2. Refaire le client de développement avec `npm run android` (M2 ajoute le module natif `expo-sqlite` : recharger le JavaScript ne suffit pas).

3. **Déployer les règles et l'index Firestore avant d'installer M3** : sans eux, le programme, les séances et les jalons seraient refusés, et l'historique d'un exercice resterait vide. `npx firebase deploy --only firestore:rules,firestore:indexes --project <id>`, sur les deux projets. L'index (`workoutLogs` : `exerciseIds` + `day` décroissant) met quelques minutes à se construire : tant qu'il est en cours, l'historique et le pré-remplissage d'une séance échouent.

4. **Déployer à nouveau les règles avant d'installer M4** : `npx firebase deploy --only firestore:rules --project <id>`, sur les deux projets. M4 ajoute la règle du document `users/{uid}` (les préférences d'affichage du Suivi, `ui`) ; M3 en a relevé deux bornes (400 séries par séance, 120 caractères pour la métrique d'un jalon). Sans elles, l'ordre des cartes du Suivi ne s'enregistre pas.
5. **Refaire le client de développement avec `npm run android`** : M4 ajoute `react-native-svg` (code natif des courbes) et M6 `expo-file-system`, `expo-sharing` et `expo-document-picker` (export et import). Recharger le JavaScript ne suffit pas.
6. **Régénérer le projet natif pour M5** : `react-native-health-connect` et `expo-application` sont natifs, et le dossier `android/` généré (figé, hors de git) n'a ni la permission `READ_STEPS`, ni l'écran de politique de confidentialité qu'Android 14 exige, ni `minSdk 26`. `npx expo prebuild --clean --platform android`, puis `npm run android` : recharger le JavaScript ne suffit pas, et `npm run android` seul ne refait pas le manifeste. Les règles de M5 (`steps` dans `days`, collection `devices`) se déploient avec les mêmes commandes qu'à l'étape 4.
7. **Les règles de M6** (profil complet dans `users/{uid}`, poids et tour de taille dans `days`, collection `cravings`) se déploient avec les mêmes commandes qu'à l'étape 4 : un seul déploiement couvre M3, M4 et M6.

Ensuite :

- **Pas (M5), à faire avec un Fitbit ou au moins un Android 14.** Installer ou mettre à jour Health Connect. Dans l'application Fitbit, connecter Health Connect et **cocher l'écriture des pas** (elle ne l'est pas par défaut). Dans Genki, Réglages › Pas › « Autoriser la lecture des pas » : la liste des sources doit montrer le Fitbit avec l'heure de sa dernière donnée. Aujourd'hui : la jauge Pas dit sa source et « lu à HH:MM » ; tirer l'écran vers le bas relit les pas. Comparer le total avec celui de l'application Fitbit (écart possible : le tracker n'envoie ses données que toutes les 15 minutes environ). Couper le réseau, marcher, relire : le total reste affiché et se synchronise au retour. Avec deux téléphones, un seul écrit les pas (« Ce téléphone envoie les pas ») ; le second affiche le total du premier et ne le réécrit pas. Dans Health Connect, « Ordre de priorité des applications » décide du Fitbit ou du téléphone quand les deux écrivent.
- **Première configuration (M6).** Au premier lancement après la mise à jour, l'écran « Faisons connaissance » s'ouvre : sexe, naissance, taille, poids, activité, objectif des calories (déficit, maintien, surplus), puis les objectifs proposés. « Passer » garde les valeurs par défaut et ne le remontre plus. L'engrenage en haut à droite ouvre les réglages ; « Objectifs › Proposer » refait la proposition (plancher de 1 500 kcal et 1 % du poids de corps par semaine signalés).
- **Couleur des calories (M6).** En déficit, la jauge reste verte tant qu'on ne dépasse pas l'objectif (même loin du rythme) ; en maintien elle suit le rythme et signale le dépassement ; en surplus elle suit le rythme et dépasser n'est pas un problème. Les courbes du Suivi suivent le même mode.
- **Poids et tabac (M6).** Sur Aujourd'hui, la carte Poids (valeur du jour, moyenne sur 7 jours) a un « + » qui saisit poids et tour de taille en un tap ; la carte Sans tabac apparaît quand une date d'arrêt est donnée (Réglages › Tabac). Suivi › Tabac : « Envie résistée » et « J'ai fumé » (avec « Annuler »), jours, record et économies. Un palier sur le tour de taille (Sport › Paliers › Ajouter) se coche à la mesure qui le franchit.
- **Données (M6).** Réglages › Données : « Exporter mes données » ouvre le partage Android avec un fichier `genki-AAAA-MM-JJ.json` ; « Importer une sauvegarde » restaure un compte vide (les verres, séances et envies déjà présents ne se réécrivent pas : le résultat dit combien de documents ont été refusés) ; « Recalculer les totaux » reconstruit les totaux du jour à partir des repas et des verres.
- **Suivi (M4).** Le quatrième onglet ouvre le hub : une carte par statistique (Calories, Protéines, Eau, Pas, Poids, Volume) avec sa valeur, sa variation et sa courbe ; les statistiques sans mesure disent « Pas encore de mesure ». « Jour / Semaine / Mois / Année » change la période de toutes les cartes et se retrouve en rouvrant l'application, aussi sur l'autre téléphone. « Modifier » monte, descend, masque ou ajoute une carte. Une carte ouvre sa rubrique : puces des statistiques, flèches vers les périodes précédentes (un mois : une barre fine par jour, une étiquette sur cinq), courbe avec la ligne d'objectif (aujourd'hui en pointillé), résumé. Sur Aujourd'hui, toucher Calories ou Protéines ouvre Suivi › Nutrition sur la bonne courbe ; le retour mène au hub, puis à Aujourd'hui. Retoucher l'onglet Suivi depuis une rubrique revient au hub. Les rubriques Activité et Corps restent vides tant qu'aucun pas, poids ni tour de taille n'est enregistré. Eau en vue Jour : la liste des verres, avec suppression.
- **Sport (M3).** Onglet Sport › « Partir du modèle » : trois séances, la prochaine marquée. Démarrer une séance : les séries sont pré-remplies (charge visée et répétitions prévues), « Repos 1:30 » démarre quand une série est validée et « Passer » l'arrête. Terminer la séance, couper le réseau, la refaire : le résumé s'affiche aussitôt, hors-ligne, et la séance apparaît à la reconnexion. Sur Aujourd'hui, la carte « Séance du jour » passe à la séance suivante.
- **Programme (M3).** Sport › « Modifier le programme » : renommer, changer, ajouter et supprimer un exercice (le dernier d'une séance ne se supprime pas) ; « Voir l'historique » liste les séries des dernières séances. Un jalon (Sport › Jalons) passe à « atteint » quand une séance le franchit.
- **Eau sur deux téléphones (M1, spec §11).** Connectés au même compte Google, couper le réseau sur les deux, ajouter de l'eau sur chacun, rétablir le réseau. Les deux doivent afficher la somme, et l'icône nuage repasser à « Synchronisé ».
- **Base Ciqual.** Au premier lancement, l'application copie la base embarquée vers `files/SQLite/ciqual-2025-11-03.db` dans son stockage. Ensuite, en mode avion, chercher « riz » (Repas › Ajouter › Recherche) : les résultats arrivent aussitôt. Avec un build de développement, Metro doit être joignable au tout premier lancement à froid : `Asset.downloadAsync` s'exécute avant de regarder si la base est déjà installée.
- **Variante prod (release).** Installer la version release, passer en mode avion avant le premier lancement, chercher « riz » : la base est alors copiée depuis l'APK et non depuis Metro.
- **Repas sur deux téléphones.** Ajouter un repas sur chacun hors-ligne, puis rétablir le réseau : les deux affichent les calories et les protéines additionnées.
- **Journal.** Modifier la quantité d'une ligne, puis supprimer une ligne (« Supprimer … du journal ? » demande confirmation) : les totaux suivent.
- **Annuler un verre.** Sur Aujourd'hui, en mode avion, toucher +250 ml : « +250 ml ajoutés » et « Annuler » apparaissent au-dessus de la barre d'onglets ; « Annuler » retire le verre et la jauge revient. Rétablir le réseau : l'eau du jour est à zéro côté serveur.
- **« Réessayer ».** Le message d'un enregistrement refusé est visible et utilisable au-dessus de la fenêtre native « Ajouter un aliment ».
- **Suppression d'un favori.** La boîte « Supprimer le favori … ? » (Favoris › corbeille) apparaît au-dessus de la fenêtre native « Ajouter un aliment » et ses deux boutons répondent.
- **Mise en page, sur 360 dp et sur 412 dp.** Les libellés « Favoris », « Récents », « Recherche » et « Créer » (deux rangées de deux, une coche sur le segment choisi) ne sont pas tronqués ; les boutons +250 ml, +500 ml et + Repas restent épinglés au-dessus de la barre d'onglets (ils ne défilent pas) et passent à la ligne proprement avec une grande police ; les textes des jauges tiennent.
- **Zones tactiles de 48 dp.** Puces Tous/Cru/Cuit, puces de portion et icônes Supprimer, à essayer au pouce.
- **Période Mois (Suivi).** Les quatre segments Jour · Semaine · Mois · Année tiennent sur 360 dp sans que « Semaine » soit coupé (sinon retirer la coche des segments). En vue Mois : une barre fine par jour, une étiquette sur cinq sous le graphique, le titre « novembre 2026 », les flèches de mois en mois, « Variation … par rapport au mois précédent ».
- **Barre d'onglets Material.** Aujourd'hui et Repas : l'onglet ouvert a l'indicateur en pilule, plus aucun bleu iOS. L'en-tête et le fond restent clairs, même avec le téléphone en mode sombre.
- **Barres système et clavier.** Avec la navigation à trois boutons, puis par gestes : « Retour » et « Enregistrer » en bas de « Ajouter un aliment » ne passent pas sous la barre système. Ouvrir « Quantité (g) » (fiche d'un aliment, puis « Modifier la quantité » d'une ligne du journal) : le clavier ne cache ni le champ ni « Enregistrer ».
- **Grande police et TalkBack.** Taille de police à 1,3× puis au maximum : aucun libellé de jauge, de segment ou de bouton n'est coupé ni ne déborde. Avec TalkBack : chaque onglet est annoncé une seule fois et dit s'il est sélectionné ; les boîtes de dialogue ne laissent pas atteindre l'écran derrière.
- **Formats français sur Hermes.** « 1 200 / 2 200 kcal », « 0,6 g ».
- **Attribution Ciqual.** Elle figure dans ce README (licence Etalab 2.0, section « Données alimentaires »).
