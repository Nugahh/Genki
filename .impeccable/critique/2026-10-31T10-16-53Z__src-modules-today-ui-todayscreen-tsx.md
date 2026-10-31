---
target: src/modules/today/ui/TodayScreen.tsx
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nugah/Desktop/42/Genki/src/modules/today/ui/TodayScreen.tsx"
target_fingerprint: "sha256:07dfb7dbfe9aa82eae1481e3768734f3ecd39e38d106def55d8691a4e3d48553"
target_path: /Users/nugah/Desktop/42/Genki/src/modules/today/ui/TodayScreen.tsx
timestamp: 2026-10-31T10-16-53Z
slug: src-modules-today-ui-todayscreen-tsx
closed: true
---
Method: design review only (detector not applicable, native platform)

Preuves : code, DESIGN.md, PRODUCT.md et calculs de contraste. Aucune capture ni rendu (l'app n'a jamais tourné sur un appareil) : tout ce qui dépend du rendu réel est une estimation.

## Design Health Score

| # | Heuristique | Score | Point clé |
|---|---|---|---|
| 1 | Visibilité de l'état du système | 3 | Nuage de synchro toujours visible, ajout optimiste, échec = snackbar « Réessayer ». Le nuage démarre sur « Hors-ligne » (SyncIcon.tsx:21) et les jauges sur 0, sans état de chargement. |
| 2 | Correspondance avec le monde réel | 3 | Français, unités et formats fr-FR. Le trait « où tu devrais en être » n'est expliqué nulle part. |
| 3 | Contrôle et liberté | 2 | Ajout en un tap sans « Annuler ». Corriger un faux appui demande d'ouvrir la feuille Eau et de trouver la ligne. |
| 4 | Cohérence et standards | 2 | Onglets façon iPhone en bleu iOS, thème de navigation distinct de Paper, couleurs de jauge en dur. |
| 5 | Prévention des erreurs | 3 | Contenants fixes, pas de saisie libre. Pas de garde contre le double tap (cohérent avec le un-tap). |
| 6 | Reconnaissance plutôt que rappel | 3 | Tout est libellé, mais « ce qu'il me reste » se calcule de tête. |
| 7 | Flexibilité et efficacité | 3 | Un tap pour l'eau, les jauges servent de raccourcis. Le repas habituel prend 2 à 3 taps (le spec en vise 1). |
| 8 | Esthétique et minimalisme | 3 | Rien d'ornemental. Trois lignes de même poids, des chiffres en 16 sp et environ 260 dp vides en dessous. |
| 9 | Reconnaître et corriger les erreurs | 3 | Snackbar persistante avec « Réessayer ». Message générique, sans cause. |
| 10 | Aide et documentation | 2 | Rien n'explique le trait ni les couleurs. TalkBack n'annonce pas ce que fait le tap (pas d'accessibilityHint). |
| **Total** | | **27/40** | **Acceptable** (20–27, haut de fourchette) |

## Design Specificity Verdict

**Évaluation LLM.** L'écran est du Material Paper presque sans retouche : un autre tracker pourrait le reprendre tel quel, à une exception près. Le trait « où tu devrais en être à cette heure » ne vient pas du catalogue et répond à la vraie question du produit (suis-je dans le rythme maintenant ?). La sobriété est voulue (DESIGN.md), je ne la compte donc pas contre l'écran. Ce qui n'est pas voulu, c'est l'enveloppe (onglets iOS, bleu iOS), qui rend l'ensemble générique là où il pourrait être reconnaissable. L'écran est aussi clairsemé (trois lignes puis du vide), loin du « carnet dense » de la North Star. C'est normal à ce stade : les cartes Séance, Poids et Sans tabac arrivent en M3–M6.

**Scan déterministe.** Non applicable (plateforme native).

## Impression générale

Un squelette honnête et propre. Les deux plus gros gains : faire des chiffres les héros de l'écran, et remettre l'enveloppe d'équerre avec Android.

## Ce qui marche

1. Le trait de rythme avec la couleur : un double codage (position et teinte) qui répond à « où j'en suis maintenant ? » plutôt qu'à « combien ? » (GaugeBar.tsx:42).
2. Pensé pour la scène réelle : cibles d'au moins 48 dp, 8 à 16 dp entre elles, libellés français avec le rythme dans accessibilityValue (GaugeBar.tsx:28).
3. Un statut de synchro calme : hors-ligne est une icône neutre, pas une alarme, et la snackbar n'apparaît que sur un vrai échec.

## Problèmes prioritaires

**1. [P1] L'enveloppe n'est pas Android : onglets façon iPhone, bleu iOS, deux thèmes.**
- Pourquoi : `Tabs` sans `tabBar` ni thème (app/(app)/(tabs)/_layout.tsx:13) donne la variante `uikit` par défaut (49 dp, libellés de 10 sp, teinte active rgb(0, 122, 255)). Le fond rgb(242, 242, 242) et l'en-tête blanc viennent du thème de navigation par défaut, alors que app/_layout.tsx:10 ne fournit que Paper. Du violet dans l'écran, du bleu iOS dans les onglets : le cas « iOS app en peau Android » du référentiel. Libellés d'onglets à 4,0:1 (actif) et 3,3:1 (inactif), sous 4,5:1 pour du 10 sp. Cartes sur le fond : 1,02:1.
- Fix : une barre Material 3 (BottomNavigation.Bar de Paper passé en `tabBar`) et un seul thème pour l'en-tête et le fond (adaptNavigationTheme avec les rôles Paper). La variante « material » de la bibliothèque n'existe que pour un rail latéral. Deux onglets aujourd'hui, quatre en M4 : dans les 3 à 5 destinations Material.
- Commande : /impeccable polish

**2. [P1] Les chiffres ne mènent pas.**
- Pourquoi : libellé (titleMedium, 500) et valeur (bodyLarge, 400) font tous deux 16 sp (GaugeBar.tsx:35), et les trois lignes ont le même poids. La North Star veut des données lisibles d'un coup d'œil, d'une main, entre deux séries. Ici il faut lire « 1 100 / 2 200 kcal » et soustraire pour savoir ce qui reste.
- Fix : la valeur du jour en 24 sp sur sa propre ligne, en chiffres tabulaires, avec en dessous « sur 2 500 mL · reste 1,0 L » en corps moyen. Une ligne dédiée évite aussi le débordement aux grandes polices.
- Commande : /impeccable typeset

**3. [P2] Un tap sans retour arrière.**
- Pourquoi : le principe 1 du produit (logguer plus vite que sauter) implique des faux appuis. Corriger un +500 ml demande d'ouvrir la feuille Eau, de retrouver la ligne et d'appuyer sur la poubelle, qui agit tout de suite (WaterSheet.tsx:41). « + Repas » ouvre une modale pour un repas deviné à l'heure.
- Fix : après chaque ajout rapide, une snackbar « +250 ml ajoutés · Annuler » de courte durée. La poubelle peut passer par le même Annuler plutôt que par une confirmation.
- Commande : /impeccable harden

**4. [P2] Les actions rapides sont au milieu de l'écran, et la mise en page ne passera pas à l'échelle.**
- Pourquoi : d'après les styles, sur 360×800 dp la rangée tombe vers 44–56 % de la hauteur, au-dessus du tiers bas où se pose le pouce. « + Repas » finit seul sur une deuxième ligne. Quand M3–M6 ajouteront Pas, Séance, Poids et Sans tabac (spec §6), la rangée descendra sous la ligne de flottaison.
- Fix : épingler la rangée d'ajout rapide en bas du contenu, juste au-dessus de la barre, et laisser jauges et cartes défiler au-dessus.
- Commande : /impeccable layout

**5. [P2] La couleur porte le rythme, et l'orange en est le maillon faible.**
- Pourquoi : l'orange #EF6C00 sur le rail #E0E0E0 fait 2,33:1, sous les 3:1 attendus pour un élément graphique. Le vert (3,88:1) et le rouge (4,26:1) passent. Le rail sur le fond ne fait que 1,18:1. L'état « un peu en retard » est donc le moins lisible, alors que c'est celui qu'il faut remarquer. Le trait (12,2:1) sauve la lecture, mais le double codage ne tient que si le remplissage se voit.
- Fix : assombrir l'orange (par exemple #D84315, environ 3,4:1 sur le rail) et sortir les trois couleurs de COLORS (GaugeBar.tsx:5) vers des rôles du thème.
- Commande : /impeccable audit (vérification chiffrée), puis /impeccable polish

## Personas

**Casey (une main, souvent interrompu).** La rangée d'ajout est au milieu de l'écran et « + Repas » est seul sur une deuxième ligne. Sans Annuler, un faux appui sur +500 ml oblige à rouvrir la feuille. Rien ne se perd hors-ligne : un vrai point fort.

**Sam (TalkBack, grande police).** La jauge est annoncée « Eau : 1,5 / 2,5 L, bouton, dans le rythme », sans dire que le plus ouvre une feuille ou que le chevron ouvre le journal. Libellés d'onglets à 3,3–4,0:1, orange à 2,3:1. La ligne libellé / valeur / icône ne se replie pas (pas de flexShrink) : estimée à ≈ 290 dp sur 304 dp utiles à 1,3×, elle déborde au-delà de 1,5×. À vérifier sur appareil.

**L'auteur entre deux séries (d'après PRODUCT.md).** Il veut savoir en une seconde ce qu'il lui reste à boire et à manger, et doit soustraire de tête. À 14 h, avant le déjeuner, la barre Calories est rouge « en retard », alors qu'en sèche manger moins que le rythme n'est pas un échec.

## Observations mineures

- Au démarrage, useState(NO_TOTALS) (TodayScreen.tsx:35) et le nuage « Hors-ligne » donnent des zéros pendant la première seconde. Une jauge rouge à 0 peut clignoter en fin de matinée.
- Les superpositions divergent : la feuille Eau est blanche, 16 dp, titre titleLarge. Les dialogues Paper sont lavande, 28 dp, titre headlineSmall.
- Les jauges sont « nues » sur le fond alors que Repas met tout dans des cartes. Il faudra une règle quand les cartes Séance, Poids et Sans tabac arriveront.
- Aucun repère de date. L'en-tête dit « Aujourd'hui » même après minuit si l'app reste ouverte.
- Les couleurs de jauge en dur ne suivront pas la redéfinition de la palette (règle « Placeholder Hue » de DESIGN.md).

## Questions à se poser

- Et si l'écran répondait à une seule question, « qu'est-ce qu'il me reste à faire maintenant ? », avec un chiffre dominant et les autres jauges au second plan ?
- En sèche, que doit vouloir dire « dans le rythme » pour les calories : atteindre l'objectif ou ne pas le dépasser ?
- Une fois la rangée d'actions épinglée en bas, que portera la zone qui défile quand les cartes Séance, Poids et Sans tabac arriveront ?
- Le trait mérite-t-il une légende d'une ligne, une seule fois, au premier lancement ?
