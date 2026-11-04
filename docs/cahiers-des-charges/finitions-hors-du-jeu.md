# Cahier des charges · Les finitions hors du jeu, en commençant par l'accueil

- **Statut :** proposé le 2026-11-04, toutes les questions tranchées le même jour (ci-dessous). Rien n'est construit ; le lot 1 (la maquette de l'accueil) vient en premier.
- **Source :** demande du propriétaire du 2026-11-04 : après les Défis, « passer aux peaufinages restants, genre la page d'accueil ». C'est la partie « Hors du jeu » de la phase 3 de la [direction artistique](direction-artistique.md#hors-du-jeu), qui reste à faire maintenant que « La Bibliothèque » est la seule allure.
- **Règles liées :** P1 (positionnement), P47 et P53 (le sachet), P55 (liste d'attente), P71 (cible du lancement), D-036 (e-mails sans image distante), D-056 (La Bibliothèque).
- **Cahiers liés :** [direction-artistique.md](direction-artistique.md), [e-mails.md](e-mails.md), [ouverture.md](ouverture.md). Voix : [voix.md](../voix.md), partie « Vendre le bénéfice ».

## Choix du propriétaire

- **2026-11-04 · Toutes les recommandations retenues**, de A1 à A6 et de B1 à B4 :
  - le premier écran montre un vrai sachet que le visiteur déchire sur place, sans compte (A1 : a) ;
  - la page est construite pour l'ouverture : « Jouer » mène au jeu en invité, un seul réglage le remplace par la liste d'attente tant que la bêta est fermée (A2 : a) ;
  - « Comment on joue » tient en trois feuilles avec les vraies pièces du jeu en mouvement (A3 : a) ;
  - les collections en couvertures de livres et l'énigme du jour jouable sans compte s'ajoutent (A4 : a) ;
  - sur téléphone, le sachet est visible au premier écran, le bouton à portée du pouce (A5 : a) ;
  - une planche `/planches/accueil` d'abord, jugée par le propriétaire avant de construire (A6 : a) ;
  - ensuite : icône, favicon, écran de lancement et images de partage, puis e-mails, puis cadres et emblèmes, puis fiches des stores (B1 : a) ;
  - les images de partage posent la vraie carte du jeu sur le sous-main (B2 : a) ;
  - les e-mails sont une feuille crème sur fond de bois uni, bouton plein en or (B3 : a) ;
  - les 13 cadres d'avatar sont redessinés dans les matières de la salle, mêmes identifiants (B4 : a).

## Ce qu'on a aujourd'hui

### L'accueil du site (`apps/web/src/landing/`)

La page `leximon.fr` déroule, sur les rayonnages de la salle :

1. **En-tête** : le logo, et « Reprendre la partie » pour un joueur ou la liste d'attente pour un visiteur.
2. **Premier écran** : à gauche, une grande carte horizontale propre à l'accueil (le mot, sa définition, sa gravure, « Encore un mot » pour en tirer un autre) ; à droite, le titre « La langue a jeté des mots superbes. On les a ramassés. », une phrase, le bouton et le lien Discord.
3. **Les raretés** : « Six raretés, selon la fréquence du mot dans les livres », six vraies cartes du jeu en rang, de Courant à Légendaire, chacune avec sa fréquence chiffrée.
4. **Mode d'emploi** : une bande crème avec trois colonnes, Sachets (un sachet en image), Défis (un QCM aux boutons ronds) et Échanges (deux cartes et une flèche).
5. **Témoignages** : prévus, cachés tant qu'aucun joueur n'a donné son accord.
6. **Fin** : « Tes sachets sont prêts. » et le bouton, puis le pied de page (sources, liens légaux, Discord, contact).

Ce qui ne va pas :

- **Ça fait encore site, pas jeu.** Seul le fond a changé. La grande carte, la bande du mode d'emploi, les boutons ronds du QCM et les blocs de texte posés à même les rayonnages viennent de l'ancienne allure. Rien n'a le relief, la matière ni le mouvement du jeu (sous-main, feuilles, boutons-objets, sachet en 3D).
- **On ne voit pas le jeu.** La pièce maîtresse du jeu, le sachet qu'on déchire, n'apparaît qu'en petite image au milieu de la page. La carte du premier écran n'est pas celle qu'on tire dans le jeu.
- **Sur téléphone, le premier écran n'a que du texte.** Le titre, la phrase et le bouton prennent tout l'écran ; la carte n'arrive qu'après un défilement.
- **Le texte se lit mal sur les rayonnages.** La phrase d'accroche et les lignes sous les raretés sont en petit, en clair, sur un fond chargé.
- **Le mode d'emploi parle encore de « Défis »** comme d'un QCM, alors que le cœur du jeu est maintenant la révision (mot à écrire, écoute, paires, paliers).
- **La bêta fermée est codée en dur.** Le visiteur ne peut que laisser son adresse ; le jour de l'ouverture, toute la page change de promesse.

### Le reste hors du jeu

| Élément | Où | État |
|---|---|---|
| Premier lancement de l'app mobile | `apps/mobile/src/screens/beta/` | Sans invitation, un écran de papier demande un code ou propose la liste d'attente. C'est l'accueil du téléphone pendant la bêta |
| Images de partage | `apps/web/src/app/opengraph-image.tsx`, `carte/[id]/`, `joueur/[pseudo]/` | Une fiche de dictionnaire (le site), la carte, le profil. Mise en page de l'ancienne allure, couleurs passées par les tokens |
| Favicon, icône d'app, écran de lancement | `apps/web/src/app/icon.svg`, `apple-icon.png`, `apps/mobile/assets/images/` | Le sceau au L de l'ancienne allure ; fond de l'écran de lancement déjà à la couleur de la salle |
| E-mails | `apps/api/src/email/` | Gabarit clair, Georgia, sans image distante |
| Cadres d'avatar | atelier | 13 cadres dessinés pour l'ancienne allure |
| Emblèmes de clan | clan | Couleurs choisies avant la salle |
| Admin | `/admin` | Fonctionne ; quelques couleurs de graphiques encore dans le code |
| Fiches des stores | [fiches-stores.md](../fiches-stores.md) | Textes écrits ; captures à faire avec la nouvelle allure |
| Textes du joueur | `packages/view-model`, écrans | Attendent les dix phrases aimées et dix détestées du propriétaire ([direction-artistique.md](direction-artistique.md#les-textes)) |

## Ce qu'on veut

**L'accueil donne envie en cinq secondes, et ça fait jeu.** Le visiteur voit tout de suite la salle, un vrai sachet, une vraie carte rare, et comprend qu'il peut jouer gratuitement. Le jeu se vend par la trouvaille, la rareté chiffrée et l'humour (P71), pas par l'apprentissage : la révision s'explique une fois, plus bas, comme ce qui fait monter les cartes.

Critères :

| Critère | Seuil |
|---|---|
| Premier écran | Sur un téléphone de 375 × 812 comme sur un écran de 1440 × 900, le titre, une pièce du jeu (sachet ou carte) et le bouton principal sont visibles sans défiler |
| Ça fait jeu | Le propriétaire, sur son téléphone : « c'est le jeu », pas « une page de présentation » |
| Lisibilité | Tout texte courant posé sur une feuille ou un bandeau, contraste 4,5:1 au moins |
| Vitesse | LCP sous 2,5 s en 4G simulée ; pas plus de JavaScript qu'aujourd'hui au premier écran, hors pièce interactive chargée après |
| Mouvement | Mouvement réduit respecté : tout reste lisible et cliquable sans animation |
| Captures | Le premier écran et chaque section font une capture propre pour les réseaux et les stores |
| Référencement | Titre, description, image de partage et données structurées gardés ; aucune page indexée ne disparaît |

## Partie A · L'accueil

Le déroulé proposé, chaque section reprenant les pièces du jeu (sous-main vert, feuilles, boutons-objets, couvertures de livres, sachet en 3D). Les points en italique dépendent des questions.

1. **En-tête** : comme aujourd'hui, avec le bouton-objet d'or du jeu.
2. **Premier écran, sur le sous-main** : le titre en lettres dorées, une phrase, le bouton principal, et *la pièce du jeu choisie en A1*. Sur téléphone, le titre passe au-dessus, la pièce au milieu, le bouton à portée du pouce (A5).
3. **« Tu sais ce que c'est ? »** : trois ou quatre mots drôles de « Caractères et travers » en vraies cartes, qu'on retourne d'un clic pour lire la définition. C'est l'argument de l'humour.
4. **Les raretés** : les six cartes sur une étagère, la fréquence chiffrée de chacune sur une étiquette de papier sous la carte (« Imprimé une fois sur 2,2 milliards de mots »).
5. **Comment on joue** : *trois feuilles (A3)*, Sachets, Révision, Échanges, avec les vraies pièces du jeu.
6. **Les collections** : *si A4 les retient*, les trois collections en couvertures de livres, comme dans « S'entraîner sur… », avec leur nombre de mots.
7. **Témoignages** : sur des billets de papier, dès qu'il y en a.
8. **Fin** : la promesse et le bouton, sur le sous-main.
9. **Pied de page** : sur le bois, liens inchangés.

Ce qui ne change pas : l'adresse, les liens du pied de page, la liste d'attente et son consentement (P55), le parcours du joueur connecté (« Reprendre la partie »), les données des cartes servies par le CDN.

### Premier lancement de l'app mobile

Pendant la bêta fermée, l'écran sans invitation prend le premier écran de l'accueil (sous-main, titre, pièce du jeu), avec le champ du code d'invitation et la liste d'attente. À l'ouverture publique, il disparaît : le joueur arrive directement sur Jouer, en invité.

## Partie B · Le reste hors du jeu

1. **Icône, favicon, écran de lancement** : le sceau de cire au L sur le cuir vert, comme prévu par la direction artistique. Mêmes fichiers, mêmes tailles.
2. **Images de partage** : *selon B2*. Elles gardent leur rôle (le mot d'abord, la rareté chiffrée ensuite, le jeu en dernier) et leurs tailles.
3. **E-mails** : *selon B3*, sans image distante (D-036), Georgia reste la police.
4. **Cadres d'avatar** : *selon B4*, les identifiants en base restent les mêmes.
5. **Emblèmes de clan** : couleurs accordées à la salle, mêmes identifiants.
6. **Admin** : couleurs des graphiques sorties du code vers les tokens. Pas de refonte.
7. **Fiches des stores** : captures et image de présentation refaites une fois l'accueil et l'app finis.

Les textes attendent les vingt phrases du propriétaire et ne font pas partie de ce cahier.

## Questions à trancher

**A1 · La pièce du premier écran.**
- a. **(recommandé)** Un vrai sachet posé sur le sous-main, que le visiteur déchire sur place, sans compte : une carte se révèle avec sa rareté, puis « Ouvrir mes sachets du jour ». Le jeu se goûte avant de s'inscrire, et c'est la capture la plus forte.
- b. Une vraie carte rare du jeu, qui se retourne et brille au survol, avec « Encore un mot » pour en tirer une autre.
- c. Un éventail des six raretés, de Courant à Légendaire, la Légendaire devant.

**A2 · Le bouton principal, avant et après l'ouverture publique.**
- a. **(recommandé)** Construire la page pour l'ouverture : « Jouer » mène au jeu en invité. Tant que la bêta est fermée, un seul réglage remplace ce bouton par la liste d'attente. Le jour de l'ouverture, on bascule le réglage, sans refaire la page.
- b. Construire pour la bêta fermée seulement (liste d'attente), et refaire le bouton à l'ouverture.

**A3 · Comment on joue.**
- a. **(recommandé)** Trois feuilles avec les vraies pièces du jeu en petit et en mouvement : le sachet qui se balance, une question de révision sur sa tuile de papier qui passe au vert, deux cartes qui s'échangent. Une phrase par feuille.
- b. Une courte vidéo de jeu, tournée avec l'outillage de démo, et trois phrases à côté.
- c. Le contenu d'aujourd'hui, seulement habillé dans la salle.

**A4 · Les sections en plus.**
- a. **(recommandé)** Les collections en couvertures de livres, et l'énigme du jour en encart, jouable sans compte (elle existe déjà en page publique).
- b. Les collections seulement.
- c. Ni l'une ni l'autre : la page reste courte.

**A5 · Le premier écran sur téléphone.**
- a. **(recommandé)** Titre court en haut, la pièce de A1 au milieu, le bouton en bas à portée du pouce, la phrase d'accroche juste sous le pli.
- b. Comme aujourd'hui : titre, phrase et bouton d'abord, la pièce après un défilement.

**A6 · Une maquette avant de construire.**
- a. **(recommandé)** Une planche `/planches/accueil` montée avec les vraies pièces du jeu, animée, en grand écran et en téléphone. Le propriétaire la juge, puis on construit.
- b. Construire directement la page, et la reprendre sur retours.

**B1 · L'ordre après l'accueil.**
- a. **(recommandé)** Icône, favicon et écran de lancement, avec les images de partage (elles se voient dès qu'on partage le site) ; puis les e-mails ; puis cadres d'avatar et emblèmes ; puis les fiches des stores.
- b. Les e-mails d'abord (la campagne d'ouverture partira avec eux), puis le reste dans l'ordre de a.

**B2 · Les images de partage.**
- a. **(recommandé)** La vraie carte du jeu posée sur le sous-main, dans la salle, avec la fréquence chiffrée et le domaine. Pour le site, la carte du jour de l'accueil.
- b. La fiche de dictionnaire d'aujourd'hui, posée dans la salle.

**B3 · Les e-mails.**
- a. **(recommandé)** Une feuille crème sur fond de bois uni (couleurs pleines, pas d'image), titre en brun, bouton plein en or cerné d'encre.
- b. Le gabarit d'aujourd'hui, couleurs accordées seulement.

**B4 · Les cadres d'avatar.**
- a. **(recommandé)** Redessinés dans les matières de la salle (bois, cuir, laiton, or, nacre), du plus simple au plus rare, en relief comme les boutons-objets.
- b. Les dessins d'aujourd'hui, couleurs accordées seulement.

## Lots

1. **Maquette de l'accueil** (si A6 : a), grand écran et téléphone.
2. **L'accueil** et le premier lancement de l'app mobile pendant la bêta, web et mobile ensemble. Recette ajoutée à `recette-web.md` et `recette-mobile.md`.
3. **Partie B**, dans l'ordre de B1, un lot par ligne.

## Ce qu'on évite

- Une page de présentation de logiciel : pas de grille d'icônes, pas de « fonctionnalités », pas de chiffres de croissance.
- Vendre l'apprentissage en premier (P71). La révision s'explique comme ce qui fait monter les cartes.
- Un premier écran qui charge tout le jeu : la pièce interactive se charge après l'affichage.
- Des mots ou des gravures hors catalogue publié : tout vient des cartes et de leurs sources autorisées.
