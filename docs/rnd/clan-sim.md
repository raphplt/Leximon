# R&D · Rythme des clans

- **Décision liée :** règles P66 (objectif de la semaine) et P70 (niveau de clan), cahier [Clan v2](../cahiers-des-charges/clan-v2.md)
- **Dates :** 2026-10-22 → 2026-10-22
- **Question :** les cibles par membre actif et la courbe de niveau du cahier donnent-elles un objectif qui demande la bande, et un niveau qui monte sur des mois ?

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| L'or ne se remplit pas seul | personne ne fait l'or seul, quel que soit le clan |
| L'or demande des réguliers | atteint presque chaque semaine par un clan de réguliers, rarement par des occasionnels |
| L'enluminure se mérite | atteinte certaines semaines par un clan avec des assidus, pas acquise |
| Niveau 10 (première bannière) | quelques mois pour un petit clan régulier, moins pour un grand |

## Modèle

- **Règles réelles**, importées de `packages/core` : cibles (`goalTargets`), paliers, XP de la semaine plafonnée par membre (`weekXp`), niveau et déblocages (`clanLevelOf`, `clanUnlocks`, dont l'enluminure au niveau 5).
- **Profils** repris de la [simulation des niveaux](level-sim.md), en bonnes réponses par séance de défi :

| Profil | Jours joués | Bonnes réponses par séance | Par semaine, en moyenne |
|---|---|---|---|
| Occasionnel | 3 sur 7 | 4 | 12 |
| Régulier | tous | 8 | 56 |
| Assidu | tous | 20 | 140 |

- **Clans :** 3 amis (1 régulier, 2 occasionnels), 3 réguliers, 8 membres mêlés (2 assidus, 3 réguliers, 3 occasionnels), 5 réguliers, 30 membres mêlés (4 assidus, 10 réguliers, 16 occasionnels), 30 réguliers.
- **Simplifications :** tous les membres comptent comme actifs (un occasionnel a presque toujours joué la semaine d'avant) ; le nombre de réponses d'une séance varie de ± 50 % ; personne n'entre ni ne part.
- **Mesure :** médiane sur 40 clans tirés au sort par profil, 156 semaines chacun.

## Résultats

Tableaux complets : [`rnd/clan-sim/results.md`](../../rnd/clan-sim/results.md).

**Paliers (cibles 15, 30, 50 et 60 par membre actif), part des semaines :**

| Clan | Argent | Or | Enluminure | Or fait seul |
|---|---|---|---|---|
| 3 amis | 18 % | 0 % | 0 % | 0 % |
| 3 réguliers | 100 % | 96 % | 13 % | 0 % |
| 8 mêlés | 100 % | 100 % | 55 % | 0 % |
| 5 réguliers | 100 % | 99 % | 6 % | 0 % |
| 30 mêlés | 100 % | 0 % | 0 % | 0 % |
| 30 réguliers | 100 % | 100 % | 0 % | 0 % |

Avec 80 pour l'enluminure, comme le proposait le cahier, aucun clan ne l'atteignait jamais (0 % partout) : la cible passe à 60.

**Niveau 10, selon la courbe (passer de n à n + 1 coûte base + pas × (n − 1)) :**

| Clan | 500 + 150 | **500 + 250** | 300 + 200 | 500 + 400 |
|---|---|---|---|---|
| 3 réguliers | 4,4 mois | **6,0 mois** | 4,4 mois | 8,0 mois |
| 8 mêlés | 2,8 mois | **3,7 mois** | 2,8 mois | 5,1 mois |
| 5 réguliers | 3,7 mois | **4,8 mois** | 3,7 mois | 6,9 mois |
| 30 mêlés | 8 sem. | **2,5 mois** | 8 sem. | 3,4 mois |
| 30 réguliers | 5 sem. | **7 sem.** | 5 sem. | 2,3 mois |

Avec 500 + 250, le niveau 5 (enluminure) arrive en 5 à 7 semaines pour un clan régulier, le niveau 20 entre 6 et 22 mois.

## Recommandation

Garder la courbe 500 + 250 et les cibles 15, 30 et 50, et passer l'enluminure de 80 à 60. Personne ne remplit l'or seul, un clan de réguliers le touche presque chaque semaine, et l'enluminure reste une bonne semaine plutôt qu'une habitude. Le niveau 10 tombe entre 2 et 6 mois selon la taille du clan.

À surveiller avec de vrais joueurs : un grand clan où les occasionnels dominent n'atteint jamais l'or (30 mêlés : 0 %), car chaque occasionnel compte comme membre actif mais n'apporte que 12 réponses. Si c'est un problème, il faudra resserrer la définition du membre actif plutôt que baisser les cibles.

## Pour reproduire

```bash
pnpm --filter @leximon/core exec vitest run --root ../.. rnd/clan-sim
```

Écrit `rnd/clan-sim/results.md`. Tirages par graine fixe, résultats identiques d'un passage à l'autre.
