# Leximon

Jeu de cartes à collectionner pour découvrir les mots rares et anciens du français. Boosters gratuits, collection, défis qui font monter les cartes en niveau, échanges entre joueurs. Web, iOS et Android.

**État :** le web joue de bout en bout (plis, album, défis avec plis bonus, échanges, profil public et atelier, clans) sur le catalogue de lancement publié (1 561 cartes, trois collections) ; le mobile joue presque tout le jeu sur Android, sons et vibrations compris (restent liens universels et publication sur les stores). Le site est en ligne (leximon.fr), en bêta fermée sur invitation jusqu'au déploiement qui l'ouvre à tous (prêt dans le code le 2026-11-08). Le détail est dans `docs/feuille-de-route.md`.

## Commandes

```bash
pnpm install                     # à la racine, Node 24 (voir .nvmrc)
cp .env.example .env             # une fois
cp apps/api/.dev.vars.example apps/api/.dev.vars   # une fois, puis remplir le secret
docker compose up -d             # Postgres local sur le port 54329
pnpm db:migrate                  # applique les migrations à la base de dev
pnpm catalog:publish             # publie la dernière version du catalogue (base de dev et fichiers du web, D-023)
pnpm dev                         # Postgres et Directus (Docker), puis toutes les apps (ou --filter @leximon/api, /web, /mobile)
pnpm --filter @leximon/mobile reverse   # téléphone ou émulateur branché : Metro, API et catalogue locaux joignables
pnpm check                       # lint + typecheck + tests unitaires, à lancer avant de rendre la main
pnpm test:integration            # tests contre la base leximon_test, vidée à chaque passage (Docker requis)
pnpm admin:grant <email>         # donne le rôle admin à un compte existant (--revoke pour le retirer)
pnpm dev:player <email> --level 16   # base locale seulement : niveau d'un compte, pour la recette
pnpm dev:bots <email> --challenge     # base locale seulement : ouvre les joutes au compte, des bots y répondent
pnpm format                      # corrige le formatage (Biome)
pnpm deploy:prod                 # met main en production (docs/mise-en-ligne.md), arbre propre exigé
```

Chaîne de contenu (Python, `content/pipeline/`, voir D-019 et D-021) :

```bash
docker compose --profile content up -d          # Postgres + Directus (http://127.0.0.1:8055)
cd content/pipeline && uv sync                  # dépendances Python
uv run python -m leximon_content ngram          # une fois : fréquences Google Ngram (5 Go téléchargés)
uv run python -m leximon_content prescreen --pool   # pré-tri Haiku des mots candidats (--limit N)
uv run python -m leximon_content select         # --size N, puis draft (--run <nom>)
uv run python -m leximon_content quality        # écarte, vérifie, corrige, note le charme (--run <nom>)
uv run python -m leximon_content push           # cartes gardées vers Directus, puis refresh, report
uv run python -m leximon_content release        # version du catalogue dans content/releases (collections : content/collections.toml)
uv run ruff check src tests && uv run ruff format --check src tests && uv run pytest   # avant de rendre la main
```

Les sources téléchargées vivent dans `content/pipeline/data/` (ignoré par git). Chaque appel au LLM coûte de l'argent : demander l'accord du propriétaire avant une génération à grande échelle. Une étape estimée à plus de 3 $ s'arrête et attend `--yes`, à ne passer qu'avec cet accord.

- Ajouter une dépendance : `pnpm --filter <package> add <dep>`. Les versions partagées passent par le `catalog` de `pnpm-workspace.yaml`.
- Dans `apps/mobile` : `pnpm expo install <dep>`, pour obtenir la version compatible avec le SDK.
- Les packages internes exposent leurs sources TypeScript directement (pas d'étape de build) et s'importent sans extension.
- Les scripts d'installation des dépendances sont bloqués par défaut. Pour en autoriser un, l'ajouter à `allowBuilds` dans `pnpm-workspace.yaml`.
- `apps/web` et `apps/mobile` ont leur propre `AGENTS.md` (consignes Next.js et Expo), à lire avant d'y toucher.

## Où trouver quoi

| Fichier                     | Contenu                                                                           | Versionné                     |
| --------------------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| `docs/regles-du-jeu.md`     | Règles du jeu : source unique des choix métier, avec leur statut                  | Oui                           |
| `docs/feuille-de-route.md`  | Vue d'ensemble : état de chaque chantier, décisions en attente, prochaines étapes | Oui                           |
| `docs/decisions.md`         | Décisions techniques : choix, statut, conséquences                                | Oui                           |
| `docs/voix.md`              | Voix de Leximon : personnage, ton selon le moment, lexique, boutons               | Oui                           |
| `docs/rnd/`                 | Rapports des spikes de R&D                                                        | Oui                           |
| `docs/cahiers-des-charges/` | Spécifications fonctionnelles d'un chantier, avant sa réalisation                 | Oui                           |
| `docs/recette-web.md`       | Recette du web : chaque test, ce qu'on doit voir, les retours du propriétaire     | Oui                           |
| `docs/recette-mobile.md`    | Recette de l'app Android : ce qui est propre au téléphone, renvoie au web         | Oui                           |
| `docs/recette-nouveautes.md` | Recette des derniers lots : finitions hors du jeu, joutes (web, mobile, prod)    | Oui                           |
| `docs/retours-joueurs.md`   | Retours des joueurs de la bêta (Reddit…) et ce qu'on en fait                      | Oui                           |
| `docs/fiches-stores.md`     | Fiches Google Play et App Store : textes, classification, données collectées      | Oui                           |
| `docs/ornements.md`         | Ornements anciens de l'interface : source et licence de chacun (fichier généré)   | Oui                           |
| `docs/north-star.md`        | Vision produit, marché, monétisation, lancement                                   | Non (local, peut être absent) |
| `docs/architecture.md`      | Architecture détaillée, charge visée, modèle de données                           | Non (local, peut être absent) |

**Une information vit à un seul endroit.** Mettre à jour le bon fichier plutôt que dupliquer, et renvoyer par lien. Ne pas recopier dans ce fichier ce qui est déjà dans `docs/`.

## Règles produit

**`docs/regles-du-jeu.md` est la source unique des choix métier** (boosters, raretés, défis, récompenses, échanges, contenu). À lire avant de toucher à une règle du jeu ; tout choix métier tranché par le propriétaire s'y inscrit, nulle part ailleurs. Un réglage chiffré change aux deux endroits à la fois : ce fichier et `packages/core/src/rules.ts`.

Ses règles non négociables s'imposent à tout le code : aucun hasard payant (ni booster acheté, ni monnaie achetable, ni revente de cartes), ce qui se paie a un contenu connu à l'avance, échanges carte contre carte sans messagerie libre, texte écrit par les joueurs filtré et modéré, contenu issu de sources autorisées uniquement (skill `carte-mot`).

## Règles d'architecture

- **API sans état :** aucun état de joueur ou de partie gardé en mémoire entre deux requêtes. L'état vit dans Postgres, la file ou un service temps réel dédié. Seul un cache court de données partagées et rarement modifiées (le catalogue de cartes) est permis, car il ne change jamais un résultat.
- **Le serveur fait foi :** tirage des boosters, recharge, niveaux et échanges sont calculés côté serveur.
- **Écritures :** chaque écriture est une transaction courte avec une clé d'idempotence. Toute lecture-modification d'un état de joueur (portefeuille, exemplaires) verrouille sa ligne (`SELECT … FOR UPDATE`), et chaque route concernée a un test d'intégration avec des requêtes concurrentes.
- **Catalogue statique :** le catalogue de cartes est versionné et servi par le CDN. L'affichage d'une carte ne lit jamais la base.
- **Règles modifiables :** le stock de boosters se calcule à la volée, sans tâche planifiée. Un réglage de jeu qui peut changer (recharge, plafond, probabilités) est daté, et un changement ne s'applique jamais rétroactivement aux joueurs existants. Tant que rien n'est en ligne (aucun joueur, pas de bêta), un réglage se corrige en place dans sa période : pas de nouvelle période ni de précaution de rétroactivité.
- **Maîtrise et exemplaires :** la maîtrise est rangée par mot (`user_mastery`), les exemplaires par quantité (`user_cards`). Un échange ne touche jamais la maîtrise.
- **Règles du jeu :** elles vivent dans `packages/core`, en TypeScript pur, sans I/O, et sont testées.
- **Tâches de fond :** tout ce qui peut attendre passe par la file (notifications, images de partage, statistiques).
- **Temps réel :** pas de WebSockets dans le chemin critique tant que la R&D D-007 n'a pas conclu.

## Standards de code

Objectif : un code lisible et facile à maintenir, performant et sûr, pensé pour les pics de charge dès la première ligne.

- **Typage :**
  - TypeScript en mode strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) ;
  - pas de `any` ;
  - les types partagés dérivent des schémas Zod de `packages/contract`.
- **Frontières :**
  - toute entrée externe est validée avec Zod (requêtes, messages de file, webhooks, fichiers du catalogue) ;
  - on ne fait jamais confiance au client.
- **Lisibilité :**
  - logique dans des fonctions pures, I/O en bordure ;
  - petites fonctions aux noms explicites ;
  - pas d'abstraction avant le deuxième cas d'usage réel ;
  - un commentaire explique le pourquoi, jamais le quoi ;
  - le code ne renvoie pas aux documents de cadrage : ni numéro de règle, d'écran ou de décision (P59, C-06, D-033), ni lot, ni cahier, ni maquette, dans les commentaires comme dans les noms de tests.
- **Erreurs :**
  - erreurs typées et explicites, jamais avalées ;
  - une erreur attendue (stock vide, offre expirée) est un résultat, pas une exception.
- **Performance :**
  - pas de requêtes N+1 ;
  - un index pour chaque requête du chemin critique ;
  - pagination par curseur ;
  - réponses minimales ;
  - rien de synchrone qui pourrait passer par la file ;
  - budget : ouverture de booster sous 150 ms au 95e centile.
- **Sécurité :**
  - autorisation vérifiée côté serveur sur chaque route (le joueur possède-t-il cette carte ?) ;
  - limites de débit ;
  - générateur aléatoire cryptographique pour les tirages ;
  - secrets uniquement par variables d'environnement ;
  - aucune donnée personnelle dans les logs.
- **Compatibilité :**
  - des versions anciennes de l'app mobile restent en circulation, donc migrations additives et rétrocompatibles ;
  - l'API ne casse jamais un client publié.
- **Tests :**
  - chaque règle de `packages/core` est testée, y compris statistiquement pour les tirages ;
  - les chemins critiques sont testés contre un vrai Postgres ;
  - test de charge avant chaque opération avec un streamer.
- **Dépendances :** peu, maintenues et justifiées. Toute nouvelle dépendance est un choix structurant, donc à proposer au propriétaire.

## Stack

pnpm + Turborepo · Node 24 · Biome · Vitest · Next.js (web) · Expo (mobile) · Hono + Drizzle + Postgres via node-postgres (API) · Cloudflare + Postgres sur le serveur maison, sauvegardé sur R2 (D-053) · Better Auth · Cloudflare Email Service (codes) et Lettermint (campagnes) · ts-fsrs (révision espacée) · expo-audio, expo-haptics et expo-sensors (sons, vibrations et inclinaison du mobile) · React Native Skia (particules du mobile) · k6 (test de charge, par Docker) · Umami auto-hébergé et Google Search Console (visites et recherche du site) · Directus · chaîne de contenu Python en local. Le détail et les raisons sont dans `docs/decisions.md`.

## Structure prévue

```
apps/        web (Next.js) · mobile (Expo) · api (Hono)
packages/    core (règles du jeu) · view-model (logique et textes des écrans, D-033) · contract (Zod + client typé) · db (Drizzle) · tokens (design) · config
content/     pipeline (Python, local) · releases (catalogue publié, généré)
rnd/         code jetable des spikes, jamais importé par apps/ ou packages/
infra/       hébergement, tests de charge
docs/        voir le tableau ci-dessus
```

## Façon de travailler

- **Le propriétaire pilote.** Pour tout choix structurant (dépendance, schéma, architecture, direction artistique), proposer les options avec une recommandation et le laisser trancher. Consigner ensuite la décision avec le skill `decision`.
- **Par défaut, l'agent implémente.** Le propriétaire relit : dans le résumé de fin, expliquer les choix non évidents (règles du jeu, sécurité, performance) pour qu'il garde la main sur le code. S'il demande à coder une partie lui-même, fournir l'interface et les tests, pas l'implémentation.
- **Langues :** code, identifiants et messages de commit en anglais. Docs, contenu des cartes et interface en français.
- **Voix de l'interface :** `docs/voix.md` (qui parle, ton selon le moment, lexique, boutons), à lire avant d'écrire un texte que le joueur lit. En bref : d'abord clair, ensuite court, et le caractère seulement là où il a de la place (attente, récompense, landing). Des phrases complètes avec un verbe, la règle dite en clair avec ses chiffres, aucune sentence, fausse chute, gouaille plaquée ni chaîne « X : Y ». Les accords avec les variables sont justes pour 0, 1 et plusieurs.
- **Documentation en Markdown simple**, pas de pages HTML élaborées.
- **Toujours commiter à la fin d'une session de travail sauf si demande explicite inverse.**

## Skills du projet

- `decision` : consigner ou modifier une décision technique dans `docs/decisions.md`.
- `carte-mot` : rédiger ou relire le contenu d'une carte (sources autorisées, style, champs, contrôle).
- `spike` : mener une R&D et en rendre compte dans `docs/rnd/`.
