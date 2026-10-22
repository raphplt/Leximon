# Rythme des niveaux : résultats

Généré par `rnd/level-sim/run.test.ts`. Médiane sur 40 joueurs simulés, 730 jours. Courbe : passer du niveau n au suivant demande base + pas × (n − 1) XP.

## Joueur occasionnel

| Courbe | Niv. 5 | Niv. 10 | Niv. 15 | Niv. 20 | Niv. 30 | Niv. 50 | Niv. 75 | Niv. 100 |
|---|---|---|---|---|---|---|---|---|
| 100 + 20 × (n − 1) | 2 j | 7 j | 13 j | 22 j | 49 j | 140 j (4.6 mois) | 323 j (10.6 mois) | 583 j (19.2 mois) |
| 100 + 30 × (n − 1) | 2 j | 8 j | 16 j | 29 j | 70 j (2.3 mois) | 204 j (6.7 mois) | 480 j (15.8 mois) | > 730 j |
| 100 + 35 × (n − 1) | 2 j | 8 j | 19 j | 34 j | 80 j (2.6 mois) | 239 j (7.9 mois) | 560 j (18.4 mois) | > 730 j |
| 100 + 40 × (n − 1) | 2 j | 9 j | 21 j | 38 j | 91 j (3.0 mois) | 274 j (9.0 mois) | 635 j (20.9 mois) | > 730 j |
| 150 + 35 × (n − 1) | 3 j | 10 j | 22 j | 38 j | 87 j (2.9 mois) | 254 j (8.4 mois) | 579 j (19.0 mois) | > 730 j |
| 150 + 40 × (n − 1) | 3 j | 11 j | 23 j | 43 j | 99 j (3.3 mois) | 287 j (9.4 mois) | 656 j (21.6 mois) | > 730 j |
| 100 + 45 × (n − 1) | 3 j | 10 j | 23 j | 43 j | 101 j (3.3 mois) | 308 j (10.1 mois) | 713 j (23.5 mois) | > 730 j |
| 125 + 45 × (n − 1) | 3 j | 11 j | 24 j | 44 j | 106 j (3.5 mois) | 315 j (10.4 mois) | 724 j (23.8 mois) | > 730 j |

## Joueur régulier

| Courbe | Niv. 5 | Niv. 10 | Niv. 15 | Niv. 20 | Niv. 30 | Niv. 50 | Niv. 75 | Niv. 100 |
|---|---|---|---|---|---|---|---|---|
| 100 + 20 × (n − 1) | 1 j | 3 j | 5 j | 8 j | 18 j | 54 j | 130 j (4.3 mois) | 242 j (8.0 mois) |
| 100 + 30 × (n − 1) | 1 j | 3 j | 7 j | 11 j | 26 j | 81 j (2.7 mois) | 197 j (6.5 mois) | 365 j (12.0 mois) |
| 100 + 35 × (n − 1) | 1 j | 4 j | 7 j | 13 j | 30 j | 93 j (3.1 mois) | 230 j (7.6 mois) | 425 j (14.0 mois) |
| 100 + 40 × (n − 1) | 1 j | 4 j | 8 j | 14 j | 34 j | 109 j (3.6 mois) | 264 j (8.7 mois) | 485 j (16.0 mois) |
| 150 + 35 × (n − 1) | 2 j | 4 j | 9 j | 14 j | 32 j | 100 j (3.3 mois) | 239 j (7.9 mois) | 437 j (14.4 mois) |
| 150 + 40 × (n − 1) | 2 j | 5 j | 9 j | 16 j | 37 j | 114 j (3.8 mois) | 275 j (9.0 mois) | 500 j (16.4 mois) |
| 100 + 45 × (n − 1) | 2 j | 4 j | 9 j | 16 j | 38 j | 121 j (4.0 mois) | 298 j (9.8 mois) | 546 j (18.0 mois) |
| 125 + 45 × (n − 1) | 2 j | 5 j | 9 j | 17 j | 40 j | 125 j (4.1 mois) | 304 j (10.0 mois) | 554 j (18.2 mois) |

## Joueur assidu

| Courbe | Niv. 5 | Niv. 10 | Niv. 15 | Niv. 20 | Niv. 30 | Niv. 50 | Niv. 75 | Niv. 100 |
|---|---|---|---|---|---|---|---|---|
| 100 + 20 × (n − 1) | 1 j | 2 j | 2 j | 3 j | 6 j | 22 j | 59 j | 115 j (3.8 mois) |
| 100 + 30 × (n − 1) | 1 j | 2 j | 2 j | 4 j | 10 j | 35 j | 93 j (3.1 mois) | 176 j (5.8 mois) |
| 100 + 35 × (n − 1) | 1 j | 2 j | 3 j | 5 j | 12 j | 42 j | 112 j (3.7 mois) | 207 j (6.8 mois) |
| 100 + 40 × (n − 1) | 1 j | 2 j | 3 j | 5 j | 14 j | 50 j | 127 j (4.2 mois) | 237 j (7.8 mois) |
| 150 + 35 × (n − 1) | 1 j | 2 j | 3 j | 5 j | 13 j | 45 j | 114 j (3.8 mois) | 213 j (7.0 mois) |
| 150 + 40 × (n − 1) | 1 j | 2 j | 3 j | 6 j | 15 j | 53 j | 132 j (4.3 mois) | 244 j (8.0 mois) |
| 100 + 45 × (n − 1) | 1 j | 2 j | 3 j | 6 j | 16 j | 56 j | 143 j (4.7 mois) | 268 j (8.8 mois) |
| 125 + 45 × (n − 1) | 1 j | 2 j | 3 j | 6 j | 16 j | 57 j | 145 j (4.8 mois) | 272 j (8.9 mois) |
