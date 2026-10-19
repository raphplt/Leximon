# Feuille de route

Où en est Leximon, ce qui reste avant la bêta publique (novembre 2026) et ce qui attend une décision du propriétaire. Mise à jour à chaque étape franchie.

**Dernière mise à jour :** 2026-10-19.

## En une phrase

Le cœur du jeu tourne de bout en bout sur le web : on ouvre un pli, on révèle ses cartes, on les retrouve dans l'album. Mais il s'appuie encore sur un catalogue de démo de 23 cartes, sans gravures, et rien n'est en ligne.

## État par chantier

Statuts : **Fait**, **En cours**, **À faire**, **À décider** (attend le propriétaire).

### Contenu des cartes

| Étape | Statut | Détail |
|---|---|---|
| Choix des mots et calcul de la rareté | Fait | D-020 : fréquence Google Ngram, environ 28 000 candidats dans le Littré |
| Rédaction et contrôle automatique | Fait | D-019, D-021 : lot-1 de 300 mots, 178 cartes gardées, 10 % à relire |
| Format de publication du catalogue | À décider | Ce que lisent l'API et les apps. Remplacera le catalogue de démo |
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

### Interface

| Étape | Statut | Détail |
|---|---|---|
| Direction artistique et tokens | Fait | D-022 « Planche populaire », `packages/tokens` |
| Web : ouverture du pli, album | Fait | Sur le catalogue de démo |
| Web : défis, échanges, profil | À faire | Après les règles côté serveur |
| Web : page d'accueil publique et liste d'attente | À faire | Utile avant la bêta, pour les réseaux |
| Mobile (Expo) | À faire | Les mêmes écrans ; charger les polices demandera une dépendance (`expo-font`) |
| Animations et reflets | À faire | R&D D-009. En attendant, du CSS simple |

### Mise en ligne

| Étape | Statut | Détail |
|---|---|---|
| Hébergement de production | À décider | Cloudflare est choisi (D-005, D-015) ; le fournisseur Postgres en UE reste à choisir |
| Test de charge, observabilité, pages légales | À faire | Avant d'ouvrir la bêta |
| Marque, domaines, comptes réseaux | À faire | Côté propriétaire (north star § 12) |

## Ce qui attend ta décision

Dans l'ordre où elles débloquent le plus :

1. **Format de publication du catalogue.** Il débloque le vrai contenu dans le jeu. Proposition en cours.
2. **Collections de lancement.** Elles orientent la prochaine génération de cartes.
3. **Budget de la génération de lancement.** Environ 15 à 30 $ pour 1 000 à 2 000 cartes.
4. **Règles d'échange.** Elles débloquent les échanges, prévus au MVP.
5. **Dépendance FSRS.** Elle débloque les défis.
6. **Fournisseur Postgres.** Il débloque la mise en ligne.

## Prochaines étapes conseillées

1. Publier le vrai catalogue (format, puis export depuis Directus) et le brancher sur le web.
2. Générer les cartes de lancement et trouver les gravures.
3. Défis, puis échanges, côté serveur puis web.
4. Page d'accueil publique et liste d'attente.
5. Mobile, puis mise en ligne et test de charge.
