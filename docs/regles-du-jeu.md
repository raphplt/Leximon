# Règles du jeu

**Source unique des choix métier de Leximon.** Tout ce que le propriétaire tranche sur le jeu (ce que le joueur gagne, paie, voit, peut faire) vit ici et nulle part ailleurs. Les décisions techniques (`docs/decisions.md`) expliquent comment ces règles sont construites et y renvoient ; elles gardent la trace de la date et du pourquoi, mais en cas d'écart, c'est ce fichier qui fait foi.

**Dernière mise à jour :** 2026-10-21.

- **Statuts :** **Tranché** · **Provisoire** (valeur de départ, à recalibrer sur les données réelles) · **À décider** (en bas du fichier).
- **Réglages chiffrés :** ils sont aussi dans `packages/core/src/rules.ts`, où le code les lit. Un changement se fait aux deux endroits dans le même commit, par une nouvelle période datée : il ne s'applique jamais rétroactivement aux joueurs existants.
- Les numéros P1 à P22 viennent de la north star et restent stables. Les nouvelles règles prennent la suite.

## Non négociable

| # | Règle | Raison |
|---|---|---|
| N1 | **Aucun hasard payant :** aucun booster ne s'achète, ni directement ni via une monnaie achetée ; aucune monnaie achetable en euros ; aucune carte ne se revend contre de l'argent. | Un hasard payant imposerait un PEGI 16 au minimum et le régime JONUM, réservé aux majeurs, alors que le jeu est ouvert dès 15 ans |
| N2 | **Ce qui se paie a un contenu connu à l'avance :** abonnement, cosmétiques, decks imprimés. Un pli ne fait jamais partie de ce qui se paie (N1). | Idem |
| N3 | **Échanges carte contre carte**, par offres structurées, sans messagerie libre. | Protéger les joueurs, dont les mineurs de 15 ans et plus |
| N4 | **Contenu des cartes :** uniquement des sources autorisées (skill `carte-mot`). | Droits |
| N5 | **Texte écrit par les joueurs** (pseudo, nom de clan, discussion de clan) : filtré à l'envoi, signalable, modéré ; une sanction est motivée et contestable. | DSA, règles de l'App Store et de Google Play |

## Produit

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P1 | Positionnement | Jeu de collection qui fait apprendre. Le tirage et la collection restent forts. Pas une app d'apprentissage façon Duolingo. | Tranché |
| P3 | Plateformes | Web et mobile en parallèle. | Tranché |
| P5 | Illustrations | Gravures du domaine public, avec un traitement graphique propre. | Tranché |
| P7 | Nom | Leximon, domaine leximon.fr (contact@leximon.fr). Libre à l'INPI et à l'EUIPO au 2026-10-20 ; « LEXICON » est enregistrée en France pour les jeux (classes 16 et 28) et « LEXIMON » est déposée en Thaïlande. Dépôt INPI (classes 9, 28, 41) dès que le projet montre de la traction, avant toute communication large. | Tranché le 2026-10-20, marque à déposer |
| P8 | Cible | Grand public (B2C), inscription à partir de 15 ans. Pas de version école prévue. | Tranché le 2026-10-20 (remplace « B2B écoles rapidement derrière ») |
| P9 | Mot du jour | Écarté : déjà vu partout, dilue le message. | Tranché |
| P13 | Catalogue | Ambition de 10 000 cartes et plus. Au lancement, 1 000 à 2 000 mots, puis du nouveau contenu chaque semaine. Les expressions viennent après le lancement. | Tranché |
| P16 | Collections et thèmes | Deux notions distinctes. Une **collection** est un pli qu'on ouvre : une carte appartient à une seule (P14) ; la liste prévue est en P56. Un **thème** est une étiquette transverse : une carte en porte plusieurs, et les thèmes servent aux filtres de l'album et aux défis. Thèmes sur les cartes publiées : vie quotidienne, métiers, nature, arts, sentiments, religion, sciences, insultes, guerre, corps, droit, argent, loufoque, cuisine, galanterie, autre. À ajouter : mots doux à dire, faux amis (le mot ne veut pas dire ce qu'on croit), mots d'auteurs (Rabelais, Molière…), mots à ressusciter (utiles aujourd'hui). Aucun thème ne domine le catalogue. | Tranché ; liste des thèmes provisoire le 2026-10-20 |
| P55 | Liste d'attente | Avant la bêta, l'accueil public (`leximon.fr`) ne demande qu'une adresse e-mail, pour prévenir de l'ouverture. Rien d'autre n'est promis : ni pseudo réservé, ni carte offerte, ni parrainage. Un seul e-mail envoyé, celui de l'ouverture, puis l'adresse est effacée. | Tranché le 2026-10-20 |

## Boosters (plis)

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P2 | Gratuité | Les boosters sont gratuits et se rechargent avec le temps (N1). | Tranché |
| P10 | Rythme | 5 cartes par booster, 1 booster toutes les 30 min, stock maximum 6. | Provisoire |
| P11 | Probabilités par carte | Courant 60 %, Peu courant 25 %, Rare 10 %, Précieux 4 %, Épique 0,9 %, Légendaire 0,1 %. Au moins une carte Peu courant ou mieux par booster. | Provisoire |
| P12 | Garanties | Une Épique garantie au 40e booster d'affilée sans en obtenir, une Légendaire au 150e (simulation : `docs/rnd/collection-sim.md`). | Provisoire |
| P14 | Structure | Un booster par collection, plus un booster « découverte » tiré dans tout le catalogue. Une carte appartient toujours à sa collection. | Tranché |
| P15 | Doublons | Pas de protection anti-doublons. La complétion repose sur les échanges et les plis bonus. | Tranché |
| P17 | Transparence | Probabilités et garanties ne sont jamais affichées aux joueurs (légal tant que les boosters sont gratuits). | Tranché |
| P18 | Stock unique | Un seul stock pour toutes les sources : un booster découverte consomme le même stock qu'un booster de collection. | Tranché |
| P19 | Garanties partagées | Les compteurs Épique et Légendaire comptent tous les boosters du joueur, quelle que soit leur source. | Tranché |
| P23 | Réserve de plis bonus | Les plis bonus (P29) vont dans une réserve séparée, plafonnée à 10 ; au-delà, ils sont perdus. La réserve ne sert que quand le stock gratuit est vide : un bonus ne bloque jamais la recharge. | Tranché le 2026-10-20 |

## Ouverture des plis

Détail et maquettes : [cahiers-des-charges/ouverture.md](cahiers-des-charges/ouverture.md).

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P45 | Mise en scène | L'ouverture est le moment fort du jeu. Le pli se déchire au doigt ; l'annonce d'une carte vient avant sa face, plus longue à mesure que la rareté monte ; à partir de Précieux, le joueur retourne la carte lui-même. Son et vibration l'accompagnent, et se coupent dans les réglages. | Tranché le 2026-10-20 |
| P46 | Coup d'œil | Glisser la pile en biais montre la tranche des cartes, colorée par rareté. Possible seulement une fois le pli ouvert, le tirage déjà fait : il ne sert jamais à choisir un pli. Jamais expliqué dans l'interface. | Tranché le 2026-10-20 |
| P47 | Forme du paquet | Deux formes, le pli scellé et le sachet. Pas de test A/B : le propriétaire les a essayées. **Tous les joueurs voient le sachet** ; le pli reste visible à l'essai (`/jouer?paquet=pli`). | Tranché le 2026-10-20, sachet choisi le 2026-10-20 |
| P53 | Nom du paquet | Le mot suit la forme : avec le sachet, « sachet » partout (navigation, stock, sachets bonus, défis, échanges, album) ; avec le pli, « pli ». | Tranché le 2026-10-20 |

## Cartes et rareté

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P20 | Calcul de la rareté | Courant à Précieux : la fréquence réelle du mot (Google Ngram), seuils communs à tout le catalogue. Épique et Légendaire : réservées aux pépites, choisies par un jury automatique ; une pépite absente de tout Google Books est Légendaire. Détails : D-020, D-021. | Seuils provisoires |
| P21 | Mots courants au sens ancien | Acceptés (« punaise », « canaille » comme injures). Leur fréquence les classe Courant. | Tranché |
| P22 | Fréquence affichée | La fréquence réelle du mot figure sur la carte, discrètement, en chiffre seul. | Tranché |
| P44 | Affichage de la rareté | Sur la carte, une icône seule, de la série des gemmes (de l'éclat brut pour Courant au soleil taillé pour Légendaire), dans la couleur de rareté. Le nom de la rareté reste dans l'interface, à côté de l'icône : vue agrandie, révélation d'un pli, album. | Tranché le 2026-10-20, soleil taillé le 2026-10-21 |
| P24 | Rareté figée | Une carte publiée garde sa rareté et son identifiant pour toujours. Un mot reclassé devient une nouvelle carte ; une carte retirée quitte les boosters, les exemplaires possédés restent. | Tranché |
| P25 | Pépites | Au plus 2 % d'un lot en Légendaires et 6 % en Épiques, jamais un mot noté sous 6 sur 10 en charme. | Provisoire |

Noms des raretés : Courant (encore compris de beaucoup), Peu courant (vieilli), Rare (disparu de l'usage courant), Précieux (quasi absent du corpus moderne), Épique (une pépite quasi absente du corpus moderne), Légendaire (une pépite absente de tout Google Books).

## Contenu des cartes

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P4 | Rédaction | Rédaction maison à partir du Littré (domaine public), par un LLM, contrôlée automatiquement (D-019, D-021). | Tranché |
| P26 | Format | Définition de 25 mots au plus, en français moderne, reformulée. Étymologie courte, « Origine incertaine. » si elle n'est pas établie. Citation d'un auteur du domaine public, ou pas de citation. | Tranché |
| P27 | Relecture humaine | Par échantillon : environ 5 % au hasard, chaque Légendaire, chaque carte encore signalée par les contrôles. Une carte est publiée si sa relecture l'accepte (« OK », « Retouche ») ou si elle n'était pas à relire. | Tranché |
| P28 | Injures modernes | Un mot au sens injurieux moderne (raciste, sexiste, homophobe…) est exclu, même si le Littré l'ignore. | Tranché |
| P39 | Mots régionaux | Gardés, à condition que la définition dise la région (« En Lorraine, … »). Ils formeront le fonds d'une future collection « Parlers régionaux ». | Tranché le 2026-10-20 |
| P40 | Noms propres | Exclus : un nom de personne, de divinité, de lieu ou d'astre n'est pas un mot de la langue (« Palès », « Rigel »). | Tranché le 2026-10-20 |
| P41 | Indice dans la définition | À limiter : la définition évite le mot et les mots évidents de sa famille (pas « petite jarre » pour jarron), pour que le défi garde son sens. Toléré quand on ne peut pas faire autrement sans perdre en clarté. | Tranché le 2026-10-20 |
| P42 | Gravures | Une gravure du domaine public (ou CC0, CC BY 4.0 avec crédit) illustre la carte quand on en trouve une juste ; chaque gravure est validée avant publication. Une carte sans gravure est publiée avec sa grande initiale et la reçoit plus tard. | Tranché le 2026-10-20 |
| P43 | Rendu des gravures | L'encre seule, imprimée dans la couleur du mot (or ou irisé sur les cartes de nuit) ; à partir de Rare, un aplat de la couleur de rareté décalé sous l'encre, façon impression mal calée. Les sujets en hauteur débordent vers le haut de l'encart. | Tranché le 2026-10-20 |
| P57 | Prononciation | Chaque carte fait entendre son mot, gratuitement pour tous, jamais réservé à l'abonnement. Une seule voix de synthèse pour tout le catalogue, guidée par une notation phonétique contrôlée (D-032) : pas d'enregistrements humains, pour un son homogène, y compris sur les cartes rares. | Tranché le 2026-10-21 |

## Collections

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P30 | Collections de lancement | Trois collections d'environ 500 cartes : « Les Fondateurs » (généraliste), « Caractères et travers » (mœurs, défauts, moqueries, injures d'antan), « Métiers et objets disparus ». Les injures d'antan vont toujours dans Caractères et travers. | Tranché le 2026-10-20 |
| P56 | Collections prévues | Après les trois de lancement (P30), dans l'ordre où le fonds du Littré le permet (environ 15 000 mots jugés exploitables au pré-tri) : Bêtes et plantes (500 et plus), À table ! (mets, boissons, fêtes, 300), Habits et parures (300), Remèdes et médecine d'antan (300), Chicane et paperasse (droit, procès, 300), Sorcellerie, foi et superstitions (300), Mer et marine (300), Chevalerie et guerre (300), Monnaies, foires et commerce (200), Amour et galanterie (200), Parlers régionaux (P39, 300 et plus), puis Expressions après le lancement (P13). Chaque nouvelle collection coûte environ 2 à 3 $ de génération pour 300 cartes, lancée avec l'accord du propriétaire. | Provisoire, 2026-10-20 |

## Défis et maîtrise

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P31 | Ce qu'on révise | Seulement les mots que le joueur possède. La révision espacée (FSRS) choisit quand un mot revient ; un mot oublié revient le lendemain. | Tranché le 2026-10-20 |
| P32 | Formats | QCM à 4 choix : « trouver la définition » ou « trouver le mot ». Les mauvais choix viennent de la même collection. | Tranché le 2026-10-20 |
| P33 | Niveaux | Esquisse au départ, Encre quand le mot est retenu sur 7 jours, Dorure sur 30 jours (stabilité mémoire FSRS, objectif 90 % de rappel, intervalle maximal 365 jours). Un niveau ne redescend jamais. La maîtrise est rangée par mot : un échange ne la touche pas. | Provisoire |
| P29 | Plis bonus | 1 pli bonus le premier jour (heure de Paris) où le joueur répond à au moins 5 questions de défi avec au moins 3 bonnes réponses, une fois par jour ; 1 pli bonus chaque fois qu'une carte atteint la Dorure. Ils vont dans la réserve (P23). | Tranché le 2026-10-20 |

Le catalogue étant public, un tricheur peut trouver les bonnes réponses : ce sont les plafonds (une fois par jour, Dorure espacée de semaines par FSRS) qui limitent ce qu'il gagne, pas le secret des réponses.

## Échanges

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P6 | Principe | Dès le lancement, carte contre carte, avec garde-fous (N3). | Tranché |
| P34 | Forme d'une offre | Offre directe à un joueur désigné par son code public (8 caractères) : 1 à 3 cartes données contre 1 à 3 cartes voulues, un exemplaire de chaque. Pas de texte libre. | Tranché le 2026-10-20 |
| P35 | Ce qui s'échange | Seulement les doublons. Une Épique ou une Légendaire attend 7 jours après sa dernière obtention. | Provisoire |
| P36 | Garde-fous | Compte de plus de 3 jours et niveau 5 au moins (P48), pour les deux joueurs ; 10 offres envoyées par 24 h glissantes ; une offre expire après 72 h. | Provisoire |

## Progression et social

Détail : [cahiers-des-charges/progression-et-social.md](cahiers-des-charges/progression-et-social.md).

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P48 | Niveau de compte | Les actions utiles (plis, mots nouveaux, défis, échanges) rapportent de l'expérience ; chaque niveau donne une récompense que le joueur réclame. Barème de départ : 10 XP par pli ouvert, 20 de plus pour le premier de la journée (heure de Paris), par mot nouveau 5 (Courant), 10, 15, 25, 35 et 50 (Légendaire), 15 par bonne réponse à un défi, 25 par mot qui passe à l'Encre ou à la Dorure, 20 par échange conclu pour chacun des deux joueurs. Passer du niveau n au suivant demande 100 + 20 × (n − 1) XP, sans plafond. L'XP d'un invité le suit à l'inscription. Récompenses en P58, fonctionnalités ouvertes par niveau en P59. | Provisoire, échanges au niveau 5 tranché le 2026-10-20 |
| P49 | Avatar | Portraits tirés des gravures du domaine public, dont une partie se gagne par les niveaux. Pas de photo envoyée par le joueur. | Tranché le 2026-10-20 |
| P50 | Clans | Pas de nombre maximum de membres, un seul clan par joueur, nom libre choisi par le chef (N5), discussion texte modérée (N5), bibliothèque commune (la part de chaque collection que possède au moins un membre). Compte inscrit, niveau 10 pour rejoindre un clan, niveau 15 pour en créer un (P48). | Tranché le 2026-10-20, niveaux le 2026-10-21 |
| P51 | Classements | Pas en v1. Une cote globale Glicko-2 sur les parties entre joueurs ; le Scrabble duplicate comme source d'inspiration (même partie pour tous, classement au pourcentage du meilleur score). | Tranché le 2026-10-20 |
| P52 | Modes de jeu entre joueurs | Explorés en R&D, plusieurs pistes à prototyper. Aucune mise de cartes sur une partie. | Tranché le 2026-10-20 |
| P58 | Récompenses de niveau | Chaque niveau donne une récompense gratuite, que le joueur réclame (coffret). Niveaux ordinaires : un sachet bonus (réserve P23) et une recharge du stock gratuit, en alternance. Tous les 5 niveaux (5, 15, 25…) : un sachet garni (au moins une carte Rare ou mieux) et un titre (5 « Lexicographe en herbe », 15 « Fine plume », 25 « Rat de bibliothèque », 35 « Grand glossateur », 45 « Puits de science »). Tous les 10 niveaux : une carte au choix (une Courante ou Peu courante qui manque au joueur), une place de plus dans la réserve de sachets bonus (jusqu'au niveau 50, soit 15 places au plus), un avatar gravé et une place de plus pour les cartes épinglées (3 à l'ouverture du profil, 6 au plus au niveau 30). Au-delà du niveau 50 : un sachet bonus à chaque niveau et un avatar tous les 20 niveaux. Précisions de mise en œuvre : niveaux impairs, sachet bonus ; niveaux pairs, recharge ; le niveau 1 ne donne rien. Un coffret qui ne peut pas servir reste fermé et attend, sans rien perdre : sachet bonus refusé si la réserve est pleine, recharge refusée si le stock est plein. Le sachet garni s'ouvre avant les autres sachets de la réserve. La carte au choix ne rapporte pas d'XP ; si le joueur possède déjà toutes les Courantes et Peu courantes, il en choisit une qu'il a déjà. | Tranché le 2026-10-21 ; titres provisoires ; précisions de mise en œuvre (alternance, refus, au-delà de 50) du 2026-10-21, à confirmer |
| P59 | Fonctionnalités par niveau | Une fonctionnalité fermée reste visible avec le niveau qui l'ouvre. Niveau 1 : sachets découverte (P14), album, défis ; les défis ne sont jamais fermés. Niveau 3 : choisir la collection de son sachet. Niveau 5 : échanges d'une carte contre une carte (P36). Niveau 8 : profil public (compte inscrit). Niveau 10 : échanges jusqu'à 3 cartes de chaque côté (il faut que les deux joueurs l'aient ; revérifié quand l'offre est acceptée), rejoindre un clan (P50). Niveau 15 : créer un clan, modes de jeu entre joueurs quand ils existeront. | Tranché le 2026-10-21 ; dans le code (serveur et web) depuis le lot 1 de [interface-v1](cahiers-des-charges/interface-v1.md) ; profil public, clans et joutes pas encore construits |
| P60 | Visibilité du profil | Public par défaut : vu de tous par un lien, avec le pseudo, l'avatar, le clan, les cartes épinglées et les statistiques. Le joueur peut le passer en privé dans les réglages ; il n'apparaît alors aux autres que par son pseudo et son avatar. | Tranché le 2026-10-21 |

## Comptes

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P37 | Compte invité | On essaie sans inscription : un invité ouvre 2 plis (gratuits ou bonus), puis un compte est demandé pour en ouvrir d'autres ; l'album et les défis restent accessibles. L'inscription (code à 6 chiffres reçu par e-mail, Apple, Google) transfère tout ce que l'invité possède au nouveau compte, y compris portefeuille, plis bonus, garanties et ancienneté. | Tranché, code plutôt que lien le 2026-10-20 ; limite à 2 plis le 2026-10-20 (remplace le jeu illimité sans compte), réglage provisoire |
| P38 | Limites | 60 créations de compte invité par minute et par adresse IP (une classe derrière une même adresse) ; 120 requêtes par minute par joueur (D-018). | Provisoire |
| P54 | Invité qui se connecte à un compte existant | Rien n'est fusionné : seul un nouveau compte reçoit la progression d'un invité (P37). Si le compte joue déjà, l'invité est abandonné (archivé, jamais supprimé) et le compte garde son jeu tel quel. Quand l'invité possède au moins une carte ou la maîtrise d'un mot, le joueur est d'abord averti du nombre de cartes perdues et doit confirmer ; il peut aussi annuler et rester invité. Un invité vide se connecte sans avertissement. Les offres en attente de l'invité sont annulées. | Tranché le 2026-10-20, remplace la fusion bornée |

## À décider

Options et recommandations dans les cahiers des charges ([ouverture](cahiers-des-charges/ouverture.md#décisions), [progression et social](cahiers-des-charges/progression-et-social.md#décisions)).

- **Numéro de collection sur la carte** (« 040/160 ») : dénominateur fixe annoncé à la publication, ou nombre de cartes publiées ; Légendaires « hors série » numérotées au-delà, ou non.
- **Sons de l'ouverture :** garder les sons synthétisés, ou passer à des sons de banque.
- **Abonnement premium :** le propriétaire veut l'envisager (2026-10-20), en plus des cosmétiques. Il reste dans N1 et N2 : contenu connu à l'avance, jamais de plis. Pistes de `north-star.md` : révisions illimitées, statistiques, collections en avant-première, mode hors ligne. À décider : contenu, prix, et ce qui reste gratuit pour ne pas casser le jeu. La prononciation reste gratuite (P57).
- **Notation phonétique affichée :** sur la carte, à côté de la carte (vue agrandie), ou pas du tout. Penchant du propriétaire pour l'afficher (2026-10-21), à essayer sur des maquettes.
- **Cible principale :** hypothèse du propriétaire, les adultes de 25 à 65 ans et plus, plutôt que les moins de 18 ans (P8 reste ouvert dès 15 ans). À vérifier pendant la bêta avant d'orienter la communication.
- **Discussion de clan :** modération automatique par un modèle dès la bêta ou plus tard ; durée de conservation des messages.
