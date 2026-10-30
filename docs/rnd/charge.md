# Test de charge

Décision : D-047 (k6 par Docker, temps de réponse dans Workers Logs, staging sur une branche Neon). Budget : ouverture d'un sachet sous 150 ms au 95e centile.

**Jamais de charge contre la production sans l'accord explicite du propriétaire.** `run.sh` et `load:players` refusent `api.leximon.fr` et la base de `~/.config/leximon/neon-url`.

## Les scénarios

`infra/load/scenarios.js`, lancé par `infra/load/run.sh` (image `grafana/k6:2.3.0`). Chaque scénario monte en 20 s jusqu'à `RATE` itérations par seconde, tient `HOLD` (1 min par défaut), puis redescend.

| Scénario | Une itération | Seuil p95 |
|---|---|---|
| `open` | un joueur ouvre un sachet de la collection de départ | 150 ms |
| `answer` | une série de 5 questions (`GET /challenges`), puis une réponse à chacune | 300 ms par requête |
| `collection` | l'album : toutes les pages de `GET /me/cards?limit=500`, puis `GET /me/mastery` | 300 ms par requête |
| `arrival` | un invité arrive d'un lien de stream et ouvre ses deux sachets (`RATE / 5`) | 150 ms |
| `streak` | `RATE` joueurs à la fois, chacun ouvre un sachet par seconde, 15 de suite | 150 ms |

Les seuils de 300 ms des lectures et des défis sont indicatifs ; seul celui de l'ouverture est un engagement.

Chaque joueur garde, dans chaque VU, son propre bocal de cookies. Le cookie de session signé de Better Auth (cinq minutes) évite la lecture de la session en base, comme dans un navigateur. Mais dans `open`, `answer` et `collection`, un joueur passe d'un VU à l'autre et tombe le plus souvent sur un bocal neuf : presque aucune requête ne profite du cache, et ces scénarios sont pessimistes. `streak` garde un joueur par VU, comme un joueur réel qui enchaîne ses sachets.

Les joueurs viennent de `pnpm load:players` : des invités créés par l'API, passés comptes dans la base (un invité n'ouvre que deux sachets), avec 150 cartes déjà dans l'album et une réserve pleine (6 sachets du stock plus 10 de réserve, soit 16 ouvertures chacun). Les scénarios les prennent à tour de rôle, si bien que deux itérations verrouillent rarement le même portefeuille. Leurs cookies vont dans `infra/load/players.json`, ignoré par git.

## Lancer en local

Une base à part, pour ne pas remplir celle de dev :

```bash
docker exec leximon-postgres-1 psql -U leximon -d leximon -c "create database leximon_load"
DATABASE_URL=postgres://leximon:leximon@127.0.0.1:54329/leximon_load pnpm db:migrate
DATABASE_URL=postgres://leximon:leximon@127.0.0.1:54329/leximon_load pnpm catalog:publish --target /tmp/leximon-load-catalog
cd apps/api && CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://leximon:leximon@127.0.0.1:54329/leximon_load \
  pnpm exec wrangler dev --port 8797 --inspector-port 9239 --persist-to /tmp/leximon-load-state
```

Puis, depuis la racine :

```bash
LOAD_DATABASE_URL=postgres://leximon:leximon@127.0.0.1:54329/leximon_load pnpm load:players --api http://localhost:8797 --count 60
BASE_URL=http://localhost:8797 RATE=5 HOLD=20s infra/load/run.sh
```

En local, la création d'invités est limitée à 60 par minute : au-delà, `load:players` attend. Les temps locaux ne disent rien de la production : sans Hyperdrive, chaque requête ouvre sa propre connexion à Postgres.

## Lancer contre le staging

L'environnement `staging` de `apps/api/wrangler.jsonc` est l'API de production avec la porte ouverte, ses propres files (suffixe `-staging`), ses propres limites (création d'invités à 10 000 par minute, car toute la charge part d'une seule adresse) et aucune tâche quotidienne. Il est servi sur workers.dev.

Une fois (toi) :

1. Neon → **Branches** → **New branch** `charge`, parent `production`, données et schéma.
2. **Connect** sur cette branche : chaîne directe (sans `-pooler`), `?sslmode=require`, sans `&channel_binding=require`. La ranger sans l'afficher :
   `read -rs U && printf '%s' "$U" > ~/.config/leximon/neon-load-url && chmod 600 ~/.config/leximon/neon-load-url`
3. `cd apps/api && pnpm exec wrangler hyperdrive create leximon-db-staging --caching-disabled --connection-string="$(cat ~/.config/leximon/neon-load-url)"`, répondre « no », recopier l'`id` dans `env.staging.hyperdrive[0].id`.

Agent :

```bash
cd apps/api
for q in leximon-email-campaigns-staging leximon-email-campaigns-staging-dlq leximon-game-events-staging leximon-game-events-staging-dlq; do pnpm exec wrangler queues create $q; done
openssl rand -hex 32 | pnpm exec wrangler secret put BETTER_AUTH_SECRET --env staging
openssl rand -hex 32 | pnpm exec wrangler secret put EMAIL_LINK_SECRET --env staging
pnpm exec wrangler deploy --env staging
cd ../.. && pnpm load:players --api https://leximon-api-staging.raphael-plassart.workers.dev --count 400 --origin https://leximon.fr --out infra/load/players-staging.json
BASE_URL=https://leximon-api-staging.raphael-plassart.workers.dev ORIGIN=https://leximon.fr PLAYERS=./players-staging.json RATE=20 infra/load/run.sh
```

Les files et les secrets existent déjà (créés le 2026-10-23). Une nouvelle campagne n'a besoin que d'une branche Neon, d'un `wrangler hyperdrive update <id> --connection-string=…` vers elle (l'`id` est dans `env.staging`), d'un déploiement et de nouveaux joueurs.

Après la campagne : supprimer la branche Neon (ou la laisser s'effacer seule), puis `pnpm exec wrangler delete --env staging` si le staging ne doit plus servir.

## Suivre la production

Le résumé Discord du matin (D-045) donne, en plus des erreurs, le nombre de requêtes et le p95 de l'ouverture, de la réponse à un défi et de la lecture de la collection sur 24 h, lus dans Workers Logs. C'est le temps passé dans le Worker (de la requête à la fin des tâches lancées après la réponse), pas celui que voit le joueur : à comparer avec le p95 de k6, qui compte aussi le réseau.

## Résultats

### Local, 2026-10-23

API par `wrangler dev`, Postgres 18 en Docker sur la même machine, 60 joueurs.

| Charge | Ouverture p95 | Défi p95 | Album (`/me/cards`) p95 | Erreurs |
|---|---|---|---|---|
| 5 itérations/s par scénario (33 requêtes/s) | 53 ms | 36 ms | 26 ms | 0 |
| 20 itérations/s par scénario (~50 requêtes/s servies) | 41 s | 10 s | 32 s | 26 % |

À 20 itérations par seconde, Postgres refuse les connexions (« sorry, too many clients already ») : sans Hyperdrive, chaque requête en ouvre une, et la limite de 100 est vite atteinte. C'est un artefact du local, mais il annonce le premier goulot réel : **le nombre de connexions à la base**. Hyperdrive en tient environ 100 vers Neon (forfait payant), et Neon gratuit en accepte à peu près autant (0,25 unité de calcul). Le staging dira lequel cède le premier.

### Staging, 2026-10-23

API `leximon-api-staging` sur workers.dev, Hyperdrive sans cache vers une branche de la base de production sur Neon gratuit (Francfort), 400 joueurs. k6 tourne depuis une connexion domestique en France : ses temps comptent le réseau (environ 20 ms aller-retour jusqu'à Cloudflare). Médiane / p95, en millisecondes.

| Palier | Requêtes/s | Ouverture | Défi (réponse) | Album (`/me/cards`) | Erreurs |
|---|---|---|---|---|---|
| 5 it/s, Worker à Paris (Smart Placement) | 38 | 183 / 460 | 162 / 269 | 117 / 361 | 0 |
| 5 it/s, Worker à Francfort | 38 | 129 / 667 | 118 / 450 | 103 / 400 | 0 |
| ouverture seule, 10 it/s pendant 2 min | 9 | 122 / 367 | — | — | 0 |
| 20 it/s, quatre scénarios | 161 | 139 / 614 | 127 / 661 | 120 / 615 | 0 |
| 40 it/s, sans ouverture de membre | 287 | 119 / 377 (invité) | 119 / 347 | 108 / 372 | 0 |
| 80 it/s, sans ouverture de membre | 572 | 119 / 283 (invité) | 120 / 269 | 107 / 328 | 0 |

Côté serveur (`wrangler tail`, ouverture seule à 10 it/s) : temps passé dans le Worker 164 ms en médiane, 473 ms au p95, dont l'envoi à la file après la réponse ; CPU 20 ms en médiane, 46 ms au p95. Le Worker attend la base.

**Ce qui tient.** 572 requêtes par seconde pendant une minute, sans une erreur ni un refus de connexion : Hyperdrive et Neon gratuit encaissent bien plus que la bêta (40 testeurs) et qu'un premier stream. Les verrous de portefeuille et l'idempotence ne cèdent pas sous la concurrence. La limite de connexions, goulot du local, n'a jamais été atteinte.

**Ce qui ne tient pas : le budget de 150 ms au p95.** L'ouverture est autour de 125 ms en médiane, mais son p95 reste entre 370 et 670 ms, même à 10 ouvertures par seconde : ce n'est pas la charge, c'est le coût fixe de chaque requête et sa variance. Les p95 baissent même quand la charge monte (Neon agrandit son calcul et les connexions d'Hyperdrive restent chaudes).

**Goulots trouvés :**

1. **Le Worker tournait à Paris, la base est à Francfort** (`cf-placement: local-CDG`, en production aussi). Smart Placement ne déplace un Worker que vers des lieux où il a déjà du trafic : avec des joueurs en France, jamais Francfort. Chaque aller-retour SQL traversait donc Paris-Francfort. Corrigé dans `wrangler.jsonc` : `placement.region` à `aws:eu-central-1` (médiane de l'ouverture de 183 à environ 125 ms). Part en production au prochain `pnpm deploy:prod` ; vérifier ensuite `curl -sI https://api.leximon.fr/health` : `cf-placement: remote-FRA`.
2. **Huit allers-retours SQL en série par ouverture** (corrigé le 2026-10-24, voir plus bas) : session et utilisateur (sans cookie de session en cache), sanctions, puis la transaction (portefeuille verrouillé, tirage, cartes, validation). À environ 7 ms chacun via Hyperdrive, c'est le plancher de la médiane, et chaque aller-retour ajoute sa variance au p95. Piste : regrouper les lectures d'avant la transaction et les écritures de la transaction en moins de requêtes.
3. **Neon gratuit démarre à 0,25 unité de calcul** : les p95 s'améliorent quand la charge le fait grandir. Piste à mesurer : un minimum plus haut (Neon payant), à mettre en balance avec le changement de fournisseur prévu avant l'ouverture publique (D-040).
4. **Le pool d'Hyperdrive** (environ 100 connexions) est proche du maximum de Neon gratuit à 0,25 unité : jamais atteint ici, mais à plafonner (`--origin-connection-limit`) si la base reste petite.

Après la campagne : la branche Neon `charge` s'efface seule au bout d'un jour ; le Worker `leximon-api-staging` reste déployé, sans trafic ni coût, et son Hyperdrive pointera vers une branche absente jusqu'à la prochaine campagne.

### Ouverture allégée, 2026-10-24

**Le cache de session n'a jamais servi, ni en production ni ailleurs.** Better Auth pose le cookie signé `session_data` quand il lit la session, mais l'API lisait la session par `auth.api.getSession` sans renvoyer au navigateur les cookies posés : le cache, et la prolongation de la session, restaient sur le serveur. Chaque requête d'un joueur connecté payait donc deux allers-retours de plus (session, puis utilisateur), environ 16 ms. `requireUser` renvoie maintenant ces cookies (test d'intégration `require-user.integration.test.ts`).

Allers-retours SQL d'une ouverture, en série :

| | Avant | Après |
|---|---|---|
| session et utilisateur | 2 | 0 (cookie en cache), 2 toutes les cinq minutes |
| sanctions | 1 | 0 : lues dans la transaction, avec la clé d'idempotence |
| pool de cartes (cache froid) | 2 | 1 : collection et cartes en une requête |
| transaction : début, verrou du portefeuille, lecture, écriture, validation | 5 | 5 |
| **Total, cache chaud** | **8** | **5** |

Le verrou du portefeuille (`FOR UPDATE`), l'idempotence et leurs tests concurrents ne changent pas. La transaction ne descend pas sous cinq instructions : après le verrou, la lecture doit être une requête à part pour voir ce qu'une ouverture concurrente vient de valider.

**Mesures sur le staging**, temps passé dans le gestionnaire (instrumentation temporaire, lue par `wrangler tail`) et temps jusqu'au premier octet vu par k6 depuis une connexion domestique, en millisecondes, médiane / p95 :

| | Serveur | Joueur (k6) |
|---|---|---|
| Avant, `open` à 10 it/s | 79 / 190 | 116 / 173 |
| Lectures regroupées, `open` à 10 it/s (cache défait par le scénario) | 45 / 65 | 114 / 173 |
| Cache de session réparé, `streak` à 40 joueurs (600 ouvertures) | 37 / 72 | 103 / 403 |

**Côté serveur, l'ouverture tient le budget** : 37 ms en médiane et 72 ms au p95, 88 % des ouvertures servies par le cookie en cache (la première de chaque joueur lit la session en base). Le premier passage de `streak`, sur un staging resté sans trafic, montait à 760 ms en médiane pendant les deux premières secondes : 40 ouvertures simultanées sur des connexions Hyperdrive à ouvrir et un Neon en veille. Une fois réveillé, plus rien au-dessus de 111 ms.

**Côté joueur, le p95 dépend du réseau.** Les 65 ms d'écart en médiane sont le trajet jusqu'à Cloudflare puis jusqu'à Francfort ; la queue (176 ms au 90e centile, 403 au 95e) suit les pertes de paquets de la connexion domestique qui lance k6, mesurées à 15 % lors de la campagne. Le p95 de production se suit dans le résumé Discord, qui compte le temps serveur.

**Contrepartie :** avec le cache, une session supprimée (bannissement) reste valable jusqu'à cinq minutes. La suppression d'un compte efface déjà les cookies du navigateur, et un invité archivé reste refusé à l'ouverture.

### Base sur le serveur maison, 2026-10-30

API de staging à Paris (`cf-placement: local-CDG`), Hyperdrive sans cache, Workers VPC et tunnel Cloudflare jusqu'au conteneur `leximon-db` (2 cœurs, 1,5 Go), copie de la production plus 400 joueurs de test. k6 tourne sur la même connexion que la base, à 4 ms de Cloudflare : un joueur plus loin du réseau aura quelques millisecondes de plus. Médiane / p95, en millisecondes, 18 407 requêtes et aucune erreur.

| Palier | Requêtes/s | Ouverture | Défi (réponse) | Album (`/me/cards`) |
|---|---|---|---|---|
| ouverture seule, 10 it/s pendant 2 min | 9 | 103 / 147 | — | — |
| 5 it/s | 38 | 107 / 188 | 89 / 121 | 60 / 129 |
| 20 it/s, trois scénarios | 151 | 105 / 375 | 88 / 134 | 60 / 109 |

Les chiffres de Neon viennent d'avant les corrections du 2026-10-24, sauf l'ouverture seule, qui y faisait 114 / 173. **Le budget de 150 ms tient sur l'ouverture seule, pas quand les scénarios se mélangent** (188 et 375 ms au p95). La cause de cette queue n'est pas établie : le conteneur reste loin de sa limite (charge de 1,2 au plus sur 2 cœurs, 326 Mo de mémoire, 39 connexions).

Pour la capacité brute, `pgbench` donne 1 763 écritures par seconde à 16 clients, 2 678 à 50 clients, et 38 961 lectures à 16 clients, dans le conteneur, sans le tunnel. Une écriture durable coûte environ 3 ms sur le SSD.

**Redémarrage du conteneur :** Postgres, le tunnel et le résolveur repartent seuls, et l'API répond de nouveau au bout de 2 minutes. Pendant ce temps, elle renvoie des erreurs 500.
