# Rythme des niveaux : résultats

Généré par `rnd/level-sim/run.test.ts`. Médiane sur 40 joueurs simulés, 730 jours. Courbe : passer du niveau n au suivant demande base + pas × (n − 1) XP.

## Joueur occasionnel

| Courbe | Niv. 5 | Niv. 10 | Niv. 15 | Niv. 20 | Niv. 30 | Niv. 50 | Niv. 75 | Niv. 100 |
|---|---|---|---|---|---|---|---|---|
| 100 + 20 × (n − 1) | 2 j | 6 j | 11 j | 20 j | 46 j | 136 j (4.5 mois) | 321 j (10.6 mois) | 580 j (19.1 mois) |
| 100 + 30 × (n − 1) | 2 j | 7 j | 15 j | 28 j | 68 j (2.2 mois) | 203 j (6.7 mois) | 477 j (15.7 mois) | > 730 j |
| 100 + 35 × (n − 1) | 2 j | 8 j | 17 j | 32 j | 78 j (2.6 mois) | 235 j (7.7 mois) | 555 j (18.3 mois) | > 730 j |
| 100 + 40 × (n − 1) | 2 j | 8 j | 20 j | 36 j | 88 j (2.9 mois) | 269 j (8.8 mois) | 632 j (20.8 mois) | > 730 j |
| 150 + 35 × (n − 1) | 3 j | 9 j | 21 j | 37 j | 85 j (2.8 mois) | 252 j (8.3 mois) | 575 j (18.9 mois) | > 730 j |
| 150 + 40 × (n − 1) | 3 j | 10 j | 23 j | 42 j | 97 j (3.2 mois) | 284 j (9.3 mois) | 652 j (21.4 mois) | > 730 j |
| 100 + 45 × (n − 1) | 2 j | 9 j | 22 j | 41 j | 99 j (3.3 mois) | 306 j (10.1 mois) | 708 j (23.3 mois) | > 730 j |
| 125 + 45 × (n − 1) | 3 j | 10 j | 23 j | 43 j | 104 j (3.4 mois) | 311 j (10.2 mois) | 721 j (23.7 mois) | > 730 j |
| 150 + 45 × (n − 1) | 3 j | 11 j | 25 j | 45 j | 108 j (3.6 mois) | 317 j (10.4 mois) | 730 j (24.0 mois) | > 730 j |

## Joueur régulier

| Courbe | Niv. 5 | Niv. 10 | Niv. 15 | Niv. 20 | Niv. 30 | Niv. 50 | Niv. 75 | Niv. 100 |
|---|---|---|---|---|---|---|---|---|
| 100 + 20 × (n − 1) | 1 j | 3 j | 5 j | 8 j | 17 j | 53 j | 129 j (4.2 mois) | 241 j (7.9 mois) |
| 100 + 30 × (n − 1) | 1 j | 3 j | 6 j | 11 j | 25 j | 80 j (2.6 mois) | 197 j (6.5 mois) | 364 j (12.0 mois) |
| 100 + 35 × (n − 1) | 1 j | 3 j | 7 j | 12 j | 29 j | 92 j (3.0 mois) | 229 j (7.5 mois) | 424 j (13.9 mois) |
| 100 + 40 × (n − 1) | 1 j | 4 j | 8 j | 14 j | 33 j | 108 j (3.6 mois) | 263 j (8.7 mois) | 484 j (15.9 mois) |
| 150 + 35 × (n − 1) | 2 j | 4 j | 8 j | 14 j | 32 j | 99 j (3.3 mois) | 238 j (7.8 mois) | 436 j (14.3 mois) |
| 150 + 40 × (n − 1) | 2 j | 4 j | 9 j | 15 j | 36 j | 113 j (3.7 mois) | 274 j (9.0 mois) | 498 j (16.4 mois) |
| 100 + 45 × (n − 1) | 2 j | 4 j | 8 j | 15 j | 37 j | 120 j (3.9 mois) | 298 j (9.8 mois) | 546 j (18.0 mois) |
| 125 + 45 × (n − 1) | 2 j | 4 j | 9 j | 16 j | 39 j | 123 j (4.0 mois) | 303 j (10.0 mois) | 553 j (18.2 mois) |
| 150 + 45 × (n − 1) | 2 j | 5 j | 10 j | 17 j | 41 j | 127 j (4.2 mois) | 308 j (10.1 mois) | 560 j (18.4 mois) |

## Joueur assidu

| Courbe | Niv. 5 | Niv. 10 | Niv. 15 | Niv. 20 | Niv. 30 | Niv. 50 | Niv. 75 | Niv. 100 |
|---|---|---|---|---|---|---|---|---|
| 100 + 20 × (n − 1) | 1 j | 2 j | 2 j | 4 j | 8 j | 25 j | 61 j (2.0 mois) | 116 j (3.8 mois) |
| 100 + 30 × (n − 1) | 1 j | 2 j | 3 j | 5 j | 12 j | 37 j | 94 j (3.1 mois) | 177 j (5.8 mois) |
| 100 + 35 × (n − 1) | 1 j | 2 j | 3 j | 6 j | 13 j | 44 j | 112 j (3.7 mois) | 208 j (6.8 mois) |
| 100 + 40 × (n − 1) | 1 j | 2 j | 4 j | 6 j | 15 j | 52 j | 128 j (4.2 mois) | 239 j (7.9 mois) |
| 150 + 35 × (n − 1) | 1 j | 2 j | 4 j | 7 j | 15 j | 47 j | 115 j (3.8 mois) | 215 j (7.1 mois) |
| 150 + 40 × (n − 1) | 1 j | 2 j | 4 j | 7 j | 17 j | 55 j | 134 j (4.4 mois) | 246 j (8.1 mois) |
| 100 + 45 × (n − 1) | 1 j | 2 j | 4 j | 7 j | 17 j | 58 j | 144 j (4.7 mois) | 270 j (8.9 mois) |
| 125 + 45 × (n − 1) | 1 j | 2 j | 4 j | 8 j | 18 j | 59 j | 147 j (4.8 mois) | 273 j (9.0 mois) |
| 150 + 45 × (n − 1) | 1 j | 2 j | 5 j | 8 j | 19 j | 60 j (2.0 mois) | 149 j (4.9 mois) | 277 j (9.1 mois) |
