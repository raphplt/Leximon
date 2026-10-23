# Cahier des charges · Retours du premier testeur

- **Statut :** validé par le propriétaire le 2026-10-23, avec les recommandations de la fin du document. Les cinq lots faits le 2026-10-23.
- **Source :** les retours d'un ami du propriétaire, le 2026-10-23, en bêta sur leximon.fr : messages écrits, captures et sept vocaux. Il a commencé en invité, puis a créé son compte. Les arbitrages du propriétaire sont indiqués à chaque point.
- **Règles liées :** P45 (mise en scène), P57 (prononciation), P58 (coffrets), P59 (fonctionnalités par niveau), P44 (affichage de la rareté). Cahiers liés : [ouverture.md](ouverture.md) (§6 et §7, à mettre à jour), [interface-v1.md](interface-v1.md).

## Ce qu'il a aimé

Le potentiel, l'aspect visuel des cartes (gravures, description, niveaux) et le son de l'ouverture. Il demande un rendu « encore plus design, plus moderne, plus actuel ».

## Ce qu'il a relevé, et ce qu'on en fait

| # | Retour | Arbitrage | Lot |
|---|---|---|---|
| 1 | Après « Tout révéler », aucun résumé : il ne sait pas ce qu'il a eu, ni ce que disent les cartes, et le quiz arrive sans qu'il les ait lues | Retenu : les Épiques et Légendaires restent montrées, puis le résumé arrive en cascade dans une grille de lecture | 1 |
| 2 | L'écran de fin propose « Créer mon compte / Voir mon album » au lieu de ses cartes | Retenu : le résumé passe avant les boutons | 1 |
| 3 | La citation est coupée en bas de la carte agrandie | Retenu | 1 |
| 4 | Pas de tag « Nouveau » dans l'album, pas de filtre sur ce qu'on vient d'ouvrir, ni de façon de savoir ce qu'on a lu | Retenu | 2 |
| 5 | « Réviser » envoie sur les défis, déjà faits ; l'encart « … est en train de t'échapper » ne dit rien du mot | Retenu : l'encart montre le début de la définition | 3 |
| 6 | La jauge de recharge du sachet vide a l'air cassée | Retenu | 4 |
| 7 | Le « 4 » dans le rond ne dit pas que ce sont des sachets restants | Retenu : le nombre va dans le bouton | 4 |
| 8 | Un coffret ouvert sans rien de visuel : il ne sait ni ce que c'est, ni d'où il vient | Retenu | 4 |
| 9 | Il ne sait pas ce que donnent les prochains niveaux | Retenu | 4 |
| 10 | Il n'a pas compris qu'on pouvait choisir sa collection | Retenu | 5 |
| 11 | « Les Fondateurs » et « Caractères et travers » ne disent pas de quoi ils parlent | Noms gardés ; une ligne de description par collection | 5 |
| 12 | « Précieux » ne lui parle pas, il ne sait pas où il se place | Noms gardés ; l'échelle des raretés se montre | 5 |
| 13 | Le bouton son ne lit que le mot, il voudrait toute la carte | Pas maintenant : essai sur 20 cartes plus tard | Plus tard |
| 14 | Les hautes raretés pourraient être plus spectaculaires | Bonus, après le lot 1 | Plus tard |
| 15 | « Réglages » mal placé, « plein de trucs dans beaucoup de sens » | À préciser avec lui | Plus tard |
| 16 | Un rendu plus moderne | Lui demander deux ou trois références | Plus tard |

**À savoir pour lire ces retours :**
- **Tout joueur commence avec plusieurs sachets d'avance.** Le stock est plein au départ (6). Un invité en ouvre 2, puis s'inscrit avec les 4 qui restent. La première séance enchaîne donc 4 à 6 sachets, et c'est là que « Tout révéler » tente le plus : le résumé sert dès la première minute, pas seulement aux joueurs pressés.
- **Il n'a sans doute vu aucune mise en scène de haute rareté.** Son sachet comptait un Précieux, or « Tout révéler » saute aujourd'hui tout ce qui est en dessous d'Épique, sans retournement ni annonce. Une Épique tombe dans environ un sachet sur vingt, donc il n'en a probablement pas eu. Le point 14 se juge après le lot 1.
- **Le choix de la collection n'ouvre qu'au niveau 3 (P59).** Avant, seuls les Fondateurs sont ouverts. Il a atteint le niveau 3 pendant sa première séance, et rien ne lui a montré que le choix venait de s'ouvrir.

## Lot 1 · Relire ce qu'on vient d'ouvrir

Le plus important : sans lui, on peut ouvrir des sachets sans jamais lire un mot.

### « Tout révéler » et la cascade du résumé

- **Ce qui reste :** le bouton montre encore les Épiques et Légendaires du sachet, en version courte, puis passe au résumé. Arbitrage du propriétaire (2026-10-23) : le moment fort de ces cartes ne se joue pas dans une grille.
- **Ce qui s'ajoute :** le résumé pose les cinq cartes face visible, l'une après l'autre, avec 80 ms d'écart. Il le fait toujours, qu'on ait tout révélé ou retourné les cartes une par une.
  - Chaque carte de Rare à Légendaire a un bref reflet de sa couleur en arrivant.
  - Une carte que le joueur n'a pas vue retournée (une Rare ou une Précieuse sautée par « Tout révéler ») joue aussi son carillon : elle ne passe jamais inaperçue.
  - Avec « réduire les animations », les cartes apparaissent toutes ensemble, sans effet ni son.
- **Code :** `recapCascade` dans `apps/web/src/booster/staging.ts` (testée), `RecapCards` dans `booster-screen.tsx`. La logique reste à côté de l'ouverture du web, comme le reste de la mise en scène (`reveal.ts`, `staging.ts`).

### Le résumé devient une grille de lecture

- **Ordinateur :** les cinq cartes côte à côte, assez grandes pour lire le mot et la définition (environ 200 px de large au lieu des 140 px de l'éventail actuel).
- **Téléphone :** un carrousel, une carte presque pleine largeur par écran, qu'on fait glisser ; des points montrent où on en est.
- **Toucher une carte** ouvre sa fiche (`CardSheet`, déjà utilisée par l'album) : carte agrandie, prononciation, citation entière. La fiche marque la carte comme lue (lot 2).
- Les cartes nouvelles gardent leur tag « Nouveau ».
- **Sous la grille, dans cet ordre :** la ligne du sachet (« 1 Précieux · 5 mots nouveaux »), l'XP et sa barre, la progression de la collection, puis les boutons.
- **Les boutons ne changent pas de sens :**
  - « Ouvrir un autre sachet » et « Voir mon album » ;
  - pour l'invité qui n'a plus de sachet, « Créer mon compte » ;
  - « Ouvrir le coffret » quand un niveau vient d'être passé.
  
  Ils passent simplement sous les cartes : le joueur voit ses mots avant qu'on lui propose autre chose.
- **Code :** `Recap` dans `booster-screen.tsx`, `booster-screen.module.css` (`.fan`).

### La citation n'est plus coupée

- **Cause :** sur la face de la carte, la citation est limitée à 3 lignes. Quand la définition est longue, la carte coupe en plus tout ce qui dépasse, au milieu d'une ligne (`components/card.module.css`, `.inner` en `overflow: hidden`).
- **Sur la face :**
  - la citation prend la place qui reste après la définition, et finit par « … » si elle ne tient pas ;
  - aucune ligne n'est coupée en deux ;
  - si la définition seule remplit la carte, la citation disparaît de la face.
- **Dans la fiche :** la citation entière, avec sa source, sous la définition (`cards/card-facts.tsx`). Aujourd'hui, la fiche ne la montre pas du tout.
- **Contrôle, fait le 2026-10-23 :** les 1 561 cartes mesurées dans le navigateur, à 300 px. Aucune définition ne déborde. Les 552 citations tiennent en lignes entières (de 1 à 7 lignes) : 76 entières, 476 finies par « … », aucune retirée. Pas de page de dev, la mesure suffit.

## Lot 2 · « Nouveau » dans l'album

*Fait le 2026-10-23, comme décrit ci-dessous : migration `0025_user_cards_read_at` (les cartes déjà possédées comptent comme lues), route testée avec des appels concurrents, filtres et tag dans l'album. L'encart sous le comptoir préfère maintenant un mot jamais lu quand aucun n'est dû, avec « Lire » au lieu de « Relire ».*

### Ce que voit le joueur

- **Le tag « Nouveau »** reste sur une carte de l'album tant qu'il n'a pas ouvert sa fiche.
- **Il s'efface** dès que la fiche s'ouvre, depuis le résumé du sachet, l'album, un échange ou ailleurs.
- **Deux filtres de plus** dans l'album :
  - « Nouveaux » : les cartes jamais ouvertes, avec leur nombre ;
  - « Aujourd'hui » : les cartes obtenues pour la première fois aujourd'hui, heure de Paris.
- Un deuxième exemplaire d'une carte déjà lue ne la remet pas en « Nouveau ».

### Données

- **Ce qui existe :**
  - `user_cards.first_obtained_at` existe déjà, et l'API l'envoie au client (`GET /me/cards`), mais le web l'ignore (`apps/web/src/player/collection.ts`). Le filtre « Aujourd'hui » ne demande donc rien au serveur.
  - Rien n'enregistre qu'une carte a été lue. `user_mastery` ne convient pas : sa ligne n'existe qu'au premier défi.
- **Proposition :** une colonne `read_at` (date, vide par défaut) sur `user_cards`. Une carte est nouvelle tant qu'aucune de ses lignes (une par variante) n'a de `read_at`.
  - La migration est additive.
  - Les cartes que les joueurs de la bêta possèdent déjà sont marquées lues à la migration, pour ne pas les couvrir de tags d'un coup.
- **Route :** `POST /me/cards/:cardId/read` remplit `read_at` s'il est vide.
  - C'est une seule mise à jour, sans lecture préalable, donc rejouable sans effet et sans verrou.
  - Elle répond « sans effet » si le joueur ne possède pas la carte.
  - Un test d'intégration la vérifie, avec des appels concurrents.
- **Côté client :** le web marque la carte lue dès que la fiche s'ouvre, sans attendre la réponse, et met à jour son cache de la collection.
- **Contrat :** `ownedCardSchema` gagne `readAt`, facultatif (additif, D-023).

### Code

- `packages/db` (schéma et migration) ;
- `apps/api/src/me/routes.ts` ;
- `packages/contract/src/me.ts` ;
- `packages/view-model/src/album.ts` (filtres, avec tests) ;
- `apps/web/src/album/` et `apps/web/src/shell/card-sheet.tsx`.

## Lot 3 · Le mot qui s'échappe

### L'impasse de « Réviser »

- **Le problème :** les deux « Réviser » mènent à `/defis` sans rien de plus : celui de l'encart sur Jouer et celui de la lettre au courrier. Le joueur arrive sur l'accueil des défis, souvent déjà faits, et non sur le mot.
- **La correction :** les deux mènent à `/defis?mot=<id>`, la révision d'un seul mot, qui existe déjà pour la liste « Ces mots t'échappent ».
- **Code :** `apps/web/src/play/slipping-word.tsx`, `apps/web/src/shell/mail-panel.tsx`.

### Le bon mot

- **Le problème :** sur Jouer, l'encart prend la première question de la file des défis, qui peut être un mot nouveau et pas un mot dû (`booster-screen.tsx`, `fetchChallenges(1)`).
- **La correction :** il prend les mots dus, comme le courrier (`mailbox.slipping`).

### L'encart donne envie de lire

- **Un mot dû se montre en devinette** : « Un mot est en train de t'échapper. », le dos de sa carte et le début de sa définition, coupé à deux lignes avec « … ». Toucher l'encart ou « Réviser » lance la révision de ce mot.
  - **Écart avec la première version de ce cahier,** relevé à la réalisation : montrer le mot et sa définition à côté de « Réviser » donnait la réponse une seconde avant la question. Or l'Encre et la Dorure se gagnent en écrivant le mot de tête à partir de sa définition (P33). La fiche d'une carte évitait déjà ce raccourci ; l'encart fait de même en cachant le mot, pas la définition.
- **Le mot change à chaque visite de Jouer,** parmi les mots dus, le plus en retard d'abord. Pas de minuterie : un texte qui bouge seul pendant qu'on regarde le sachet distrait. Le compte des visites reste sur l'appareil.
- **Sans mot dû,** l'encart montre un mot de l'album (« Un de tes mots »), avec son nom, le début de sa définition et « Relire ». Toucher l'encart ouvre sa fiche. Sans aucune carte, il ne s'affiche pas. Il préfère un mot jamais lu (lot 2), avec « Lire » au lieu de « Relire ».
- **Pas de nouvelle route :** les mots dus se calculent sur le web à partir de ce qu'il lit déjà (`GET /me/mastery`, `GET /me/cards`), avec les mêmes conditions que le courrier : dus maintenant, encore possédés.
- **Code :** `wordUnderCounter`, `SLIPPING_RIDDLE` et `OWN_WORD` dans `packages/view-model/src/play.ts` (testés), `apps/web/src/play/slipping-word.tsx`.

## Lot 4 · Les signaux de l'écran Jouer

*Fait le 2026-10-23, comme décrit ci-dessous. Écarts : un invité qui doit créer son compte ne voit pas de jauge (il n'attend pas le temps) et son bouton compte les plis qu'il peut encore ouvrir sans compte ; le texte « recharge » reste pour l'historique des coffrets ouverts quand les niveaux en donnaient, sans plus jamais être proposé. La jauge n'a pas pu être reproduite à plusieurs moments en capture (le panneau du navigateur ralentit les animations) : à regarder pendant la recette (JOU-02).*

### Le nombre de sachets dans le bouton

- **Le problème :** l'anneau du stock (le rond avec « 4 ») ne dit pas ce qu'il compte.
- **La correction :** le bouton dit « Ouvrir le sachet · 4 restants », ou un texte plus court à trouver avec [voix.md](../voix.md).
  - L'anneau reste, avec le mot « sachets » sous le chiffre.
  - Les autres états du bouton (« Ouvrir un sachet bonus », « Prochain dans … ») ne changent pas.
- **Code :** `packages/view-model/src/play.ts` (`stock.action`), `apps/web/src/play/counter-bits.tsx`.

### La jauge de recharge

- **Aujourd'hui :** sur le sachet vide, un voile gris recule du bas vers le haut au fil des 30 minutes. Son bord se lit comme un défaut d'affichage, pas comme un remplissage.
- **Demain :**
  - une jauge franche : la couleur du sachet monte du bas, avec un bord doré net qui ondule doucement ;
  - le temps restant est écrit sur le sachet (« 10 min ») ;
  - quand la jauge arrive en haut, le sachet se remplit d'un coup, avec un petit son.
- **D'abord, reproduire ce qu'il a vu :** une capture à plusieurs moments de la recharge, avant de corriger.
- **Code :** `apps/web/src/booster/sachet.tsx`, `sachet.module.css`.

### Les coffrets disent d'où ils viennent

- **Au courrier :** « Coffret du niveau 4 » au lieu de « 1 coffret à ouvrir ».
- **Fermé :** « Niveau 4 atteint » au-dessus de « Un coffret pour toi ».
- **Ouvert :**
  - chaque récompense a son visuel : un sachet bonus montre un vrai sachet en miniature, un titre sa plaque, un avatar sa gravure ;
  - une ligne dit où il est rangé (« Dans ta réserve : 3 sachets bonus ») ;
  - un bouton « Voir le chemin des niveaux » s'ajoute.
- **Au passage :** retirer les textes de récompense « recharge », restés alors que P58 a supprimé la recharge le 2026-10-23 (`packages/view-model/src/rewards.ts`).
- **Code :** `apps/web/src/shell/coffret-dialog.tsx`, `mail-panel.tsx`, `packages/view-model/src/rewards.ts`.

### Les prochains niveaux en clair

- **Aujourd'hui :** les quatre prochains niveaux ne montrent qu'une icône et « Niv. N ».
- **Demain :** chacun a aussi un mot sous l'icône (« Sachet », « Sachet garni », « Échanges », « Titre »…). Le survol, ou un toucher sur téléphone, donne le détail complet.
- **Code :** `apps/web/src/play/level-strip.tsx`, `packages/view-model/src/rewards.ts`.

## Lot 5 · Collections et raretés

*Fait le 2026-10-23, avec les lignes validées par le propriétaire, publiées dans la version `2026-10-23.2` du catalogue (seules les lignes changent par rapport à la `.1`). Écarts : la ligne vit dans le fichier de la collection, pas dans la base, puisque l'affichage ne lit jamais la base ; sur ordinateur, la ligne et le nom du sachet du comptoir sont en haut du comptoir, et ceux des sachets voisins sur leur côté extérieur (dessous, ils passaient sous le sachet du comptoir) ; sur téléphone, les sachets fermés sont des pastilles à cadenas sous le nom, des puces avec les noms ne tenaient pas entre les boutons flottants.*

### Une ligne par collection

- **Données :** un champ `tagline` dans `content/collections.toml`. Il passe dans le manifeste du catalogue (champ facultatif, additif) et dans la base.
- **Affichage :**
  - sous le nom de la collection, sur Jouer (sachets voisins, sélecteur sur téléphone) ;
  - dans l'album, sous l'onglet choisi.
- **Propositions de texte,** à reprendre par le propriétaire :
  - Les Fondateurs : « La nature, la table et tout le reste. Par là qu'on commence. »
  - Caractères et travers : « Manies, défauts et tempéraments. »
  - Métiers et objets disparus : « Ceux qui les faisaient, ce qu'on tenait en main. »
- **Code :** `content/pipeline` (`release`), `packages/contract/src/catalog.ts`, puis `pnpm catalog:publish`.

### Le choix de la collection se voit

- **Au niveau 3,** quand le choix s'ouvre :
  - le coffret le dit déjà (« Ouvre : … ») ;
  - en plus, au retour sur Jouer, les sachets des autres collections avancent une fois, avec une bulle « Choisis ta collection » qui se ferme au toucher et ne revient pas.
- **Avant le niveau 3 :**
  - sur ordinateur, les sachets fermés montrent déjà leur cadenas et « Niv. 3 » ;
  - sur téléphone, le sélecteur ne montre aujourd'hui que les sachets ouverts, donc aucun avant le niveau 3. Il montrera aussi les sachets fermés, avec leur cadenas, comme sur ordinateur.
- **Les sachets voisins** sont clairement des boutons : leur nom et leur ligne sous chacun, et un survol qui les avance.
- **Code :** `apps/web/src/play/pack-peek.tsx`, `collection-picker.tsx`, `packages/view-model/src/play.ts`.

### L'échelle des raretés se montre

- **Dans la fiche d'une carte,** à côté du nom de la rareté : les six gemmes dans l'ordre, de Courant à Légendaire, celle de la carte allumée, les autres éteintes. On voit d'un coup d'œil que Précieux vient après Rare et avant Épique.
- **Dans l'album,** la rangée des compteurs par rareté suit le même ordre, de Courant à Légendaire. Aujourd'hui, elle va de la plus rare à la plus courante. Chaque gemme a son nom au survol.
- **La liste ordonnée** existe déjà (`RARITIES`, `packages/core`). Il faut un petit composant d'échelle dans `apps/web/src/components/rarity-icon.tsx`.

## Plus tard

- **La carte lue à voix haute (point 13) :**
  - **Coût :** les 1 561 définitions font environ 160 000 caractères. C'est le même ordre que les mots, déjà dans l'offre gratuite de Google (D-032), donc pas un problème de frais. Rien ne change dans l'architecture : fichiers statiques sur le CDN, nommés par leur empreinte, champ facultatif dans le catalogue.
  - **Risque :** la qualité. Les autres mots rares d'une définition ne sont pas guidés par la notation phonétique.
  - **Prochaine étape :** essayer sur 20 cartes, à écouter par le propriétaire, avant de décider.
- **Les hautes raretés plus spectaculaires (point 14) :** à juger après le lot 1. Le testeur n'en a probablement vu aucune.
  - Pour la recette, il faudra un moyen de forcer une Épique ou une Légendaire en local (commande de dev, comme `dev:player`).
- **Réglages (point 15) :** lui demander ce qu'il entendait. Piste : Réglages est à la fois dans le menu du joueur et parmi les boutons ronds de Jouer, ce doublon mérite d'être revu.
- **Rendu plus moderne (point 16) :** lui demander deux ou trois applis ou jeux qu'il trouve modernes, puis une passe de direction artistique (D-022), à proposer au propriétaire.

## Ordre proposé

1. **Lot 1,** l'essentiel : la cascade, la grille de lecture, la citation.
2. **Lot 3,** car l'impasse de « Réviser » est un vrai défaut ; le début de la définition dans l'encart vient avec.
3. **Lot 2.** Il touche au schéma, et l'encart du lot 3 s'en sert pour préférer les mots nouveaux. Le lot 3 marche sans lui, puis s'enrichit.
4. **Lot 4,** des corrections petites et indépendantes les unes des autres.
5. **Lot 5.** Le texte des lignes de collection est à valider par le propriétaire, puis le catalogue est à republier.

**Après chaque lot :**
- `pnpm check`, et `pnpm test:integration` pour le lot 2 ;
- une vérification dans le navigateur (ordinateur et téléphone) ;
- la mise à jour de [recette-web.md](../recette-web.md) (JOU-06, JOU-10, NIV-03, album) et de [ouverture.md](ouverture.md) (§6 et §7) ;
- un commit.

## Décisions du propriétaire

1. **Qu'est-ce qui rend une carte « lue » ?** Recommandé : ouvrir sa fiche. Avec cette règle, voir sa face pendant l'ouverture carte par carte ne compte pas. C'est simple et prévisible, mais toutes les cartes d'un sachet restent « Nouveau » tant qu'on ne les a pas touchées.
   - L'autre option : la face posée au moins 2 secondes pendant l'ouverture compte aussi. C'est plus juste pour qui lit, mais plus flou.
2. **Les cartes déjà possédées à la migration :** recommandé, marquées lues.
3. **Les filtres de l'album :** recommandé, « Nouveaux » et « Aujourd'hui » tous les deux.
4. **Le texte des lignes de collection :** les propositions du lot 5, ou les tiennes.
5. **L'ordre des lots :** celui proposé ci-dessus, ou un autre.
