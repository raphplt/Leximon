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
