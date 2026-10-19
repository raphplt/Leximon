# R&D · Calcul de la rareté des cartes

- **Décision liée :** D-020. Décisions produit P20 à P22 (north star).
- **Dates :** 2026-10-19 → 2026-10-19
- **Suite donnée :** recommandation retenue, mots courants au sens ancien acceptés, fréquence affichée discrètement sur la carte. Une pépite absente de tout le corpus devient Légendaire. Depuis D-021, les pépites ne sont plus confirmées en relecture : un jury automatique (Opus) note le charme des mots éligibles, et les meilleures notes deviennent pépites, au plus 2 % du lot parmi les mots absents du corpus (Légendaires) et au plus 6 % parmi les autres (Épiques), jamais sous 6 sur 10.
- **Question :** peut-on attribuer automatiquement l'une des six raretés à chaque mot à partir de sa fréquence réelle, et la répartition obtenue convient-elle au jeu ?

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Couverture | une fréquence pour au moins 90 % des mots candidats |
| Pyramide du catalogue | 40 / 25 / 17 / 10 / 6 / 2 %, celle de la simulation (collection-sim.md) |
| Cohérence avec la north star | chaque rareté correspond à sa définition (« Courant : encore compris de beaucoup »…) |
| Stabilité | la rareté d'une carte publiée ne change jamais, même quand le catalogue grandit |
| Intérêt de jeu | une Légendaire est un mot qu'on est content de tirer |

## Données

- **Google Books Ngram, corpus français 2019** : 6 fichiers de 1-grammes (5,3 Go compressés), téléchargés puis filtrés.
  - Pour chaque mot du Littré, on additionne ses formes : celles de Lexique, plus le pluriel, le féminin et les formes régulières des verbes en -er. Une forme partagée avec un autre lemme est écartée.
  - Seules les graphies en minuscules sont comptées, pour exclure les noms propres (« Paris », « Louis »).
  - Fréquences en occurrences par milliard de mots, sur deux périodes : 1990-2019 (usage moderne) et 1800-1899 (époque du Littré).
- **Candidats :** les 7 616 mots de la sélection actuelle (catégories du Wiktionnaire, définis par le Littré).

## Options testées

- **A. Fréquence moderne seule :** classement sur 1990-2019, puis raretés attribuées par quantiles selon la pyramide.
- **B. Comme A, avec le XIXe siècle pour départager les ex æquo.**
- **C. Mélange :** deux tiers de fréquence moderne, un tiers de fréquence au XIXe siècle (moyenne des logarithmes). Un mot qui n'a jamais été courant est plus rare qu'un mot qui l'a été.
- **C sur un catalogue plausible :** même calcul après avoir écarté ce que la relecture écarterait de toute façon :
  - les mots composés (250) ;
  - les termes de science du Littré (827) ;
  - les mots encore courants, au-dessus de 500 occurrences par milliard (1 857).
  - Il reste 4 792 mots.

## Résultats

**Ngram couvre bien mieux que Lexique.**
- 54 % des candidats sont absents de Lexique, qui ne peut donc pas les classer. Ngram en classe 92 %.
- Sur les mots que les deux connaissent, les classements concordent (corrélation de rang de 0,78).

**Les quatre premières raretés se calculent bien.** Option C, catalogue plausible :

| Rareté | Mots | Fréquence moderne médiane | Exemples |
|---|---|---|---|
| Courant | 1 917 | 102 par milliard | faquin, billevesée, matamore, goujat, galamment |
| Peu courant | 1 198 | 7 par milliard | renarder, risiblement, fagotin, malaisance |
| Rare | 815 | 1,3 par milliard | apparesser, malebête, avalure, reniable |
| Précieux | 479 | 0,3 par milliard | rhapsoder, afflouer, dédamer, tredame |
| Épique | 288 | 0 | blessir, insultateur, bousure, huilure |
| Légendaire | 95 | 0 | ribonborder, ramoitissement, scorpiojelle, palmérier |

**Le haut de la pyramide ne se calcule pas.**
- Ngram ne publie que les mots vus au moins 40 fois. 5,3 % du catalogue plausible n'a aucune occurrence, ni moderne ni au XIXe siècle. C'est plus que les 2 % de Légendaires.
- Les Légendaires sont donc tirées arbitrairement parmi des ex æquo à zéro. On y trouve des termes techniques oubliés ou des graphies fautives (« trémue » pour trémie), rarement des mots qu'on est content de tirer.
- Avec la fréquence seule (options A et B), c'est pire : les Épiques et Légendaires sont surtout des composés (« prie-dieu », « vert-de-gris », « sous-officier ») et des termes de chimie.

**Les mots qui font le buzz sont des Courants.** Faquin, billevesée, hurluberlu, escogriffe, barguigner, olibrius et jocrisse sont tous entre 30 et 180 occurrences par milliard. C'est cohérent avec la définition « encore compris de beaucoup ». C'est même un atout pour accrocher un nouveau joueur, mais aucun ne sera une carte rare.

**La pyramide varie beaucoup selon le thème.** Avec des seuils communs à tout le catalogue :
- les insultes sont à 78 % Courant, et aucune n'atteint Précieux ;
- les mots « rares » du Wiktionnaire sont à 23 % Précieux ou mieux.

Une collection à thème ne retrouve donc la pyramide que si on choisit ses mots en conséquence.

**Autres constats :**
- **Mots composés :** Ngram les découpe (« prie - dieu » est un 3-gramme). Il faudra une requête dédiée pour ces 3 % de mots.
- **Sens anciens d'un mot courant :** pour « punaise » ou « canaille » pris comme injures, ou pour « pan », la fréquence mesure le mot, pas le sens. Ces mots dépassent le plafond de 500 par milliard.
- **Volume :** la sélection actuelle ne fournit que 4 800 mots plausibles, sous l'objectif de 10 000. Ngram permet d'aller chercher dans tout le Littré : 31 000 mots simples, hors sciences, sont sous le plafond.
- **Défaut corrigé :** Lexique écrit « coeur » et le Littré « cœur ». Des mots courants passaient le filtre de fréquence.

## Recommandation

1. **Pour Courant à Précieux, la rareté est calculée** avec l'option C. On calibre une fois les seuils sur le catalogue de lancement, puis on les fige en règle datée. Un mot ajouté plus tard est classé avec les seuils en vigueur. Une carte publiée ne change jamais de rareté.
2. **Épique et Légendaire sont réservées aux « pépites ».**
   - Seul un mot plus rare que le seuil de Rare peut y prétendre.
   - Le modèle propose la mention « pépite » dans le brouillon, le relecteur la confirme dans Directus.
   - Parmi les pépites, les plus rares par la fréquence deviennent Légendaires (2 % du catalogue), les suivantes Épiques (6 %). Les pépites en surnombre restent Précieux.
   - La rareté reste calculée à partir de données enregistrées (fréquence, mention pépite), jamais saisie à la main.
3. **Les seuils sont les mêmes pour tout le catalogue**, pas des quantiles par collection. Sinon la rareté d'un mot dépendrait de ses voisins, et l'ajout de contenu chaque semaine la ferait dériver. Les outils de la chaîne composent chaque collection pour respecter la pyramide.
4. **Sélection par Ngram dans tout le Littré**, plus seulement par les catégories du Wiktionnaire, pour atteindre 10 000 mots.

**Ce qu'il reste à vérifier :**
- la requête pour les mots composés ;
- la part réelle de pépites dans un lot relu (il en faut au moins 8 %) ;
- les formes des verbes irréguliers, qui sont sous-comptées.

## Pour reproduire

Machine du propriétaire (Arch Linux), Python 3 avec uv, corpus Ngram `20200217/fre`.

```bash
cd content/pipeline
uv run python ../../rnd/rarity/ngram_extract.py forms     # formes cibles, data/ngram/forms.tsv
uv run python ../../rnd/rarity/ngram_extract.py totals    # totaux par décennie
# télécharger les 6 fichiers 1-0000N-of-00006.gz dans data/ngram/raw/ (taille vérifiée), puis :
for i in 0 1 2 3 4 5; do uv run python ../../rnd/rarity/ngram_extract.py shard $i; done
PYTHONPATH=../../rnd/rarity uv run python ../../rnd/rarity/analyse.py
```

Les fichiers sont téléchargés avant le filtrage, et leur taille est vérifiée : un flux coupé à une frontière de bloc gzip ressemblerait à une fin de fichier normale. Les trois premiers fichiers ne contiennent que des graphies avec majuscules, ils ne fournissent donc aucun compte.
