# Cahier des charges · Direction artistique « La Bibliothèque »

- **Statut :** direction choisie par le propriétaire le 2026-11-02 sur la maquette A2 (D-056, qui remplace D-055). Choix fermés le même jour, détaillés plus bas. Phases 1 et 2 faites le 2026-11-02. Bascule faite le 2026-11-04 à la demande du propriétaire, avant la fin de la phase 3 : « La Bibliothèque » est la seule allure, l'ancienne et le réglage `?look=` / `EXPO_PUBLIC_LOOK` sont retirés du web et du mobile (sur `main`, pas encore en ligne).
- **Source :** demande du propriétaire du 2026-11-01 (« ça manque d'âme, c'est trop moderne »), puis son refus des planches de Le Livre le 2026-11-02 : « ça ne fait pas jeu vidéo, ça fait site web », pas assez vivant, coins carrés refusés. Le propriétaire vise Hearthstone et Supercell, en restant « sobre » et « bibliothèque, ancien » dans le ton, « un peu juicy, et gamifié ».
- **Maquettes :** `rnd/da-jeu/`. **`bibliotheque.html` (A2) fait référence.** Les autres servent de comparaison : A (taverne, plus chargée), B (Supercell, dont A2 reprend les boutons), C (grimoire, écartée car trop ésotérique). Pour les ouvrir : `python3 -m http.server 4173 --directory rnd/da-jeu`, puis http://localhost:4173. Sur un téléphone Android branché, ajouter `adb reverse tcp:4173 tcp:4173`.
- **Cahier lié :** [retours-game-designer.md](retours-game-designer.md), qui donne l'ordre général. Ce cahier couvre ses phases 1 à 3.

## L'intention

**On joue aux cartes dans une salle de lecture, le soir.** Des rayonnages de livres reliés dans la pénombre, une lampe, un sous-main de cuir vert bordé d'or au centre. Les commandes sont des objets qu'on a envie de toucher : épais, arrondis, taillés dans le cuir et l'or vieilli. Ce qu'on lit est posé sur des feuilles de papier clair. Chaque couche a une fonction :

| Couche | Matière | Rôle | Où |
|---|---|---|---|
| **La salle** | Rayonnages, lampe, sous-main de cuir vert et or | Le décor, toujours là, jamais au premier plan | Fond de tous les écrans |
| **Les objets** | Cuir rouge, vert ou bleu, or vieilli, papier | Ce qu'on touche | Boutons, tuiles, médaille, onglets, compteurs, sachet |
| **Les feuilles** | Papier crème, encre brune | Ce qu'on lit | Album, fiche de carte, défis, réglages, fenêtres |
| **L'éclat** | Lumière dorée, éclats, feuilles d'or | Ce qu'on gagne | Ouverture, niveaux, coffrets, récompenses |

## Les principes

1. **Tout se touche.** Chaque commande a une épaisseur, s'enfonce sous le doigt et rebondit en se relevant. Rien de plat, et des coins arrondis partout.
2. **Sobre.** Des cuirs, de l'or vieilli, du papier. Pas de couleur vive saturée, pas de néon, pas de décor qui bouge pour rien.
3. **On lit sur du clair.** Un texte de plus d'une ligne va sur une feuille. Le lettrage cerné ne sert qu'aux titres, boutons, nombres et étiquettes courtes.
4. **L'éclat se mérite.** Lumière, particules et secousses accompagnent l'ouverture et les gains, presque rien ailleurs.
5. **Le mouvement dit ce qui se passe.** Ressorts courts, apparitions qui rebondissent, et aucune attente imposée hors des grands moments.
6. **Le vrai plutôt que le faux vieux.** Pas de parchemin brûlé, de taches de café, de bords déchirés ni de filtre sépia.
7. **Clarté de `docs/voix.md`.** Le décor ne justifie jamais un texte obscur.

## L'allure

**Une seule allure** (choix du propriétaire, le 2026-11-02) : la salle le soir. Le jeu ne suit plus le thème clair ou sombre de l'appareil et n'a plus de réglage de thème. Les barres du système restent claires sur fond sombre.

Les valeurs de départ sont celles de la maquette A2. Elles passent dans `packages/tokens` et s'ajustent sur téléphone.

| Élément | Valeur de départ |
|---|---|
| Salle | Rayonnages de cuirs sombres à filets dorés, assombris, lumière chaude au centre, vignette |
| Sous-main | Cuir vert, de `#2D6849` au centre à `#0D2A1C` aux bords, cadre doré de 6 px, filet doré intérieur |
| Contour des objets | `#2A1608`, 2,5 px |
| Épaisseur des objets | 4 px pour les petits, 6 à 7 px pour le bouton principal, qui disparaissent à l'appui |
| Cuir rouge | dessus `#C25058`, dessous `#922A34`, épaisseur `#5E131C` |
| Cuir vert | `#5C9A6B`, `#34714A`, `#1F4D30` |
| Cuir bleu | `#5A7CB8`, `#344F8F`, `#1D3263` |
| Or vieilli | `#F6D47A`, `#D9A63A`, `#A5741A` |
| Papier | `#FBECCB`, `#EAD2A0`, `#BF9C5E` |
| Verrouillé | `#AAA397`, `#857E72`, `#5C564C` |
| Lettrage | Crème `#FFF4DC`, cerné de contour, avec une ombre portée de 2 px |
| Rayons | 8, 14, 18 et 22 px, et le cercle |

Un objet a un dessus clair, un dessous plus sombre, un trait de lumière en haut, une épaisseur en bas et le contour. Un fin filet doré à l'intérieur distingue les tuiles. Le bouton principal est en or vieilli, les tuiles prennent un cuir par fonction, les boutons secondaires sont en papier.

**Contraste :** 7:1 pour la lecture sur les feuilles, 4,5:1 partout ailleurs. Le lettrage cerné se mesure entre son remplissage et son contour. Le contrôle s'ajoute à `tokens.test.ts`.

## Les polices

Celles des cartes, déjà chargées sur les deux plateformes :

- **Fraunces** très gras, axe `SOFT` à 100 : titres, boutons, nombres forts, lettrage cerné ;
- **Newsreader** : lecture, et l'italique pour les accroches ;
- **Bricolage Grotesque** : petits chiffres et libellés serrés (barre d'XP, compteurs).

Les polices de Le Livre (Leximon Canon et Spectral) sont retirées. Le web ne charge aucune police de plus.

**Lettrage cerné :** sur le web, `-webkit-text-stroke` avec `paint-order: stroke fill`. React Native n'a pas de contour de texte : un composant `Lettering` pose le texte deux fois, le contour derrière et le remplissage devant, ou le dessine en `react-native-svg`. À essayer en premier sur Android, car c'est le risque principal de l'allure sur le mobile.

## Le mouvement

- **Courbes :** un ressort qui dépasse un peu pour les apparitions, un ressort fort pour ce qui atterrit, une sortie rapide qui accélère. Les durées et les courbes deviennent des tokens.
- **Appui :** l'objet descend de son épaisseur, puis rebondit en se relevant (0,9, puis 1,07, puis 1, en 420 ms), avec une vibration légère.
- **Vie au repos :** le sachet flotte et un reflet le traverse, le bouton principal invite toutes les trois secondes, les pastilles sautillent, un peu de poussière flotte dans la lumière. Un seul reflet animé à la fois par écran.
- **Particules :** canvas 2D sur le web, comme dans la maquette, et `@shopify/react-native-skia` sur le mobile (choix du propriétaire, le 2026-11-02). Familles : éclat, lueur, étoile, feuille d'or, bout de parchemin, poussière. Les réglages de chaque effet (familles, couleurs, nombre, vitesse, gravité) sont des données partagées dans `packages/tokens`, et chaque plateforme les dessine.
- **Intensité :** un seul réglage multiplie le nombre de particules, la force des secousses et celle des flashs. Il vaut 0,6 dans la maquette et s'ajuste sur téléphone.
- **Plafond :** au plus 300 particules à la fois sur le web et 150 sur le mobile.
- **Vibrations :** `expo-haptics`, avec une table par moment (appui, atterrissage, chaque rareté). Elles se coupent dans les réglages, comme aujourd'hui.
- **Mouvement réduit :** `prefers-reduced-motion` sur le web et le réglage du système sur le mobile coupent secousses, flashs et particules, et remplacent les ressorts par des fondus courts.

## L'ouverture d'un sachet

**Le sachet** (P47, confirmé le 2026-11-02) est celui de la maquette : toile à la couleur de la collection, cadre doré, médaillon gravé, ruban rouge, bords crénelés, sceau de cire. Le mot « sachet » reste partout.

**Le rythme reste celui de P45** (choix du propriétaire, le 2026-11-02) : le sachet se déchire au doigt, les cartes viennent une à une, l'annonce d'une carte est plus longue à mesure que la rareté monte, et le joueur retourne lui-même la carte à partir de Précieuse. La maquette pose les cinq cartes d'un coup : seul son habillage est repris, pas cette disposition.

1. **Arrivée :** le sachet vient au centre et grossit (360 ms), le reste de l'écran s'efface.
2. **Charge :** il tremble de plus en plus fort, la lumière fuit par la déchirure, des étincelles en sortent (650 ms). La demande au serveur part au geste : si la réponse tarde, la charge dure jusqu'à elle. Un toucher n'importe où (ou Espace, Entrée, Échap sur le web) passe l'arrivée, la charge et l'éclatement : la première carte vient dès la réponse du serveur.
3. **Éclatement :** flash, secousse, onde, éclats et bouts de parchemin. Le haut du sachet s'envole, le reste tombe.
4. **Les cartes, une à une :** chaque carte arrive en ressort, de dos, puis son annonce, puis sa face.
5. **Le bilan :** les cinq cartes, « Nouveau » sur celles qui entrent dans l'album, puis les deux boutons de suite.

| Rareté | Annonce | Face |
|---|---|---|
| Commune | Brève | Se retourne seule, quelques reflets d'or autour d'elle |
| Peu commune | Brève | Se retourne seule, étoiles vertes |
| Rare | Le dos luit orange | Se retourne seule, onde et éclats, petite secousse |
| Précieuse | Le dos luit bleu | Le joueur la retourne, onde, éclats, secousse |
| Épique | Le dos doré tremble et attire la lumière | Le joueur la retourne, rayons, flash léger, secousse, quelques feuilles d'or, bandeau « Épique » |
| Légendaire | Tremblement plus long, la lumière est aspirée | Le joueur la retourne, rayons, flash, forte secousse, pluie de feuilles d'or, bandeau « Légendaire », la carte s'agrandit |

Chaque face qui se retourne est traversée d'un reflet, et la lumière de sa rareté luit derrière la carte pendant l'annonce. La Légendaire jette des étincelles de toutes les couleurs vives, sur une aura et des rayons dorés : un essai en or blanc et nacre a été jugé moins bon que l'arc-en-ciel (retour du propriétaire, le 2026-11-02).

Les durées d'annonce actuelles restent. Les sons synthétisés restent aussi : leur choix est reporté (voir « À décider » dans les règles du jeu).

## Le monde

Le joueur est dans l'arrière-boutique de **Maître Furet**, un bouquiniste. Le nom vient de « fureter » et salue Antoine Furetière et son dictionnaire. Il n'est pas une mascotte : pas de dessin animé, pas de conseil permanent.

- Il parle aux moments où il a de la place : accueil du jour, récompense, découverte d'une haute rareté, retour après une absence.
- Il ne parle pas pendant les actions et ne reproche jamais rien.
- Sa première apparition vient des textes. Un portrait gravé du domaine public peut suivre, choisi par le propriétaire.
- Les onglets gardent leurs noms clairs : Jouer, Album, Défis, Échanges, Communauté.

## Ce qui ne change pas

- **Les cartes :** composition, polices, gemmes et reflets. Une R&D sans priorité essaiera une matière par rareté, après la phase 3.
- **Les gravures :** catalogue et chaîne de traitement.
- **La navigation :** cinq onglets, avec Jouer au centre, plus haut que les autres.
- **Le sceau de cire au L :** il reste le logo.
- **L'administration :** elle hérite des tokens, sans travail de dessin.

## Phase 1 · Le socle

Rien ne change pour le joueur à la fin de cette phase, sauf derrière le réglage.

### 1.1 Assainir les valeurs

**Fait le 2026-11-01.** Les couleurs, rayons, ombres, tailles de texte et espacements passent par `packages/tokens`. Un test (`no-raw-colors.test.ts`) refuse toute couleur en dur hors des illustrations et des scènes. Restent à leur palette propre, jusqu'à leur refonte : cartes, sachets, avatars, sceaux, bannières et médailles de clan, écrans de révélation, coffret, route des niveaux et comptoir. Écarts assumés : les titres de 19, 26, 30, 34 et 36 px descendent d'un cran dans l'échelle, 9 px monte à 10, et quelques ombres voisines se confondent.

### 1.2 Retirer Le Livre, garder son socle

**Fait le 2026-11-02.** Le réglage se met avec `?look=bibliotheque` sur le web (gardé par le navigateur, `?look=actuel` l'efface) et `EXPO_PUBLIC_LOOK=bibliotheque` au build mobile.

Le Livre est sur `main` derrière le réglage (commits du 2026-11-01). Le propriétaire a choisi de garder son socle et de retirer sa forme.

| On garde | On retire |
|---|---|
| Le réglage de bascule, renommé : `?look=bibliotheque` sur le web, `EXPO_PUBLIC_LOOK=bibliotheque` au build mobile | Les palettes clair et nuit (`livre.ts`), le choix du thème et sa préférence sur l'appareil |
| Les couleurs par rôle et leurs tests de contraste | Les coins carrés et les ombres plates |
| La page `/planches` et son entrée dans les réglages du mobile, qui montreront les nouvelles pièces | Les polices Leximon Canon et Spectral, et leur script de découpe |
| Le script qui cuit les matières, pour les nouvelles | Les ornements : tracés, images, script, crédits (`docs/ornements.md`) et sources de `rnd/ornements/` |
| Les composants web créés (`Panel`, `Chip`, `Tabs`, `Segmented`…), à rhabiller | Les formes Le Livre de chaque composant, sur les deux plateformes |

`userInterfaceStyle` repasse à `"dark"` dans `app.json`. Sans changement de thème, l'app n'a plus besoin de se recharger seule : la question d'`expo-updates` ne se pose plus pour la DA.

### 1.3 La salle et les objets

**Fait le 2026-11-02.** Écarts : les rayonnages sont une tuile raccordable cuite par `packages/tokens/scripts/bake_room.py` (16 et 35 Ko sur le web, jusqu'à 57 Ko en 3x sur le mobile) ; la lampe et l'ombre des bords restent des dégradés, pour suivre la taille de l'écran. Le cadre doré du sous-main est un dégradé derrière une marge sur le mobile, sans image en neuf parts. La feuille s'appelle `Leaf` dans le code.

- **La salle :** image cuite (rayonnages et lampe), en WebP, à deux densités, 120 Ko au plus. Le sous-main se dessine en dégradé, avec la tuile de grain de cuir existante.
- **Les objets :** un composant par plateforme, `Toy` sur le web et sur le mobile, qui prend une matière (rouge, vert, bleu, or, papier, verrouillé) et une taille. Le web le fait en CSS. Le mobile pose le dessus, le dessous et l'épaisseur en vues simples : React Native 0.88 sait dessiner `boxShadow` et les dégradés, à vérifier sur un Android modeste.
- **Le cadre doré :** dégradé en bordure sur le web, image découpée en neuf parts ou tracé `react-native-svg` sur le mobile.
- **La feuille :** papier crème cerné, avec épaisseur, pour la lecture.

### 1.4 Le mouvement et les particules

**Fait le 2026-11-02.** Le moteur est écrit une seule fois, en fonctions pures dans `packages/tokens/src/particles.ts`, que le canvas du web et Skia (sur le fil d'interface) appellent tous deux ; les réglages des effets sont dans `effects.ts`. Sur le mobile, chaque lueur est un dégradé préparé une fois par couleur : un flou à chaque image serait trop lent, et trois disques empilés dessinaient des cibles. Le propriétaire a jugé les planches fluides sur son téléphone le 2026-11-02, avant le passage aux dégradés.

- Courbes, durées et table des vibrations dans `packages/tokens`.
- Le comportement d'appui dans `Toy` sur les deux plateformes.
- Moteur de particules : canvas 2D sur le web (repris de la maquette), Skia sur le mobile. Installer `@shopify/react-native-skia` par `pnpm expo install`, ce qui demande un nouveau build natif.
- Réglages des effets en données partagées, réglage d'intensité, plafonds, mouvement réduit.
- **Mesure sur un Android modeste** avant d'aller plus loin : 60 images par seconde au repos, pas de saccade visible pendant l'éclatement.

### 1.5 Les pièces de Jouer

**Fait le 2026-11-02.** Les pièces vivent dans `apps/web/src/library/` et `apps/mobile/src/library/`, sans rien savoir du jeu ; `/planches` les assemble en un écran Jouer qu'on peut toucher, avec l'ouverture du sachet et une carte qui se retourne au rythme du jeu pour chaque rareté (annonce, toucher à partir de Précieuse, puis l'effet). Écart : React Native ne sait pas cerner un texte, le lettrage du mobile pose donc huit copies sombres autour des lettres.

Seulement ce dont l'écran Jouer et l'ouverture ont besoin : bandeau du haut (portrait, médaille, barre d'XP, stock, courrier), barre d'onglets avec Jouer surélevé, tuiles latérales avec pastilles et cadenas, bouton principal, bulle d'information, sachet, lettrage cerné. Les autres pièces viennent avec leurs écrans.

## Phase 2 · Jouer et l'ouverture, puis le cœur du jeu

**D'abord l'écran Jouer et l'ouverture** (choix du propriétaire, le 2026-11-02), dans le vrai jeu, derrière le réglage, sur le web puis sur téléphone.

**Jouer, ouverture et bilan faits le 2026-11-02**, à juger par le propriétaire. La logique du jeu reste dans les écrans existants, seule l'allure change avec le réglage. Le web garde son identité de grand écran (refus du propriétaire, le 2026-11-02, d'un web qui copiait le mobile) : à partir de 760 px, une planche de bois liserée d'or en haut porte le sceau, les cinq rubriques (celle qu'on regarde sur une plaque d'or) puis le niveau, le stock, le courrier et le portrait ; l'écran Jouer y est un large sous-main, le sachet en grand au milieu avec ceux des collections voisines posés derrière, les tuiles de chaque côté. Sous 760 px, le bandeau et l'étagère d'onglets du téléphone. Écarts :

- le sachet reste l'ancien sachet en 3D (relief, lumière qui bouge, bande à déchirer) : le sachet plat de `/planches` a été refusé par le propriétaire le 2026-11-02 ;
- on l'ouvre en déchirant la bande ou d'un toucher, et la pile de cartes est sautée : la première carte arrive juste après l'éclatement ;
- l'appel au serveur part au geste, et la charge (650 ms) dure jusqu'à la réponse. À l'éclatement, la bande s'envole et le sachet disparaît dans l'éclair ;
- sur le mobile, pas de tuile des réglages à côté du sachet (le compte en tient lieu), comme dans l'écran actuel ;
- sur un petit téléphone, les cartes du bilan rapetissent (136 px de large au moins) pour que les boutons tiennent au-dessus des onglets. Le propriétaire les juge en jouant, sur son téléphone, avant qu'on touche aux autres écrans. Les pièces de lecture (feuilles, listes, onglets, champs, fenêtres) naissent ensuite avec les écrans qui les utilisent, et `/planches` les montre au fur et à mesure.

**Album, fiche de carte et défis faits le 2026-11-02**, sur le web (grand écran et téléphone) et le mobile en même temps. Les pièces communes prennent l'allure d'un coup : boutons, puces et onglets deviennent des objets, un panneau devient une feuille où tout s'écrit à l'encre brune (sur le web, tout ce qui porte `data-paper` ; sur le mobile, un panneau `paper` lu avec `paperColors`). Écarts :

- les cartes de l'album sont posées sur le sous-main vert, pas sur une feuille : une feuille crème sous des cartes crème les noyait. Les onglets de collection et la recherche sont en papier, la collection choisie en or ;
- la fiche de carte est un sous-main : sur le grand écran la carte à gauche et ses renseignements sur une feuille à droite, sur le téléphone la feuille sous la carte ;
- les questions des défis se posent sur le sous-main : l'énoncé sur une feuille, chaque proposition sur une tuile de papier marquée a, b, c ou d dans une pastille d'or, la bonne en cuir vert (avec son éclat), la mauvaise en cuir rouge, le verdict sur une feuille bordée de vert ou de rouge. L'accueil des défis, l'énigme du jour, l'entraînement et le bilan d'une série sont sur des feuilles posées dans la salle ;
- la frise des défis n'existe pas encore : sa place est laissée, elle viendra avec son chantier. La barre de lettres de l'album est faite le 2026-11-03 (voir plus bas).

**Énigme, niveaux, coffrets, compte et réglages faits le 2026-11-02**, sur le web et le mobile ensemble. Une page du mobile hors des onglets se tient désormais dans la salle, son titre en lettrage, et ce qui est posé sur une feuille (paragraphe, champ, lien, case à cocher) y prend l'encre brune de lui-même. Sur le web, un écran qui a ses propres classes reçoit en plus l'habit commun (feuille, bouton d'or ou de papier, champ, lettrage). Écarts :

- l'énigme pose ses deux feuilles dans la salle : les cases vides sont des creux dans le papier, les lettres trouvées des tuiles d'or ;
- le plateau des niveaux du mobile est retiré : le mobile prend la table des matières du web, sur une feuille, avec ses flèches de chapitre en papier ;
- le coffret est posé sur le sous-main, sous des rayons d'or : le coffre est un gros objet d'or, chaque récompense une fiche de papier ;
- le choix du thème avait déjà disparu des deux plateformes. Les interrupteurs des réglages sont des rainures sombres, vertes une fois allumées ;
- le profil et l'atelier restent pour la phase 3.

| Écran | Attendu |
|---|---|
| Jouer | La maquette A2, avec les vraies données : collections, stock, défi du jour, récompenses, verrous par niveau |
| Ouverture | La séquence ci-dessus, avec le rythme de P45 |
| Bilan | Les cinq cartes posées sur le sous-main, gains lisibles, deux boutons de suite |
| Album | Feuilles sur le sous-main, place prévue pour la barre de lettres |
| Fiche de carte | Feuille à côté de la carte sur grand écran, place prévue pour la nouvelle mémoire et le taux de réussite |
| Défis | Feuille à propositions a, b, c, d, place prévue pour la frise. Chaque bonne réponse a son petit éclat |
| Énigme | Feuille, partage inchangé |
| Niveaux | Table des matières sur feuille, généralisée au mobile |
| Coffrets | Le moment où l'or a le droit de briller |
| Compte, réglages | Feuilles. Le choix du thème disparaît |

**Fin de phase :** le propriétaire joue une semaine dans La Bibliothèque, sur le web et sur téléphone, derrière le réglage.

**Premier avis du propriétaire (2026-11-02) :** le web est validé. Sur le mobile, trois reprises faites le même jour :

- la barre d'onglets du bas est plus basse : icônes, bouton Jouer et marges réduits ;
- dans l'album, les collections ne défilent plus de côté : elles tiennent toutes à l'écran, deux par rangée ;
- le sous-main de l'album n'a plus de bord en bas : il passe sous la barre d'onglets et laisse plus de place aux cartes.

## Phase 3 · Tout le reste, puis la bascule

### Les écrans

Échanges, Communauté, clan et discussion, amis, profil et atelier, courrier, nouveautés, sanctions, page de carte publique, énigme publique, invitation, désinscription, écrans fermés, erreurs.

**Échanges faits le 2026-11-02**, sur le web et le mobile. Les boîtes d'offres sont des onglets en papier, celui qui est ouvert est en or (sur le mobile, toutes les rangées d'onglets prennent cette allure). Les offres, l'historique, les boîtes vides et la préparation d'une offre sont sur des feuilles, les cartes choisies cerclées d'or. Un échange conclu se montre sur le sous-main, sous des rayons d'or, comme un coffret.

**Communauté faite le 2026-11-02** (joueurs, clans et amis ; le clan et sa discussion suivent). Les sections sont des onglets en papier, celle qui est ouverte est en or. Les recherches sont creusées dans le papier (sur le mobile, un seul champ sert aux joueurs, aux clans et aux amis). La liste des joueurs, chaque clan, les amis, le podium et le fil sont sur des feuilles. Sur le mobile, les pages des onglets laissent voir la salle derrière elles.

**Clan fait le 2026-11-03**, sur le web et le mobile. L'en-tête du clan, le sien comme celui qu'on visite, est sa bannière posée sur le sous-main, son nom en lettres dorées et ses boutons en papier. L'objectif, la bibliothèque, les membres et la discussion sont sur des feuilles. Dans la discussion, les messages des autres sont des billets de papier cernés d'encre, ceux du joueur sont dorés, le journal est en papier pointillé, et le champ d'écriture est creusé dans la feuille avec un bouton d'envoi en or. Les menus et les mentions s'ouvrent sur du papier, les gravures du blason sont des jouets.

**Profil et atelier faits le 2026-11-03**, sur le web et le mobile. Sur le web, la bannière du joueur est encadrée d'or sur le sous-main ; sur le mobile, l'en-tête reste dans la salle comme avant. Les cartes épinglées, les chiffres et les liens sont sur des feuilles, chaque chiffre dans un creux du papier, et les bandeaux d'information (compte invité, pseudo à choisir) sont des feuilles. Dans l'atelier, chaque avatar, cadre ou titre est une tuile de papier, celle qu'on porte est en or ; une pièce fermée reste grise.

**Courrier, nouveautés et pages légales faits le 2026-11-03**, sur le web et le mobile. Chaque lettre du courrier est un billet de papier ; une nouvelle porte une bande d'or sur le web, et sur le mobile le billet entier est en or. Les nouveautés et les pages légales (conditions, confidentialité, charte, mentions) sont sur des feuilles, leur titre en lettres dorées ; sur le mobile, la fenêtre des nouveautés qui s'ouvre au lancement est une feuille, elle aussi.

**Sanctions, écrans fermés et erreurs faits le 2026-11-03**, sur le web et le mobile. Une fonction fermée par le niveau, une page introuvable ou une page qui a planté se disent sur une feuille, leur signe dans un médaillon d'or. Sur le mobile, l'avis de sanction s'ouvre sur une feuille ; sur le web, il était déjà dans une fenêtre de papier. Le mobile n'a pas d'écran d'erreur à lui.

**Pages publiques faites le 2026-11-03**, sur le web et le mobile. La page publique d'une carte pose ses renseignements sur une feuille à côté de la carte, comme la fiche du jeu. L'invitation, le lien d'ami et la désinscription posent leur texte et leur formulaire sur une feuille sous un titre en lettres dorées. L'énigme publique était déjà sur une feuille. Hors du jeu, ces pages ne prennent l'allure qu'avec le réglage, comme le reste, jusqu'à la bascule.

**Retours du propriétaire sur la phase 3 repris le 2026-11-03**, sur le web et le mobile :

- les boutons-objets se soulèvent et s'éclairent au survol de la souris ;
- l'ouverture est plus courte (arrivée 360 ms, charge 650 ms) et se passe d'un toucher ;
- les cartes révélées et leurs lignes (rareté, fréquence, rang dans le sachet) sont posées sur le sous-main, plus sur les rayonnages où elles se lisaient mal ;
- les boutons du bilan du web sont rangés sur une grille : le premier sur toute la largeur, les deux suivants côte à côte ;
- la carte agrandie a deux flèches (et les flèches du clavier sur le web) pour passer aux cartes voisines sans la fermer, avec « 2 sur 5 » dessous : depuis le bilan, l'album, les cartes épinglées du profil et les mots d'un défi ;
- l'album est un sous-main de la hauteur de l'écran (choix du propriétaire), et la barre de lettres longe le bord droit dès 24 cartes possédées en ordre alphabétique. Le tri est alphabétique par défaut, par rareté ou par date au choix, gardé sur l'appareil. Sur le web, les thèmes se replient derrière « Voir les thèmes » (choix du propriétaire), le thème choisi reste visible ; sur le mobile, tri et thèmes sont dans la fenêtre des filtres, et la barre de lettres se parcourt aussi en glissant le doigt ;
- le web est plus léger : la poussière flotte en éléments animés par le navigateur au lieu d'un dessin à chaque image, les étincelles n'effacent que leur place, et le balancement du sachet tourne sans JavaScript. Au repos sur Jouer, le travail du navigateur passe d'environ 730 à 100 ms toutes les 2 s.

**Seconds retours du propriétaire repris le 2026-11-03**, sur le web et le mobile :

- le sachet reste celui du jeu (choix du propriétaire, parmi les deux essais de `/planches`), avec un cadre doré cerné d'encre à l'intérieur de son bord ;
- sur le web, Jouer retrouve la prochaine récompense et le mot à revoir ou qui s'échappe (oubliés par la refonte, pas voulus). Les premiers essais (un bandeau du niveau au-dessus du sous-main, puis deux étiquettes de part et d'autre du bouton) juraient ou l'étouffaient (retours du propriétaire). À partir de 1180 px, Jouer devient donc un bureau en trois colonnes : le sachet au milieu, toujours le héros ; à gauche la journée (la date, le défi du jour avec une pastille par question, l'énigme du jour dont le mot se dessine en caractères d'imprimerie, les lettres trouvées en or et les autres en creux, le mot à revoir, puis le stock de sachets) ; à droite le joueur (son niveau, la récompense du seul niveau suivant et les coffrets à ouvrir, l'objectif du clan ou l'invitation à en rejoindre un, puis Amis, Joutes et Réglages en tuiles). Tant que les colonnes sont presque pleines (jusqu'à environ 1 100 px de haut), leur dernier élément s'aligne sur le bouton d'or ; plus haut, il se range sous les autres plutôt que de rester seul au ras du bord (retour du propriétaire sur un écran 4K). Les feuilles montent l'une après l'autre à l'arrivée. Sur un écran bas, les feuilles se resserrent et taisent la phrase que leur titre dit déjà ; sur un grand écran haut, le bureau est aussi haut que la plus longue des colonnes : le bouton d'or s'aligne sur sa dernière feuille, et les étagères prennent la place en dessous ; sur un écran trop bas pour elle, il reprend la hauteur de l'écran et les colonnes défilent (retour du propriétaire du 2026-11-08 : un sous-main descendu jusqu'en bas, comme celui de l'album, avec un sachet qui grandissait avec lui, faisait le sachet trop gros et laissait le vert vide ; un plafond fixe de tout l'écran coupait la colonne de gauche, et un plafond du seul sous-main décrochait le bouton du bas des colonnes). Le reste garde la taille du jeu (une mise à l'échelle de tout le bureau, essayée, faisait l'interface trop grosse sur un écran 4K et jurait avec les autres écrans). Le bouton d'or garde de l'air autour de ses mots, son nombre posé en bout à droite. Plus étroit que 1180 px, les tuiles reviennent autour du sachet et le mot passe sous le bouton ; le téléphone ne change pas, comme le mobile, qui n'a pas la place de ces colonnes ;
- le tri de l'album s'ouvre sur une feuille de papier au lieu du menu du navigateur, le choix en cours en or, et se parcourt au clavier ;
- l'album gagne de la place : dans le sous-main, collections, raretés et filtres défilent avec les cartes au lieu de rester en haut ; sur le web, cinq cartes par rangée, mieux espacées, au lieu de six serrées, trois sur un téléphone au lieu de deux, et un écart net entre les filtres et la première rangée ; sur le mobile, la marge intérieure du sous-main est plus étroite et les cartes plus larges. La place de la barre de lettres reste réservée quand le tri la cache : changer de tri ne déplace plus rien ;
- sur les Échanges, le code se lit en lettres simples et espacées, dans un creux du papier. Une boîte sans offre en attente explique l'échange en trois étapes (doubles, code ou ami, offre et délai), montre le code en grand et mène à une nouvelle offre ou aux amis.


**Fenêtres du mobile faites le 2026-11-03.** Toutes les fenêtres qui montent du bas de l'écran (sachets, filtres de l'album, réglages, pseudo, avis, épingles, ami, options et membres du clan, menu d'un message, fondation d'un clan) sont des feuilles de papier à l'encre brune, d'où qu'elles montent. Sur le web, les fenêtres étaient déjà en papier.

### Hors du jeu

| Élément | Travail |
|---|---|
| Accueil public | Refonte complète : c'est la première impression, et elle compte pour les captures |
| Pages légales | Feuilles, automatiques par les tokens |
| E-mails | Fait le 2026-11-05 : une feuille crème sur le bois sombre, bouton en or cerné d'encre, en couleurs pleines. Pas d'image distante (D-036), Georgia reste la police |
| Images de partage | Fait le 2026-11-05 : les trois images dans la salle, la carte dessinée comme dans le jeu sur le sous-main |
| Icône d'app, écran de lancement, favicon | Fait le 2026-11-05 : le sceau de cire sur le cuir vert, cadre d'or |
| Fiches des stores | Fait le 2026-11-05 : captures refaites, image de présentation et en-têtes iOS tirés de la planche `/planches/stores` |
| Cadres d'avatar | Fait le 2026-11-05 : les 13 cadres en matières (bois, or, laiton, cuir, vert-de-gris, papier, cire, nacre), un seul dessin pour le web et le mobile (`packages/tokens/src/avatar-frames.ts`). Identifiants inchangés |
| Emblèmes de clan | Fait le 2026-11-05 : bouclier cerclé d'or comme les jouets, champ éclairé en haut, couleurs accordées à la salle. Identifiants inchangés |
| Admin | Tokens seulement. Couleurs de graphiques sorties du code |

### Les textes

Avant la bascule, tous les textes du joueur sont revus :

1. Le propriétaire donne dix phrases aimées et dix détestées.
2. L'agent réécrit les textes dans `packages/view-model` et les écrans, à partir de ces exemples et de `docs/voix.md`, sans toucher aux tests d'accord.
3. Le propriétaire relit par sondage, et les textes de Maître Furet un par un.

Les définitions des cartes ne changent pas.

### La bascule

Elle a lieu quand le cœur du jeu est validé, même si quelques écrans secondaires suivent juste après.

1. Le web et le mobile passent ensemble, avec un build Android et iOS.
2. Une page de nouveautés annonce le changement dans la voix de Maître Furet.
3. Les fiches des stores sortent avec la nouvelle allure.
4. L'ancien style, le pli scellé et le réglage de bascule sont retirés du code dans le commit qui suit.
5. La mesure compare les joueurs arrivés avant et après, à J1 et à J7.

## Critères de réussite

| Critère | Seuil |
|---|---|
| Jeu | Le propriétaire, sur son téléphone : « ça fait jeu », pas « site web » |
| Contraste | 7:1 sur les feuilles, 4,5:1 partout, tests automatiques |
| Ouverture d'un sachet | Toujours sous 150 ms au p95 côté serveur |
| Fluidité | 60 images par seconde sur le web, ouverture sans saccade visible sur un Android modeste |
| Poids | Aucune police de plus, 120 Ko au plus pour la salle, Skia mesuré dans la taille de l'app |
| Accessibilité | Mouvement réduit respecté, tailles de texte système tenues sur le mobile |
| Âme | Test à l'aveugle sur cinq personnes : une capture évoque un jeu de cartes sur les livres anciens, pas une app ni un site |
| Valeurs en dur | Aucune couleur hors tokens en dehors des dessins du sachet et des cartes |

## Risques

| Risque | Réponse |
|---|---|
| Le lettrage cerné rend mal sur le mobile | Essai de `Lettering` sur Android en tout premier, repli en `react-native-svg` |
| Ombres, dégradés et particules saccadent sur un Android modeste | Mesure dès la phase 1, plafonds de particules, réglage d'intensité, salle en image cuite |
| Trop enfantin, trop Supercell | Palette de cuirs et d'or vieilli, lecture sur papier, éclat réservé aux gains, intensité à 0,6 |
| Trop chic pour les 18–30 ans | Humour de Maître Furet, gros mot, rythme des animations. D-022 voulait un jeu pas bourgeois : le ton doit porter cette énergie |
| La DA repousse trop l'ouverture | Le cœur du jeu d'abord, les écrans secondaires peuvent suivre la bascule |
| Une seconde direction refusée | Le propriétaire juge le vrai écran Jouer sur son téléphone avant tout le reste |
| Skia alourdit l'app | Taille mesurée au premier build, repli en vues Reanimated si l'écart est trop grand |
| Rendu différent entre web et mobile | La maquette A2 vaut pour les deux. Un écran se valide d'abord sur téléphone |
