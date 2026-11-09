# Cahier des charges · Avantages du mécène

- **Statut :** tranché le 2026-11-08, les dix recommandations du § 9 retenues. Éditions de bibliothèque, épingles en plus et cabinet du mot construits le 2026-11-08, page des mécènes, vote et liaison Discord le 2026-11-09 (web et mobile), recette MEC-13 à MEC-18 dans [recette-nouveautes.md](../recette-nouveautes.md). Le cabinet ne montre pas encore les mots du Wiktionnaire ni les citations de Wikisource (§ 2). Le Discord attend ses réglages (§ 4, pas à pas). Sceau de cire du sachet construit le même jour (MEC-19). Reste la parure de joute, à faire une fois la refonte des joutes en cours commitée.
- **Règles concernées :** P72 (gratuit et payant) et P73 (abonnement Mécène), dans [regles-du-jeu.md](../regles-du-jeu.md), qui fait foi. Socle et dénichage : [mecene.md](mecene.md).
- **D'où ça vient :** après le dénichage, le propriétaire trouve l'offre mince. La page Mécène ne montre que deux avantages construits (le cosmétique du mois et le mot déniché), alors que P73 en promet d'autres. Il retient : construire les éditions de bibliothèque et le cabinet du mot avant l'ouverture de la vente, et ajouter de petits avantages sociaux. De l'XP en plus lui irait, mais elle est remise à plus tard (P72 l'exclut tant qu'elle n'est pas changée), et les sachets restent exclus.
- **Objectif :** tout ce qui suit est construit, web et mobile, avant l'ouverture de la vente vers mi-janvier 2027.

## Ce qui existe

- **Les gravures** : chaque carte du catalogue (2 065 aujourd'hui) a une gravure en deux calques WebP de transparence seule, les traits (`ink`) et les masses (`fill`), teintés à l'affichage par la carte (`apps/web/src/components/card.tsx`, et son pendant sur le mobile). Changer l'encre et le papier d'une gravure ne demande aucune nouvelle illustration.
- **Le calendrier du mécène** : `PATRON_SCHEDULE` dans `packages/core/src/rules.ts`, un cosmétique par mois, réclamé sur la page Mécène (coffret).
- **Les cartes épinglées** : `pinned_cards`, 3 places à l'ouverture du profil, une de plus tous les 10 niveaux jusqu'à 6 au niveau 30 (P58, `pinnedSlotsAtStart` et `pinnedSlotsUntil`).
- **Les données des mots** : fréquence Google Ngram par décennie depuis 1800 (`content/pipeline`, `ngram`), article du Littré (domaine public), étymologie et une citation par carte (1 363 cartes sur 2 065 en ont une), Wiktionnaire en local.
- **Le Discord** : serveur, bot « Leximon Bot » (sans l'intent des membres), rôles posés par l'API le 2026-11-08.
- **Les joutes** : le portrait de chaque joueur (avatar, cadre, bannière) face à l'adversaire.
- **Ce qui manque** : aucune édition, aucun cabinet, aucun lien entre un compte Leximon et un compte Discord, aucun vote.

## 1. Éditions de bibliothèque

Une édition est une façon d'imprimer la gravure d'une carte : la couleur des traits, celle des masses et le ton du papier. Exemples : sanguine (traits rouge brique sur papier crème), lavis (masses gris-bleu délavées), encre de Chine (noir profond sur papier blanc), bistre, sépia, mine de plomb.

- Elle ne touche que la gravure et son papier : jamais le cadre, la couleur, le reflet ou la gemme de la rareté (P72).
- Le mécène l'applique à une carte qu'il possède, depuis la fiche de la carte, ou à tout son album d'un coup.
- Elle appartient au joueur, pas à l'exemplaire : une carte échangée arrive chez l'autre dans son allure ordinaire.
- Les autres la voient là où ils voient ses cartes : cartes épinglées du profil public, joutes.
- Les éditions reçues restent à vie après l'arrêt (P73) ; elles restent exclusives aux mécènes.
- Une édition par mois, dévoilée le 1er avec le cosmétique du mois. Rien à réclamer : le mécène possède l'édition de chaque mois payé, comme les trois du départ dès son premier paiement.
- **Construit :** l'épreuve est une feuille du papier de l'édition, collée dans la place de la gravure avec un filet à l'intérieur de son bord ; le sujet y tient tout entier (un sujet haut ne déborde plus dans l'en-tête). Couleurs dans `packages/tokens/src/card-editions.ts`, qu'un test tient à l'écart de toute couleur de rareté. Le choix se fait sur la fiche de la carte (« Ordinaire », puis les éditions possédées, et « Appliquer à tout l'album ») ; la page Mécène dit lesquelles on possède. Les éditions se voient dans l'album, sur la fiche, sur ses cartes épinglées et sur le profil public ; pas encore en joute. Routes `GET /me/editions`, `PUT /me/editions/album`, `PUT /me/editions/cards/:cardId` ; table `card_editions` et colonne `players.card_edition` (migration `0051`).

## 2. Cabinet du mot

Une fiche enrichie de chaque carte, pour le mécène, ouverte depuis la fiche de la carte :

- **L'usage du mot** : une courbe par décennie depuis 1800, tirée de Google Ngram, avec une phrase qui la lit (« Le mot culmine vers 1850, puis disparaît des livres après 1920. »). P73 dit « depuis 1500 » : avant 1800, le corpus français de Google est trop maigre pour une courbe honnête (§ 9, question 4).
- **L'article du Littré** : le texte de l'article, son historique et ses citations anciennes, en domaine public.
- **Les mots de la même famille** : ceux du catalogue qui partagent sa racine (lien vers leur carte), et ceux du Wiktionnaire.
- **Les citations** : celle de la carte, et d'autres de Wikisource quand la chaîne en a trouvé.

Le carnet (statistiques de ses mots, album à imprimer) que P73 range avec le cabinet vient dans un lot suivant (§ 9, question 5).

## 3. Cartes épinglées en plus

Le mécène a des places d'épingles en plus de celles que lui donnent ses niveaux. Elles ne remplacent jamais une récompense de niveau (§ 9, question 6). À l'arrêt, les places en plus disparaissent : les cartes épinglées au-delà ne se montrent plus, et reviennent s'il reprend sans avoir changé ses épingles entre-temps. **Construit :** `extraPinnedSlots` (3) dans `PATRON_SCHEDULE`, compté dans la garde-robe tant que l'abonnement est payé, jamais pendant l'essai.

## 4. Rôle et salon sur le Discord

Un rôle « Mécène » sur le Discord du projet, qui ouvre un salon réservé et colore le pseudo. Le rôle part quand l'abonnement s'arrête. Le lien entre le compte Leximon et le compte Discord se fait depuis la page Mécène (§ 9, question 7).

**Construit le 2026-11-09.** « Relier mon Discord » (mécène payant seulement) ouvre la page de Discord, qui demande deux droits : connaître le compte, et l'ajouter au serveur s'il n'y est pas. La liaison passe par une route de l'API (`/discord/callback`) et non par Better Auth : relier Discord n'en fait pas un moyen de se connecter à Leximon, et Discord ne donne pas l'adresse e-mail. Le bot pose le rôle par la file, le retire à l'arrêt de l'abonnement, à la déliaison et à la suppression du compte ; la maintenance du matin rattrape un message perdu. Un compte Discord relié à un second compte Leximon quitte le premier.

**Pas à pas (toi) :**

1. Sur le serveur, crée le rôle « Mécène » (couleur au choix) et le salon réservé, visible de ce rôle seul. Place le rôle du bot au-dessus de « Mécène » dans la liste des rôles, sinon il ne peut pas le donner.
2. Donne au bot les droits « Gérer les rôles » et « Créer une invitation » (ce dernier lui permet d'ajouter un mécène au serveur).
3. Dans le portail des développeurs Discord, application « Leximon Bot », onglet OAuth2 : ajoute les redirections `https://api.leximon.fr/discord/callback` et `http://localhost:8787/discord/callback`, et copie le secret du client.
4. Donne-moi l'identifiant du rôle (clic droit sur le rôle, « Copier l'identifiant », mode développeur activé) : il va dans `DISCORD_PATRON_ROLE_ID` de `apps/api/wrangler.jsonc`.
5. Pose les deux secrets, en local dans `apps/api/.dev.vars` et en production ([mise-en-ligne.md](../mise-en-ligne.md#6-secrets-de-lapi--toi)).

Tant qu'un de ces réglages manque, la page Mécène ne montre pas le bloc Discord.

## 5. Vote des mécènes

Avant une nouvelle collection, le propriétaire propose trois thèmes dans `/admin`. Les mécènes votent sur leur page Mécène pendant une semaine, une voix chacun ; le thème gagnant est celui de la collection. Le résultat est annoncé sur `/nouveautes` et le Discord.

- Pas de proposition libre des joueurs : ce serait du texte écrit par les joueurs, à modérer.
- Pendant l'essai, pas de voix (l'essai donne le titre et le badge seulement) : la voix arrive au premier paiement (§ 9, question 8).

## 6. Page de remerciements

Une page publique `/mecenes` : « Merci à ceux qui font vivre Leximon », puis les pseudos des mécènes, les fondateurs d'abord avec leur sceau, puis par ancienneté. Chaque pseudo mène au profil public.

- Un profil privé (P60) n'y figure jamais.
- La page ne vend rien : ni prix, ni bouton, ni lien vers l'offre, qui ne se montre qu'aux trois endroits de P73.
- Qui arrête quitte la liste (§ 9, question 9).

## 7. Animation d'ouverture et parure de joute

- **Ouverture de sachet** : le sachet du mécène est fermé d'un sceau de cire à sa marque, qui se brise à l'ouverture. Même durée que l'ouverture ordinaire, même révélation des cartes : rien ne laisse deviner une rareté avant son tour.
- **Parure de joute** : la couronne du mécène sur son portrait, vue par l'adversaire, et une entrée en scène à lui. Elle ne dit rien de la force du joueur.
- Les deux tiennent au statut, comme le titre et le badge : elles partent à l'arrêt. D'autres animations peuvent ensuite venir comme cosmétiques du mois, gardées à vie (§ 9, question 10).

## 8. Page Mécène

La vitrine (`apps/web/src/beta/patron-screen.tsx` et l'écran du mobile) liste les nouveaux avantages, dans la limite de ce qui est construit le jour de l'ouverture : une promesse affichée est une promesse tenue (N2).

## 9. Décisions

Toutes tranchées le 2026-11-08 selon la recommandation.

1. **Ce qu'est une édition.**
   - a. Une allure d'impression (encre, masses, papier) applicable à toutes ses cartes. Aucune illustration nouvelle, les 2 065 cartes d'un coup.
   - b. Une dizaine de cartes par mois reçoivent une gravure différente. Plus rare, mais chaque gravure se cherche, se licencie et se détoure à la main.
   - **Recommandation : a.** C'est la lecture la plus forte de « une dizaine de variantes (sanguine, lavis, encre) », et elle ne coûte que des réglages de couleur.
2. **Combien d'éditions au départ.**
   - a. Trois à l'ouverture de la vente (sanguine, lavis, encre de Chine), puis une par mois.
   - b. Une seule, puis une par mois.
   - **Recommandation : a.** Le premier mécène doit pouvoir choisir.
3. **Où s'appliquent les éditions.**
   - a. Carte par carte, avec « Appliquer à tout l'album ».
   - b. Pour tout l'album seulement.
   - **Recommandation : a.**
4. **Courbe d'usage du cabinet.**
   - a. Depuis 1800, avec les données déjà là ; P73 est corrigée en conséquence.
   - b. Depuis 1500, en reprenant les fréquences d'avant 1800 : la courbe y sera souvent vide ou en dents de scie.
   - **Recommandation : a.**
5. **Le carnet.**
   - a. Après l'ouverture de la vente, dans un lot à lui.
   - b. Avec le cabinet, avant l'ouverture.
   - **Recommandation : a.** Le cabinet et les éditions suffisent à tenir la vitrine ; le carnet arrive comme une nouveauté pour les mécènes.
6. **Combien d'épingles en plus.**
   - a. Trois places en plus de celles des niveaux (de 6 à 9 au niveau 30).
   - b. Six places d'emblée quel que soit le niveau : le mécène saute une récompense de niveau, ce que P72 interdit.
   - **Recommandation : a.**
7. **Lier le compte Discord.**
   - a. Bouton « Relier mon Discord » sur la page Mécène : connexion Discord (OAuth, déjà prise en charge par Better Auth), puis le bot pose le rôle, et le retire à l'arrêt. Environ une journée.
   - b. Un code à usage unique sur la page Mécène, à taper dans une commande du bot. Autant de travail, moins simple pour le joueur.
   - c. À la main : le mécène donne son pseudo Discord, tu poses le rôle. Rien à coder, mais le rôle ne part pas tout seul.
   - **Recommandation : a.**
8. **Qui vote.**
   - a. Les mécènes qui ont payé au moins une fois, essai exclu.
   - b. Tout mécène, essai compris.
   - **Recommandation : a.** C'est la règle de l'essai pour le cosmétique et le dénichage.
9. **Page de remerciements.**
   - a. Tous les mécènes au profil public, avec un réglage « Ne pas me citer » sur la page Mécène. Le badge est déjà public sur le profil.
   - b. Seulement ceux qui le demandent, par une case à cocher.
   - **Recommandation : a.**
10. **Animation d'ouverture et parure de joute à l'arrêt.**
    - a. Elles tiennent au statut et partent à l'arrêt ; les animations venues des cosmétiques du mois restent à vie.
    - b. Gardées à vie comme un cosmétique.
    - **Recommandation : a.** Sinon l'animation de base s'achète en un mois.

## 10. Lots

1. **Éditions de bibliothèque** (fait le 2026-11-08) : réglages dans `core`, table des éditions du joueur et de leur application (migration additive), API, fiche de carte et album (web et mobile), rendu sur le profil public et en joute, éditions dans le calendrier du mois.
2. **Cabinet du mot** : fichiers du cabinet écrits par la chaîne et publiés avec le catalogue, fiche du cabinet (web et mobile), réservée aux mécènes.
3. **Épingles en plus** (fait le 2026-11-08) **et page de remerciements.**
4. **Vote des mécènes** : admin, page Mécène, résultat.
5. **Discord** : liaison du compte, rôle posé et retiré par la file.
6. **Animation d'ouverture et parure de joute.**
7. **Vitrine** : la page Mécène liste ce qui est construit.

## 11. Technique, en bref

- **Cabinet servi comme le catalogue** : un fichier par carte, versionné, servi par le CDN, lu par le client du mécène. Tout ce qu'il contient est du domaine public ou des données ouvertes : qu'un curieux le lise sans payer ne fait rien perdre. La garde est dans l'interface, pas dans le fichier. Si tu préfères le garder derrière l'API, c'est une route qui vérifie l'abonnement et un fichier lu depuis R2, un peu plus lourd.
- **Éditions** : l'édition d'une carte se lit avec ses exemplaires, sans requête de plus ; le rendu ne fait que changer trois couleurs, sur le web comme sur le mobile.
- **Discord** : poser et retirer un rôle passe par deux appels à l'API de Discord avec le jeton du bot (droit « Gérer les rôles »), mis en file quand l'abonnement change.
- **Tests** : application d'une édition sur une carte qu'on ne possède pas refusée, vote unique par mécène sous requêtes concurrentes, rôle retiré à l'arrêt.

## 12. Ce qui est à ta charge

- Les couleurs des trois premières éditions, ou ton accord sur les miennes.
- Le salon et le rôle sur le Discord (ou mon script, par le bot), et le droit « Gérer les rôles » du bot.
- Les trois thèmes du premier vote.

## 13. Hors champ

XP en plus pour les mécènes (remise à plus tard, voir « À décider » dans les règles), sachets, carnet (lot suivant), « Offrir Mécène », achat intégré sur le mobile.
