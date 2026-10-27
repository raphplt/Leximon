# Recette du web

Tout ce que le web sait faire au 2026-10-22, à tester avant d'attaquer le mobile. Chaque test a un identifiant, ce qu'il faut faire et ce qu'on doit voir. Note ton retour sous **Retour** (« OK », ou ce qui cloche), puis renvoie-moi le fichier ou les identifiants avec tes remarques.

Les écrans de référence sont dans le [cahier de l'interface](cahiers-des-charges/interface-v1.md), les règles dans [regles-du-jeu.md](regles-du-jeu.md), le ton dans [voix.md](voix.md). Un retour peut porter sur un bug, un texte, un écart avec la maquette ou une règle qui ne te plaît plus à l'usage.

## 0. Préparer

### Lancer le projet

Dans le dépôt principal (`~/dev/perso/Leximon`), sur `main` :

```bash
git pull
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

- Le web répond sur http://localhost:3000, l'API sur http://localhost:8787.
- **Code de connexion :** aucun e-mail ne part en local. Le code à 6 chiffres s'affiche dans le terminal de `pnpm dev`, sur une ligne `[dev] Code de connexion pour r…@example.com : 123456`.
- **Tâches de fond :** les envois de campagne passent normalement par une tâche lancée chaque minute. En local, ouvrir http://localhost:8787/__scheduled?cron=*+*+*+*+* lance un passage (un passage = une minute de production).

### Les comptes

Il faut trois navigateurs, ou trois profils séparés (une fenêtre privée par profil ne suffit pas pour deux comptes à la fois) :

| Nom | Compte | Rôle |
|---|---|---|
| A | `contact@leximon.fr` | Toi, admin. Joueur principal |
| B | `recette-b@example.com` | Deuxième joueur : échanges, clan, signalements |
| C | `recette-c@example.com` | Troisième joueur : demandes d'entrée, blocage |
| Invité | aucun | Fenêtre privée, jamais connecté |

Crée B et C en te connectant une fois sur le site avec ces adresses. Ensuite, pour sauter les heures de jeu, un script réservé à la base locale règle le niveau d'un compte :

```bash
pnpm dev:player recette-b@example.com --level 16
```

- `--level N` met le compte au niveau N. Les coffrets des niveaux sautés attendent d'être ouverts, comme si l'XP avait été gagnée.
- Pour donner des sachets bonus : `/admin/joueurs`, fiche du joueur, « Offrir des plis bonus ».

Chaque section dit le niveau qu'il faut. Garde un compte bas (niveau 1 à 4) pour voir les écrans fermés, par exemple C avant la section 10.

---

## 1. Accueil public et pages légales

Sans être connecté.

### PUB-01 · Page d'accueil
- **Faire :** ouvrir http://localhost:3000.
- **Attendu :** l'accueil présente le jeu, les trois collections et les règles, avec le formulaire de la liste d'attente en bas. Logo et favicon visibles. Rien ne casse en 390 px de large.
- **Retour :**

### PUB-02 · Liste d'attente
- **Faire :** laisser une adresse dans le formulaire, puis la même une seconde fois.
- **Attendu :** confirmation courte, pas de doublon (l'adresse apparaît une seule fois dans `/admin/attente`). Une adresse invalide est refusée avec un message clair.
- **Retour :**

### PUB-03 · Pages légales
- **Faire :** ouvrir `/mentions`, `/confidentialite`, `/conditions`, `/charte` depuis le pied de page.
- **Attendu :** éditeur et hébergeur sur `/mentions`, crédits (Littré, Ngram, gravures). Textes lisibles, liens entre eux justes. *Rappel : il manque le téléphone de l'éditeur et le médiateur de la consommation ; les textes sont à faire relire par un juriste.*
- **Retour :**

### PUB-04 · Image de partage
- **Faire :** ouvrir http://localhost:3000/opengraph-image.
- **Attendu :** une image propre, au nom de Leximon.
- **Retour :**

---

## 2. Invité et inscription

### INS-01 · Jouer en invité
- **Faire :** en fenêtre Invité, aller sur `/jouer`, ouvrir un sachet puis un deuxième.
- **Attendu :** les deux s'ouvrent sans compte. Les cartes arrivent dans l'album.
- **Retour :**

### INS-02 · Troisième sachet
- **Faire :** essayer d'en ouvrir un troisième.
- **Attendu :** l'écran d'inscription remplace l'ouverture (C-09). L'album et les défis restent ouverts.
- **Retour :**

### INS-03 · S'inscrire
- **Faire :** depuis cet écran, s'inscrire avec une nouvelle adresse (ex. `recette-invite@example.com`), cocher « J'ai 15 ans ou plus » et accepter les conditions. Laisser « M'écrire quand il y a du nouveau » décoché. Entrer le code lu dans le terminal.
- **Attendu :** sans la case des 15 ans, l'inscription est refusée. Une fois inscrit, les cartes, l'XP et le stock de l'invité sont toujours là.
- **Retour :**

### INS-04 · Mauvais code
- **Faire :** se déconnecter, demander un code, recharger la page. Puis entrer un code faux, et enfin le bon.
- **Attendu :** après le rechargement, on est toujours sur la saisie du code, comme au retour de l'app mail sur un téléphone (pendant les 10 minutes du code ; « Changer d'adresse » l'oublie). Le code faux est refusé avec un message clair et on peut réessayer sans retaper l'adresse.
- **Retour :**

### INS-05 · Invité vers un compte qui joue déjà
- **Faire :** nouvelle fenêtre privée, ouvrir un sachet en invité, puis se connecter au compte B.
- **Attendu :** un avertissement dit combien de cartes l'invité va perdre et demande de confirmer (P54) ; « Annuler » laisse invité. Après confirmation, B est intact, sans les cartes de l'invité.
- **Retour :**

---

## 3. Jouer et ouvrir un sachet

Compte A, n'importe quel niveau.

### JOU-01 · Écran Jouer
- **Faire :** ouvrir `/jouer` en 1440 px puis en 390 px.
- **Attendu :** en 1440 px, en haut, le bandeau du niveau : pastille de niveau, « Niveau 16 · titre », barre d'XP et « 260 / 825 XP », sous la barre la prochaine récompense en clair (« Au niveau 17, un sachet bonus. », ou ce que le niveau ouvre : « Au niveau 3, choisir la collection de ton sachet. »), les 4 prochaines récompenses reliées par un trait, chacune avec un mot sous l'icône (« Sachet », « Sachet garni », « Échanges »…) et son niveau, le détail complet au survol, « N coffrets » s'il y en a (les récompenses disparaissent sous 1060 px). Dessous, le comptoir, plus clair que la page, qui descend jusqu'au bas de la fenêtre : une lumière douce venue d'en haut, sans bord net, le sachet dans sa flaque de lumière avec de l'air au-dessus et en dessous, et le bouton sur une tablette sombre. Tout tient sans défiler, en 1440 × 900 comme en 1280 × 720 (marges resserrées). De part et d'autre, des boutons ronds : à gauche Clan (avec l'emblème de ton clan si tu en as un), Discussion, Joutes, creux et en pointillés tant que le niveau ne les ouvre pas ; à droite Défi du jour avec son anneau, Réglages. Ni courrier ni coffrets dans ces boutons : la barre du haut et le bandeau les ont déjà. En 390 px, la coque mobile : onglets en bas, les cinq libellés sur une même ligne, le rond Jouer qui dépasse seul au-dessus de la barre ; bandeau en haut (l'avatar seul, puis la pastille de niveau devant la barre d'XP), boutons flottants de part et d'autre du sachet, avec Coffrets en plus ; en 390 × 844, l'encadré « Un de tes mots » se voit en entier au-dessus des onglets, astuce affichée ou non. Les panneaux apparaissent en fondu, sans glisser.
- **Retour :**

### JOU-02 · Stock
- **Attendu :** en haut à droite du comptoir, une rangée de six points, un par sachet du stock : allumés pour ceux qui restent, le suivant qui se remplit à mesure qu'il approche, et « +1 dans 18 min » (« plein » quand le stock est plein), rien sous le sachet que le bouton « Ouvrir le sachet · 4 restants » (« 1 restant » ; un invité compte les plis qu'il peut encore ouvrir sans compte). En 390 px, les points disparaissent : la barre du haut montre déjà le stock. Stock vide et réserve vide : sachet sombre et immobile, bouton désactivé, et une lueur dorée qui monte du bas du sachet à mesure que le prochain approche, bordée d'une ligne dorée nette qui scintille, le temps restant écrit sur le sachet (« 12 min ») ; quand il arrive, le sachet s'éclaire d'un coup avec un petit son. Un invité qui doit créer son compte ne voit pas de jauge : il n'attend pas le temps, il attend un compte. Stock vide avec des bonus : « Ouvrir un sachet bonus · 2 en réserve ». Dans l'en-tête, « +N bonus » ouvre la réserve, sans cercle jaune sur la croix à l'ouverture : le nombre de sachets bonus, les garnis ouverts en premier, les places prises, quand ils s'ouvrent et d'où ils viennent ; stock vide, un bouton « Ouvrir un sachet bonus ».
- **Retour :**

### JOU-03 · Choix de la collection
- **Faire :** avec un compte de niveau 1 ou 2, puis de niveau 3 ou plus.
- **Attendu :** en haut du comptoir, le nom de la collection du sachet et sa ligne (« De l'abajoue à la logodiarrhée. »). Avant le niveau 3, seul le sachet des Fondateurs, en premier ; les autres collections portent « Niv. 3 ». Sur les bords du comptoir, deux flèches qui restent affichées, chacune avec le nom court de la collection qu'elle amène (un cadenas si elle est fermée), sans jamais toucher le sachet du comptoir ni être coupées, de 800 à 2000 px de large ; les touches ← et → du clavier font pareil. Le sachet du comptoir flotte doucement et penche à peine (le reflet glisse lentement) ; ceux de derrière ne bougent pas. Les sachets des autres collections attendent derrière celui du comptoir, plus petits et dans l'ombre, l'un à gauche, l'autre à droite (avec deux collections, un seul à droite) ; au survol, il s'éclaire et s'écarte. Un clic le fait passer devant, comme un carrousel qui tourne : il glisse de sa place jusqu'au centre en grandissant et en s'éclairant, l'ancien recule à la place libérée en passant dans l'ombre, le troisième arrive en fondu par l'extérieur (en 390 px, les flèches font glisser le sachet du même côté). Avec « réduire les animations » du système, un simple fondu. Les fermés sont gris avec « Niv. 3 », et un clic dit quand ils ouvrent. En 390 px, pas de sachets derrière : les flèches autour du nom, une pastille par collection dessous (dorée pour celle du comptoir, un cadenas sur les fermées, qui disent quand elles ouvrent), puis la ligne de la collection. Chaque sachet a du volume : bombé, les flancs rentrés, les sertissages qui dépassent, une tranche visible quand il penche. Chaque collection a son sachet : couleur de son dos de carte, motif, un sceau doré à festons avec la gravure de la collection en or (l'olivier d'Estienne pour les Fondateurs, la tête du Mépris d'après Le Brun pour Caractères, le Chaudronnier des Cris de Paris pour Métiers), son nom sur un ruban kraft, « 5 cartes », et le sceau du logo en bas à droite.
- **Retour :**

### JOU-04 · Ouverture
- **Faire :** ouvrir plusieurs sachets. Avant, fermer l'astuce avec ×, recharger la page.
- **Attendu :** l'astuce « Tire sur le pointillé, ou touche le sachet. » est une pastille sous le sachet, jamais coupée par le bord ; fermée, elle ne revient pas, et elle part seule après trois sachets. Déchirure au doigt ou à la souris, pile, cinq cartes à retourner, « Tout révéler ». Annonce « Rare ! », « Légendaire ! » à la couleur de la rareté ; à partir de Précieux, tu retournes la carte toi-même. Le mot est prononcé quand la carte se pose.
- **Retour :**

### JOU-05 · Coup d'œil
- **Faire :** une fois le sachet ouvert, glisser la pile en biais.
- **Attendu :** la tranche des cartes apparaît, colorée par rareté. Rien ne l'explique à l'écran (voulu, P46).
- **Retour :**

### JOU-06 · Bilan
- **Faire :** ouvrir un sachet carte par carte, puis un autre avec « Tout révéler » ; sur ordinateur et sur téléphone.
- **Attendu :** « Ton sachet », meilleure rareté, mots nouveaux. Les cinq cartes arrivent l'une après l'autre, côte à côte sur ordinateur, en carrousel sur téléphone (des points disent où on en est), lisibles, avec « Nouveau ». Une carte de Rare et au-dessus luit en arrivant ; après « Tout révéler », une Rare ou une Précieuse sautée joue son carillon. Toucher une carte ouvre sa fiche, citation entière comprise. Puis « +N XP », barre d'XP, progression de la collection, boutons. Sur téléphone (390 × 844), tout tient sans défiler entre la barre du haut et les onglets, passage de niveau compris : pas de cadre, pas de « Ton sachet » ni de « Voir mon album » (l'onglet Album est juste dessous), le carrousel va d'un bord à l'autre de l'écran, et la carte suivante dépasse au bord de l'écran, pas coupée par un cadre ; les cartes rapetissent sur un écran court (375 × 667). Sur la face d'une carte, la citation n'est jamais coupée au milieu d'une ligne : elle finit par « … ».
- **Retour :**

### JOU-07 · Passage de niveau
- **Faire :** se mettre juste sous un niveau (`pnpm dev:player <email> --level N`, puis ouvrir un sachet ou deux).
- **Attendu :** dans le bilan, « Niveau N ! Une récompense t'attend. » et « Ouvrir le coffret » à la place de « Ouvrir un autre sachet ».
- **Retour :**

### JOU-08 · Son et vibration
- **Faire :** couper « Mots dits à voix haute » dans les réglages, ouvrir un sachet ; puis couper le son, en ouvrir un autre.
- **Attendu :** d'abord les bruitages sans les mots (le bouton d'écoute marche toujours) ; ensuite plus aucun son, et le réglage des mots disparaît.
- **Retour :**

### JOU-09 · Forme « pli »
- **Faire :** ouvrir `/jouer?paquet=pli`.
- **Attendu :** le pli scellé à la place du sachet, et le mot « pli » dans les textes.
- **Retour :**

### JOU-10 · Mot qui s'échappe
- **Attendu :** dans un encadré sous le comptoir, bien séparé du sachet :
  - quand un mot est dû en révision : « Un mot est en train de t'échapper. », le dos de sa carte et le début de sa définition, sans le mot. « Réviser », ou un toucher sur l'encadré, lance la révision de ce seul mot, même si le défi du jour est fait. *Un mot devient dû au plus tôt le lendemain de son premier défi.*
  - sinon : « Un de tes mots », le mot, le début de sa définition et « Relire », qui ouvre sa fiche.
  - Le mot change à chaque retour sur Jouer. Sans aucune carte, pas d'encadré.
  - Au courrier, la ligne « *Mot* est en train de t'échapper. » mène aussi à la révision de ce mot.
- **Retour :**

---

## 4. Niveaux et coffrets

Compte A : `pnpm dev:player contact@leximon.fr --level 21` pour avoir une série de coffrets.

### NIV-01 · Chemin des niveaux
- **Faire :** menu de l'avatar, « Chemin des niveaux ».
- **Attendu :** le quartier de ton niveau, dix dalles en relief qui montent en zigzag sur un plateau (au niveau 16 : « Le Scriptorium », niveaux 11 à 20). Ta pastille de niveau posée sur ta dalle. Dalles dorées avec une coche (réclamées) ou un coffret qui luit (à réclamer), crème pour la suivante, kraft pour les paliers de 5, ardoise pour les autres ; au-delà des deux suivantes, le brouillard. Pierres de gué dorées jusqu'à ton niveau. Livres, encrier, bougie, lanterne en décor. Les flèches et la liste « Les quartiers » changent de quartier, jusqu'à deux quartiers d'avance. Le plateau tient dans la fenêtre, sans défiler.
- **Retour :**

### NIV-02 · Détail d'un niveau
- **Faire :** toucher un niveau passé, un niveau à réclamer, un niveau futur. Depuis Jouer, toucher une des prochaines récompenses.
- **Attendu :** la dalle choisie est cerclée de blanc ; depuis Jouer, le chemin s'ouvre sur le quartier de ce niveau. Ses récompenses, ce qu'il ouvre, et « Ouvrir le coffret », « Réclamée » ou « Encore 1 240 XP. ». Le barème de l'XP (« D'où vient l'XP ») est affiché.
- **Retour :**

### NIV-03 · Coffret
- **Faire :** « N coffrets » sur Jouer.
- **Attendu :** le coffret du plus petit niveau s'ouvre : rayons, « Niveau N atteint » au-dessus de « Un coffret pour toi », puis la pastille du niveau atteint au-dessus de « Niveau N ! », et les récompenses une à une, chacune avec son visuel (un sachet en miniature, doré pour un garni ; le titre gravé sur une plaque ; la gravure de l'avatar ; le cadre). Si le coffret donne des sachets : « Dans ta réserve : 3 sachets bonus ». Puis « Ranger dans ma réserve » et « Voir le chemin des niveaux ».
- **Retour :**

### NIV-04 · Chaque type de récompense
- **Faire :** ouvrir les coffrets jusqu'au niveau 21.
- **Attendu :**
  - niveau ordinaire : un sachet bonus, jamais de recharge ;
  - 5 et 15 : un sachet garni (au moins une Rare, ouvert avant les autres bonus) et un titre ;
  - 10 et 20 : un sachet garni, une place de plus dans la réserve (« 3 / 12 bonus »), un avatar, une place de carte épinglée, un cadre (« Filet doré », « Encre qui coule »).
- **Retour :**

### NIV-05 · Coffret qui ne peut pas servir
- **Faire :** réserve pleine, ouvrir un coffret de sachet bonus.
- **Attendu :** refus clair. Le coffret reste fermé et attend, rien n'est perdu.
- **Retour :**

### NIV-06 · Sachet garni
- **Faire :** ouvrir le coffret du niveau 10 avec des sachets bonus déjà en réserve, puis ouvrir un sachet.
- **Attendu :** « 1 garni » dans la réserve ; le sachet ouvert est le garni, avec au moins une Rare.
- **Retour :**

### NIV-07 · Écrans fermés par le niveau
- **Faire :** avec un compte de niveau 4, toucher Échanges ; niveau 9, Clan ; niveau 14, Joutes.
- **Attendu :** l'écran fermé dit quel niveau l'ouvre, une phrase de promesse, la barre vers ce niveau, « Ouvrir un sachet », « Faire un défi ». Joutes, une fois le niveau atteint : « pas encore construit ».
- **Retour :**

---

## 5. Album et fiche d'une carte

### ALB-01 · Album
- **Attendu :** « Album », « N mots sur 1 561 », recherche, onglets de collection avec le sceau de la collection, son nom en entier, le compte dessous et la barre à sa teinte, la ligne de la collection choisie sous les onglets, filtre par rareté (gemme et « 85/175 », de Courant à Légendaire, le nom de la rareté au survol). Le premier onglet, « Tout », rassemble toutes les collections avec les mêmes filtres ; c'est lui qui s'ouvre la première fois, ensuite l'album rouvre le dernier onglet choisi.
- **Retour :**

### ALB-02 · Filtres
- **Faire :** essayer Toutes, Nouveaux, Aujourd'hui, Doubles, À réviser, Dorure, Manquantes, et quelques thèmes.
- **Attendu :** la grille suit. Manquantes : emplacements « ? ». Une tuile « N mots à trouver » mène à Jouer.
- **Retour :**

### ALB-09 · Nouveaux et Aujourd'hui
- **Faire :** ouvrir un sachet, puis aller dans l'album sans toucher les cartes du résumé. Ouvrir ensuite la fiche d'une des cartes nouvelles, la fermer, recharger la page.
- **Attendu :** les cartes du sachet jamais vues avant portent « Nouveau » ; le filtre « Nouveaux » montre leur nombre et ne garde qu'elles, « Aujourd'hui » garde les cartes obtenues pour la première fois aujourd'hui (heure de Paris). Une fiche ouverte (depuis l'album, le résumé du sachet ou ailleurs) retire le tag, aussitôt et après rechargement. Un deuxième exemplaire d'une carte lue ne la remet pas en « Nouveau ». Les cartes possédées avant cette version ne sont pas marquées.
- **Retour :**

### ALB-03 · Défilement
- **Faire :** descendre loin dans une collection.
- **Attendu :** la grille se charge par lots, sans à-coup.
- **Retour :**

### ALB-04 · Vide
- **Faire :** une recherche qui ne donne rien ; l'album d'un compte neuf.
- **Attendu :** « Rien de ce côté. Pas pour longtemps. »
- **Retour :**

### ALB-05 · Fiche d'une carte
- **Faire :** toucher une carte.
- **Attendu :** grande carte avec reflets qui suivent la souris, de face et le texte net tant que la souris ne la touche pas (seule la lumière dérive), penchée sous la souris, rareté avec à côté les six gemmes de Courant à Légendaire, la sienne allumée et cerclée, les autres éteintes (nom au survol), fréquence (« Un mot imprimé sur 17 milliards. »), maîtrise en trois étapes avec ce qu'il reste, exemplaires et doubles, collection avec son sceau, origine, crédit de la gravure s'il y en a une. Les crédits des sceaux sont dans les mentions légales.
- **Retour :**

### ALB-06 · Prononciation
- **Attendu :** le bouton fait entendre le mot. La notation phonétique est affichée à côté (à confirmer : tu voulais voir si tu la gardes).
- **Retour :**

### ALB-07 · Actions de la fiche
- **Attendu :** pas de bouton de révision, la fiche dit où en est le mot (« Il t'attend dans les défis. », « Revient dans 3 jours. ») ; « Proposer en échange » seulement avec un double et le niveau 5, et ouvre la nouvelle offre avec la carte choisie ; « Épingler » la met sur le profil, à la première place libre, et devient « Désépingler » ; places toutes prises, une fenêtre « Tes places sont prises » montre les cartes épinglées (« Laquelle laisse sa place à andabate ? ») et un clic remplace celle-là ; « Partager » donne le texte (« Talpinette. Introuvable dans les livres d'aujourd'hui. Moi, je l'ai. ») et le lien de la page de la carte. Sur ordinateur : « Copié, avec le lien de la carte. » ; sur téléphone : la feuille de partage, avec l'image de la carte quand l'appli l'accepte. Tout en bas, pour toute carte, possédée ou non, « Signaler une erreur » ouvre « Une erreur sur cette carte ? » ; envoyé, « Bien reçu. Merci. », et le retour apparaît dans `/admin/retours` avec l'écran `/carte/<mot>`, un lien vers la page de la carte.
- **Retour :**

### ALB-08 · Page publique d'une carte
- **Faire :** ouvrir le lien copié en ALB-07 dans une fenêtre privée, puis `/carte/nimporte-quoi`. Coller le lien dans une messagerie qui affiche les aperçus (ou ouvrir `<lien>/opengraph-image`).
- **Attendu :** la carte, sa rareté, sa fréquence, son origine, et « Ouvrir mon premier sachet » qui mène au jeu, sans compte. La carte inconnue : « Cette carte n'existe pas. Ou plus. » L'aperçu montre la carte dans les couleurs de sa rareté, avec la fréquence et le nom de la collection ; un mot long tient dans la carte.
- **Retour :**

---

## 6. Défis

### DEF-01 · Écran Défis
- **Attendu :** défi du jour (« 5 questions, 3 bonnes », cinq barres), « Ta mémoire » (Esquisse, Encre, Dorure, avec la phrase des seuils), « Ces mots t'échappent » avec quand ils reviennent.
- **Retour :**

### DEF-02 · Session
- **Faire :** « Commencer le défi », répondre juste et faux.
- **Attendu :** croix pour arrêter, barres de position, « Que veut dire ce mot ? » ou « Quel mot se cache là-dessous ? », quatre choix ; après une réponse juste, la fréquence ; après une fausse, la bonne réponse.
- **Retour :**

### DEF-03 · Bilan et sachet bonus du jour
- **Faire :** finir avec au moins 3 bonnes sur 5, puis refaire une session le même jour.
- **Attendu :** « 4/5 », « +60 XP », « Un sachet bonus pour le défi du jour ! » la première fois ; plus de bonus ensuite. Sous 3 bonnes : « Pas encore de bonus. Le défi du jour court jusqu'à minuit. ».
- **Retour :**

### DEF-04 · Arrêter en cours
- **Faire :** quitter au milieu, revenir.
- **Attendu :** « Continuer le défi ». Les réponses déjà données comptent.
- **Retour :**

### DEF-05 · Rien à réviser
- **Attendu :** « Tes mots tiennent bon. Le prochain revient dans 3 h. ». *L'Encre (7 jours) et la Dorure (30 jours) ne se testent pas en une séance : voir DEF-06.*
- **Retour :**

### DEF-06 · Mot à écrire
- **Faire :** sur la base locale, vieillir de 8 jours un mot déjà révisé (ici *équanimité*), puis « Commencer le défi » et écrire le mot : sans accent, puis avec une faute, puis faux, puis « Je sèche » (refaire la commande entre deux essais).

```bash
docker compose exec postgres psql -U leximon -d leximon -c "update user_mastery set due = now(), last_reviewed_at = now() - interval '8 days' where card_id = 'equanimite' and user_id = (select id from users where email = 'contact@leximon.fr')"
```

- **Attendu :** « Écris le mot », la définition (les mots de la même famille remplacés par « … », par exemple « Petit du …, jeune … » pour *renardeau*, en entier après la réponse), « Trouvé de tête, il passe à l'Encre. Les accents ne comptent pas, une faute de frappe passe. », un champ « Le mot », « Valider le mot » et « Je sèche ». *equanimite* : « Juste. », « Ça s'écrit équanimité. », « équanimité passe à l'Encre ! ». *equanimte* : « Juste, à une lettre près. », la même montée. Faux ou « Je sèche » : « Raté. », « C'était : équanimité ». Les autres mots restent en QCM. « Ta mémoire » dit qu'un mot monte quand on l'écrit de tête.
- **Retour :**

---

## 7. Échanges

A et B au niveau 5 au moins, chacun avec des doubles :

```bash
pnpm dev:player contact@leximon.fr --level 12
pnpm dev:player recette-b@example.com --level 6
```

### ECH-01 · En-tête
- **Attendu :** « Échanges », « Ton code K7QP2MXA » qui se copie, onglets Reçues (N), Envoyées (N), Nouvelle offre.
- **Retour :**

### ECH-02 · Nouvelle offre
- **Faire :** A tape le code de B.
- **Attendu :** B trouvé (pseudo, niveau), tes doubles, ses doubles avec « Il te manque ». Épiques et Légendaires obtenues il y a moins de 7 jours grisées « Échangeable dans 7 j ». « Vérifier l'offre » puis « Envoyer l'offre ».
- **Retour :**

### ECH-03 · Une ou trois cartes
- **Attendu :** B est au niveau 6 : une carte par côté au plus. Passe B au niveau 10 (`--level 10`) : jusqu'à trois.
- **Retour :**

### ECH-04 · Offre reçue
- **Faire :** côté B, ouvrir Reçues ; toucher une carte ; accepter.
- **Attendu :** avatar, pseudo, niveau, « Expire dans 71 h », « Tu reçois », « Tu donnes ». La carte ouvre sa fiche. Après acceptation, les cartes ont changé de main des deux côtés, +20 XP chacun, l'échange est dans l'historique.
- **Retour :**

### ECH-04 bis · Offre acceptée, côté de A
- **Faire :** A ferme l'onglet avant que B accepte, puis revient sur n'importe quel écran (ou change d'écran, ou revient sur l'onglet après une minute).
- **Attendu :** une fenêtre « Échange conclu », « B a dit oui ! », les cartes reçues en grand, « Contre … » pour ce que A a donné. « Lire la carte » ouvre sa fiche (« Voir dans l'album » s'il y en a plusieurs). La fenêtre ne revient pas au rechargement ; la lettre reste dans le courrier.
- **Retour :**

### ECH-05 · Refuser, annuler
- **Faire :** B refuse une offre ; A annule une offre envoyée.
- **Attendu :** l'offre disparaît des deux côtés, sans XP.
- **Retour :**

### ECH-06 · Garde-fous
- **Faire :** un compte sous le niveau 5 essaie d'échanger ; un code faux ; 11 offres en 24 h.
- **Attendu :** un refus clair à chaque fois. « 10 offres par 24 h. Une offre expire après 72 h. » est écrit.
- **Retour :**

### ECH-07 · Aucune offre
- **Attendu :** « Personne ne frappe à la porte. Fais le premier pas. »
- **Retour :**

---

## 8. Profil et atelier

A au niveau 8 au moins.

### PRO-01 · Pseudo
- **Faire :** choisir un pseudo, puis le changer tout de suite ; essayer « AdminLexi », « Leximon officiel », un pseudo déjà pris en changeant les majuscules ou les accents.
- **Attendu :** le premier choix passe ; le second changement attend 30 jours. Les pseudos qui imitent l'équipe et les doublons sont refusés avec la raison.
- **Retour :**

### PRO-02 · Mon profil
- **Attendu :** bannière, avatar dans son cadre, pseudo, titre, niveau, code joueur, membre depuis, « Atelier », « Partager ». Cartes épinglées (3 places au niveau 10) : une place vide « Épingler une carte » ouvre la liste de tes cartes, les plus rares en tête, celles déjà épinglées en bas et grisées, avec une recherche qui ignore les accents (« ecrou » trouve « écrouelles ») ; un choix la pose sans quitter le profil. Sous chaque carte, ‹ et › la déplacent d'une place (grisés au bout de la rangée, le focus reste sur la carte déplacée), « Changer » rouvre la liste titrée « Remplacer andabate » et met la nouvelle à la même place ; la croix au coin la retire. Toucher la carte ouvre sa fiche. En 390 px, deux cartes par rangée, rien ne déborde. En chiffres : mots sur 1 561, Légendaires, mots dorés, échanges, collections complètes, jours de jeu. Le clan avec son emblème sous le niveau, qui mène à la page du clan (après CLA-01).
- **Retour :**

### PRO-03 · Profil avant le niveau 8
- **Faire :** avec C au niveau 5.
- **Attendu :** « Ton profil devient public au niveau 8. »
- **Retour :**

### PRO-04 · Page publique
- **Faire :** ouvrir `/joueur/<pseudo de A>` sans être connecté, puis depuis B.
- **Attendu :** la page se lit sans compte, avec le clan du joueur. Depuis B : « Proposer un échange », « Signaler le pseudo », « Bloquer ». L'image de partage du lien est propre et nomme le clan.
- **Retour :**

### PRO-05 · Profil privé
- **Faire :** A passe son profil en privé dans les réglages ; B l'ouvre.
- **Attendu :** B ne voit plus que le pseudo et l'avatar.
- **Retour :**

### PRO-06 · Atelier
- **Faire :** menu de l'avatar, « Atelier ».
- **Attendu :** onglets Avatars, Cadres, Titres. Chaque objet : porté, à mettre, ou « Niveau 20 ». Changer d'avatar, de cadre et de titre se voit tout de suite dans la barre du haut et sur le profil. *À valider : la liste des avatars et leurs noms.*
- **Retour :**

---

## 9. Réglages, courrier, compte

### REG-01 · Réglages
- **Attendu :** Jeu (Son, Vibration), Notifications (gardées pour les notifications du téléphone, à venir), Profil (public, pseudo, joueurs bloqués), Compte (adresse, Tes données, « M'écrire quand il y a du nouveau », Me déconnecter).
- **Retour :**

### REG-02 · Courrier, à faire
- **Faire :** ouvrir le courrier avec un coffret à ouvrir ou des sachets d'objectif, et un mot à réviser.
- **Attendu :** section « À faire » : « Coffret du niveau 4 » (« Coffrets des niveaux 3 et 5 », « 3 coffrets, niveaux 3 à 6 »), « Un sachet d'objectif à prendre », « *Abajoue* est en train de t'échapper. » (avec « Et 2 autres mots » s'il y en a). Chaque ligne mène à son écran. La pastille compte ces lignes, pas le mot qui s'échappe.
- **Retour :**

### REG-03 · Courrier, nouvelles
- **Faire :** B fait une offre à A ; A l'accepte. Une autre offre de B, refusée par A. Attendre quelques secondes, puis ouvrir le courrier de chacun.
- **Attendu :** chez A, « B t'envoie une offre » ; chez B, « A accepte ton offre » puis « A refuse ton offre », avec l'heure. Une lettre non lue est surlignée d'un liseré doré et compte dans la pastille. À l'ouverture, elles passent lues : la pastille descend, le surlignage reste jusqu'à la fermeture. Une offre déjà acceptée laisse sa lettre lue chez A.
- **Retour :**

### REG-04 · Bloquer et débloquer
- **Faire :** C bloque B depuis son profil, puis le débloque dans les réglages.
- **Attendu :** bloqué, aucun ne voit le profil de l'autre ni ne peut lui faire d'offre, les offres en cours tombent, et ses messages de clan disparaissent pour celui qui bloque. Débloqué, tout revient sauf les offres tombées.
- **Retour :**

### REG-05 · Nouvelles par e-mail
- **Faire :** cocher puis décocher « M'écrire quand il y a du nouveau ».
- **Attendu :** le réglage tient après un rechargement. Il change l'audience « joueurs » des campagnes (CAM-03).
- **Retour :**

### REG-06 · Supprimer mon compte
- **Faire :** avec `recette-invite@example.com` seulement : Réglages, Compte, supprimer.
- **Attendu :** deux temps, la conséquence écrite dans le bouton. Ensuite, tout est effacé ; un échange conclu reste chez l'autre, signé « Un joueur parti ».
- **Retour :**

---

## 10. Clans

```bash
pnpm dev:player contact@leximon.fr --level 16
pnpm dev:player recette-b@example.com --level 10
pnpm dev:player recette-c@example.com --level 9
```

### CLA-01 · Avant le niveau 10
- **Faire :** C ouvre l'onglet Clan.
- **Attendu :** écran fermé « Les clans ouvrent au niveau 10 ». Passe C au niveau 10 ensuite.
- **Retour :**

### CLA-02 · Sans clan
- **Faire :** B (niveau 10, sans clan) ouvre Clan.
- **Attendu :** « Trouver un clan » : liste, recherche, filtre par mode d'entrée, entrée par code. Pas de bouton pour créer (niveau 15).
- **Retour :**

### CLA-03 · Créer un clan
- **Faire :** A crée un clan : nom, emblème (gravure et deux couleurs), devise, mode « sur demande ». Essayer un nom de 2 caractères, un nom pris, un nom avec « connard », une devise de plus de 80 caractères.
- **Attendu :** les noms invalides sont refusés avec la raison. Une fois créé, la page du clan : emblème, nom, membres, mode d'entrée, devise, « Inviter ».
- **Retour :**

### CLA-04 · Demander à entrer
- **Faire :** B trouve le clan et « Demander à entrer » ; A accepte la demande.
- **Attendu :** la demande arrive chez A, avec une lettre « B veut entrer dans le clan » au courrier qui mène au clan ; une fois acceptée, B est membre et l'arrivée apparaît dans le journal.
- **Retour :**

### CLA-05 · Code d'invitation
- **Faire :** A passe le clan « sur invitation », copie le code ; C entre avec le code. A renouvelle le code ; l'ancien ne marche plus.
- **Attendu :** C est membre. L'ancien code est refusé.
- **Retour :**

### CLA-06 · Discussion
- **Faire :** A, B et C s'écrivent, chacun dans son navigateur.
- **Attendu :** mes messages à droite en jaune, ceux des autres à gauche. Un nouveau message arrive en quelques secondes chez les autres sans recharger. Messages et journal mêlés.
- **Retour :**

### CLA-07 · Filtre et limites
- **Faire :** envoyer « espèce de connard », puis « putain, quelle carte » ; envoyer deux messages en moins de 2 secondes ; coller plus de 500 caractères.
- **Attendu :** le premier ne part pas : « Pas envoyé : un mot interdit. Reformule. » Le second passe. Trop vite ou trop long : refus clair, le texte reste dans le champ.
- **Retour :**

### CLA-08 · Discussion depuis Jouer
- **Faire :** sur Jouer, bouton flottant « Discussion ».
- **Attendu :** la discussion s'ouvre dans un panneau à droite (fiche montante en 390 px). Pastille quand un message attend.
- **Retour :**

### CLA-09 · Signaler et bloquer un message
- **Faire :** B ouvre le menu d'un message de C : Signaler, puis Bloquer.
- **Attendu :** le signalement part (visible dans `/admin/signalements`). Après le blocage, les messages de C disparaissent pour B.
- **Retour :**

### CLA-10 · Membres
- **Attendu :** avatar, en ligne ou vu il y a, niveau, rôle (Chef, Adjoint), mots apportés cette semaine ; « Voir les N autres » au-delà de la première liste. Toucher un membre ouvre sa fiche.
- **Retour :**

### CLA-11 · Gestion par le chef
- **Faire :** A nomme B adjoint ; B rend C muet 1 h ; B efface un message de C ; B essaie d'exclure A ; A retire l'adjoint à B ; A change le nom et l'emblème ; A passe la tête du clan à B, puis B la lui rend.
- **Attendu :** chaque action marche et se lit dans le journal. C muet ne peut plus écrire : « Tu es muet dans ce clan. » Un adjoint ne peut exclure ni le chef ni un autre adjoint.
- **Retour :**

### CLA-12 · Objectif de la semaine
- **Faire :** regarder la carte de l'objectif, puis jouer des défis avec A.
- **Attendu :** le titre donne la cible du prochain palier (« 30 bonnes réponses »), barre avec bronze, argent, or, « reste N j », « 12 / 30 · 12 à toi » et la récompense du prochain palier seulement (« À l'argent, un sachet bonus. »). La barre monte peu après chaque bonne réponse (recompte en tâche de fond) ; une mauvaise ne compte pas. À l'argent, puis à l'or, un sachet bonus à prendre sur la page et au courrier, pour qui a donné au moins 15 bonnes réponses. Au-delà de l'or : « Objectif rempli ! » et le total, sans cible dépassée. *La cible est fixée au premier passage de la semaine : 15, 30 et 50 par membre actif.*
- **Retour :**

### CLA-12b · Niveau du clan
- **Faire :** regarder l'en-tête du clan après l'objectif de CLA-12, puis la recherche de clans depuis B (ou un compte sans clan), puis la fin d'un défi, le bouton Clan sur Jouer et le profil de A.
- **Attendu :** l'emblème porte la pastille de niveau, la même que celle des joueurs ; sous le nom, « Niveau N · X / Y XP », une barre dorée et le prochain déblocage (« Au niveau 3, la couleur … »). Le passage de niveau s'écrit au journal, « Le clan passe au niveau 2 ! », et la nouvelle couleur ou gravure se choisit dans les réglages du clan. La recherche montre la pastille sur chaque emblème. Les membres sont triés par bonnes réponses de la semaine, « 23 cette semaine ». En fin de défi, « +N pour le clan » sous le score ; sur Jouer, en 1440 px comme en 390 px, un anneau doré autour du bouton Clan, rempli vers le prochain palier. Sur le profil public et son image de partage, l'emblème du clan avec sa pastille de niveau, devant le nom du clan. Dans la discussion du clan, plus de « Modérée » en tête. *Bannière (niveau 10) et palier Enluminure (niveau 5) : pas atteignables à la main en recette.*
- **Retour :**

### CLA-13 · Bibliothèque
- **Attendu :** « Il vous manque N cartes de Caractères et travers. », une barre par collection, tes cartes en foncé, celles du clan en clair.
- **Retour :**

### CLA-14 · Exclure
- **Faire :** A exclut C ; C essaie de rejoindre un autre clan tout de suite.
- **Attendu :** C n'est plus membre, et peut rejoindre un autre clan sans attendre.
- **Retour :**

### CLA-15 · Quitter
- **Faire :** B quitte le clan, puis essaie d'en rejoindre un.
- **Attendu :** le bouton dit « Quitter le clan » ; ensuite, B peut rejoindre un autre clan tout de suite.
- **Retour :**

### CLA-16 · Le chef part
- **Faire :** A, seul avec un membre, quitte le clan.
- **Attendu :** la tête passe à l'adjoint le plus ancien, sinon au membre le plus ancien. Le dernier qui part dissout le clan.
- **Retour :**

### CLA-17 · Citer un membre
- **Faire :** A tape « @ » puis le début du pseudo de B dans la discussion ; choisir avec les flèches et Entrée, ou à la souris ; envoyer. Puis C bloque A, et A cite C.
- **Attendu :** la liste propose les membres dont le pseudo commence ainsi ; le pseudo choisi s'insère, suivi d'une espace. Dans le message, la mention est soulignée chez A et surlignée en jaune chez B. Quelques secondes plus tard, B a une lettre « A parle de toi » avec le début du message, qui ouvre la discussion. C, qui bloque A, ne reçoit rien.
- **Retour :**

---

## 11. Modération et sanctions

### MOD-01 · Signalements dans l'admin
- **Faire :** A ouvre `/admin/signalements` après CLA-09 et un « Signaler le pseudo » (PRO-04).
- **Attendu :** chaque signalement avec le contenu visé, qui l'a signalé, le joueur visé. « Classer sans suite », ou choisir une sanction, écrire la raison (10 caractères au moins) et « Sanctionner ».
- **Retour :**

### MOD-02 · Les sanctions
- **Faire :** essayer chaque sanction sur C : masquer le message, retirer le pseudo, retirer le nom du clan (sur un nom de clan signalé), rendre muet, interdire les échanges, suspendre le compte pour une durée. Garder « Fermer le compte » pour un compte jetable.
- **Attendu :** l'effet est immédiat (message masqué, pseudo remplacé, plus d'écriture, plus d'offres, plus de jeu) et dure le temps choisi.
- **Retour :**

### MOD-03 · Ce que voit le joueur sanctionné
- **Faire :** C recharge le jeu.
- **Attendu :** une fenêtre, sur n'importe quel écran, dit la sanction, sa raison, sa durée, et propose de contester. Sous le champ de discussion : « Une sanction t'empêche d'écrire. ».
- **Retour :**

### MOD-04 · Contester
- **Faire :** C conteste avec un texte ; A ouvre `/admin/contestations`, lève une sanction et en maintient une autre.
- **Attendu :** la contestation arrive avec le motif, le contenu et le texte de C. Levée : l'effet s'arrête aussitôt. Maintenue : C le voit.
- **Retour :**

---

## 12. Administration

Compte A.

### ADM-01 · Accès
- **Faire :** B ouvre `/admin`.
- **Attendu :** refusé. A y entre.
- **Retour :**

### ADM-02 · Tableau de bord
- **Attendu :** les chiffres du jeu (joueurs, sachets, échanges…), cohérents avec ce que tu viens de faire.
- **Retour :**

### ADM-03 · Joueurs
- **Faire :** chercher B, ouvrir sa fiche, « Offrir des plis bonus » (3), « Bannir », puis « Lever le bannissement ».
- **Attendu :** B voit ses 3 bonus. Banni, il ne peut plus jouer ; débanni, il rejoue. Chaque action est au journal.
- **Retour :**

### ADM-04 · Liste d'attente
- **Attendu :** les adresses de PUB-02, export CSV qui s'ouvre proprement dans un tableur.
- **Retour :**

### ADM-05 · Échanges
- **Attendu :** les échanges de la section 7 ; une offre en attente annulée depuis l'admin disparaît chez les deux joueurs.
- **Retour :**

### ADM-06 · Cartes et collections
- **Attendu :** recherche d'une carte, sa fiche complète ; les trois collections avec leurs comptes.
- **Retour :**

### ADM-07 · Journal
- **Attendu :** toutes les actions d'admin de la recette, avec qui, quand, quoi.
- **Retour :**

---

## 13. Campagnes d'e-mails

En local, aucun e-mail ne part : chaque envoi s'écrit dans le terminal de `pnpm dev`, avec le texte de l'e-mail et son lien de désinscription. Un passage d'envoi se lance en ouvrant http://localhost:8787/__scheduled?cron=*+*+*+*+*.

### CAM-01 · Brouillon et aperçu
- **Faire :** `/admin/campagnes`, nouvelle campagne, audience « test » avec ton adresse. Sujet, texte avec du gras, un lien et un bouton.
- **Attendu :** l'aperçu montre l'e-mail tel qu'il partira, avec le lien de désinscription. Le brouillon se modifie.
- **Retour :**

### CAM-02 · Lancer
- **Faire :** lancer : la confirmation demande de taper le nombre exact de destinataires. Puis ouvrir l'URL du passage deux fois.
- **Attendu :** un mauvais nombre bloque le lancement. Après les passages, l'e-mail apparaît dans le terminal et les compteurs passent à « envoyé », campagne terminée.
- **Retour :**

### CAM-03 · Audience « joueurs »
- **Faire :** nouvelle campagne, audience « joueurs ».
- **Attendu :** le nombre de destinataires ne compte que les joueurs qui ont coché « M'écrire quand il y a du nouveau » (REG-05).
- **Retour :**

### CAM-04 · Programmer, mettre en pause, annuler
- **Faire :** programmer une campagne dans une heure ; en lancer une autre et la mettre en pause avant le passage, la reprendre, puis l'annuler.
- **Attendu :** la programmée ne part pas avant son heure. En pause, un passage n'envoie rien ; reprise, il envoie ; annulée, plus rien ne part.
- **Retour :**

### CAM-05 · Désinscription
- **Faire :** envoyer une campagne « joueurs » à B, copier dans le terminal le lien après « Ne plus recevoir ces e-mails : » et l'ouvrir.
- **Attendu :** la page `/desinscription` confirme ; le joueur n'est plus dans l'audience « joueurs », et son consentement est retiré dans son compte.
- **Retour :**

### CAM-06 · E-mail de la liste d'attente (à faire en dernier)
- **Attention :** lancer cet e-mail ferme la liste d'attente pour toujours dans ta base de dev (P55). Ne le fais qu'à la fin.
- **Faire :** campagne audience « liste d'attente », lancer, passages. Puis `/admin/attente` : taper le nombre d'adresses et « Effacer la liste ».
- **Attendu :** une fois lancée, le formulaire de l'accueil n'accepte plus d'adresse. Une seconde campagne liste d'attente est refusée. Après l'effacement, seules les adresses désinscrites restent.
- **Retour :**

## 13 bis. Amis

Il faut deux comptes inscrits avec un pseudo, A et B (deux navigateurs, ou une fenêtre privée), et un troisième navigateur sans session pour le lien d'ami.

### AMI-01 · Demande et réponse
- **Faire :** A ouvre `/amis` (menu du joueur ou bouton rond « Amis » sur Jouer), tape le pseudo exact de B, « Envoyer la demande ». B ouvre son courrier, puis `/amis`, et accepte.
- **Attendu :** la demande attend chez B en haut de l'écran, et une lettre « A te demande en ami » arrive. Une fois acceptée, chacun voit l'autre dans « Tes amis », et A reçoit « B accepte ta demande ».
- **Retour :**

### AMI-01 bis · Beaucoup d'amis
- **Faire :** un compte avec plus de 8 amis et plus de 3 demandes reçues ouvre `/amis`.
- **Attendu :** les demandes au-delà de 3 et les amis au-delà de 8 attendent derrière « Voir les N autres ». « Chercher un ami » et les filtres « Tous », « En ligne · N », « Échanges · N » trient la liste. Dans le fil, seules les réactions données s'affichent, « Réagir » ouvre les quatre.
- **Retour :**

### AMI-02 · Refus, annulation, retrait
- **Faire :** A redemande B après l'avoir retiré, B refuse. A renvoie la demande. Puis A annule une demande en attente (« Demandes envoyées », en bas), et retire un ami depuis sa fiche.
- **Attendu :** le refus ne prévient pas A : sa demande reste « envoyée », et en renvoyer une répond « Demande déjà envoyée ». Le retrait vaut des deux côtés, sans lettre.
- **Retour :**

### AMI-03 · Profil, réglages
- **Faire :** A rend son profil privé. B ouvre `/joueur/<pseudo de A>`. Un troisième joueur fait de même et clique « Ajouter en ami ». Puis A règle « Demandes d'ami » sur Personne.
- **Attendu :** B voit le profil entier, le troisième voit le profil privé et peut demander. Avec « Personne », une demande répond « Ce joueur ne prend pas de demande ».
- **Retour :**

### AMI-04 · Lien d'ami
- **Faire :** A clique « Partager mon lien ». Dans le navigateur sans session, ouvrir le lien `/ami/<code>`, « Ouvrir mon premier sachet », jouer, puis créer un compte.
- **Attendu :** la page montre l'avatar et le pseudo de A. À la création du compte, les deux sont amis sans demande, et A reçoit « … arrive par ton lien ». Bêta fermée (`BETA_INVITES=required`) : trois places par lien, la quatrième arrivée tombe sur « Ce lien a fait le plein ».
- **Retour :**

### AMI-05 · Sachet du parrainage
- **Faire :** `pnpm dev:player <e-mail du filleul> --level 5`, puis lui faire gagner de l'XP (un défi) pour franchir un niveau. Ouvrir le courrier de A et du filleul.
- **Attendu :** chacun a « Un sachet bonus… » dans « À faire » ; un clic le met en réserve. Réserve pleine : il reste dans le courrier.
- **Retour :**

### AMI-06 · Échanger et comparer
- **Faire :** depuis la fiche d'un ami, « Proposer un échange » jusqu'à « Ce que tu donnes », puis « Comparer nos albums » et ses trois filtres. Dans Échanges, Nouvelle offre, toucher un ami de « Avec un ami ».
- **Attendu :** « Proposer un échange » et un ami touché mènent droit à ses cartes. Au-delà de 8 amis, « Chercher un ami » au-dessus de la liste (sans les accents : « heloise » trouve Héloïse). Dans l'offre, tes doubles qui lui manquent passent devant, marqués « Il lui manque ». Dans l'album, ce qu'il a et pas toi reste face cachée. Le nombre d'échanges possibles de la liste correspond.
- **Retour :**

### AMI-07 · Podium et fil
- **Faire :** A et B répondent à des défis. A ouvre une Épique ou une Légendaire. B réagit dans le fil, change de réaction, la retire.
- **Attendu :** le podium classe les bonnes réponses de la semaine, sans récompense, « Toi : 4e sur 5 » sous les marches quand tu n'y es pas. La trouvaille de A apparaît dans le fil de B ; A reçoit une seule lettre à la première réaction. « Montrer mes trouvailles à mes amis » éteint chez A, ses trouvailles quittent le fil.
- **Retour :**

### AMI-08 · E-mails sur la partie
- **Faire :** en local, l'API écrit les e-mails dans sa console. A demande B en ami ; B ne touche à rien pendant 30 minutes (entre 8 h et 21 h). Ensuite, B ouvre « Réglages » puis « E-mails ». Pour le rappel : `wrangler dev --test-scheduled`, puis `curl "http://localhost:8787/__scheduled?cron=0+17+*+*+*"` vers 18 h, avec un compte dont `players.last_seen_at` remonte à la veille.
- **Attendu :** un seul e-mail « A te demande en ami » pour B, avec « Répondre à la demande » vers `/amis`, et rien si B est revenu entre-temps. Le rappel dit « Tes 6 sachets t'attendent ». Le lien du bas mène à `/desinscription/…`, qui coupe ce seul e-mail ; « Lettres en attente » et « Sachets pleins » se coupent aussi dans les réglages, web et mobile. `/jouer?courrier` ouvre le courrier.
- **Retour :**

---

## 14. Partout

### TRA-01 · Largeur 390 px
- **Faire :** refaire un tour rapide de chaque écran en 390 px (outils du navigateur, mode téléphone), ou sur ton téléphone avec l'adresse IP de ton ordinateur.
- **Attendu :** coque mobile, rien ne déborde, fiches qui montent du bas et se ferment en glissant.
- **Retour :**

### TRA-02 · Clavier
- **Faire :** parcourir Jouer, un panneau et une fenêtre au clavier seul (Tab, Entrée, Échap).
- **Attendu :** le focus se voit, Échap ferme, le focus revient où il était.
- **Retour :**

### TRA-03 · Mouvements réduits
- **Faire :** activer « réduire les animations » dans le système, ouvrir un sachet.
- **Attendu :** pas de grands mouvements, tout reste utilisable.
- **Retour :**

### TRA-04 · Erreurs et chargement
- **Faire :** couper l'API (Ctrl+C sur `pnpm dev` puis relancer seulement le web avec `pnpm dev --filter @leximon/web`) et naviguer.
- **Attendu :** des écrans de chargement à la forme du contenu ; des erreurs qui disent quoi faire, avec un bouton pour réessayer, sans perdre ce qui était saisi.
- **Retour :**

### TRA-05 · Textes
- **Attendu :** au fil de la recette, note toute phrase qui sonne faux par rapport à [voix.md](voix.md) : trop longue, trop polie, gabarit d'appli, « ! » hors récompense.
- **Retour :**

### TRA-06 · D'un écran à l'autre
- **Faire :** passer d'un onglet à l'autre (Jouer, Album, Défis, Échanges, Clan, Profil) ; puis recharger Jouer, l'album, le profil et l'atelier avec le réseau ralenti (outils du navigateur, onglet Réseau, « 3G lente »).
- **Attendu :** la pastille claire de la barre du haut glisse vers l'onglet cliqué dès le clic ; sur une page hors onglets (profil, niveaux), elle s'efface. Chaque écran arrive en fondu court. Sur Jouer, le comptoir apparaît entier, à sa taille finale : le sachet ne rétrécit pas après coup, l'étagère du bas ne remonte pas. Le groupe de droite de la barre du haut (sachets, courrier, niveau, avatar) apparaît d'un bloc. Ailleurs, pendant l'attente, des formes grises à la place exacte du contenu, qui n'apparaissent que si l'attente dure ; quand le contenu arrive, rien ne saute. Avec « réduire les animations », ni fondu, ni glissement, ni pulsation.
- **Retour :**

---

## Retours du 2026-10-22

Retours généraux du propriétaire après une première prise en main, classés du plus important au moins important. Ce qui n'est pas cité est jugé bon. Rien n'est encore traité.

### 1. Décisions structurantes, à trancher avant de construire

1. **Les collections dans le temps.** Avec trois collections, le choix du sachet tient ; avec des dizaines, non. Trois pistes : permanentes (préférence actuelle, mais elles s'accumulent), temporaires comme Pokémon TCG Pocket (bon pour la rareté, pas convaincu), ou cycliques (elles reviennent). La réponse décide de l'écran de choix du sachet et du sachet propre à chaque collection (point 2.2). Touche P14, P16 et P56. *Tranché le 2026-10-22 : rayon tournant (P69), pas encore construit.*
2. **Retirer le sachet « Découverte ».** Il ne correspond à rien en tant que tel. Revient sur P14, et sur P59 (avant le niveau 3, seul le sachet découverte est ouvert) : il faut dire ce qu'ouvre un joueur des niveaux 1 et 2. *Tranché le 2026-10-22 : les Fondateurs (P14, P59). Fait le 2026-10-22.*
3. **Le clan, chantier à part entière.** À reprendre dans son ensemble, avec :
   - un niveau de clan indépendant du niveau des joueurs, comme Clash of Clans ; calcul à trouver ;
   - des objectifs de la semaine bien plus élevés : 15 mots nouveaux se font en une journée, voire un seul sachet, par un seul joueur (cibles P66, déjà provisoires) ;
   - le délai entre quitter un clan et en rejoindre un autre (24 h aujourd'hui, P65), peut-être à supprimer ;
   - d'autres petits défauts de l'écran, à relever plus tard.

   *Tranché le 2026-10-22 : délai supprimé (P65), objectifs comptés en révisions réussies (P66), niveau de clan cosmétique (P70). Le reste passe par le cahier Clan v2, validé et fait le 2026-10-22.*
4. **Courbe de niveaux et niveau maximum.** Crainte d'atteindre le haut trop vite. Aujourd'hui, chaque niveau coûte 20 XP de plus que le précédent (100 XP pour passer au 2, 280 pour le 11, 1 080 pour le 51). À mesurer par simulation ; niveau maximum ou non, pas encore réfléchi. Plus de cadres et de titres pour les hauts niveaux (les avatars, jusqu'au niveau 140, suffisent). *Tranché le 2026-10-22 : pas de maximum, niveau 50 en quatre mois environ, courbe 100 + 45 × (n − 1) calée par simulation (P48). Plus de cadres et de titres : à dessiner.*

### 2. Écran Jouer, le plus gros reste à faire

1. **Profondeur.** Le fond est de la même couleur partout, ça fait vide. Essayer des zones distinctes, des encadrés.
2. **Le sachet.** Dessin à améliorer ; son logo n'est pas celui du site ; un sachet différent par collection.
3. **Trop de texte sous le sachet.** Les six points, puis « 1 sur 6 · le prochain dans 26 min » : trouver une façon plus discrète de montrer le stock et l'attente.
4. **« Déchire le haut du sachet ou touche-le »** reste affiché en permanence, sans moyen de le fermer.
5. **Le mot qui s'échappe** est trop collé au sachet.
6. **Animations d'arrivée** sur l'écran : la façon dont certains éléments apparaissent fait bizarre.

*Repris le 2026-10-22 : comptoir au centre entre la carte du niveau et « Aujourd'hui », un sachet par collection avec le vrai sceau, le stock dans un anneau, l'astuce qui se ferme, le mot qui s'échappe dans « Aujourd'hui », un simple fondu (JOU-01 à JOU-04, JOU-10).*

*Revu le 2026-10-23, à la demande du propriétaire (sachet trop gros, la première disposition lui plaisait mieux) : retour au bandeau du niveau en haut et aux boutons ronds de part et d'autre d'un sachet plus petit. Gardés de la reprise : le comptoir plus clair, le sachet par collection, l'anneau du stock, l'astuce qui se ferme, le mot qui s'échappe dans son encadré sous le comptoir. Partis : les cartes « Aujourd'hui » et « Ta collection » (le défi du jour a son anneau, l'objectif du clan le sien sur le bouton Clan, l'album la collection).*

### 3. Chemin des niveaux

Le principe est le bon, mais le rendu n'est pas assez travaillé. Il doit faire plus jeu, à la façon du chemin des problèmes de Chess.com (cases en relief, décor, étapes marquées), sans le copier.

*Repris le 2026-10-22 : un plateau de dalles en relief par quartier de dix niveaux, décor, brouillard au-delà (NIV-01). Les noms des quartiers sont provisoires.*

### 4. Textes

Des textes en trop ou mal sentis, qui « sentent l'IA ». Exemple, l'objectif de la semaine du clan : « 15 mots nouveaux, ensemble » et « Argent et or : 1 sachet bonus chacun, l'or ajoute la gravure … à l'emblème ». Relire tous les textes contre [voix.md](voix.md).

*Repris le 2026-10-22 : relecture de tous les textes du jeu. Partis : les « X : Y », les listes en trois temps, les « pour l'instant », « plus tard » et « C'est gratuit ». L'objectif du clan dit « Trouvez 300 mots nouveaux », « 214 / 300 · 23 à toi », « Un sachet bonus à l'argent. À l'or, un autre, plus la gravure … pour l'emblème. » Il sera réécrit avec Clan v2.*

### 5. Petites incohérences (corrigées le 2026-10-22)

1. Le niveau s'affiche de deux façons différentes : la pastille de l'en-tête et le bandeau « Niveau 10 » de l'écran Jouer. *Corrigé : la médaille rouge partout, entourée de l'anneau d'XP dans l'en-tête, posée sur l'avatar sur téléphone.* *Revu le 2026-10-27 après un retour de testeur : la médaille rouge à côté de l'avatar ou posée dessus passait pour une notification ; dans les deux bandeaux, ordinateur et téléphone, elle laisse la place à « Niveau N » au-dessus de la barre d'XP. La médaille reste sur l'écran Jouer et la route des niveaux.* *Revu le 2026-10-27 : une seule pastille de niveau partout, web et mobile, une médaille dorée à festons, de l'or du sceau des sachets, le chiffre gravé en brun : bandeaux du haut (devant la barre d'XP, jamais sur l'avatar), bandeau de Jouer, chemin des niveaux, coffret, profil, menu, emblème du clan, et à la place des « niv. N » des listes d'amis, de clan et d'échanges.*
2. « +3 bonus » dans l'en-tête : on peut cliquer dessus, mais il ne se passe rien. *Corrigé : il ouvre la réserve (JOU-02).*
3. Sur l'écran Jouer, le bouton Clan devrait montrer l'emblème de son clan, une fois membre, au lieu de l'icône par défaut. *Corrigé (JOU-01).*

---

## Hors recette

Pas construit ou pas testable ici :

- l'app mobile (lot 5, prochain chantier) ;
- les joutes (« pas encore construit ») ;
- la connexion Apple et Google, les notifications push et par e-mail ;
- les dos de carte et le mécène ;
- les vrais envois d'e-mails (en attente des DNS et du compte Lettermint) ;
- l'Encre et la Dorure, qui demandent 7 et 30 jours de révisions.

## Après la recette

La base de dev garde les comptes et le clan créés. Pour repartir de zéro, il faut vider la base (`docker compose down -v`, puis `docker compose up -d`, `pnpm db:migrate`, `pnpm catalog:publish`) : cela efface aussi ton compte admin, à redonner avec `pnpm admin:grant contact@leximon.fr` après t'être reconnecté.
