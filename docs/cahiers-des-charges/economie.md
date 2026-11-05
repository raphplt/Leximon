# Cahier des charges · L'économie et l'équilibrage

- **Statut :** proposé le 2026-11-05. Choix du propriétaire le même jour : toutes les recommandations, sauf E9 (pointage permanent, voir ci-dessous). Inscrit en P10, P37, P48, P84 et P93 à P97. Étapes 1 à 4 de E10 construites le 2026-11-05 (réglages, semaine de bienvenue, écus, missions et carnet) ; restent les joutes et la saison.
- **Source :** l'appel et les notes du game designer de la semaine du 2026-10-31, les retours des joueurs ([retours-joueurs.md](../retours-joueurs.md)), et la demande du propriétaire du 2026-11-05 : un vrai travail d'équilibrage sur les chiffres de la bêta (sachets par heure et par jour, tirage, XP), puis une économie plus riche, faite de systèmes qui se répondent, dans l'esprit de Brawl Stars et de Summoners War, sans faire de Leximon un gacha.
- **Données :** tableau de bord et page Mesure de l'admin, liste des testeurs, relevés le 2026-11-05, soit 10 jours de bêta ouverte depuis Reddit et FrenchTech. Aucun nom ni adresse n'est repris ici.
- **Règles liées :** N1, N2, P10, P11, P23, P29, P37, P48, P58, P72, P81, P84 à P91 ([regles-du-jeu.md](../regles-du-jeu.md)).
- **Cahiers liés :** [retours-game-designer.md](retours-game-designer.md) (phases 4 à 6, déjà tranchées), [joutes.md](joutes.md), [defis-entrainement.md](defis-entrainement.md).
- **Études :** [rnd/doublons.md](../rnd/doublons.md), [rnd/level-sim.md](../rnd/level-sim.md), [rnd/collection-sim.md](../rnd/collection-sim.md). Relevé reproductible : `pnpm economy:snapshot:prod`.

## Choix du propriétaire

- **2026-11-05 · E1 à E8 et E10 : a.**
- **2026-11-05 · E9 : un pointage permanent,** pas seulement la semaine de bienvenue, « au moins une fois par mois ». Un carnet de 28 cases par période de 4 semaines, calé sur les saisons, une case par jour joué, prend le relais de la semaine de bienvenue (P95). La série reste à côté. Le carnet se construit avec les missions (étape 4 de E10), une fois les écus en place.

## Où en sont les retours du game designer

La plupart ont déjà une réponse. Ce cahier ne les rouvre pas.

| Retour | État |
|---|---|
| Connexion, ordre du récapitulatif, bouton son, « Voir mes cartes » | Fait (phase 0) |
| Album : barre de lettres, recherche, défilement par lettre | Fait le 2026-11-03 |
| Direction artistique ancienne | Fait : « La Bibliothèque » (D-056) |
| Défis : ce qu'on gagne, sachet gagné à ouvrir, « Tes mots par palier » | Refait avec la page Défis (P81) |
| Doublons qui ne valent rien | Écus, recyclage et mot manquant construits le 2026-11-05 (P84 à P86) ; tampons tranchés, pas construits (P87) |
| Pointage sans punition | Tranché : la série qui pardonne et le total des jours joués (P88), en partie construite |
| Succès, codes | Tranchés, pas construits (P89, P90) |
| Échanges seulement par code, social trop tard | Tranché, pas construit : niveau 5, doubles visibles, échanges suggérés (P59, P77) ; la liste des joueurs existe (P83) |
| Autres mini-jeux | Énigme du jour faite, joutes tranchées (P91) |
| **Équilibrage d'ensemble et systèmes qui se répondent** | **Ce cahier** |

## Ce que disent les chiffres

Un échantillon petit, arrivé d'un coup par Reddit et FrenchTech : 275 joueurs sur la période, dont 111 comptes et environ 160 invités, et 34 comptes qui ont joué au moins 4 jours. Les tendances sont nettes, les décimales ne le sont pas.

### 1. La porte de l'invité perd la majorité des arrivants

Sur environ 160 invités, **116 s'arrêtent pile à 2 sachets**, la limite avant de devoir créer un compte (P37), et 5 seulement reviennent un autre jour. Dans l'entonnoir, 97 % ouvrent un sachet, mais 41 % seulement créent un compte. C'est la plus grosse fuite du jeu, bien avant l'économie : un invité a vu 10 cartes et n'a encore rien gagné, ni niveau, ni sachet bonus, ni carte rare à garder.

### 2. La première séance ne donne pas de rendez-vous

**44 comptes sur 111 (40 %) ne jouent qu'un jour.** Leur médiane : 8 sachets (les 2 de l'invité et le stock de 6) et le niveau 3. Ils vident le stock et partent. Le retour à J1 est de 20 % (objectif 35 %), à J7 de 7 % (objectif 12 %). Rien, à la fin de cette séance, ne dit ce qui attend le lendemain.

### 3. Ceux qui restent ouvrent beaucoup plus de sachets que prévu

| Jours joués | Comptes | Sachets par jour joué (médiane) | Réponses de défi par jour (médiane) | Niveau (médiane) |
|---|---|---|---|---|
| 1 | 44 | 8 | 5 | 3 |
| 2 | 15 | 5,5 | 2,5 | 4 |
| 3 à 4 | 30 | 9 | 5 | 7 |
| 5 à 7 | 17 | 10 | 7 | 11 |
| 8 et plus | 5 | 22 | 3 | 19 |

Les simulations supposaient un joueur régulier à 8 sachets par jour. Le joueur moyen qui revient en est proche, mais les plus assidus ouvrent **25 à 38 sachets par jour**, presque le maximum de l'horloge (48 par jour, plus les bonus). Les 10 plus gros joueurs ont ouvert 44 % des sachets des comptes. Ils atteignent le niveau 19 à 23 en 6 à 10 jours, deux fois plus vite que le rythme visé (niveau 20 en deux semaines) ; le joueur médian, lui, est dans le rythme (niveau 11 vers le 6e jour).

C'est la source des deux retours opposés : « trop de sachets, on n'a pas le temps de digérer les mots » et « au bout de 20 minutes, plus rien à faire ». **Le sachet est presque le seul geste qui rapporte, et il dépend d'une horloge.** Qui veut jouer plus n'a qu'une chose à faire : revenir ouvrir plus souvent.

### 4. Deux façons de jouer, qui ne se répondent pas

Parmi les 34 comptes de 4 jours et plus, 8 sont des **collectionneurs** (moins d'une réponse de défi pour trois sachets : jusqu'à 30 sachets par jour et 3 réponses) et 13 des **apprenants** (au moins une réponse par sachet, jusqu'à 107 réponses par jour). Le collectionneur ne gagne presque rien à réviser, en dehors du sachet du défi du jour. L'apprenant ne gagne pas de carte en révisant beaucoup. Chaque système vit de son côté, ce que le game designer avait vu (constat 3).

### 5. Le reste

- **Les échanges marchent pour ceux qui y arrivent :** 40 échanges conclus en 7 jours, 14 joueurs, soit 5 % des arrivants mais environ 40 % des joueurs installés.
- **Les 35–49 ans restent le mieux :** 24 % à J7, contre 7 % chez les 25–34 ans (P71 vise d'abord les 18–30 ans). À garder en tête pour la stratégie, hors de ce cahier.
- **Le contenu s'use vite chez les plus assidus :** à 25 sachets par jour, un joueur tire 125 cartes par jour ; une collection de 300 cartes tous les 28 jours (P56) ne le tiendra pas longtemps. Les écus et le mot manquant accélèrent encore la fin de collection (rnd/doublons).

## L'avis du game designer

**Trois chantiers, dans cet ordre de gain :**

1. **L'entrée** (constats 1 et 2) : c'est elle qui fera ou non les 35 % à J1. Un invité qui ouvre un stock entier et une première séance qui finit sur « Demain : un sachet garni » valent plus que n'importe quelle monnaie.
2. **L'horloge** (constat 3) : moins de sachets qui tombent du ciel, plus de sachets gagnés en jouant. Le joueur qui passe trois fois par jour ne doit rien perdre ; seul celui qui revient toutes les heures pour ouvrir change de rythme, et on lui donne autre chose à faire.
3. **Les systèmes qui se répondent** (constat 4) : chaque geste du jeu doit nourrir un autre. Le collectionneur doit avoir une raison de réviser, l'apprenant une raison d'ouvrir.

**Ce que je prends à Brawl Stars et à Summoners War :**

- **Des missions du jour qui changent chaque jour** et font toucher à tout le jeu (Brawl Stars). Ce sont elles qui relient les systèmes.
- **Un parcours de saison gratuit,** où chaque partie fait avancer d'un cran (le Brawl Pass). Chez nous, une saison dure 4 semaines, le rythme prévu des nouvelles collections : chaque saison a sa collection.
- **Un cadeau de bienvenue sur les premiers jours,** compté en jours joués et pas en jours d'affilée (le calendrier de connexion de Summoners War, sans la rupture).
- **Une seule monnaie qui circule partout** (les écus, déjà tranchés), avec beaucoup de petites sources et quelques grandes dépenses.

**Ce que je laisse :** l'énergie qui empêche de jouer, une deuxième monnaie, la voie payante qui donne des sachets ou de la puissance (N1, P72), l'invocation au hasard avec une monnaie, la récompense qui disparaît si on ne revient pas, le compte à rebours qui presse. Leximon garde un seul tirage au hasard : le sachet.

## La carte des systèmes proposée

Chaque ligne nourrit une autre. Les lignes en gras sont nouvelles.

| Système | Rythme | Ce qu'il demande | Ce qu'il donne | Ce qu'il nourrit |
|---|---|---|---|---|
| Horloge des sachets | Toutes les heures | Revenir | Sachets | Album, doubles, XP |
| **Semaine de bienvenue** | 7 jours joués, une fois | Revenir | Sachets, sachets garnis, un avatar | Le rendez-vous du lendemain |
| Défi du jour | Jour | 5 questions, 3 justes | Un sachet bonus | Album |
| **Missions du jour** | Jour, 3 missions | Toucher à tout : ouvrir, réviser, écrire un mot, énigme, joute, échange | XP, écus, et un sachet bonus pour les trois | Tous les systèmes |
| Énigme du jour | Jour | Trouver le mot | XP, la carte | Album |
| Joutes | À volonté, récompensées 5 fois par jour | Un deck, ses mots | XP, sachet de la première victoire, cote | Collection et maîtrise |
| Recyclage | Après chaque ouverture | Ses doubles | Écus | Mot manquant, cosmétiques |
| Mot manquant | À volonté | Des écus | Un mot qui manque | Fin de collection |
| **Saison (l'almanach)** | 4 semaines | Points de saison gagnés partout | Sachets, garnis, écus, cosmétique de saison | La nouvelle collection |
| Objectif du clan | Semaine | Bonnes réponses ensemble | Sachets bonus | Le social |
| Série et jours joués | Toujours | Revenir, sans punition | Écus aux paliers | Le pointage |
| Niveau, succès, tampons, cote | Long terme | Tout | Titres, cadres, avatars, places | L'identité |

## Questions au propriétaire

Chaque question a une recommandation, en premier. Les chiffres sont des valeurs de départ, à recaler sur le relevé 4 semaines après la mise en ligne.

**E1 · La porte de l'invité.** Aujourd'hui, 2 sachets puis un compte (P37).
- a. **(recommandé)** L'invité ouvre un stock entier (6 sachets), répond à son premier défi et voit son premier sachet bonus. Le compte est demandé pour **garder** sa partie et pour continuer : « Crée un compte pour garder tes 30 cartes. » Il a alors quelque chose à perdre, et il a vu les deux moitiés du jeu.
- b. 4 sachets.
- c. Statu quo, 2 sachets.

**E2 · Le rendez-vous du lendemain : la semaine de bienvenue.**
- a. **(recommandé)** Un carnet de 7 cases, une par jour joué, sans obligation de jours d'affilée et sans rien perdre si on saute un jour. Jour 1 : 2 sachets bonus. Jour 2 : un sachet garni (une carte Rare ou mieux). Jour 3 : 2 sachets bonus. Jour 4 : un avatar gravé réservé à la semaine. Jour 5 : un sachet garni. Jour 6 : 2 sachets bonus. Jour 7 : un sachet garni Précieux (une carte Précieuse ou mieux) et un titre. La fin de chaque séance dit ce qui attend demain, et l'e-mail « Sachets pleins » du lendemain aussi (P80). Les joueurs actuels la reçoivent depuis le début.
- b. Seulement le jour 2 : un sachet garni qui attend le joueur.
- c. Rien de plus que la série (P88).

**E3 · L'horloge des sachets.** Aujourd'hui, un sachet toutes les 30 minutes, 6 en stock (P10).
- a. **(recommandé)** Un sachet par heure, 8 en stock. Le joueur qui passe le matin, le midi et le soir garde à peu près ce qu'il a aujourd'hui (8, 5 puis 6 sachets, contre 6, 6 et 6). Celui qui passe toutes les heures descend d'environ 35 à 24 sachets par jour, et retrouve une partie de la différence en jouant (missions, défi, joutes). Nouvelle période datée : le stock déjà accumulé est gardé, et on le dit aux testeurs avant.
- b. Un sachet toutes les 45 minutes, 6 en stock : un ralentissement plus doux, qui touche aussi un peu le joueur occasionnel.
- c. Statu quo : 30 minutes, 6 en stock.

**E4 · Les missions du jour.**
- a. **(recommandé)** Trois missions par jour (heure de Paris), tirées dans une liste pour que chaque jour change et que deux missions sur trois sortent du geste préféré du joueur : ouvrir 3 sachets, écrire juste 2 mots, trouver l'énigme, réviser un mot d'une collection donnée, conclure un échange, jouer une joute, recycler ses doubles… Une mission rapporte 30 XP (et 10 écus quand ils existeront). Les trois faites rapportent un sachet bonus (réserve P23). Une mission impossible pour le joueur (joute avant le niveau 8, échange avant le 5) n'est jamais tirée. Le joueur peut changer une mission par jour.
- b. Les trois mêmes missions chaque jour. Plus simple, vite lassant.
- c. Pas de missions : le défi du jour reste le seul objectif.

**E5 · La saison.**
- a. **(recommandé)** Une saison de 4 semaines, calée sur la sortie d'une collection et à son nom (nom de travail : l'almanach). 30 paliers gratuits, avancés par des points gagnés partout : défi du jour, missions, énigme, joutes, mots écrits justes. Récompenses connues d'avance : sachets bonus, sachets garnis de la collection de la saison, écus, et un cosmétique de saison au dernier palier. Le joueur régulier finit la saison en 3 semaines environ ; celui qui joue un jour sur deux en atteint les deux tiers. Ce qui n'est pas réclamé à la fin d'une saison se réclame encore, rien ne se perd. À construire après les écus.
- b. Un coffre de la semaine (15 missions faites, un sachet garni) à la place de la saison. Moins de travail, moins de souffle.
- c. Une saison avec, en plus, une voie payante de cosmétiques seulement (N2 permet un contenu connu d'avance). Elle ferait concurrence à l'abonnement Mécène (P73) : à rediscuter avec la stratégie commerciale, pas maintenant.

**E6 · Les écus.** Gains et prix tranchés le 2026-11-01 (P84 à P86), calculés pour un joueur à 8 sachets par jour.
- a. **(recommandé)** On garde le barème × 8 et on construit les écus en premier chantier de l'économie. Avec E3 a, le plus assidu gagne environ 100 écus par jour (une Légendaire manquante en un peu plus de deux semaines), le joueur régulier 30 à 40. Les nouvelles sources (missions, saison) restent petites : 10 écus par mission, quelques dizaines par palier de saison. On recale après 4 semaines.
- b. Prix doublés (× 16) dès le départ, par prudence pour les assidus. L'occasionnel n'achèterait presque plus rien.
- c. On attend la fin des réglages E1 à E5 avant de construire les écus.

**E7 · Le rythme des niveaux.** Le joueur médian est dans le rythme visé, les plus assidus vont deux fois plus vite.
- a. **(recommandé)** On ne touche pas à la courbe : E3 ralentit les plus assidus, et l'XP des missions compense pour les autres. On relance la simulation de niveau (rnd/level-sim) avec les profils réels de la bêta. *Simulation faite le 2026-11-05 ([level-sim](../rnd/level-sim.md#complément-du-2026-11-05--les-profils-réels-de-la-bêta)) : le joueur médian tient le rythme visé, mais E3 ne ralentit presque pas les niveaux des plus assidus (niveau 50 en 57 jours au lieu de 55) ; son effet porte sur les sachets, pas sur l'XP.*
- b. Une courbe plus raide au-delà du niveau 15.
- c. Un plafond d'XP par jour sur les sachets.

**E8 · Les récompenses au hasard.** Brawl Stars donne des récompenses-surprises à paliers de rareté (Starr Drops).
- a. **(recommandé)** Non : en dehors du sachet, chaque récompense est connue avant d'être gagnée. Le sachet est déjà la surprise du jeu, et une récompense dite d'avance donne envie de la gagner (retour du game designer sur le défi).
- b. Un coffre-surprise en fin de mission, à paliers de rareté. Gratuit donc permis (N1), mais une couche de hasard de plus, et un sujet de plus pour la classification PEGI.

**E9 · Le pointage.**
- a. **(recommandé)** La semaine de bienvenue pour les nouveaux, puis les points de saison et la série telle qu'elle est (P88, sans punition, total des jours joués d'abord). Pas de calendrier de connexion à part : il ferait doublon avec la série.
- b. En plus, un calendrier mensuel de 28 cases, une par jour joué.
- c. Le calendrier mensuel à la place de la série.

**E10 · L'ordre de construction.**
- a. **(recommandé)**
  1. Les réglages E1 et E3 (deux valeurs de `rules.ts` et leurs textes), cette semaine ;
  2. la semaine de bienvenue ;
  3. les écus, le recyclage et le mot manquant (P84 à P86) ;
  4. les missions du jour et le carnet de pointage ;
  5. les joutes, lot 1 ;
  6. la saison.

  Les trois premiers visent J1 et J7, la condition de l'ouverture publique.
- b. Les joutes d'abord, puis l'économie.
- c. Toute l'économie d'un bloc, puis les joutes.

## Ce qu'on mesure ensuite

Le relevé (`pnpm economy:snapshot:prod`) se relance chaque semaine. On regarde :

| Mesure | Aujourd'hui | Cible |
|---|---|---|
| Invités qui créent un compte | 41 % | 60 % |
| Retour à J1 | 20 % | 35 % |
| Retour à J7 | 7 % | 12 % |
| Comptes qui ne jouent qu'un jour | 40 % | moins de 25 % |
| Sachets par jour joué, joueurs de 4 jours et plus (médiane) | 12 | 12 à 20 |
| Sachets par jour joué, les plus assidus | 25 à 38 | 25 au plus |
| Part des sachets gagnés en jouant (défi, missions, joutes, saison) | à mesurer | 30 % |
| Comptes de 4 jours et plus qui répondent à 5 questions par jour joué en moyenne | 74 % | 80 % |

## Ce qui change dans les règles, une fois tranché

- **P37** (E1), **P10** (E3) : nouvelles périodes datées, dans `rules.ts` en même temps.
- **Nouvelles règles :** semaine de bienvenue (E2), missions du jour (E4), saison (E5).
- **P84** : les missions et la saison deviennent des sources d'écus (E4, E5, E6).
- **P48** : l'XP des missions (E4).
- **`docs/voix.md`** : les mots « mission » et « saison » (ou son nom) entrent au lexique.

## Ce qui change dans le code, en bref

- **E1 et E3 :** deux périodes dans `GUEST_SCHEDULE` et `REFILL_SCHEDULE`, des textes dans `packages/view-model`, et la simulation de niveau relancée.
- **Semaine, missions, saison :** des règles pures dans `packages/core` (tirage des missions par le générateur cryptographique, avancement, récompenses), une table par système, l'avancement écrit dans la transaction de chaque action avec la ligne du joueur verrouillée, comme l'XP aujourd'hui. Récompenses réclamées comme les coffrets. Aucune tâche planifiée : le jour, la semaine et la saison se calculent à la volée, comme le stock.
- **Web et mobile ensemble**, chaque lot.

## Risques

| Risque | Réponse |
|---|---|
| Les plus assidus vivent E3 comme une punition | Le dire avant, garder leur stock, et leur donner les missions et la saison dans la même mise en ligne ou juste après |
| Trop de systèmes pour un nouveau joueur | Chaque système s'ouvre quand il sert : missions au niveau 2, saison au niveau 3, joutes au 8. La semaine de bienvenue reste seule les premiers jours |
| Les sachets bonus débordent la réserve (10 places) | Le coffret attend sans rien perdre (P58) ; la réserve grandit avec les niveaux |
| Le contenu s'épuise chez les assidus | Une saison égale une collection : la cadence de P56 devient la cadence du jeu. Surveiller la part de cartes neuves par sachet dans le relevé |
| Trop de travail pour 10 à 20 heures par semaine | E10 commence par deux réglages ; chaque lot se met en ligne seul |
| L'échantillon est petit et biaisé par Reddit | Recaler tout chiffre au relevé de 4 semaines après la mise en ligne, avant d'en figer un |
