# Mise en ligne

Première mise en production, pour la bêta fermée (20 à 40 testeurs, début novembre 2026). À suivre dans l'ordre. Chaque étape dit qui la fait :

- **Toi** : compte, paiement, secret, clic dans un tableau de bord. Personne d'autre.
- **Agent** : une commande qu'un agent peut lancer une fois `wrangler login` fait. Tu peux aussi la lancer toi-même.

Décisions liées : D-005 (Cloudflare, Postgres en UE), D-015 (web par OpenNext), D-023 (catalogue), D-034 et D-035 (e-mails). Le choix de Neon vient de [rnd/postgres.md](rnd/postgres.md).

## Ce qui part où

| Morceau | Où | Adresse |
|---|---|---|
| Web (Next.js) | Worker `leximon-web-production`, par OpenNext | `leximon.fr` (`www` redirigé) |
| Catalogue (fichiers immuables) | Fichiers statiques du Worker web | `leximon.fr/catalog/…` |
| API (Hono) | Worker `leximon-api-production` | `api.leximon.fr` |
| Base | Neon gratuit, Francfort, derrière Hyperdrive sans cache | — |
| Cache de Next.js | R2 `leximon-web-cache` | — |
| Codes de connexion | Cloudflare Email Service | `code@mail.leximon.fr` |
| Campagnes | Lettermint | `bonjour@infos.leximon.fr` |
| Sauvegardes | `pg_dump` chaque nuit sur le NAS, 30 jours | — |

Le cookie de session est posé par `api.leximon.fr`, sur ce seul hôte. `leximon.fr` et `api.leximon.fr` sont le même site, donc le navigateur l'envoie avec chaque requête de l'app, sans cookie partagé entre sous-domaines. Les pages rendues par le serveur web (carte publique, profil public) lisent l'API sans session.

Coût : 5 $ par mois (Workers Paid). Neon, R2, Lettermint et Email Service restent dans leur offre gratuite ou incluse à cette échelle.

## Le web sur Workers : sans `cacheComponents`

Avec Next.js 16.4.2 et `@opennextjs/cloudflare` 1.20.13, `cacheComponents` bloque les pages rendues par le serveur après la première d'un isolat (tickets OpenNext 1450 et 1464). Il est coupé, avec `partialPrefetching`, jusqu'au correctif (D-043). Vérifié le 2026-10-22 avec `pnpm --filter @leximon/web preview` : page publique d'une carte, profil public et images de partage répondent à chaque requête.

Pour le remettre : réactiver les deux options dans `apps/web/next.config.ts`, remettre `"use cache"` dans `src/cards/catalog-server.ts` et `src/profile/public-profile-data.ts`, puis refaire ce test.

## 0. Avant de commencer · toi

- Node 24, `pnpm install` à jour, sur la machine qui a la chaîne de contenu : `catalog:publish` copie les gravures et les sons depuis `content/pipeline/data/` (non versionné).
- Un gestionnaire de mots de passe pour y ranger chaque secret au moment où il est créé.
- La zone `leximon.fr` est dans le compte Cloudflare où les Workers seront déployés.

## 1. Forfait Workers Paid · toi

1. https://dash.cloudflare.com → **Workers & Pages** → **Plans** → **Workers Paid** (5 $ par mois).
2. Il est nécessaire pour Queues et les Durable Objects. Il inclut aussi 3 000 e-mails par mois (Email Service) et lève la limite quotidienne d'Hyperdrive.
3. **R2** → **Activer R2** (accepter les conditions). L'offre gratuite (10 Go) suffit.

## 2. Connexion de wrangler · toi

```bash
pnpm --filter @leximon/api exec wrangler login
pnpm --filter @leximon/api exec wrangler whoami   # doit afficher ton compte
```

La session vaut pour toutes les commandes `wrangler` de la machine, y compris celles d'un agent.

## 3. Base Neon · toi

1. https://console.neon.tech → créer un compte (sans carte bancaire).
2. **New project** : nom `leximon`, Postgres **18** (la version locale), région **AWS Europe Central 1 (Frankfurt)**.
3. **Connect** → base `neondb`, rôle propriétaire. Deux chaînes :
   - **directe** (interrupteur « Connection pooling » coupé, pas de `-pooler` dans l'hôte) : celle d'Hyperdrive, des migrations, du catalogue et des sauvegardes. C'est la seule qu'on utilise ;
   - **poolée** (avec `-pooler`) : inutile ici. Hyperdrive fait déjà le pooling, et `pg_dump` ne passe pas par un pooler.
4. Dans la chaîne directe, garder `?sslmode=require` et retirer `&channel_binding=require`.
5. La ranger dans le gestionnaire de mots de passe. Elle ne va jamais dans `.env` ni dans git.

L'offre gratuite met la base en veille après 5 minutes sans requête : la première requête suivante prend quelques centaines de millisecondes. Acceptable en bêta, pas au lancement public (voir [rnd/postgres.md](rnd/postgres.md)).

## 4. Hyperdrive · toi, puis agent

Toi, parce que la commande contient le mot de passe :

```bash
cd apps/api
pnpm exec wrangler hyperdrive create leximon-db --caching-disabled \
  --connection-string="postgresql://…(chaîne directe)…?sslmode=require"
```

`--caching-disabled` est obligatoire : le cache d'Hyperdrive renverrait une collection périmée juste après l'ouverture d'un pli.

Agent : recopier l'`id` affiché dans `apps/api/wrangler.jsonc`, `env.production.hyperdrive[0].id`, à la place de `ffffffffffffffffffffffffffffffff`. Commiter.

## 5. Files et bucket · agent

```bash
cd apps/api
pnpm exec wrangler queues create leximon-email-campaigns
pnpm exec wrangler queues create leximon-email-campaigns-dlq
pnpm exec wrangler queues create leximon-game-events
pnpm exec wrangler queues create leximon-game-events-dlq
pnpm exec wrangler r2 bucket create leximon-web-cache --location weur
```

Les noms ne changent pas : le Worker reconnaît la file des événements de jeu à son nom.

## 6. Secrets de l'API · toi

Chaque commande demande la valeur, qui n'apparaît ni à l'écran ni dans l'historique. La première crée le Worker `leximon-api-production`, encore vide.

```bash
cd apps/api
openssl rand -hex 32   # une valeur par secret, à ranger aussitôt
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
pnpm exec wrangler secret put EMAIL_LINK_SECRET --env production
```

Lettermint, quand le compte existe (étape 12) ; sans eux, les campagnes sont refusées, le reste marche :

```bash
pnpm exec wrangler secret put LETTERMINT_SENDING_TOKEN --env production
pnpm exec wrangler secret put LETTERMINT_WEBHOOK_SECRET --env production
```

Vérifier : `pnpm exec wrangler secret list --env production`.

`BETTER_AUTH_SECRET` signe les sessions : le changer déconnecte tout le monde. `EMAIL_LINK_SECRET` signe les liens de désinscription : le changer casse ceux déjà envoyés.

## 7. Migrations · toi (la chaîne), agent (la commande)

Dans le terminal qui lance les commandes de production :

```bash
read -rs DATABASE_URL && export DATABASE_URL   # coller la chaîne directe, puis Entrée
pnpm db:migrate:prod
```

Les scripts `*:prod` refusent de tourner si `DATABASE_URL` est absente, locale ou sans TLS, et affichent l'hôte visé. Sans eux, les scripts liraient la base locale de `.env`.

## 8. Catalogue · agent

Même terminal, `DATABASE_URL` toujours exportée :

```bash
pnpm catalog:publish:prod
```

Met à jour les tables `collections` et `cards` de Neon, puis copie les fichiers dans `apps/web/public/catalog/`, d'où le déploiement du web les envoie. **Après chaque publication, redéployer le web (étape 10) dans la foulée** : tant que ce n'est pas fait, les plis peuvent tirer des cartes que le site n'a pas encore.

## 9. API · agent

```bash
pnpm deploy:api
curl https://api.leximon.fr/health   # {"status":"ok"}
```

Le domaine `api.leximon.fr` est créé par le déploiement (enregistrement DNS et certificat). Si un enregistrement `api` existe déjà dans la zone, le supprimer d'abord (toi).

## 10. Web · agent

```bash
pnpm deploy:web
```

Construit le site avec `NEXT_PUBLIC_API_URL=https://api.leximon.fr`, puis le déploie avec le catalogue et les en-têtes de cache (`apps/web/public/_headers` : un an pour les fichiers nommés par leur empreinte, une minute pour `manifest.json`). Refuse de partir si `public/catalog` est vide.

Le domaine `leximon.fr` est créé par le déploiement. Toi : supprimer avant tout enregistrement `A`, `AAAA` ou `CNAME` existant sur `leximon.fr` (une page d'attente, par exemple). Ne pas toucher aux `MX` ni aux `TXT`.

## 11. Redirection de www · toi

1. **DNS** → **Records** → ajouter `AAAA`, nom `www`, contenu `100::`, proxy **activé** (nuage orange).
2. **Rules** → **Redirect Rules** → modèle **Redirect from WWW to root** : `https://www.leximon.fr/*` vers `https://leximon.fr/${1}`, code 301, garder la query string.

## 12. E-mails · toi

Détail dans le [cahier des e-mails](cahiers-des-charges/e-mails.md).

**Codes de connexion (Cloudflare Email Service)**

1. **Compute** → **Email Service** → **Email Sending** → **Onboard Domain** → `mail.leximon.fr`. Cloudflare crée lui-même les enregistrements `cf-bounce` (MX, SPF, DKIM) et le DMARC du sous-domaine.
2. Attendre l'état vérifié.
3. **Demander une hausse du quota quotidien**, dès maintenant : un compte neuf démarre avec un quota prudent. Formulaire « Need a higher limit? » en bas de la page Limits d'Email Service (developers.cloudflare.com/email-service/platform/limits). Préciser : codes de connexion seulement, bêta de 40 personnes puis ouverture publique avec des pics pendant des streams.

**Campagnes (Lettermint)**

1. Créer le compte sur lettermint.co, passer leur vérification de conformité.
2. Ajouter le domaine `infos.leximon.fr`, puis créer chez Cloudflare les enregistrements qu'ils donnent : deux `CNAME` DKIM (`lm1._domainkey.infos`, `lm2._domainkey.infos`) et le `CNAME` de retour, tous en **DNS only** (nuage gris).
3. Ajouter `TXT` `_dmarc.infos` = `v=DMARC1; p=none; rua=mailto:contact@leximon.fr; adkim=r; aspf=r`.
4. Créer un jeton d'envoi pour la route `broadcast`, puis un webhook vers `https://api.leximon.fr/email/webhooks/lettermint` (rebonds, plaintes, désinscriptions). Mettre le jeton et le secret du webhook en secrets (étape 6).
5. Leur demander de couper leur page de désinscription hébergée sur la route de diffusion.

**Domaine principal** : s'il n'existe pas, `TXT` `_dmarc` = `v=DMARC1; p=none; rua=mailto:contact@leximon.fr`. Le `MX` existant de `leximon.fr` ne bouge pas.

## 13. Ton compte admin · toi

L'API exige un lien d'invitation pour tout nouveau joueur, et seul un admin crée des liens. Pour le premier compte, on ouvre la porte quelques minutes :

1. Agent : déployer l'API porte ouverte.

```bash
pnpm --filter @leximon/api exec wrangler deploy --env production --var BETA_INVITES:off
```

2. Toi : sur https://leximon.fr/compte, te connecter avec ton adresse (le code arrive par e-mail).
3. Toi, `DATABASE_URL` exportée comme à l'étape 7 :

```bash
pnpm admin:grant:prod contact@leximon.fr
```

4. Agent : refermer la porte, puis vérifier qu'un invité sans lien est refusé (403, `INVITE_REQUIRED`).

```bash
pnpm deploy:api
curl -s -X POST https://api.leximon.fr/api/auth/sign-in/anonymous -H 'Origin: https://leximon.fr' -H 'Content-Type: application/json' -d '{}'
```

5. Recharger : le lien vers `/admin` apparaît.

## 13 bis. Inviter les testeurs · toi

1. `/admin/invitations` : un lien par groupe (« Amis », « LinkedIn », « Prof de Lyon »), avec un nombre de places. Le code est tiré au hasard, ou lisible si ça ne gêne pas qu'on le devine.
2. « Copier le lien » donne `https://leximon.fr/invitation/<code>`, à envoyer comme tu veux (message, mail, campagne à la liste d'attente).
3. Sur ce lien, le testeur clique « Ouvrir mon premier sachet » et joue. Il crée son compte plus tard, sans nouveau lien.
4. Pour mesurer un canal, ajoute `?src=<code>` à tout lien posté (`https://leximon.fr/?src=tiktok-insultes`). Le premier code vu est gardé avec le joueur.
5. Suivi : `/admin/mesure` (rétention J1, J7, J30 par semaine, par lien ou source, par âge ; entonnoir ; fausse porte mécène ; liste des testeurs) et `/admin/retours` (le bouton « Un retour ? » du menu du joueur).

Pour ouvrir la bêta à tous : passer `BETA_INVITES` à `"off"` dans `env.production` de `apps/api/wrangler.jsonc`, puis `pnpm deploy:api`.

## 14. Vérifications · toi et agent

| Test | Comment | Attendu |
|---|---|---|
| API | `curl https://api.leximon.fr/health` | `{"status":"ok"}` |
| Catalogue | `curl -I https://leximon.fr/catalog/manifest.json` | 200, `Cache-Control: public, max-age=60, must-revalidate` |
| Fichier immuable | `curl -I` sur un fichier de `collections/` cité par le manifeste | `max-age=31536000, immutable` |
| www | `curl -I https://www.leximon.fr/jouer` | 301 vers `https://leximon.fr/jouer` |
| Porte | Fenêtre privée sur https://leximon.fr/jouer | Renvoie vers « Sur invitation » |
| Invité | Fenêtre privée sur un lien de `/admin/invitations` | Le jeu s'ouvre, des plis à ouvrir ; une place prise dans l'admin |
| Code | Demander un code avec une adresse Gmail | Reçu en moins d'une minute, hors spam. « Afficher l'original » : DKIM `pass` pour `mail.leximon.fr` |
| Pli | Ouvrir un pli | Les cartes s'affichent avec leur gravure et leur son |
| Carte publique | https://leximon.fr/carte/accastillage, deux fois | La carte s'affiche, l'image de partage aussi |
| Erreurs | `pnpm --filter @leximon/api exec wrangler tail --env production` pendant les tests | Aucune erreur |
| Maintenance | Le lendemain, **Workers** → `leximon-api-production` → **Logs** | Une ligne « Maintenance done » après 3 h 17 UTC |

## 15. Sauvegardes sur le NAS · toi

Neon gratuit ne garde que 6 heures d'historique. La vraie sauvegarde est un `pg_dump` chaque nuit, gardé 30 jours. Les fichiers sont dans `infra/backup/`.

1. Copier `infra/backup/` sur le NAS (par exemple `/volume1/docker/leximon-backup/`).
2. Y créer `.env` depuis `.env.example`, avec la chaîne directe de Neon et le dossier de destination (`BACKUP_PATH`). Restreindre le fichier : `chmod 600 .env`.
3. Lancer :

```bash
docker compose up -d                                   # une sauvegarde chaque nuit à 4 h 30
docker compose run --rm backup /scripts/backup.sh      # une tout de suite
docker compose logs backup                             # « backup ok: … »
```

4. **Test de restauration**, maintenant puis une fois par mois :

```bash
docker compose run --rm backup /scripts/restore-test.sh
```

Il restaure le dernier fichier dans un Postgres jetable, à l'intérieur du conteneur, et compte les joueurs, les exemplaires, les cartes et les migrations. Il ne touche ni à Neon ni aux sauvegardes.

Une sauvegarde ratée ne supprime aucune ancienne : la rotation ne passe qu'après un fichier vérifié. Le réveil nocturne de la base consomme quelques minutes des 100 heures de calcul mensuelles de Neon.

### Restaurer pour de vrai

1. Neon → **Branches** → créer une branche vide (ou un nouveau projet), récupérer sa chaîne directe.
2. Sur le NAS : `docker compose run --rm backup sh -c 'pg_restore --no-owner --no-privileges --exit-on-error -d "postgresql://…nouvelle chaîne…" /backups/leximon-AAAAMMJJ-HHMMSS.dump'`.
3. Vérifier les données, puis faire pointer Hyperdrive dessus : `pnpm --filter @leximon/api exec wrangler hyperdrive update <id> --connection-string="…"`.

## 16. Revenir en arrière · agent

Un déploiement raté :

```bash
cd apps/api && pnpm exec wrangler deployments list --env production
pnpm exec wrangler rollback --env production            # version précédente
cd ../web && pnpm exec wrangler rollback --env production
```

Le retour en arrière ne touche que le code. Les migrations sont additives, donc l'ancienne version de l'API marche sur la nouvelle base : on ne défait jamais une migration en production. Une donnée abîmée se répare depuis une sauvegarde (étape 15).

## Après la mise en ligne

- Ajouter un réglage ou une liaison à l'API : l'écrire en haut de `apps/api/wrangler.jsonc` (local) **et** dans `env.production`. Wrangler ne recopie ni les variables ni les liaisons dans un environnement.
- Nouvelle version du catalogue : `pnpm catalog:publish:prod` puis `pnpm deploy:web`, dans cet ordre et dans la foulée.
- Nouvelle migration : `pnpm db:migrate:prod` avant `pnpm deploy:api`.
