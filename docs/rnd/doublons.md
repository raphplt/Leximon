# R&D · Économie des doublons

- **Décision liée :** règles P15, P35, P36 et N1, retours du game designer du 2026-10-31. Tranché le 2026-11-01 : P84 à P87, voir « Suite donnée ».
- **Dates :** 2026-11-01 → 2026-11-01
- **Question :** que doit devenir un doublon pour avoir de la valeur, sans tuer les échanges ni rendre la collection trop facile ?

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Le sachet reste la source principale | 80 % au moins des mots trouvés à J180, tous profils |
| La collection reste un objectif long | Joueur régulier : plus de 300 jours pour tout compléter |
| Une rareté haute se mérite | Joueur régulier : 4 à 8 semaines d'économies pour une Légendaire |
| Il reste de quoi échanger | Au moins 100 cartes différentes avec un double à J30, joueur régulier |
| Le doublon récompense à l'ouverture | Gain visible dès la révélation, sans action du joueur |
| Aucune perte ressentie | Rien de rare ne disparaît sans l'accord du joueur |

## Options testées

Simulation de `rnd/doublons-sim/sim.py`, sur le catalogue publié (1 561 cartes) et les règles réelles : probabilités P11, une carte Peu courant ou mieux par sachet, garanties au 40e et au 150e sachet. Trois profils : occasionnel 3 sachets par jour, régulier 8, assidu 20, répartis entre les trois collections. Médianes de 12 joueurs simulés sur 540 jours. Le joueur achète le mot le plus rare qu'il peut se payer, sans épargner. Les échanges sont modélisés à 0,5, 2 et 5 échanges conclus par semaine, carte contre carte de même rareté. Ces cadences sont une hypothèse.

- **Statu quo :** rien ne change, avec ou sans échanges.
- **Conversion automatique :** au-delà de 2 ou 3 exemplaires gardés, chaque copie se change en monnaie à l'ouverture.
- **Recyclage manuel :** un bouton vide les doubles tous les 14 jours.
- **Bouton quotidien, modèle choisi :** un bouton vide les doubles une fois par jour, en gardant un double par carte, sans toucher aux Épiques ni aux Légendaires.
- **Recettes :** 5 doubles d'une rareté donnent un mot manquant de la rareté au-dessus.
- **Barèmes :** gain par doublon de 1, 2, 5, 15, 50 et 200, de Courant à Légendaire. Prix d'un mot manquant de 4, 8 ou 16 fois le gain de sa rareté.

## Résultats

**Le volume de doublons confirme le retour du game designer.** Sans conversion, un joueur régulier détient 448 doubles à J30 sur les trois collections, 2 413 à J90 et 5 839 à J180. Une offre d'échange en absorbe 3 au plus, avec 10 offres par 24 h.

**Joueur régulier, 8 sachets par jour :**

| Modèle | Barème | Possédé J30 | J90 | J180 | Tout complété | Part achetée J180 | Monnaie par jour |
|---|---|---|---|---|---|---|---|
| Statu quo sans échange | | 48 % | 76 % | 87 % | plus de 540 j | 0 % | 0 |
| Statu quo avec échanges | | 49 % | 77 % | 89 % | 444 j | 0 % | 0 |
| Conversion, garde 2 | × 4 | 49 % | 83 % | 95 % | 318 j | 18 % | 34 |
| **Conversion, garde 2** | **× 8** | **49 %** | **80 %** | **92 %** | **368 j** | **13 %** | **34** |
| Conversion, garde 2 | × 16 | 49 % | 80 % | 91 % | 393 j | 9 % | 34 |
| Conversion, garde 3 | × 8 | 49 % | 80 % | 91 % | 389 j | 10 % | 18 |
| Recyclage manuel, tous les 14 jours | × 8 | 49 % | 78 % | 91 % | 374 j | 3 % | 29 |
| **Bouton quotidien, modèle choisi** | **× 8** | **49 %** | **80 %** | **92 %** | **373 j** | **13 %** | **34** |
| Recettes 5 pour 1 | | 53 % | 85 % | 97 % | 290 j | 25 % | 0 |

**Autres profils, conversion garde 2, barème × 8 :** l'occasionnel gagne 4 de monnaie par jour et possède 87 % du catalogue à J365 (83 % au statu quo). L'assidu gagne 152 par jour et complète tout en 144 jours (182 avec les échanges seuls).

**Ce que cela donne pour un joueur régulier à 34 par jour, barème × 8 :**

| Mot manquant | Prix | Attente |
|---|---|---|
| Courant | 8 | Immédiat |
| Peu courant | 16 | Immédiat |
| Rare | 40 | 1 jour |
| Précieux | 120 | 4 jours |
| Épique | 400 | 12 jours |
| Légendaire | 1 600 | 47 jours |

**Tampons par exemplaires obtenus, joueur régulier :** 7 cartes ont 5 exemplaires à J30, 250 à J90 et 740 à J180. Seules 165 cartes atteignent 10 exemplaires à J180, et aucune 25. Le compte est tenu sur toute la vie de la carte, même convertie. Les paliers à 5, 10 et 25 exemplaires gardent donc une vraie rareté.

**Doubles disponibles avec la conversion :** 309 cartes différentes gardent un double à J30, 878 à J90. Le stock d'échange reste large.

**Enseignements :**

1. **Les échanges pèsent peu dans la complétion,** de 1 à 8 % des mots trouvés avec ces cadences. Leur valeur est sociale. La monnaie ne les remplace pas : elle accélère surtout la fin, quand les sachets ne donnent presque plus de nouveautés.
2. **Garde 2 rapporte presque deux fois plus que garde 3,** parce que la grande majorité des doublons sont des deuxièmes et troisièmes exemplaires.
3. **Les recettes échouent aux deux premiers critères :** un quart des mots trouvés, et 290 jours. Elles détruisent aussi des cartes, ce qui a déclenché la révolte contre les échanges de Pokémon TCG Pocket.
4. **Le recyclage manuel rapporte autant, mais rien ne se voit à l'ouverture,** et il impose une corvée.
5. **L'occasionnel gagne trop peu avec les seuls doublons.** La monnaie doit aussi venir des défis, de la série et des succès : c'est ce qui relie les systèmes, comme le demande le game designer.

## Recommandation

Un modèle en trois pièces, au barème × 8 :

1. **Monnaie unique, jamais achetable.** Dès le troisième exemplaire, chaque Courant, Peu courant, Rare ou Précieux se change tout seul, et le gain s'affiche à la révélation. Épiques et Légendaires restent toujours gardées et ne se recyclent qu'à la main. Le joueur peut aussi recycler son dernier double.
2. **Plusieurs sources de monnaie :** doublons, défi réussi à 5 sur 5, paliers de série, succès.
3. **Tampons d'exemplaires sur la carte,** à 5, 10 et 25 exemplaires obtenus : la valeur visible d'une carte qu'on tire souvent, sans toucher à la maîtrise (P33).

Reste à vérifier : le bilan total de la monnaie une fois les autres sources et dépenses chiffrées, surtout pour l'assidu, qui gagne plus que ce qu'il peut dépenser une fois sa collection complète. Une nouvelle collection relance la dépense, ce que le modèle ne simule pas. Les cadences d'échange sont à recaler sur les chiffres réels de la bêta.

## Suite donnée

Le propriétaire a choisi le 2026-11-01 un recyclage manuel très facile, plutôt que la conversion automatique recommandée : un bouton à la fin d'une ouverture et dans l'album, qui garde toujours un double, sans toucher aux Épiques ni aux Légendaires sauf choix explicite (P85). Barème × 8 retenu, sous le nom d'écus (P84, P86). Tampons retenus (P87).

Ce choix laisse le joueur décider, et le bouton placé à la fin de l'ouverture répond au défaut du recyclage tous les 14 jours. Un joueur qui l'utilise chaque jour obtient les mêmes résultats que la conversion : 373 jours pour tout compléter, 13 % de mots achetés à J180 et 34 écus par jour, avec les critères tenus. Un joueur qui l'oublie gagne moins, et le critère « sans action du joueur » n'est plus tenu : c'est accepté.

## Pour reproduire

```bash
cd rnd/doublons-sim
python3 sim.py      # tous les modèles
python3 sim.py 2b   # le modèle choisi seul
```

Python 3 sans dépendance, catalogue `2026-10-29.1` dans `apps/web/public/catalog`. Une passe prend quelques minutes. Tableaux complets : `rnd/doublons-sim/results.md`.
