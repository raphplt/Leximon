# Recette du mobile

Tout ce que l'app Android sait faire au 2026-10-25, à tester sur ton téléphone. Les règles du jeu sont les mêmes que sur le web : quand un test renvoie à un identifiant de la [recette du web](recette-web.md) (`JOU-04`), les attendus métier de ce test valent aussi ici, et seul ce qui est propre au téléphone est écrit. Note ton retour sous **Retour** (« OK », ou ce qui cloche).

## 0. Préparer

### Lancer le projet

Une fois : le Java d'Android Studio (le JRE du système n'a pas de compilateur), puis l'app de développement sur le téléphone branché en USB, débogage USB activé, émulateur fermé.

```bash
echo 'export JAVA_HOME=/opt/android-studio/jbr' >> ~/.bashrc
pnpm --filter @leximon/mobile android
```

À chaque séance, dans le dépôt :

```bash
docker compose up -d
pnpm dev
pnpm --filter @leximon/mobile reverse
```

- `reverse` rend l'API, le catalogue et Metro de l'ordi joignables depuis le téléphone. **À refaire chaque fois que le câble est rebranché.** « Le serveur ne répond pas » ou un écran vide : c'est presque toujours ça.
- Une modification du code arrive sur le téléphone sans réinstaller. Après une nouvelle dépendance native, relancer la commande `android`.
- Code de connexion : il s'affiche dans le terminal de `pnpm dev`, comme pour le web.

### Les comptes

| Nom | Où | Compte |
|---|---|---|
| A | Web (navigateur de l'ordi) | `contact@leximon.fr`, admin |
| B | Téléphone | `recette-b@example.com` |
| Invité | Téléphone, après « Supprimer mon compte » ou une réinstallation | aucun |

A sur le web sert de deuxième joueur : amis, échanges, clan, sanctions. `pnpm dev:player recette-b@example.com --level 16` ouvre tout ce qui dépend du niveau.

---

## 1. Coque et navigation

### COQ-01 · Lancement
- **Faire :** ouvrir l'app.
- **Attendu :** écran de lancement aux couleurs du jeu, puis Jouer. Polices du jeu partout (pas de police système), barre d'état claire sur fond sombre.
- **Retour :**

### COQ-02 · Onglets et bandeau
- **Faire :** passer par Album, Défis, Jouer, Échanges, Clan ; toucher l'avatar, le bloc XP, le courrier.
- **Attendu :** Jouer en relief au centre ; les onglets fermés par le niveau portent un cadenas et disent le niveau requis. Avatar → profil, XP → chemin des niveaux, enveloppe → courrier, avec le nombre de lettres non lues. L'avatar seul, sans rien sur son coin ; à côté, la pastille de niveau (médaille dorée à festons, chiffre gravé, la même que sur le web) devant la barre d'XP.
- **Retour :**

### COQ-03 · Bouton retour d'Android
- **Faire :** depuis une page empilée (profil, réglages, courrier, fiche de carte, fenêtre ouverte), faire le geste ou le bouton retour.
- **Attendu :** une fenêtre se ferme d'abord, puis la page revient à l'écran d'avant. Jamais de sortie de l'app depuis une page empilée.
- **Retour :**

### COQ-04 · Clavier
- **Faire :** écrire dans la recherche de l'album, la discussion du clan, un pseudo, un code de connexion.
- **Attendu :** le champ reste visible au-dessus du clavier, le bouton d'envoi aussi.
- **Retour :**

---

## 2. Compte et portes de la bêta

### CPT-01 · Invité puis compte (INS-01 à INS-04)
- **Faire :** en invité, ouvrir des sachets jusqu'au dernier, puis Profil → Mon compte : adresse, code, âge, conditions.
- **Attendu :** les mêmes étapes que sur le web ; les cartes de l'invité restent sur le compte.
- **Retour :**

### CPT-02 · Se déconnecter et revenir
- **Faire :** Mon compte → Se déconnecter, puis se reconnecter avec B.
- **Attendu :** tous les écrans repartent sur le bon joueur (album, niveau, courrier), sans trace du joueur d'avant.
- **Retour :**

### CPT-03 · Liens d'invitation et d'ami
- **Faire :** avec `adb shell am start -a android.intent.action.VIEW -d "leximon://invitation/<code>" fr.leximon.app`, puis `leximon://ami/<code joueur de A>`.
- **Attendu :** la page d'invitation ou d'ami s'ouvre dans l'app, comme `/invitation/<code>` et `/ami/<code>` sur le web. Les liens `https://leximon.fr/…` n'ouvrent pas encore l'app (liens universels à configurer).
- **Retour :**

---

## 3. Jouer

### MJO-01 · Écran Jouer (JOU-01 à JOU-03)
- **Faire :** regarder l'écran, changer de collection avec les flèches.
- **Attendu :** l'ancien sachet glisse hors du comptoir d'un côté pendant que le nouveau entre de l'autre, en se redressant. Sachet gravé de la collection, stock en pastilles et temps avant le suivant, boutons ronds autour du sachet (clan, discussion, joutes fermées, défi du jour avec son anneau, amis, coffrets avec leur nombre). Une collection fermée dit le niveau requis. Dans la barre du haut, la pilule du stock ouvre un panneau avec le stock et la réserve de sachets bonus.
- **Retour :**

### MJO-08 · Le même sachet que sur le web
- **Faire :** ouvrir `/jouer` sur le web à côté du téléphone, sur la même collection ; regarder le sachet quelques secondes ; vider son stock et regarder le sachet vide.
- **Attendu :** même sachet au détail près : dents des sertissages, bande « déchirer ici ▸ » et son pointillé, « LEXIMON » doré, sceau gravé, ruban kraft (un nom long passe sur deux lignes équilibrées), « 5 CARTES », sceau de cire rouge en bas à droite, plis aux coins. Il se balance lentement, la lumière glisse sur la feuille et son ombre suit. Vide, il est gris au-dessus d'un trait doré qui monte, avec le temps restant au-dessus du trait.
- **Retour :**

### MJO-02 · Déchirer au doigt
- **Faire :** glisser le doigt le long du pointillé, d'un bout ou de l'autre ; une fois en s'arrêtant à mi-chemin et en revenant, une fois jusqu'au bout.
- **Attendu :** la bande suit le doigt et se soulève depuis l'endroit où elle tient encore, avec un crépitement de papier. Relâchée avant 60 %, elle se recolle ; au-delà, elle s'envole en tournant, deux cartes sortent du sachet, avec un bruit de déchirure et une vibration. Toucher le sachet ou le bouton l'ouvre aussi.
- **Retour :**

### MJO-03 · Astuce d'ouverture
- **Faire :** sur un téléphone neuf ou après réinstallation, regarder sous le sachet ; ouvrir trois sachets, ou toucher ×.
- **Attendu :** « Tire sur le pointillé, ou touche le sachet. » sous le sachet, qui disparaît après trois sachets ou à la croix, pour de bon.
- **Retour :**

### MJO-04 · Pile et coup d'œil (JOU-05)
- **Faire :** à la sortie du sachet, glisser la pile en diagonale sans relâcher, puis relâcher ; ensuite toucher la pile.
- **Attendu :** les cartes arrivent une à une face cachée. En diagonale, la pile s'évente et les tranches prennent la couleur des raretés (jamais celle du dessus) ; relâchée, elle se referme. Un toucher ou un glissé vers le haut révèle la première carte. « Tout révéler » saute à la plus rare.
- **Retour :**

### MJO-05 · Révélation (JOU-04)
- **Faire :** passer les cartes en touchant, puis en glissant à gauche et à droite ; un petit glissé qui revient.
- **Attendu :** mise en scène selon la rareté (tremblement, fissures, éclipse), « Nouveau ! » ou nombre d'exemplaires, « Ta première Rare ! ». Une carte retournée suit le doigt en s'inclinant et part du côté du glissé ; un petit glissé la laisse revenir.
- **Retour :**

### MJO-06 · Bilan (JOU-06, JOU-07)
- **Faire :** finir les cartes.
- **Attendu :** les cartes du sachet en défilement, XP gagnée, progression de la collection. Un coffret qui attend fait du bouton principal « Ouvrir le coffret ».
- **Retour :**

### MJO-09 · Sons, voix et vibrations (JOU-08)
- **Faire :** son du téléphone monté, mode silencieux coupé ; ouvrir des sachets jusqu'à une Rare au moins ; toucher le bouton de lecture sous une carte, puis le haut-parleur à côté ; dans Réglages, couper « Mots dits à voix haute », puis « Son », puis « Vibration », et rouvrir un sachet à chaque fois ; enfin passer le téléphone en silencieux.
- **Attendu :** les mêmes sons que sur le web : glissement des cartes, retournement, carillon des Rares et au-delà, grondement, fissure, fanfares, « Nouveau ! », accord du bilan avec un carillon par carte rare. Le mot est dit quand la carte se pose ; le bouton de lecture le redit, et le haut-parleur coupe la prononciation jusqu'à ce qu'on la remette, le réglage suivant le même état. Les Rares et au-delà vibrent, plus fort quand elles sont plus rares. Chaque réglage coupe ce qu'il dit et tient après un relancement. En silencieux, aucun son. La musique d'une autre app continue.
- **Retour :**

### MJO-07 · Gravures Épique et Légendaire
- **Faire :** ouvrir la fiche d'une Épique ou d'une Légendaire (album).
- **Attendu :** l'encre de la gravure prend le dégradé or ou irisé du mot, comme sur le web, au lieu d'une couleur unie.
- **Retour :**

### MJO-10 · Reflets des cartes
- **Faire :** ouvrir la fiche d'une carte de chaque rareté (album), la regarder sans la toucher, puis faire glisser le doigt dessus de gauche à droite, puis la lâcher et pencher le téléphone dans tous les sens ; faire de même devant un sachet scellé ; ouvrir des sachets jusqu'à une Rare au moins et la faire passer par « Tout révéler » ; activer « Supprimer les animations » dans l'accessibilité d'Android et rouvrir une fiche.
- **Attendu :** la carte révélée et celle de la fiche restent de face, le texte net, et seule la lumière dérive doucement ; sous le doigt, elles penchent à l'opposé et la lumière suit, puis reviennent en douceur quand le doigt se lève. Le téléphone penché, la lumière suit l'inclinaison et la carte reste de face ; le sachet scellé fait pareil. Tenu comme d'habitude, la carte reste droite, la lumière au centre. Les mêmes reflets que sur le web pour chaque rareté : rien sur une Courante, une lumière douce sur une Peu courante, plus vive et un éclat sur la pastille à partir de Rare, des rayures claires sur le cadre cobalt d'une Précieuse, une dorure qui glisse sur le cadre et des paillettes dorées près de la lumière sur une Épique, un cadre irisé, des paillettes, un voile arc-en-ciel et un éclair toutes les 5 s sur une Légendaire. Le geste qui fait passer à la carte suivante marche toujours ; dans la fiche, la page défile toujours. Dans le bilan, une Rare ou mieux reçoit en arrivant un éclat et un halo de sa couleur. Sans animations, la carte reste droite, la lumière au centre, le téléphone penché n'y change rien, et le bilan sans éclat. Avant Android 10, la carte penche sans reflets.
- **Retour :**

---

## 4. Niveaux, coffrets, courrier

### MNI-01 · Chemin des niveaux (NIV-01, NIV-02)
- **Faire :** toucher le bloc XP ; changer de quartier, toucher des tuiles.
- **Attendu :** plateau du quartier, tuiles à réclamer qui pulsent, pastille de niveau sur le niveau actuel, brouillard au-delà ; détail d'un niveau sous le plateau, tableau « D'où vient l'XP ».
- **Retour :**

### MNI-02 · Coffret (NIV-03 à NIV-05)
- **Faire :** ouvrir un coffret depuis le bouton rond, le bilan ou le chemin.
- **Attendu :** le coffret flotte, s'ouvre, montre ses récompenses ; compteurs mis à jour. Réserve pleine : la fenêtre le dit et propose d'ouvrir un sachet.
- **Retour :**

### MNI-03 · Courrier
- **Faire :** ouvrir l'enveloppe.
- **Attendu :** « À faire » (coffrets, parrainages, objectifs de clan, mot qui s'échappe) puis les nouvelles. Toucher une lettre mène au bon écran et fait baisser le compteur.
- **Retour :**

---

## 5. Album et fiche

### MAL-01 · Album (ALB-01 à ALB-04, ALB-09)
- **Faire :** onglets de collection, recherche ; bouton « Filtres » : raretés, « Afficher », thèmes, « Effacer les filtres » ; défiler vite jusqu'en bas.
- **Attendu :** comme sur le web, en trois colonnes ; l'onglet choisi est retenu au prochain lancement ; le défilement reste fluide.
- **Retour :**

### MAL-02 · Fiche d'une carte (ALB-05, ALB-07)
- **Faire :** toucher une carte ; Partager, Épingler, Désépingler.
- **Attendu :** carte en grand, crédit de la gravure, prononciation écrite, maîtrise, exemplaires, origine. Partager ouvre la feuille de partage d'Android. Épingler toutes places prises propose de remplacer une carte. « Signaler une erreur », tout en bas, envoie un retour rangé dans `/admin/retours` sous `/mobile/carte/<mot>`.
- **Retour :**

### MAL-03 · Comparer avec un ami
- **Faire :** Amis → un ami → « Comparer nos albums » ; essayer les trois filtres, fermer par la croix.
- **Attendu :** « Ton album, à côté de celui de … », filtres « … l'a, pas moi », « Je l'ai, pas … », « On l'a tous les deux ». La croix rend l'album normal.
- **Retour :**

---

## 6. Défis (DEF-01 à DEF-14)

### MDE-04 · Écran Défis
- **Faire :** suivre DEF-01, DEF-05 et DEF-07 de [recette-web.md](recette-web.md) sur le téléphone.
- **Attendu :** comme sur le web, en une colonne : « Ta révision » et son bouton en tête, les couvertures « S'entraîner sur… » faciles à toucher, le défi du jour, l'énigme, « Ta mémoire ». Les réglages s'ouvrent sous la roue et tiennent d'un lancement à l'autre (ils sont sur le compte : un réglage fait sur le web se retrouve ici).
- **Retour :**

### MDE-01 · Série
- **Faire :** lancer une révision, répondre juste et faux, taper un mot quand il le demande, arrêter en cours.
- **Attendu :** comme sur le web, prononciation, médaillon du verdict, mot nouveau présenté en grande carte, rattrapage, sons, vibrations et réactions compris (DEF-02, DEF-03, DEF-06, DEF-08, DEF-11, DEF-12) ; le clavier ne cache ni la question ni le champ. Bilan enrichi et sachet bonus du jour. Pas d'aide clavier.
- **Retour :**

### MDE-02 · Révisions choisies
- **Faire :** suivre DEF-09 de [recette-web.md](recette-web.md) sur le téléphone, bouton de l'album compris.
- **Attendu :** comme sur le web ; le bouton de l'album ouvre la série dans l'onglet Défis.
- **Retour :**

### MDE-05 · Un mot demandé d'ailleurs
- **Faire :** depuis le courrier, ouvrir un mot à réviser.
- **Attendu :** une révision démarre, ce mot en premier.
- **Retour :**

### MDE-03 · Énigme du jour
- **Faire :** suivre DEF-10 de [recette-web.md](recette-web.md) sur le téléphone, depuis la carte « Énigme du jour » de l'onglet Défis.
- **Attendu :** comme sur le web, sons et vibrations compris ; le clavier ne cache pas le champ, le partage ouvre la feuille du système, et la carte de l'onglet Défis montre le résultat au retour.
- **Retour :**

---

## 7. Échanges (ECH-01 à ECH-07)

### MEC-01 · Proposer à A
- **Faire :** B propose un échange à A depuis l'écran Échanges ou la fiche d'ami ; A l'accepte sur le web.
- **Attendu :** offre en une ou trois cartes ; quand A accepte, B voit le moment de l'échange conclu à son prochain passage sur l'app.
- **Retour :**

### MEC-02 · Recevoir de A
- **Faire :** A propose une offre à B sur le web ; B la refuse, puis une autre qu'il accepte.
- **Attendu :** comme sur le web ; les cartes arrivent dans l'album de B.
- **Retour :**

---

## 8. Amis, profil, réglages

### MAM-01 · Amis
- **Faire :** ajouter A par pseudo, accepter une demande de A, partager son lien d'ami, réagir à une trouvaille du fil, retirer un ami.
- **Attendu :** demandes reçues et envoyées, podium de la semaine, fil avec réactions ; « Partager mon lien » ouvre la feuille de partage. Le retrait demande confirmation.
- **Retour :**

### MPR-01 · Profil et atelier
- **Faire :** ouvrir le profil ; épingler, réordonner, changer une carte ; Atelier : porter un avatar, un cadre, un titre ; Partager.
- **Attendu :** en-tête avec avatar encadré, titre, niveau, clan, code joueur ; statistiques. Ce qui est porté se voit aussitôt dans le bandeau.
- **Retour :**

### MPR-02 · Profil public d'un autre
- **Faire :** depuis Amis ou un membre du clan → « Voir son profil » ; Signaler le pseudo ; Bloquer (sur un compte jetable).
- **Attendu :** profil de l'autre, actions selon l'amitié (proposer un échange, ajouter, demande envoyée). Bloquer demande confirmation puis cache le profil.
- **Retour :**

### MPR-03 · Réglages
- **Faire :** basculer chaque réglage, ouvrir les joueurs bloqués, « Tes données ».
- **Attendu :** chaque bascule tient après un relancement ; débloquer un joueur le retire de la liste ; « Tes données » ouvre la page de confidentialité dans un navigateur intégré.
- **Retour :**

### MPR-04 · Supprimer son compte
- **Faire :** sur un compte jetable : Réglages → Supprimer mon compte, les deux étapes.
- **Attendu :** le compte disparaît (plus de connexion possible avec cette adresse sans en recréer un) et l'app repart en invité neuf.
- **Retour :**

### MPR-05 · Un retour ?
- **Faire :** Profil → « Un retour ? », écrire et envoyer.
- **Attendu :** « Bien reçu. Merci. » ; le retour apparaît dans `/admin/retours` avec l'écran `/mobile`.
- **Retour :**

---

## 9. Clan (CLA-01 et suivants)

### MCL-01 · Rejoindre, discuter, objectif
- **Faire :** B rejoint le clan de A (demande ou code), écrit dans la discussion, mentionne A ; regarde l'objectif de la semaine.
- **Attendu :** comme sur le web ; les nouveaux messages arrivent sans recharger, la mention arrive dans le courrier de A.
- **Retour :**

### MCL-02 · Chef
- **Faire :** B fonde un clan (compte au niveau voulu), accepte une demande, change un rôle, ouvre le menu d'un membre.
- **Attendu :** gestion du clan, emblème, devise filtrée ; « Voir son profil » dans le menu d'un membre.
- **Retour :**

---

### MCL-03 · Communauté
- **Faire :** ouvrir l'onglet Communauté à un niveau inférieur à 10, puis supérieur. Passer par Mon clan, Amis, Joueurs et Clans. Essayer les tris, chercher un pseudo, ouvrir un joueur et un clan, puis revenir.
- **Attendu :** comme COM-01 à COM-05. La barre des quatre parties reste en haut et la barre d'onglets en bas. Le retour depuis un joueur ou un clan ramène à la même partie. La liste des joueurs tient en lignes (avatar, pseudo, niveau, clan), et rien ne passe sous la barre d'onglets en bas de liste.

## 10. Modération (MOD-01 à MOD-04)

### MMO-01 · Avis de sanction
- **Faire :** A sanctionne B depuis `/admin/signalements` (rendre muet une heure) ; B relance l'app ou revient dessus.
- **Attendu :** une fenêtre par-dessus le jeu : la sanction, sa raison, jusqu'à quand. « Contester » ouvre un champ que le clavier ne cache pas ; l'envoi dit « Contestation envoyée. ». « J'ai lu » ferme, et la fenêtre ne revient pas. Dans la discussion du clan, le champ est fermé et dit pourquoi.
- **Retour :**

---

## 11. Version minimale

### VER-01 · Forcer la mise à jour
- **Faire :** ajouter `MOBILE_MIN_VERSION="2.0.0"` à `apps/api/.dev.vars`, relancer `pnpm dev`, rouvrir l'app (fermée puis rouverte, ou revenue au premier plan après une minute). Retirer la ligne et relancer ensuite.
- **Attendu :** « Leximon a changé », plein écran, avec « Mettre à jour » vers le Play Store ; rien du jeu n'est touchable derrière. Sans la ligne, le jeu revient.
- **Retour :**

---

## Pas encore sur le mobile

Copie du lien d'ami dans le presse-papiers, liens universels `https://leximon.fr/…`, page Mécène, joutes.
