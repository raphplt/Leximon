# Retours des joueurs de la bêta

Ce que les joueurs de la bêta fermée ont dit du jeu, surtout sur Reddit (r/jeuxvideo, r/FrenchTech) à partir du 2026-10-27 et par le formulaire de retour du jeu, et ce qu'on en fait. Les retours du game designer ont leur propre [cahier](cahiers-des-charges/retours-game-designer.md). Un retour qui devient une règle passe dans [regles-du-jeu.md](regles-du-jeu.md) ; ici, il ne reste que la trace et le statut.

## Bugs

| Retour | Qui | Statut |
|---|---|---|
| Le coffret ne s'ouvre pas, l'écran fonce et rien ne s'affiche. Même chose pour le pseudo et la fiche de carte, réduite à une bande | Barkyi, AnyNail5297 (Mac, probablement Safari) | Corrigé le 2026-10-31 (`92a7a8e`) : sur Safari 16, les fenêtres dont la hauteur suit le contenu tombaient à 0 px. Prévenir les deux joueurs une fois en ligne |
| Sur les Épiques et les Légendaires, le bas des lettres du mot est coupé (le g de *cominge*, le p de *prêtrot*) | Formulaire, 2026-11-04 | Corrigé le 2026-11-08 (`e45c4a9`, web et mobile) : le dégradé doré ou irisé ne peignait que la boîte du mot. Prévenir le joueur une fois en ligne |
| Le code de vérification arrive dans les indésirables (Yahoo) | Formulaire, 2026-10-28 | Les codes partent signés (DKIM, SPF, DMARC `p=reject` sur `mail.leximon.fr`). Restent : le DMARC du domaine principal et d'`infos.leximon.fr`, absents (voir [mise-en-ligne.md](mise-en-ligne.md)), et une phrase sous le champ du code qui dit de regarder dans les indésirables |
| À l'ouverture d'un sachet, les Rares se retournent seules, alors qu'il faut toucher les autres (Firefox sur téléphone) | Formulaire, 2026-10-28 | Voulu (P45) : la Rare se retourne seule après son annonce, le joueur retourne lui-même les Précieuses et au-dessus. À revoir si d'autres le prennent pour un bug |

## Rythme et progression

| Retour | Qui | Ce qu'on en fait |
|---|---|---|
| Au bout de 20 minutes, plus rien à faire : il faut attendre 30 minutes par sachet. Trouver d'autres moyens d'obtenir des cartes | AnyNail5297 | Avis opposé au suivant. À trancher avec la phase économie du [cahier du game designer](cahiers-des-charges/retours-game-designer.md) ; les modes de révision et l'énigme du jour donnent déjà quoi faire |
| Ne pas noyer le joueur sous les sachets : les mots demandent du temps pour être digérés | llucas_mk | Garder en tête contre la demande précédente |
| À quoi sert un clan, puisqu'on échange sans en faire partie ? | AnyNail5297 | L'écran fermé du clan ne dit pas ce qu'il apporte (objectif de la semaine, sachets bonus, discussion, niveau de clan). À dire en clair. Rappel : rejoindre un clan au niveau 5 (P50) n'est pas encore dans le code, qui exige toujours 10 |

## Cartes et rareté

| Retour | Qui | Ce qu'on en fait |
|---|---|---|
| « Dauber » et « prendre une mornifle » ne sont ni rares ni anciens | Tryphon_Al_West (prof de français) | Juste au sens de P21 : *dauber* est Courant, *mornifle* Peu courant. Le joueur lit « rareté » comme « mot rare ». Dire sur la fiche ce que veut dire chaque rareté (Courant : encore compris de beaucoup) |
| Si un mot redevient à la mode, sa Légendaire devrait devenir Courante | SoftwareCurious6798 | Non : la rareté est figée (P24). Une boutade, mais l'idée d'une rareté vivante revient sans doute |
| Numéro de la carte dans sa collection (11/130), symbole de collection, dos et cadres plus travaillés | lugdu69 | Le symbole existe (P74), les dos sont prévus (P58). Le numéro dans la collection n'existe pas : à étudier avec la refonte |
| Collections d'argot (dictionnaire de Pierre Merle) et argots régionaux (lyonnais, lorrain, vendéen) ; collections thématiques pour mieux retenir | lugdu69 | Les parlers régionaux sont prévus (P39, P56). L'argot dépend des sources autorisées |
| Les Québécois seront forts à ce jeu | Anatharias | Idée de mots québécois à vérifier dans les sources |
| Les textes et le site « font IA » | 3 commentaires sur 5 de r/jeuxvideo, Throwing-up-fire | Réécriture des textes à la main, refonte « La Bibliothèque » (D-056) |
| Les citations tirées de livres sont un vrai plus | llucas_mk et d'autres | Mettre une citation sur un maximum de cartes |

## Défis et modes de jeu

| Idée | Qui | Ce qu'on en fait |
|---|---|---|
| Citation à trous où l'on tape le mot, ou la citation donnée en indice | Tryphon_Al_West, un joueur de r/FrenchTech | La citation à trous est prévue en QCM ([cahier](cahiers-des-charges/revisions-et-modes-de-jeu.md), lot 3). Variante à garder : le mot tapé, pour faire monter de niveau |
| Deux cartes, deviner laquelle est la plus fréquente, et tenir le plus longtemps | llucas_mk | Nouveau mode, à proposer avec les modes de jeu. La fréquence est déjà sur chaque carte |
| Concours de phrases avec un mot de son deck, mises au vote 24 h | Tryphon_Al_West | Texte écrit par les joueurs, donc filtré et modéré : lourd, pas avant les modes simples |
| Pondérer les défis par collection | lugdu69 | À voir avec les révisions par portée (P81) |
| Dans l'album, passer d'une carte à la suivante avec les flèches du clavier, et des boutons pour défiler | Formulaire, 2026-10-31 | Fait le 2026-11-03 (`ac5ab30`) : flèches à l'écran et touches ← et → dans la fiche agrandie |
| Dans les QCM, des mauvais choix de la même nature que le mot (verbe, nom…), sinon on trouve par élimination | Formulaire, 2026-10-31 | Fait le 2026-11-08 : même nature partout, joutes comprises (P32, P91) |
| En révisant un thème (religion), des mauvais choix du même thème | Formulaire, 2026-10-31 | Fait le 2026-11-08 : le thème révisé d'abord, puis la collection (P81) |

## Son

| Retour | Qui | Ce qu'on en fait |
|---|---|---|
| La voix qui dit les mots est désagréable | AnyNail5297 | Voix de synthèse unique (P57, D-032). Coupable dans les réglages ; à réécouter, et à suivre si d'autres le disent |
| Une musique d'ambiance sur l'écran d'accueil du jeu | AnyNail5297 | Pas prévue. À voir avec la refonte |

## Hors du jeu

| Idée | Qui | Ce qu'on en fait |
|---|---|---|
| Une version papier | petitponeyrose | Les decks imprimés sont permis à la vente (N2). Pas avant longtemps |
| Des paquets pour la classe (verbes irréguliers, capitales…) | Diwydiant (prof d'anglais) | Pas de version école (arbitré le 2026-10-20) |
