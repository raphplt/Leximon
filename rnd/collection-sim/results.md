# Résultats bruts de la simulation

Généré par rnd/collection-sim/run.test.ts en 61.9 s. Médianes sur 40 joueurs (catalogue entier) et 200 joueurs (collection).

### Boosters généraux, catalogue de 10 000 cartes, horizon 3 ans

| Scénario | 1re Épique | 1re Légendaire (médiane / 90 %) | Courant complets | Peu courant complets | Rare complets | Précieux complets | Épique complets | Légendaire complets | Possédé à 30 j | Possédé à 180 j | Possédé à 365 j | Possédé à 1095 j | Doublons (30 premiers jours) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| occasionnel · actuel · sans échanges | 5 j | 28 j / 119 j | jamais | jamais | jamais | jamais | jamais | jamais | 4 % | 23 % | 41 % | 76 % | 2 % |
| occasionnel · actuel · échanges | 5 j | 31 j / 88 j | 770 j | 715 j | jamais | jamais | jamais | jamais | 4 % | 25 % | 47 % | 90 % | 1 % |
| occasionnel · anti-doublons · sans échanges | 5 j | 28 j / 119 j | jamais | jamais | jamais | jamais | jamais | jamais | 4 % | 23 % | 41 % | 80 % | 2 % |
| occasionnel · anti-doublons · échanges | 5 j | 31 j / 96 j | 769 j | 719 j | jamais | jamais | jamais | jamais | 4 % | 25 % | 47 % | 92 % | 1 % |
| régulier · actuel · sans échanges | 2 j | 11 j / 45 j | jamais | jamais | jamais | jamais | jamais | jamais | 11 % | 50 % | 73 % | 94 % | 6 % |
| régulier · actuel · échanges | 2 j | 11 j / 39 j | 289 j | 270 j | 455 j | 645 j | jamais | jamais | 12 % | 59 % | 88 % | 97 % | 3 % |
| régulier · anti-doublons · sans échanges | 2 j | 11 j / 45 j | jamais | jamais | jamais | 464 j | jamais | jamais | 11 % | 50 % | 76 % | 97 % | 6 % |
| régulier · anti-doublons · échanges | 2 j | 11 j / 38 j | 289 j | 267 j | 453 j | 463 j | jamais | jamais | 12 % | 60 % | 89 % | 98 % | 3 % |
| assidu · actuel · sans échanges | 1 j | 5 j / 18 j | 675 j | 612 j | 1052 j | jamais | jamais | jamais | 26 % | 79 % | 92 % | 98 % | 15 % |
| assidu · actuel · échanges | 1 j | 4 j / 20 j | 116 j | 108 j | 182 j | 258 j | 685 j | jamais | 28 % | 92 % | 96 % | 99 % | 8 % |
| assidu · anti-doublons · sans échanges | 1 j | 5 j / 18 j | 675 j | 612 j | 1052 j | 186 j | 491 j | jamais | 26 % | 83 % | 95 % | 100 % | 15 % |
| assidu · anti-doublons · échanges | 1 j | 4 j / 16 j | 116 j | 108 j | 183 j | 186 j | 498 j | jamais | 28 % | 94 % | 97 % | 100 % | 8 % |

### Boosters par collection, collection de 150 cartes, horizon 1 an

| Scénario | 1re Épique | 1re Légendaire (médiane / 90 %) | Courant complets | Peu courant complets | Rare complets | Précieux complets | Épique complets | Légendaire complets | Possédé à 7 j | Possédé à 30 j | Possédé à 90 j | Possédé à 365 j | Doublons (30 premiers jours) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| occasionnel · actuel · sans échanges | 4 j | 31 j / 99 j | 38 j | 32 j | 48 j | 59 j | 127 j | 216 j | 49 % | 90 % | 98 % | 100 % | 70 % |
| occasionnel · actuel · échanges | 5 j | 36 j / 118 j | 12 j | 11 j | 18 j | 24 j | 64 j | 168 j | 58 % | 95 % | 99 % | 100 % | 68 % |
| occasionnel · anti-doublons · sans échanges | 4 j | 31 j / 99 j | 38 j | 32 j | 48 j | 19 j | 49 j | 122 j | 49 % | 93 % | 99 % | 100 % | 69 % |
| occasionnel · anti-doublons · échanges | 5 j | 39 j / 127 j | 12 j | 11 j | 19 j | 19 j | 48 j | 127 j | 58 % | 96 % | 99 % | 100 % | 68 % |
| régulier · actuel · sans échanges | 2 j | 12 j / 38 j | 15 j | 12 j | 18 j | 22 j | 48 j | 81 j | 80 % | 97 % | 100 % | 100 % | 88 % |
| régulier · actuel · échanges | 2 j | 14 j / 48 j | 5 j | 4 j | 7 j | 9 j | 25 j | 70 j | 91 % | 99 % | 100 % | 100 % | 88 % |
| régulier · anti-doublons · sans échanges | 2 j | 12 j / 38 j | 15 j | 12 j | 18 j | 7 j | 19 j | 46 j | 83 % | 99 % | 100 % | 100 % | 88 % |
| régulier · anti-doublons · échanges | 2 j | 13 j / 44 j | 5 j | 4 j | 7 j | 7 j | 19 j | 47 j | 93 % | 99 % | 100 % | 100 % | 88 % |
| assidu · actuel · sans échanges | 1 j | 5 j / 15 j | 6 j | 5 j | 8 j | 9 j | 19 j | 33 j | 95 % | 99 % | 100 % | 100 % | 95 % |
| assidu · actuel · échanges | 1 j | 5 j / 19 j | 2 j | 2 j | 3 j | 4 j | 10 j | 26 j | 97 % | 100 % | 100 % | 100 % | 95 % |
| assidu · anti-doublons · sans échanges | 1 j | 5 j / 15 j | 6 j | 5 j | 8 j | 3 j | 8 j | 19 j | 97 % | 100 % | 100 % | 100 % | 95 % |
| assidu · anti-doublons · échanges | 1 j | 6 j / 15 j | 2 j | 2 j | 3 j | 3 j | 8 j | 18 j | 98 % | 100 % | 100 % | 100 % | 95 % |

### Taille de collection, joueur régulier (8 boosters/jour) avec échanges, horizon 1 an

| Scénario | 1re Épique | 1re Légendaire (médiane / 90 %) | Courant complets | Peu courant complets | Rare complets | Précieux complets | Épique complets | Légendaire complets | Possédé à 7 j | Possédé à 30 j | Possédé à 90 j | Possédé à 365 j | Doublons (30 premiers jours) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 150 cartes · actuel · échanges | 2 j | 13 j / 46 j | 5 j | 4 j | 7 j | 9 j | 24 j | 70 j | 92 % | 99 % | 100 % | 100 % | 88 % |
| 150 cartes · anti-doublons · échanges | 2 j | 12 j / 36 j | 5 j | 4 j | 7 j | 7 j | 19 j | 47 j | 93 % | 99 % | 100 % | 100 % | 88 % |
| 300 cartes · actuel · échanges | 2 j | 13 j / 47 j | 9 j | 8 j | 14 j | 18 j | 50 j | 146 j | 73 % | 96 % | 99 % | 100 % | 76 % |
| 300 cartes · anti-doublons · échanges | 2 j | 12 j / 44 j | 9 j | 8 j | 13 j | 14 j | 38 j | 111 j | 74 % | 97 % | 99 % | 100 % | 76 % |
| 500 cartes · actuel · échanges | 2 j | 13 j / 46 j | 15 j | 14 j | 23 j | 33 j | 84 j | 243 j | 48 % | 94 % | 99 % | 100 % | 61 % |
| 500 cartes · anti-doublons · échanges | 2 j | 14 j / 40 j | 15 j | 14 j | 23 j | 23 j | 64 j | 174 j | 48 % | 95 % | 99 % | 100 % | 60 % |
| 1000 cartes · actuel · échanges | 2 j | 12 j / 45 j | 29 j | 27 j | 46 j | 63 j | 173 j | jamais | 26 % | 84 % | 96 % | 100 % | 30 % |
| 1000 cartes · anti-doublons · échanges | 2 j | 13 j / 37 j | 29 j | 27 j | 46 j | 47 j | 122 j | 358 j | 26 % | 86 % | 97 % | 100 % | 29 % |

### Collection de 500 cartes, anti-doublons et échanges, tous profils, horizon 2 ans

| Scénario | 1re Épique | 1re Légendaire (médiane / 90 %) | Courant complets | Peu courant complets | Rare complets | Précieux complets | Épique complets | Légendaire complets | Possédé à 30 j | Possédé à 90 j | Possédé à 180 j | Possédé à 365 j | Doublons (30 premiers jours) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| occasionnel · 500 cartes · anti-doublons · échanges | 4 j | 41 j / 107 j | 38 j | 37 j | 59 j | 63 j | 168 j | 501 j | 71 % | 95 % | 98 % | 99 % | 21 % |
| régulier · 500 cartes · anti-doublons · échanges | 2 j | 14 j / 40 j | 15 j | 14 j | 23 j | 23 j | 64 j | 174 j | 95 % | 99 % | 100 % | 100 % | 60 % |
| assidu · 500 cartes · anti-doublons · échanges | 1 j | 5 j / 18 j | 6 j | 6 j | 9 j | 9 j | 25 j | 78 j | 99 % | 100 % | 100 % | 100 % | 84 % |
