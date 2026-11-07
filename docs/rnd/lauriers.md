# R&D · Lauriers et ligues

- **Décision liée :** règles P98 (ligues de joute) et P51 (classements), cahier [Joutes, ligues](../cahiers-des-charges/joutes-ligues.md)
- **Dates :** 2026-11-07 → 2026-11-07
- **Question :** le barème des lauriers du cahier (25 / 15, série doublée dès la 3e victoire) étage-t-il les joueurs sur les cinq ligues, ou les plus assidus atteignent-ils tous Champion ?

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Un joueur moyen avance | à 50 % de victoires, un régulier quitte Page dans sa première saison |
| Champion se mérite | à 50 % de victoires, un assidu ne l'atteint pas dès la première saison |
| Champion reste rare | moins de 15 % des jouteurs de la bêta en fin de première saison |
| Les saisons suivantes gardent l'étagement | la part de Champion ne grimpe pas saison après saison |

## Modèle

- **Règles réelles**, importées de `packages/core` : lauriers d'une joute (`joustLaurels`), planchers, départ de saison (`freshStanding`), cote Glicko-2 (`rateGlicko`).
- **Joueurs :** une force cachée ; la chance de victoire suit l'écart de force comme un Elo ; 3 % d'égalités.
- **Habitudes :**

| Habitude | Jours joués | Joutes classées par jour |
|---|---|---|
| Occasionnel | 3 sur 7 | 1 |
| Régulier | 5 sur 7 | 3 |
| Assidu | tous | 5 |
| Acharné | tous | 10 |

- **Deux mesures :** un joueur seul à taux de victoire fixé (médiane sur 200 saisons de 4 semaines), puis une population de 30 jouteurs (la bêta) et de 300, adversaires choisis par la cote, sur 3 saisons (10 tirages).

## Résultats

Tableaux complets : [`rnd/laurels-sim/results.md`](../../rnd/laurels-sim/results.md).

**Un joueur seul, première saison :**

| Réglage | Régulier à 50 % | Assidu à 50 % | Assidu à 60 % |
|---|---|---|---|
| Cahier (série doublée) | Écuyer I (520) | Champion (1 200) | Champion (1 965) |
| Sans série | Écuyer III (350) | Chevalier II (770) | Champion (1 290) |
| **Série à +10** | **Écuyer II (425)** | **Banneret III (945)** | **Champion (1 560)** |

**Bêta de 30 jouteurs, part de Champion en fin de saison :**

| Réglage | Saison 1 | Saison 2 | Saison 3 |
|---|---|---|---|
| Cahier (série doublée) | 20 % | 34 % | 40 % |
| Sans série | 7 % | 16 % | non relevé |
| **Série à +10** | **13 %** | **23 %** | **31 %** |

Avec la série doublée, une série de victoires vaut 50 lauriers par joute : un assidu à 50 % atteint Champion dès la première saison, et un jouteur sur cinq y est en fin de saison 1.

## Recommandation

Remplacer la série doublée par un bonus fixe de **+10 lauriers** par victoire à partir de la troisième d'affilée. La série reste sentie, un assidu moyen finit Banneret et Champion demande de gagner plus souvent qu'on ne perd. C'est le réglage mis dans le code (`LEAGUE_SCHEDULE`).

**Reste à trancher : l'étagement ne tient pas au fil des saisons.** Quel que soit le barème, un assidu repart une ligue plus bas (Banneret, 900) et regagne Champion en quelques jours : il y est à 75 % en saison 2, à 88 % en saison 3, et la part de Champion grimpe de saison en saison (31 % des jouteurs en saison 3). Le barème ne change que la vitesse de cette montée. Trois façons de la freiner, à choisir par le propriétaire :

1. **Repartir de deux ligues plus bas pour Banneret et Champion** (Champion repart en Chevalier, à 600). Les plus forts refont plus de chemin chaque saison, les autres ne voient rien changer. Ma préférence : la règle reste simple à lire.
2. **Un départ fixe pour tous** (tout le monde repart à Écuyer, à 300). Simple, mais un joueur moyen qui avait atteint Chevalier recule autant qu'un Champion.
3. **Un barème qui fléchit en haut** (une victoire en Banneret et Champion ne rapporte que 20). Freine sans toucher au départ, mais la règle à lire s'allonge.

À revoir sur les vraies joutes de la bêta : la part de chaque ligue en fin de première saison, et le nombre de joutes classées par joueur et par jour.

## Pour reproduire

```bash
pnpm --filter @leximon/core exec vitest run --root ../.. rnd/laurels-sim
```

Écrit `rnd/laurels-sim/results.md` en 90 secondes environ. Tirages par graine fixe, résultats identiques d'un passage à l'autre.
