# Cahier des charges · Retours du game designer

- **Statut :** tous les choix tranchés par le propriétaire le 2026-11-01, rien de construit. Chiffres de jeu provisoires, à recaler sur la bêta.
- **Source :** appel de deux heures du 2026-10-31 avec un game designer bénévole, ses retours écrits et les notes du propriétaire.
- **Règles liées :** P84 à P92 et les changements du 2026-11-01 sur P15, P23, P50, P59, P77 ([regles-du-jeu.md](../regles-du-jeu.md)). Les valeurs vivent dans ce fichier-là, ce cahier dit quoi construire.
- **Cahier lié :** [direction-artistique-le-livre.md](direction-artistique-le-livre.md), le chantier numéro un.
- **Études :** [rnd/doublons.md](../rnd/doublons.md), maquettes dans `rnd/da-refonte/`.

## Le diagnostic

Le game designer trouve le jeu prometteur. Ses retours reviennent à quatre constats :

1. **Le jeu manque d'âme.** Les cartes et les gravures sont anciennes, l'interface autour ne l'est pas.
2. **Les récompenses existent, mais le joueur ne les voit pas :** sachet bonus invisible, défi muet sur ce qu'il rapporte, palier incompris.
3. **Rien ne relie les systèmes.** Ouverture, défis, doublons et niveaux vivent chacun de leur côté, et un doublon ne vaut rien.
4. **Il y a peu de raisons de revenir au début.** Le pointage est linéaire, les objectifs arrivent tard, et le social s'ouvre après que beaucoup sont déjà partis.

## L'ordre des chantiers

La direction artistique passe d'abord, tout le reste ensuite, avec une seule exception : six corrections qui ne touchent pas à l'allure.

| Phase | Contenu | Mise en ligne |
|---|---|---|
| 0 | Six corrections immédiates | Dès qu'elles sont prêtes |
| 1 | Fondations de la DA : tokens, thèmes, matières, polices, ornements | Invisible pour le joueur |
| 2 | Le Livre sur la coque et le cœur du jeu, prototypes de l'écran Jouer et du paquet | Invisible, derrière un réglage |
| 3 | Le Livre partout, textes réécrits, puis bascule web, mobile et stores | La bascule |
| 4 | Récompenses et progression lisibles, album | Par lots |
| 5 | Économie : écus, recyclage, dépenses, tampons, série, succès, codes | Par lots |
| 6 | Social : niveaux, doubles visibles, échanges suggérés, souhaits, taux de réussite | Par lots |
| 7 | Duel en direct : R&D, prototype, construction | Après validation |

Les phases 1 à 3 sont détaillées dans le cahier de la DA. Les phases 4 à 7 sont dessinées dans Le Livre dès leur premier écran : elles ne créent donc pas de travail à refaire.

**Chaque lot compte double :** logique et textes vivent dans `packages/view-model`, mais les écrans s'écrivent pour le web et pour le mobile (D-033).

## L'ouverture publique

Il n'y a plus de date ferme. Début décembre reste la cible, janvier le repli. On ouvre quand tout ceci est vrai :

1. Les préalables de la [feuille de route](../feuille-de-route.md#avant-la-bêta-ouverte) sont tenus.
2. La phase 3 est finie : Le Livre est en ligne sur le web et sur les stores.
3. La rétention des testeurs atteint les objectifs de la north star : 35 % à J1 et 12 % à J7, mesurés dans `/admin/mesure` sur des joueurs arrivés après la bascule. Si elle reste en dessous, la phase 5 passe avant l'ouverture.

## Phase 0 · Six corrections immédiates

Chacune se teste sur le web et le mobile. Aucune ne change de règle du jeu.

| # | Sujet | Aujourd'hui | Attendu | Où |
|---|---|---|---|---|
| 0.1 | Durée de session | 7 jours par défaut, donc les relances à 7, 14 et 30 jours trouvent un joueur déconnecté | Session de 90 jours, prolongée à chaque visite. Dernière adresse e-mail préremplie sur l'écran de connexion | `apps/api/src/auth.ts`, écran compte web et mobile |
| 0.2 | Après la connexion | Écran « Tu es connecté » avec le bouton de déconnexion sous la souris | Retour direct à `/jouer`, avec un message discret. L'écran compte garde la déconnexion, loin du centre | `apps/web/src/account/account-screen.tsx`, équivalent mobile |
| 0.3 | Ordre du récapitulatif | Du plus commun au plus rare | Le récapitulatif va du plus rare au plus commun. La révélation garde son ordre, pour le suspense (P45) | `packages/view-model/src/reveal.ts`, récapitulatifs web et mobile |
| 0.4 | « Ouvrir un autre sachet » | Le bouton ramène au sachet fermé de l'accueil | Le bouton enchaîne sur le sachet suivant, déchirure comprise, sans repasser par l'accueil. Un second bouton dit « Retour à l'accueil » | `apps/web/src/booster/booster-screen.tsx`, `apps/mobile/src/screens/play/` |
| 0.5 | Bouton son | L'icône haut-parleur rejoue le mot, et la lecture reprend à la carte suivante | Icône lecture pour rejouer. Un bouton haut-parleur coupe vraiment la prononciation, et il reste branché sur le réglage existant | `apps/web/src/booster/reveal-card.tsx`, équivalent mobile |
| 0.6 | « Voir le bilan » | Mot de gestionnaire | « Voir mes cartes » | `apps/web/src/booster/booster-screen.tsx`, équivalent mobile |

**Tests :** une nouvelle fonction d'ordre pour le récapitulatif, testée dans `packages/view-model`, et la recette web et mobile.

## Phase 4 · Récompenses et progression lisibles

| # | Sujet | Attendu | Règle |
|---|---|---|---|
| 4.1 | Sachet bonus | Le bouton de fin de défi propose d'ouvrir le sachet gagné. Sur Jouer, le sachet bonus se choisit sans attendre un stock vide, et le texte « À ouvrir quand ton stock gratuit est vide » disparaît. Une ligne dit ce qu'est un sachet bonus et d'où il vient | P23 |
| 4.2 | Frise du défi | À chaque question, une frise de 5 cases montre les étapes et ce qu'on gagne : 3 justes donnent le sachet bonus, 5 justes les écus du sans-faute. L'étape gagnée s'anime avec un son | P29, P84 |
| 4.3 | Feedback du défi | Revue de chaque réaction du défi dans Le Livre : bonne réponse, erreur, palier, fin de série. Le bilan dit ce qui a été gagné et où cela se trouve | |
| 4.4 | Mémoire d'un mot | Nouvel état « Jamais révisé », puis Esquisse, Encre et Dorure. Le nombre de révisions, et « Prochaine révision dans 3 jours ». L'API expose le nombre de révisions, de façon additive | P33 |
| 4.5 | Jauge de mémoire | Étude courte de la jauge FSRS sur la fiche, sur maquette, avant de l'ajouter ou de l'écarter | |
| 4.6 | « Tes mots par palier » | Nouveau titre et une phrase qui dit l'action attendue et comment la lancer | |
| 4.7 | Prochaine étape | Bandeau et fins d'action ne montrent que la prochaine récompense. La table des matières complète reste sur Niveaux | |
| 4.8 | Album | Tri alphabétique par défaut, tri par rareté ou par date au choix, barre de lettres, en-tête fixe, cartes manquantes en fin de liste pour ne pas révéler leurs initiales. Une lettre saute à sa position, sans défilement linéaire | |
| 4.9 | Minimiser les clics | Revue de chaque parcours principal, avec le nombre de touches avant et après : ouvrir, réviser, trouver une carte, proposer un échange | |

**Points d'attention :** l'album charge ses cartes par tranches, donc la barre de lettres saute dans la liste triée au lieu de piloter une barre de défilement. La recherche existe déjà et reste limitée aux mots possédés.

## Phase 5 · L'économie

Elle se construit dans cet ordre, parce que chaque étape s'appuie sur la précédente.

### 5.1 Les écus (P84)

- Une monnaie, jamais achetable, jamais vendue, jamais donnée par l'abonnement Mécène (N1, P72).
- Nouveau portefeuille d'écus, écrit dans la transaction de chaque action, ligne verrouillée, avec clé d'idempotence et journal des mouvements pour l'admin.
- Affichage dans la coque, avec le détail de leurs sources et de leurs usages.

### 5.2 Le recyclage (P85)

- Bouton « Recycler 12 doubles, +34 écus » en une touche, à la fin d'une ouverture et dans l'album. Le gain s'annonce avant et se joue avec un son de pièces.
- Le bouton n'apparaît que s'il y a quelque chose à recycler.
- **Route :** `POST /cards/recycle`, avec la liste calculée par le serveur et une clé d'idempotence, verrouillage des exemplaires dans un ordre fixe.
- **Test d'intégration :** deux recyclages simultanés, et un recyclage concurrent d'une offre d'échange qui réserve le même double.
- Hors ouverture, le recyclage ne doit pas ralentir la route d'ouverture (150 ms au p95).

### 5.3 Le mot manquant (P86)

- Écran depuis l'album : le joueur choisit une collection et une rareté, voit le prix, reçoit un mot qui lui manque, avec une courte révélation.
- Le serveur tire le mot avec le générateur cryptographique, parmi les mots manquants.
- Si plus aucun mot ne manque dans ce choix, l'option disparaît.
- **Test d'intégration :** requêtes concurrentes sur le même portefeuille.

### 5.4 Les cosmétiques et les entrées

- Une vitrine en écus : cadres et dos de carte réservés aux écus, sans toucher aux cosmétiques exclusifs des mécènes (P73). Les prix se fixent à la construction, avec le propriétaire, sur les gains réels des joueurs.
- Une entrée en écus ne s'applique qu'à un mode spécial. Elle n'alimente jamais une mise entre joueurs (P52).

### 5.5 Les tampons (P87)

- Nouveau compteur à vie d'exemplaires obtenus par carte. Les joueurs actuels partent de leur quantité présente.
- Tampon visible à 5, 10 et 25 exemplaires sur la fiche et dans l'album. Le dessin ne doit pas imiter un signe de rareté (P72).

### 5.6 La série (P88)

- Calcul à la volée, comme le stock : pas de tâche planifiée.
- Vue dans le carnet : série en cours, jours pardonnés de la semaine, total qui ne retombe jamais, prochain palier.
- Une série cassée propose calmement sa réparation pendant 3 jours, puis repart de zéro.
- Aucun e-mail, aucune notification et aucun texte ne parle de perdre la série (P80, `docs/voix.md`).
- **Réserve à garder en tête :** une série rompue réduit la répétition du comportement (Silverman et Barasch, 2023). C'est pour cela que le total reste visible en premier.

### 5.7 Les succès (P89)

- Environ 40 succès en cinq familles : collection, savoir, assiduité, social, curiosité. Liste à écrire, avec les textes en voix humaine.
- Répartition : une douzaine atteignable pendant les dix premiers jours, pour répondre au constat 4.
- Page « Carnet » depuis le menu du joueur, annonce à l'obtention, cinq succès montrés sur le profil.
- Récompense réclamée, comme un coffret.
- Rattrapage calculé à la migration depuis les tables existantes, en une fois.

### 5.8 Les codes (P90)

- Admin : création, quantité, date de fin, récompense, source de mesure.
- Saisie sur le site et dans l'application Android. Sur iPhone, un lien ouvre la page du site, parce que le cas d'un code gratuit saisi dans l'application reste incertain chez Apple.
- Récompense livrée au courrier.
- Lecture dans `/admin/mesure` : codes saisis, joueurs arrivés, rétention de chaque source.
- **Test d'intégration :** deux saisies simultanées du dernier code restant.

## Phase 6 · Le social

| # | Sujet | Attendu | Règle |
|---|---|---|---|
| 6.1 | Niveaux | Profil public et rejoindre un clan au niveau 5, créer un clan au niveau 10, modes entre joueurs au niveau 8 | P50, P59 |
| 6.2 | Doubles visibles | Le profil montre les doubles disponibles, et un échange se propose en deux touches depuis la liste Communauté | P77 |
| 6.3 | Échanges suggérés | Le jeu propose des joueurs avec qui un échange est possible, sans révéler les cartes qui manquent | P77 |
| 6.4 | Liste de souhaits | Les mots déjà vus, chez un ami, dans un défi ou dans l'énigme, s'ajoutent à une liste que les détenteurs voient | P77 |
| 6.5 | Taux de réussite | Sur la fiche de carte, son propre score et celui de la communauté | P92 |

**Point d'attention :** rien ne doit permettre de lire la liste complète de ce qui manque à un joueur.

## Phase 7 · Le duel en direct

1. **R&D temps réel (D-007) :** tenue des pics, coût, repli. Le duel reste hors du chemin critique.
2. **Prototype jouable,** à tester entre deux navigateurs, avant toute écriture définitive : chrono, deck, fantôme, triche.
3. **Construction** selon P91, avec une anti-triche côté serveur : la bonne réponse n'arrive jamais au client avant la réponse.

Le catalogue est public : le chrono par question est la seule vraie parade à la recherche des réponses.

## Autres retours

| Retour | Suite |
|---|---|
| Aspect IA des textes | Réécriture avant la bascule, phase 3. Il faut d'abord dix phrases aimées et dix phrases détestées du propriétaire. Les définitions des cartes ne changent pas |
| Lore | Un lieu et un libraire, Maître Furet, voir le cahier de la DA |
| RGPD | Revue avant l'ouverture : nouveaux traitements (écus, série, codes), page de confidentialité, relecture par un juriste, déjà prévue |
| Regarder la concurrence | Fait le 2026-11-01, voir l'annexe. WikiMasters à suivre chaque mois |
| International | Rien pour l'instant. Le contenu reste en français |
| Rester adaptable | Pas de chantier : règles datées et architecture actuelle y répondent |
| Toggle de validation des mots | Abandonné : le propriétaire ne retrouve plus de quoi il s'agissait |
| Doublon et maîtrise | Refusé : la maîtrise prouve la mémoire (P33). Les tampons répondent au besoin |
| Hasard payant, enchères, recettes de cartes | Exclus : N1, risques de fausses ventes et simulation |
| Monnaie contre sachets | Refusé : un sachet ne s'obtient pas en écus (P84) |

## Ce qui reste à décider, et quand

Tout est tranché, sauf ce que le propriétaire a voulu décider sur pièces :

| Sujet | Quand | Comment |
|---|---|---|
| Organisation de l'écran Jouer | Phase 2 | Prototype des versions A et B |
| Forme du paquet | Phase 2 | Prototypes animés : sachet teinté, pochette de papier, pli cacheté |
| Polices | Phase 1 | Essai sur écran réel de Spectral et IM Fell French Canon |
| Sons | Après la phase 2 | Écoute du jeu dans Le Livre |
| Matière des cartes par rareté | R&D sans priorité, après la phase 3 | Essais sur quelques cartes |
| Jauge de mémoire | Phase 4 | Étude sur maquette |

## Risques

| Risque | Réponse |
|---|---|
| La refonte s'étale et bloque tout | Bascule sur le cœur du jeu d'abord, le reste suit écran par écran derrière le réglage |
| La série passe pour une pénalité d'absence | PEGI 12 attendu de toute façon (`docs/fiches-stores.md`), et l'inscription demande 15 ans. Mettre à jour le questionnaire de classification |
| Apple refuse les codes | Aucun code dans l'application iOS |
| Les écus coulent en fin de collection | Chaque nouvelle collection relance la dépense. Recaler le barème sur les chiffres de la bêta |
| Une monnaie de plus rend le jeu illisible | Une seule monnaie, pour toujours. Pas de seconde monnaie, contre-exemple de Pokémon TCG Pocket |
| Un client mobile ancien casse | Champs additifs seulement, migrations rétrocompatibles |

## Annexe · Repères sur la concurrence

Relevés le 2026-11-01, à revoir régulièrement. Sources secondaires pour une partie des chiffres.

| Jeu | Fait utile |
|---|---|
| WikiMasters | Né en mars 2026, plus de 400 000 inscrits déclarés, après le ZEvent et des streamers. 5 cartes toutes les 10 min, duels à 3 cartes avec quiz, doublon défaussé à 1 wikibidou quelle que soit la rareté, 51 succès, abonnement qui accélère les sachets. Critiques : serveurs saturés, fausses ventes, carte sur Hitler |
| Pokémon TCG Pocket | Poudre selon la rareté, Pack Points à échanger contre une carte choisie. Jetons d'échange obtenus en détruisant des cartes, révolte des joueurs, retirés en juillet 2025 |
| Hearthstone | Fabriquer coûte 4 à 8 fois le gain de désenchantement |
| Clash Royale | Niveau de collection depuis mai 2026 |
| Marvel Snap | Packs qui garantissent une carte non possédée, depuis avril 2025 |
| Duolingo | Une série de 7 jours multiplie par 2,4 le retour du lendemain, la protection du week-end ajoute 4 % de retour hebdomadaire. Notifications culpabilisantes critiquées |
| Wordle, Pédantix | Même mot pour tous, partage sans spoiler, rendez-vous quotidien |
| Trivia Crack, HQ Trivia | Le duel asynchrone tient, le direct à heure fixe s'est effondré |

Pour les jeux soumis depuis juin 2026, la réforme PEGI classe un retour récompensé en PEGI 7, une absence pénalisée en PEGI 12, une offre payante limitée en PEGI 12 et un hasard payant en PEGI 16. Ce relevé n'est pas un avis juridique.

**Sources :** [Next sur WikiMasters](https://next.ink/258293), [règles d'Apple](https://developer.apple.com/app-store/review/guidelines/), [Reed Smith sur PEGI](https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/), [Duolingo](https://blog.duolingo.com/improving-the-streak/), [étude sur les séries rompues](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions), [Clash Royale](https://supercell.com/en/games/clashroyale/blog/news/new-collection-levels-and-mastery-changes/), [Game8 sur TCG Pocket](https://game8.co/games/Pokemon-TCG-Pocket/archives/496009), [Hearthstone Wiki](https://hearthstone.wiki.gg/wiki/Crafting), [Marvel Snap Zone](https://marvelsnapzone.com/snap-packs-announcement), [ANJ sur les JONUM](https://anj.fr/jeux-objets-numeriques-monetisables-jonum), [BnF](https://www.bnf.fr/fr/faire-une-utilisation-commerciale-dune-reproduction), [Rijksmuseum](https://data.rijksmuseum.nl/policy), [Paris Musées](https://parismusees.paris.fr/en/actualite/open-content-150000-works-from-the-museum-collections-of-the-city-of-paris-freely).
