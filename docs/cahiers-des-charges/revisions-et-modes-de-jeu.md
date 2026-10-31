# Cahier des charges · Révisions choisies et nouveaux modes de jeu

- **Statut :** choix tranchés par le propriétaire le 2026-10-30, tous selon les recommandations : R1 mixte, R2 niveaux 1 et 3, R3 oui, ordre A, énigme du jour, contre la montre, citation à trous, joutes. Partie A faite le 2026-10-30 (règle P81, recette DEF-09 et MDE-02), web vérifié dans le navigateur, mobile à recetter sur téléphone. Énigme du jour faite le 2026-10-31 (règle P82, recette DEF-10 et MDE-03), vérifiée dans le navigateur et sur un émulateur Android ; le reste de la partie B reste à faire.
- **Source :** retours du propriétaire du 2026-10-28 : « rajouter plus de défis, pouvoir faire des révisions thématiques que sur certains mots, ou certaines collections, et rajouter plus de modes de jeu, notamment des modes de jeu défis plus fun ». Public adulte : du jeu, pas de surenchère.
- **Règles liées :** P16 (thèmes), P31 (ce qu'on révise), P32 et P33 (formats, paliers), P29 (plis bonus), P48 (XP), P52 (modes entre joueurs, en R&D), P59 (fonctionnalités par niveau). Cahier lié : [defis-progression-et-sensation.md](defis-progression-et-sensation.md).

## Ce qu'on a aujourd'hui

Un seul chemin : « Commencer le défi » tire 5 mots choisis par la révision espacée (mots dus d'abord, puis mots jamais vus), en QCM, ou en mot à écrire quand il peut monter de palier. On peut aussi réviser un mot précis depuis « Mots à réviser ». Le joueur ne choisit ni le thème, ni la collection, ni le format, et il n'y a rien à faire quand aucun mot n'est dû.

## Partie A · Les révisions choisies

### Ce que le joueur fait

Sur l'écran Défis, une section « S'entraîner » sous le défi du jour. Le joueur choisit une portée, puis lance une série de 10 questions en QCM :

- **une collection** (Les Fondateurs, Caractères et travers…) ;
- **un thème** (P16 : cuisine, insultes, métiers…) ;
- **mes mots ratés** : les mots manqués dans les 30 derniers jours ;
- **mes mots récents** : les 30 derniers mots obtenus ;
- **depuis l'album** : un filtre posé dans l'album (collection, rareté, thème, palier) se révise avec « Réviser ces mots ».

Seuls les mots possédés entrent (P31). Une portée de moins de 4 mots n'est pas proposée : il faut 4 choix au QCM, et les mauvais choix viennent de la même collection, possédés ou non, comme aujourd'hui.

### Ce que ça compte : **À trancher (R1)**

C'est la vraie question : un entraînement choisi peut casser la révision espacée (revoir un mot trop tôt n'apprend rien à FSRS) et ouvrir une ferme à XP.

| Option | Ce qui se passe | Pour | Contre |
|---|---|---|---|
| **a. Entraînement libre** | Ne touche ni FSRS, ni les paliers, ni le défi du jour. Un peu d'XP | Simple, rien à exploiter, FSRS reste propre | Moins gratifiant |
| **b. Mixte** (recommandé) | Dans la portée, les mots dus passent en premier et comptent comme une révision normale (FSRS, palier, défi du jour). Les autres sont de l'entraînement libre (option a) | Réviser par thème fait vraiment avancer ; aucun mot revu trop tôt | Deux régimes à expliquer, en une phrase : « Les mots à revoir comptent pour ta mémoire, les autres sont pour t'entraîner. » |
| **c. Tout compte** | Chaque réponse est une révision FSRS | Le plus simple à dire | Revoir trop tôt fausse FSRS ; XP et défi du jour se farment |

**Recommandation : b.** XP d'entraînement : 5 par bonne réponse (au lieu de 15), plafonnés à 100 par jour, pour que l'entraînement reste un plaisir et pas la voie rapide vers les niveaux. Le mot à écrire n'apparaît que pour un mot dû qui peut monter (P33 inchangée).

### Ouverture : **À trancher (R2)**

Recommandation : dès le niveau 1 pour les collections et « mes mots ratés » (c'est de l'apprentissage, P59 veut des défis jamais fermés) ; thèmes et « depuis l'album » au niveau 3, avec le choix de la collection des sachets, quand le joueur a assez de mots pour que la portée tienne.

### Technique

- `POST /challenges/practice` avec la portée validée par Zod (`collection`, `theme`, `missed`, `recent`, ou une liste de 4 à 50 identifiants de cartes possédées pour l'album) ; le serveur tire les mots, jamais le client.
- Les réponses passent par la route actuelle avec un champ `mode: "practice"` ; une réponse d'entraînement n'écrit pas dans `user_mastery`. Plafond d'XP compté côté serveur, dans la même transaction, ligne verrouillée.
- « Mes mots ratés » lit `review_logs` (partitionnée par mois), qui garde déjà chaque réponse ; un index sur (joueur, date) est à vérifier pour cette lecture.
- Index : `user_cards (user_id, card_id)` existe ; la portée par thème lit le catalogue en mémoire, pas la base.

## Partie B · Des modes plus amusants

Tous les modes ci-dessous sont solo, sans hasard payant ni mise de cartes (P52), et réutilisent le catalogue. Notés de 1 à 3.

| Mode | Principe | Amusant | Effort | Fait revenir | Remarques |
|---|---|---|---|---|---|
| **Énigme du jour** | Le même mot pour tous chaque jour. La définition se dévoile en trois indices, puis les lettres une à une ; on tape le mot. Résultat partageable sans divulgâcher (« Leximon n° 42, trouvé au 2e indice ») | 3 | 2 | 3 | Le seul mode qui fait venir de nouveaux joueurs : le partage. Mot tiré parmi les Courants et Peu communs pour rester faisable ; le trouver donne de l'XP, et la carte si le joueur ne l'a pas (à trancher, R3) |
| **Contre la montre** | 60 secondes, autant de bonnes réponses que possible sur ses mots, QCM rapide. Meilleur score de la semaine | 2 | 1 | 2 | Réutilise le QCM tel quel. Entraînement libre (pas de FSRS) |
| **Citation à trous** | Une citation d'auteur dont le mot manque, 4 choix | 2 | 1 | 1 | Seulement les cartes avec citation ; très dans le ton du jeu |
| **Vrai ou faux** | Un mot et une définition : la bonne, ou celle d'un autre mot. Un geste par réponse (balayer sur le téléphone) | 2 | 1 | 1 | Rythme rapide, bon pour 2 minutes dans le métro |
| **Mot réel ou inventé** | Quatre mots, un seul existe, ou l'inverse | 3 | 3 | 1 | Drôle, mais il faut des faux mots crédibles : génération et relecture, donc coût de contenu |
| **Joutes** (P52, niveau 15) | Partie à deux sur 5 mots, 24 h par tour ; duplicate de la semaine | 3 | 3 | 3 | Déjà prévues, R&D ; demandent du temps réel léger et de la modération. Après les modes solo |

**Recommandation, dans l'ordre :**

1. **Révisions choisies** (partie A) : c'est la demande la plus claire, et la plus utile pour apprendre.
2. **Énigme du jour** : le meilleur rapport entre effort et effet, parce qu'il fait parler de Leximon hors du jeu. À sortir avant l'ouverture publique si possible.
3. **Contre la montre**, puis **citation à trous** : peu de travail, ils donnent quoi faire quand aucun mot n'est dû.
4. **Joutes** ensuite, avec leur R&D.

L'écran Défis garde le défi du jour en tête ; les modes se rangent dessous, en cartes, chacune avec une phrase qui dit la règle et ce qu'elle rapporte.

## Ce qu'on évite

- Les séries de jours qui punissent l'absence (« Tu vas perdre ta série de 12 jours ! ») : efficace, mais c'est la pression que le public adulte rejette. Une série qui se compte sans menace peut se discuter à part.
- Les vies, l'énergie, les chronomètres partout : le contre-la-montre est un mode qu'on choisit, pas la règle.
- Toute récompense de mode qui rendrait un sachet acheté utile : rien ne s'achète qui touche au hasard.

## Décisions à prendre

1. **R1** : ce que compte une révision choisie (a, b ou c ; recommandé : b, XP d'entraînement 5 par bonne réponse, 100 par jour au plus).
2. **R2** : à quel niveau s'ouvrent les révisions choisies (recommandé : collections et mots ratés au niveau 1, thèmes et album au niveau 3).
3. **R3** : l'énigme du jour donne-t-elle la carte trouvée à qui ne l'a pas (recommandé : oui, un exemplaire, comptée comme une carte obtenue ; c'est un cadeau connu d'avance, pas un tirage).
4. **Ordre des chantiers** (recommandé : A, énigme du jour, contre la montre, citation à trous, joutes).

## Découpage une fois validé

- **Lot 1** : révisions choisies, serveur (route, portées, XP d'entraînement, tests d'intégration avec requêtes concurrentes) puis web et mobile.
- **Lot 2** : énigme du jour (choix du mot daté côté serveur, indices, partage, page publique du résultat).
- **Lot 3** : contre la montre et citation à trous.
