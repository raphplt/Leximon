# Cahier des charges · Direction artistique « Le Livre »

- **Statut :** direction choisie par le propriétaire le 2026-11-01 sur maquettes (D-055, qui remplace D-022). Chantiers 1.1 et 1.2 faits le 2026-11-01, le reste à faire.
- **Source :** demande du propriétaire du 2026-11-01 : « tout doit vraiment être revu intégralement pour que ça fasse plus littérature ancienne, c'est trop minimaliste, trop moderne, ça manque d'âme », et retours du game designer.
- **Maquettes :** `rnd/da-refonte/` (`python3 build.py` produit `maquettes.html` et `maquettes-livre.html`). Ce sont des essais de ton, pas des écrans finis.
- **Cahier lié :** [retours-game-designer.md](retours-game-designer.md), qui donne l'ordre général. Ce cahier couvre ses phases 1 à 3.

## L'intention

**Le jeu devient un livre qu'on tient en main.** La coque est une reliure, le contenu est une page imprimée, et l'enluminure n'apparaît que pour ce qui est très rare. Chaque couche a une fonction :

| Couche | Époque | Rôle | Où |
|---|---|---|---|
| **La reliure** | Cuir et fers dorés | Ce qui tient le jeu | Bandeau du haut, onglets, boutons de premier ordre, fenêtres |
| **La page** | Imprimerie des XVIIIe et XIXe siècles | Ce qu'on lit et ce qu'on fait | Tous les contenus, avec une grammaire de dictionnaire |
| **L'enluminure** | Manuscrit | Ce qu'on gagne de plus précieux | Hautes raretés, grands moments de récompense |

**Plus c'est rare, plus on remonte vers le manuscrit.** C'est cette idée qui donne du sens à l'ornement.

## Les principes

1. **La lisibilité passe avant le décor.** Une texture ne passe jamais sous du texte fin sans mesure de contraste, et le jeu reste rapide à utiliser.
2. **Le vrai plutôt que le faux vieux.** Pas de parchemin brûlé, de taches de café, de bords déchirés ni de filtre sépia.
3. **Un siècle par fonction.** Pas de mélange décoratif.
4. **L'or se mérite.** Il signale la récompense. Partout ailleurs, il reste un filet fin.
5. **La grammaire du livre.** Folios, titres courants, renvois, table des matières, numérotation a, b, c, ordre alphabétique.
6. **Micro-typographie soignée.** Petites capitales, chiffres elzéviriens, italiques vraies, ligatures, espaces fines françaises.
7. **Des fleurons, pas des pilules.** Coins nets, boutons rectangulaires à filets, plus de bouton en pilule ni d'ombre plate.
8. **Clarté de `docs/voix.md`.** Le décor ne justifie jamais un texte obscur.

## Les deux thèmes

Le clair et la nuit arrivent ensemble, et le jeu suit le réglage de l'appareil. Le joueur peut forcer l'un ou l'autre dans ses réglages.

| | Page claire | Cabinet de nuit |
|---|---|---|
| Page | Papier crème chaud | Brun-noir, jamais du noir pur |
| Texte | Encre noire | Crème, avec un cran de graisse de plus |
| Accent | Rouge de rubrique | Or désaturé |
| Reliure | Cuir vert bouteille | Cuir bordeaux |
| Carte | Inchangée | Inchangée, le papier reste clair |

Les deux thèmes visent 7:1 pour le texte de lecture, 4,5:1 au minimum partout, mesurés sur le pixel le plus sombre de la texture. Le contrôle s'ajoute à `tokens.test.ts`, pour les deux thèmes.

## Le monde

Le joueur entre dans la boutique de **Maître Furet**, un bouquiniste. Le nom vient de « fureter » et salue Antoine Furetière et son dictionnaire. Il n'est pas une mascotte : pas de dessin animé, pas de conseil permanent.

- Il parle aux moments où il a de la place : accueil du jour, récompense, découverte d'une haute rareté, retour après une absence.
- Il ne parle pas pendant les actions et ne reproche jamais rien.
- Sa première apparition vient des textes. Un portrait gravé du domaine public peut suivre, choisi par le propriétaire.
- Les lieux existent déjà : l'Échoppe, le Scriptorium et la Bibliothèque, chapitres de Niveaux.
- Les onglets gardent leurs noms clairs : Jouer, Album, Défis, Échanges, Communauté.

## Ce qui ne change pas

- **Les cartes :** composition, polices, gemmes et reflets. Le propriétaire les trouve réussies. Une R&D sans priorité essaiera une matière par rareté, après la phase 3.
- **Les gravures :** catalogue et chaîne de traitement.
- **La navigation :** cinq onglets, avec Jouer au centre.
- **Le sceau de cire au L :** il reste le logo, redessiné si besoin pour les nouvelles matières.
- **L'administration :** elle hérite des tokens, sans travail de dessin.

## Phase 1 · Les fondations

Rien ne change pour le joueur à la fin de cette phase, sauf derrière le réglage.

### 1.1 Assainir les valeurs

Aujourd'hui, il y a environ 281 couleurs hexadécimales et 195 rayons hors tokens sur le web, environ 296 couleurs et 134 rayons en dur sur le mobile. Il n'y a ni échelle typographique ni ombre en token. Une refonte passe par un assainissement préalable.

- Échelles typographiques, ombres et espacements dans `packages/tokens`, utilisées pour de vrai sur les deux plateformes.
- Couleurs nommées par rôle (`page`, `pageInk`, `binding`, `bindingInk`, `rule`, `rubric`, `gilt`…), et plus par valeur.
- Remplacement dossier par dossier, sans changement visible, vérifié à l'œil et par captures avant et après.
- Répétition de `"SOFT" 100` retirée du CSS web.
- Valeurs recopiées (`#262B40` dans `layout.tsx`, `app.json`, images de partage) ramenées à une seule source.

**Fait le 2026-11-01.** Les couleurs, rayons, ombres, tailles de texte et espacements passent par `packages/tokens`. Un test (`no-raw-colors.test.ts`) refuse toute couleur en dur hors des illustrations et des scènes. Restent à leur palette propre, jusqu'à leur refonte en phase 2 ou 3 : cartes, sachets, avatars, sceaux, bannières et médailles de clan, écrans de révélation, coffret, route des niveaux et comptoir. Écarts assumés : les titres de 19, 26, 30, 34 et 36 px descendent d'un cran dans l'échelle, 9 px monte à 10, et quelques ombres voisines se confondent.

### 1.2 Les thèmes et le réglage

- **Web :** variables par `:root[data-theme]`, avec `prefers-color-scheme`, et un script en tête de page pour éviter tout flash.
- **Mobile :** le thème est lu une fois au lancement (choix du propriétaire, le 2026-11-01), avant que les feuilles de style soient créées, et tient jusqu'au lancement suivant. Pas de contexte ni de réécriture des styles. `userInterfaceStyle: "automatic"` dans `app.json` demande un nouveau build natif ; d'ici là, le téléphone se dit toujours en nuit.
- **Préférence joueur :** gardée sur l'appareil, dans les réglages (`Comme l'appareil`, `Clair`, `Nuit`). Elle n'apparaît que dans Le Livre.
- **Réglage de bascule :** sur le web, `?look=livre` dans l'adresse, retenu par le navigateur jusqu'à `?look=planche` (dans `localStorage` et pas dans un cookie : la page Tes données promet qu'il n'y en a qu'un). Sur le mobile, `EXPO_PUBLIC_LOOK=livre` au build. Le réglage se retire au moment de la bascule, avec l'ancien style.

**Fait le 2026-11-01.** Les palettes sont dans `packages/tokens/src/livre.ts`, avec les contrastes contrôlés dans `tokens.test.ts` (7:1 pour la lecture, 4,5:1 ailleurs, sans texture pour l'instant). Le jeu s'affiche déjà en Le Livre derrière le réglage, avec ses formes actuelles : seules les couleurs changent, et les écrans à palette propre restent dans leurs teintes.

**À trancher avant la bascule :** sans `expo-updates`, l'app ne peut pas se recharger seule, donc un changement de thème attend le prochain lancement, et le dit dans les réglages. Ajouter cette dépendance permettrait de recharger, et d'envoyer des corrections sans passer par les stores.

### 1.3 Les matières

- Tuiles WebP répétées pour le papier et le cuir, cuites une fois pour toutes. Pas de `feTurbulence` vivant sur mobile, et le grain SVG actuel disparaît.
- Sur le web, `border-image` pour les cadres. Sur le mobile, quatre coins et des bords répétés en `Image` ou `react-native-svg`, sans dépendance nouvelle. Skia n'est pas nécessaire aux cadres.
- Dorure en translation d'un reflet par `transform` : une seule surface animée à la fois.
- `mix-blend-mode` évité en dehors des cartes : l'effet se cuit dans l'image.
- Test sur un Android modeste avant de généraliser.

### 1.4 Les polices

- **Départ :** Spectral pour le texte et l'interface, avec ses petites capitales pour les libellés, et IM Fell French Canon pour les titres. Comparaison sur écran réel, en petite taille, dès cette phase.
- **Vérifier la licence d'IM Fell** dans sa source d'origine avant de l'embarquer.
- **Sous-ensembles maison** par `pyftsubset` : les sous-ensembles latins courants retirent petites capitales et chiffres elzéviriens.
- Fraunces et Newsreader restent pour les cartes, Bricolage Grotesque disparaît.
- Les tableaux de largeurs de glyphes (`word-size.ts`, `glyph-widths.ts`) ne bougent pas tant que la carte garde Fraunces.
- Aucun appel de police externe : la CSP impose `font-src 'self'`.
- Budget : ajouter au plus 80 Ko de polices à la première visite.

### 1.5 Les ornements

Deux sources, comme l'a choisi le propriétaire :

- **De vrais livres anciens :** Rijksmuseum, Paris Musées, Met (œuvres Open Access), éditions Kelmscott, et tout document dont la licence est vérifiée à l'unité. Gallica reste exclue, à 75 € HT par image en usage commercial, et un fichier Commons venu de Gallica aussi. La Bodléienne est exclue (non commercial).
- **Dessinés par nous :** filets, coins, fers simples, en vectoriel, pour ce qui doit rester net et léger.

Pour chaque ornement : sa source, sa licence et son crédit dans un fichier versionné. La chaîne des gravures sert au traitement.

**Jeu de départ :**

| Famille | Quantité | Usage |
|---|---|---|
| Fleurons et culs-de-lampe | 8 | Fin de section, états vides |
| Bandeaux | 6 | Haut de page, en-tête de collection |
| Filets | 4 | Séparations, tableaux |
| Coins et fers | 6 | Cadres de fenêtre, cuir |
| Lettrines | 20 | Titres d'écran, débuts de texte. Les fichiers existent en partie |
| Papiers | 3 | Fond, gardes de fenêtre, carnet |
| Cuirs | 2 | Vert, bordeaux |
| Icônes | environ 41 | Redessinées en traits de gravure sur la grille existante |

Le propriétaire valide une planche par famille.

### 1.6 La bibliothèque de composants

Web d'abord dans une page interne, mobile en parallèle :

- boutons (premier ordre, second ordre, lien) ;
- panneaux, listes à filets, tableaux à points de conduite ;
- onglets et segments, champs, interrupteurs, puces ;
- fenêtres, panneaux latéraux, fiches montantes ;
- bandeau du haut, barre d'onglets, médaille de niveau, barre d'XP ;
- états vides, chargement, erreur.

Le web n'a pas de composant `Panel`, `Chip` ni `Tabs`, seulement des classes : ils deviennent de vrais composants, comme sur le mobile.

**Fin de phase :** une page montre tous les composants, en clair et en nuit, sur le web et sur téléphone. Le propriétaire la valide avant de continuer.

## Phase 2 · La coque et le cœur du jeu

Ordre : coque, Jouer, ouverture, album et fiche, défis et énigme, niveaux et coffrets, compte et réglages.

| Écran | Attendu |
|---|---|
| Coque | Bandeau et onglets en cuir à filets dorés, pas de flou ni de pilule glissante. Stock, courrier et niveau lisibles d'un coup d'œil |
| Jouer | Prototypes A (sommaire du jour) et B (sceaux autour du sachet), dans le vrai jeu. Le propriétaire tranche en les utilisant |
| Paquet | Prototypes animés sur le web, sur un téléphone ensuite : sachet teinté, pochette de papier, pli cacheté. Le pli changerait le mot « sachet » (P53), à décider avant de porter sur le mobile |
| Ouverture | Fond assombri comme une table de lecture. La carte reste le centre. Les mises en scène gardent leur rythme (P45), en remplaçant les effets modernes qui jurent |
| Récapitulatif | Page de bilan, avec ornement de fin et gains lisibles |
| Album | Page de dictionnaire, titres courants, place prévue pour la barre de lettres |
| Fiche de carte | Page de droite d'un livre ouvert sur grand écran, avec place prévue pour la nouvelle mémoire et le taux de réussite |
| Défis | Liste à filets, propositions a, b, c, d, place prévue pour la frise |
| Énigme | Coupure de gazette, partage inchangé |
| Niveaux | Table des matières, déjà dans l'esprit, généralisée au mobile |
| Coffrets | Coffret ou cassette de cuir, le moment où l'or a le droit de briller |
| Compte, réglages | Le choix du thème s'y ajoute |

**Fin de phase :** le propriétaire joue une semaine dans Le Livre, sur le web et sur téléphone, derrière le réglage.

## Phase 3 · Tout le reste, puis la bascule

### Les écrans

Échanges, Communauté, clan et discussion, amis, profil et atelier, courrier, nouveautés, sanctions, page de carte publique, énigme publique, invitation, désinscription, écrans fermés, erreurs.

### Hors du jeu

| Élément | Travail |
|---|---|
| Accueil public | Refonte complète : c'est la première impression, et elle compte pour les captures |
| Pages légales | Automatiques par les tokens |
| E-mails | Gabarit papier et encre. Pas d'image distante (D-036), Georgia reste la police |
| Images de partage | Les trois images passent au Livre. Elles ont aujourd'hui leur propre carte et leurs couleurs en dur |
| Icône d'app, écran de lancement, favicon | Le sceau de cire sur cuir |
| Fiches des stores | Captures, image de présentation, en-têtes iOS |
| Cadres d'avatar | Les 13 cadres sont redessinés. Leurs identifiants en base restent les mêmes |
| Emblèmes de clan | Couleurs à accorder aux deux thèmes |
| Admin | Tokens seulement. Couleurs de graphiques sorties du code |

### Les textes

Avant la bascule, tous les textes du joueur sont revus :

1. Le propriétaire donne dix phrases qu'il aime et dix qu'il déteste.
2. L'agent réécrit les textes dans `packages/view-model` et les écrans, à partir de ces exemples et de `docs/voix.md`, sans toucher aux tests d'accord.
3. Le propriétaire relit par sondage, et les textes de Maître Furet un par un.

Les définitions des cartes ne changent pas.

### La bascule

Elle a lieu quand le cœur du jeu est validé, même si quelques écrans secondaires suivent juste après.

1. Le web et le mobile passent ensemble, avec un build Android et iOS.
2. Une page de nouveautés annonce le changement dans la voix de Maître Furet.
3. Les fiches des stores sortent avec la nouvelle allure.
4. L'ancien style et le réglage de bascule sont retirés du code dans le commit qui suit.
5. La mesure compare les joueurs arrivés avant et après, à J1 et à J7.

## Critères de réussite

| Critère | Seuil |
|---|---|
| Contraste | 7:1 sur le texte de lecture, 4,5:1 partout, tests automatiques sur les deux thèmes |
| Ouverture d'un sachet | Toujours sous 150 ms au p95 côté serveur |
| Fluidité | 60 images par seconde sur le web, ouverture fluide sur un Android modeste |
| Poids | Au plus 80 Ko de polices et 60 Ko de textures en plus à la première visite |
| Accessibilité | `prefers-reduced-motion` respecté, tailles de texte système tenues sur le mobile |
| Âme | Test à l'aveugle sur cinq personnes : une capture évoque un livre ancien, pas une app moderne |
| Valeurs en dur | Aucune couleur hors tokens en dehors des dessins du sachet et des cartes |

## Risques

| Risque | Réponse |
|---|---|
| La DA repousse trop l'ouverture | Le cœur du jeu d'abord. Les écrans secondaires peuvent suivre la bascule |
| Le premier testeur demandait « plus moderne » | C'est un retour isolé, le propriétaire a tranché. Le test à l'aveugle le vérifiera |
| Rendu « musée » ou trop chic pour les 18–30 ans | Humour de Maître Furet, gros mot, rythme des animations, or réservé. D-022 voulait un jeu pas bourgeois : le ton doit porter cette énergie |
| Deux thèmes doublent la vérification | Tests de contraste automatiques, composants d'abord |
| Le sachet est dessiné deux fois | Un seul prototype retenu avant de porter sur le mobile |
| Rendu différent entre web et mobile | La carte de référence vaut pour tout. Un écran valide d'abord sur téléphone |
| Droits d'un ornement mal vérifiés | Registre des sources, rien sans licence vérifiée |
| Polices lourdes sur la première visite | Sous-ensembles, `font-display: swap`, budget contrôlé |
