# Cahier des charges · Interface v1

- **Statut :** maquette et cahier validés par le propriétaire le 2026-10-21.
- **Couvre :** toute l'interface de la v1, web et mobile, des écrans jusqu'aux états vides et aux erreurs.
- **Référence visuelle :** la [maquette cliquable](https://claude.ai/artifact/3NrKcPvaHBRLn1a4i93D6U) (privée, propriétaire seul), avec un réglage « Habitué · niveau 16 » ou « Débutant · niveau 2 ». En cas d'écart, ce cahier et [regles-du-jeu.md](../regles-du-jeu.md) font foi.
- **Décisions liées :** D-002 et D-003 (web et mobile), D-022 (direction artistique), D-029 (gemmes), D-033 (logique d'écran commune).
- **Règles liées :** P10 à P23 (sachets), P33 à P36 (défis, échanges), P45 à P47 (ouverture), P48 à P52 et P58, P59 (progression et social), P57 (prononciation), N3 et N5 (texte des joueurs).

## Comment on s'en sert

L'inventaire plus bas liste tout ce qui doit exister, une ligne par élément, avec un identifiant stable (« J-04 »). C'est lui qui garantit qu'on n'oublie rien :

- un lot n'est fini que quand toutes ses lignes sont cochées sur les plateformes qu'il couvre ;
- une ligne est cochée quand l'écran est comparé à la maquette en 1440 et en 390 de large, avec ses états (chargement, vide, erreur, fermé par le niveau), et que ses textes passent les deux tests de [voix.md](../voix.md) ;
- ce que la maquette ne montre pas et qu'on découvre en route s'ajoute ici, avec un nouvel identifiant, jamais seulement dans le code.

Statuts des colonnes Web et Mobile : **fait**, **à reprendre** (existe, à aligner sur la maquette), **à faire**, **—** (sans objet).

## Principes

### Navigation

- **Web, à partir de 760 px de large :** barre du haut, pas de barre latérale. Le logo, cinq entrées (Jouer, Album, Défis, Échanges, Clan), puis à droite le stock de sachets, les sachets bonus, le courrier, l'anneau de niveau et l'avatar. Le menu de l'avatar donne le profil, les joutes, l'atelier, le chemin des niveaux et les réglages.
- **Mobile :** cinq onglets en bas, Album · Défis · **Jouer** (au centre, en relief) · Échanges · Clan. En haut, un bandeau avec l'avatar et son niveau, la barre d'XP, le stock, les bonus et le courrier.
- **Web sous 760 px** (site ouvert sur un téléphone) : il reprend la coque mobile, onglets en bas et fiches qui montent.
- **Contenu secondaire :** sur le web, un panneau à droite (courrier, réglages, discussion) ou une fenêtre au centre (fiche d'une carte) ; sur mobile, une fiche qui monte du bas, avec une poignée. Fermer : la croix, le fond, la touche Échap ou le glissement vers le bas.
- **Fonction fermée par le niveau :** toujours visible, avec un badge « Niv. X ». La toucher ouvre un écran qui dit quel niveau l'ouvre et propose d'ouvrir un sachet ou de faire un défi. C'est une promesse, pas un mur (P59).

### Écran Jouer

L'écran principal se lit comme un jeu mobile : le sachet au centre, les boutons flottants sur les côtés, la progression en haut.

- **À gauche :** Clan, Discussion, Joutes. **À droite :** Défi du jour (anneau qui se remplit avec les réponses), Coffrets (doré et pulsant quand une récompense attend), Courrier, Réglages.
- **Pastilles rouges :** seulement pour ce qui attend le joueur (offre reçue, coffret, message de clan, courrier non lu). Jamais pour pousser à revenir : pas de série de jours, pas de classement (P51).

### Ton

Les textes suivent [voix.md](../voix.md) : « sachet » partout, tutoiement, ton sec sur les écrans fonctionnels, voix pleine sur les écrans vides, « ! » réservé aux récompenses. Les textes de la maquette servent de premier jet ; ils vivent ensuite une seule fois, dans `packages/view-model`, pour que le web et le mobile disent la même chose.

### Mieux fini que la maquette

La maquette montre l'intention, pas la finition. Chaque écran gagne en plus :

- les vraies animations : l'ouverture existante du web (déchirure, pile, coup d'œil, reflets), Reanimated sur mobile ;
- des écrans de chargement à la forme du contenu, sans roue qui tourne au milieu de l'écran ;
- des erreurs qui disent quoi faire, et une action rejouable sans perdre ce qui a été saisi ;
- le respect des mouvements réduits, du clavier, du lecteur d'écran et du texte agrandi ;
- le budget de l'ouverture tenu : 150 ms au 95e centile côté serveur.

## Architecture (D-033)

| Couche | Contenu | Où |
|---|---|---|
| Règles du jeu | Niveau et XP, récompenses (P58), fonctionnalités par niveau (P59), garde-fous des échanges | `packages/core`, réglages datés dans `rules.ts` |
| Contrat | Schémas Zod des réponses, client typé | `packages/contract` |
| Logique d'écran | États et dérivations des écrans, textes de l'interface, formats (cote, dates relatives) | `packages/view-model` (nouveau) |
| Design | Couleurs, polices, rayons, gemmes, teintes de dos | `packages/tokens` |
| Affichage | Composants, gestes, animations, appels réseau | `apps/web`, `apps/mobile` |

**Ce qui migre vers `view-model` quand l'écran est repris :** `progress/progress.ts`, `challenges/session.ts`, `trades/offer.ts`, `cards/display.ts`, et ce qui, dans `booster/` (`reveal.ts`, `staging.ts`), ne dépend pas du DOM.

**Composants de base, une fois par plateforme :** carte, gemme, icône, bouton (principal, secondaire, discret), pastille, panneau, fiche ou panneau latéral, barre d'XP, médaillon de niveau, bouton flottant, onglets, champ de texte, notification courte (toast), écran fermé par le niveau.

## Inventaire

### C · Coque

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| C-01 | Barre du haut (web) | Logo, cinq entrées avec pastilles, stock « 4/6 · 18 min », bonus « +2 bonus », courrier, anneau de niveau, avatar avec menu | `GET /me/progress`, portefeuille | 1 | fait | — |
| C-02 | Menu de l'avatar | Mon profil, Joutes (Niv. 15), Atelier, Chemin des niveaux, Réglages. Fermé par Échap et clic à côté | — | 1 | fait | à faire |
| C-03 | Onglets du bas (mobile) | Cinq onglets, Jouer en relief au centre, pastilles, cadenas sur les onglets fermés | — | 5 | — | à faire |
| C-04 | Bandeau du haut (mobile) | Avatar avec anneau et niveau, barre d'XP, stock, bonus, courrier | idem C-01 | 5 | — | à faire |
| C-05 | Panneau latéral (web), fiche montante (mobile) | Titre, croix, défilement interne, focus piégé, retour du focus à la fermeture | — | 1 | fait | à faire |
| C-06 | Écran fermé par le niveau | Icône, « Les clans ouvrent au niveau 10 », une phrase de promesse, barre vers le niveau, « Ouvrir un sachet », « Faire un défi » | P59 | 1 | fait | à faire |
| C-07 | Notification courte (toast) | Une ligne, 2,6 s, annoncée au lecteur d'écran | — | 1 | fait | à faire |
| C-08 | Coque mobile du web sous 760 px | Onglets en bas, bandeau du haut, fiches montantes, comme C-03 et C-04 | — | 1 | fait | — |
| C-09 | Invité limité à 2 sachets | Au 3e sachet, l'écran d'inscription (P37) remplace l'ouverture | existe | 1 | fait | à faire |

### J · Jouer

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| J-01 | Bandeau de niveau | Médaillon, « Niveau 16 · Fine plume », barre d'XP épaisse, « 260 / 400 XP » | `GET /me/progress` | 1 | fait | à faire |
| J-02 | Prochaines récompenses (web) | Les 4 niveaux suivants en pastilles, les paliers de 5 en kraft, un cadenas quand le niveau ouvre une fonction. Toucher : le chemin des niveaux sur ce niveau | P58, P59 | 1 | fait | — |
| J-03 | Bouton « N coffrets » | Visible et pulsant tant qu'une récompense attend ; ouvre le coffret du plus petit niveau | `GET /me/level-rewards` | 1 | fait | à faire |
| J-04 | Boutons flottants | Gauche : Clan, Discussion, Joutes. Droite : Défi du jour (anneau), Coffrets, Courrier, Réglages. Pastilles, badges « Niv. X » | plusieurs | 1 | fait | à faire |
| J-05 | Choix de la collection | Web : pastilles des collections. Mobile : flèches de part et d'autre du nom. Avant le niveau 3, seul le sachet découverte, les autres affichent « Niv. 3 » (P14, P59) | P59 dans `POST /boosters/open` | 1 | fait | à faire |
| J-06 | Le sachet | Grand sachet de la collection choisie, qui flotte ; gris et immobile quand stock et réserve sont vides | — | 1 | fait | à faire |
| J-07 | Stock | Six points, « 4 sur 6 · le prochain dans 18 min », bouton « Ouvrir le sachet » ou « Ouvrir un sachet bonus », désactivé quand tout est vide | existe | 1 | fait | à faire |
| J-08 | Mot qui s'échappe | Petite carte, « *Lucubrateur* est en train de t'échapper. », « Réviser ». Le mot dû le plus fragile ; absent s'il n'y en a pas | `GET /challenges` | 1 | fait | à faire |

### O · Ouverture d'un sachet

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| O-01 | Déchirure, pile, coup d'œil | Selon [ouverture.md](ouverture.md) (P45, P46) | existe | 5 | fait | à faire |
| O-02 | Révélation | Web : cinq cartes à retourner, « Tout révéler ». Mobile : une carte à la fois, « Suivante », points de position | existe | 5 | fait | à faire |
| O-03 | Annonce de rareté | « Rare ! », « Légendaire ! » à la couleur de la rareté, halo autour de la carte | existe | 5 | fait | à faire |
| O-04 | Bilan | « Ton sachet », meilleure rareté, mots nouveaux, éventail des cinq cartes avec « Nouveau », « +N XP », barre d'XP, progression de la collection | existe | 1 | fait | à faire |
| O-05 | Passage de niveau | Dans le bilan : « Niveau 17 ! Une récompense t'attend. », bouton « Ouvrir le coffret » à la place de « Ouvrir un autre sachet » | idem | 1 | fait | à faire |
| O-06 | Son et vibration | Coupés dans les réglages (R-03) | — | 5 | fait | à faire |

### N · Chemin des niveaux et coffrets

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| N-01 | Chemin | Route qui serpente, niveaux du plus haut au plus bas, partie parcourue dorée, défilement centré sur le niveau du joueur, son avatar épinglé dessus | P58 | 1 | fait | à faire |
| N-02 | Pastilles de niveau | États : réclamée (coche), à réclamer (coffret pulsant), suivante (contour jaune), fermée. Paliers de 5 plus gros ; écriteau « Ouvre : les échanges » aux niveaux de P59 | P58, P59 | 1 | fait | à faire |
| N-03 | Détail d'un niveau | Panneau à droite (web), sous le chemin (mobile) : récompenses, ce qu'il ouvre, « Ouvrir le coffret », « Réclamée » ou « Encore 1 240 XP. » | idem | 1 | fait | à faire |
| N-04 | D'où vient l'XP | Le barème P48 en tableau | — | 1 | fait | à faire |
| N-05 | Coffret | Fenêtre avec rayons : « Un coffret pour toi », « Ouvrir le coffret », puis « Niveau 16 ! », les récompenses une à une, ce qu'il ouvre, « Ranger dans ma réserve » | `POST /me/level-rewards/{niveau}` | 1 | fait | à faire |
| N-06 | Sachet bonus, recharge | Rangés à la réclamation, toast « Stock remis au plein. » | idem | 1 | fait | à faire |
| N-07 | Sachet garni | Un sachet bonus marqué « garni » dans la réserve, avec au moins une Rare au tirage | garantie de tirage | 1 | fait | à faire |
| N-08 | Carte au choix | Abandonnée le 2026-10-22 : les niveaux 10, 20, 30… donnent un sachet garni (P58), l'écran est retiré | — | 1 | retiré | — |
| N-09 | Réserve agrandie | Le plafond affiché suit (« 3 / 12 bonus ») | portefeuille | 1 | fait | à faire |
| N-10 | Titre, avatar, place épinglée | Rangés dans l'atelier ; le coffret le dit | lot 3 | 3 | fait (place épinglée, avatar, cadre et titre) | à faire |

### A · Album et carte

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| A-01 | En-tête | « Album », « 590 mots sur 1 561 », recherche | `GET /me/cards` | 2 | fait | à faire |
| A-02 | Onglets de collection | Nom, compte, barre de progression à la teinte de la collection | idem | 2 | fait | à faire |
| A-03 | Filtre par rareté | Gemme et « 85/175 » par rareté, bascule | idem | 2 | fait | à faire |
| A-04 | Filtres | Toutes, Doubles, À réviser, Dorure, Manquantes, et les thèmes (P16) | idem | 2 | fait | à faire |
| A-05 | Grille | Cartes possédées avec « ×3 » et point de maîtrise ; emplacements « ? » des manquantes ; tuile « 327 mots à trouver » qui mène à Jouer | idem | 2 | fait | à faire |
| A-06 | Album vide, recherche sans résultat | « Rien de ce côté. Pas pour longtemps. » | — | 2 | fait | à faire |
| A-07 | Fiche d'une carte | Grande carte avec reflets, rareté, fréquence en chiffres (« Un mot imprimé sur 17 milliards. »), maîtrise en trois étapes avec ce qu'il reste, exemplaires et doubles, collection, origine, crédit de la gravure | existe en partie | 2 | fait | à faire |
| A-08 | Actions de la fiche | « Réviser ce mot », « Proposer en échange » (s'il y a un double et le niveau 5), « Épingler », « Partager » | — | 2 | fait | à faire |
| A-09 | Prononciation | Bouton pour entendre le mot, gratuit (P57) ; notation phonétique selon la décision en attente. À l'ouverture, le mot est dit quand la carte se pose (coupé avec le son, O-06) et un bouton le rejoue | fichiers audio du catalogue (D-032) | 2 | fait (notation phonétique affichée à côté de la carte, à confirmer) | à faire |
| A-10 | Partage | Texte selon voix.md (« Talpinette. Introuvable dans les livres d'aujourd'hui. Moi, je l'ai. ») ; feuille de partage native sur mobile ; page publique de la carte et son image | — | 2 | fait (texte et lien vers `/carte/{id}`, dont l'image est générée à la demande par Next ; l'image part aussi en fichier quand le téléphone l'accepte ; copie du texte et du lien sinon) | à faire |

### D · Défis

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| D-01 | Défi du jour | « 5 questions, 3 bonnes », cinq barres de progression, « Commencer le défi », « Continuer le défi », « Reviens demain » | existe | 2 | fait | à faire |
| D-02 | Ta mémoire | Nombre de mots en Esquisse, Encre, Dorure ; une phrase qui explique les seuils | `GET /me/mastery` | 2 | fait | à faire |
| D-03 | Ces mots t'échappent | Les mots dus, avec quand ils reviennent, « Réviser » | `GET /challenges` | 2 | fait | à faire |
| D-04 | Session de questions | Croix pour arrêter, barres de position, « Que veut dire ce mot ? » ou « Quel mot se cache là-dessous ? », quatre choix, retour juste ou raté avec la fréquence ou la bonne réponse | existe | 2 | fait | à faire |
| D-05 | Bilan | « 4/5 », « +60 XP », « Un sachet bonus pour le défi du jour ! » ou « Pas encore de bonus. Le défi du jour court jusqu'à minuit. » (le défi du jour se cumule sur la journée) ; mots passés à l'Encre ou à la Dorure | existe | 2 | fait | à faire |
| D-06 | Rien à réviser | « Tes mots tiennent bon. Le prochain revient dans 3 h. » | — | 2 | fait | à faire |

### E · Échanges

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| E-01 | En-tête | « Échanges », « Ton code K7QP2MXA » à copier | existe | 2 | fait | à faire |
| E-02 | Onglets | Reçues (N), Envoyées (N), Nouvelle offre | existe | 2 | fait | à faire |
| E-03 | Offre reçue | Avatar, pseudo, niveau, « Expire dans 41 h », « Tu reçois », « Tu donnes », « Accepter l'échange », « Refuser » ; toucher une carte ouvre sa fiche | existe | 2 | fait | à faire |
| E-04 | Offres envoyées et historique | « En attente · expire dans 60 h », « Annuler l'offre », historique des échanges, « 10 offres par 24 h. Une offre expire après 72 h. » | existe | 2 | fait | à faire |
| E-05 | Nouvelle offre | Code joueur, joueur trouvé (pseudo, niveau), tes doubles, ses doubles avec « Il te manque », 1 carte par côté avant le niveau 10 et 3 ensuite (P59), Épiques et Légendaires grisées « Échangeable dans 7 j » (P35), « Vérifier l'offre » puis « Envoyer l'offre » | `TRADE_SCHEDULE` (P59), limite revérifiée à l'acceptation | 1 | fait | à faire |
| E-06 | Proposer depuis la fiche d'une carte | Ouvre la nouvelle offre avec la carte déjà choisie | — | 2 | fait | à faire |
| E-07 | Aucune offre | « Personne ne frappe à la porte. Fais le premier pas. » | — | 2 | fait | à faire |

### K · Clans

La maquette ne montre que le clan du joueur. Les écrans K-08 à K-13 ont été dessinés au lot 4 dans le même style, sans maquette préalable.

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| K-01 | En-tête du clan | Emblème (gravure et deux couleurs), nom, membres, mode d'entrée, devise, « Inviter » | `GET /clans/{id}` | 4 | fait | à faire |
| K-02 | Onglets (mobile) | Discussion, Clan, Membres ; le web montre tout sur deux colonnes | — | 4 | — | à faire |
| K-03 | Objectif de la semaine | « 300 mots nouveaux, ensemble », barre avec paliers bronze, argent, or, « reste 3 j », « ta part : 23 », récompense de l'or | `clan_weeks`, recompté par la file (D-038) | 4 | fait (sachets à prendre sur la page et au courrier) | à faire |
| K-04 | Bibliothèque | « À vous tous, il vous manque 42 Caractères. », une barre par collection, ta part en plein et celle du clan en clair | `clan_library`, calcul par la file | 4 | fait | à faire |
| K-05 | Membres | Avatar, en ligne, niveau, vu il y a, rôle (Chef, Adjoint), mots apportés cette semaine ; « Voir les 27 autres » | `GET /clans/{id}/members` | 4 | fait | à faire |
| K-06 | Discussion et journal | Messages et événements du journal mêlés, mes messages à droite en jaune, « Écris au clan », envoi. Écran ouvert : nouveaux messages demandés toutes les quelques secondes, après le dernier reçu | `clan_messages`, curseur | 4 | fait (toutes les 4 s, page visible seulement ; « @ » propose les membres, la mention est surlignée et arrive au courrier du membre cité) | à faire |
| K-07 | Modération par les joueurs | Sur chaque message : Signaler, Bloquer ; un message refusé par le filtre ne part pas (« Pas envoyé : un mot interdit. Reformule. ») ; un joueur bloqué disparaît partout (N5) | `moderation_reports`, `user_blocks` | 4 | fait | à faire |
| K-08 | Trouver un clan | Liste et recherche, filtre par mode d'entrée, « Rejoindre » ou « Demander à entrer » ; entrée par code d'invitation | `GET /clans`, `POST /clans/join` | 4 | fait | à faire |
| K-09 | Créer un clan (niveau 15) | Nom (filtré, N5), emblème, deux couleurs, devise, mode d'entrée | `POST /clans` | 4 | fait | à faire |
| K-10 | Gestion par le chef et les adjoints | Accepter les demandes, exclure, nommer un adjoint, supprimer un message, rendre muet pour une durée | routes `/clans/{id}/…` | 4 | fait (aussi : passer la tête du clan, changer le clan, nouveau code) | à faire |
| K-11 | Quitter le clan | Avec la conséquence dans le bouton ; attente de 24 h avant d'en rejoindre un autre | `POST /me/clan/leave` | 4 | fait | à faire |
| K-12 | Sans clan | Onglet Clan au niveau 10 sans clan : l'écran « Trouver un clan » ; avant le niveau 10, l'écran fermé (C-06) | — | 4 | fait | à faire |
| K-13 | Discussion depuis Jouer | Le bouton flottant ouvre la discussion dans un panneau ou une fiche | — | 4 | fait | à faire |

### P · Profil et atelier

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| P-01 | En-tête du profil | Bannière, grand avatar avec son cadre, pseudo, titre, niveau, clan, code joueur, membre depuis, « Atelier », « Partager » | `GET /players/{pseudo}` | 3 | fait | à faire |
| P-02 | Cartes épinglées | 3 à 6 places (P58), place vide qui mène à l'album | `PUT /me/pinned-cards` | 3 | fait | à faire |
| P-03 | En chiffres | Mots sur 1 561, Légendaires, mots dorés, échanges conclus, collections complètes, jours de jeu | calcul à la lecture | 3 | fait | à faire |
| P-04 | Profil avant le niveau 8 | « Ton profil devient public au niveau 8. D'ici là, toi seul le vois. » | P59 | 3 | fait | à faire |
| P-05 | Profil d'un autre joueur | Même page sans les actions personnelles, avec « Proposer un échange » et « Signaler » | idem | 3 | fait (« Signaler le pseudo » et « Bloquer », compte inscrit) | à faire |
| P-06 | Page publique partageable | `/joueur/{pseudo}` rendue par le serveur, image de partage | idem | 3 | fait (image de partage générée à la demande par Next, sans la file) | — |
| P-07 | Atelier | Onglets Avatars gravés, Dos de carte, Cadres, Titres ; chaque objet : porté, à mettre, « Niveau 20 », ou réservé au mécène | `PATCH /me/profile` | 3 | fait (avatars, cadres, titres ; pas de mécène ; l'onglet Dos de carte est à trancher : le dos est fixe, teinté par collection) | à faire |
| P-08 | Pseudo | Choix et changement (une fois par mois), filtré (N5) | idem | 3 | fait (P62) | à faire |

### R · Réglages, courrier, compte

| ID | Élément | Ce qu'il faut | Serveur | Lot | Web | Mobile |
|---|---|---|---|---|---|---|
| R-01 | Courrier | Liste : offre reçue, coffret à ouvrir, mot qui s'échappe, objectif de clan, offre acceptée ; non lus surlignés ; chaque ligne mène à son écran | lettres écrites par la file (D-039) | 3 | fait (« À faire » tiré de l'état : coffrets, sachets d'objectif, mot qui s'échappe ; « Nouvelles » écrites par la file : offre reçue, acceptée, refusée, citation dans le clan, demande d'entrée ; la pastille compte l'à faire et les lettres non lues, pas les mots qui s'échappent) | à faire |
| R-02 | Notifications push | Mots qui s'échappent, offres, mentions dans le clan ; demande d'autorisation au bon moment, pas au lancement | file, Expo push | 3 | — | à faire |
| R-03 | Réglages · Jeu | Son, Vibration | local | 1 | fait | à faire |
| R-04 | Réglages · Notifications | Mots qui s'échappent, Offres d'échange, Discussion du clan (seulement quand on te cite) | serveur | 3 | fait (préférences gardées, lues par les notifications push à venir ; le courrier reçoit tout) | à faire |
| R-05 | Réglages · Profil | Profil public, Pseudo, Joueurs bloqués (et débloquer) | serveur | 3 | fait | à faire |
| R-06 | Réglages · Compte | Adresse e-mail, Tes données, Me déconnecter ; l'inscription de l'invité (écran `/compte` existant) | existe en partie | 1 | fait | à faire |
| R-07 | Supprimer mon compte | Dans l'app, exigé par l'App Store ; conséquence dans le bouton | à faire | 3 | fait (P64) | à faire |
| R-08 | Sanction et contestation | Message motivé d'une sanction, voie de contestation (DSA, N5) | `/me/sanctions`, `/admin/reports`, `/admin/contests` | 4 | fait (fenêtre sur tout écran, contestation relue dans `/admin/contestations`) | à faire |
| R-09 | Contact et mentions | contact@leximon.fr, crédits (Littré, Ngram, gravures), conditions d'utilisation, charte de la discussion | — | 3 | fait (`/mentions` avec l'éditeur et l'hébergeur, `/conditions`, `/charte`, acceptées à l'inscription ; textes à faire relire par un juriste) | à faire |

### X · Propositions

Marquées « Proposition » dans la maquette. Aucune n'entre dans un lot sans décision du propriétaire.

| ID | Élément | Ce qu'il faut | Dépend de |
|---|---|---|---|
| X-01 | Liste de souhaits | « Je cherche » sur le profil ; « Ils cherchent tes doubles » dans les échanges, avec « Proposer » | profil public (lot 3) |
| X-02 | Joutes | Partie à deux sur 5 mots choisis, 24 h par tour ; duplicate de la semaine classé au pourcentage du meilleur, sans classement | R&D des modes de jeu (P52) |
| X-03 | Mécène | Abonnement au contenu connu à l'avance (un dos et un cadre par mois, statistiques, album hors ligne, avatars), jamais de sachet (N1, N2) ; prix à décider | décision « Abonnement premium » |

### T · Transverse

| ID | Élément | Ce qu'il faut | Lot |
|---|---|---|---|
| T-01 | États | Chargement, vide, erreur, hors ligne, pour chaque écran de l'inventaire | chaque lot |
| T-02 | Accessibilité | Contrastes, cibles de 44 px, clavier, lecteur d'écran, texte agrandi, mouvements réduits | chaque lot |
| T-03 | Textes | Une seule source dans `view-model`, relus selon voix.md | chaque lot |
| T-04 | Mobile hors ligne | Catalogue en cache, album lisible sans réseau, actions refusées proprement | 5 |
| T-05 | Liens profonds | Ouvrir un profil, une invitation de clan, une offre depuis un lien ou une notification | 3, 4, 5 |
| T-06 | Mesure | Budget de l'ouverture, poids du premier chargement web | chaque lot |

## Lots

Web d'abord, décidé par le propriétaire le 2026-10-21. Le mobile reprend ensuite chaque écran sur la même logique d'écran.

| Lot | Contenu | Prérequis |
|---|---|---|
| 0 | Ce cahier, P58 et P59, D-033, squelette de `packages/view-model`, composants de base du web (fait) | — |
| 1 | Coque web, écran Jouer, chemin des niveaux et coffrets, toutes les récompenses de P58 sauf les cosmétiques, fonctionnalités par niveau (P59) côté serveur et web, échanges à 1 puis 3 cartes (web fait le 2026-10-21 ; clans et joutes affichent un écran « pas encore construit » une fois le niveau atteint) | — |
| 2 | Album, fiche de carte, défis et échanges repris sur la maquette ; prononciation dès que les fichiers audio sont publiés | lot 1 |
| 3 | Profil public, atelier et cosmétiques, réglages complets, courrier, suppression du compte (web fait le 2026-10-21, courrier par la file le 2026-10-22 (D-039) ; notifications push avec le mobile ; image de partage générée à la demande ; conditions d'utilisation et charte écrites, à faire relire par un juriste) | inscription (fournisseur d'e-mails), file de tâches (D-005) |
| 4 | Clans complets avec modération, outil de traitement des signalements dans `/admin` | lot 3, conditions d'utilisation et charte |
| 5 | Mobile : base Expo (polices, onglets, fiches, gestes, push), puis tous les écrans dans l'ordre des lots 1 à 4 | lots 1 à 4 pour chaque écran |
| 6 | Propositions retenues (X-01 à X-03) | décisions du propriétaire |

Chaque lot se termine par la mise à jour des statuts ci-dessus et de la [feuille de route](../feuille-de-route.md).

## Décisions

Toutes prises par le propriétaire le 2026-10-21 :

- maquette validée, logique d'écran commune (D-033), web d'abord ;
- récompenses de niveau (P58) et fonctionnalités par niveau (P59) ;
- sous 760 px, le web reprend la coque mobile (C-08) ;
- discussion de clan de la v1 par interrogation de l'API, écran ouvert seulement, sans attendre la R&D D-007 (K-06) ;
- profil public par défaut (P60) ;
- thèmes dans les filtres de l'album dès le lot 2 (A-04).
