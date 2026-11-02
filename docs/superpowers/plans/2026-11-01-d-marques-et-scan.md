# Produits de marque et scan (chantier D) : plan d'implémentation

> **Pour les agents :** exécuter tâche par tâche, TDD, une validation et un commit par tâche.

**But :** une seule barre de recherche qui remonte par pertinence les aliments de Ciqual, ceux de l'utilisateur et les produits de marque d'Open Food Facts (la quantité sur une ligne sous le nom), et le scan du code-barres d'un produit.

**Architecture :** un produit Open Food Facts n'est conservé que quand on l'utilise : il devient alors un aliment à soi (`foods/{id}` avec `source: 'off'`, `brand`, `barcode`, `nutrients`). Le domaine pur convertit la réponse (`fromOpenFoodFacts`), lit les quantités (`parseQuantity`), note la pertinence (`relevance`) et limite le débit (`rateLimiter`). Un client `fetch` (adaptateur) parle à l'API ; le cas d'usage `productSearch` y ajoute le délai de frappe, la limite de 10 requêtes par minute et l'annulation. L'interface fusionne les trois sources dans `FoodSearch` ; un écran de scan (`expo-camera`) lit le code-barres et ouvre la fiche.

**Spec :** `docs/superpowers/specs/2026-11-01-fiche-aliment-marques-design.md` §3 à §5.

## Contraintes globales

- Sources : Ciqual et Open Food Facts seulement. Seuls le texte cherché et le code-barres partent vers Open Food Facts, sans identifiant du compte. `User-Agent: Genki/1.0 (personal app; github.com/Nugahh/Genki)` (jamais l'e-mail).
- Recherche réseau : après 700 ms sans frappe, à partir de 3 caractères, annulée si la requête change, au plus 10 requêtes par minute (limiteur côté client), délai d'attente de 8 s. Jamais une requête à chaque lettre.
- Conversion : nom `product_name_fr`, sinon `product_name`, sinon « Produit sans nom » ; marque = la première de `brands` ; calories `energy-kcal_100g`, sinon `energy-kj_100g` ÷ 4,184 ; **un produit sans calories ou sans protéines, glucides ou lipides n'est pas proposé** (refus avec un message). Vitamines et minéraux : grammes pour 100 g dans OFF, convertis en mg ou µg ; seules les clés du catalogue de B sont gardées ; une valeur absente reste absente. Portions : « 100 g » toujours, la portion de l'étiquette (`serving_size` / `serving_quantity`) et l'emballage (`quantity` / `product_quantity`) quand l'unité se lit (g, kg, ml, cl, l) ; 1 ml = 1 g, dit « ≈ ». État `other`.
- Pertinence : nom commençant par la requête > mot entier > contient ; la marque compte ; ex æquo : Ciqual, puis aliments perso, puis produits de marque. Ciqual et perso répondent tout de suite ; les produits arrivent et se placent à leur rang ; une ligne « Recherche de produits… » reste en bas pendant l'appel ; hors-ligne ou erreur : une ligne « Produits de marque indisponibles hors-ligne » (annoncée).
- Un produit utilisé devient un aliment perso synchronisé (un seul par code-barres : on retrouve d'abord les `foods` de l'utilisateur par `barcode`). Règles `foods` : `source` = `off`, `brand` (texte court), `barcode` (8 à 14 chiffres), `nutrients` (même carte bornée que pour les lignes).
- Scan : `expo-camera` (`CameraView`), EAN-13, EAN-8, UPC-A, UPC-E ; la permission n'est demandée qu'au premier scan, un refus dit comment la rendre ; code lu : recherche locale puis OFF ; produit inconnu : « Créer un aliment » avec le code-barres rempli ; produit sans calories ou macros : le dit. Pas de QR code.
- Licence : mention d'Open Food Facts (ODbL) dans le README et dans Réglages, à côté de Ciqual.
- Avant de conclure : `npm run lint -- --no-cache`, `npm run typecheck`, `npm test`, `npm run lint:deps`, `npm run test:emulator`.

## Fichiers

- `nutrition/domain` : `openFoodFacts.ts` (+ test, fixtures de réponses enregistrées), `relevance.ts` (+ test), `rateLimiter.ts` (+ test) ; `food.ts` (`source`, `brand`, `barcode`).
- `nutrition/application` : `ports.ts` (`ProductSource`), `productSearch.ts` (+ test), `foodUseCases.ts` (`adopt`, `findByBarcode`).
- `nutrition/adapters` : `openFoodFactsClient.ts` (+ test), `firestoreFoodRepository.ts`, `inMemoryFoodRepository.ts`, règles.
- `nutrition/ui` : `FoodSearch.tsx` (liste fusionnée), `FoodDetail.tsx` (produit de marque), `ScanScreen.tsx`, `AddFoodScreen.tsx`, `FoodForm.tsx` (code-barres).
- `package.json`, `app.json` (plugin `expo-camera`), `README.md`, Réglages (mention de la source).

---

### Tâche 1 : domaine (conversion, quantités, pertinence, limiteur)

- [ ] Tests (réponses **enregistrées** : Coca-Cola 330 ml, un produit sans calories, un produit en kJ seulement, un produit avec vitamines en grammes, une portion en cl) : `parseQuantity("330 ml")` → 330, `"1,5 L"`, `"33 cl"`, `"1 kg"`, `"6 x 33 cl"` → illisible ; `fromOpenFoodFacts` ; `relevance` ; `rateLimiter` (la 11e requête de la minute attend ou est refusée).
- [ ] Code : les trois fichiers du domaine, `Food` + `source?`, `brand?`, `barcode?`, `FoodInput = Omit<Food, 'ref'>`.
- [ ] Commit `feat: Open Food Facts conversion, quantities, relevance (domain)`.

### Tâche 2 : un produit devient un aliment à soi

- [ ] Tests : dépôt Firestore (écriture et lecture de `source`, `brand`, `barcode`, `nutrients` ; l'id est connu avant l'écriture), règles (code-barres non numérique, trop court, source inconnue, nutriment hors liste refusés ; un aliment sans ces champs accepté), `foodUseCases.adopt` (crée l'aliment, rend sa référence ; ne crée pas un second aliment pour un code-barres déjà là), `findByBarcode`.
- [ ] Code : `FoodRepository.create` rend l'id ; `observeAll` relit les champs ; `foodUseCases.adopt` ; règles.
- [ ] Commit `feat: a product of Open Food Facts becomes a food of one's own`.

### Tâche 3 : client Open Food Facts et recherche de produits

- [ ] Tests : le client contre un `fetch` simulé (en-tête, champs demandés, délai d'attente, réponse vide, erreur HTTP, JSON invalide, produit introuvable) ; `productSearch` (3 caractères, 700 ms, annulation, limiteur, erreur → indisponible).
- [ ] Code : `openFoodFactsClient`, `productSearch`, composition (`fetch` de la plateforme).
- [ ] Commit `feat: Open Food Facts client and product search`.

### Tâche 4 : la recherche unique

- [ ] Tests : liste mélangée qui se réordonne à l'arrivée du réseau, quantité sous le nom, libellé de source des produits de marque, ligne d'attente, ligne « indisponibles hors-ligne », filtre cru/cuit, produit déjà adopté non répété ; fiche d'un produit (source « Open Food Facts », ajout qui l'adopte puis consigne la ligne).
- [ ] Code : `FoodSearch`, `FoodDetail`, `AddFoodScreen`.
- [ ] Commit `feat: one search for Ciqual, one's foods and brand products`.

### Tâche 5 : le scan

- [ ] `npx expo install expo-camera` (+ plugin `app.json`) ; tests : permission demandée au premier scan, refus, code lu → fiche, produit inconnu → formulaire avec le code, produit sans macros, hors-ligne.
- [ ] Code : `ScanScreen` (caméra injectable pour les tests), bouton dans `AddFoodScreen`, `FoodForm` (code-barres).
- [ ] Commit `feat: scan a barcode`.

### Tâche 6 : documents

- [ ] README (état, mention ODbL, règle « jamais une requête à chaque lettre », règles à redéployer, **reconstruire le client** pour la caméra, vérifications sur téléphone), Réglages (mention de la source), DESIGN.md, spec principale. Les cinq vérifications ; commit `docs: brand products and scan`.

## Suite (2026-11-02) : Search-a-licious

La recherche par nom est passée de `cgi/search.pl` (503 une fois sur deux) à `https://search.openfoodfacts.org/search` : même conversion, mais le client lit `hits` (marques en liste, requête réduite aux lettres et chiffres), un limiteur de 15 par minute sert la lecture d'un produit, et toucher un résultat lit le produit complet (portion, vitamines) avant d'ouvrir la fiche, avec repli sur la liste.

## Hors de ce plan

Contribuer à Open Food Facts, QR codes, photo du produit, Nutri-Score, mise à jour d'un produit déjà enregistré quand OFF le corrige, essai du scan sur l'émulateur (caméra réelle nécessaire).
