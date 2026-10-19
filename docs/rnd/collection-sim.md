# R&D · Simulation de collection

- **Décision liée :** décisions produit P10 à P12 (north star). Aucune décision technique encore.
- **Dates :** 2026-10-19 → 2026-10-19
- **Suite donnée :** boosters par collection et booster découverte (P14), pas d'anti-doublons (P15), garanties Épique au 40e et Légendaire au 150e (P12). Voir le calibrage ci-dessous.
- **Question :** quels réglages de boosters et de doublons donnent une progression de collection satisfaisante pour un joueur occasionnel, régulier et assidu, avec un catalogue d'au moins 10 000 mots ?

## Critères

Objectifs « Équilibré », pour un joueur régulier (8 boosters par jour) :

| Critère | Seuil d'acceptation |
|---|---|
| Première carte Épique | avant 3 jours |
| Première carte Légendaire | avant 4 semaines (médiane) |
| Cartes Courant complètes | environ 2 semaines |
| Collection complète | 4 à 6 mois |

## Modèle

- **Règles de tirage réelles**, importées de `packages/core` : probabilités P11, carte Peu courant ou mieux garantie, Précieux garanti au 10e booster (P12).
- **Pyramide du catalogue :** Courant 40 %, Peu courant 25 %, Rare 17 %, Précieux 10 %, Épique 6 %, Légendaire 2 %.
- **Profils :** occasionnel 3 boosters par jour, régulier 8, assidu 20. Le stock de 6 avec une recharge toutes les 30 minutes permet jusqu'à 48 boosters par jour.
- **Échanges (modèle simple) :** la moitié des doublons finit par s'échanger contre une carte manquante de même rareté.
- **Médianes** sur 40 joueurs simulés (catalogue entier) et 100 à 200 joueurs (collections).

## Options testées

1. **Structure des boosters :**
   - boosters généraux tirés dans tout le catalogue (10 000 cartes) ;
   - boosters par collection, avec des collections de 150, 300, 500 ou 1 000 cartes.
2. **Choix de la carte dans une rareté :**
   - règle actuelle : tirage uniforme ;
   - **anti-doublons** : à partir de Précieux, on tire en priorité une carte que le joueur ne possède pas encore.
3. **Échanges :** avec ou sans.

## Résultats

Les tableaux complets sont dans [rnd/collection-sim/results.md](../../rnd/collection-sim/results.md). L'essentiel :

**Boosters généraux sur 10 000 cartes : objectif inatteignable.**

| Joueur, avec anti-doublons et échanges | Possédé à 1 an | Possédé à 3 ans | Légendaires complètes |
|---|---|---|---|
| Régulier | 89 % | 98 % | jamais en 3 ans |
| Assidu | 97 % | 100 % | jamais en 3 ans |

La raison est arithmétique : 200 Légendaires à 0,6 % par booster demandent plus de boosters qu'un joueur n'en ouvre en 3 ans.

**Boosters par collection, joueur régulier, avec échanges :**

| Taille | 1re Légendaire (médiane / 90 % des joueurs) | Courant complets | Collection complète (actuel) | Collection complète (anti-doublons) |
|---|---|---|---|---|
| 150 | 12 j / 36 j | 5 j | 70 j | 47 j |
| 300 | 12 j / 44 j | 9 j | 146 j | 111 j |
| **500** | **14 j / 40 j** | **15 j** | 243 j | **174 j (5,8 mois)** |
| 1 000 | 13 j / 37 j | 29 j | plus d'un an | 358 j |

**Collection de 500 cartes, anti-doublons et échanges, selon le profil :**

| Profil | 1re Épique | 1re Légendaire | Possédé à 30 j | Collection complète |
|---|---|---|---|---|
| Occasionnel | 4 j | 41 j | 71 % | 501 j (16 mois) |
| Régulier | 2 j | 14 j | 95 % | 174 j (5,8 mois) |
| Assidu | 1 j | 5 j | 99 % | 78 j (2,6 mois) |

**Effets mesurés :**
- **Anti-doublons :** réduit d'environ 30 % le temps pour compléter les raretés hautes (Légendaires d'une collection de 500 : 243 → 174 jours). Ne change rien à l'arrivée des premières Épique et Légendaire.
- **Échanges :** divisent environ par 3 le temps pour compléter les raretés basses (Courants d'une collection de 150 : 15 → 5 jours). C'est la mécanique qui compte le plus pour le début de collection.
- **Garantie Précieux au 10e :** aucun effet visible, ce qui confirme le calcul de la relecture (elle se déclenche dans 1,4 % des boosters).

## Recommandation

**Des boosters par collection, avec des collections d'environ 500 cartes, et l'anti-doublons à partir de Précieux.**
- C'est la seule combinaison testée qui tient tous les objectifs « Équilibré » pour le joueur régulier.
- Le catalogue de 10 000 mots devient une vingtaine de collections, publiées au fil du temps : des années de contenu, sans objectif de complétion inatteignable.
- Une ou deux collections suffisent au lancement : chacune occupe un joueur régulier environ 6 mois. Le chantier éditorial du lancement est donc de 500 à 1 000 cartes validées, pas 10 000.

**Il reste à vérifier :**
- **La première Légendaire :** 10 % des joueurs réguliers l'attendent plus de 40 jours. Une garantie de Légendaire (par exemple au 100e booster) plafonnerait cette attente. Non testée ici.
- **La fin de collection :** à 30 jours, un régulier possède déjà 95 % d'une collection de 500. Les 5 mois suivants reposent uniquement sur la chasse aux raretés hautes. Il faudra voir si cette fin de collection tient l'intérêt, ou s'il faut plus de cartes dans les raretés intermédiaires.
- **Le modèle d'échange** (50 % des doublons) est une hypothèse, à recaler sur les données réelles après le lancement.
- **Les boosters généraux** peuvent rester comme booster « découverte », mais sans objectif de complétion.

## Calibrage des garanties Épique et Légendaire

Second passage, avec les décisions prises après le premier : collections de 500 cartes, sans anti-doublons, avec échanges. Les tableaux complets sont dans [rnd/collection-sim/calibration.md](../../rnd/collection-sim/calibration.md).

**Joueur régulier (8 boosters par jour) :**

| Garanties | 1re Légendaire (médiane / 90 % / 99 %) | Légendaires pour 100 boosters | Légendaires complètes |
|---|---|---|---|
| Aucune | 13 j / 40 j / 116 j | 0,65 | 246 j |
| Épique 30 · Légendaire 100 | 12 j / 13 j / 13 j | 1,41 | 118 j |
| **Épique 40 · Légendaire 150** | **13 j / 19 j / 19 j** | **1,06** | **153 j** |
| Épique 40 · Légendaire 200 | 13 j / 25 j / 25 j | 0,93 | 180 j |
| Épique 50 · Légendaire 200 | 13 j / 25 j / 25 j | 0,91 | 182 j |

**Constats :**
- **La garantie Épique change peu de chose :** une Épique sort naturellement dans 6 % des boosters. Elle ne fait que couper les rares séries de malchance.
- **La garantie Légendaire est le vrai réglage.** Elle supprime la longue traîne d'attente (116 jours pour 1 % des réguliers sans garantie), mais augmente le nombre de Légendaires en circulation : deux fois plus au 100e booster, ce qui les banalise et fait tomber la collection complète sous les 4 mois.
- **Au 150e :** chaque joueur régulier a sa première Légendaire en 19 jours au plus, la collection se complète en environ 5 mois, et la Légendaire reste rare (environ 1 pour 94 boosters).
- **Selon le profil**, avec ces réglages, la première Légendaire arrive au plus tard au bout de 50 jours pour un occasionnel et 8 jours pour un assidu.

## Pour reproduire

```bash
pnpm --filter @leximon/core exec vitest run --root ../.. rnd/collection-sim/run
pnpm --filter @leximon/core exec vitest run --root ../.. rnd/collection-sim/calibrate
```

Environ 1 minute chacun sur un PC Linux x86_64, Node 24.21. Les scripts régénèrent `results.md` et `calibration.md` dans `rnd/collection-sim/`. Le premier passage garde les règles de l'époque (Précieux au 10e) pour rester reproductible. Les tirages sont déterministes (graines fixes), donc les résultats sont identiques d'un passage à l'autre.
