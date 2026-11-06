# Cahier des charges · Les joutes, la suite : sensation, accueil guidé et ligues

- **Statut :** proposé le 2026-11-06, en attente des choix du propriétaire (L1 à L11). Rien de construit.
- **Source :** retours du propriétaire du 2026-11-06, après une joute jouée contre les bots en local. Le principe marche. Ce qui ne va pas :
  - l'interface manque de sensation (« juicyness ») ;
  - la joute n'est pas assez expliquée ;
  - l'écran de fin est insuffisant (« Joute contre Recette. Ta partie est jouée. Recette a jusqu'à demain 17 h 20 pour jouer la sienne. ») ;
  - la règle est affichée en permanence sur l'accueil des joutes. Il faut la montrer une fois, dans un vrai accueil guidé « à la Clash of Clans », puis la laisser derrière une bulle d'aide ;
  - le classement et la cote manquent ;
  - il faut des ligues, à penser sérieusement comme un système entier ;
  - le joueur arrive avec un deck déjà composé, alors que c'était à lui de le composer.
- **Règles liées :**
  - P23 (réserve), P51 (classements), P52 (sans mise), P84 (écus) ;
  - P91 (joutes), P95 (carnet), P96 (saison), P97 (récompenses connues) ;
  - N1 ([regles-du-jeu.md](../regles-du-jeu.md)).
- **Cahiers liés :**
  - [joutes.md](joutes.md) : le lot 1, et J12 pour la cote et les rangs ;
  - [saison.md](saison.md) : le calendrier, en attente de S1 à S9 ;
  - [direction-artistique.md](direction-artistique.md) ;
  - [economie.md](economie.md).

## Ma recommandation en une phrase

Le joueur découvre la joute une seule fois, dans un accueil guidé avec Maître Furet : il compose son deck lui-même, joue une joute d'entraînement de 3 mots, puis lance sa première vraie joute. Chaque moment de la joute devient une scène :
- le face-à-face avant de jouer ;
- le chrono qui brûle pendant les questions ;
- le bilan qui se retourne carte après carte une fois sa partie jouée ;
- la révélation du résultat, jouée une fois comme un tirage de tournoi.

Au-dessus, une échelle de **lauriers** en cinq ligues aux noms de tournoi (Page, Écuyer, Chevalier, Banneret, Champion). Les lauriers se gagnent en joute classée, se remettent en jeu à chaque saison de 4 semaines, et chaque ligue atteinte donne une récompense connue d'avance. La cote Glicko-2 reste ce qui choisit l'adversaire.

## Pourquoi le deck était déjà composé

C'est la règle du lot 1 (P91, J3 du cahier) : « le jeu en compose un d'office, que le joueur change quand il veut ». Le but était qu'un joueur puisse jouter dès sa première visite, sans passer par un éditeur. Ce deck d'office prend les cartes les plus rares qui tiennent dans les 25 points.

Le retour montre le prix de ce choix : le deck est « la meilleure idée du brief » (avis du game designer, joutes.md), et le joueur ne le découvre jamais comme le sien. L2 propose de le lui faire composer dans l'accueil guidé.

## L'avis du game designer

**1. La sensation vient du rythme, pas de la décoration.**
- Une joute dure une minute et demie. Le joueur doit sentir trois montées : l'entrée en lice, chaque réponse, et le verdict.
- Le lot 1 a les trois moments, mais aucun n'a de mise en scène. La question s'affiche, la réponse aussi, et la fin tient en deux phrases.
- Ce que font Clash Royale, Hearthstone ou Marvel Snap tient en quatre gestes :
  - un face-à-face qui présente l'adversaire avant le combat ;
  - un retour immédiat et physique sur chaque action (son, vibration, éclat, chiffre qui vole) ;
  - un verdict qui prend son temps (bannière, fanfare) ;
  - des gains qu'on voit arriver dans leur jauge.

**2. Un tutoriel joué vaut dix phrases.**
- Clash of Clans, Clash Royale et Brawl Stars apprennent leur règle en la faisant jouer, guidée, sans enjeu, avant le premier vrai combat.
- La règle des joutes tient en une phrase, mais trois de ses idées surprennent :
  - on répond aux mots de l'autre, pas aux siens ;
  - le second joueur court contre la partie enregistrée du premier ;
  - le résultat arrive plus tard.
- Une joute d'entraînement de 3 mots les montre mieux que le paragraphe affiché aujourd'hui.

**3. L'attente doit donner envie de revenir.** L'asynchrone a un creux : j'ai joué, l'autre non. L'écran de fin doit :
- dire clairement ce que j'ai fait ;
- montrer les pièges que j'ai posés à l'autre ;
- dire quand je saurai ;
- me donner tout de suite quelque chose à faire (« Nouvelle joute »).

Le résultat qui arrive plus tard est une récompense à ouvrir, comme un pli. Il ne doit pas s'afficher en une ligne dans une liste.

**4. Une cote seule ne fait pas une ligue.**
- Un Elo met la moitié des joueurs sous la moyenne pour toujours et peut descendre. À 30 jouteurs, le joueur moyen reste autour de 1 500 et n'a rien à viser.
- Les jeux qui retiennent séparent deux choses :
  - la **cote cachée**, qui choisit des adversaires de même force pour que chaque joute soit serrée ;
  - l'**échelle visible**, qui avance plus qu'elle ne recule, a des planchers qu'on ne perd pas et repart à chaque saison.
- C'est le modèle de Hearthstone (rangs, étoiles et planchers, saison mensuelle) et de Clash Royale (trophées, arènes et route des trophées). Elle récompense l'effort autant que le niveau, ce qui convient à un jeu où jouer fait apprendre.

**5. Les ligues hebdomadaires en groupes (Duolingo) ne marchent pas à notre taille.**
- Elles mettent 30 joueurs dans un groupe chaque semaine, et les premiers montent. C'est très social, mais il faut des dizaines de jouteurs par ligue.
- Avec 30 joueurs par jour, dont une partie seulement joute, il y aurait un seul groupe : un classement général hebdomadaire, sans ligue.
- Elles pourront venir plus tard, sur l'XP de la semaine, pour tout le jeu (progression-et-social.md, §4).

## La proposition, telle qu'on la jouerait

**La première visite (L1, L2).** Le joueur arrive aux joutes pour la première fois : Maître Furet l'accueille en plein écran. Quatre temps, chacun avec « Passer » :
1. **La lice.** Une image animée : ton deck à gauche, le sien à droite, 5 cartes de chaque côté. « Tu trouves ses mots, il trouve les tiens. »
2. **Ton deck.** L'éditeur s'ouvre avec 10 places vides et la jauge des 25 points. Le joueur pose ses cartes ; « Compléter pour moi » remplit les places vides. Maître Furet souligne la jauge, puis une carte rare : « Un mot rare piège mieux, mais coûte plus. »
3. **L'entraînement.** 3 mots contre Maître Furet, avec le vrai chrono, sans gain ni cote. Le fantôme y paraît : « Maître Furet en avait 2 à cette question. » La révélation du résultat se joue en entier.
4. **La première joute.** « Trouver un adversaire » s'allume. L'accueil guidé est fini.

Il se marque fait sur le compte, et vaut donc pour le web et le téléphone. Ensuite, un bouton « ? » en haut de l'accueil des joutes ouvre une bulle : la règle en quatre lignes courtes, avec « Revoir l'accueil guidé ».

**L'accueil des joutes.** Il ressemble à l'écran de combat de Clash Royale plutôt qu'à une page de règles. De haut en bas :
- l'emblème de sa ligue, ses lauriers, la barre vers la division suivante et le temps qui reste à la saison ;
- un gros bouton « Jouter » (classée) et, à côté, « Défier un ami » ;
- son deck en éventail, avec « Modifier » ;
- ses joutes par sections : « À toi de jouer » (qui bat doucement), « Résultats à découvrir » (pli scellé), « En attente », « Terminées ».

**Pendant la joute (L6).**
- Avant la première question, un face-à-face : deux avatars, deux pseudos, deux emblèmes de ligue, puis un compte à rebours 3, 2, 1.
- La définition arrive comme une carte retournée.
- Le chrono est un anneau qui se vide. Il rougit et fait tic les 5 dernières secondes.
- Une bonne réponse : le bouton s'illumine, un son, une vibration, un « +1 » qui vole au score.
- Une faute : une secousse, et le bon mot s'allume.
- Le fantôme devient deux rubans (toi et lui) qui avancent question après question, au lieu de la phrase actuelle.

**Sa partie jouée, l'autre pas encore (L4).** Un écran de bilan :
- ses 5 réponses en cartes qui se retournent une à une (juste ou faux, secondes) ;
- le score qui compte, et les XP qui remplissent la barre ;
- « Tes pièges » : les 5 mots de son deck que l'autre devra trouver ;
- l'avatar de l'adversaire avec un sablier : « Recette a jusqu'à demain 17 h 20. On te prévient au courrier. » ;
- en bas, « Nouvelle joute » en premier, puis « Retour aux joutes ».

**Le résultat (L5).** Tant qu'il n'est pas vu, la joute s'affiche comme un pli scellé « Résultat à découvrir ». À l'ouverture :
1. les deux avatars face à face ;
2. les questions révélées une à une sur deux colonnes, comme un tableau de tournoi, avec le score qui monte de chaque côté ;
3. la bannière Victoire, Défaite ou Égalité, avec fanfare, particules et vibration ;
4. les gains qui volent vers leur jauge (XP, sachet vers la réserve, lauriers vers la barre de la ligue) ;
5. « Ton mot *chafouin* l'a piégé. »

Elle se joue une fois ; ensuite, « Revoir ». En bas, « Revanche » et « Nouvelle joute ».

**Les ligues (L7 à L10).**

| Ligue | Divisions | Lauriers |
|---|---|---|
| Page | III, II, I | 0 à 299 |
| Écuyer | III, II, I | 300 à 599 |
| Chevalier | III, II, I | 600 à 899 |
| Banneret | III, II, I | 900 à 1 199 |
| Champion | une seule | 1 200 et plus |

- Une division vaut 100 lauriers. Seuils provisoires, à caler par une simulation, comme pour le clan ([clan-sim](../rnd/clan-sim.md)).
- **Le barème** (en joute classée seulement) :
  - une victoire rapporte 25 lauriers, de 15 à 35 selon la cote de l'adversaire (battre plus fort rapporte plus) ;
  - une défaite en retire 15 (de 5 à 25) ;
  - une égalité ne change rien ;
  - à la troisième victoire d'affilée et ensuite, les lauriers d'une victoire doublent.
- **Les planchers :** on ne descend jamais sous le plancher de la ligue atteinte dans la saison. Un Chevalier reste Chevalier ; il peut seulement redescendre de Chevalier I à Chevalier III.
- **Ce que donne ce barème :**
  - un joueur qui gagne une joute sur deux avance d'environ 5 lauriers par joute, plus ses séries ;
  - à 5 joutes classées par jour pendant 4 semaines, il atteint Chevalier ou Banneret ;
  - un joueur qui gagne 6 joutes sur 10 atteint Champion.
- **La saison des joutes** suit le calendrier de la saison (P96) et du carnet : 4 semaines, à partir du lundi 2026-11-09.
- **À la fin d'une saison :**
  - chacun touche la récompense de la ligue atteinte ;
  - il repart une ligue plus bas, au plancher de cette ligue. Un Banneret repart à 600, Écuyer et Page repartent à 0.
- La cote Glicko-2 ne change pas : elle choisit toujours l'adversaire, et ne se remet pas à zéro.

**Les récompenses (L9).** Toutes connues d'avance (P97).
- **Pendant la saison**, la première fois que le joueur atteint chaque division, ce qui donne au plus 13 récompenses, sur la route des lauriers montrée en entier :
  - une division atteinte : 20 écus ;
  - une ligue atteinte : un sachet garni.
- **À la fin de la saison**, selon la ligue atteinte :
  - Page : un sachet bonus ;
  - Écuyer : deux sachets bonus ;
  - Chevalier : un sachet garni ;
  - Banneret : un sachet garni Précieux ;
  - Champion : un sachet garni Précieux et l'emblème de Champion de la saison, porté sur le badge jusqu'à la suivante.

À vérifier dans le relevé de l'économie avant de trancher les chiffres.

**Les classements (L11).** Un écran « Classement » depuis l'accueil des joutes, avec trois onglets :
- **Ma ligue :** les jouteurs de sa ligue cette saison, par lauriers ;
- **Amis**, avec moi dedans ;
- **Clan.**

Chaque ligne porte l'avatar, le pseudo, l'emblème, les lauriers et la place. Le classement général (toutes ligues) s'ouvre au seuil de P51.

## Questions au propriétaire

**L1 · L'accueil guidé.**
- a. **(recommandé)** Les quatre temps décrits plus haut, avec Maître Furet, chacun avec « Passer », marqués faits sur le compte. Ensuite, la bulle « ? » avec « Revoir l'accueil guidé ». La règle quitte l'accueil des joutes.
- b. Trois planches illustrées à faire défiler la première fois, sans entraînement, puis la bulle « ? ».
- c. La bulle « ? » seulement, ouverte d'elle-même à la première visite.

**L2 · Le premier deck.**
- a. **(recommandé)** Le joueur le compose dans l'accueil guidé : 10 places vides, la jauge, et « Compléter pour moi » qui remplit les places vides avec les cartes les plus rares qui tiennent. Pas de joute sans deck enregistré. Le deck d'office ne sert plus qu'à remplacer des cartes parties (échange, recyclage). Pour les testeurs qui ont déjà jouté, le deck joué devient leur deck enregistré.
- b. Le jeu le compose d'office, comme aujourd'hui. L'accueil guidé le montre carte par carte et dit comment le changer.
- c. Le joueur choisit chaque carte, sans bouton pour compléter.

**L3 · Le bouton « Jouter ».**
- a. **(recommandé)** Un gros bouton « Jouter » pour la joute classée, et « Défier un ami » à côté, plus petit. La joute classée est le geste du quotidien ; l'amicale demande de choisir quelqu'un.
- b. Deux boutons de même taille, comme aujourd'hui.

**L4 · L'écran de fin de sa partie.**
- a. **(recommandé)** Le bilan animé décrit plus haut : réponses qui se retournent, score, XP, « Tes pièges », le sablier de l'adversaire et « Nouvelle joute » en premier.
- b. Le même contenu, sans animation.

**L5 · La révélation du résultat.**
- a. **(recommandé)** Le pli scellé dans la liste, puis la révélation question par question, la bannière et les gains qui volent. Elle se joue une fois, puis « Revoir ».
- b. Le même contenu d'un coup, avec une seule animation courte (bannière et gains).
- c. La bannière et les gains seulement.

**L6 · La sensation pendant la joute.**
- a. **(recommandé)** Tout ce qui est décrit plus haut : face-à-face et 3, 2, 1, carte retournée, anneau du chrono, éclats et sons, les deux rubans du fantôme.
- b. Sons, vibrations et couleurs sur l'écran actuel, sans nouvel élément.

**L7 · La forme des ligues.**
- a. **(recommandé)** Une échelle de lauriers en cinq ligues de trois divisions, avec planchers et saison de 4 semaines (Hearthstone, Clash Royale). Les lauriers mesurent l'effort autant que le niveau ; la cote cachée garde des joutes serrées.
- b. Des ligues hebdomadaires en groupes de 30, à la Duolingo : on monte avec les victoires de la semaine. Il faut des dizaines de jouteurs par ligue ; pendant la bêta, il n'y aurait qu'un groupe.
- c. Le rang suit la cote seule, comme aux échecs (P51 tel quel) : le niveau pur, mais la moitié des joueurs sous 1 500 pour toujours, et une cote qui peut descendre.

**L8 · La cote à l'écran.**
- a. **(recommandé)** Les lauriers partout. La cote se lit seulement dans le détail de ses statistiques de joute, après 5 joutes classées, pour les curieux.
- b. La cote à côté des lauriers sur l'accueil des joutes et dans les classements.
- c. La cote jamais montrée.

**L9 · Les récompenses de ligue.**
- a. **(recommandé)** Une récompense à chaque première division atteinte dans la saison, et une à la fin de la saison selon la ligue, comme plus haut. Les chiffres sont à vérifier sur l'économie.
- b. La récompense de fin de saison seulement.
- c. Aucune récompense : l'emblème de la ligue seulement.

**L10 · La saison des joutes.**
- a. **(recommandé)** Le calendrier de la saison et du carnet (4 semaines à partir du lundi 2026-11-09). À la fin, on repart une ligue plus bas.
- b. Un mois calendaire, avec la même remise à zéro.
- c. Pas de saison : les lauriers restent, et la seule récompense est la première fois qu'on atteint une division.

**L11 · Les classements.**
- a. **(recommandé)** Ma ligue, Amis et Clan dès l'ouverture des ligues. Le général au seuil de P51 (50 joueurs avec 5 joutes classées dans les 30 derniers jours).
- b. Le général dès l'ouverture, en plus d'Amis et Clan.
- c. Amis et Clan seulement.

## Ce qu'on évite

- **La règle en permanence à l'écran** : une fois l'accueil guidé passé, elle vit dans la bulle « ? » (voix.md, « Moins de phrases sur les écrans de jeu »).
- **Un accueil guidé qui retient le joueur** : chaque temps se passe, et rien n'y est obligatoire, sauf d'avoir un deck pour jouer.
- **Perdre une ligue en cours de saison** : les planchers l'empêchent. Une défaite fait reculer de quelques lauriers, jamais sortir d'une ligue.
- **Payer pour monter** : aucun laurier ne s'achète. Les récompenses sont connues d'avance et gratuites (P97).
- **Faire monter un ami** : seules les joutes classées comptent, une par paire et par 24 h, comme pour la cote.
- **Des animations qui font attendre** : chacune se passe d'un toucher, et la révélation se joue une seule fois.

## Ce qui change dans les règles, une fois tranché

- **P91 :** le premier deck est composé par le joueur (L2), avec l'accueil guidé (L1).
- **P51 :** l'échelle de lauriers et ses ligues (L7, L8), les classements (L11).
- **Une nouvelle règle pour les ligues :** barème, planchers, saison et récompenses (L9, L10). Elle renvoie à P96 pour le calendrier.

## Ce qui change dans le code, en bref

- **`packages/core` :**
  - barème des lauriers, divisions et planchers, remise de fin de saison, récompenses ;
  - tout est daté dans `rules.ts` et testé.
- **`packages/db`, migrations additives :**
  - l'accueil guidé fait, sur le joueur ;
  - le résultat vu, pour chacun des deux joueurs d'une joute ;
  - les lauriers de la saison, la meilleure division atteinte et les récompenses réclamées.
- **`apps/api` :**
  - les lauriers s'écrivent à la fin d'une joute classée, dans la même transaction que la cote, avec les deux lignes verrouillées dans un ordre fixe ;
  - les récompenses de ligue se réclament comme les coffrets ;
  - la fin de saison se calcule à la lecture, sans tâche planifiée ;
  - les classements sont paginés par curseur ;
  - un test d'intégration avec deux fins de joute simultanées.
- **`packages/view-model` :** textes et états des quatre scènes, de l'accueil guidé et des classements.
- **Web et mobile ensemble :**
  - l'accueil guidé, l'accueil des joutes, la joute, le bilan, la révélation, les classements ;
  - sons et vibrations là où ils existent déjà (sachet, défis), particules Skia sur le téléphone.
- **Avant le code :**
  - une planche web et mobile des quatre scènes et de l'accueil des joutes, à valider (DA « jeu vidéo », relief et mouvement) ;
  - une simulation des lauriers pour caler les seuils.

## Découpage une fois validé

| Lot | Contenu | Pourquoi d'abord |
|---|---|---|
| 2 | Accueil guidé, premier deck, bulle « ? », accueil des joutes refait, face-à-face, joute, bilan et révélation (L1 à L6) | C'est ce qui manque pour que les testeurs comprennent et aiment jouter ; rien ne dépend des ligues |
| 3 | Lauriers, ligues, saison des joutes, récompenses, classements (L7 à L11), après la simulation | Le système entier, une fois les seuils calés |
| 4 | Compteur de pièges et liste de souhaits (reste du lot 1), succès de joute | Ce qui donne une histoire à chaque carte du deck |

## Risques

| Risque | Parade |
|---|---|
| Les animations ralentissent le jeu sur un vieux téléphone | Animations par transformation et opacité seulement, particules Skia déjà essayées ; chaque animation se passe d'un toucher |
| Les seuils sont faux à 30 jouteurs (tout le monde Page, ou tout le monde Champion) | Simulation avant le lot 3, puis seuils corrigés en place tant que la bêta est fermée |
| L'accueil guidé lasse les testeurs déjà venus | « Passer » à chaque temps ; les testeurs qui ont déjà jouté le voient une fois, avec leur deck déjà en place |
| Le classement de sa ligue est vide en début de saison | On y montre toujours au moins le joueur et ses amis de la même ligue ; l'écran dit quand la saison a commencé |
