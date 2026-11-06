# Cahier des charges · Un clan qu'on lit du premier coup

- **Statut :** proposé le 2026-11-06, questions C1 à C12 en attente du propriétaire. Rien n'est codé hors de la maquette.
- **Source :** recette du 2026-11-06 ([recette-nouveautes.md](../recette-nouveautes.md)), R-22 (l'objectif de la semaine, incompréhensible pour un nouveau joueur), R-23 (ouvrir la bibliothèque comme un album commun), R-24 (la liste complète des membres, triable et filtrable).
- **Règles liées :** P35 et P36 (échanges), P50 (bibliothèque), P51 (classements), P65 (rôles), P66 (objectif de la semaine), P70 (niveau du clan), P77 (souhaits), P83 (page d'un clan vue de dehors), dans [regles-du-jeu.md](../regles-du-jeu.md).
- **Cahier lié :** [clan-v2.md](clan-v2.md), qui a fixé l'objectif en bonnes réponses et le niveau du clan. Ce cahier n'en change aucun chiffre : il change ce qu'on voit et ce qu'on comprend.
- **Maquette :** la planche `/planches/clan` du web (`pnpm dev`, puis http://localhost:3000/planches/clan). Quatre moments en haut : première visite, part pas faite, part faite, or atteint. Elle se lit aussi à 390 px.

## Ma recommandation en une phrase

Montrer l'objectif comme une route de quatre coffres que le clan ouvre ensemble, avec à part une barre « Ta part » qui dit ce qu'il reste à faire pour toucher les sachets. La bibliothèque devient un album commun où chaque mot dit qui l'a. Les membres s'ouvrent dans une fenêtre qu'on trie et qu'on filtre.

## Ce qui existe

- **L'objectif** est une barre à trois ou quatre crans, avec des chiffres serrés (« 14 / 15 · 7 à toi »), une ligne par palier (« À l'argent, un sachet bonus ») et une phrase « Encore 8 bonnes réponses… ». Trois règles n'apparaissent nulle part :
  - ce qui compte, c'est-à-dire une bonne réponse en défi ;
  - la part de 15 qu'il faut donner pour toucher les sachets ;
  - la fin de la semaine, dimanche soir.
- **La bibliothèque** donne, collection par collection, la part du catalogue que possède au moins un membre. On ne peut pas l'ouvrir.
- **Les membres** : la page en montre les premiers, triés par bonnes réponses de la semaine. L'API sait déjà en donner la liste complète par pages, avec une recherche par début de pseudo (`GET /clans/:id/members`), mais aucun écran ne s'en sert.

## 1. L'objectif de la semaine

**Pourquoi on ne le comprend pas.** On lit trois nombres sans savoir lequel compte : la cible du palier, le total du clan, la part du joueur. Les paliers portent des noms de métaux sans objet qui les incarne. La condition des 15 bonnes réponses, qui décide si le joueur touche quelque chose, n'est écrite nulle part.

**Ce qu'on propose** (planche, colonne de gauche) :

1. **Un en-tête qui dit le cadre.** « Objectif du clan, cette semaine » et « Fin dimanche soir ». Un « ? » ouvre la règle en trois phrases.
2. **Un seul grand nombre**, celui du clan : « 41 bonnes réponses en révision, ensemble ». Dessous, la prochaine étape en clair : « Encore 9 pour le coffre d'or ».
3. **Une route de quatre coffres**, bronze, argent, or et enluminé, chacun dans son métal, avec son nombre et ce qu'il donne. Le coffre enluminé n'apparaît qu'à partir du niveau 5 du clan (P70). Un coffre atteint s'ouvre. Ceux qui donnent un sachet portent un cadenas tant que la part du joueur n'est pas faite.
4. **Une barre « Ta part »**, à part, qui va jusqu'à 15 : « Encore 10 pour recevoir les sachets », puis « Tu reçois les sachets des coffres ».
5. **Un bouton « Jouer pour le clan »**, qui lance une révision de 10 questions : la seule chose qui fait avancer l'objectif est à un clic.
6. **À la première visite**, trois étapes dessinées remplacent la route le temps d'un « Compris » :
   - « Chaque bonne réponse en révision compte pour le clan » ;
   - « Ensemble, vous ouvrez les coffres » ;
   - « Donne 15 bonnes réponses pour recevoir leurs sachets ».

   Elles reviennent ensuite par le « ? ».

**Sur Jouer**, la ligne du clan reprend les mêmes mots : « Coffre d'argent 25 / 30 » et sa barre.

**Le bilan du lundi** (question C5). Une fenêtre au premier passage de la semaine dit :
- le coffre atteint ;
- la part du joueur ;
- les sachets qu'il peut prendre, et jusqu'à quand.

Aujourd'hui, un joueur qui n'a pas réclamé ses sachets doit penser à rouvrir l'objectif de la semaine passée.

**Ce qui ne change pas.** Les cibles (15, 30, 50, 60 par membre actif), ce qui compte, les récompenses et le délai pour les réclamer restent ceux de P66.

## 2. La bibliothèque, un album commun

**Ce qu'on propose** (planche, deuxième bloc) :

- **Une page à elle**, comme l'album, avec un onglet par collection et son compte (« 412 / 520 »).
- **Une phrase qui donne l'intérêt** : « 64 mots qui te manquent sont dans le clan, dont 21 en double. »
- **Des filtres :**
  - Toutes ;
  - Il te manque, le clan l'a ;
  - En double dans le clan ;
  - Personne ne l'a ;
  - avec une recherche par mot.
- **La grille** reprend l'album :
  - un mot que le clan a montre son mot, sa rareté et les initiales de ceux qui l'ont, avec « à toi » si tu l'as et « ×2 » si un membre l'a en double ;
  - un mot que personne n'a reste une case en pointillés, « n° 3 », comme dans l'album.
- **Le détail d'un mot** liste les membres qui l'ont. Il donne « Proposer un échange » quand un membre l'a en double et que tu ne l'as pas, et « Voir la carte » seulement si tu l'as.

**Ce qu'on montre d'une carte qu'on n'a pas.** Le mot et sa rareté, puisque le clan l'a trouvé, mais ni la définition ni l'étymologie : la découverte reste au sachet, comme dans l'album (question C6).

**L'échange.** « Proposer un échange » ouvre l'offre habituelle, ce membre déjà choisi et sa carte déjà demandée. Les règles de l'offre ne changent pas : doublons seulement, Épique et Légendaire après 7 jours (P35), niveau 5 et 10 offres par 24 h (P36). Le niveau 5 est déjà celui qu'il faut pour être dans un clan.

**Ce qui reste fermé.** Vue de dehors, la page d'un clan ne montre toujours pas la bibliothèque (P83). La maîtrise d'un membre ne se lit nulle part.

## 3. Les membres

**Ce qu'on propose** (planche, troisième bloc) :

- **Sur la page du clan**, une carte avec les quatre membres qui ont donné le plus de bonnes réponses cette semaine, puis « Voir les 24 membres ».
- **La fenêtre « Les 24 membres »** contient :
  - une recherche par début de pseudo ;
  - quatre tris : Cette semaine (par défaut), Dernière visite, Arrivée, Nom ;
  - trois filtres : En ligne, Chef et adjoints, Part pas encore faite.
- **Chaque ligne** montre :
  - l'avatar, avec un point vert si le membre est en ligne ;
  - le pseudo et son rôle ;
  - « niv. 13 · vu hier · depuis le 21 oct. » ;
  - les bonnes réponses de la semaine, avec une petite barre jusqu'à 15 et une coche verte quand la part est faite.
- **Le chef et les adjoints** ont un « … » sur chaque ligne, qui leur ouvre ce que P65 leur permet : nommer ou retirer un adjoint, rendre muet, exclure, passer la main. Les autres membres ne le voient pas.

**Pas de tri par niveau.** La liste des joueurs n'en a pas, parce que ce serait un classement (P83, P51). Le niveau se lit sur la ligne, mais on ne trie pas dessus. Le tri « Cette semaine » est d'une autre nature : il montre qui fait avancer l'objectif commun cette semaine, et il repart de zéro chaque lundi.

## 4. Mise en œuvre

**API :**
- `GET /clans/:id/library/:collectionId` donne les mots que possède au moins un membre, avec, pour chacun, les membres qui l'ont et s'ils l'ont en double. Il se lit dans `user_cards` pour les membres du clan, sur la clé primaire `(user_id, card_id, variant)` qui existe déjà, sans cache : c'est un état de joueurs. Si le test de charge le trouve trop lent, une table recomptée par la file, comme les comptes de la bibliothèque aujourd'hui, prend le relais.
- `GET /clans/:id/members` prend `sort` (`week`, `seen`, `joined`, `name`) et `filter` (`online`, `staff`, `short`), garde la pagination par curseur, et a un index par tri.
- Un membre du clan seulement : l'autorisation est vérifiée sur chaque route, comme aujourd'hui.

**Le bilan du lundi** se calcule à la lecture, sans tâche planifiée, à partir de l'objectif de la semaine passée, qui est déjà gardé.

**Partagé :**
- `packages/view-model` porte les textes et le calcul de la route, de la part et des filtres ;
- `packages/contract` porte les nouveaux schémas.

**Web et mobile** suivent dans le même lot, écran par écran :
- l'objectif sur la page du clan et sur Jouer ;
- la bibliothèque en page à part ;
- les membres en fenêtre sur le web et en feuille sur le mobile.

**Charge.** Un clan n'a pas de maximum de membres (P50). Les deux routes doivent rester rapides à 200 membres :
- la bibliothèque se lit par collection et non pour tout le catalogue ;
- les membres se lisent par pages de 30.

Un test de charge de la bibliothèque à 200 membres se fait avant d'ouvrir.

## 5. Risques

- **Qui possède quoi.** Dans le clan, chacun verra les mots et les doubles des autres. C'est l'intérêt de la bibliothèque, et les doubles se lisent déjà sur le profil public (P77). Un joueur qui ne veut pas être vu peut quitter le clan. La question C6 garde une version plus discrète.
- **Les gros clans.** La fenêtre des membres et la grille de la bibliothèque doivent tenir à plusieurs centaines de lignes, d'où les pages, la lecture par collection et le test de charge.
- **Le filtre « Part pas encore faite »** peut servir à pointer du doigt. Il montre une information que la ligne affiche déjà, et il sert surtout au chef pour relancer le clan (question C10).

## Questions au propriétaire

Chaque question a une recommandation, en premier.

**C1 · Les paliers.**
- a. **(recommandé)** Garder bronze, argent, or et enluminure, dessinés en coffres dans leur métal : le nom se voit.
- b. Les appeler 1er, 2e, 3e et 4e coffre.
- c. Des étoiles, de une à quatre.

**C2 · Où vit l'explication.**
- a. **(recommandé)** Un « ? » toujours là, et les trois étapes dessinées à la première visite, jusqu'à « Compris ».
- b. Le « ? » seul.
- c. Les trois étapes toujours visibles sous la route.

**C3 · La part du joueur.**
- a. **(recommandé)** Une barre « Ta part » à part, jusqu'à 15, et un cadenas sur les sachets des coffres tant qu'elle n'est pas faite.
- b. Un repère sur la barre du clan.
- c. Le nombre seul, « 5 / 15 ».

**C4 · Un bouton pour jouer.**
- a. **(recommandé)** « Jouer pour le clan » lance une révision de 10 questions.
- b. Pas de bouton, on passe par Jouer.

**C5 · Le bilan de la semaine.**
- a. **(recommandé)** Une fenêtre au premier passage du lundi : le coffre atteint, ta part, les sachets à prendre et jusqu'à quand.
- b. Une lettre au courrier seulement.
- c. Rien de plus qu'aujourd'hui.

**C6 · Ce que la bibliothèque montre.**
- a. **(recommandé)** Le mot, sa rareté et les membres qui l'ont, avec leurs doubles. La définition reste à ceux qui ont la carte.
- b. Le nombre de membres qui l'ont, sans leurs noms.
- c. Seulement si le clan l'a ou non.

**C7 · La forme de la bibliothèque.**
- a. **(recommandé)** Une page à elle, comme l'album, avec ses onglets et ses filtres.
- b. Une grande fenêtre par-dessus la page du clan.

**C8 · Échanger depuis la bibliothèque.**
- a. **(recommandé)** « Proposer un échange » vers un membre qui a le mot en double, l'offre habituelle déjà remplie.
- b. Non, on passe par le profil du membre.

**C9 · Les tris des membres.**
- a. **(recommandé)** Cette semaine, Dernière visite, Arrivée, Nom. Pas de tri par niveau, comme dans la liste des joueurs.
- b. Les mêmes, plus Niveau.

**C10 · Le filtre « Part pas encore faite ».**
- a. **(recommandé)** Visible de tous les membres, puisque la ligne montre déjà le nombre.
- b. Réservé au chef et aux adjoints.
- c. Pas de filtre.

**C11 · Gérer un membre.**
- a. **(recommandé)** Un « … » sur sa ligne, pour le chef et les adjoints, avec ce que P65 leur permet.
- b. La gestion reste dans les réglages du clan.

**C12 · L'ordre des lots.**
- a. **(recommandé)** L'objectif d'abord (R-22, le plus gênant pour un nouveau joueur), puis les membres (R-24, l'API est presque prête), puis la bibliothèque (R-23, la nouvelle route et son test de charge).
- b. Les trois en un seul lot.
