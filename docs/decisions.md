# Décisions techniques

Une section par décision. Statuts possibles : **Acceptée**, **R&D en cours**, **Remplacée par D-xxx**.
Pour ajouter ou modifier une décision, utiliser le skill `decision`.

## D-001 · Monorepo : pnpm + Turborepo

- **Statut :** Acceptée (2026-10-18)
- **Choix :** workspaces pnpm, orchestration et cache de build par Turborepo.
- **Pourquoi :** standard des monorepos TypeScript avec Expo, configuration minimale.
- **Conséquences :** un seul `pnpm install` à la racine. Chaque app et chaque package expose ses scripts (`build`, `dev`, `test`, `lint`) à Turborepo.

## D-002 · Web : Next.js, interface propre au web

- **Statut :** Acceptée (2026-10-18)
- **Choix :** Next.js pour l'app web et les pages publiques (accueil, pages de partage de cartes).
- **Pourquoi :** le web est le canal d'acquisition (liens de stream, réseaux) : premier chargement rapide, référencement, images de partage.
- **Conséquences :** le web et le mobile partagent `packages/core`, `packages/contract` et `packages/tokens`, pas les composants d'interface.

## D-003 · Mobile : Expo

- **Statut :** Acceptée (2026-10-18)
- **Choix :** Expo (React Native) avec Expo Router. Builds et publication par EAS.
- **Pourquoi :** une base TypeScript commune avec le reste, des mises à jour à chaud sans repasser par les stores, et l'accès aux notifications push.
- **Conséquences :** les effets graphiques mobiles dépendent du résultat de la R&D D-009.

## D-004 · API : Hono + Drizzle + Postgres, sans état

- **Statut :** Acceptée (2026-10-18)
- **Choix :** API TypeScript sur mesure avec Hono, accès aux données par Drizzle, Postgres comme source de vérité. L'API ne garde aucun état en mémoire entre deux requêtes.
- **Pourquoi :** contrôle total des chemins critiques (tirage, échanges), portabilité entre hébergeurs, montée en charge horizontale.
- **Conséquences :** l'état vit dans Postgres, la file de tâches ou un service temps réel dédié. Les règles du jeu vivent dans `packages/core`, pas dans les routes.

## D-005 · Hébergement : Cloudflare + Postgres managé en UE

- **Statut :** Acceptée (2026-10-18)
- **Choix :**
  - Cloudflare Workers pour l'API ;
  - R2 et le CDN pour le catalogue et les gravures ;
  - Queues pour les tâches de fond ;
  - Postgres managé en région UE, via Hyperdrive. Fournisseur à choisir : Neon, Supabase ou Scaleway.
- **Pourquoi :** montée en charge instantanée pendant les pics, coût faible, données hébergées dans l'UE.
- **Conséquences :** le code de l'API doit rester compatible avec Workers (pas d'API Node spécifique sans `nodejs_compat`). Si le GAR impose un hébergement français, l'API Hono peut passer dans un conteneur sans réécriture.

## D-006 · Comptes : Better Auth, hébergé chez nous

- **Statut :** Acceptée (2026-10-18). Le lien magique est remplacé par un code par e-mail (D-030).
- **Choix :** Better Auth avec :
  - compte invité (on joue avant de s'inscrire) ;
  - lien magique par e-mail ;
  - connexion Apple et Google ;
  - intégration Expo.
- **Pourquoi :** gratuit quel que soit le volume, données chez nous, compte invité indispensable pour les joueurs qui arrivent d'un lien de stream.
- **Conséquences :** les tables de comptes vivent dans notre Postgres. La connexion par le GAR pour les écoles viendra plus tard.

## D-007 · Temps réel : échanges asynchrones, R&D WebSockets en parallèle

- **Statut :** Acceptée pour le MVP · R&D en cours pour la suite
- **Choix MVP :** les échanges sont asynchrones. Une offre est créée, l'autre joueur reçoit une notification push, l'app se rafraîchit à l'ouverture. Pas de WebSockets au lancement.
- **R&D :** trouver une solution WebSockets qui tient les pics (40 000 connectés), pour les duels et peut-être les échanges en direct. Pistes : Durable Objects, service dédié. Rapport attendu dans `docs/rnd/` (skill `spike`).
- **Discussion de clan (ajout du 2026-10-20) :** évaluer aussi le temps réel pour la discussion des clans, hors du chemin critique : un Durable Object par clan avec hibernation des connexions, coût, tenue des pics, repli par interrogation périodique. Besoin décrit dans [progression-et-social.md](cahiers-des-charges/progression-et-social.md).
- **Discussion de clan, v1 (2026-10-21, choix du propriétaire) :** sans attendre la R&D, l'écran ouvert interroge l'API toutes les quelques secondes avec un curseur ([interface-v1.md](cahiers-des-charges/interface-v1.md), K-06). Le temps réel pourra le remplacer sans changer le stockage.
- **Pourquoi :** le temps réel est ce qui a fait laguer WikiMasters au pic. On le garde hors du chemin critique tant qu'il n'est pas prouvé.

## D-008 · Outil éditorial : Directus

- **Statut :** Acceptée (2026-10-18)
- **Choix :** Directus auto-hébergé, branché sur un schéma « contenu » de Postgres, pour relire et valider les cartes.
- **Pourquoi :** une interface de validation prête à l'emploi, sans synchronisation à écrire.
- **Conséquences :** séparer le schéma « contenu » (édité dans Directus) du schéma « jeu » (écrit par l'API). Le catalogue publié sur le CDN est produit à partir du contenu validé.

## D-009 · Animations et effets de cartes : à benchmarker

- **Statut :** R&D en cours
- **Question :** avec quelle technologie faire l'ouverture des boosters (sceau de cire) et les reflets de dorure et d'enluminure, sur le web et sur le mobile ?
- **Candidats :** Rive, Lottie, shaders (Skia sur mobile, WebGL sur web), animations en code (CSS, Reanimated).
- **Critères :**
  - rendu ;
  - fluidité sur un téléphone d'entrée de gamme ;
  - poids au premier chargement web ;
  - un seul fichier pour web et mobile ou non ;
  - confort pour un designer.
- **Rapport attendu :** dans `docs/rnd/` (skill `spike`).

## D-010 · Chaîne de contenu : Python, exécutée en local

- **Statut :** Acceptée (2026-10-18)
- **Choix :** Python dans `content/pipeline/`. La chaîne tourne sur le PC ou le NAS du propriétaire, pas dans le cloud.
- **Ce qu'elle fait :**
  - extraction des dictionnaires du domaine public ;
  - fréquences Ngram et Lexique, score de rareté ;
  - traitement des gravures ;
  - publication versionnée du catalogue.
- **Pourquoi :** traitements lourds et ponctuels (fichiers Ngram de plusieurs gigaoctets), un outillage data riche, aucun coût cloud.
- **Conséquences :**
  - les données brutes restent hors du repo (`content/pipeline/data/` est ignoré par git) ;
  - le contrat entre la chaîne et l'API est le format de publication du catalogue, à définir avec le schéma de `cards`.

## D-011 · Lint et formatage : Biome

- **Statut :** Acceptée (2026-10-19)
- **Choix :** Biome pour le lint et le formatage de tout le TypeScript du monorepo, configuré une fois à la racine.
- **Pourquoi :** un seul outil, très rapide, configuration minimale.
- **Conséquences :** pas d'ESLint ni de Prettier. Les quelques règles propres à Next.js ou Expo absentes de Biome sont acceptées comme manque.

## D-012 · Runtime : Node 24 LTS

- **Statut :** Acceptée (2026-10-19)
- **Choix :** Node 24 LTS pour le développement, la CI et les outils. Version épinglée dans `.nvmrc` et le champ `engines`.
- **Pourquoi :** LTS active, supportée jusqu'en 2028.
- **Conséquences :** l'API s'exécute sur Cloudflare Workers (D-005), pas sur Node : le code de l'API reste compatible avec les deux.

## D-013 · Commits : Conventional Commits

- **Statut :** Acceptée (2026-10-19)
- **Choix :** messages au format Conventional Commits (`feat:`, `fix:`, `chore:`…), vérifiés automatiquement.
- **Pourquoi :** historique lisible, changelog générable plus tard.
- **Conséquences :** un hook de commit refuse les messages non conformes.

## D-014 · Tests : Vitest, Postgres réel pour l'intégration

- **Statut :** Acceptée (2026-10-19)
- **Choix :** Vitest pour les tests unitaires et d'intégration. Les tests d'intégration tournent contre un vrai Postgres (Docker en local, service Postgres en CI).
- **Pourquoi :** rapide, natif TypeScript. Simuler la base cacherait les problèmes de transactions et de verrous des chemins critiques.
- **Conséquences :** `docker compose up` est un prérequis pour les tests d'intégration en local.

## D-015 · Hébergement du web : Cloudflare via OpenNext

- **Statut :** Acceptée (2026-10-19)
- **Choix :** l'app Next.js est déployée sur Cloudflare Workers avec l'adaptateur OpenNext (`@opennextjs/cloudflare`).
- **Pourquoi :** tout chez le même hébergeur que l'API (D-005) : un seul compte, un seul CDN, des coûts qui suivent l'usage.
- **Conséquences :** les fonctionnalités Next.js utilisées doivent être prises en charge par OpenNext. Vérifier la compatibilité avant d'adopter une fonctionnalité récente, et monter la version de Next.js seulement quand OpenNext la suit.

## D-016 · Pilote Postgres : node-postgres

- **Statut :** Acceptée (2026-10-19)
- **Choix :** `pg` (node-postgres) avec Drizzle, à la place de postgres-js, pour l'API comme pour l'outillage de test.
- **Pourquoi :** chaque requête HTTP ouvre sa propre connexion. Sur une connexion neuve, postgres-js fait deux allers-retours par requête paramétrée, node-postgres un seul. Mesuré à 40 ms par aller-retour : 20 allers-retours par ouverture de booster avec postgres-js, 13 avec node-postgres à requêtes identiques.
- **Conséquences :** `db.execute` renvoie `{ rows }`. Le nombre de requêtes par ouverture est verrouillé par un test (5, BEGIN et COMMIT compris).

## D-017 · Journal des tirages partitionné, idempotence séparée

- **Statut :** Acceptée (2026-10-19)
- **Choix :**
  - `booster_opens` est partitionné par mois sur `opened_at`, avec une partition par défaut en filet de sécurité ;
  - les clés d'idempotence vivent dans `booster_open_requests`, purgées après 48 h ;
  - une tâche quotidienne du Worker (cron) crée les partitions à venir et purge les clés.
- **Pourquoi :** à 250 000 joueurs par jour, le journal reçoit environ 2 millions de lignes par jour. L'idempotence n'a besoin que de 48 h, l'audit de quelques mois.
- **Conséquences :** les anciens mois pourront être archivés sur R2 puis supprimés d'un bloc (à mettre en place avant que le volume le justifie). Chaque tirage enregistre sa graine et l'empreinte SHA-256 du catalogue utilisé, ce qui permet de le rejouer à l'identique.

## D-018 · Limites de débit : liaisons Cloudflare

- **Statut :** Acceptée (2026-10-19). Seuils validés par le propriétaire, à revoir avec les premières données réelles et le branchement du GAR.
- **Choix :** liaisons Rate Limiting de Cloudflare Workers, configurées dans `wrangler.jsonc`.
  - Création de compte invité : 60 par minute et par adresse IP. Seuil large, pour une classe derrière une même adresse.
  - Requêtes d'un joueur connecté : 120 par minute, comptées sur son identifiant.
  - Au-delà : réponse 429 avec `Retry-After`.
- **Pourquoi :** les compteurs vivent chez Cloudflare, l'API reste sans état. Les limites intégrées à Better Auth sont coupées, car elles comptent en mémoire.
- **Conséquences :**
  - les compteurs sont tenus par emplacement Cloudflare, pas globalement ;
  - un identifiant de namespace ne doit jamais être réutilisé pour une autre limite ;
  - les tests fournissent des liaisons factices (`test-env.ts`).

## D-019 · Chaîne de contenu : sources, rédaction assistée, relecture dans Directus

- **Statut :** Acceptée (2026-10-19). Modèle de rédaction choisi le 2026-10-19 après l'essai sur 50 mots. Relecture de chaque carte remplacée par D-021 (contrôle automatique, relecture par échantillon).
- **Choix :**
  - **Texte de référence : le Littré, via XMLittré.** Le balisage est sous CC BY-SA 3.0 ; le texte sans balisage est dans le domaine public, comme l'indique l'auteur. On n'en extrait que du texte brut.
  - **Repérage des candidats :** les catégories du Wiktionnaire (titres seulement, aucun texte repris). Étendu à tout le Littré par D-020.
  - **Rareté moderne :** Lexique 3.83. Remplacé par Google Books Ngram (D-020).
  - **Rédaction :** Claude, en sortie JSON structurée. Le modèle reformule et choisit ; la citation est choisie par numéro dans l'entrée, et l'époque est calculée depuis l'historique du Littré.
  - **Modèle :** Claude Sonnet 5.5. Une définition de plus de 25 mots est redemandée automatiquement, plus courte.
  - **Outillage :** projet Python `uv` dans `content/pipeline/`, avec Ruff et pytest, et un job CI dédié.
  - **Relecture :** Directus 12, dans une base Postgres `leximon_content` séparée de la base du jeu, démarrée par le profil Docker `content`.
- **Pourquoi :**
  - le Littré fournit dans chaque entrée tout ce qu'une carte demande, avec des citations d'auteurs du domaine public ;
  - le LLM qui ne fait que reformuler et choisir reste vérifiable automatiquement.
  - sur l'essai, Sonnet perd une étymologie sur 28 contre six pour Haiku, pour environ 36 $ les 10 000 mots : le temps de relecture coûte plus cher que l'écart de prix.
- **Conséquences :**
  - créditer « XMLittré, François Gannaz (littre.org) » dans l'app ;
  - faire valider le partage à l'identique par un juriste avant le lancement ;
  - une liste d'exclusion déterministe des injures est nécessaire : l'essai montre qu'aucun modèle ne les repère toutes, et que certains sens injurieux modernes sont absents du Littré.
  - D-008 prévoyait un schéma « contenu » : une base séparée isole mieux les tables système de Directus.

## D-020 · Rareté des cartes : fréquence Ngram et pépites

- **Statut :** Acceptée (2026-10-19). Seuils provisoires, à recalibrer sur le catalogue de lancement puis à figer. Rapport : [docs/rnd/rarete.md](rnd/rarete.md). Choix des pépites (proposées par le modèle, confirmées en relecture) remplacé par D-021 (jury automatique).
- **Choix :**
  - **Score :** fréquence Google Books Ngram (corpus français 2019), formes du mot additionnées, graphies en minuscules. Deux tiers pour 1990-2019, un tiers pour 1800-1899, en logarithme.
  - **Courant à Précieux :** seuils de score communs à tout le catalogue, en règle datée.
  - **Épique et Légendaire :** réservées aux pépites, des mots au-delà du seuil de Précieux, proposés par le modèle et confirmés en relecture. Une pépite absente de tout le corpus Ngram est Légendaire, les autres sont Épiques.
- **Pourquoi :** Ngram classe 92 % des candidats, contre 46 % pour Lexique. Au-delà de Précieux, la fréquence ne départage plus rien : Ngram ignore les mots vus moins de 40 fois.
- **Conséquences :**
  - la chaîne calcule la rareté à partir de données enregistrées (fréquence, mention pépite), jamais saisie à la main ;
  - un mot composé n'a pas de fréquence en 1-gramme : sa rareté reste à compléter jusqu'à ce qu'on interroge les 3-grammes ;
  - la composition des collections respecte la pyramide du catalogue (collection-sim.md) ;
  - créditer Google Books Ngram (CC BY 3.0) dans l'app ;
  - la sélection pioche dans tout le Littré : moins de 500 occurrences par milliard à l'écrit (Ngram) et de 0,5 par million à l'oral (sous-titres de Lexique), sans termes de science ni dérivés transparents. Les catégories du Wiktionnaire ne servent plus qu'aux thèmes ;
  - une liste d'exclusion des injures (`exclusions.py`) écarte les mots dès la sélection et fait échouer un contrôle automatique.

## D-021 · Contrôle du contenu : décisions automatiques, relecture par échantillon

- **Statut :** Acceptée (2026-10-19), à la demande du propriétaire. Mesures sur lot-1 (300 mots).
- **Choix :**
  - **Rejet :** un brouillon dont l'avis du rédacteur (`suitability`) n'est pas « ok » n'arrive jamais dans Directus (122 sur 300).
  - **Pré-tri :** Claude Haiku 5.5 prédit cet avis sur un extrait du Littré, et seuls les mots retenus sont rédigés. Accord avec Sonnet : précision 85 %, rappel 78 %.
  - **Fidélité :** Claude Opus 5.5 compare chaque carte à son entrée. Un sens, une date ou une étymologie contredits ou inventés signalent la carte. Un ajout exact, bien établi mais absent de l'entrée, est noté sans la signaler.
  - **Correction :** une carte signalée repart une fois chez le rédacteur avec les problèmes relevés, puis Opus la vérifie de nouveau. Sur lot-1, les 28 cartes signalées sont devenues fidèles.
  - **Pépites :** Opus note le charme des mots éligibles, par lots de six et deux fois chacun, sans voir l'avis du rédacteur. Les meilleures notes deviennent pépites : au plus 2 % du lot parmi les mots absents de Ngram (Légendaires), au plus 6 % parmi les autres (Épiques), et jamais sous 6 sur 10, même si le quota n'est pas atteint. Les notes sont enregistrées, la rareté reste calculée (D-020).
  - **Relecture :** environ 5 % des cartes non signalées tirées au hasard, plus chaque Légendaire et chaque carte encore signalée après correction. Le contrôle de copie du Littré devient informatif.
- **Pourquoi :**
  - le propriétaire ne peut ni juger les pépites ni relire chaque carte ;
  - un second modèle, différent du rédacteur, voit ce que le rédacteur ne voit pas : il signale 28 cartes sur 178, surtout des détails ajoutés à la définition ;
  - une note minimale évite des Légendaires ternes : sans elle, le quota de lot-1 prenait deux mots notés 4,5 ;
  - la consigne de rédaction reste inchangée : interdire tout détail absent de l'entrée divisait les cartes signalées par deux et demi sur 40 mots (5 → 2), mais faisait écarter plus de mots (2 → 7, surtout « sens_incertain »). La correction suffit.
- **Conséquences :**
  - environ 14,5 $ pour 1 000 cartes gardées avec le pré-tri (rédaction 4,7 $, vérification 8 $, correction 0,7 $, jury 0,9 $, pré-tri 0,07 $), 16,5 $ sans ;
  - sur lot-1, 18 cartes sur 178 sont à relire (10 %) : 9 au hasard, 5 contrôles mécaniques, 4 Légendaires ;
  - un lot où les mots charmants manquent a moins de pépites que la pyramide : la sélection doit alors fournir plus de mots rares ;
  - une erreur trouvée dans l'échantillon fait corriger la chaîne (consignes, seuils), pas seulement la carte ;
  - une étape estimée à plus de 3 $ attend l'accord du propriétaire (`--yes`).

## D-022 · Direction artistique : « Planche populaire »

- **Statut :** Acceptée (2026-10-19), choisie par le propriétaire parmi quatre maquettes (Planche, Enluminure, Imprimerie, et la fusion des deux premières retenues).
- **Choix :** la chaleur de la planche d'encyclopédie (papier crème, gravure en hachures, pli kraft scellé à la cire) avec l'énergie de l'imprimerie (gros mot, aplats de couleur vive, rareté lisible par pastilles). Coins arrondis, boutons en pilule, tutoiement. Polices : Fraunces (le mot, les titres), Bricolage Grotesque (l'interface), Newsreader (définition et citation), toutes sous licence OFL. Rareté : crème, vert, tomate, cobalt, puis carte de nuit à cadre doré (Épique) ou irisé (Légendaire).
- **Pourquoi :** le propriétaire veut un jeu grand public, pas « bourgeois » : l'ancien vient des gravures et du papier, pas d'une typographie précieuse.
- **Conséquences :**
  - couleurs, polices, rayons et espacements vivent dans `packages/tokens`, seule source pour le web et le mobile ;
  - la carte garde la même composition sur toutes les plateformes, même si les composants sont propres à chacune (D-002) ;
  - les reflets doré et irisé et l'animation du sceau restent en CSS simple tant que la R&D D-009 n'a pas conclu.
  - le 2026-10-21, le propriétaire a choisi, sur des essais comparés, un papier vergé (vergeures fines et pontuseaux espacés, dans le ton de l'encre) et un double filet dans la couleur du cadre ; le fond du site passe des petits points à un grain fin sur halo.
  - le même jour, le dos des cartes devient une marque d'imprimeur (un « L » dans un anneau qui porte la devise « Mots rares · Mots anciens ») sur un papier dominoté, avec le double filet de la face et une tranche plus fine qui trahit toujours la rareté. Sa teinte suit la collection du pli (`back` dans `content/collections.toml`, `backTones` dans `@leximon/tokens`) : nuit pour Les Fondateurs, bordeaux pour Caractères et travers, vert bouteille pour Métiers et objets disparus. Une teinte inconnue d'un client ancien s'affiche en nuit.

## D-023 · Publication du catalogue : manifeste et un fichier par collection

- **Statut :** Acceptée (2026-10-19)
- **Choix :**
  - **Format :** un `manifest.json` liste les collections publiées. Chaque collection est un fichier JSON nommé d'après l'empreinte de son contenu (`collections/<id>.<empreinte>.json`), donc immuable. Le schéma Zod vit dans `packages/contract` (`catalog.ts`).
  - **Production :** la commande `release` de la chaîne Python écrit une version dans `content/releases/<version>/`, versionnée dans git, à partir des cartes publiables de Directus et des collections définies dans `content/collections.toml`.
  - **Publication :** `pnpm catalog:publish` valide la version avec le schéma, met à jour les tables `collections` et `cards`, puis copie les fichiers vers leur destination.
- **Pourquoi :** une collection se télécharge seule (environ 75 Ko compressés pour 500 cartes), un fichier publié ne change jamais et se met en cache sans limite, et le manifeste est le seul fichier à cache court.
- **Conséquences :**
  - une carte est publiable si sa relecture l'accepte (« OK », « Retouche ») ou si elle n'était pas à relire ; les cartes encore à relire attendent ;
  - une carte publiée garde son identifiant et sa rareté pour toujours (D-020). Une carte retirée d'une version quitte les boosters, les exemplaires possédés restent ;
  - en local, les fichiers vont dans `apps/web/public/catalog/`. La copie vers R2 sera ajoutée avec l'hébergement de production (D-005) ;
  - le catalogue de démo et le seed de dev des cartes disparaissent : le jeu local lit la dernière version publiée.
  - les scripts TypeScript de `packages/db` tournent avec Node 24 directement (suppression des types), aidé d'un petit crochet de résolution (`packages/config/node/resolve-ts.mjs`) qui retrouve les imports sans extension. Aucune dépendance ajoutée.

## D-024 · Collections de lancement : trois collections thématiques, domaine tiré du pré-tri

- **Statut :** Acceptée (2026-10-20), choisie par le propriétaire, avec un budget de génération de 25 $ au plus.
- **Choix :** trois collections d'environ 500 cartes : « Les Fondateurs » (généraliste, complétée à partir de lot-1), « Caractères et travers » (mœurs, défauts, moqueries et injures d'antan) et « Métiers et objets disparus ». Le pré-tri Haiku (D-021) donne aussi le domaine du sens principal de chaque mot (`caractere`, `metiers_objets`, `nature`, `table`, `autre`). Dans `content/collections.toml`, chaque collection liste les domaines où ses nouvelles séries puisent ; Les Fondateurs prend `nature`, `table` et `autre`.
- **Pourquoi :** des collections à l'identité claire se racontent et se partagent mieux qu'une suite de lots ; étiqueter le domaine au pré-tri ne coûte presque rien (environ 0,03 $ pour 1 000 mots).
- **Conséquences :**
  - tout le vivier (environ 28 000 mots) est pré-trié une fois, pour moins de 1 $ ;
  - `select --run <série>` ne retient, pour une collection à domaines, que des mots pré-triés de ces domaines ;
  - une série déclarée dans `collections.toml` doit exister dans Directus pour que `release` aboutisse.

## D-025 · Défis : révision espacée FSRS (ts-fsrs), niveau tiré de la stabilité

- **Statut :** Acceptée (2026-10-20), choisie par le propriétaire.
- **Choix :** la dépendance `ts-fsrs` (MIT, sans dépendance) planifie les révisions dans `packages/core`, sans flou aléatoire ni étapes de quelques minutes : un mot oublié revient le lendemain. Le niveau d'une carte suit la stabilité mémoire mesurée par FSRS : Encre à 7 jours, Dorure à 30 jours, sans jamais redescendre. Formats du MVP : QCM à quatre choix, « trouver la définition » ou « trouver le mot », les mauvais choix venant de la même collection. Réglages datés dans `MASTERY_SCHEDULE`.
- **Pourquoi :** FSRS est la référence actuelle de la révision espacée ; une stabilité mémoire mesurée donne un niveau qui veut dire « je connais ce mot », pas « j'ai beaucoup joué ».
- **Conséquences :**
  - avec les réglages de départ, Encre arrive à la 2e bonne réponse espacée (vers le 3e jour), Dorure à la 3e (vers le 17e jour) ;
  - API sans état : le serveur ne garde pas les questions servies. Il n'accepte une réponse que sur un mot possédé et dû, une fois par clé d'idempotence, sous verrou de la ligne `user_mastery` ;
  - les réponses ne sont pas protégées contre la triche : le catalogue est public. Sans récompense attachée, tricher ne fait monter que ses propres niveaux. Une récompense (plis bonus) demandera de revoir ce point ;
  - chaque réponse va dans `review_logs`, partitionnée par mois, pour régler FSRS plus tard et pour le mode classe.

## D-026 · Échanges : offres directes par code joueur, doublons seulement

- **Statut :** Acceptée (2026-10-20), choisie par le propriétaire.
- **Choix :** un joueur fait une offre à un autre, désigné par son code joueur public (8 caractères) : 1 à 3 cartes données contre 1 à 3 cartes voulues, un exemplaire de chaque. Seuls les doublons s'échangent ; Épiques et Légendaires attendent 7 jours après leur dernière obtention (`user_cards.last_obtained_at`) ; niveau minimum (P36) ; 10 offres envoyées par 24 h glissantes ; une offre expire après 72 h. Rien n'est réservé : l'acceptation verrouille l'offre puis les exemplaires dans un ordre fixe, revérifie tout et déplace les quantités en une transaction. Réglages datés dans `TRADE_SCHEDULE`.
- **Pourquoi :** des offres structurées sans texte libre protègent un public jeune ; les garde-fous freinent le transfert de cartes rares depuis des comptes jetables.
- **Conséquences :**
  - « expirée » n'est jamais stocké : une offre en attente dont l'échéance est passée est expirée, sans tâche planifiée ;
  - une offre qui ne peut plus être honorée échoue à l'acceptation et reste en attente jusqu'à son expiration ;
  - un échange ne touche jamais la maîtrise ;
  - pas encore de notification : elle passera par la file, avec les notifications push.

## D-027 · Plis bonus : réserve sur le portefeuille, attributions idempotentes

- **Statut :** Acceptée (2026-10-20), règles choisies par le propriétaire (P23, P29 dans `docs/regles-du-jeu.md`).
- **Choix :** la réserve de plis bonus est un compteur du portefeuille, distinct du stock gratuit calculé à la volée. Chaque attribution (défi du jour, Dorure) est une ligne d'une table d'attributions de clé (joueur, motif, jour ou carte) : elle est insérée dans la transaction de la réponse, et la réserve n'augmente que si la ligne est nouvelle. L'ouverture d'un pli puise dans la réserve seulement quand le stock gratuit est vide. Réglages datés dans `BONUS_SCHEDULE`.
- **Pourquoi :** la clé d'attribution rend impossible un double gain, même avec des réponses concurrentes ou rejouées ; une réserve séparée ne bloque jamais la recharge gratuite.
- **Conséquences :** la triche sur les réponses (catalogue public, D-025) reste possible mais plafonnée par règle : un pli par jour, un par carte dorée. Le « jour » est le jour calendaire de Paris.

## D-028 · Gravures : Wikimedia Commons filtré, choix par Sonnet, encre seule teintée à l'affichage

- **Statut :** Acceptée (2026-10-20), choisie par le propriétaire après la R&D ([docs/rnd/gravures.md](rnd/gravures.md)) et un essai de cinq rendus. Règles P42 et P43.
- **Choix :** la chaîne cherche sur Wikimedia Commons avec des requêtes écrites par Haiku et un filtre de droits strict (PD, CC0, CC BY 4.0 ; ni Gallica, ni British Museum ; auteur mort avant 1956, date cherchée sur Wikidata), puis Claude Sonnet 5.5 choisit parmi 8 vignettes par l'API Batch. Chaque choix est validé avant publication. Le traitement (Pillow et NumPy, chaîne locale seulement) produit deux WebP par carte, nommés par empreinte : l'encre avec transparence et l'aplat des masses sombres. La carte les colore par sa rareté, en masque CSS. Le champ `engraving` du catalogue est un ajout rétrocompatible.
- **Pourquoi :** Commons est la seule source libre à cette échelle sans redevance (Gallica facture 75 € par image) ; un seul fichier teintable sert aux cartes claires et de nuit, sur le web comme sur mobile (`tintColor`).
- **Conséquences :** environ 5 $ et 5 à 9 h de recherche pour tout le catalogue, Commons bridant les robots sans contact ; les fichiers binaires restent hors de git (`content/pipeline/data/gravures/`, puis R2 en production) ; les crédits CC BY 4.0 sont affichés au joueur.
- **Note (2026-10-21) :** trois tours de recherche, dont un dernier aux requêtes écrites à la main (`--round 3`) ; une image ne sert jamais deux cartes. Une carte restée sans gravure porte la lettrine ornée de son initiale, tirée des lettrines de l'édition Marty-Laveaux de Rabelais (Lemerre, 1868, domaine public), rendue comme une gravure et livrée dans le même champ `engraving` : aucun changement côté web ni mobile. L'alphabet n'a ni J, K, U, W, X, Y ; J prend I, U prend V, les autres gardent l'initiale simple.

## D-029 · Icônes de rareté : une gemme par rang, géométrie partagée dans `packages/tokens`

- **Statut :** Acceptée (2026-10-20), choisie par le propriétaire parmi trois séries puis trois icônes pour Courant. Règle P44.
- **Choix :** six gemmes de plus en plus taillées, de l'éclat brut (Courant) au soleil taillé (Légendaire), dessinées en tracés SVG sur une grille de 24 dans `packages/tokens/src/rarity-icons.ts`. Sur la carte, une pastille ronde aux couleurs de la rareté porte l'icône seule ; l'interface affiche l'icône suivie du nom (`RarityName`).
- **Pourquoi :** la silhouette seule distingue les rangs jusqu'à 10 px ; des tracés bruts se dessinent à l'identique sur le web (`<svg>`) et sur mobile (react-native-svg).
- **Conséquences :** remplace les pastilles à points de D-022. Le nom de la rareté reste le libellé accessible de la pastille. Le 2026-10-21, le soleil taillé remplace l'étoile à six branches de Légendaire, trop proche d'un symbole religieux.

## D-030 · Inscription : code par e-mail, transfert de l'invité dans notre transaction

- **Statut :** Acceptée (2026-10-20), après la R&D ([docs/rnd/inscription.md](rnd/inscription.md)). Règles P37 et P54. Fournisseur d'envoi des codes : D-034.
- **Choix :** plugin `emailOTP` de Better Auth (code à 6 chiffres) plutôt que `magicLink`, à côté de `anonymous`, Apple et Google. Le sort de l'invité (transfert vers un nouveau compte, abandon vers un compte qui joue déjà, P54) se règle dans `onLinkAccount`, dans une transaction à nous, avec `disableDeleteAnonymousUser: true` : l'invité est archivé, jamais supprimé, et chaque connexion depuis un invité est journalisée dans `guest_links`.
- **Pourquoi :** un lien ouvert sur un autre appareil, ou consommé par l'antivirus d'une messagerie, crée un compte vide et perd l'invité ; un code marche partout. Toutes les tables de jeu sont en cascade sur `users.id` : la suppression par défaut de l'invité effacerait ses cartes et l'historique des échanges des autres joueurs.
- **Conséquences :** changement additif, l'invité actuel continue de marcher. Un test liste toutes les clés étrangères vers `users.id` et échoue si l'une n'est pas traitée par le transfert. L'envoi des codes a ses propres limites de débit (D-018).

## D-031 · Administration : pages `/admin` à nous, rôle donné en ligne de commande, chaque action journalisée

- **Statut :** Acceptée (2026-10-20), plan approuvé par le propriétaire.
- **Choix :** un espace `/admin` dans le web et des routes `/admin/*` dans l'API, réservées au rôle `admin` vérifié côté serveur à chaque requête (session relue sans le cache du cookie). Le plugin `admin` de Better Auth ne sert qu'au schéma (rôle, bannissement) et au refus de connexion des bannis ; ses routes restent fermées par la liste blanche de `app.ts`. Le rôle ne se donne que par `pnpm admin:grant <email>` (`--revoke` pour le retirer). Chaque changement (plis bonus, bannissement, annulation d'échange, export de la liste d'attente) est inscrit dans `admin_actions`, dans la même transaction. Les cartes se rédigent toujours dans Directus.
- **Pourquoi :** aucune route web ne permet de devenir admin ; un geste sur un joueur suit les mêmes verrous et clés d'idempotence qu'une action de jeu, et laisse une trace.
- **Conséquences :** un admin ne peut pas être banni sans retirer d'abord son rôle. Un joueur banni garde au plus cinq minutes de session (cache du cookie). La table `admin_actions` est gardée telle quelle lors d'un transfert d'invité.

## D-032 · Prononciation : une voix de synthèse guidée par la notation phonétique du Littré

- **Statut :** Acceptée (2026-10-21).
- **Choix :** une notation phonétique par carte, tirée de la graphie prononcée du Littré par des règles, validée quand eSpeak NG concorde et relue sinon, avec le Wiktionnaire en contrôle. Une seule voix de synthèse lit chaque mot guidée par cette notation (balise SSML `phoneme`). Voix : Google Cloud Text-to-Speech, Chirp 3 HD « Charon », choisie par le propriétaire à l'écoute des 20 mots difficiles face à Azure (abandonné : ouverture du compte impossible), Kokoro et Piper. Aucun enregistrement humain (P57).
- **Pourquoi :** les enregistrements libres manquent justement sur les cartes rares (31 % des Légendaires) et changent de voix d'un mot à l'autre ; une voix guidée couvre tout le catalogue d'un son homogène (110 000 caractères, dans l'offre gratuite mensuelle de Google ; R&D `docs/rnd/prononciation.md`).
- **Conséquences :** un module de notation et de génération dans `content/pipeline`, fichiers audio statiques nommés par leur empreinte et servis par le CDN comme les gravures (D-028), champ optionnel `pronunciation` dans le catalogue. Pas de `speechSynthesis` du navigateur, même en secours.

## D-033 · Interface v1 : logique d'écran commune, affichage propre à chaque plateforme

- **Statut :** Acceptée (2026-10-21), choisie par le propriétaire contre un seul code React Native pour le web et le mobile, et contre une vue web dans l'app. Précise D-002.
- **Choix :** un package `packages/view-model`, en TypeScript pur sans React ni I/O, porte ce que les deux applications calculent de la même façon à partir des réponses de l'API : états des écrans, chemin des niveaux, verrous par niveau, déroulé d'un défi, composition d'une offre, formats et textes de l'interface. Next.js et Expo n'y ajoutent que l'affichage, les gestes et les appels réseau. Référence de l'interface : la maquette et le cahier [interface-v1.md](cahiers-des-charges/interface-v1.md).
- **Pourquoi :** le web déjà fini (reflets, ouverture au geste) reste intact, la maquette prévoit des différences voulues (panneau à droite sur le web, fiche montante sur mobile), et une règle d'écran écrite une fois s'affiche pareil partout et se teste avec Vitest.
- **Conséquences :** les règles du jeu restent dans `packages/core` (le serveur fait foi) ; `view-model` peut en importer les fonctions pures, jamais l'inverse. La logique d'écran qui vit aujourd'hui dans `apps/web` (`progress.ts`, `session.ts`, `offer.ts`, `display.ts`…) y migre quand un écran est repris. Chaque écran s'écrit deux fois, avec les mêmes textes.

## D-034 · E-mails : codes par Cloudflare Email Service, campagnes par Lettermint

- **Statut :** Acceptée (2026-10-21), choisie par le propriétaire. Cahier : [e-mails.md](cahiers-des-charges/e-mails.md).
- **Choix :** les codes de connexion partent par la liaison `send_email` de Cloudflare Email Service, depuis le Worker. Les campagnes partent par Lettermint (Pays-Bas), sur sa route de diffusion, par lots avec une clé d'idempotence par e-mail. Lettermint reste en offre gratuite (300 par mois) et ne passe à un palier payant que le mois d'un envoi de masse.
- **Pourquoi :** Scaleway et Cloudflare interdisent tous deux le marketing. Cloudflare inclut 3 000 e-mails par mois dans Workers Paid, déjà nécessaire pour Queues, sans clé ni nouveau sous-traitant, et n'impose pas de plafond par jour comme les offres gratuites de Brevo ou Mailjet, qui casseraient l'inscription pendant un stream. Lettermint est le seul candidat qui signe ses webhooks en HMAC et dédoublonne chaque e-mail d'un lot.
- **Conséquences :**
  - deux sous-domaines d'envoi, donc deux réputations : une plainte sur une campagne ne bloque jamais les connexions ;
  - Cloudflare Email Service est en bêta publique et démarre avec un quota quotidien prudent : demander une hausse avant l'ouverture ;
  - les secrets Lettermint (jeton d'envoi, secret des webhooks) vivent en variables d'environnement ; les codes n'ont besoin d'aucun secret.

## D-035 · Campagnes : file Queues alimentée chaque minute, une ligne et une clé par destinataire

- **Statut :** Acceptée (2026-10-21), choisie par le propriétaire. Règles P55 et P61.
- **Choix :** une campagne confirmée crée une ligne par destinataire (`email_campaign_sends`, unique par campagne et adresse), audience moins la liste de suppression (`email_suppressions`). Une tâche planifiée chaque minute met en file Cloudflare Queues la part de la minute, par messages de 100 identifiants ; le consommateur réserve ses lignes par une mise à jour conditionnelle, puis les envoie avec l'identifiant de la ligne pour clé d'idempotence chez Lettermint. Le consentement des joueurs vit dans `email_consents`.
- **Pourquoi :** la base reste la seule source de vérité. Un message perdu, rejoué ou en double, ou deux consommateurs qui se chevauchent, n'envoient jamais deux fois : la réservation ne réussit qu'une fois, et la clé couvre le consommateur mort entre l'envoi et l'écriture.
- **Conséquences :**
  - la tâche planifiée passe à chaque minute ; la maintenance quotidienne garde son horaire ;
  - une ligne réservée depuis plus de 15 minutes est remise en circuit, bien avant l'expiration de la clé (24 h) ;
  - une seule campagne vers la liste d'attente peut partir (index unique partiel), et son lancement ferme la liste ;
  - les adresses des lignes d'envoi sont effacées 30 jours après la fin d'une campagne.

## D-036 · Modèles d'e-mail : rendu maison, Markdown réduit, sans dépendance

- **Statut :** Acceptée (2026-10-21), choisie par le propriétaire.
- **Choix :** un gabarit en tableaux HTML et styles en ligne, plus une version texte, rendus par des fonctions pures de l'API. Le corps d'une campagne est un Markdown réduit (paragraphes, gras, italique, liens `https://`, listes, intertitres), converti par notre code ; tout le reste est échappé.
- **Pourquoi :** ni React ni MJML dans le Worker, et un contenu qui ne peut injecter ni HTML ni image.
- **Conséquences :** aucune image distante ni lien traqué (`/confidentialite` promet « pas de traceur »). Une mise en forme nouvelle s'ajoute au convertisseur, avec son test.

## D-037 · Suppression du compte : effacement en cascade, échanges gardés sans leur auteur

- **Statut :** Acceptée (2026-10-21), choisie par le propriétaire (suppression immédiate, échanges anonymes). Met en œuvre P64.
- **Choix :** `DELETE /me/account` efface la ligne `users` dans une transaction : tout ce qui appartient au joueur part en cascade, les offres en attente sont d'abord annulées, et les clés de `trades` vers le joueur passent à `null` (`ON DELETE SET NULL`), si bien que l'autre joueur garde son historique, signé « Un joueur parti ». Un compte admin, ou ancien admin présent dans le journal (D-031), est refusé.
- **Pourquoi :** une suppression demandée dans l'app est exigée par l'App Store et le RGPD ; effacer plutôt qu'archiver évite de garder des données sans raison, et le journal d'administration ne doit jamais perdre son auteur.
- **Conséquences :** `trades.proposer_id` et `trades.recipient_id` sont nullables (migration additive), et tout code qui lit un échange traite un côté absent. La page publique d'un profil est mise en cache 60 s par Next : un profil supprimé ou passé en privé peut encore s'y voir pendant ce délai.

## D-038 · Clans : une file d'événements de jeu, des compteurs recalculés depuis la base

- **Statut :** Acceptée (2026-10-22), le propriétaire a choisi de construire la file avec les clans plutôt que de tout calculer à la lecture. Règles P50, P65 à P67.
- **Choix :** une seconde file Cloudflare Queues, `leximon-game-events`. Après sa transaction, une action qui donne des cartes (pli, échange) ou change les membres d'un clan envoie un message court (`cards_obtained`, `clan_changed`). Le consommateur ne fait pas confiance au message : il recalcule depuis la base la part du joueur dans l'objectif de la semaine, le palier du clan et sa bibliothèque, et écrit le journal avec des clés uniques.
- **Pourquoi :** rien ne s'ajoute à la transaction d'un pli, à part un envoi après coup. Un message perdu, rejoué ou en double ne fausse rien : le suivant recalcule tout, et un palier ou une Légendaire n'entre qu'une fois au journal.
- **Conséquences :**
  - un envoi qui échoue ne fait jamais échouer la requête, il est journalisé ;
  - la maintenance quotidienne recalcule les clans actifs de la semaine, au cas où le dernier message se serait perdu, et efface les messages de plus de 90 jours qui ne sont pas signalés ;
  - la discussion n'a pas de temps réel : l'écran ouvert demande les messages après le dernier reçu, toutes les quelques secondes (D-007 reste ouverte) ;
  - les tests remplacent la file par une file factice et appellent le consommateur directement.

## D-039 · Courrier : des lettres écrites par la file, l'état du jeu lu à part

- **Statut :** Acceptée (2026-10-22), le propriétaire a choisi un courrier gardé, rempli par la file, avec lu et non lu, et les mentions par @pseudo dans la discussion. Règle P67.
- **Choix :** une table `mail_letters` (une ligne par lettre, clé unique par joueur et `dedupe_key`), écrite par le consommateur de `leximon-game-events` (D-038) sur trois nouveaux messages : `trade_changed`, `clan_mentions`, `clan_request`. Le consommateur relit l'offre, le message ou la demande en base et n'écrit que ce qui vaut encore. Ce qui attend dans l'état du jeu (coffrets, sachets d'objectif, mot qui s'échappe) n'est pas copié : le courrier le lit à part. Les mentions sont résolues à l'envoi du message, contre les clés de pseudo des membres, et rangées sur le message (`clan_messages.mentions`).
- **Pourquoi :** une lettre copiée de l'état mentirait dès que l'état change. Une lettre de nouvelle (offre reçue, citée par un membre) n'a pas d'état d'origine à relire, elle doit être gardée. Résoudre la mention une seule fois donne le même surlignage à tous et la même liste de destinataires au consommateur.
- **Conséquences :**
  - `GET /me/mail` (curseur sur l'id, joueurs et extraits lus au moment de la lecture) et `POST /me/mail/read` (tout jusqu'à une lettre, idempotent) ;
  - une offre qui n'attend plus rend lue la lettre de son destinataire ; un message effacé avant le passage du consommateur ne cite personne, effacé après il garde sa lettre sans son texte ;
  - pas de lettre entre deux joueurs dont l'un bloque l'autre ;
  - les lettres d'un invité suivent son jeu quand il s'inscrit, et une lettre d'offre nomme l'autre joueur tel que l'offre le donne au moment de la lecture ;
  - lettres effacées après 90 jours par la maintenance quotidienne ;
  - les notifications push (R-02) liront les mêmes lettres et les préférences de `user_preferences`.

## D-040 · Postgres de la bêta : Neon, sauvegardé chaque nuit sur le NAS

- **Statut :** Acceptée (2026-10-22), choisie par le propriétaire. Complète D-005 (fournisseur). R&D : [rnd/postgres.md](rnd/postgres.md), dont la recommandation OVH est écartée par le propriétaire.
- **Choix :** Neon gratuit, région Francfort, Postgres 18, joint par Hyperdrive sans cache sur la connexion directe (pas le pooler). Un `pg_dump` part chaque nuit vers le NAS du propriétaire, 30 jours gardés, avec un test de restauration (`infra/backup/`).
- **Pourquoi :** 0 € pour 40 testeurs, en UE, sans rien à administrer. Le NAS n'héberge pas la base (le jeu dépendrait d'une box et d'un courant domestiques), il garde une copie hors du fournisseur.
- **Conséquences :** réveil d'environ 300 ms après 5 minutes sans requête, acceptable en bêta. Avant l'ouverture publique, revoir le fournisseur (Neon payant, Scaleway, Supabase). Procédure : [mise-en-ligne.md](mise-en-ligne.md).

## D-041 · Bêta fermée : liens d'invitation vérifiés à la création du joueur

- **Statut :** Acceptée (2026-10-22), choisie par le propriétaire.
- **Choix :** l'admin crée dans `/admin/invitations` un lien par groupe (`/invitation/<code>`), avec un nombre de places. Quand `BETA_INVITES` vaut `"required"`, Better Auth refuse de créer un joueur (invité, ou compte sans invité) sans code ouvert, et la place se prend par une mise à jour conditionnelle (`uses < max_uses`), sans verrou tenu pendant l'inscription. Un compte créé depuis un invité n'a pas besoin de lien.
- **Pourquoi :** la porte est tenue par le serveur, sur la seule action qui crée un joueur, et un lien par groupe dit d'où vient chaque testeur.
- **Conséquences :** le lien et le `?src=` d'arrivée restent dans le navigateur jusqu'à la création du joueur, puis vivent dans `player_signups`, qui suit la partie de l'invité vers son compte. Une inscription qui échoue après avoir pris sa place la perd. Ouvrir à tous : `BETA_INVITES` à `"off"`.

## D-042 · Mesure : calculée depuis la base, dans l'admin, sans outil tiers

- **Statut :** Acceptée (2026-10-22), choisie par le propriétaire (PostHog et Cloudflare Web Analytics écartés).
- **Choix :** une ligne `player_days` par joueur et par jour où il ouvre le jeu (heure de Paris), notée par `GET /me/progress` en parallèle de sa lecture. `/admin/mesure` en tire la rétention J1, J7 et J30 (revenu ce jour-là exactement, parmi les joueurs pour qui ce jour est passé) par semaine, par lien ou source, par tranche d'âge déclarée, l'entonnoir et la liste des testeurs. Les retours (« Un retour ? ») et la fausse porte mécène s'y ajoutent.
- **Pourquoi :** la promesse « pas de traceur » tient, rien ne part chez un tiers, et les chiffres sont ceux du jeu, pas d'un échantillon.
- **Conséquences :** admins et invités devenus comptes ne comptent pas. Les agrégats se calculent à la lecture : assez pour la bêta, à revoir au-delà de quelques milliers de joueurs. Les retours ne sont pas filtrés, car seule l'équipe les lit. Pas de visites de pages non jouées (accueil) : l'acquisition se lit par `?src=` sur les joueurs.
