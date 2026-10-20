# Feuille de route

Où en est Leximon, ce qui reste avant la bêta publique (novembre 2026) et ce qui attend une décision du propriétaire. Mise à jour à chaque étape franchie.

**Dernière mise à jour :** 2026-10-20.

## En une phrase

Le cœur du jeu tourne de bout en bout sur le web : on ouvre un pli, on révèle ses cartes, on les retrouve dans l'album, on les fait monter de niveau par des défis qui rapportent des plis bonus, et on les échange. Il lit le catalogue de lancement (1 561 cartes, trois collections), encore sans gravures, et rien n'est en ligne.

## État par chantier

Statuts : **Fait**, **En cours**, **À faire**, **À décider** (attend le propriétaire), **R&D** (pistes à explorer avant de choisir), **Plus tard**.

### Contenu des cartes

| Étape | Statut | Détail |
|---|---|---|
| Choix des mots et calcul de la rareté | Fait | D-020 : fréquence Google Ngram, environ 28 000 candidats dans le Littré |
| Rédaction et contrôle automatique | Fait | D-019, D-021 : lot-1 de 300 mots, 178 cartes gardées, 10 % à relire |
| Publication du catalogue | Fait | D-023 : `release` puis `pnpm catalog:publish`. Première version : 160 cartes |
| Collections de lancement | Fait | D-024 : Les Fondateurs, Caractères et travers, Métiers et objets disparus, environ 500 cartes chacune |
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
| Inscription (lien magique, Apple, Google) | À faire | Doit transférer la collection de l'invité vers son compte |

### Progression et social

Arbitrés par le propriétaire le 2026-10-20 : jeu grand public (B2C), pas de version école prévue. Cahier des charges : [progression-et-social.md](cahiers-des-charges/progression-et-social.md).

| Étape | Statut | Détail |
|---|---|---|
| Niveau de compte | À faire | XP, paliers et récompenses à réclamer. Barème de départ validé, à calibrer par simulation |
| Profil public | À faire | Pseudo, avatar gravé, clan, cartes épinglées, statistiques. Public par défaut à confirmer |
| Clans | À faire | Sans maximum de membres, discussion texte modérée, bibliothèque commune. Après l'inscription et la modération |
| Modes de jeu entre joueurs | R&D | Plusieurs pistes à prototyper (joute, duplicate, bluff…) |
| Classements | Plus tard | Pas en v1. Cote globale de type Elo (Glicko-2), modèle du Scrabble duplicate |

### Interface

| Étape | Statut | Détail |
|---|---|---|
| Direction artistique et tokens | Fait | D-022 « Planche populaire », `packages/tokens` |
| Web : ouverture du pli, album | Fait | Sur le catalogue publié |
| Web : défis, échanges | Fait | `/defis`, `/echanges` ; niveau de maîtrise dans l'album |
| Web : page d'accueil publique et liste d'attente | À faire | Utile avant la bêta, pour les réseaux |
| Mobile (Expo) | À faire | Les mêmes écrans ; charger les polices demandera une dépendance (`expo-font`) |
| Animations et reflets | À faire | R&D D-009. En attendant, du CSS simple |
| Ouverture : peaufinage | En cours | Cahier des charges : [ouverture.md](cahiers-des-charges/ouverture.md). Lots A, B et C faits sur le web : déchirure au doigt, pile, mise en scène par rareté, sons synthétisés, vibration, récapitulatif, reflets par rareté, sachet, A/B. Reste : mobile |
| Ouverture : forme du paquet | En cours | Pli et sachet faits sur le web, test A/B en place (D-030) : chaque joueur voit l'une des deux formes, avec le mot qui va avec (P53). Lecture : `pnpm experiments:report` |
| Ouverture : aperçu en glissant | Fait | Geste bonus jamais expliqué : glisser la pile en biais pour deviner une rare |
| Reflets et effets holographiques par rareté | Fait (web) | Carte révélée et carte agrandie : inclinaison, reflet, puce et cadre métallisés, paillettes, arc-en-ciel de la Légendaire. Le mobile attend la R&D D-009 |
| Numéro de collection sur la carte | À décider | Par exemple « 040/160 ». Dénominateur à choisir (taille annoncée ou cartes publiées) |

### Mise en ligne

| Étape | Statut | Détail |
|---|---|---|
| Hébergement de production | À décider | Cloudflare est choisi (D-005, D-015). Fournisseur Postgres : R&D faite (`docs/rnd/postgres.md`), recommandation Neon gratuit pour la bêta puis OVHcloud Paris. Hyperdrive de production à créer sans cache. À créer aussi : la file `leximon-analytics` et le secret `ANALYTICS_SECRET` (D-030) |
| Test de charge, observabilité, pages légales | À faire | Avant d'ouvrir la bêta. Les pages légales doivent informer de la mesure d'audience et offrir de la refuser (D-030) |
| Marque, domaines, comptes réseaux | À faire | Côté propriétaire (north star § 12) |

## Ce qui attend ta décision

Dans l'ordre où elles débloquent le plus :

1. **Gravures : lancement complet** sur les 1 561 cartes (environ 5 $).
2. **Fournisseur Postgres**, d'après `docs/rnd/postgres.md`. Il débloque la mise en ligne.
3. **Ouverture, progression et social :** les questions ouvertes de [regles-du-jeu.md](regles-du-jeu.md#à-décider), détaillées dans les [cahiers des charges](cahiers-des-charges/).

## Prochaines étapes conseillées

1. Gravures : lancer la recherche sur tout le catalogue, puis valider les choix.
2. Inscription (lien magique, Apple, Google) avec transfert de la collection de l'invité.
3. Page d'accueil publique et liste d'attente.
4. Mobile, puis mise en ligne et test de charge.
