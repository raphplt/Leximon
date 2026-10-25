# Feuille de route

Où en est Leximon, ce qui reste avant la bêta publique (novembre 2026) et ce qui attend une décision du propriétaire. Mise à jour à chaque étape franchie.

**Dernière mise à jour :** 2026-10-25.

## En une phrase

Le cœur du jeu tourne de bout en bout sur le web : on ouvre un sachet, on révèle ses cartes, on les retrouve dans l'album, on les fait monter de niveau par des défis (le mot écrit de tête pour monter) qui rapportent des sachets bonus, on les échange, on les épingle sur son profil public et on joue en clan. Le catalogue de lancement compte 1 561 cartes en trois collections, toutes gravées et prononcées. Le site est en ligne sur leximon.fr depuis le 2026-10-22, porte fermée : personne n'entre sans lien d'invitation ; les premiers liens sont partis le 2026-10-25. Le mobile porte presque tout le jeu sur Android (Jouer, album, défis, échanges, clan, amis, courrier, profil, réglages) ; restent les liens universels et la première publication sur les stores.

## État par chantier

Statuts : **Fait**, **En cours**, **À faire**, **À décider** (attend le propriétaire), **R&D** (pistes à explorer avant de choisir), **Plus tard**.

### Contenu des cartes

| Étape | Statut | Détail |
|---|---|---|
| Choix des mots et calcul de la rareté | Fait | D-020 : fréquence Google Ngram, environ 28 000 candidats dans le Littré |
| Rédaction et contrôle automatique | Fait | D-019, D-021 : lot-1 de 300 mots, 178 cartes gardées, 10 % à relire |
| Publication du catalogue | Fait | D-023 : `release` puis `pnpm catalog:publish`. Version en ligne : 2026-10-23.1 |
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
| Défis et niveaux de maîtrise | Fait | D-025, D-046 : FSRS (ts-fsrs) choisit quand un mot revient ; un niveau se gagne sur une rétention prouvée (bonne réponse 7 jours, puis 30 jours après la révision précédente), par le mot écrit de tête (P32, P33). Le reste du temps, QCM d'entretien. La définition cache la famille du mot à trouver |
| Sachets bonus des défis | Fait | D-027, règles P23 et P29 : défi du jour et Dorure, réserve plafonnée à 10 |
| Échanges carte contre carte | Fait | D-026 : offres directes par code joueur, doublons seulement, ouverts au niveau 5 sans condition d'ancienneté |
| Inscription par code e-mail | En cours | D-030, P37, P54 : code à 6 chiffres, invité limité à 2 sachets avant de créer un compte, transfert de la partie invitée vers un nouveau compte, écran `/compte`. Codes plafonnés par adresse, refusés aux domaines morts et aux adresses que la bêta refuserait. `mail.leximon.fr` enregistré chez Cloudflare Email Service (D-034). Reste : vérifier l'envoi en production, la hausse du quota, puis Apple et Google |
| E-mails de campagne | Fait (pas en ligne) | Cahier : [e-mails.md](cahiers-des-charges/e-mails.md). D-034 à D-036, D-044, P55, P61 : campagnes dans `/admin/campagnes`, envoi par Lettermint via une file Queues, désinscription en un clic, webhooks signés, liste d'opposition, consentement des joueurs. La pompe se relance par la file, sans tâche chaque minute, pour laisser Neon se mettre en veille. Reste : compte Lettermint et ses DNS sur `infos.leximon.fr`, secrets de production |
| Administration | Fait | D-031 : `/admin` (tableau de bord, joueurs, liste d'attente, échanges, signalements et sanctions, contestations, cartes, collections, campagnes, invitations, mesure, retours, journal). Rôle donné par `pnpm admin:grant <email>` ; le menu du joueur mène un admin au back-office |
| Maintenance et données | Fait | Chaque nuit : sessions expirées, invités abandonnés et vieux signalements effacés (dit sur `/confidentialite`) |

### Progression et social

Arbitrés par le propriétaire le 2026-10-20 : jeu grand public (B2C), pas de version école prévue. Cible du lancement : les 18–30 ans connectés (P71). Cahier des charges : [progression-et-social.md](cahiers-des-charges/progression-et-social.md).

| Étape | Statut | Détail |
|---|---|---|
| Niveau de compte | En cours | P48, P58, P59 : XP gagnée dans la transaction de chaque action, courbe 150 + 45 × (n − 1) sans maximum, niveau 50 visé en quatre mois environ. Coffrets réclamés, sachet garni tous les 10 niveaux, jamais de recharge du stock en récompense, échanges à 3 cartes au niveau 10. Reste : XP des raretés complétées, cadres et titres des hauts niveaux à dessiner |
| Profil public | Fait sur le web | Pseudo (P62), avatar gravé et cadre, titre, cartes épinglées (choisies, rangées et remplacées depuis le profil), statistiques, clan, page publique `/joueur/{pseudo}` avec image de partage, atelier, bloquer et signaler (P63), suppression du compte (P64). Public par défaut (P60), dès le niveau 8 |
| Clans | Fait sur le web et le mobile | P65 à P68 et P70 (Clan v2, [clan-v2.md](cahiers-des-charges/clan-v2.md)) : sans maximum de membres, emblème, rôles, demandes et code d'invitation, discussion et devises filtrées (ni lien, ni adresse, ni téléphone, ni caractère invisible) et modérées, objectif de la semaine en bonnes réponses de défi, niveau de clan cosmétique (objets d'emblème, Enluminure, bannières), bibliothèque commune, courrier et mentions. On peut rejoindre un autre clan dès qu'on en part. Reste : la modération par modèle |
| Amis | Fait sur le web (pas en ligne) | P75 à P79, cahier [amis.md](cahiers-des-charges/amis.md) : demande acceptée des deux côtés (par pseudo exact, depuis un profil ou par le lien d'ami), écran `/amis` (demandes, lien, liste, retrait), profil entier entre amis, lien `/ami/<code>` qui fait entrer 3 joueurs dans la bêta fermée et rend amis à la création du compte, sachet bonus pour les deux au niveau 5 du filleul (5 par mois), échanges possibles par ami et doubles qui lui manquent mis en avant dans l'offre, albums comparés (`/album?ami=<code>`), podium de la semaine sans récompense, fil des trouvailles avec réactions prédéfinies, lettres du courrier. Migration `0026`. Les joueurs venus par un lien d'ami forment la source « Lien d'ami » de la mesure. Reste : la mise en production, le nombre de filleuls par parrain dans la mesure. Porté sur le mobile |
| Modes de jeu entre joueurs | R&D | Plusieurs pistes à prototyper (joute, duplicate, bluff…) |
| Classements | Plus tard | Pas en v1. Cote globale de type Elo (Glicko-2), modèle du Scrabble duplicate |

### Modèle économique

| Étape | Statut | Détail |
|---|---|---|
| Abonnement Mécène | À faire | P72, P73 : tout le jeu gratuit, une offre Mécène au contenu dévoilé le 1er du mois, dont « ton mot dans le jeu ». Fausse porte sur `/mecene`, mesurée dans `/admin/mesure`. Le paiement n'est pas construit, et attend les chiffres de la bêta |

### Interface

| Étape | Statut | Détail |
|---|---|---|
| Interface v1, web et mobile | En cours | Inventaire de chaque écran : [interface-v1.md](cahiers-des-charges/interface-v1.md). Logique d'écran commune dans `packages/view-model` (D-033). Lots 0 à 4 faits sur le web, retours de la première recette traités ([recette-web.md](recette-web.md#retours-du-2026-10-22)). Jouer revenu le 2026-10-23 au bandeau du niveau et aux boutons ronds autour d'un sachet plus petit, les sachets des autres collections derrière le comptoir. Les écrans entrent en fondu et attendent leurs données sous la forme de leur contenu, sans saut de mise en page ; un écran dont le chargement échoue propose de réessayer. Le mobile suit, écran par écran |
| Direction artistique et tokens | Fait | D-022 « Planche populaire », `packages/tokens`, logo et favicon |
| Web : page d'accueil publique | Fait | P55 : accueil sur `/`, le jeu sous `/jouer`, connexion depuis l'accueil, lien vers le Discord du projet. Liste d'attente, image de partage, pages `/confidentialite`, `/mentions`, `/conditions`, `/charte`, 404 et page d'erreur en français. Reste : la relecture des textes par un juriste |
| Mobile (Expo) | En cours, jouable de bout en bout sur Android | D-048 : client API partagé (`@leximon/contract/client`), session gardée dans le trousseau par `@better-auth/expo`. Coque (bandeau du haut, onglets avec Jouer en relief, cadenas), polices embarquées, icône et écran de lancement. Jouer : choix de la collection, sachet dessiné comme celui du web (mêmes couches, balancement, lumière, ombre, envol de la bande et cartes qui sortent, attente grisée), déchirure au doigt (la requête part dès le début du geste), mise en scène par rareté, récapitulatif, boutons ronds (clan, discussion, défi du jour, amis, coffrets). Sons, mot dit à voix haute et vibrations du web (D-049), réglables. Reflets des cartes du web sur la carte révélée et la fiche, éclat des Rares dans le bilan. Album (filtres, recherche, albums comparés avec un ami), fiche de carte (épingler), défis (révision, mot écrit, plis bonus), échanges, clan (discussion, objectif, gestion), amis (podium, fil, réactions, lien d'ami), courrier, chemin des niveaux et coffrets, profil, atelier, profils publics (signaler, bloquer), réglages (notifications, joueurs bloqués, suppression du compte), avis de sanction avec contestation, « Un retour ? ». Encre en dégradé des gravures Épique et Légendaire. Compte et portes de la bêta par le schéma `leximon://`. Version minimale imposée : `MOBILE_MIN_VERSION` côté API (`GET /app`), écran « Leximon a changé » en dessous. Reste : copie du lien d'ami (`expo-clipboard`), liens universels `https://leximon.fr/…` (identifiant d'équipe Apple et empreinte de la clé Android), adresse App Store (`ios.appStoreUrl`), page Mécène (prix d'abonnement hors achat intégré : à trancher avant iOS), joutes (pas construites), recette sur iPhone |
| Animations et reflets | Fait | Sur le web, du CSS. Sur le mobile (2026-10-25), les mêmes couches en SVG animé avec les modes de fusion natifs, sans dépendance nouvelle ; la lumière suit le doigt, pas encore l'inclinaison du téléphone (`expo-sensors`, à valider). Clore ou non la R&D D-009 reste à trancher |
| Ouverture : peaufinage | Fait sur le web | Cahier : [ouverture.md](cahiers-des-charges/ouverture.md). Déchirure au doigt, pile, mise en scène par rareté, sons synthétisés, vibration, récapitulatif, reflets par rareté, sachet bombé au sceau doré, mot dit quand la carte se pose, aperçu en glissant. Récapitulatif lisible en cascade, fiche au toucher (2026-10-23). Sur le mobile : sachet du web, déchirure au doigt, pile et aperçu en glissant, mise en scène par rareté, sons, mot dit, vibration, récapitulatif, reflets |
| Retours du premier testeur | Fait | Cahier : [retours-premier-testeur.md](cahiers-des-charges/retours-premier-testeur.md), validé le 2026-10-23. Les cinq lots faits le 2026-10-23 (relire ce qu'on vient d'ouvrir, « Nouveau » dans l'album, mot qui s'échappe, signaux de Jouer, collections et raretés). La migration `0025` et le catalogue `2026-10-23.2` (lignes des collections) sont en production |
| Ouverture : forme du paquet | Fait | Le sachet (P47, P53), un par collection. Le pli reste à l'essai (`/jouer?paquet=pli`) |
| Numéro de collection sur la carte | À décider | Par exemple « 040/160 ». Dénominateur à choisir (taille annoncée ou cartes publiées) |

### Mise en ligne

| Étape | Statut | Détail |
|---|---|---|
| Hébergement de production | En cours | En ligne depuis le 2026-10-22 : `leximon.fr` et `api.leximon.fr`, base Neon gratuite, catalogue servi par le Worker web (D-040, D-043). Mise en production en une commande (`pnpm deploy:prod`). En-têtes de sécurité, préflights CORS en cache, première visite allégée (ni catalogue sur l'accueil, ni dans la coque du jeu). Procédure : [mise-en-ligne.md](mise-en-ligne.md). Reste : redirection de `www`, Lettermint, sauvegarde nocturne sur le NAS, ton compte admin si ce n'est pas fait |
| Bêta fermée sur invitation | En ligne, premiers liens envoyés (2026-10-25) | D-041 : liens par groupe dans `/admin/invitations`, page `/invitation/<code>`, porte tenue par l'API (`BETA_INVITES`), `?src=` gardé avec le joueur. Une invitation rejouée par un invité ne rouvre plus la porte |
| Mesure | En ligne | D-042 : `/admin/mesure` (rétention J1/J7/J30, entonnoir, testeurs, fausse porte mécène), `/admin/retours` (« Un retour ? » dans le menu), tranche d'âge facultative à l'inscription |
| Suivi des erreurs | Fait | D-045 : erreurs relevées par Cloudflare (Workers Logs), résumé chaque matin sur Discord avec les chiffres de la veille. Pas de suivi des erreurs du navigateur |
| Test de charge | Fait (pas en ligne) | D-047 : scénarios k6 dans `infra/load/`, staging sur une branche Neon ([rnd/charge.md](rnd/charge.md)). 572 requêtes/s sans une erreur (2026-10-23). Ouverture d'un sachet ramenée de 8 à 5 allers-retours SQL et cache de session réparé (il ne servait pas) : 37 ms en médiane et 72 ms au p95 côté serveur (2026-10-24). API placée à Francfort près de la base. En production |
| Marque, domaines, comptes réseaux | En cours | Domaine leximon.fr (OVH, DNS chez Cloudflare, renouvellement automatique à activer), contact@leximon.fr routé par Cloudflare, Discord du projet. Marque : dépôt INPI repoussé (P7). Autres comptes réseaux à faire |

## Ce qui attend ta décision

Dans l'ordre où elles débloquent le plus :

1. **Finir la mise en ligne :** les étapes « toi » de [mise-en-ligne.md](mise-en-ligne.md) qui restent (`www`, sauvegarde sur le NAS). Lettermint peut attendre la première campagne.
2. **Avatars gravés (P49) :** valider les seize gravures choisies et leurs noms.
3. **Mécène (P73) :** l'exemplaire de la carte dénichée, non échangeable et sans XP, reste à confirmer.
4. **Questions ouvertes** de [regles-du-jeu.md](regles-du-jeu.md#à-décider) : numéro de collection, sons de l'ouverture, notation phonétique.

## Prochaines étapes conseillées

1. Suivre `/admin/mesure` et `/admin/retours` à mesure que les invités arrivent ; vérifier `cf-placement: remote-FRA` et le p95 de l'ouverture dans le résumé Discord ([rnd/charge.md](rnd/charge.md)).
2. Le mobile : recette complète sur Android et iPhone ([recette-mobile.md](recette-mobile.md)). Avant la première publication sur les stores : variables `EXPO_PUBLIC_*` des profils EAS, adresse App Store, liens universels.
3. La quatrième collection.
