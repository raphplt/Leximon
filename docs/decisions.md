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

- **Statut :** Acceptée (2026-10-18)
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

- **Statut :** Acceptée (2026-10-19). Le choix du modèle de rédaction attend les résultats de l'essai sur 50 mots.
- **Choix :**
  - **Texte de référence : le Littré, via XMLittré.** Le balisage est sous CC BY-SA 3.0 ; le texte sans balisage est dans le domaine public, comme l'indique l'auteur. On n'en extrait que du texte brut.
  - **Repérage des candidats :** les catégories du Wiktionnaire (titres seulement, aucun texte repris).
  - **Rareté moderne :** Lexique 3.83. Google Books Ngram viendra pour la rareté historique.
  - **Rédaction :** Claude, en sortie JSON structurée. Le modèle reformule et choisit ; la citation est choisie par numéro dans l'entrée, et l'époque est calculée depuis l'historique du Littré.
  - **Outillage :** projet Python `uv` dans `content/pipeline/`, avec Ruff et pytest, et un job CI dédié.
  - **Relecture :** Directus 12, dans une base Postgres `leximon_content` séparée de la base du jeu, démarrée par le profil Docker `content`.
- **Pourquoi :**
  - le Littré fournit dans chaque entrée tout ce qu'une carte demande, avec des citations d'auteurs du domaine public ;
  - le LLM qui ne fait que reformuler et choisir reste vérifiable automatiquement.
- **Conséquences :**
  - créditer « XMLittré, François Gannaz (littre.org) » dans l'app ;
  - faire valider le partage à l'identique par un juriste avant le lancement ;
  - une liste d'exclusion déterministe des injures est nécessaire : l'essai montre qu'aucun modèle ne les repère toutes, et que certains sens injurieux modernes sont absents du Littré.
  - D-008 prévoyait un schéma « contenu » : une base séparée isole mieux les tables système de Directus.
