# Cahier des charges · L'écran Défis repensé et un vrai entraînement

- **Statut :** proposé le 2026-11-03. Choix du propriétaire le 2026-11-04 (ci-dessous) ; le lot 1 se construit d'un bloc, web et mobile. Restent ouvertes T8, T9, T10 et T12 (lots 2 et 3). La planche de l'écran est sur `/planches/defis`. Les règles tranchées sont dans `regles-du-jeu.md` (P1, P29, P31, P33, P81).
- **Source :** retours du propriétaire du 2026-11-03 sur l'écran Défis du web, dans La Bibliothèque. L'écran est éparpillé : le défi du jour, « Tes mots par palier » qui prend beaucoup de place, l'énigme du jour, une liste « Mots à réviser » dont on ne fait rien, et une liste de catégories d'entraînement qui se lit mal et se personnalise peu. « S'entraîner » n'est pas mis en avant, ses boutons sont plats et aucun ne donne envie. Il manque un vrai entraînement, dans l'esprit d'Anki ou de Duolingo.
- **Règles liées :** P1 (positionnement), P29 (sachet bonus du défi du jour), P31 (ce qu'on révise), P32 et P33 (formats, paliers), P48 (XP), P57 (prononciation), P59 (ouverture par niveau), P72 (rien de payant ne touche la progression), P81 (révisions choisies), P82 (énigme), P84 (écus), P88 (série), P89 (succès), N1 et N2.
- **Cahiers liés :** [revisions-et-modes-de-jeu.md](revisions-et-modes-de-jeu.md) (la partie A, faite, est reprise ici ; la partie B fournit des types de questions), [defis-progression-et-sensation.md](defis-progression-et-sensation.md) (sons et réactions, gardés), [direction-artistique.md](direction-artistique.md) (la place laissée à la frise), [retours-game-designer.md](retours-game-designer.md) (4.1 sachet bonus à ouvrir, 4.2 frise, 4.3 réactions, 4.6 paliers).

## Choix du propriétaire

- **2026-11-04 · Le défi du jour reste à part.** Il ne devient pas l'objectif de la révision principale et n'en est pas le titre (T2 : b). La révision a son propre nom (T3 reste ouverte), le défi du jour garde sa porte, sa frise et son sachet bonus.
- **2026-11-04 · P1 est à revoir.** Le propriétaire juge que le refus de « faire du Duolingo » peut être contre-productif : T1 est rouverte, et « Ce qu'on évite » se relira avec elle.
- **2026-11-04 · Les trois compteurs sont retenus**, avec leurs mots et leurs phrases (voir « La séance » plus bas).
- **2026-11-04 · Une maquette avant de trancher le reste**, pour se représenter l'écran : `/planches/defis`.
- **2026-11-04 · Pas de sous-main façon Jouer.** Une première planche posait la révision sur le sous-main vert, une pioche de cartes au centre et les portées en livres sur une étagère : refusée (« ressemble trop à Jouer », 80 % de l'écran ne sert à rien, les dos de livres se lisent mal en tournant la tête).
- **2026-11-04 · Un tableau de bord.** Des feuilles sur la salle, comme l'album ou le clan. En haut, sur toute la largeur, la révision : les trois compteurs, la phrase et le bouton d'or. Dessous, « S'entraîner sur… » en couvertures de livres vues de face, titre à l'horizontale ; à côté, le défi du jour, l'énigme et Ta mémoire. Remplace « L'écran Défis » plus bas là où ils divergent.
- **2026-11-04 · Un niveau 0, « Page blanche ».** Une carte obtenue n'a pas de palier ; elle passe en Esquisse à sa première bonne réponse (P33). Ta mémoire montre donc quatre parts : Page blanche, Esquisse, Encre, Dorure. À construire avec le lot 1 (règle, données existantes, album, fiche, profil).
- **2026-11-04 · Le nom est « révision ».** « Ta révision », « Réviser tes mots », bouton « Commencer » (T3 : c). « Défi » reste le nom du défi du jour.
- **2026-11-04 · L'entraînement compte pour le défi du jour** (T7 : a). Le clan ne compte toujours que les révisions.
- **2026-11-04 · Les recommandations pour le reste du lot 1 :** T1 a, T4 a, T5 a, T6 a, T11 a, T13 a, T14 a, T15 a, T16 a, T19 a, et T18 a pour l'ordre des lots. Le défi du jour garde sa porte : une série de 5 questions composée comme la révision.
- **2026-11-04 · Le lot 1 d'un bloc**, web et mobile, sans étape intermédiaire à tester.

## Ce qu'on a aujourd'hui

L'écran (`apps/web/src/challenges/challenge-screen.tsx`, `apps/mobile/src/screens/challenges/challenge-screen.tsx`) empile six blocs de même poids :

1. **Défi du jour** : « Commencer le défi » tire 5 questions (`GET /challenges`, limite 5) : les mots dus d'abord, puis les mots jamais révisés. Cinq barres, et la ligne « 8 mots à revoir, dont 2 peuvent monter de palier. 5 nouveaux mots attendent leur première question. »
2. **Tes mots par palier** : trois compteurs Esquisse, Encre, Dorure, une barre partagée et une phrase.
3. **Énigme du jour** (`RiddleEntry`).
4. **Mots à réviser** : les mots dus maintenant ou dans la journée, chacun avec sa miniature, « Réviser » lançant une question sur ce seul mot.
5. **S'entraîner** (`PracticeSection`) : la phrase de règle, puis trois listes de boutons de papier (mes mots ratés et récents, les collections, les thèmes), chacun avec « 12 mots, dont 3 à revoir », et la ligne d'XP.
6. Les notices et erreurs.

Ce qui ne va pas, au-delà de l'allure :

- **Trois portes pour la même chose.** Le défi du jour, « Réviser » sur un mot et une série d'entraînement passent tous par la même révision espacée. Le joueur doit comprendre trois chemins pour faire une seule chose : revoir ses mots.
- **Rien à faire quand rien n'est dû.** « Commencer le défi » répond « Tes mots tiennent bon » et le défi du jour ne peut plus avancer, alors que l'entraînement, plus bas, marche.
- **Les questions ne changent jamais.** QCM « trouver la définition », QCM « trouver le mot », et le mot à écrire quand il peut monter. Aucun réglage de longueur, de difficulté ni de type.
- **Un mot raté disparaît jusqu'au lendemain.** La séance ne le repose pas : on ne referme pas la boucle, alors que c'est le geste central d'Anki et de Duolingo.
- **Le bilan dit peu.** Le score, l'XP, le sachet, les mots montés. Il ne dit ni quels mots revoir, ni quand revient le prochain, ni ce qu'on peut faire ensuite.

## Le principe

**Un seul geste, en grand : faire sa séance.** Comme le bouton « Étudier » d'Anki ou « Commencer » de Duolingo, un bouton d'or lance une série de questions que le serveur compose : les mots à revoir, quelques mots nouveaux, puis de l'entraînement sur les mots les plus fragiles. Le défi du jour n'est plus une porte à part : c'est l'objectif du jour, qui se remplit pendant la séance. Choisir une portée (une collection, un thème) reste possible, mais vient en second. « Séance » est le mot de travail de ce cahier ; le mot de l'interface se tranche en T3.

**On emprunte la mécanique, pas le positionnement.** P1 dit que Leximon n'est pas une application d'apprentissage façon Duolingo. On prend à Anki la révision espacée qu'on a déjà et le rattrapage des mots ratés, à Duolingo le rythme, les réactions, l'objectif du jour et le bilan. On garde ce que ni l'un ni l'autre n'ont : les mots sont des cartes qu'on a trouvées, la séance porte sur sa collection, et c'est la carte qui monte en Encre puis en Dorure. Pas de vies, pas d'énergie, pas de chronomètre imposé, pas de mascotte qui réclame (voir « Ce qu'on évite »). La question T1 le fait trancher.

## L'écran Défis

### Ce qui vient en premier

| Rang | Bloc | Contenu | Aujourd'hui |
|---|---|---|---|
| 1 | **La séance** (le héros) | Ce qui attend, l'objectif du jour en frise, le bouton d'or, la longueur choisie et son réglage | Défi du jour + phrase des mots à revoir |
| 2 | **S'entraîner sur…** | L'étagère des portées : collections, thèmes, mots ratés, récents, prêts à monter | Liste « S'entraîner » |
| 3 | **Ta mémoire** | Une barre fine des paliers, le prochain retour, la série | « Tes mots par palier » |
| 4 | **Autres jeux** | L'énigme du jour en tuile compacte, puis les modes à venir (contre la montre, duel) | Bloc de l'énigme |

**Ce qui disparaît :** la liste « Mots à réviser » (son contenu devient les compteurs de la séance ; voir T15), le panneau « Tes mots par palier » dans sa taille actuelle (voir T14), la phrase de règle de l'entraînement en tête de section (elle passe dans une bulle d'information).

**Ce qui part vers Jouer :** rien de nouveau sur le grand écran du web, qui montre déjà le défi du jour et l'énigme dans sa colonne de gauche. Le « mot à revoir » de Jouer lance la séance, ce mot en premier (aujourd'hui il ouvre une question sur ce seul mot). Sur le téléphone et l'app, Jouer n'a pas l'énigme : T13 propose un bouton rond de plus.

### 1 · La séance

Une grande feuille posée au centre du sous-main.

- **Titre en lettrage :** le nom de la révision (T3), jamais « Défi du jour ».
- **Ce qui attend**, en trois compteurs dans des creux du papier, comme les trois chiffres d'Anki, avec leurs mots : « à revoir », « nouveaux », « peuvent monter ». La ligne du dessous le dit en phrase, avec les accords pour 0, 1 et plusieurs : « 12 mots sont à revoir, dont 2 peuvent passer à l'Encre. 5 nouveaux mots attendent leur première question. » Quand rien n'est dû : « Tes mots tiennent bon. Le prochain revient dans 3 h. Tu peux t'entraîner en attendant. »
- **Le défi du jour reste une porte à part** (choix du 2026-11-04) : sa frise de 5 cases (game designer 4.2), la 3e portant le sachet bonus, et son bouton. Il ne s'affiche pas dans la feuille de la révision.
- **Le bouton d'or :** « Commencer la séance » (ou le verbe retenu en T3), son nombre en bout à droite, comme sur Jouer : « 10 ». Dessous, en petit : « 10 questions, environ 3 minutes ». Le bouton invite toutes les trois secondes tant que l'objectif du jour n'est pas gagné (vie au repos de la DA), puis se calme.
- **Le réglage**, une tuile ronde de papier à côté du bouton, ouvre une feuille : longueur, types de questions, difficulté, son des questions (T4, T8, T10, T16). Le choix est gardé.
- **Après le défi gagné**, le bouton reste le même et dit « Continuer » ; la frise pleine brille une fois, puis se tait.

### 2 · S'entraîner sur… (l'étagère)

Les portées deviennent **des livres sur une étagère**, l'objet que la salle de lecture appelle (T17). Chaque livre est un dos relié :

- **une collection** : le cuir à la couleur de son sachet, son nom en or sur le dos, son sceau (P74) en médaillon ;
- **un thème** : un livre plus mince, en toile, avec la gravure du thème si on en a une, sinon son initiale ;
- **mes mots ratés** : un ruban rouge qui dépasse ;
- **mes mots récents** : un signet de papier neuf ;
- **prêts à monter** (nouvelle portée) : les mots dus qui peuvent passer à l'Encre ou à la Dorure, dos doré. C'est la portée qui donne le plus envie : chaque bonne réponse y fait monter une carte ;
- **depuis l'album** : reste un bouton de l'album, comme aujourd'hui, pas un livre.

Sur chaque dos : une pastille du nombre de mots à revoir (les pastilles qui sautillent de la DA), et une bande dorée dont la hauteur dit la part des mots de la portée passés à l'Encre ou à la Dorure. On voit d'un coup d'œil où l'on est solide. Un livre fermé par le niveau garde son cadenas et « Niv. 3 » (P59). Une portée de moins de 4 mots n'est pas sur l'étagère (P81).

Toucher un livre le sort de l'étagère : une petite feuille s'ouvre avec son nom, « 48 mots, dont 6 à revoir », la barre de paliers de la portée et le bouton « Lancer 10 questions ». Un second toucher ne lance donc jamais rien par erreur.

### 3 · Ta mémoire

Une feuille étroite :

- la barre partagée Esquisse, Encre, Dorure, avec ses trois nombres sous la barre ; la toucher ouvre l'album filtré sur le palier ;
- « Le prochain mot revient dans 3 h. » ;
- la série et le total des jours joués, si T12 les fait entrer dans ce chantier (P88 : le total d'abord, jamais de menace).

### 4 · Autres jeux

Une rangée de tuiles compactes. L'énigme du jour montre son état sans s'ouvrir : « À jouer », « Trouvée au 3e indice », « 4 essais restants ». Les modes de la partie B du cahier des révisions (contre la montre, citation à trous) et le duel (P91) viendront s'y ranger, chacun avec une phrase qui dit sa règle et ce qu'il rapporte.

### Web grand écran, web étroit, téléphone, Android

| Largeur | Disposition |
|---|---|
| **Web à partir de 1180 px** | Le bureau en trois colonnes de Jouer : au centre la séance, plus grande que le reste ; à gauche Ta mémoire puis Autres jeux ; à droite l'étagère, sur deux ou trois rayons. Les feuilles montent l'une après l'autre à l'arrivée, comme sur Jouer. Sur un écran haut, l'étagère prend des rayons de plus, le reste garde sa taille |
| **Web de 760 à 1180 px** | Une colonne : la séance en grand, l'étagère sur toute la largeur, puis Ta mémoire et Autres jeux côte à côte |
| **Web sous 760 px et app Android** | Une colonne, dans l'ordre du tableau des rangs. L'étagère tient à l'écran sur deux ou trois rayons de dos étroits, sans défiler de côté (choix du propriétaire pour l'album, le 2026-11-02). Le bouton d'or reste au-dessus de la barre d'onglets sans défiler sur un téléphone de 360 × 740 |

**Pendant la séance :**

- **Web :** la question est posée sur le sous-main, la frise en haut. Raccourcis clavier façon Anki : 1 à 4 (ou a à d) pour choisir, Entrée pour la question suivante, Échap pour arrêter (avec confirmation si des réponses ont été données). Ils se lisent dans la bulle d'information, pas sur les boutons.
- **App Android et téléphone :** les propositions dans la moitié basse, à portée du pouce ; les vibrations existantes ; les tuiles de lettres (si T8 les retient) assez grandes pour le doigt ; le clavier ne cache jamais le bouton « Valider le mot ».
- Les deux plateformes partagent la logique et les textes dans `packages/view-model` (D-033) et se construisent dans le même lot.

## La séance

### Longueur

10 questions par défaut, au choix 5, 10 ou 20 (T4), plus les questions de rattrapage. Une durée estimée accompagne le choix : 15 secondes par QCM, 25 par mot à écrire, arrondies à la minute.

### Le mélange

Le serveur compose la séance, jamais le client. Dans la portée choisie (tout l'album par défaut), et dans cet ordre de priorité :

1. **Les mots à revoir** (dus), du plus en retard au moins en retard. Ceux qui peuvent monter de palier sont posés en mot à écrire (P32), répartis dans la séance plutôt que groupés à la fin.
2. **Les mots nouveaux** (possédés, jamais révisés), mêlés aux mots à revoir : au plus un sur trois tant qu'il reste des mots à revoir, jusqu'à toute la séance quand il n'y en a plus (T5). Leur première question reste une rencontre (P31), précédée d'une présentation si T11 la retient.
3. **L'entraînement**, pour compléter la longueur : les mots possédés qui ne sont pas dus, **les plus fragiles d'abord** (rappel prédit par FSRS le plus bas à cet instant, puis les mots ratés dans les 30 derniers jours), au lieu du tirage au hasard d'aujourd'hui (`planPractice`). Ces questions ne touchent ni la mémoire, ni le palier, ni le clan (P81).
4. **Le rattrapage** (T6) : un mot raté dans la séance revient au moins trois questions plus tard, sous un autre format (raté en « trouver la définition », il revient en « trouver le mot » ou en lettres à remettre). C'est une question d'entraînement : FSRS a déjà noté l'oubli, et le mot reviendra demain comme aujourd'hui. Trois rattrapages au plus par séance, un par mot. La frise en montre les points à la suite des autres, en plus petit.

Ce qui en sort, pour un joueur type :

| Joueur | 10 questions |
|---|---|
| Nouveau, 25 cartes, rien de révisé | 10 rencontres |
| Régulier, 14 mots dus dont 2 peuvent monter, 8 nouveaux | 7 révisions, dont 2 mots à écrire, et 3 rencontres |
| Assidu, rien de dû | 10 questions d'entraînement sur ses mots les plus fragiles |

### Les types de questions

Chaque type dit ce qu'il compte. La règle d'or ne change pas : **seul le mot écrit de tête fait monter un palier** (P33).

| Type | Ce qu'on voit | Révision (FSRS, défi du jour, clan) | Peut faire monter | Existe |
|---|---|---|---|---|
| Trouver la définition | Le mot (dit à voix haute), 4 définitions | Oui | Non | Oui |
| Trouver le mot | La définition, famille du mot masquée, 4 mots | Oui | Non | Oui |
| Mot à écrire | La définition, un champ, « Je sèche » | Oui | Oui, si 7 ou 30 jours (P33) | Oui |
| **Écoute** | Le mot seulement entendu (P57), sans être écrit, 4 définitions | Oui, comme un QCM | Non | Non |
| **Lettres à remettre** | La définition, les lettres du mot mélangées en tuiles, plus deux lettres en trop | Oui, comme un QCM (T9) | Non | Non |
| **Paires** | 4 mots et 4 définitions à relier | Non, entraînement | Non | Non |
| **Vrai ou faux** | Un mot et une définition, la sienne ou celle d'un autre | Non, entraînement (une chance sur deux) | Non | Non |
| **Citation à trous** | Une citation d'auteur dont le mot manque, 4 mots | Oui, comme un QCM | Non | Non |

L'écoute et les lettres à remettre apportent le plus pour peu de travail : la voix existe pour chaque carte, et les tuiles de lettres sont l'écriture du téléphone, plus rapide que le clavier. Les paires donnent un moment vif en fin de séance. Le vrai ou faux et la citation à trous peuvent attendre (T8). L'écoute ne se pose jamais quand le son est coupé dans les réglages ou dans la feuille de la séance.

### Les réactions

Celles du cahier [defis-progression-et-sensation.md](defis-progression-et-sensation.md) restent : sons, vibrations, éclat sur la bonne réponse, tremblement sur la mauvaise, reflet doré du palier. On ajoute :

- **la frise** qui se remplit, la case du sachet qui s'anime avec son carillon à la 3e bonne réponse comptée ;
- **après une erreur**, la carte du mot en miniature à côté de la bonne réponse, avec le bouton qui fait entendre le mot : on revoit l'objet qu'on possède, pas seulement un texte ;
- **une suite de bonnes réponses** (5 d'affilée) fait briller la frise une fois, sans texte : ce n'est pas une récompense, donc pas de « ! » (`docs/voix.md`) ;
- **un rattrapage réussi** prend le titre ordinaire d'une bonne réponse, et le bilan ne compte plus ce mot parmi ceux à revoir demain s'il n'était pas dû (il reste à revoir demain s'il l'était : FSRS a noté l'oubli).

### Le bilan

Sur une feuille posée sur le sous-main, dans cet ordre :

1. **Le score** qui compte jusqu'à sa valeur (existe), puis l'XP gagnée.
2. **L'objectif du jour** : la frise, et le sachet gagné avec le bouton « Ouvrir mon sachet bonus » (game designer 4.1).
3. **Les cartes montées** à l'Encre ou à la Dorure, en cartes, avec leur reflet.
4. **Les mots à revoir demain** : les mots ratés, en miniatures qui ouvrent la carte. « Ces 2 mots reviendront demain. »
5. **La suite** : « Le prochain mot revient dans 3 h. », la part de l'objectif du clan (existe), le jour de série compté si T12 l'a fait entrer.
6. **Deux boutons** : « Encore 10 questions » en or quand il reste des mots à revoir ou nouveaux, sinon « Ouvrir un sachet » en or et « Encore 10 questions » en papier. « Retour aux défis » en lien.

### Série et objectif du jour

L'objectif du jour reste un seul objectif, le défi du jour (P29) : 5 réponses dont 3 justes pour un sachet bonus. Pas de second objectif personnalisable à côté (Duolingo laisse choisir 5, 10 ou 20 minutes) : deux objectifs se brouillent, et le sachet bonus ne peut pas changer de prix selon le choix du joueur (T12).

La série existe déjà en règle (P88, tranchée, pas construite) : un jour compte dès qu'on ouvre un sachet, qu'on répond à un défi ou qu'on joue l'énigme ; deux jours pardonnés par semaine ; le total des jours joués d'abord ; aucun texte qui menace. C'est le ressort de Duolingo qu'on garde, sans sa pression. T12 demande si elle se construit avec ce chantier, et se montre alors dans Ta mémoire et au bilan.

### Les récompenses

Rien de nouveau dans l'économie, et rien qui se paie (N1, N2, P72) :

| Ce qu'on fait | Ce qu'on gagne | Règle |
|---|---|---|
| Bonne réponse à un mot à revoir ou nouveau | 15 XP | P48 |
| Bonne réponse d'entraînement ou de rattrapage | 5 XP, 100 XP par jour au plus | P81 |
| 5 réponses comptées dont 3 justes, une fois par jour | 1 sachet bonus | P29 |
| Les 5 premières questions du jour justes | 5 écus, quand les écus existeront | P84 |
| Un mot qui passe à l'Encre ou à la Dorure | 25 XP ; à la Dorure, 1 sachet bonus | P48, P29 |
| Succès de la famille « savoir » | Quand le carnet existera | P89 |

Le gain principal de l'entraînement est d'être lisible : la frise, le sachet qu'on ouvre depuis le bilan, la carte qui monte. Le plafond de 100 XP d'entraînement par jour sera atteint plus souvent avec une vraie séance (20 bonnes réponses d'entraînement) : la ligne d'XP le dit déjà, et l'entraînement continue sans XP. T7 et T13 posent les deux seules questions d'économie.

Une personnalisation ne s'achète jamais : longueur, types, portées et difficulté sont gratuits pour tous. L'abonnement Mécène n'y ajoute rien (P72).

### La personnalisation

| Réglage | Choix | Par défaut | Où |
|---|---|---|---|
| Portée | Tout, une collection, un thème, ratés, récents, prêts à monter, un filtre de l'album | Tout | L'étagère, l'album |
| Longueur | 5, 10, 20 questions | 10 | Feuille de la séance |
| Types de questions | Cocher l'écoute, les lettres, les paires (les trois QCM et le mot à écrire restent toujours) | Tous cochés | Feuille de la séance |
| Difficulté | Normale ou Exigeante (T10) | Normale | Feuille de la séance |
| Son des questions | Le mot dit à voix haute, ou non (réglage existant de la prononciation) | Le réglage du jeu | Feuille de la séance |

**Exigeante**, si T10 la retient : en entraînement, les lettres à remettre et le mot à écrire remplacent souvent le QCM, et les mauvais choix des QCM viennent du même thème et ont la même première lettre que la bonne réponse. Une révision comptée ne change pas : son format reste celui de P32, pour que FSRS et les paliers mesurent la même chose pour tous.

Les réglages sont gardés sur le compte (T16), pour suivre le joueur du web à son téléphone.

## Quand la collection grandit

Un joueur régulier ouvre une douzaine de sachets par jour au début : une cinquantaine de cartes, dont la plupart sont des mots nouveaux. En une ou deux semaines, il possède plusieurs centaines de mots. C'est le cas normal, pas une exception, et la séance doit le tenir.

**Ce qui coûte, ce sont les mots qu'on commence, pas ceux qu'on possède.** Avec FSRS réglé à 90 % de rétention, un mot bien su revient environ 4 fois dans son premier mois (vers 1, 3, 10 et 30 jours), puis tous les deux ou trois mois. La charge du jour dépend donc du nombre de mots nouveaux qu'on commence chaque jour, à peu près :

| Mots nouveaux commencés par jour | Questions par jour, une fois le rythme pris | Soit |
|---|---|---|
| 5 | environ 25 | 2 à 3 séances de 10 |
| 10 | environ 50 | 5 séances |
| 20 | environ 100 | 10 séances |
| 50 (tout ce qu'on ouvre, comme aujourd'hui) | environ 250 | intenable |

Sans limite, la pile « à revoir » grossit sans fin et décourage : c'est l'écueil d'Anki quand on ajoute trop de cartes. D'où ce qu'on propose :

- **Un rythme, choisi par le joueur** (T19) : 5, 10 ou 20 mots nouveaux commencés par jour, 10 par défaut. Le compteur « nouveaux » montre ce qui reste du jour (« 5 »), pas les 300 mots jamais révisés. Les autres attendent leur tour dans l'album, sans rien perdre : la carte reste à lui.
- **Les plus récents d'abord** : le mot qu'on vient de révéler dans un sachet est celui dont on se souvient le mieux, il entre en premier.
- **Pas de dette affichée.** Après une absence, les mots les plus en retard passent d'abord, et la phrase dit ce qui attend sans reproche : « 140 mots sont à revoir. Les plus urgents passent d'abord. » FSRS tient compte du retard réel : un mot revu en retard et su s'espace davantage.
- **S'entraîner reste ouvert à tout** : l'étagère pose des questions sur n'importe quel mot possédé, commencé ou non, sans toucher la mémoire (P81).
- **Les doubles n'ajoutent rien** : la mémoire est rangée par mot, pas par exemplaire.
- **Côté serveur**, quelques centaines puis quelques milliers de lignes de mémoire par joueur, lues par une seule requête indexée : rien à craindre (1 561 mots au catalogue aujourd'hui).

## Avec la révision espacée et les paliers

Rien ne change dans ce que la mémoire enregistre. C'est la condition pour que la séance ne casse pas le jeu.

- **FSRS ne voit que des révisions honnêtes :** un mot dû ou nouveau, une fois par séance. L'entraînement, le rattrapage et les paires n'écrivent jamais dans `user_mastery` (P81). Pas d'étapes courtes d'Anki (`enable_short_term` reste coupé) : un mot oublié revient demain, comme aujourd'hui (P31).
- **Les paliers restent prouvés de tête :** seul le mot écrit, 7 puis 30 jours après la révision précédente, fait monter (P33). Les lettres à remettre aident à retenir l'orthographe, sans prouver le rappel.
- **Les nouveaux types notent FSRS comme un QCM :** juste « Good », faux « Again ». Un mot à écrire avec une faute reste « Hard ».
- **Le défi du jour** compte les réponses comptées, et l'entraînement si T7 le décide. **Le clan** ne compte jamais l'entraînement (P66 lit des bonnes réponses de défi ; une ferme à l'objectif de la semaine serait trop facile).
- **La triche** reste bornée comme aujourd'hui : le catalogue est public, mais un palier demande des semaines et les gains d'entraînement sont plafonnés.

## Ce qu'on évite

- Les vies, les cœurs, l'énergie : une erreur ne coûte rien d'autre que le mot qui revient demain.
- Un chronomètre imposé : le contre-la-montre restera un mode qu'on choisit.
- Une mascotte qui réclame, des notifications « Tu vas perdre ta série », un hibou. Maître Furet ne parle qu'au bilan, et seulement s'il a de la place (`docs/voix.md`).
- Un classement de la séance (P51).
- Un second objectif du jour à côté du défi du jour.
- Toute récompense qui ferait d'un sachet un objet qu'on paie (N1).

## Ce qui change dans le code

### Règles (`packages/core`)

- **`rules.ts` :** une nouvelle période datée du réglage de l'entraînement (`TRAINING_SCHEDULE`, ou une période de `PRACTICE_SCHEDULE`) : longueurs permises (5, 10, 20), longueur par défaut, part des nouveaux mots tant qu'il reste des mots dus (1 sur 3), nombre de rattrapages (3) et écart (3 questions), types ouverts. Avant la mise en ligne publique, la période se corrige en place.
- **`mastery/practice.ts` :** `planTrainingSession`, pure et testée : le mélange ci-dessus, avec le tirage cryptographique déjà utilisé. `fragility` lit le rappel prédit par ts-fsrs (`get_retrievability`) pour trier l'entraînement.
- **`mastery/challenge.ts` :** `buildLettersQuestion` (les lettres et deux leurres, jamais une anagramme qui forme un autre mot du catalogue), `buildPairsQuestion` (4 mots d'une même collection), `buildListenQuestion` (le QCM « trouver la définition » sans le mot écrit). La correction des lettres réutilise `gradeTyped`.
- **Tests :** le mélange pour chaque type de joueur du tableau, la part des nouveaux, les rattrapages, le tri par fragilité ; un test statistique sur la répartition des formats et la place de la bonne réponse.

### Données (`packages/db`), migrations additives

- **`challenge_format`** (enum) : ajouter `listen` et `letters`. Les anciens clients n'envoient jamais ces valeurs.
- **`practice_answers`** : ajouter `card_id` et `format`, nullables. Le bilan, le rattrapage et le futur taux de réussite (P92) en ont besoin ; les lignes existantes restent sans.
- **`user_preferences`** : ajouter la longueur, les types cochés et la difficulté, avec des valeurs par défaut (si T16 garde les réglages sur le compte).
- **Si T12 fait entrer la série :** une table des jours joués (`user_play_days`, clé joueur et jour de Paris), écrite par `insert … on conflict do nothing` dans la transaction de chaque action qui compte. La série se calcule à la volée (P88), sans tâche planifiée.
- Pas de table de séance : l'API reste sans état. La séance est un plan envoyé au client, chaque réponse est une écriture indépendante, avec sa clé d'idempotence, comme aujourd'hui.

### API (`apps/api/src/challenges`)

- **`POST /challenges/session`** (nouvelle) : portée (tout par défaut, sinon une portée de `PracticeScope` ou « prêts à monter »), longueur, types, difficulté, validés par Zod. Réponse : les questions, chacune avec son format, ses choix (ou ses lettres, ou ses paires) et `counted`. Une seule lecture des mots possédés avec leur mémoire (`ownedWords`, déjà là), une lecture des mots ratés, le catalogue en mémoire.
- **`GET /challenges/practice`** : champs ajoutés par portée (nombre de mots qui peuvent monter, nombre par palier), et une portée `rising`. Additif.
- **`POST /challenges/answer`** : accepte `listen` (un choix) et `letters` (un mot, jamais de montée de palier, même si le mot pourrait monter).
- **`POST /challenges/practice/answer`** : accepte un mot écrit, des lettres, des paires, un vrai ou faux, et enregistre la carte et le format.
- **Ne casse rien :** `GET /challenges`, `POST /challenges/practice` et leurs réponses restent tels quels pour les versions publiées de l'app.
- **Tests d'intégration :** deux réponses simultanées sur le même mot dû (une seule révision), une révision et un rattrapage du même mot dans la même séance, le plafond d'XP d'entraînement sous requêtes concurrentes (existe, à étendre aux nouveaux formats), le défi du jour avec ou sans l'entraînement selon T7.

### View-model (`packages/view-model`)

- **`training.ts`** : la vue de la séance (compteurs, phrase, durée estimée, libellé du bouton, frise, états vides), la vue de l'étagère (livres, pastilles, part dorée, cadenas), la vue du bilan (mots à revoir demain, prochain retour, boutons de suite), les raccourcis clavier. Chaque texte avec un nombre est testé pour 0, 1 et plusieurs.
- **`practice.ts`** : reprend les portées et leurs textes ; `PRACTICE_RULE` passe dans la bulle d'information.
- **`challenges.ts`** : `challengeOutlook`, `outlookLine` et `escapingWords` servent les compteurs de la séance ; `escapingWords` ne sert plus qu'au « mot à revoir » de Jouer.
- **Réordonner les rattrapages côté client** : une fonction pure qui insère le mot raté trois questions plus loin, testée. Le serveur accepte la réponse d'entraînement comme n'importe quelle autre.

### Écrans

- **Web :** `apps/web/src/challenges/` (écran, séance, bilan, étagère, feuille des réglages), les pièces de la bibliothèque (`apps/web/src/library/`) pour le livre et la frise, `/planches` pour les montrer.
- **Mobile :** `apps/mobile/src/screens/challenges/` et `apps/mobile/src/library/`, mêmes pièces, avec les tuiles de lettres et les vibrations.
- **Jouer :** le « mot à revoir » lance la séance ; sur le mobile, le bouton rond de l'énigme si T13 le retient.

## Découpage une fois validé

| Lot | Contenu | Web et mobile |
|---|---|---|
| 1 | L'écran repensé : séance en héros, frise, étagère, Ta mémoire, Autres jeux. La séance unique avec sa longueur, le mélange, les rattrapages, le tri par fragilité, le bilan enrichi, les raccourcis clavier. Serveur d'abord (route, règles, tests d'intégration) | Ensemble |
| 2 | Les nouveaux types de questions retenus en T8 | Ensemble |
| 3 | Les réglages (types, difficulté, gardés sur le compte) ; la série si T12 la fait entrer | Ensemble |

La recette ajoute des tests DEF et MDE à `recette-web.md` et `recette-mobile.md` à chaque lot.

## Questions au propriétaire

Chaque question a une recommandation, en premier.

**T1 · Positionnement.** P1 dit « pas une app d'apprentissage façon Duolingo ». Rouverte le 2026-11-04 : le propriétaire juge ce refus peut-être contre-productif. Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Préciser P1 : on emprunte la mécanique de séance d'Anki et de Duolingo, mais l'accueil, la vente et le cœur restent la collection.
- b. Assumer un virage vers l'apprentissage, aussi dans la landing et les stores.
- c. Ne rien emprunter de plus : on se contente de remettre l'écran en ordre.

**T2 · Combien de portes.** Tranchée le 2026-11-04 : b, le défi du jour reste à part.
- a. **(recommandé)** Une seule séance en héros, qui remplit le défi du jour ; les portées en second, sur l'étagère.
- b. Garder le défi du jour (5 questions) et un entraînement séparé, chacun son bouton.
- c. Une seule séance, sans portées : on retire le choix de collection et de thème.

**T3 · Le nom dans l'interface.** Tranchée le 2026-11-04 : c.
- a. **(recommandé)** « Défi » partout, comme le lexique : « Commencer le défi », « Continuer », « un défi de 10 questions ». Le défi du jour devient l'objectif qui se remplit.
- b. « Séance » : « Commencer la séance », le défi du jour reste le nom de l'objectif.
- c. « Révision » : plus clair sur ce qu'on fait, plus scolaire.

**T4 · La longueur.** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** 10 par défaut, au choix 5, 10 ou 20.
- b. 10, fixe.
- c. 5, 10 ou 20, plus « jusqu'à ce qu'il n'y ait plus rien à revoir » (à la Anki).

**T5 · Les mots nouveaux dans la séance.** (Recommandation changée le 2026-11-04, après la question du propriétaire sur les grandes collections.) Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Mêlés aux mots à revoir, un sur trois au plus tant qu'il en reste, dans la limite du rythme du jour (T19), les plus récents d'abord.
- b. Mêlés de la même façon, sans limite par jour : la pile grossit vite (voir « Quand la collection grandit »).
- c. Comme aujourd'hui : tous les mots dus d'abord, puis les nouveaux, sans limite.

**T6 · Un mot raté dans la séance.** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Il revient trois questions plus tard, sous un autre format, en entraînement (5 XP, rien pour FSRS) ; trois rattrapages au plus.
- b. Il ne revient pas avant demain, comme aujourd'hui.
- c. Il revient et compte pour FSRS (étapes courtes d'Anki) : plus fidèle à Anki, mais un mot oublié pourrait sembler acquis le jour même.

**T7 · Le défi du jour et l'entraînement.** Aujourd'hui, une question d'entraînement ne compte pas pour le défi du jour (P81) : un joueur qui n'a rien à revoir ne peut pas gagner son sachet bonus. Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Toute question de la séance compte pour le défi du jour, entraînement compris. Le sachet reste un par jour, et le clan ne compte toujours que les révisions.
- b. Garder P81 : seules les révisions comptent, et la frise le dit (« Aucun mot à revoir pour l'instant. Ces questions ne comptent pas pour le défi du jour. »).

**T8 · Les nouveaux types de questions du lot 2.**
- a. **(recommandé)** Écoute, lettres à remettre et paires.
- b. Écoute et lettres à remettre seulement.
- c. Les cinq : écoute, lettres, paires, vrai ou faux, citation à trous.
- d. Aucun pour l'instant : le lot 1 d'abord, on verra en jouant.

**T9 · Ce que comptent les lettres à remettre.**
- a. **(recommandé)** Une révision comme un QCM : elles entretiennent le mot, ne font jamais monter.
- b. De l'entraînement seulement, sans FSRS.
- c. Une révision qui peut faire monter, comme le mot à écrire : plus facile sur un téléphone, mais la rétention n'est plus prouvée de tête.

**T10 · La difficulté.**
- a. **(recommandé)** Normale ou Exigeante, qui ne change que l'entraînement (plus de lettres et de mots à écrire, des mauvais choix plus proches).
- b. Pas de réglage.
- c. Facile, Normale, Exigeante, Facile proposant 2 choix au lieu de 4 en entraînement.

**T11 · Présenter un mot nouveau.** Sa première question est une rencontre (P31), parfois des jours après l'ouverture du sachet. Tranchée le 2026-11-04 : a.
- a. **(recommandé)** La carte s'affiche d'abord, avec le mot dit à voix haute, puis vient sa question « trouver la définition ».
- b. Pas de présentation, comme aujourd'hui.
- c. La présentation seulement si la carte a été obtenue il y a plus de 24 h.

**T12 · La série et l'objectif.**
- a. **(recommandé)** Construire la série de P88 avec ce chantier (lot 3), montrée dans Ta mémoire et au bilan. Un seul objectif du jour, le défi du jour.
- b. Laisser la série en phase 5, avec les écus, comme prévu.
- c. La série avec ce chantier, plus un objectif personnel au choix (10, 20 ou 30 questions par jour), sans récompense.

**T13 · L'énigme du jour.** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Une tuile compacte dans Autres jeux sur Défis, et un bouton rond sur Jouer dans l'app et sur le téléphone (le grand écran l'a déjà).
- b. Une tuile compacte sur Défis seulement.
- c. Elle quitte Défis : Jouer seulement, avec le bouton rond sur le téléphone.

**T14 · « Tes mots par palier ».** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Une barre fine dans Ta mémoire, qui ouvre l'album filtré sur le palier ; la part dorée de chaque portée sur l'étagère.
- b. Retiré de Défis : les paliers se lisent dans l'album et le profil.
- c. Gardé tel quel, en plus petit.

**T15 · La liste « Mots à réviser ».** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Elle disparaît : ses mots sont les compteurs de la séance, qui les pose en premier, et « prêts à monter » devient un livre de l'étagère.
- b. Elle disparaît, et un lien « Voir les 12 mots » ouvre la liste dans une feuille, sans bouton par mot.
- c. Elle reste, repliée sous la séance.

**T16 · Où vivent les réglages de la séance.** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Sur le compte, côté serveur : ils suivent le joueur du web à son téléphone.
- b. Sur l'appareil seulement : plus simple, mais à refaire sur chaque appareil.

**T17 · L'allure des portées.** Tranchée le 2026-11-04 : des couvertures vues de face, dans le tableau de bord.
- a. **(recommandé)** Des livres sur une étagère, avec pastille et part dorée.
- b. Des tuiles-objets en grille, comme les tuiles de Jouer, avec le sceau ou la gravure.
- c. Les boutons actuels, en tuiles de papier plus grandes, avec leur barre de paliers.

**T18 · L'ordre des lots.** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Lot 1 (écran et séance), lot 2 (types de questions), lot 3 (réglages et série).
- b. Lot 1 et lot 2 ensemble, pour juger la séance avec ses nouveaux types d'un coup.
- c. Lot 1 seulement, le reste après la semaine de jeu dans La Bibliothèque.

**T19 · Le rythme des mots nouveaux.** Tranchée le 2026-11-04 : a.
- a. **(recommandé)** Au choix du joueur, 5, 10 ou 20 mots nouveaux commencés par jour, 10 par défaut, dans la feuille de la séance.
- b. Fixe, 10 par jour.
- c. Fixe, 20 par jour, comme Anki.
