# R&D · Équilibrage d'ensemble des récompenses

- **Décision liée :** règles P10, P29, P58, P84 à P86, P93 à P96, P98 ; cahiers [economie.md](../cahiers-des-charges/economie.md) et [saison.md](../cahiers-des-charges/saison.md).
- **Dates :** 2026-11-08 → 2026-11-08
- **Question :** avec la saison en plus du défi du jour, des missions, du carnet, des joutes, du clan, des niveaux et de l'horloge à un sachet par heure et 8 en stock, un joueur reçoit-il trop de sachets et d'écus ?

## Critères

Repris de [doublons.md](doublons.md) et du cahier de l'économie :

| Critère | Seuil d'acceptation |
|---|---|
| Une rareté haute se mérite | Joueur régulier : 4 à 8 semaines d'écus pour une Légendaire |
| Les sachets gagnés en jouant pèsent | 30 % des sachets environ |
| Les plus assidus ne s'envolent pas | 25 sachets par jour au plus |
| La collection reste un objectif long | Joueur régulier : plus de 300 jours pour tout compléter |

## Modèle

Simulation de `rnd/economie-sim/sim.py`, sur le catalogue local du 2026-11-08 (quatre collections, 2 065 cartes) et les règles réelles du tirage : probabilités P11, une carte Peu courant ou mieux par sachet, garanties au 40e et au 150e sachet, sachet garni (une Rare ou mieux) et garni Précieux (une Précieuse ou mieux).

- **Sources de sachets :** horloge, défi du jour, trois missions faites, première victoire de joute, clan, semaine de bienvenue puis carnet, saison, niveaux (un sachet par niveau, un garni tous les 5), Dorures, montées de ligue.
- **Sources d'écus :** recyclage chaque jour avec « Garder un double », missions, sans-faute, carnet, saison, ligue, paliers de série. Le joueur achète le mot manquant le plus rare qu'il peut se payer, sans épargner.
- **Profils (hypothèses) :**

| Profil | Passages | Défi, missions, joutes | Dorures par jour, après 40 jours |
|---|---|---|---|
| Occasionnel | à 20 h, un jour sur deux | défi 4 fois sur 5, 1,5 mission | 0,1 |
| Régulier | à 8 h et 20 h | défi chaque jour, 2,4 missions, 1 joute | 0,5 |
| Appliqué | à 8 h, 13 h et 20 h | défi, 2,8 missions, 2 joutes | 0,8 |
| Assidu | toutes les heures de 8 h à 23 h | tout, 5 joutes | 2 |

- **Vétéran :** le même profil, 35 jours sur les trois collections de lancement, puis Bêtes et plantes s'ouvre avec sa saison.
- **Mesure :** médiane de 8 joueurs simulés, jours 8 à 28 (hors semaine de bienvenue).

## Résultats

**Aujourd'hui, avec la saison (horloge à une heure, 8 en stock) :**

| Profil | Sachets par jour | dont horloge | Écus par jour | Jours d'écus pour une Légendaire | Catalogue à J28 | J90 |
|---|---|---|---|---|---|---|
| Occasionnel | 5,1 | 75 % | 15 | 105 | 30 % | 60 % |
| Régulier | 19,5 | 82 % | 90 | 18 | 66 % | 90 % |
| Appliqué | 24,2 | 83 % | 122 | 13 | 71 % | 93 % |
| Assidu | 27,9 | 82 % | 147 | 11 | 75 % | 95 % |

**Sans la saison,** l'appliqué reçoit 23,5 sachets et 107 écus par jour : la saison ajoute environ 0,5 sachet et 14 écus par jour.

**Variantes de l'horloge,** saison comprise :

| Horloge | Occasionnel | Régulier | Appliqué | Assidu | Légendaire, régulier | Part gagnée en jouant, régulier |
|---|---|---|---|---|---|---|
| 30 min, 6 en stock | 4,2 | 15,5 | 22,1 | 40,9 | 22 j | 23 % |
| 1 h, 8 en stock (aujourd'hui) | 5,1 | 19,5 | 24,2 | 27,9 | 18 j | 18 % |
| 1 h 30, 8 en stock | 5,1 | 19,5 | 20,2 | 20,9 | 18 j | 18 % |
| 2 h, 6 en stock | 4,2 | 15,5 | 16,2 | 17,0 | 22 j | 23 % |
| 2 h, 8 en stock | 5,1 | 15,5 | 16,2 | 17,0 | 22 j | 23 % |
| 2 h, 8 en stock, Épique 800 et Légendaire 3 200 écus | 5,1 | 15,5 | 16,2 | 17,0 | 44 j | 23 % |

**Ce que l'horloge donne selon les passages,** en sachets par jour : un stock qui se remplit en 12 heures ou plus (2 h et 6, 2 h et 8, 1 h 30 et 8) donne tout au joueur qui passe matin et soir, et rien de plus à celui qui revient toutes les heures. À 30 min et 6 en stock, matin et soir donnent 12 sachets, mais toutes les heures en donnent 36.

**Vétéran, part de Bêtes et plantes possédée :** à une heure et 8 en stock, le régulier en a 63 % au bout d'une semaine, 79 % en deux, 84 % en quatre ; à 2 h et 8 en stock, 58 %, 74 % et 80 %. Les doublons freinent seuls la fin d'une collection : ce qui la fait durer, ce sont les Épiques, les Légendaires et leur prix en écus.

**Enseignements :**

1. **Le total dépasse ce sur quoi les écus ont été calés** (un régulier à 8 sachets et 34 écus par jour) : une Légendaire coûte 2 à 3 semaines d'écus, sous la cible de 4 à 8. Le critère des plus assidus (25 sachets par jour au plus) n'est pas tenu.
2. **L'horloge fait plus de 80 % des sachets.** Tous les systèmes qui récompensent le jeu (défi, missions, joute, clan, carnet, saison, niveaux, Dorures) en font moins de 20 %, sous la cible de 30 %.
3. **La saison n'est pas la source du trop-plein :** 0,5 sachet par jour, un dixième des écus.
4. **Le recyclage fait la moitié des écus ou plus** chez les joueurs installés : moins de sachets, c'est aussi moins d'écus.

## Recommandation

Un sachet toutes les 2 heures, 8 en stock : un passage par jour garde ses 8 sachets, matin et soir en donnent 12, le maximum ; revenir toutes les heures ne sert plus. Les sachets gagnés en jouant montent vers 25 à 30 %. Et l'Épique à 800 écus, la Légendaire à 3 200, les autres prix inchangés, pour une Légendaire en 6 semaines d'écus environ.

Limites : les profils et le rythme des Dorures sont des hypothèses, le modèle ne simule ni les échanges ni les collections qui sortent ensuite. Recaler sur le relevé (`pnpm economy:snapshot:prod`) une fois les nouveautés en ligne.

## Suite donnée

Le 2026-11-08, le propriétaire a gardé les prix et les récompenses de la saison, puis reporté la saison elle-même (P96) : il veut d'abord les retours des joueurs sur les nouveautés. Il a penché pour revenir à 30 minutes et 6 en stock ; les chiffres ci-dessus montrent que ce réglage donne moins au régulier et beaucoup plus à celui qui revient toutes les heures. Le réglage de l'horloge reste à trancher.

## Pour reproduire

```bash
cd rnd/economie-sim
python3 sim.py        # tous les scénarios, quelques secondes
python3 sim.py D      # les scénarios dont le nom commence par D
```

Python 3 sans dépendance, catalogue local dans `apps/web/public/catalog`.
