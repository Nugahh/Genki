# Genki

Application mobile personnelle de suivi : hydratation, alimentation, sport. Spec : `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md`.

État : M0 (socle, connexion Google, règles) et M1 (eau sur l'écran Aujourd'hui, hors-ligne, synchro entre deux téléphones).

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
4. Paramètres du projet → Ajouter une application Android, nom de package `com.nugah.genki.dev` (projet dev) ou `com.nugah.genki` (projet prod). Ajouter l'empreinte SHA-1 de la clé de signature. La clé de debug est créée au premier build Android :

   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
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

## Vérifications

```bash
npm run lint && npm run typecheck && npm test && npm run lint:deps
npm run test:emulator   # règles et adaptateurs Firestore, émulateur sur le port 8088
```

La CI GitHub Actions lance les mêmes commandes.

## À vérifier sur le téléphone avant M2 (spec §11)

Deux téléphones connectés au même compte Google : couper le réseau sur les deux, ajouter de l'eau sur chacun, rétablir le réseau. Les deux doivent afficher la somme, et l'icône nuage repasser à « Synchronisé ».
