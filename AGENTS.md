# Leximon

Jeu de cartes à collectionner pour découvrir les mots rares et anciens du français. Boosters gratuits, collection, défis qui font monter les cartes en niveau, échanges entre joueurs. Web, iOS et Android.

**État :** pré-code. Aucune app n'existe encore. La stack est décidée, le squelette du monorepo reste à créer.

## Où trouver quoi

| Fichier | Contenu | Versionné |
|---|---|---|
| `docs/decisions.md` | Décisions techniques : choix, statut, conséquences | Oui |
| `docs/rnd/` | Rapports des spikes de R&D | Oui |
| `docs/north-star.md` | Vision produit, marché, monétisation, lancement | Non (local, peut être absent) |
| `docs/architecture.md` | Architecture détaillée, charge visée, modèle de données | Non (local, peut être absent) |

**Une information vit à un seul endroit.** Mettre à jour le bon fichier plutôt que dupliquer, et renvoyer par lien. Ne pas recopier dans ce fichier ce qui est déjà dans `docs/`.

## Règles produit non négociables

- **Aucun hasard payant :**
  - aucun booster ne s'achète, ni directement ni via une monnaie achetée ;
  - aucune monnaie achetable en euros ;
  - aucune carte ne se revend contre de l'argent.
  - Raisons : PEGI 16 minimum, régime JONUM réservé aux majeurs, public scolaire visé.
- **Ce qui se paie a un contenu connu à l'avance :** abonnement, cosmétiques, decks imprimés, licences écoles.
- **Échanges carte contre carte**, par offres structurées, sans messagerie libre.
- **Contenu des cartes :** uniquement des sources autorisées. Voir le skill `carte-mot`.

## Règles d'architecture

- **API sans état :** aucune donnée gardée en mémoire entre deux requêtes. L'état vit dans Postgres, la file ou un service temps réel dédié.
- **Le serveur fait foi :** tirage des boosters, recharge, niveaux et échanges sont calculés côté serveur.
- **Écritures :** chaque écriture est une transaction courte avec une clé d'idempotence.
- **Catalogue statique :** le catalogue de cartes est versionné et servi par le CDN. L'affichage d'une carte ne lit jamais la base.
- **Recharge :** le stock de boosters se calcule à la volée, sans tâche planifiée.
- **Maîtrise et exemplaires :** la maîtrise est rangée par mot (`user_mastery`), les exemplaires par quantité (`user_cards`). Un échange ne touche jamais la maîtrise.
- **Règles du jeu :** elles vivent dans `packages/core`, en TypeScript pur, sans I/O, et sont testées.
- **Tâches de fond :** tout ce qui peut attendre passe par la file (notifications, images de partage, statistiques).
- **Temps réel :** pas de WebSockets dans le chemin critique tant que la R&D D-007 n'a pas conclu.

## Stack

pnpm + Turborepo · Next.js (web) · Expo (mobile) · Hono + Drizzle + Postgres (API) · Cloudflare + Postgres managé UE · Better Auth · Directus · chaîne de contenu Python en local. Le détail et les raisons sont dans `docs/decisions.md`.

## Structure prévue

```
apps/        web (Next.js) · mobile (Expo) · api (Hono)
packages/    core (règles du jeu) · contract (Zod + client typé) · db (Drizzle) · tokens (design) · config
content/     pipeline (Python, local) · releases (catalogue publié, généré)
rnd/         code jetable des spikes, jamais importé par apps/ ou packages/
infra/       hébergement, tests de charge
docs/        voir le tableau ci-dessus
```

## Façon de travailler

- **Le propriétaire pilote.** Pour tout choix structurant (dépendance, schéma, architecture, direction artistique), proposer les options avec une recommandation et le laisser trancher. Consigner ensuite la décision avec le skill `decision`.
- **Il code lui-même une partie du projet**, a priori dans `packages/core`. Avant d'implémenter une règle du jeu, lui demander s'il veut la prendre. S'il la prend, fournir l'interface et les tests, pas l'implémentation.
- **Langues :** code, identifiants et messages de commit en anglais. Docs, contenu des cartes et interface en français.
- **Documentation en Markdown simple**, pas de pages HTML élaborées.
- **Ne jamais commiter sans demande explicite.**

## Skills du projet

- `decision` : consigner ou modifier une décision technique dans `docs/decisions.md`.
- `carte-mot` : rédiger ou relire le contenu d'une carte (sources autorisées, style, champs, contrôle).
- `spike` : mener une R&D et en rendre compte dans `docs/rnd/`.
