# Genki

Application mobile personnelle de suivi : hydratation, alimentation, sport. Spec : `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md`.

État : M0 (socle, connexion Google, règles), M1 (eau sur l'écran Aujourd'hui, hors-ligne, synchro entre deux téléphones) et M2 (alimentation : base Ciqual embarquée, journal par repas, favoris, aliments personnalisés, jauges Calories et Protéines sur l'écran Aujourd'hui).

M2 ajoute du code natif (`expo-sqlite`) : après la mise à jour, refaire `npm run android`. Recharger le JavaScript ne suffit pas. Avant d'installer M2, redéployer aussi les règles Firestore sur les deux projets Firebase (`npx firebase deploy --only firestore:rules --project <id>`) : celles des serveurs refuseraient toute écriture d'alimentation (détail dans « À vérifier sur le téléphone avant M3 »).

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

## À vérifier sur le téléphone avant M3

Ce que Jest ne montre pas : le natif, le réseau et la mise en page. D'abord :

1. **Redéployer les règles Firestore avant d'installer M2.** Les règles des serveurs (celles de M1) n'ont aucun `match` pour `foodEntries`, `foods` et `favoriteMeals`, et limitent `days` aux champs de l'eau : toute écriture d'alimentation serait refusée (hors-ligne, les entrées s'affichent dans le journal puis disparaissent au retour du réseau). Les déployer sur les deux projets Firebase, dev et prod, avec `npx firebase deploy --only firestore:rules --project <id>`. Les nouvelles règles acceptent toujours les écritures d'eau de M1 : les déployer d'abord est sans risque.
2. Refaire le client de développement avec `npm run android` (M2 ajoute le module natif `expo-sqlite` : recharger le JavaScript ne suffit pas).

Ensuite :

- **Eau sur deux téléphones (M1, spec §11).** Connectés au même compte Google, couper le réseau sur les deux, ajouter de l'eau sur chacun, rétablir le réseau. Les deux doivent afficher la somme, et l'icône nuage repasser à « Synchronisé ».
- **Base Ciqual.** Au premier lancement, l'application copie la base embarquée vers `files/SQLite/ciqual-2025-11-03.db` dans son stockage. Ensuite, en mode avion, chercher « riz » (Repas › Ajouter › Recherche) : les résultats arrivent aussitôt. Avec un build de développement, Metro doit être joignable au tout premier lancement à froid : `Asset.downloadAsync` s'exécute avant de regarder si la base est déjà installée.
- **Variante prod (release).** Installer la version release, passer en mode avion avant le premier lancement, chercher « riz » : la base est alors copiée depuis l'APK et non depuis Metro.
- **Repas sur deux téléphones.** Ajouter un repas sur chacun hors-ligne, puis rétablir le réseau : les deux affichent les calories et les protéines additionnées.
- **Journal.** Modifier la quantité d'une ligne, puis supprimer une ligne : les totaux suivent.
- **« Réessayer ».** Le message d'un enregistrement refusé est visible et utilisable au-dessus de la fenêtre native « Ajouter un aliment ».
- **Mise en page, sur 360 dp et sur 412 dp.** Les quatre libellés « Favoris », « Récents », « Recherche » et « Créer » ne sont pas tronqués ; la rangée +250 ml, +500 ml, + Repas passe à la ligne proprement ; les textes des jauges tiennent.
- **Zones tactiles de 48 dp.** Puces Tous/Cru/Cuit, puces de portion et icônes Supprimer, à essayer au pouce.
- **Formats français sur Hermes.** « 1 200 / 2 200 kcal », « 0,6 g ».
- **Attribution Ciqual.** Elle figure dans ce README (licence Etalab 2.0, section « Données alimentaires »).
