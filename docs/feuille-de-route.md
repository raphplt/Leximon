# Feuille de route

Où en est Leximon, ce qui reste avant la bêta publique (début décembre 2026 visé, janvier en repli) et ce qui attend une décision du propriétaire. Mise à jour à chaque étape franchie.

**Dernière mise à jour :** 2026-11-01.

**Le prochain grand chantier :** les retours du game designer et la refonte de la direction artistique, arbitrés le 2026-11-01. L'ordre est dans [retours-game-designer.md](cahiers-des-charges/retours-game-designer.md) : six corrections immédiates, puis la direction artistique ([direction-artistique.md](cahiers-des-charges/direction-artistique.md)), puis lisibilité, économie, social et duel. Les six corrections sont faites (2026-11-01), pas encore en ligne. La direction « Le Livre » a été construite derrière le réglage, puis refusée sur ses planches le 2026-11-02 (« ça ne fait pas jeu vidéo, ça fait site web ») ; le propriétaire a choisi le même jour « La Bibliothèque » (D-056), sur la maquette `rnd/da-jeu/bibliotheque.html`. La phase 1 (le socle : Le Livre retiré, salle, objets, particules, pièces de Jouer sur `/planches`) est faite le 2026-11-02 et jugée fluide sur le téléphone du propriétaire ; les effets de Commune et de Légendaire, jugés « cheap », ont été repris le même jour et validés. L'écran Jouer, l'ouverture et le bilan, puis l'album, la fiche de carte et les défis, puis l'énigme, les niveaux, les coffrets, le compte et les réglages, sont faits dans le vrai jeu, derrière le réglage, le 2026-11-02, sur le web et le mobile ensemble : la phase 2 attend la semaine de jeu du propriétaire.

## En une phrase

Le cœur du jeu tourne de bout en bout sur le web : on ouvre un sachet, on révèle ses cartes, on les retrouve dans l'album, on les fait monter de niveau par des défis (le mot écrit de tête pour monter) qui rapportent des sachets bonus, on les échange, on les épingle sur son profil public et on joue en clan. Le catalogue de lancement compte 1 561 cartes en trois collections, toutes gravées et prononcées. Le site est en ligne sur leximon.fr depuis le 2026-10-22, porte fermée : personne n'entre sans lien d'invitation ; les premiers liens sont partis le 2026-10-25. Le mobile porte presque tout le jeu sur Android (Jouer, album, défis, échanges, clan, amis, courrier, profil, réglages) ; restent les liens universels et la première publication sur les stores.

## État par chantier

Statuts : **Fait**, **En cours**, **À faire**, **À décider** (attend le propriétaire), **R&D** (pistes à explorer avant de choisir), **Plus tard**.

### Contenu des cartes

| Étape | Statut | Détail |
|---|---|---|
| Choix des mots et calcul de la rareté | Fait | D-020 : fréquence Google Ngram, environ 28 000 candidats dans le Littré |
| Rédaction et contrôle automatique | Fait | D-019, D-021 : lot-1 de 300 mots, 178 cartes gardées, 10 % à relire |
| Publication du catalogue | Fait | D-023 : `release` puis `pnpm catalog:publish`. Dernière version : 2026-10-26.1 (lignes des collections réécrites) |
| Collections de lancement | Fait | D-024 : Les Fondateurs (519), Caractères et travers (539), Métiers et objets disparus (503), pour 20,68 $ de génération. Les 143 cartes signalées ont été pré-relues par Claude, et 358 définitions qui donnaient le mot ont été reformulées (P41) ; chaque carte touchée porte une note dans Directus |
| Gravures | Fait | D-028, P42-P43. Les 1 561 cartes ont la leur depuis la version 2026-10-21.6 : 1 541 gravures, et 20 lettrines ornées (initiales Rabelais de Marty-Laveaux, 1868) pour les mots restés sans image. Chaque collection a la gravure de son sceau (P74, version 2026-10-23.1) |
| Prononciation | Fait | D-032, P57 : une voix de synthèse guidée par la notation du Littré, sur toutes les cartes depuis la version 2026-10-21.5 |
| Collections suivantes | À faire | P56 : onze collections prévues (Bêtes et plantes, À table !, Habits et parures…), environ 2 à 3 $ de génération pour 300 cartes, chacune avec l'accord du propriétaire. Le rayon tournant (P69) devient nécessaire à la cinquième |
| Expressions | Plus tard | Après le lancement (P13) |

### Règles et serveur

| Étape | Statut | Détail |
|---|---|---|
| Compte invité, stock de sachets, tirage, garanties | Fait | D-006, D-016, D-017, P10 à P12. Une carte au plus une fois par sachet |
| Collection du joueur | Fait | `GET /me/cards` |
| Défis et niveaux de maîtrise | Fait | D-025, D-046 : FSRS (ts-fsrs) choisit quand un mot revient ; un niveau se gagne sur une rétention prouvée (bonne réponse 7 jours, puis 30 jours après la révision précédente), par le mot écrit de tête (P32, P33). Le reste du temps, QCM d'entretien. La définition cache la famille du mot à trouver, préfixes compris. Progression, sons et réactions sur le web et le mobile ([defis-progression-et-sensation.md](cahiers-des-charges/defis-progression-et-sensation.md), 2026-10-29) |
| Révisions choisies | Fait, mobile à recetter | P81, [cahier](cahiers-des-charges/revisions-et-modes-de-jeu.md) : séries sur une collection, un thème, ses mots ratés ou récents, un filtre de l'album. Suite du cahier : contre la montre, citation à trous, joutes |
| Énigme du jour | Fait | P82, [cahier](cahiers-des-charges/revisions-et-modes-de-jeu.md) : un mot par jour, sept essais, résultat partageable et page publique, sur le web et le mobile. Pas encore d'écran d'admin pour remplacer le mot d'un jour |
| Sachets bonus des défis | Fait | D-027, règles P23 et P29 : défi du jour et Dorure, réserve plafonnée à 10 |
| Échanges carte contre carte | Fait | D-026 : offres directes par code joueur, doublons seulement, ouverts au niveau 5 sans condition d'ancienneté |
| Inscription par code e-mail | En cours | D-030, P37, P54 : code à 6 chiffres, invité limité à 2 sachets avant de créer un compte, transfert de la partie invitée vers un nouveau compte, écran `/compte`. Codes plafonnés par adresse, refusés aux domaines morts et aux adresses que la bêta refuserait. `mail.leximon.fr` enregistré chez Cloudflare Email Service (D-034). Reste : vérifier l'envoi en production, la hausse du quota, puis Apple et Google |
| E-mails de campagne | Fait (pas en ligne) | Cahier : [e-mails.md](cahiers-des-charges/e-mails.md). D-034 à D-036, D-044, P55, P61 : campagnes dans `/admin/campagnes`, envoi par Lettermint via une file Queues, désinscription en un clic, webhooks signés, liste d'opposition, consentement des joueurs. La pompe se relance par la file, sans tâche chaque minute, pour laisser Neon se mettre en veille. Reste : compte Lettermint et ses DNS sur `infos.leximon.fr`, secrets de production |
| E-mails sur la partie | Fait, en ligne | D-050, P80 : « lettres en attente » 30 min après une lettre si le joueur n'est pas revenu, « sachets pleins » à 18 h après 1, 3, 7, 14 et 30 jours d'absence. Un de chaque sorte par jour, rien la nuit, plafond quotidien global, désinscription en un clic, réglages sur le web et le mobile. `avis.leximon.fr` enregistré dans Email Service, envoi vérifié en production le 2026-10-26 |
| Administration | Fait | D-031 : `/admin` (tableau de bord, joueurs, échanges, signalements et sanctions, contestations, cartes, collections, campagnes, invitations et liste d'attente en deux onglets (bouton qui invite les plus anciens ou une sélection : un lien à une place par adresse, envoyé en campagne), mesure, e-mails envoyés face au quota Cloudflare, retours, journal ; migration `0029` pour compter les codes de connexion, sans leur adresse ; `0030` pour les adresses invitées). Rôle donné par `pnpm admin:grant <email>` ; le menu du joueur mène un admin au back-office |
| Maintenance et données | Fait | Chaque nuit : sessions expirées, invités abandonnés et vieux signalements effacés (dit sur `/confidentialite`) |

### Progression et social

Arbitrés par le propriétaire le 2026-10-20 : jeu grand public (B2C), pas de version école prévue. Cible du lancement : les 18–30 ans connectés (P71). Cahier des charges : [progression-et-social.md](cahiers-des-charges/progression-et-social.md).

| Étape | Statut | Détail |
|---|---|---|
| Niveau de compte | Fait | P48, P58, P59 : XP gagnée dans la transaction de chaque action, courbe 150 + 45 × (n − 1) sans maximum, niveau 50 visé en quatre mois environ. Coffrets réclamés, sachet garni tous les 10 niveaux, jamais de recharge du stock en récompense, échanges à 3 cartes au niveau 10. Raretés complétées (100 à 1 000 XP, par sachet ou échange, dites dans le bilan du sachet), titres jusqu'au 135 et dix cadres de plus jusqu'au 150 (2026-10-26, noms provisoires). Les cadres Or vif, Irisé et Soleil royal tournent sur le web, pas sur le mobile |
| Profil public | Fait sur le web | Pseudo (P62), avatar gravé et cadre, titre, cartes épinglées (choisies, rangées et remplacées depuis le profil), statistiques, clan, page publique `/joueur/{pseudo}` avec image de partage, atelier, bloquer et signaler (P63), suppression du compte (P64). Public par défaut (P60), dès le niveau 8 |
| Clans | Fait sur le web et le mobile | P65 à P68 et P70 (Clan v2, [clan-v2.md](cahiers-des-charges/clan-v2.md)) : sans maximum de membres, emblème, rôles, demandes et code d'invitation, discussion et devises filtrées (ni lien, ni adresse, ni téléphone, ni caractère invisible) et modérées, objectif de la semaine en bonnes réponses de défi, niveau de clan cosmétique (objets d'emblème, Enluminure, bannières), bibliothèque commune, courrier et mentions. On peut rejoindre un autre clan dès qu'on en part. Reste : la modération par modèle |
| Amis | Fait sur le web et le mobile, en ligne | P75 à P79, cahier [amis.md](cahiers-des-charges/amis.md) : demande acceptée des deux côtés (par pseudo exact, depuis un profil ou par le lien d'ami), écran `/amis` (demandes, lien, liste, retrait), profil entier entre amis, lien `/ami/<code>` qui fait entrer 3 joueurs dans la bêta fermée et rend amis à la création du compte, sachet bonus pour les deux au niveau 5 du filleul (5 par mois), échanges possibles par ami et doubles qui lui manquent mis en avant dans l'offre, albums comparés (`/album?ami=<code>`), podium de la semaine sans récompense, fil des trouvailles avec réactions prédéfinies, lettres du courrier. Migration `0026`. Les joueurs venus par un lien d'ami forment la source « Lien d'ami » de la mesure. Reste : le nombre de filleuls par parrain dans la mesure |
| Communauté | Liste et pages de clans en ligne ; onglet et tris faits, pas encore en ligne | P83, D-054 : l'onglet Clan devient Communauté (Mon clan, Amis, Joueurs, Clans), liste de joueurs en lignes avec les mots de leurs cartes épinglées, tris et filtre Sans clan, menu du joueur réduit à 6 entrées. Migration `0034`. Mon clan et Amis repris le 2026-10-31 (page plus large, liste, fil par jour), et Niveaux passe du plateau à une table des matières sur le web, pas encore en ligne. Le mobile suivra pendant la refonte. Reste : la recette MCL-03 sur un vrai téléphone |
| Social plus tôt | À faire | Tranché le 2026-11-01 (P50, P59, P77) : profil public et rejoindre un clan au niveau 5, créer un clan au 10, doubles visibles, échanges suggérés, liste de souhaits. Phase 6 du cahier |
| Duel en direct | R&D | P91, tranché le 2026-11-01 : en direct, fantôme après 20 s, niveau 8, sans mise. Attend la R&D temps réel (D-007), puis un prototype. Autres pistes (duplicate, bluff…) après lui. Phase 7 |
| Classements | Plus tard | Pas en v1. Cote globale de type Elo (Glicko-2), modèle du Scrabble duplicate |

### Modèle économique

| Étape | Statut | Détail |
|---|---|---|
| Abonnement Mécène | À faire | P72, P73 : tout le jeu gratuit, une offre Mécène au contenu dévoilé le 1er du mois, dont « ton mot dans le jeu ». Fausse porte sur `/mecene`, mesurée dans `/admin/mesure`. Le paiement n'est pas construit, et attend les chiffres de la bêta |
| Économie du jeu | À faire | P84 à P90, tranchés le 2026-11-01 : écus, recyclage en un bouton, mot manquant, tampons, série qui pardonne, 40 succès, codes. Étude : [rnd/doublons.md](rnd/doublons.md). Phase 5 du cahier |

### Interface

| Étape | Statut | Détail |
|---|---|---|
| Interface v1, web et mobile | En cours | Inventaire de chaque écran : [interface-v1.md](cahiers-des-charges/interface-v1.md). Logique d'écran commune dans `packages/view-model` (D-033). Lots 0 à 4 faits sur le web, retours de la première recette traités ([recette-web.md](recette-web.md#retours-du-2026-10-22)). Jouer revenu le 2026-10-23 au bandeau du niveau et aux boutons ronds autour d'un sachet plus petit, les sachets des autres collections derrière le comptoir. Les écrans entrent en fondu et attendent leurs données sous la forme de leur contenu, sans saut de mise en page ; un écran dont le chargement échoue propose de réessayer. Le mobile suit, écran par écran |
| Direction artistique et tokens | Fait, à remplacer | D-022 « Planche populaire », `packages/tokens`, logo et favicon |
| Refonte « La Bibliothèque » | En cours, priorité : phase 1 faite, phase 2 faite (web validé par le propriétaire, premières reprises du mobile faites), phase 3 commencée (échanges faits) | D-056 : salle de lecture, objets en cuir et or qui s'enfoncent et rebondissent, lecture sur feuilles, une seule allure, sur tout le web et le mobile, bascule unique. Phases 1 à 3, [cahier](cahiers-des-charges/direction-artistique.md) |
| Retours du game designer | Phase 0 faite, le reste à faire | [Cahier](cahiers-des-charges/retours-game-designer.md) : six corrections immédiates (phase 0, session de 90 jours comprise), récompenses lisibles et album alphabétique (phase 4) |
| Web : page d'accueil publique | Fait | P55 : accueil sur `/`, le jeu sous `/jouer`, connexion depuis l'accueil, lien vers le Discord du projet. Liste d'attente, image de partage, pages `/confidentialite`, `/mentions`, `/conditions`, `/charte`, 404 et page d'erreur en français. Nouveautés : une fenêtre à l'arrivée pour chaque changement (web et mobile) et la page `/nouveautes` (2026-10-29). Reste : la relecture des textes par un juriste |
| Mobile (Expo) | En cours, jouable de bout en bout sur Android | D-048 : client API partagé (`@leximon/contract/client`), session gardée dans le trousseau par `@better-auth/expo`. Coque (bandeau du haut, onglets avec Jouer en relief, cadenas), polices embarquées, icône et écran de lancement. Jouer : choix de la collection, sachet dessiné comme celui du web (mêmes couches, balancement, lumière, ombre, envol de la bande et cartes qui sortent, attente grisée), déchirure au doigt (la requête part dès le début du geste), mise en scène par rareté, récapitulatif, boutons ronds (clan, discussion, défi du jour, amis, coffrets). Sons, mot dit à voix haute et vibrations du web (D-049), réglables. Reflets des cartes du web sur la carte révélée et la fiche, éclat des Rares dans le bilan ; la lumière suit le doigt et l'inclinaison du téléphone (D-051). Album (filtres, recherche, albums comparés avec un ami), fiche de carte (épingler), défis (révision, mot écrit, plis bonus), échanges, clan (discussion, objectif, gestion), amis (podium, fil, réactions, lien d'ami), courrier, chemin des niveaux et coffrets, profil, atelier, profils publics (signaler, bloquer), réglages (notifications, joueurs bloqués, suppression du compte), avis de sanction avec contestation, « Un retour ? » et « Signaler une erreur » sur la fiche de carte. Encre en dégradé des gravures Épique et Légendaire. Compte et portes de la bêta par le schéma `leximon://`. Version minimale imposée : `MOBILE_MIN_VERSION` côté API (`GET /app`), écran « Leximon a changé » en dessous. Reste : copie du lien d'ami (`expo-clipboard`), liens universels `https://leximon.fr/…` (identifiant d'équipe Apple et empreinte de la clé Android), adresse App Store (`ios.appStoreUrl`), page Mécène (prix d'abonnement hors achat intégré : à trancher avant iOS), joutes (pas construites), recette sur iPhone |
| Animations et reflets | Fait | Sur le web, du CSS. Sur le mobile (2026-10-25), les mêmes couches en SVG animé avec les modes de fusion natifs, sans dépendance nouvelle ; la lumière suit le doigt et l'inclinaison du téléphone (D-051, 2026-10-27). Allégées sur Android le 2026-10-30 : couches de reflet en demi-taille, lumière par paliers, animations en pause hors de l'écran. Clore ou non la R&D D-009 reste à trancher |
| Ouverture : peaufinage | Fait sur le web | Cahier : [ouverture.md](cahiers-des-charges/ouverture.md). Déchirure au doigt, pile, mise en scène par rareté, sons synthétisés, vibration, récapitulatif, reflets par rareté, sachet bombé au sceau doré, mot dit quand la carte se pose, aperçu en glissant. Récapitulatif lisible en cascade, fiche au toucher (2026-10-23). Sur le mobile : sachet du web, déchirure au doigt, pile et aperçu en glissant, mise en scène par rareté, sons, mot dit, vibration, récapitulatif, reflets |
| Retours du premier testeur | Fait | Cahier : [retours-premier-testeur.md](cahiers-des-charges/retours-premier-testeur.md), validé le 2026-10-23. Les cinq lots faits le 2026-10-23 (relire ce qu'on vient d'ouvrir, « Nouveau » dans l'album, mot qui s'échappe, signaux de Jouer, collections et raretés). La migration `0025` et le catalogue `2026-10-23.2` (lignes des collections) sont en production |
| Ouverture : forme du paquet | Fait | Le sachet (P47, P53), un par collection. Le pli reste à l'essai (`/jouer?paquet=pli`) |
| Numéro de collection sur la carte | À décider | Par exemple « 040/160 ». Dénominateur à choisir (taille annoncée ou cartes publiées) |

### Mise en ligne

| Étape | Statut | Détail |
|---|---|---|
| Hébergement de production | En cours | En ligne depuis le 2026-10-22 : `leximon.fr` et `api.leximon.fr`, base sur le serveur maison depuis le 2026-10-30 (D-053), catalogue servi par le Worker web (D-043). Mise en production en une commande (`pnpm deploy:prod`). En-têtes de sécurité, préflights CORS en cache, première visite allégée (ni catalogue sur l'accueil, ni dans la coque du jeu). Procédure : [mise-en-ligne.md](mise-en-ligne.md). Sauvegarde chaque heure sur R2 et chaque nuit sur le disque `tank`, restauration vérifiée, alerte Discord si la base ou les sauvegardes s'arrêtent. Codes de connexion vérifiés en production. `www` redirigé vers `leximon.fr` (2026-10-26). Reste : hausse du quota d'envoi des codes, Lettermint |
| Bêta fermée sur invitation | En ligne, premiers liens envoyés (2026-10-25) | D-041 : liens par groupe dans `/admin/invitations`, page `/invitation/<code>`, porte tenue par l'API (`BETA_INVITES`), `?src=` gardé avec le joueur. Une invitation rejouée par un invité ne rouvre plus la porte |
| Mesure | En ligne | D-042 et D-052 : `/admin/mesure`, tableau de bord sur une période choisie (7, 30, 90 jours, depuis le début ou dates libres, gardée dans l'adresse) comparée à la période d'avant : chiffres clés avec tendance, activité par jour, entonnoir, courbe de rétention, cohortes par jour ou semaine, origine et âge, heures de jeu, fausse porte mécène, testeurs, `/admin/retours` (« Un retour ? » dans le menu, « Signaler une erreur » sur la fiche de carte, avec un lien vers la carte), tranche d'âge facultative à l'inscription. Visites du site par Umami (sans cookie, codes des liens masqués, refus sur « Tes données ») et `robots.txt`, `sitemap.xml` (pages publiques et toutes les cartes, ouvertes aux moteurs de recherche) pour Search Console. Umami installé sur le serveur maison et publié sur `stats.leximon.fr` le 2026-10-28. Reste : déployer le web, Search Console ([mise-en-ligne.md](mise-en-ligne.md), étape 12 bis) |
| Suivi des erreurs | Fait | D-045 : erreurs relevées par Cloudflare (Workers Logs), résumé chaque matin sur Discord avec les chiffres de la veille. Pas de suivi des erreurs du navigateur |
| Test de charge | Fait (pas en ligne) | D-047 : scénarios k6 dans `infra/load/`, staging sur une branche Neon ([rnd/charge.md](rnd/charge.md)). 572 requêtes/s sans une erreur (2026-10-23). Ouverture d'un sachet ramenée de 8 à 5 allers-retours SQL et cache de session réparé (il ne servait pas) : 37 ms en médiane et 72 ms au p95 côté serveur (2026-10-24). API placée à Paris depuis que la base est sur le serveur maison (D-053). En production |
| Marque, domaines, comptes réseaux | En cours | Domaine leximon.fr (OVH, DNS chez Cloudflare, renouvellement automatique à activer), contact@leximon.fr routé par Cloudflare, Discord du projet. Marque : dépôt INPI repoussé (P7). Autres comptes réseaux à faire |

## Avant la bêta ouverte

La bêta reste fermée jusqu'à ce que le jeu soit prêt (décidé le 2026-11-01) : début décembre visé, janvier en repli. On ouvre quand tout ceci est fait :

1. **Codes de connexion :** quota d'Email Service relevé ([mise-en-ligne.md](mise-en-ligne.md), étape 12). Sans lui, une vague d'inscriptions bloque les connexions.
2. **Liste d'attente prévenue :** Lettermint prêt (étape 12), pour tenir la promesse de P55.
3. **Stores :** publication manuelle sur l'App Store et Google Play. Tant que la porte est fermée, l'app refuse tout nouveau joueur sans lien : elle sort le jour de l'ouverture, pas avant.
4. **Mesure de l'arrivée :** Umami et Search Console installés (étape 12 bis), pour lire les sources dès le premier jour.
5. **La nouvelle direction artistique en ligne :** phases 0 à 3 finies, sur le web et sur les stores.
6. **Rétention :** les objectifs de 35 % à J1 et de 12 % à J7 tenus par les joueurs arrivés après la bascule. Sinon, l'économie (phase 5) passe avant l'ouverture.

Le jour de l'ouverture : `BETA_INVITES` à `"off"` dans `env.production` de `apps/api/wrangler.jsonc`, puis `pnpm deploy:prod` ; publier les deux apps ; envoyer la campagne à la liste d'attente.

## Ce qui attend ta décision

Dans l'ordre où elles débloquent le plus :

1. **Bêta ouverte :** les préalables ci-dessus, d'abord la hausse du quota d'envoi des codes.
2. **Avatars gravés (P49) :** valider les seize gravures choisies et leurs noms.
3. **Mécène (P73) :** l'exemplaire de la carte dénichée, non échangeable et sans XP, reste à confirmer.
4. **Questions ouvertes** de [regles-du-jeu.md](regles-du-jeu.md#à-décider) : numéro de collection, sons de l'ouverture, notation phonétique, forme du paquet.
5. **Réécriture des textes :** donner dix phrases aimées et dix phrases détestées, avant la phase 3.
6. **Choix sur pièces de la refonte :** [la liste du cahier](cahiers-des-charges/retours-game-designer.md#ce-qui-reste-à-décider-et-quand), avec le moment de chacun.

## Prochaines étapes conseillées

1. Mettre la phase 0 en ligne et la recetter sur un téléphone : vérifiée dans le navigateur, seulement typée côté mobile.
2. Direction artistique « La Bibliothèque » : le propriétaire joue une semaine dans les écrans de la phase 2, sur le web et sur téléphone, derrière le réglage ; ensuite la phase 3 (le reste des écrans, hors du jeu, textes, bascule).
3. Suivre `/admin/mesure` et `/admin/retours` à mesure que les invités arrivent ; vérifier `cf-placement: local-CDG` et le p95 de l'ouverture dans le résumé Discord ([rnd/charge.md](rnd/charge.md)).
4. Le mobile : recette complète sur Android et iPhone ([recette-mobile.md](recette-mobile.md)). Avant la première publication sur les stores : un compte de démonstration pour l'examen (la connexion par code l'empêche), les captures et l'image de présentation dans la nouvelle allure, l'adresse App Store et les liens universels. Les textes et réponses sont prêts ([fiches-stores.md](fiches-stores.md)), premier build de production Android le 2026-10-27.
5. La quatrième collection, après la bascule.
