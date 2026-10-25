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

- `reverse` rend l'API, le catalogue et Metro de l'ordi joignables depuis le téléphone. **À refaire chaque fois que le câble est rebranché.** « Le serveur lambine » ou un écran vide : c'est presque toujours ça.
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
- **Attendu :** Jouer en relief au centre ; les onglets fermés par le niveau portent un cadenas et disent le niveau requis. Avatar → profil, XP → chemin des niveaux, enveloppe → courrier, avec le nombre de lettres non lues.
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
- **Attendu :** sachet gravé de la collection, stock en pastilles et temps avant le suivant, boutons ronds autour du sachet (clan, discussion, joutes fermées, défi du jour avec son anneau, amis, coffrets avec leur nombre). Une collection fermée dit le niveau requis.
- **Retour :**

### MJO-02 · Déchirer au doigt
- **Faire :** glisser le doigt le long du pointillé, d'un bout ou de l'autre ; une fois en s'arrêtant à mi-chemin et en revenant, une fois jusqu'au bout.
- **Attendu :** la bande suit le doigt et se soulève depuis l'endroit où elle tient encore. Relâchée avant 60 %, elle se recolle ; au-delà, elle s'envole et le sachet s'ouvre. Toucher le sachet ou le bouton l'ouvre aussi.
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

### MJO-07 · Gravures Épique et Légendaire
- **Faire :** ouvrir la fiche d'une Épique ou d'une Légendaire (album).
- **Attendu :** l'encre de la gravure prend le dégradé or ou irisé du mot, comme sur le web, au lieu d'une couleur unie.
- **Retour :**

---

## 4. Niveaux, coffrets, courrier

### MNI-01 · Chemin des niveaux (NIV-01, NIV-02)
- **Faire :** toucher le bloc XP ; changer de quartier, toucher des tuiles.
- **Attendu :** plateau du quartier, tuiles à réclamer qui pulsent, médaille sur le niveau actuel, brouillard au-delà ; détail d'un niveau sous le plateau, tableau « D'où vient l'XP ».
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
- **Faire :** onglets de collection, raretés, filtres, thèmes, recherche ; défiler vite jusqu'en bas.
- **Attendu :** comme sur le web, en trois colonnes ; l'onglet choisi est retenu au prochain lancement ; le défilement reste fluide.
- **Retour :**

### MAL-02 · Fiche d'une carte (ALB-05, ALB-07)
- **Faire :** toucher une carte ; Partager, Épingler, Désépingler.
- **Attendu :** carte en grand, crédit de la gravure, prononciation écrite, maîtrise, exemplaires, origine. Partager ouvre la feuille de partage d'Android. Épingler toutes places prises propose de remplacer une carte.
- **Retour :**

### MAL-03 · Comparer avec un ami
- **Faire :** Amis → un ami → « Comparer nos albums » ; essayer les trois filtres, fermer par la croix.
- **Attendu :** « Ton album, à côté de celui de … », filtres « … l'a, pas moi », « Je l'ai, pas … », « On l'a tous les deux ». La croix rend l'album normal.
- **Retour :**

---

## 6. Défis (DEF-01 à DEF-06)

### MDE-01 · Session
- **Faire :** lancer une session, répondre juste et faux, taper un mot quand il le demande, arrêter en cours.
- **Attendu :** comme sur le web ; le clavier ne cache ni la question ni le champ. Bilan et sachet bonus du jour.
- **Retour :**

### MDE-02 · Réviser un mot
- **Faire :** fiche d'une carte → Réviser.
- **Attendu :** une session sur ce mot démarre aussitôt.
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

## 10. Modération (MOD-01 à MOD-04)

### MMO-01 · Avis de sanction
- **Faire :** A sanctionne B depuis `/admin/signalements` (rendre muet une heure) ; B relance l'app ou revient dessus.
- **Attendu :** une fenêtre par-dessus le jeu : la sanction, sa raison, jusqu'à quand. « Contester » ouvre un champ que le clavier ne cache pas ; l'envoi dit « Contestation envoyée. ». « J'ai lu » ferme, et la fenêtre ne revient pas.
- **Retour :**

---

## 11. Version minimale

### VER-01 · Forcer la mise à jour
- **Faire :** ajouter `MOBILE_MIN_VERSION="2.0.0"` à `apps/api/.dev.vars`, relancer `pnpm dev`, rouvrir l'app (fermée puis rouverte, ou revenue au premier plan après une minute). Retirer la ligne et relancer ensuite.
- **Attendu :** « Leximon a changé », plein écran, avec « Mettre à jour » vers le Play Store ; rien du jeu n'est touchable derrière. Sans la ligne, le jeu revient.
- **Retour :**

---

## Pas encore sur le mobile

Sons, vibrations et mot prononcé à la révélation (dépendances à valider), copie du lien d'ami dans le presse-papiers, reflets des cartes, liens universels `https://leximon.fr/…`, page Mécène, joutes.
