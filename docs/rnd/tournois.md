# R&D · Tournois de la semaine

- **Décision liée :** règle P98 (ligues de joute), cahier [Joutes, ligues](../cahiers-des-charges/joutes-ligues.md), lot 3 bis
- **Dates :** 2026-11-07 → 2026-11-07
- **Question :** avec des groupes de 30 complétés par des automates, 5 joutes classées par jour et 3 points la victoire, quel barème d'automates et quelles montées étagent les jouteurs sur les sept ligues, en laissant le niveau compter autant que l'assiduité ?

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Un joueur moyen avance | un régulier à 50 % de victoires quitte Page dès la première semaine |
| Le niveau compte | à assiduité égale, les plus forts finissent plusieurs ligues au-dessus des plus faibles |
| Champion se mérite | à 50 % de victoires, un assidu seul parmi les automates n'atteint pas Champion |
| Champion reste rare | quelques pour cent des jouteurs au bout de trois mois |

## Modèle

- **Règles réelles**, importées de `packages/core` : groupes et automates (`groupStandings`, `botsOf`), montées et descentes (`moveOf`), cote Glicko-2 (`rateGlicko`).
- **Joueurs :** une force cachée ; la chance de victoire suit l'écart de force comme un Elo ; 3 % d'égalités.
- **Habitudes :**

| Habitude | Jours joués | Joutes classées par jour |
|---|---|---|
| Occasionnel | 3 sur 7 | 1 |
| Régulier | 5 sur 7 | 3 |
| Assidu | tous | 5 (la limite) |

- **Adversaire :** quelqu'un de sa ligue si possible, puis la cote la plus proche, parmi ceux qui joutent ce jour-là et ont encore des joutes classées, une fois par paire et par jour.
- **Deux mesures :** un joueur seul dans des groupes d'automates, à taux de victoire fixé (la bêta, où les groupes sont presque vides), puis une population de 30 jouteurs et de 300, sur 12 semaines (10 tirages).

## Résultats

Tableaux complets : [`rnd/tournament-sim/results.md`](../../rnd/tournament-sim/results.md).

**Un joueur seul parmi les automates, ligue médiane après 12 semaines :**

| Habitude | 40 % | 50 % | 60 % | 70 % |
|---|---|---|---|---|
| Occasionnel | Page | Page | Page | Écuyer |
| Régulier | Écuyer | Chevalier | Chevalier | Chevalier |
| Assidu | Banneret | Maréchal | Connétable | Champion |

**300 jouteurs, semaine 12 :**

| Joueurs | Page | Écuyer | Chevalier | Banneret | Maréchal | Connétable | Champion |
|---|---|---|---|---|---|---|---|
| tous | 13 % | 29 % | 28 % | 17 % | 9 % | 3 % | 0 % |
| assidus, tiers le plus faible | 0 % | 0 % | 1 % | 47 % | 49 % | 4 % | 0 % |
| assidus, tiers le plus fort | 0 % | 0 % | 0 % | 10 % | 46 % | 35 % | 9 % |

À 30 jouteurs, les assidus les plus forts atteignent Champion bien plus souvent (44 % d'entre eux en semaine 12), parce qu'ils rencontrent surtout des joueurs plus faibles et gagnent davantage.

## Conclusion

Le barème des automates retenu (`LEAGUE_SCHEDULE`) : points sur la semaine en moyenne 5 en Page, 20 en Écuyer, puis 10 de plus par ligue jusqu'à 70 en Champion, avec un écart de 5 à 12. Une semaine parfaite vaut 105 points.

- On monte d'une ligue par semaine au plus : Champion se gagne en six semaines au plus tôt.
- Un régulier à 50 % finit Chevalier, un assidu à 50 % Maréchal ; Champion demande 7 victoires sur 10 face aux automates, ou d'être parmi les plus forts.
- Le niveau compte : choisir l'adversaire dans sa ligue d'abord fait gagner plus souvent un joueur fort placé trop bas, qui monte jusqu'à rencontrer ses pareils.
- Les occasionnels restent entre Page et Écuyer : à 3 joutes par semaine, ils ne peuvent guère aller plus haut.

À revoir sur les vraies joutes de la bêta : la part de chaque ligue, les points des joueurs par semaine comparés à ceux des automates, et le nombre de joutes classées par jour.

## Pour reproduire

```bash
pnpm --filter @leximon/core exec vitest run --root ../.. rnd/tournament-sim
```

Écrit `rnd/tournament-sim/results.md` en 40 secondes environ. Tirages par graine fixe, résultats identiques d'un passage à l'autre.
