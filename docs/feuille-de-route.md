# Feuille de route

Où en est Leximon, ce qui reste avant la bêta publique (novembre 2026) et ce qui attend une décision du propriétaire. Mise à jour à chaque étape franchie.

**Dernière mise à jour :** 2026-10-22.

## En une phrase

Le cœur du jeu tourne de bout en bout sur le web : on ouvre un pli, on révèle ses cartes, on les retrouve dans l'album, on les fait monter de niveau par des défis qui rapportent des plis bonus, on les échange et on les épingle sur son profil public. Il lit le catalogue de lancement (1 561 cartes, trois collections), encore sans gravures. Le site est en ligne sur leximon.fr depuis le 2026-10-22, porte fermée : personne n'entre sans lien d'invitation.

## État par chantier

Statuts : **Fait**, **En cours**, **À faire**, **À décider** (attend le propriétaire), **R&D** (pistes à explorer avant de choisir), **Plus tard**.

### Contenu des cartes

| Étape | Statut | Détail |
|---|---|---|
| Choix des mots et calcul de la rareté | Fait | D-020 : fréquence Google Ngram, environ 28 000 candidats dans le Littré |
| Rédaction et contrôle automatique | Fait | D-019, D-021 : lot-1 de 300 mots, 178 cartes gardées, 10 % à relire |
| Publication du catalogue | Fait | D-023 : `release` puis `pnpm catalog:publish`. Première version : 160 cartes |
| Collections de lancement | Fait | D-024 : Les Fondateurs, Caractères et travers, Métiers et objets disparus, environ 500 cartes chacune |
| Collections suivantes | À faire | P56 : onze collections prévues (Bêtes et plantes, À table !, Habits et parures…), environ 2 à 3 $ de génération pour 300 cartes, chacune avec l'accord du propriétaire |
| Volume de lancement (1 000 à 2 000 cartes) | Fait | Version 2026-10-20.2 publiée en local : 1 561 cartes (Les Fondateurs 519, Caractères et travers 539, Métiers et objets disparus 503), pour 20,68 $ de génération. Les 143 cartes signalées ont été pré-relues par Claude, et 358 définitions qui donnaient le mot ont été reformulées (P41) ; chaque carte touchée porte une note dans Directus |
| Gravures | En cours | D-028, P42-P43. Chaîne complète (`gravures-queries`, `-search`, `-pick`, `-render`) ; essai sur 20 cartes : 16 choix de Sonnet, 12 validés, publiés dans la version 2026-10-20.3 et affichés sur les cartes. Reste : lancer les 1 561 cartes (environ 5 $, 5 à 9 h de recherche) puis valider |
| Expressions | Plus tard | Après le lancement (P13) |

### Règles et serveur

| Étape | Statut | Détail |
|---|---|---|
| Compte invité, stock de plis, tirage, garanties | Fait | D-006, D-016, D-017, P10 à P12 |
| Collection du joueur | Fait | `GET /me/cards` |
| Défis et niveaux de maîtrise | Fait | D-025 : FSRS (ts-fsrs), QCM, `GET /challenges`, `POST /challenges/answer`, `GET /me/mastery` |
| Plis bonus des défis | Fait | D-027, règles P23 et P29 : défi du jour et Dorure, réserve plafonnée à 10 |
| Échanges carte contre carte | Fait | D-026 : offres directes par code joueur, doublons seulement. Notifications à venir avec la file |
| Inscription par code e-mail | En cours | D-030, P37, P54 : code à 6 chiffres, invité limité à 2 plis avant de créer un compte, transfert de la partie invitée vers un nouveau compte, abandon après avertissement vers un compte qui joue déjà (`guest_links`), écran `/compte`. Codes envoyés par Cloudflare Email Service (D-034), en attente des enregistrements DNS de `mail.leximon.fr` ; sans expéditeur configuré, l'envoi reste fermé hors dev. Reste : Apple et Google |
| E-mails de campagne | Fait (pas en ligne) | Cahier : [e-mails.md](cahiers-des-charges/e-mails.md). D-034 à D-036, P55, P61 : campagnes dans `/admin/campagnes` (brouillon, aperçu, test à soi, lancement confirmé par le nombre exact de destinataires, programmé ou immédiat, pause, annulation, compteurs), envoi par Lettermint via une file Queues alimentée chaque minute, une ligne et une clé d'idempotence par destinataire. Désinscription en un clic (RFC 8058) et page `/desinscription`, webhooks Lettermint signés (rebonds, plaintes), liste d'opposition. Liste d'attente fermée au lancement de son e-mail, puis effacée depuis l'admin. Consentement des joueurs à l'inscription et dans le compte. Reste : compte Lettermint et ses DNS sur `infos.leximon.fr`, secrets de production, quota Cloudflare des codes |
| Administration | Fait | D-031 : `/admin` (tableau de bord, joueurs avec plis bonus et bannissement, liste d'attente et export CSV, échanges, signalements et sanctions, contestations, cartes avec recherche et fiche, collections, journal). Rôle donné par `pnpm admin:grant <email>` |

### Progression et social

Arbitrés par le propriétaire le 2026-10-20 : jeu grand public (B2C), pas de version école prévue. Cahier des charges : [progression-et-social.md](cahiers-des-charges/progression-et-social.md).

| Étape | Statut | Détail |
|---|---|---|
| Niveau de compte | En cours | P48 : XP gagnée dans la transaction de chaque action (pli, défi, échange), niveau calculé, badge dans la navigation, « +N XP » après un pli ou un défi, échanges ouverts au niveau 5. Récompenses (P58, sauf cosmétiques) et fonctionnalités par niveau (P59) dans le code depuis le 2026-10-21 : coffrets réclamés (`POST /me/level-rewards/{niveau}`), réserve agrandie, échanges à 3 cartes au niveau 10. Reste aussi : XP des raretés complétées, calibrage par simulation |
| Profil public | Fait sur le web | Pseudo (P62), avatar gravé et cadre, titre, cartes épinglées, statistiques, page publique `/joueur/{pseudo}` avec image de partage, atelier, bloquer et signaler (P63), suppression du compte (P64). Public par défaut (P60), dès le niveau 8. Le clan du joueur, avec son emblème, sur le profil et son image |
| Clans | Fait sur le web | P65 à P68 : clans sans maximum de membres (niveau 10 pour entrer, 15 pour fonder), emblème, rôles, demandes et code d'invitation, discussion et journal filtrés et modérés (messages gardés 90 jours), objectif de la semaine en bonnes réponses de défi, avec sachets bonus à l'argent, à l'or et à l'enluminure, niveau de clan qui ouvre objets d'emblème, palier Enluminure et bannières (Clan v2, P66 et P70), bibliothèque commune. Événements de jeu par la file `leximon-game-events` (D-038). Sanctions motivées et contestables, traitées dans `/admin/signalements` et `/admin/contestations`. Reste : le mobile, la modération par modèle |
| Modes de jeu entre joueurs | R&D | Plusieurs pistes à prototyper (joute, duplicate, bluff…) |
| Classements | Plus tard | Pas en v1. Cote globale de type Elo (Glicko-2), modèle du Scrabble duplicate |

### Interface

| Étape | Statut | Détail |
|---|---|---|
| Interface v1, web et mobile | En cours | Maquette cliquable et cahier validés le 2026-10-21 ; inventaire de chaque écran : [interface-v1.md](cahiers-des-charges/interface-v1.md). Logique d'écran commune dans `packages/view-model` (D-033), web d'abord. Lots 0 à 4 faits sur le web (coque, Jouer, chemin des niveaux, coffrets, réglages, écrans fermés par le niveau ; album, fiche d'une carte avec prononciation et partage, défis, échanges ; profil, atelier, réglages complets, suppression du compte ; clans, sanctions et contestation). Courrier rempli par la file, mentions dans la discussion, page publique de chaque carte et clan sur le profil faits le 2026-10-22 (D-039). Les notifications push viendront avec le mobile. Conditions d'utilisation et charte écrites le 2026-10-22, à faire relire par un juriste. Écran Jouer (comptoir, un sachet par collection) et chemin des niveaux (plateau par quartiers) repris le 2026-10-22 après la première recette. Prochain : le mobile |
| Direction artistique et tokens | Fait | D-022 « Planche populaire », `packages/tokens` |
| Web : ouverture du pli, album | Fait | Sur le catalogue publié |
| Web : défis, échanges | Fait | `/defis`, `/echanges` ; niveau de maîtrise dans l'album |
| Web : page d'accueil publique et liste d'attente | Fait | P55 : accueil sur `/`, le jeu passe sous `/jouer`. La liste d'attente garde l'adresse seule (`POST /waitlist`, table `waitlist_signups`). Image de partage générée par `opengraph-image.tsx` (polices chargées depuis Google Fonts au build). Page `/confidentialite` (« Tes données »), liée depuis le formulaire et le pied de page. L'e-mail d'ouverture se prépare dans `/admin/campagnes` ; son lancement ferme la liste. Pages `/mentions` (éditeur, hébergeur, crédits), `/conditions` et `/charte`. Reste : la relecture des textes par un juriste |
| Mobile (Expo) | À faire | Les mêmes écrans ; charger les polices demandera une dépendance (`expo-font`) |
| Animations et reflets | À faire | R&D D-009. En attendant, du CSS simple |
| Ouverture : peaufinage | En cours | Cahier des charges : [ouverture.md](cahiers-des-charges/ouverture.md). Lots A et B faits sur le web : déchirure au doigt, pile, mise en scène par rareté, sons synthétisés, vibration, récapitulatif, reflets par rareté, sachet. Reste : mobile |
| Ouverture : forme du paquet | Fait | Le sachet est choisi (P47), avec le mot « sachet » partout (P53). Le pli reste à l'essai (`/jouer?paquet=pli`) |
| Ouverture : aperçu en glissant | Fait | Geste bonus jamais expliqué : glisser la pile en biais pour deviner une rare |
| Reflets et effets holographiques par rareté | Fait (web) | Carte révélée et carte agrandie : inclinaison, reflet, puce et cadre métallisés, paillettes, arc-en-ciel de la Légendaire. Le mobile attend la R&D D-009 |
| Numéro de collection sur la carte | À décider | Par exemple « 040/160 ». Dénominateur à choisir (taille annoncée ou cartes publiées) |

### Mise en ligne

| Étape | Statut | Détail |
|---|---|---|
| Hébergement de production | En cours | En ligne depuis le 2026-10-22 : `leximon.fr` et `api.leximon.fr`, base Neon migrée, catalogue publié. Neon gratuit et sauvegarde nocturne sur le NAS (D-040), environnements `production` des deux Workers, catalogue servi par le Worker web. Procédure pas à pas : [mise-en-ligne.md](mise-en-ligne.md). `cacheComponents` coupé tant qu'OpenNext ne le prend pas en charge (D-043). Reste : e-mails des codes (Email Service), compte admin, redirection de `www`, Lettermint, sauvegarde sur le NAS |
| Bêta fermée sur invitation | En ligne, aucun lien encore | D-041 : liens par groupe dans `/admin/invitations`, page `/invitation/<code>`, porte tenue par l'API (`BETA_INVITES`), `?src=` gardé avec le joueur |
| Mesure | En ligne | D-042 : `/admin/mesure` (rétention J1/J7/J30 par semaine, lien ou source, âge ; entonnoir ; testeurs ; fausse porte mécène), `/admin/retours` (« Un retour ? » dans le menu), tranche d'âge facultative à l'inscription, page `/mecene` |
| Test de charge, observabilité | À faire | Avant d'ouvrir au public |
| Marque, domaines, comptes réseaux | En cours | Domaine leximon.fr (OVH, DNS chez Cloudflare, renouvellement automatique à activer), contact@leximon.fr routé par Cloudflare. Marque : dépôt INPI repoussé (P7). Comptes réseaux à faire |

## Ce qui attend ta décision

Dans l'ordre où elles débloquent le plus :

1. **Gravures : lancement complet** sur les 1 561 cartes (environ 5 $).
2. **Mise en ligne :** les étapes marquées « toi » de [mise-en-ligne.md](mise-en-ligne.md) (Workers Paid, Neon, secrets, DNS des e-mails, Lettermint, NAS).
3. **Avatars gravés (P49) :** valider les seize gravures choisies et leurs noms.
4. **Ouverture, progression et social :** les questions ouvertes de [regles-du-jeu.md](regles-du-jeu.md#à-décider), détaillées dans les [cahiers des charges](cahiers-des-charges/).
5. **Retours de la première prise en main (2026-10-22) :** collections dans le temps, sachet découverte, refonte du clan, courbe de niveaux, voir [recette-web.md](recette-web.md#retours-du-2026-10-22). Refonte du clan : [clan-v2.md](cahiers-des-charges/clan-v2.md), validée et faite sur le web le 2026-10-22.

## Prochaines étapes conseillées

1. Gravures : finir la recherche sur tout le catalogue, puis valider les choix.
2. E-mails : créer les enregistrements DNS (`mail.leximon.fr`, `infos.leximon.fr`, voir [e-mails.md](cahiers-des-charges/e-mails.md)), le compte Lettermint et les secrets de production. Puis Apple et Google.
3. Mobile, puis mise en ligne et test de charge.
