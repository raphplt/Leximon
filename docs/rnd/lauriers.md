# R&D · Lauriers et ligues

> Remplacé le 2026-11-07 par les tournois de la semaine ([tournois.md](tournois.md)). Le code de cette simulation correspond aux règles du commit cb8d7a4 et ne tourne plus sur les règles actuelles.

- **Décision liée :** règles P98 (ligues de joute) et P51 (classements), cahier [Joutes, ligues](../cahiers-des-charges/joutes-ligues.md)
- **Dates :** 2026-11-07 → 2026-11-07
- **Question :** le barème des lauriers du cahier (25 / 15, série doublée dès la 3e victoire) étage-t-il les joueurs sur les cinq ligues, ou les plus assidus atteignent-ils tous Champion ? Et, saison après saison, quel départ de saison ou quel barème garde l'étagement ?

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

- **Deux mesures :** un joueur seul à taux de victoire fixé (médiane sur 200 saisons de 4 semaines), puis une population de 30 jouteurs (la bêta) et de 300, adversaires choisis par la cote, sur 4 saisons (10 tirages).

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

## Première conclusion : la série à +10

Remplacer la série doublée par un bonus fixe de **+10 lauriers** par victoire à partir de la troisième d'affilée. La série reste sentie, un assidu moyen finit Banneret en première saison et Champion demande de gagner plus souvent qu'on ne perd.

## Saison après saison : la défaite qui grandit avec la ligue

Avec une défaite à 15 dans toutes les ligues, l'étagement ne tient pas. Une victoire rapporte 25 et une défaite en coûte 15 : à une victoire sur deux, un joueur gagne environ 5 lauriers par joute, plus ses séries, et le plancher l'empêche de rechuter. **La ligue mesure alors combien on joue plutôt que comment on joue.** Un assidu repart une ligue plus bas (Banneret, 900), regagne Champion en quelques jours, et la part de Champion grimpe de saison en saison.

Plusieurs réglages comparés, 300 jouteurs, 4 saisons (8 pour le réglage retenu) :

| Réglage | Champion parmi tous les jouteurs, S1 → S4 | Assidus Champion en S4 | Remarque |
|---|---|---|---|
| Défaite à 15, une ligue plus bas | 10 → 28 % | 99 % | grimpe chaque saison |
| Défaite à 15, deux ligues plus bas pour Banneret et Champion | 10 → 21 % | 97 % | freine peu |
| Défaite à 15, départ fixe à Écuyer | 10 → 18 % | 76 % | Page se vide ; un Chevalier recule autant qu'un Champion |
| Victoire à 20 seulement en Banneret et Champion | 8 → 23 % | 96 % | presque sans effet |
| Défaite à 20 partout | 0 → 4 % | 2 % | trop dur : deux tiers des jouteurs restent en Page |
| Défaite de 15 à 27 selon la ligue (+3 par ligue) | 5 → 16 % | 68 % | |
| **Défaite de 15 à 30 selon la ligue** | **3 → 11 %** (14 % en S8) | **37 %** (58 % en S8) | **retenu** |
| Défaite de 15 à 30 et deux ligues plus bas pour le haut | 3 → 6 % | 8 % | Champion presque hors d'atteinte |

Changer le départ de saison ne fait que ralentir la montée : tant qu'une saison à 50 % de victoires rapporte des lauriers, un assidu finit par regagner Champion. C'est le barème qui doit cesser d'être gagnant à 50 % de victoires dans les ligues hautes.

**Retenu par le propriétaire le 2026-11-07 :** une défaite coûte plus à chaque ligue, **15 lauriers en Page, 20 en Écuyer, 23 en Chevalier, 26 en Banneret et 30 en Champion** (chaque fois de 10 de moins à 10 de plus selon la cote de l'adversaire). Le départ de saison reste « une ligue plus bas », plus simple à lire. Dès Banneret, une défaite coûte autant ou plus qu'une victoire ne rapporte : à une victoire sur deux, on s'y arrête, et Champion demande de gagner plus souvent qu'on ne perd.

Ce que ça donne (tableaux complets dans les résultats, réglage « retenu ») :

- un régulier à 50 % quitte Page dès sa première saison (Écuyer III, 380) ;
- un assidu à 50 % finit Chevalier II (700) ; à 60 %, Champion (1 247) ;
- la part de Champion monte à 3 %, 7 %, 10 %, 11 % des jouteurs, et se stabilise vers 14 % ;
- les occasionnels restent en Page ou en Écuyer : à 12 joutes par saison, ils ne peuvent guère aller plus haut.

À revoir sur les vraies joutes de la bêta : la part de chaque ligue en fin de saison, et le nombre de joutes classées par joueur et par jour.

## Pour reproduire

```bash
pnpm --filter @leximon/core exec vitest run --root ../.. rnd/laurels-sim
```

Écrit `rnd/laurels-sim/results.md` en deux minutes environ. Les comparaisons de départ de saison ont été faites une fois, par un script jetable sur le même modèle. Tirages par graine fixe, résultats identiques d'un passage à l'autre.
