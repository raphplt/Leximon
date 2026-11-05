# Cahier des charges · Les joutes

- **Statut :** proposé le 2026-11-05. Toutes les recommandations retenues par le propriétaire le même jour (J1 à J19 : a), inscrites en P51, P52, P59, P77, P80, P87 et P91. Lot 1 construit le 2026-11-05, web et mobile, ouvert aux testeurs choisis dans l'admin ; liste de souhaits et compteur de pièges reportés.
- **Source :** demande du propriétaire du 2026-11-05 : un 1 contre 1, plutôt en direct (ou en asynchrone avec un temps limité, car l'asynchrone seul lui semble trop simple), chaque joueur se compose un deck avec ses cartes et affronte le deck d'en face, par exemple en devinant les mots de l'adversaire, avec un classement Elo. Environ 30 joueurs par jour pendant la bêta, des centaines voire des milliers visés.
- **Règles liées :** P51 (classements), P52 (modes entre joueurs, sans mise), P59 (niveau 8), P77 (souhaits), P84 (écus), P87 (tampons), P91 (duel), P92 (taux de réussite), N1 ([regles-du-jeu.md](../regles-du-jeu.md)).
- **Cahiers liés :** [retours-game-designer.md](retours-game-designer.md) (phase 7 et l'annexe sur la concurrence), [progression-et-social.md](progression-et-social.md) (§4 classements, §5 modes de jeu), [revisions-et-modes-de-jeu.md](revisions-et-modes-de-jeu.md) (la joute asynchrone sur 5 mots, déjà esquissée).
- **Décision liée :** D-007 (temps réel), D-053 (la base sur le serveur maison).

## Ma recommandation en une phrase

Une joute **asynchrone, mais chronométrée** : chacun pose à l'autre 5 mots tirés de son deck, répond aux 5 mots de l'autre en 15 secondes chacun, et le second joueur court contre la partie enregistrée du premier. Une cote Glicko-2 dès la première joute, montrée en classement entre amis et dans le clan d'abord, en classement général quand il y aura assez de jouteurs. Le direct vient plus tard, entre amis, et c'est seulement lui qui a besoin de la R&D D-007.

## L'avis du game designer

**1. Le direct est le bon rêve, pas la bonne première version.** Un duel en direct ne vit que s'il y a quelqu'un en face *au même moment*. À 30 joueurs par jour, il n'y a en moyenne même pas un joueur connecté à un instant donné (calcul plus bas) : P91 tel qu'il est écrit donnerait un fantôme dans plus de 95 % des parties. On aurait construit du temps réel pour jouer presque toujours contre un enregistrement. HQ Trivia est mort de ce problème, alors que Trivia Crack et Quizduell (le quiz en duel le plus joué d'Allemagne, qui a eu son émission sur l'ARD) ont tenu en asynchrone.

**2. L'asynchrone n'est trop simple que s'il est sans chrono.** Ce qui rend Quizduell tendu, c'est que chaque question se joue en direct, en quelques secondes, même si l'adversaire jouera la sienne demain. Le chrono par question rend aussi la recherche des réponses peu payante, alors que le catalogue est public. Et le second joueur voit le score du premier se construire question après question : la tension du direct, sans le direct.

**3. Le deck est la meilleure idée du brief.** C'est la seule chose qui fasse de la joute un jeu de *cartes* et pas un quiz de plus. Il donne une décision au joueur (quels mots vont piéger l'autre ?), une identité (mon deck, c'est ma signature), et il relie la joute à la collection : plus on a de cartes rares, plus on a de pièges. Il faut seulement l'équilibrer, sinon le joueur de trois mois écrase celui de trois jours avec ses Légendaires.

**4. Le plaisir le plus fort sera celui du piège.** « Ton mot *cacochyme* a piégé Alix » : c'est le moment qu'on partage. On le met en scène à la fin, et chaque carte garde le compte des adversaires qu'elle a piégés.

**5. Le classement, oui, mais à la bonne échelle.** Un classement général à 30 joueurs montre surtout qui joue le plus, et met les nouveaux en bas d'une liste courte. Le classement entre amis et dans le clan marche dès deux joueurs. Le général s'ouvre au seuil où il veut dire quelque chose.

**6. À 30 joueurs par jour, les joutes entre amis comptent plus que les joutes au hasard.** Et un défi par lien, ouvert à qui n'a pas encore de compte (« Trouveras-tu mes 5 mots ? »), est sans doute le meilleur outil d'acquisition du jeu, comme le partage de l'énigme. Je le mets dans les lots, pas dans la première version.

**7. Une réserve sur l'ordre.** La phase 7 vient après l'économie et le social dans le plan du 2026-11-01, et l'ouverture publique attend une rétention de 35 % à J1 et 12 % à J7. Les joutes s'ouvrent au niveau 8, vers le 3e jour : elles servent J7, pas J1. Si la rétention à J1 reste basse, ce n'est pas elles qui la feront monter.

## Le chiffre qui décide : combien de joueurs au même moment

Hypothèses : chaque joueur lance 2 joutes par jour, 60 % du trafic tombe entre 18 h et minuit, et on attend un adversaire 20 secondes (P91). Le tableau donne la chance de trouver un vrai adversaire en direct, sans même tenir compte de l'écart de niveau, qui la réduit encore.

| Joueurs par jour | Joutes lancées par minute, le soir | Chance d'avoir un adversaire en 20 s |
|---|---|---|
| 30 | 0,1 | 3 % |
| 300 | 1 | 28 % |
| 1 000 | 3,3 | 67 % |
| 5 000 | 17 | plus de 99 % |

Le direct au hasard ne devient fiable qu'à plusieurs milliers de joueurs par jour. En asynchrone, l'adversaire n'a pas besoin d'être là : il suffit qu'il soit passé dans la journée.

## La proposition, telle qu'on la jouerait

**Le deck.** Chaque joueur garde un deck de 10 cartes, prises parmi ses mots trouvés au moins une fois (Esquisse ou mieux). Chaque rareté coûte des points, 25 au plus pour le deck. Le jeu en compose un d'office, que le joueur change quand il veut.

**Lancer une joute.** Le joueur choisit « Défier un ami » (amicale) ou « Trouver un adversaire » (classée, adversaire choisi par le jeu près de sa cote). Le serveur tire 5 cartes du deck de chacun et les fige.

**Le premier joueur** répond tout de suite aux 5 mots de l'adversaire : la définition s'affiche, il choisit le mot parmi 4, en 15 secondes. Il voit à chaque fois s'il a juste, sans savoir encore comment l'autre fera.

**Le second joueur** reçoit une lettre : « Alix t'a lancé une joute. Tu as jusqu'à demain 18 h 40 pour jouer. » Il répond aux 5 mots d'Alix avec le même chrono. Une barre suit le score d'Alix au même moment de sa partie : « À la 3e question, Alix en avait 2. »

**La fin.** Les deux joueurs voient les 10 mots en cartes : qui a trouvé quoi, en combien de temps, et quels mots ont piégé l'autre. Les mots qu'on n'a pas vont dans la liste de souhaits (P77). « Proposer une revanche » relance une joute dans l'autre sens.

## Questions au propriétaire

Chaque question a une recommandation, en premier.

**J1 · Direct ou asynchrone.**
- a. **(recommandé)** Asynchrone avec un chrono par question : le premier joue tout de suite, le second dans les 24 h, contre la partie enregistrée du premier. Le direct entre amis connectés vient en lot 3.
- b. Direct, avec un fantôme au bout de 20 secondes sans adversaire (P91 tel quel). Presque toutes les parties se jouent contre un fantôme tant qu'on est sous le millier de joueurs par jour.
- c. Direct à heure fixe, une ou deux fois par jour (l'apéro de 18 h), comme HQ Trivia. Fort pour un streamer, fragile le reste du temps.

**J2 · Qui répond à quoi.**
- a. **(recommandé)** Chacun pose ses mots : je réponds aux 5 mots de ton deck, tu réponds aux 5 du mien. Toutes les questions comptent, et le piège devient le cœur du jeu.
- b. Pot commun : les deux decks se mélangent et chacun répond aux 10 mots. Les mêmes questions pour les deux, mais la moitié porte sur ses propres mots, qu'on connaît déjà : 10 questions dont 5 sans enjeu.
- c. Pas de deck : 10 mots tirés dans les collections des deux joueurs. Plus simple, mais la joute n'a plus rien d'un jeu de cartes.

**J3 · La taille du deck.**
- a. **(recommandé)** 10 cartes, dont 5 tirées au hasard à chaque joute. On ne rejoue pas toujours les mêmes, et l'adversaire qui a vu mon deck une fois ne le connaît pas par cœur.
- b. 5 cartes, toutes posées à chaque joute. Plus de contrôle, mais un adversaire qui me retrouve connaît déjà mes réponses.
- c. 3 cartes, comme WikiMasters. Une joute très courte, peu de place pour la stratégie.

**J4 · L'équilibre du deck.**
- a. **(recommandé)** Des points par rareté : Courant 1, Peu courant 2, Rare 3, Précieux 4, Épique 5, Légendaire 6, et 25 points au plus pour 10 cartes. Une Légendaire se paie par des mots plus simples à côté. Le coût pourra suivre plus tard le taux de réussite réel de chaque mot (P92), plus juste que la rareté.
- b. Des quotas : une Épique ou Légendaire au plus, trois Précieuses ou mieux au plus. Plus simple à lire, moins de choix.
- c. Aucune limite : la cote met face à face des joueurs de même force. À 30 joueurs, elle ne peut pas trier assez fin, et le vétéran écrase le nouveau.

**J5 · Quelles cartes entrent dans le deck.**
- a. **(recommandé)** Les cartes possédées dont le mot est au moins en Esquisse : on ne pose que des mots qu'on a déjà trouvés.
- b. Toutes les cartes possédées, même jamais révisées.
- c. Seulement l'Encre et la Dorure. Fort lien avec la maîtrise, mais personne n'a de mot à l'Encre au niveau 8 (il faut 7 jours).

**J6 · La forme de la question.**
- a. **(recommandé)** Trouver le mot : la définition de la carte, et 4 mots de la même collection et de la même rareté. Une définition à lire, quatre mots courts : la question tient en 15 secondes, et un mot inconnu se devine par sa racine.
- b. Trouver la définition : le mot et 4 définitions. Jusqu'à 100 mots à lire, il faudrait 25 secondes.
- c. Le mot à écrire. Impossible sur un mot qu'on n'a jamais vu, donc sur la plupart des pièges.

**J7 · Le chrono.**
- a. **(recommandé)** 15 secondes par question, une barre qui se vide. Le premier lot essaie 10, 15 et 20 secondes avec les testeurs avant de figer.
- b. 10 secondes : plus nerveux, plus dur pour qui lit lentement.
- c. 60 secondes pour les 5 questions, à répartir. Laisse rechercher la réponse d'une question difficile.

**J8 · Le score et la victoire.**
- a. **(recommandé)** Le plus de bonnes réponses gagne, le temps total départage. Se lit d'un coup d'œil : « 4 sur 5 en 31 secondes ».
- b. Des points selon la vitesse (100 pour une réponse juste, moins 5 par seconde). Plus de suspense, moins lisible, et la vitesse pèse plus que le savoir.
- c. Les bonnes réponses seules, l'égalité possible.

**J9 · Le fantôme.** Avec J1 a, le fantôme n'est plus un remplaçant : c'est la partie de l'adversaire réel.
- a. **(recommandé)** Le second joueur court contre le score du premier, question par question, et le sait : « Partie d'Alix, jouée hier soir. » Le premier joueur joue sans fantôme, puisque l'autre n'a pas encore joué.
- b. Pas de course : chacun joue de son côté, le résultat arrive à la fin.
- c. Des adversaires simulés quand personne n'est disponible. Contraire à P91 (un fantôme est la partie d'un vrai joueur, annoncée comme telle) : exclu.

**J10 · La triche.** Le catalogue est public, donc on ne cache pas les réponses : on les rend peu payantes.
- a. **(recommandé)** Le serveur sert chaque question une seule fois, note l'heure où il la sert et celle où la réponse arrive, refuse une réponse hors délai, et n'envoie la bonne réponse qu'après. Quitter la joute en cours laisse filer le chrono : les questions restantes comptent fausses. L'admin repère les profils suspects (presque tout juste, en moins de 2 secondes, sur des mots jamais vus), et rien de ce qu'on gagne ne vaut la peine de tricher (J14).
- b. En plus, quitter l'écran pendant une question la compte fausse, règle dite avant de jouer. Dissuade la recherche sur le même appareil, pas sur un second, et punit un appel reçu.
- c. Rien de plus que le chrono.

**J11 · Classées et amicales.**
- a. **(recommandé)** Deux sortes. Classée : le jeu choisit l'adversaire, la joute compte pour la cote, une seule par paire de joueurs et par 24 h. Amicale : on défie un ami ou un membre de son clan, autant qu'on veut, sans toucher à la cote, pour que deux amis ne puissent pas se faire monter l'un l'autre.
- b. Tout compte pour la cote, avec une limite par paire.
- c. Amicales seulement au début, classées quand il y aura plus de joueurs.

**J12 · La cote et le classement.** Glicko-2 est un Elo amélioré, déjà retenu (P51) : il tient compte du joueur qui joue peu ou revient après une pause, et s'affiche comme un Elo, un nombre qui part de 1 500.
- a. **(recommandé)** La cote se calcule dès la première joute classée et sert au choix de l'adversaire. Elle s'affiche après 5 joutes classées, avec un rang aux noms de tournoi (Page, Écuyer, Chevalier, Banneret, Champion ; seuils calés sur les cotes réelles). Classement entre amis et dans le clan dès le départ. Classement général quand 50 joueurs auront fait au moins 5 joutes classées dans les 30 derniers jours. P51 change en conséquence.
- b. Classement général dès le départ, comme demandé. À 30 joueurs, il montre surtout qui joue le plus.
- c. Cote cachée, qui ne sert qu'au choix de l'adversaire (P51 tel quel).

**J13 · Les délais.**
- a. **(recommandé)** Le second joueur a 24 h. Sans réponse, la joute revient au premier et compte comme une défaite pour l'absent. Pour que ça reste rare, une classée ne choisit qu'un joueur passé dans les dernières 24 h et qui a moins de 3 joutes à jouer. Un joueur lance 5 joutes en attente au plus. La lettre de rappel ne reproche rien (`docs/voix.md`).
- b. 24 h, et une joute sans réponse est annulée, sans effet sur la cote. Moins dur pour l'absent, mais celui qui a joué n'a rien.
- c. 48 h. Plus souple, mais une joute qui traîne deux jours n'a plus de tension.

**J14 · Les récompenses.** Rien ne se mise (P52), et la défaite ne fait rien perdre.
- a. **(recommandé)** 20 XP pour chaque joute jouée, 20 de plus pour une victoire, sur 5 joutes par jour au plus (heure de Paris). Un sachet bonus pour la première victoire du jour (réserve P23). Quelques succès de joute (P89). Chiffres d'XP à recaler par la simulation de niveau ([level-sim](../rnd/level-sim.md)).
- b. De l'XP seulement. Rien qui fasse revenir chaque jour.
- c. Des écus pour chaque victoire, quand ils existeront (P84). Lie la joute à l'économie, mais une victoire devient une source d'écus à farmer.

**J15 · Les tampons.** P87 dit que le tampon sert au duel.
- a. **(recommandé)** Ils se voient seulement : une carte tamponnée porte son tampon dans le deck, et l'adversaire le voit quand elle lui est posée. Aucun effet sur les points du deck ni sur la partie. À côté, chaque carte du deck garde son compte : « Ce mot a piégé 12 adversaires. »
- b. Un tampon baisse le coût de la carte dans le deck. Récompense le joueur qui ouvre beaucoup de sachets, donc le temps passé plutôt que le savoir.
- c. Pas de tampon dans la joute.

**J16 · Ce que la joute fait à la mémoire du mot.**
- a. **(recommandé)** Rien : une joute ne touche ni la mémoire (FSRS), ni le palier, ni le défi du jour, ni le clan. La question est choisie par l'adversaire et chronométrée, elle ne mesure pas la mémoire comme une révision (P81). Les mots inconnus rencontrés vont dans la liste de souhaits.
- b. Une bonne réponse sur un mot possédé compte comme un entraînement (P81), pour le défi du jour.
- c. Elle compte comme une révision. Contraire à P81.

**J17 · Le niveau.** La règle dit 8, le code applique encore 15 (`UNLOCK_SCHEDULE`, comme les anciens niveaux du profil et du clan).
- a. **(recommandé)** 8, vers le 3e jour : un objectif proche, et assez de mots en Esquisse pour un deck. Le code passe à 8 avec les autres niveaux de P59 (point 6.1 du cahier du game designer). Il faut un compte inscrit avec un pseudo.
- b. 5, avec les échanges et le clan : un seul palier social, mais un deck plus pauvre.
- c. 15 : un joueur sur deux est parti avant.

**J18 · Le nom.**
- a. **(recommandé)** « Joute » : la joute verbale est un combat de mots, le mot va à l'allure ancienne du jeu, il se distingue de WikiMasters, et l'interface le dit déjà (bouton « Joutes », page `/joutes`). Le rang reprend le vocabulaire du tournoi (J12). On dit « Lancer une joute », « Défier un ami ».
- b. « Duel » : compris tout de suite par les 18–30 ans, mais générique, et c'est le mot de WikiMasters.
- c. « Joute » dans le jeu, « duel » dans les textes de vente pour être compris vite. Deux noms pour une chose, contraire au lexique.

**J19 · La R&D temps réel D-007 avant les joutes ?**
- a. **(recommandé)** Non. La joute asynchrone n'est faite que de requêtes courtes, l'état vit dans Postgres, rien n'est gardé en mémoire : elle ne touche pas aux règles d'architecture. La R&D D-007 se fait avant le lot 3 (le direct entre amis) si l'interrogation périodique ne suffit plus, ou avant un événement de streamer en direct.
- b. Oui, comme le prévoit P91 : plusieurs semaines avant de jouer quoi que ce soit.
- c. Une R&D courte en parallèle du lot 1, pour savoir tôt ce que coûtera le direct.

## Ce qu'on évite

- **Une mise**, sous quelque forme que ce soit : ni carte, ni écu, ni pot (P52, N1).
- **Un faux adversaire** présenté comme un vrai joueur.
- **Perdre quelque chose** en perdant une joute : on gagne moins, on ne perd rien, sauf de la cote.
- **Un rappel qui culpabilise** : « Alix t'attend ! », « Ne laisse pas passer ta chance ». La lettre dit la joute et l'heure limite, c'est tout.
- **Du temps réel dans le chemin critique** tant que D-007 n'a pas conclu.
- **Un classement général sur une liste de 30 noms.**

## Ce qui change dans les règles, une fois tranché

- **P91** est réécrite selon J1 à J16. Le statut « après la R&D temps réel » tombe si J19 a.
- **P51** : la cote s'affiche et les classements entre amis, dans le clan puis général arrivent (J12).
- **P87** : le rôle du tampon dans la joute (J15).
- **P77** : la liste de souhaits reçoit les mots vus en joute (J16).
- **P59** : le code passe à 8 (J17).
- **P80** : la lettre de joute entre dans l'e-mail « Lettres en attente », avec son réglage « Joutes ».
- **`docs/voix.md`** : « joute » entre au lexique (J18).

## Ce qui change dans le code, en bref

Le détail viendra après les choix.

- **`packages/core` :** coût d'un deck et sa validité, tirage des 5 cartes et des mauvais choix (générateur cryptographique), score et départage, Glicko-2, récompenses et leurs plafonds. Tout en fonctions pures, testées.
- **`packages/db` :** le deck de chaque joueur, les joutes (les deux joueurs, la sorte, l'état, l'heure limite, les cartes figées), les réponses (heure servie, heure reçue, choix), la cote. Migrations additives.
- **`apps/api` :** lancer une joute (choix de l'adversaire), servir la question suivante, répondre, lire une joute, revanche. Chaque écriture est courte, avec une clé d'idempotence, et verrouille la joute ; la fin verrouille les deux cotes dans un ordre fixe. Tests d'intégration sur deux réponses simultanées à la même question et sur deux fins de joute simultanées. Limites de débit sur le lancement.
- **La file :** lettres, e-mails, compteurs « a piégé N adversaires », succès.
- **Web et mobile ensemble** : l'éditeur de deck, la joute, la fin, la liste de ses joutes, la cote et le rang. Logique et textes dans `packages/view-model`.

Charge : une joute fait une douzaine de requêtes par joueur, étalées sur une minute. Le serveur maison a tenu 151 requêtes par seconde au test ([rnd/charge.md](../rnd/charge.md)) : de quoi jouer des milliers de joutes par heure.

## Découpage une fois validé

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 1 | Deck, joute amicale et classée, fin de joute, lettres, récompenses, cote calculée sans être montrée. D'abord ouvert aux testeurs choisis dans l'admin, pour régler le chrono (J7) | Le jeu entier, jouable entre deux navigateurs, sur les vrais joueurs de la bêta |
| 2 | Cote et rang visibles, classements entre amis et dans le clan, compteur des pièges, succès de joute | Quand il y a assez de joutes pour que la cote veuille dire quelque chose |
| 3 | Le direct entre amis : deux amis connectés lancent la joute ensemble et voient le score de l'autre bouger, par interrogation périodique | Le direct là où il marche à toute échelle : entre gens qui se sont donné rendez-vous |
| 4 | Le défi par lien : « Trouveras-tu mes 5 mots ? », jouable par tous, invités compris, avec le classement de ce défi. Le classement général au seuil de J12 | L'outil d'acquisition, et le mode des streamers (tout le chat joue le deck du streamer, comme le Scrabble duplicate) |

## Risques

| Risque | Réponse |
|---|---|
| Le second joueur ne joue jamais | Adversaires choisis parmi les joueurs passés dans la journée, 3 joutes à jouer au plus, lettre et e-mail (J13) |
| Le vétéran écrase le nouveau | Points du deck (J4), cote qui rapproche les forces, amicales sans enjeu |
| Un mot inconnu fait de la question une loterie | Mauvais choix de même rareté, racine du mot pour deviner, et c'est le principe du piège : le mot se retrouve en souhait à la fin |
| Recherche des réponses ou outil qui répond seul | Chrono, heure mesurée par le serveur, repérage dans l'admin, rien de précieux à gagner |
| Deux amis se font monter la cote | Les amicales ne comptent pas, une classée par paire et par jour |
| Les joutes passent avant ce qui fait revenir à J1 | Garder l'ordre des phases et la condition de rétention de l'ouverture publique ([retours-game-designer](retours-game-designer.md#louverture-publique)) |
