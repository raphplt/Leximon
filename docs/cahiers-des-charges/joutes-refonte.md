# Cahier des charges · La refonte des joutes (écran et parcours)

- **Statut :** proposé et tranché le 2026-11-08 ; départ au face-à-face inscrit en P91 ; pas encore dans le code.
- **Choix du propriétaire, le 2026-11-08 :** toutes les recommandations, J1 à J9 : une page qui défile, le chemin des ligues toujours visible, recherche d'adversaire puis face-à-face avec « Commencer » et le chrono au premier mot, joute non commencée perdue au bout de 24 h, voisins du tournoi sur l'accueil, partie sur le tapis vert des défis, blasons en SVG et gravures anciennes du domaine public, « comment ça marche » replié après 3 joutes, planches animées d'abord.
- **Source :** le retour vocal du propriétaire du 2026-11-08 sur `/joutes` et sur une joute classée : l'ensemble est en dessous du reste du site, trop basique, pas assez dans la direction artistique, mal organisé une fois l'accueil guidé fini, et une joute classée démarre sans prévenir.
- **Inspirations données :** Clash of Clans et Duolingo, pour les ligues, leur affichage et le passage d'une ligue à l'autre.
- **Règles liées :** P51 (classements), P91 (joutes), P98 (ligues et tournoi de la semaine), P99 (bannières) ([regles-du-jeu.md](../regles-du-jeu.md)).
- **Cahiers liés :** [joutes.md](joutes.md), [joutes-ligues.md](joutes-ligues.md), [direction-artistique.md](direction-artistique.md).

Ce cahier ne change aucune règle du jeu : ni les ligues, ni les points, ni les récompenses. Il change ce qu'on voit, l'ordre des écrans et un seul point technique, le départ du chrono (J3).

## Ma recommandation en une phrase

On fait des joutes une arène : un haut de page qui montre sa ligue comme un trophée, le chemin des sept ligues toujours visible, le tournoi de la semaine lu comme chez Duolingo (zones de montée et de descente), une recherche d'adversaire puis un face-à-face avant que le chrono parte, et une partie jouée sur le tapis vert, comme les défis. Le tout est d'abord montré en planches animées, puis construit sur le web et le mobile ensemble.

## Ce qui ne va pas aujourd'hui

**1. La page ne raconte pas le jeu.** Une fois l'accueil guidé fini, rien ne dit comment une joute se gagne, à quoi servent les points, ni où mènent les ligues. La règle est cachée dans la bulle « ? ».

**2. La ligue n'a pas d'allure.** « Page » est un petit écusson dans un encart gris, avec une ligne de texte. On ne voit ni les autres ligues, ni la suivante, ni ce qu'il faut pour y monter. Dans Clash of Clans, la ligue est un insigne qu'on a envie de changer ; chez Duolingo, la rangée des ligues est toujours en haut du classement, la sienne éclairée.

**3. Le tournoi est une phrase.** « 30e sur 30 · 0 point » et « Si le tournoi finissait maintenant, tu resterais en Page ». Il manque les voisins, les zones et le temps qui reste, montrés plutôt qu'écrits.

**4. Une joute classée part sans prévenir.** Un clic, et la première définition est déjà là, le chrono en marche, contre un adversaire qu'on n'a pas vu arriver. Il n'y a ni recherche d'adversaire, ni face-à-face, ni « Prêt ? ».

**5. La partie elle-même est vide.** La carte et les quatre mots flottent au milieu d'une grande feuille, avec un vide au-dessus et au-dessous. « Retour aux joutes » est un lien souligné en haut de l'écran. Le tableau des scores est fin et plat.

**6. Le deck a deux défauts.** La pastille des doublons sous les cartes est mal placée (le chiffre est coupé), et « Modifier » ouvre un panneau sur le côté au lieu d'une vraie fenêtre.

**7. Les listes sont des formulaires.** « Résultats à découvrir », « En attente », « Terminées » sont des lignes identiques, avec un pictogramme d'enveloppe. Un résultat à découvrir n'a rien d'un pli scellé qu'on a envie d'ouvrir.

## La proposition, telle qu'on la jouerait

### L'accueil des joutes (`/joutes`)

De haut en bas, sur le web comme sur le mobile :

**1. La lice (le haut de page).** À gauche, l'insigne de sa ligue en grand, gravé et en relief, son nom sur un ruban. À droite, le tournoi de la semaine en trois pièces qui se lisent d'un coup d'œil :
- sa place et ses points (« 12e · 9 points ») ;
- son état, en couleur : **montée** en vert, **maintien** en papier, **descente** en rouge ;
- le temps qui reste (« Fin dans 2 jours », puis « ce soir à minuit »).

Dessous, les joutes classées du jour sous forme de 5 lances : une lance pleine par joute classée qui reste. Puis les trois boutons : **Joute classée** (le gros bouton d'or), **Joute libre**, **Défier un ami**.

**2. Le chemin des ligues.** Une rangée des sept insignes, de Page à Champion, toujours visible sous la lice. Les ligues passées sont éclairées, la sienne est levée et entourée, les suivantes sont grisées. Sous chacune, ce qu'elle donne chaque semaine (« 10 écus », « 15 écus »…). Un toucher sur la rangée ouvre la fenêtre **Les ligues** : pour chacune, combien montent et descendent chaque semaine, ses récompenses, et le motif de bannière qu'elle donne (Chevalier, Maréchal, Champion).

**3. Mon tournoi, en bref.** Chez Duolingo, on voit tout de suite qui est juste devant et juste derrière. Ici : les 3 jouteurs au-dessus de soi, soi, les 3 au-dessous, avec la ligne verte de la zone de montée et la ligne rouge de la zone de descente là où elles tombent. Un lien mène au classement complet.

**4. Comment ça marche.** Trois étapes illustrées sur une bande : « Lance une joute », « Trouve 5 mots en 15 secondes chacun », « Gagne des points pour monter de ligue ». La bande se replie d'elle-même après les 3 premières joutes classées, et la bulle « ? » la rouvre.

**5. Tes joutes.** Les résultats à découvrir deviennent des **plis scellés** : une lettre fermée d'un cachet de cire, avec le portrait de l'adversaire, qui s'ouvre d'un geste (la révélation existe déjà). Les joutes en attente montrent le sablier et l'heure limite. Les joutes terminées tiennent sur une ligne avec le score et une pastille Victoire ou Défaite.

**6. Ton deck.** L'éventail actuel, avec la pastille des doublons corrigée. « Modifier » ouvre une grande fenêtre au milieu de l'écran (sur le téléphone, un écran plein) : l'éventail en haut, la jauge des points, puis les cartes qu'on peut jouer, avec des filtres par rareté.

### Lancer une joute classée

**1. La recherche d'adversaire.** Pendant que le serveur choisit l'adversaire, un écran de recherche fait défiler les portraits derrière une fente, environ deux secondes, puis s'arrête sur celui de l'adversaire.

**2. Le face-à-face.** Les deux jouteurs se font face, chacun avec son portrait, son pseudo, son insigne de ligue et le dos de ses 5 cartes. Au milieu, un **VS** gravé. En bas, le gros bouton **Commencer**, et dessous « Le chrono démarre quand tu commences ».

**3. Le compte à rebours.** 3, 2, 1, puis la première définition.

Le face-à-face sert de confirmation : rien ne part sans le clic sur « Commencer ».

### La partie

**Sur le tapis vert, comme les défis.** La partie se joue sur le même bureau vert, au cadre d'or, que les séries de défis, pour que tout ce qui se joue se ressemble. En haut, un vrai tableau des scores : les deux portraits face à face, les 5 cases de chacun, le chrono en anneau au milieu, plus gros. Dessous, la carte et les quatre mots, serrés au milieu de l'écran, sans grand vide. La croix ronde en haut à gauche remplace le lien « Retour aux joutes » (avec la fenêtre « Quitter la joute ? », déjà en place).

### Le classement (`/joutes/classement`)

La rangée des sept insignes en haut, la sienne éclairée, puis le groupe de 30 comme chez Duolingo : les zones de montée et de descente en couleur, une ligne qui les sépare, sa propre ligne mise en avant et toujours visible.

### La direction artistique

Plus de gravures et de relief :
- **les insignes de ligue** deviennent des blasons dessinés, un par ligue, de plus en plus riches (cuir, bronze, argent, or, couronne), gravés et en relief, animés quand on monte ;
- **une gravure de tournoi** (deux chevaliers à la lance) pour le haut de page et la recherche d'adversaire ;
- **une montée de ligue** a sa scène, comme un passage de niveau : l'ancien insigne se brise, le nouveau tombe, des particules d'or.

## Questions au propriétaire

Chaque question a une recommandation, en premier.

**J1 · L'organisation de l'accueil.**
- a. **(recommandé)** Une seule page qui défile, dans l'ordre ci-dessus : lice, chemin des ligues, mon tournoi en bref, comment ça marche, tes joutes, ton deck.
- b. Des onglets en haut (Lice, Ligue, Deck), comme dans Clash of Clans : moins de défilement, mais une chose cachée par onglet.
- c. Garder l'ordre actuel et seulement embellir.

**J2 · Le chemin des ligues.**
- a. **(recommandé)** Toujours visible sous la lice, avec une fenêtre de détail au toucher.
- b. Seulement dans une fenêtre, ouverte par un bouton « Les ligues ».
- c. Seulement en haut du classement, comme chez Duolingo.

**J3 · Le départ d'une joute classée.**
- a. **(recommandé)** Recherche d'adversaire, puis face-à-face avec un bouton « Commencer » ; le chrono de la partie part au premier mot, et non plus à la création de la joute. Changement côté serveur : aujourd'hui, la partie de celui qui lance compte ses 5 minutes depuis la création de la joute ; elle les compterait depuis son premier mot, comme déjà pour celui qui répond.
- b. Une simple fenêtre « Lancer une joute classée ? Il t'en reste 2 aujourd'hui » avant d'appeler le serveur, puis la partie démarre comme aujourd'hui.
- c. Recherche d'adversaire et face-à-face, mais avec un compte à rebours automatique de 5 secondes au lieu du bouton (pas de changement côté serveur).

**J4 · Celui qui ne clique pas sur « Commencer ».** Utile seulement avec J3 a.
- a. **(recommandé)** La joute reste dans « À jouer » pendant 24 h ; passé ce délai, elle compte comme une défaite pour lui, comme pour celui qui ne répond pas.
- b. Elle est annulée sans effet au bout de 10 minutes, et la joute classée du jour lui est rendue.

**J5 · Le tournoi sur l'accueil.**
- a. **(recommandé)** Sa place, son état (montée, maintien, descente) et le temps qui reste dans la lice, plus les 3 voisins de chaque côté avec les lignes de zone.
- b. Seulement la place et l'état dans la lice ; le reste dans le classement.

**J6 · Où se joue la partie.**
- a. **(recommandé)** Sur le tapis vert au cadre d'or des défis, avec un tableau des scores plus grand.
- b. Sur une scène de lice à part (tenture rayée, bois), propre aux joutes.
- c. Sur la feuille de papier actuelle, mieux composée.

**J7 · D'où viennent les gravures.**
- a. **(recommandé)** Blasons de ligue dessinés par nous en SVG (nets à toutes les tailles, animables), et une ou deux gravures anciennes du domaine public (tournoi, chevaliers) pour la lice et la recherche d'adversaire, sources notées dans le fichier des ornements.
- b. Tout en SVG dessiné par nous, sans gravure ancienne.
- c. Des gravures générées dans le style des cartes (coût de génération à prévoir).

**J8 · « Comment ça marche ».**
- a. **(recommandé)** Une bande de 3 étapes illustrées sur l'accueil, repliée d'elle-même après 3 joutes classées, rouverte par la bulle « ? ».
- b. Toujours visible.
- c. Seulement dans la bulle « ? », comme aujourd'hui.

**J9 · Planches d'abord.**
- a. **(recommandé)** Une planche animée (`/planches/joutes`) de l'accueil, du chemin des ligues, de la recherche d'adversaire, du face-à-face et de la partie, à valider avant de toucher aux vrais écrans.
- b. Construire directement les vrais écrans et ajuster ensuite.

Ne sont pas des questions : la fenêtre du deck au milieu de l'écran (demandée), la pastille des doublons (un défaut), la croix ronde à la place du lien (comme les défis), le web et le mobile ensemble.

## Ce qu'on évite

- Un deuxième système de points ou de trophées à la Clash of Clans : les ligues et le tournoi de P98 suffisent, on les montre mieux.
- Un faux matchmaking long : la recherche dure le temps de la réponse du serveur, deux secondes au plus de mise en scène.
- Cacher la règle : ce qui fait monter ou descendre se lit sur l'accueil, en chiffres.

## Découpage une fois validé

1. **Planches** (si J9 a) : accueil, chemin des ligues, recherche et face-à-face, partie, montée de ligue.
2. **Lot 1, l'accueil** : lice, chemin des ligues et sa fenêtre, mon tournoi en bref, comment ça marche, plis scellés, deck (pastille et fenêtre).
3. **Lot 2, le départ** : recherche d'adversaire, face-à-face, départ du chrono au premier mot (serveur, avec son test d'intégration).
4. **Lot 3, la partie et le classement** : tapis vert, tableau des scores, classement à la Duolingo, scène de montée de ligue.

Chaque lot fait le web et le mobile ensemble. Les joutes restent hors ligne jusqu'à la fin (décision du 2026-11-07).

## Risques

- **Le départ du chrono (J3 a)** touche le calcul des parties côté serveur : il faut garder les joutes déjà lancées telles quelles (leur chrono part de leur création) et tester les requêtes concurrentes.
- **Les gravures anciennes** demandent une source autorisée par gravure, comme pour les cartes.
- **La taille du chantier** : trois lots et des planches, plusieurs jours de travail ; le lancement du 2026-11-09 ne l'attend pas, puisque les joutes ne sont pas encore en ligne.
