# R&D · Rythme des niveaux

- **Décision liée :** règle P48 (niveau de compte)
- **Dates :** 2026-10-22 → 2026-10-23
- **Question :** quelle courbe d'XP donne à un joueur régulier le rythme voulu par le propriétaire, sans niveau maximum ?

## Critères

Rythme fixé par le propriétaire le 2026-10-22, pour un joueur régulier :

| Critère | Seuil d'acceptation |
|---|---|
| Niveau 10 (clans, échanges à 3 cartes) | vers le 4e ou 5e jour |
| Niveau 20 | environ deux semaines |
| Niveau 50 (fin des récompenses de jeu) | environ quatre mois |
| Niveau 100 | plus d'un an |

## Modèle

- **Règles réelles**, importées de `packages/core` : tirage et garanties, barème d'XP (P48), récompenses de niveau (P58 : sachets bonus et garnis réinjectés dans les ouvertures).
- **Catalogue :** les trois collections de lancement (520 cartes chacune), puis une collection de 300 cartes toutes les 4 semaines, avec le rayon tournant (P69) : 4 collections ouvertes, les Fondateurs seuls avant le niveau 3. Le joueur ouvre la collection ouverte où il lui manque le plus de mots, ce qui maximise ses mots nouveaux (borne haute de l'XP).
- **Profils (hypothèses) :**

| Profil | Sachets par jour | Défi | Bonnes réponses par séance | Échanges par semaine |
|---|---|---|---|---|
| Occasionnel | 3 | 3 jours sur 7 | 4 | 0 |
| Régulier | 8 | tous les jours | 8 | 1 |
| Assidu | 20 | tous les jours | 20 | 3 |

- **Simplifications :**
  - le sachet bonus du défi du jour est compté dès qu'il y a une séance ;
  - une montée de maîtrise (Encre ou Dorure) toutes les 4 bonnes réponses, à partir du 8e jour ;
  - chaque échange apporte un mot Courant nouveau ;
  - les échanges commencent au niveau 5 et après 3 jours.
- **Mesure :** la médiane sur 40 joueurs simulés par profil et par courbe, sur 730 jours.

## Options testées

Des courbes linéaires de la forme « passer du niveau n au suivant demande base + pas × (n − 1) XP », de 100 + 20 (l'ancienne) à 125 + 45.

## Résultats

Joueur régulier. Les tableaux complets des trois profils sont dans [rnd/level-sim/results.md](../../rnd/level-sim/results.md).

| Courbe | Niv. 10 | Niv. 20 | Niv. 50 | Niv. 100 |
|---|---|---|---|---|
| 100 + 20 (ancienne) | 3 j | 8 j | 54 j | 242 j (8 mois) |
| 100 + 35 | 4 j | 13 j | 93 j (3,1 mois) | 425 j (14 mois) |
| 100 + 40 | 4 j | 14 j | 109 j (3,6 mois) | 485 j (16 mois) |
| **100 + 45** | **4 j** | **16 j** | **121 j (4,0 mois)** | **546 j (18 mois)** |
| 125 + 45 | 5 j | 17 j | 125 j (4,1 mois) | 554 j (18 mois) |
| 150 + 45 (sans recharge) | 5 j | 17 j | 127 j (4,2 mois) | 560 j (18 mois) |

Avec la courbe 100 + 45, selon le profil :

| Profil | Niv. 10 | Niv. 20 | Niv. 50 | Niv. 100 |
|---|---|---|---|---|
| Occasionnel | 10 j | 43 j | 10 mois | plus de 2 ans |
| Régulier | 4 j | 16 j | 4,0 mois | 18 mois |
| Assidu | 2 j | 6 j | 56 j | 8,8 mois |

Ce que montrent les chiffres :
- l'ancienne courbe menait un joueur régulier au niveau 50 en moins de deux mois : la crainte du propriétaire était fondée ;
- les bonnes réponses aux défis pèsent autant que les sachets dans l'XP d'un joueur régulier, et ce poids grandit à mesure que les mots nouveaux se raréfient.

## Recommandation

**100 + 45 × (n − 1).** Elle remplit les quatre critères pour le joueur régulier. La base reste à 100 : le premier passage de niveau arrive dès la première séance.

## Complément du 2026-10-23 : la première séance

En recette, le propriétaire est monté au niveau 4 en 5 minutes, avec 2 recharges, à sa première séance. Le modèle ne pouvait pas le voir : il compte en jours, et le joueur régulier ne vide jamais son stock, donc une recharge ne lui rapporte rien.

Ce qui se passait : une recharge remettait le stock au plein, soit 6 sachets. Au début, presque chaque carte est un mot nouveau, donc un sachet rapporte environ 55 XP et une recharge environ 330, plus qu'un niveau en bas de la courbe. Le niveau 2 rechargeait, ces sachets menaient au 4, qui rechargeait à son tour.

Première séance d'un joueur qui ouvre tout ce qu'il a, calculée sur les espérances du barème :

| Réglage | Niveau atteint | Sachets ouverts | Recharges |
|---|---|---|---|
| 100 + 45, recharge aux niveaux pairs | 5 | 16 | 2 |
| 100 + 45, sans recharge | 4 | 9 | 0 |
| 150 + 45, sans recharge | 3 | 8 | 0 |
| 200 + 45, sans recharge | 2 | 7 | 0 |

**Retenu par le propriétaire : plus de recharge dans les récompenses (un sachet bonus à la place) et la courbe 150 + 45 × (n − 1).** La première séance mène au niveau 3. Sur la durée, le joueur régulier atteint le niveau 10 en 5 jours, le 20 en 17, le 50 en 4,2 mois, le 100 en 18 mois : les quatre critères tiennent toujours. L'occasionnel atteint le niveau 10 en 11 jours, l'assidu le 50 en 2 mois.

Ce qu'il reste à vérifier :
- les profils sont des hypothèses : il faudra les recaler sur les vraies données de la bêta ;
- l'assidu atteint le niveau 50 en moins de deux mois. Le propriétaire a voulu plus de cadres et de titres au-delà du niveau 50 pour que ce joueur ait encore de quoi viser.

## Pour reproduire

```bash
pnpm --filter @leximon/core exec vitest run --root ../.. rnd/level-sim
```

Node 24.21, Linux x86_64, 16 cœurs : environ 25 secondes. Le script réécrit `rnd/level-sim/results.md`.
