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

Crée B et C en te connectant une fois sur le site avec ces adresses. Ensuite, pour sauter les heures de jeu, un script réservé à la base locale règle le niveau et l'âge d'un compte :

```bash
pnpm dev:player recette-b@example.com --level 16 --age-days 4
```

- `--level N` met le compte au niveau N. Les coffrets des niveaux sautés attendent d'être ouverts, comme si l'XP avait été gagnée.
- `--age-days N` vieillit le compte de N jours (les échanges demandent un compte de plus de 3 jours).
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
- **Faire :** se déconnecter, se reconnecter avec un code faux, puis avec le bon.
- **Attendu :** le code faux est refusé avec un message clair et on peut réessayer sans retaper l'adresse.
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
- **Attendu :** bandeau de niveau (médaillon, titre, barre d'XP, « 260 / 400 XP »), les 4 prochaines récompenses, le sachet au centre, boutons flottants à gauche (Clan, Discussion, Joutes) et à droite (Défi du jour, Coffrets, Courrier, Réglages). En 390 px, la coque mobile : onglets en bas, bandeau en haut.
- **Retour :**

### JOU-02 · Stock
- **Attendu :** six points, « 4 sur 6 · le prochain dans 18 min » (selon ton stock), bouton « Ouvrir le sachet ». Stock vide et réserve vide : sachet gris et immobile, bouton désactivé. Stock vide avec des bonus : « Ouvrir un sachet bonus ».
- **Retour :**

### JOU-03 · Choix de la collection
- **Faire :** avec un compte de niveau 1 ou 2, puis de niveau 3 ou plus.
- **Attendu :** avant le niveau 3, seul le sachet découverte ; les collections portent « Niv. 3 ». Ensuite, les pastilles des collections changent le sachet.
- **Retour :**

### JOU-04 · Ouverture
- **Faire :** ouvrir plusieurs sachets.
- **Attendu :** déchirure au doigt ou à la souris, pile, cinq cartes à retourner, « Tout révéler ». Annonce « Rare ! », « Légendaire ! » à la couleur de la rareté ; à partir de Précieux, tu retournes la carte toi-même. Le mot est prononcé quand la carte se pose.
- **Retour :**

### JOU-05 · Coup d'œil
- **Faire :** une fois le sachet ouvert, glisser la pile en biais.
- **Attendu :** la tranche des cartes apparaît, colorée par rareté. Rien ne l'explique à l'écran (voulu, P46).
- **Retour :**

### JOU-06 · Bilan
- **Attendu :** « Ton sachet », meilleure rareté, mots nouveaux, éventail des cinq cartes avec « Nouveau », « +N XP », barre d'XP, progression de la collection.
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
- **Attendu :** quand un mot est dû en révision, une petite carte « *Mot* est en train de t'échapper. » avec « Réviser ». Absente sinon. *Un mot devient dû au plus tôt le lendemain de son premier défi.*
- **Retour :**

---

## 4. Niveaux et coffrets

Compte A : `pnpm dev:player contact@leximon.fr --level 21` pour avoir une série de coffrets.

### NIV-01 · Chemin des niveaux
- **Faire :** menu de l'avatar, « Chemin des niveaux ».
- **Attendu :** route qui serpente, centrée sur ton niveau, ton avatar épinglé dessus. Pastilles réclamées (coche), à réclamer (coffret qui pulse), suivante (contour jaune), fermées. Paliers de 5 plus gros, écriteaux « Ouvre : les échanges » aux niveaux 3, 5, 8, 10, 15.
- **Retour :**

### NIV-02 · Détail d'un niveau
- **Faire :** toucher un niveau passé, un niveau à réclamer, un niveau futur.
- **Attendu :** ses récompenses, ce qu'il ouvre, et « Ouvrir le coffret », « Réclamée » ou « Encore 1 240 XP. ». Le barème de l'XP (« D'où vient l'XP ») est affiché.
- **Retour :**

### NIV-03 · Coffret
- **Faire :** « N coffrets » sur Jouer.
- **Attendu :** le coffret du plus petit niveau s'ouvre : rayons, « Un coffret pour toi », puis les récompenses une à une, « Ranger dans ma réserve ».
- **Retour :**

### NIV-04 · Chaque type de récompense
- **Faire :** ouvrir les coffrets jusqu'au niveau 21.
- **Attendu :**
  - niveau impair : un sachet bonus ;
  - niveau pair : une recharge (« Stock remis au plein. ») ;
  - 5 et 15 : un sachet garni (au moins une Rare, ouvert avant les autres bonus) et un titre ;
  - 10 et 20 : une carte au choix, une place de plus dans la réserve (« 3 / 12 bonus »), un avatar, une place de carte épinglée, un cadre (« Filet doré », « Encre qui coule »).
- **Retour :**

### NIV-05 · Coffret qui ne peut pas servir
- **Faire :** réserve pleine, ouvrir un coffret de sachet bonus ; stock plein, ouvrir un coffret de recharge.
- **Attendu :** refus clair. Le coffret reste fermé et attend, rien n'est perdu.
- **Retour :**

### NIV-06 · Carte au choix
- **Attendu :** choix parmi les Courantes et Peu courantes qui te manquent, par collection, avec recherche. La carte choisie arrive dans l'album, sans XP.
- **Retour :**

### NIV-07 · Écrans fermés par le niveau
- **Faire :** avec un compte de niveau 4, toucher Échanges ; niveau 9, Clan ; niveau 14, Joutes.
- **Attendu :** l'écran fermé dit quel niveau l'ouvre, une phrase de promesse, la barre vers ce niveau, « Ouvrir un sachet », « Faire un défi ». Joutes, une fois le niveau atteint : « pas encore construit ».
- **Retour :**

---

## 5. Album et fiche d'une carte

### ALB-01 · Album
- **Attendu :** « Album », « N mots sur 1 561 », recherche, onglets de collection avec compte et barre à la teinte de la collection, filtre par rareté (gemme et « 85/175 »).
- **Retour :**

### ALB-02 · Filtres
- **Faire :** essayer Toutes, Doubles, À réviser, Dorure, Manquantes, et quelques thèmes.
- **Attendu :** la grille suit. Manquantes : emplacements « ? ». Une tuile « N mots à trouver » mène à Jouer.
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
- **Attendu :** grande carte avec reflets qui suivent la souris, rareté, fréquence (« Un mot imprimé sur 17 milliards. »), maîtrise en trois étapes avec ce qu'il reste, exemplaires et doubles, collection, origine, crédit de la gravure s'il y en a une.
- **Retour :**

### ALB-06 · Prononciation
- **Attendu :** le bouton fait entendre le mot. La notation phonétique est affichée à côté (à confirmer : tu voulais voir si tu la gardes).
- **Retour :**

### ALB-07 · Actions de la fiche
- **Attendu :** « Réviser ce mot » lance une révision ; « Proposer en échange » seulement avec un double et le niveau 5, et ouvre la nouvelle offre avec la carte choisie ; « Épingler » la met sur le profil ; « Partager » donne le texte (« Talpinette. Introuvable dans les livres d'aujourd'hui. Moi, je l'ai. »).
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
- **Attendu :** « Tes mots tiennent bon. Le prochain revient dans 3 h. ». *L'Encre (7 jours) et la Dorure (30 jours) ne se testent pas en une séance.*
- **Retour :**

---

## 7. Échanges

A et B au niveau 5 au moins, comptes de plus de 3 jours, chacun avec des doubles :

```bash
pnpm dev:player contact@leximon.fr --level 12 --age-days 4
pnpm dev:player recette-b@example.com --level 6 --age-days 4
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

### ECH-05 · Refuser, annuler
- **Faire :** B refuse une offre ; A annule une offre envoyée.
- **Attendu :** l'offre disparaît des deux côtés, sans XP.
- **Retour :**

### ECH-06 · Garde-fous
- **Faire :** un compte de moins de 3 jours (`--age-days 1`) ou sous le niveau 5 essaie d'échanger ; un code faux ; 11 offres en 24 h.
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
- **Attendu :** bannière, avatar dans son cadre, pseudo, titre, niveau, code joueur, membre depuis, « Atelier », « Partager ». Cartes épinglées (3 places au niveau 10, une place vide mène à l'album). En chiffres : mots sur 1 561, Légendaires, mots dorés, échanges, collections complètes, jours de jeu. *Le clan n'y est pas encore.*
- **Retour :**

### PRO-03 · Profil avant le niveau 8
- **Faire :** avec C au niveau 5.
- **Attendu :** « Ton profil devient public au niveau 8. D'ici là, toi seul le vois. »
- **Retour :**

### PRO-04 · Page publique
- **Faire :** ouvrir `/joueur/<pseudo de A>` sans être connecté, puis depuis B.
- **Attendu :** la page se lit sans compte. Depuis B : « Proposer un échange », « Signaler le pseudo », « Bloquer ». L'image de partage du lien est propre.
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
- **Attendu :** Jeu (Son, Vibration), Notifications (gardées, rien n'est encore envoyé), Profil (public, pseudo, joueurs bloqués), Compte (adresse, Tes données, « M'écrire quand il y a du nouveau », Me déconnecter).
- **Retour :**

### REG-02 · Courrier
- **Attendu :** coffret à ouvrir, carte au choix, offre reçue, sachets d'objectif de clan ; non lus surlignés, pastille rouge, chaque ligne mène à son écran.
- **Retour :**

### REG-03 · Bloquer et débloquer
- **Faire :** C bloque B depuis son profil, puis le débloque dans les réglages.
- **Attendu :** bloqué, aucun ne voit le profil de l'autre ni ne peut lui faire d'offre, les offres en cours tombent, et ses messages de clan disparaissent pour celui qui bloque. Débloqué, tout revient sauf les offres tombées.
- **Retour :**

### REG-04 · Nouvelles par e-mail
- **Faire :** cocher puis décocher « M'écrire quand il y a du nouveau ».
- **Attendu :** le réglage tient après un rechargement. Il change l'audience « joueurs » des campagnes (CAM-03).
- **Retour :**

### REG-05 · Supprimer mon compte
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
- **Attendu :** la demande arrive chez A ; une fois acceptée, B est membre et l'arrivée apparaît dans le journal.
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
- **Attendu :** chaque action marche et se lit dans le journal. C muet ne peut plus écrire : « Tu es muet dans ce clan pour l'instant. » Un adjoint ne peut exclure ni le chef ni un autre adjoint.
- **Retour :**

### CLA-12 · Objectif de la semaine
- **Faire :** regarder la carte de l'objectif, puis ouvrir des sachets avec A (au besoin, donne-lui des sachets bonus depuis l'admin).
- **Attendu :** « N mots nouveaux, ensemble », barre avec bronze, argent, or, « reste N j », « ta part : N ». La barre monte peu après chaque sachet (recompte en tâche de fond). À l'argent, puis à l'or, un sachet bonus à prendre sur la page et au courrier, pour qui a apporté au moins 5 mots ; à l'or, un objet d'emblème de plus pour le clan. *La cible est fixée au premier passage de la semaine : 5, 10 et 15 mots par membre actif.*
- **Retour :**

### CLA-13 · Bibliothèque
- **Attendu :** « À vous tous, il vous manque N Caractères. », une barre par collection, ta part en plein, celle du clan en clair.
- **Retour :**

### CLA-14 · Exclure
- **Faire :** A exclut C ; C essaie de rejoindre un autre clan tout de suite.
- **Attendu :** C n'est plus membre ; exclu, il peut rejoindre un autre clan sans attendre.
- **Retour :**

### CLA-15 · Quitter
- **Faire :** B quitte le clan, puis essaie d'en rejoindre un.
- **Attendu :** le bouton dit « Quitter le clan, 24 h sans clan » ; ensuite, 24 h d'attente avant de rejoindre un autre clan, avec un message qui le dit.
- **Retour :**

### CLA-16 · Le chef part
- **Faire :** A, seul avec un membre, quitte le clan.
- **Attendu :** la tête passe à l'adjoint le plus ancien, sinon au membre le plus ancien. Le dernier qui part dissout le clan.
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
- **Attendu :** le nombre de destinataires ne compte que les joueurs qui ont coché « M'écrire quand il y a du nouveau » (REG-04).
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

---

## Hors recette

Pas construit ou pas testable ici :

- l'app mobile (lot 5, prochain chantier) ;
- les joutes (« pas encore construit ») ;
- la connexion Apple et Google, les notifications push et par e-mail, le courrier envoyé par la file ;
- le clan sur le profil public ;
- les dos de carte et le mécène ;
- les vrais envois d'e-mails (en attente des DNS et du compte Lettermint) ;
- l'Encre et la Dorure, qui demandent 7 et 30 jours de révisions.

## Après la recette

La base de dev garde les comptes et le clan créés. Pour repartir de zéro, il faut vider la base (`docker compose down -v`, puis `docker compose up -d`, `pnpm db:migrate`, `pnpm catalog:publish`) : cela efface aussi ton compte admin, à redonner avec `pnpm admin:grant contact@leximon.fr` après t'être reconnecté.
