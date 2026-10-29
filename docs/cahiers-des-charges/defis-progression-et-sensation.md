# Cahier des charges · Défis : progression et sensation

- **Statut :** lancé par le propriétaire le 2026-10-29 (« go vague 2 »), choix de détail faits par l'agent, à relire. Les trois lots faits le 2026-10-29 ; le web vérifié dans le navigateur, le mobile à recetter sur téléphone.
- **Source :** retours du propriétaire du 2026-10-28 : « rajouter des sons, améliorer les animations, les rendre plus immersifs, qu'on puisse voir et suivre mieux la progression sur la page défis ». Référence de réactivité : Duolingo, avec une réserve : le public est adulte, il ne faut pas en faire trop.
- **Règles liées :** P32 et P33 (formats et paliers), P23 et P29 (sachets bonus), P45 (mise en scène de l'ouverture, dont on reprend les sons), D-049 (sons et vibrations).
- **Hors de ce cahier :** révisions thématiques et nouveaux modes de jeu (vague 3, cahier à part), série de jours (c'est une règle du jeu, à trancher avant).

## Principe

Des réactions courtes, qui suivent la réponse sans la retarder, et plus marquées sur les vrais moments : un mot qui monte de palier, un sachet gagné. Rien qui bloque, rien qui clignote en boucle, pas de mascotte. Les sons et la vibration suivent les réglages déjà en place (son, vibration) ; les animations s'effacent avec « réduire les animations » du système.

## Lot 1 · Voir sa progression sur la page Défis

1. **Ce qui t'attend aujourd'hui.** Sous le défi du jour, une ligne dit ce que le prochain défi contient : les mots à revoir maintenant, combien peuvent monter de palier s'ils sont écrits de tête, et les mots pas encore révisés. Exemple : « 8 mots à revoir, dont 2 peuvent monter de palier. 5 nouveaux mots attendent leur première question. »
2. **Paliers en barre.** Le panneau « Tes mots par palier » ajoute une barre partagée Esquisse, Encre et Dorure, en proportion des mots possédés, pour voir d'un coup d'œil la part de mots solides.
3. **Dans « Mots à réviser »**, un mot qui peut monter de palier le dit : « Peut passer à l'Encre ».

## Lot 2 · La sensation pendant le défi

| Moment | Son | Vibration | Animation |
|---|---|---|---|
| Bonne réponse | deux notes de cloche claires, brèves | une impulsion courte | le bon choix se gonfle un instant ; le point de progression se remplit ; « +15 XP » monte et s'efface |
| Mauvaise réponse | un son sourd et bref, pas de buzzer | deux impulsions légères | le choix faux tremble une fois ; le bon choix s'éclaire |
| Mot qui monte de palier | le carillon des cartes Rares | une impulsion plus longue | la ligne « … passe à l'Encre ! » arrive avec un reflet doré |
| Fin du défi | l'accord du bilan d'ouverture | rien | le score compte jusqu'à sa valeur ; le sachet gagné arrive en dernier, avec son carillon |

Les deux nouveaux sons sont synthétisés comme ceux de l'ouverture, et rendus en fichiers pour le mobile par le même script.

## Lot 3 · Le mobile

Les lots 1 et 2 à l'identique sur l'app, avec les vibrations du téléphone.

## Recette

`recette-web.md`, DEF-07 et DEF-08 ; `recette-mobile.md`, MDE-01.
