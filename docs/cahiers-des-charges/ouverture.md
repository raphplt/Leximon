# Cahier des charges · Ouverture des plis

- **Statut :** proposition, à valider par le propriétaire (2026-10-20).
- **Décisions liées :** D-009 (animations, R&D), D-016 (budget de l'ouverture), D-022 (direction artistique), D-023 (catalogue).
- **Objectif :** que l'ouverture soit le moment le plus jouissif du jeu. La référence est Pokémon TCG Pocket.

## Ce qui existe

- Le web ouvre un pli : on touche le sceau, l'enveloppe s'ouvre en 1,15 s, puis les cinq cartes défilent une par une au bouton « Suivante », de la plus courante à la plus rare.
- Seules les Épiques et les Légendaires ont un effet : un halo coloré derrière la carte.
- Pas de geste, pas de son, pas de vibration, pas de reflet interactif, pas de numéro de carte.

## Ce qui fait le succès de TCG Pocket

D'après les développeurs et les tests de la presse (sources en bas de page) :

1. **Le geste :** on déchire le haut du paquet du bout du doigt, et la déchirure suit le doigt.
2. **Le son et la vibration :** l'équipe a enregistré de vrais paquets pour trouver un son qui donne envie. Le son et la vibration reproduisent la déchirure.
3. **Le coup d'œil :** en inclinant une carte, on devine si elle est holographique avant de la voir en entier. C'est l'aperçu en glissant que tu décris.
4. **L'annonce :** une carte très rare est annoncée avant d'être montrée (un craquement sonore, une lueur), puis prend tout l'écran.
5. **Le rythme :** les paquets arrivent au compte-gouttes, donc chaque ouverture est une petite cérémonie.

Le tirage est fixé dès qu'on appuie sur « Ouvrir ». Le choix du paquet et le coup d'œil ne sont que de la mise en scène.

## Principe de conception

**Le tirage est fait avant le spectacle.**
- Le serveur tire les cartes au début du geste d'ouverture, comme aujourd'hui.
- Tout ce qui suit, aperçu compris, ne fait que dévoiler un résultat déjà enregistré.
- Aucun indice ne permet de choisir un meilleur paquet parmi plusieurs. Sinon, les probabilités affichées seraient fausses, et les garanties (P12) faussées.

Le bénéfice technique : l'animation du geste masque le temps de réponse du serveur (budget de 150 ms, D-016).

## Déroulé cible

### 1. Le paquet fermé

- Le paquet de la collection est au centre, avec le nombre de plis disponibles et le temps avant le prochain.
- Il réagit au doigt (web : souris ; mobile : inclinaison du téléphone) avec un léger reflet. On a envie de le toucher.
- Plus tard, quand il y aura plusieurs collections : un carrousel des paquets, un par collection (P14).

### 2. L'ouverture au geste

- On fait glisser le doigt le long de la bande « déchirer ici ». La déchirure suit le doigt.
- Au-delà de 60 % de la bande, l'ouverture se termine seule. En dessous, la bande se recolle.
- **La requête part dès le début du geste,** avec sa clé d'idempotence. Si le serveur répond en erreur, le paquet se referme avec un message.
- Un son de papier déchiré suit la vitesse du geste. Sur mobile, une vibration courte accompagne la fin de la déchirure.
- **Accessibilité :** un bouton « Ouvrir » fait la même chose sans geste. Avec « réduire les animations », on passe directement à l'étape 4, sans effet.

### 3. La pile et le coup d'œil

- Les cinq cartes sortent du paquet en pile, face cachée. La plus rare est au fond (ordre actuel).
- **Coup d'œil en glissant :** en faisant glisser la pile en biais, les cartes s'écartent légèrement en éventail, et on voit leur tranche.
  - La tranche a la couleur de la rareté : crème, vert, tomate, cobalt, or, irisé.
  - On devine donc qu'« il y a de l'or là-dedans » sans savoir quel mot c'est.
  - Ce n'est que de la mise en scène : le tirage est déjà fait.
- On peut sauter le coup d'œil : glisser vers le haut ou toucher la pile révèle la première carte.

### 4. La révélation carte par carte

- On fait glisser la carte du dessus hors de l'écran pour voir la suivante. Un toucher fait la même chose.
- Une carte Courant ou Peu courant se révèle vite (environ 300 ms), pour garder le rythme.
- Une carte déjà possédée affiche son nombre d'exemplaires (« ×3 »). Une nouvelle affiche « Nouveau ! » et le numéro gagné (« 41/160 »).

### 5. La mise en scène des raretés

Chaque rareté a sa montée en intensité, et l'annonce vient **avant** la face de la carte.

| Rareté | Annonce (dos de la carte) | Révélation | Son | Vibration (mobile) |
|---|---|---|---|---|
| Courant | aucune | instantanée | papier | aucune |
| Peu courant | aucune | instantanée | papier | aucune |
| Rare | liseré tomate qui luit | retournement | petit carillon | courte |
| Précieux | lueur cobalt, la carte frémit | retournement au toucher | carillon plus riche | courte, double |
| Épique | le dos se fissure, éclats dorés | ralenti, poussière d'or, fond assombri | craquement puis accord | longue |
| Légendaire | l'écran s'assombrit, irisation qui monte, sceau qui se brise | plein écran, la carte tourne une fois sur elle-même | thème propre | motif rythmé |

- **La première de chaque rareté** (première Épique, première Légendaire du joueur) a un bandeau : « Ta toute première Légendaire ! ».
- **Partager :** une Légendaire propose un bouton « Partager » (image de la carte, lien vers sa page publique, D-002). C'est un canal d'acquisition.

### 6. Le récapitulatif

- Les cinq cartes en éventail, les nouvelles marquées.
- La progression de la collection : « Les Fondateurs · 41/160 (+3) ».
- Plus tard : l'expérience gagnée et la barre de niveau (voir [progression-et-social.md](progression-et-social.md)).
- Boutons « Ouvrir un autre pli » et « Voir mon album ».

### 7. Rythme et confort

- **Durée cible :** moins de 8 s pour un pli sans carte rare, geste compris. Les raretés hautes peuvent prendre leur temps.
- **« Tout révéler » :** un bouton permet de passer directement au récapitulatif. Les raretés hautes gardent alors une version courte de leur annonce.
- **Son :** coupé par défaut sur le web (les navigateurs l'imposent jusqu'au premier toucher), réglable dans les paramètres. Le site ne peut pas savoir si le téléphone est en mode silencieux.

## La forme du paquet : pli ou sachet

Les deux formes partagent le même déroulé. Seuls l'apparence du paquet et le geste d'ouverture changent.

| | Pli (actuel) | Sachet (forme classique) |
|---|---|---|
| Apparence | enveloppe kraft, sceau de cire | sachet souple aux bords sertis, gravure de la collection en façade |
| Geste | briser le sceau, déplier | déchirer la bande du haut |
| Atout | original, fidèle à D-022 | immédiatement compris, geste plus satisfaisant |
| Risque | le geste « briser un sceau » est moins sensuel qu'une déchirure | plus banal, proche des concurrents |

Une forme hybride est possible : un sachet en papier kraft, fermé par une bande scellée qui se déchire.

**Le code doit donc séparer la mise en scène (étapes 3 à 6) du paquet lui-même** (étapes 1 et 2). Le paquet devient un composant interchangeable : ajouter une forme ne touche pas au reste.

### Test A/B : ce qui est faisable

- **Affectation :** le serveur attribue la variante d'après un hachage de l'identifiant du joueur, et la renvoie avec le portefeuille. Elle ne change jamais pour un joueur.
- **Mesures :** part des ouvertures menées jusqu'au bout sans « Tout révéler », plis ouverts par jour, retour à J1 et J7.
- **Limite :** il faut un outil de mesure d'audience, qui n'existe pas encore (voir les décisions). Et pendant la bêta, avec quelques milliers de joueurs, seul un écart important sera mesurable.
- **Recommandation :**
  1. faire les deux maquettes jouables sur le web ;
  2. les faire essayer par 5 à 8 personnes du public visé, filmées, avant la bêta. C'est plus rapide et plus instructif qu'un A/B à ce stade ;
  3. garder l'A/B pour la bêta, si les essais ne départagent pas.

## Le numéro de collection

Par exemple « 040/160 » en bas de la carte, à côté du nom de la collection.

- **Format du catalogue :** un champ `number` (entier positif) ajouté à chaque carte dans `catalogCardSchema`. Le changement est additif, comme l'exige D-023 : une ancienne version de l'app ignore le champ.
- **Attribution :** par la commande `release` de la chaîne de contenu. Une fois publié, un numéro ne change jamais, comme l'identifiant et la rareté de la carte. Une carte ajoutée plus tard prend le numéro suivant.
- **Ordre à la première publication :** par rareté, puis par ordre alphabétique. On sait ainsi qu'un grand numéro est une carte rare.
- **Dénominateur :** c'est la difficulté. Deux options :
  - **A. Taille annoncée (recommandée) :** chaque collection déclare sa taille dans `content/collections.toml` au moment de sa publication, et elle ne bouge plus. Cela suppose de publier une collection complète, pas par morceaux ;
  - **B. Nombre de cartes publiées :** le dénominateur grandit avec la collection (« 40/160 » devient « 40/280 »). Simple, mais le joueur ne sait jamais où est la fin.
- **Option : les Légendaires « hors série »,** numérotées au-delà de la taille (« 163/160 »), comme les cartes secrètes de Pokémon. Plaisant pour les connaisseurs, à trancher.
- **L'album** peut alors montrer les emplacements vides numérotés : « il me manque le 112 » motive beaucoup à compléter.

## Reflets et effets holographiques

### Par rareté

| Rareté | Effet au repos | Effet au doigt, à la souris ou à l'inclinaison |
|---|---|---|
| Courant | papier mat | légère inclinaison 3D, ombre qui suit |
| Peu courant | papier mat | inclinaison et reflet de lumière doux |
| Rare | papier satiné | reflet, et un liseré métallique sur le bandeau de rareté |
| Précieux | cadre cobalt métallisé | reflet, et le cadre scintille selon l'angle |
| Épique | cadre doré, carte de nuit | dorure qui accroche la lumière, paillettes dorées sur le fond |
| Légendaire | cadre irisé, carte de nuit | irisation de toute la carte (effet holo arc-en-ciel), paillettes, éclat qui balaie la carte toutes les quelques secondes |

Plus tard, `user_cards.variant` permet des variantes du même mot, par exemple une version « dorée » plus rare d'une carte Courant. Le schéma est déjà prêt.

### Comment le faire

- **Web, en CSS seul :** la position du doigt ou de la souris (et l'inclinaison du téléphone, avec autorisation sur iOS) alimente quelques variables CSS. Des couches de dégradés avec modes de fusion (`overlay`, `color-dodge`) dessinent le reflet, l'irisation et les paillettes. Seuls `transform`, `opacity` et `background-position` bougent, ce qui reste fluide.
- **Référence :** le projet libre `pokemon-cards-css` (simeydotme) montre jusqu'où va le CSS seul. S'en inspirer, mais vérifier sa licence avant de reprendre la moindre ligne.
- **Mobile :** des shaders Skia avec le gyroscope (`@shopify/react-native-skia`, `expo-sensors`). Ce sont deux dépendances à valider, et c'est exactement la question de la R&D D-009.
- **Performance :** une seule carte « vivante » à la fois (la carte révélée ou ouverte en grand). La grille de l'album reste statique. Objectif : 60 images par seconde sur un téléphone Android d'entrée de gamme.

## Contraintes techniques

- Le tirage, les garanties et le journal ne changent pas. Seul le client change, à part le champ `number` du catalogue et l'éventuelle variante A/B.
- Les sons et les textures (paillettes, papier) sont des fichiers statiques servis par le CDN, préchargés pendant le geste d'ouverture. Ils doivent être créés pour le projet ou libres de droits (CC0), avec la source notée.
- Sur mobile, la vibration demande `expo-haptics` et le son `expo-audio` : deux modules Expo officiels, à valider comme dépendances. Sur le web, la vibration ne marche que sur Android (pas sur iPhone).
- Tous les effets respectent « réduire les animations ».

## Découpage proposé

1. **Lot A, web, avant la bêta :** geste de déchirure, pile et coup d'œil, révélation au glissé, mise en scène par rareté, sons, numéro de collection, récapitulatif avec progression.
2. **Lot B :** reflets interactifs complets par rareté (CSS), seconde forme de paquet, essais avec 5 à 8 joueurs.
3. **Lot C :** portage mobile une fois la R&D D-009 conclue, test A/B pendant la bêta.

## Décisions à prendre

1. **Dénominateur du numéro :** taille annoncée et collections publiées complètes (recommandé), ou nombre de cartes publiées.
2. **Légendaires « hors série »** au-delà de la taille de la collection : oui ou non.
3. **Forme du paquet :** maquetter pli et sachet, puis essais avec des joueurs (recommandé), ou A/B directement.
4. **Outil de mesure pour l'A/B :** journal d'événements maison dans Postgres via la file (aucune dépendance, recommandé pour la bêta), ou un service comme PostHog hébergé dans l'UE (nouvelle dépendance, données de mineurs à encadrer).
5. **Sons :** les faire créer (prestataire ou banque sous licence), ou partir de banques CC0.
6. **Dépendances mobiles :** `expo-haptics`, `expo-audio`, puis Skia et `expo-sensors` après la R&D D-009.

## Sources

- [Le développeur de TCG Pocket sur le son à l'ouverture (GoNintendo)](https://gonintendo.com/contents/40485-pokemon-trading-card-game-pocket-dev-on-why-sound-design-is-key-to-a-satisfying)
- [Présentation officielle : son et vibration de la déchirure (The Pokémon Company)](https://corporate.pokemon.co.jp/en/topics/detail/133.html)
- [Déchirure qui suit le doigt (Serebii)](https://serebii.net/tcgpocket/preview/)
- [Tirage fixé à l'appui sur « Ouvrir », choix du paquet purement décoratif (GameWith)](https://gamewith.net/pokemon-tcg-pocket/49055)
- [Animation garantie et craquement sonore à l'ouverture (GameWith)](https://gamewith.net/pokemon-tcg-pocket/49002)
- [Cartes immersives et animation plein écran (The Backdash)](https://www.thebackdash.com/pokemon/how-to-collect-every-immersive-card-in-pokemon-tcg-pocket)
- [Incliner la carte pour deviner si elle est holo (A to J Connections)](https://a-to-jconnections.com/gaming/pokemon-brings-the-flashiness-of-the-tcg-to-phones-a-pokemon-tcg-pocket-review)
