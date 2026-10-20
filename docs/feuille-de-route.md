# Feuille de route

Où en est Leximon, ce qui reste avant la bêta publique (novembre 2026) et ce qui attend une décision du propriétaire. Mise à jour à chaque étape franchie.

**Dernière mise à jour :** 2026-10-20.

## En une phrase

Le cœur du jeu tourne de bout en bout sur le web : on ouvre un pli, on révèle ses cartes, on les retrouve dans l'album. Il lit le catalogue publié (160 cartes du lot-1), encore sans gravures, et rien n'est en ligne.

## État par chantier

Statuts : **Fait**, **En cours**, **À faire**, **À décider** (attend le propriétaire), **R&D** (pistes à explorer avant de choisir), **Plus tard**.

### Contenu des cartes

| Étape | Statut | Détail |
|---|---|---|
| Choix des mots et calcul de la rareté | Fait | D-020 : fréquence Google Ngram, environ 28 000 candidats dans le Littré |
| Rédaction et contrôle automatique | Fait | D-019, D-021 : lot-1 de 300 mots, 178 cartes gardées, 10 % à relire |
| Publication du catalogue | Fait | D-023 : `release` puis `pnpm catalog:publish`. Première version : 160 cartes |
| Collections de lancement | À décider | Quelles collections, combien de cartes chacune (environ 500 recommandé, P14) |
| Volume de lancement (1 000 à 2 000 cartes) | À faire | Environ 15 $ par tranche de 1 000 cartes gardées : accord du propriétaire avant de lancer |
| Gravures | À faire | Trouver des gravures du domaine public et les traiter (P5). Pas commencé |
| Expressions | Plus tard | Après le lancement (P13) |

### Règles et serveur

| Étape | Statut | Détail |
|---|---|---|
| Compte invité, stock de plis, tirage, garanties | Fait | D-006, D-016, D-017, P10 à P12 |
| Collection du joueur | Fait | `GET /me/cards` |
| Défis et niveaux de maîtrise | À faire | Révision espacée (FSRS) : une dépendance à valider |
| Échanges carte contre carte | À faire | Règles à proposer : durée d'une offre, offres ouvertes, cartes échangeables |
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
| Web : défis, échanges, profil | À faire | Après les règles côté serveur |
| Web : page d'accueil publique et liste d'attente | À faire | Utile avant la bêta, pour les réseaux |
| Mobile (Expo) | À faire | Les mêmes écrans ; charger les polices demandera une dépendance (`expo-font`) |
| Animations et reflets | À faire | R&D D-009. En attendant, du CSS simple |
| Ouverture : peaufinage | En cours | Cahier des charges : [ouverture.md](cahiers-des-charges/ouverture.md). Lot A fait sur le web : déchirure au doigt, pile, mise en scène par rareté, sons synthétisés, vibration, récapitulatif. Reste : reflets interactifs, mobile |
| Ouverture : forme du paquet | À faire | Pli et sachet développés tous les deux, départagés par un test A/B à préparer |
| Ouverture : aperçu en glissant | Fait | Geste bonus jamais expliqué : glisser la pile en biais pour deviner une rare |
| Reflets et effets holographiques par rareté | À faire | Chaque rareté a son traitement visuel. Lié à la R&D D-009 |
| Numéro de collection sur la carte | À décider | Par exemple « 040/160 ». Dénominateur à choisir (taille annoncée ou cartes publiées) |

### Mise en ligne

| Étape | Statut | Détail |
|---|---|---|
| Hébergement de production | À décider | Cloudflare est choisi (D-005, D-015) ; le fournisseur Postgres en UE reste à choisir |
| Test de charge, observabilité, pages légales | À faire | Avant d'ouvrir la bêta |
| Marque, domaines, comptes réseaux | À faire | Côté propriétaire (north star § 12) |

## Ce qui attend ta décision

Dans l'ordre où elles débloquent le plus :

1. **Collections de lancement.** Elles orientent la prochaine génération de cartes.
2. **Budget de la génération de lancement.** Environ 15 à 30 $ pour 1 000 à 2 000 cartes.
3. **Règles d'échange.** Elles débloquent les échanges, prévus au MVP.
4. **Dépendance FSRS.** Elle débloque les défis.
5. **Fournisseur Postgres.** Il débloque la mise en ligne.
6. **Ouverture, progression et social :** les décisions restantes en fin de chaque [cahier des charges](cahiers-des-charges/).

## Prochaines étapes conseillées

1. Générer les cartes de lancement et trouver les gravures.
2. Défis, puis échanges, côté serveur puis web.
3. Page d'accueil publique et liste d'attente.
4. Mobile, puis mise en ligne et test de charge.
