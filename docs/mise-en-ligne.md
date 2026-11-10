# Mise en ligne

Première mise en production, pour la bêta fermée (20 à 40 testeurs, début novembre 2026). À suivre dans l'ordre. Chaque étape dit qui la fait :

- **Toi** : compte, paiement, secret, clic dans un tableau de bord. Personne d'autre.
- **Agent** : une commande qu'un agent peut lancer une fois `wrangler login` fait. Tu peux aussi la lancer toi-même.

Décisions liées : D-005 (Cloudflare, Postgres en UE), D-015 (web par OpenNext), D-023 (catalogue), D-034 et D-035 (e-mails). La base de production est sur le serveur maison depuis le 2026-10-30 (D-053, étape 15 bis).

## Ce qui part où

| Morceau | Où | Adresse |
|---|---|---|
| Web (Next.js) | Worker `leximon-web-production`, par OpenNext | `leximon.fr` (`www` redirigé) |
| Catalogue (fichiers immuables) | Fichiers statiques du Worker web | `leximon.fr/catalog/…` |
| API (Hono) | Worker `leximon-api-production` | `api.leximon.fr` |
| Base | Postgres sur le serveur maison, joint par Workers VPC et un tunnel, derrière Hyperdrive sans cache | — |
| Cache de Next.js | R2 `leximon-web-cache` | — |
| Codes de connexion | Cloudflare Email Service | `code@mail.leximon.fr` |
| Campagnes | Lettermint | `bonjour@infos.leximon.fr` |
| Sauvegardes | Un dump chaque heure sur R2 en UE, un `pg_dump` chaque nuit sur le disque `tank` | — |

Le cookie de session est posé par `api.leximon.fr`, sur ce seul hôte. `leximon.fr` et `api.leximon.fr` sont le même site, donc le navigateur l'envoie avec chaque requête de l'app, sans cookie partagé entre sous-domaines. Les pages rendues par le serveur web (carte publique, profil public) lisent l'API sans session.

Coût : 5 $ par mois (Workers Paid). R2, Lettermint et Email Service restent dans leur offre gratuite ou incluse à cette échelle, et Workers VPC est gratuit pendant sa bêta.

## Le web sur Workers : sans `cacheComponents`

Avec Next.js 16.4.2 et `@opennextjs/cloudflare` 1.20.13, `cacheComponents` bloque les pages rendues par le serveur après la première d'un isolat (tickets OpenNext 1450 et 1464). Il est coupé, avec `partialPrefetching`, jusqu'au correctif (D-043). Vérifié le 2026-10-22 avec `pnpm --filter @leximon/web preview` : page publique d'une carte, profil public et images de partage répondent à chaque requête.

Pour le remettre : réactiver les deux options dans `apps/web/next.config.ts`, remettre `"use cache"` dans `src/cards/catalog-server.ts` et `src/profile/public-profile-data.ts`, puis refaire ce test.

## 0. Avant de commencer · toi

- Node 24, `pnpm install` à jour, sur la machine qui a la chaîne de contenu : `catalog:publish` copie les gravures et les sons depuis `content/pipeline/data/` (non versionné).
- Un gestionnaire de mots de passe pour y ranger chaque secret au moment où il est créé.
- La zone `leximon.fr` est dans le compte Cloudflare où les Workers seront déployés.

## 1. Forfait Workers Paid · toi

1. https://dash.cloudflare.com → **Compute** → **Workers plans** (ou le bouton **Upgrade** de Workers & Pages) → **Workers Paid** (5 $ par mois).
2. Il est nécessaire pour Queues et les Durable Objects. Il inclut aussi 3 000 e-mails par mois (Email Service) et lève la limite quotidienne d'Hyperdrive.
3. **Storage & databases** → **R2** → activer R2 (accepter les conditions). L'offre gratuite (10 Go) suffit.

## 2. Connexion de wrangler · toi

```bash
pnpm --filter @leximon/api exec wrangler login
pnpm --filter @leximon/api exec wrangler whoami   # doit afficher ton compte
```

wrangler n'est pas installé pour tout le système : il passe par pnpm, depuis la racine du dépôt. La session vaut pour toutes les commandes `wrangler` de la machine, y compris celles d'un agent.

## 3. Base Neon · toi

La production a quitté Neon le 2026-10-30 (étape 15 bis). Les étapes 3 et 4 restent pour le staging et pour un repli.

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

À la question « Would you like Wrangler to add it on your behalf? », répondre **no** (ou Ctrl+C) : il l'ajouterait à la config locale, pas à `env.production`.

Agent : recopier l'`id` affiché dans `apps/api/wrangler.jsonc`, `env.production.hyperdrive[0].id`. Commiter. (Fait le 2026-10-22.)

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

Le résumé du matin sur Discord (D-045), facultatif ; sans le webhook, rien ne part :

1. Discord → le salon → **Paramètres du salon** → **Intégrations** → **Webhooks** → **Nouveau webhook**, copier son URL.
2. Cloudflare → **Mon profil** → **Jetons d'API** → **Créer un jeton** → modèle personnalisé, permission **Compte · Workers Observability · Modifier** (l'API de requête est en écriture, elle ne modifie rien). L'identifiant du compte est dans la barre de droite de **Workers et Pages**.

```bash
pnpm exec wrangler secret put DISCORD_WEBHOOK_URL --env production
pnpm exec wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
pnpm exec wrangler secret put OBSERVABILITY_TOKEN --env production
```

Il part chaque matin après la maintenance (3 h 17 UTC) : erreurs des dernières 24 h groupées par Worker et message, puis l'activité du jour. Sans le jeton, il dit que les erreurs n'ont pas pu être lues. Pour être prévenu sur le moment d'une nouvelle erreur, Cloudflare → **Workers** → **Issues** permet d'ajouter une alerte par webhook.

Le compte des examinateurs de Google et d'Apple, facultatif : sans ces deux secrets, il n'existe pas. Cette adresse se connecte avec un code fixe de 6 chiffres, et aucun e-mail ne part. La mise en place est dans [fiches-stores.md](fiches-stores.md#compte-de-démonstration).

```bash
pnpm exec wrangler secret put REVIEW_ACCOUNT_EMAIL --env production
pnpm exec wrangler secret put REVIEW_ACCOUNT_CODE --env production
```

La connexion avec Google, facultative : sans ces deux secrets, le bouton n'apparaît pas. Ce sont ceux du client OAuth « Leximon production » de la console Google ([connexion-google.md](cahiers-des-charges/connexion-google.md#4-la-console-google--toi)).

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env production
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

L'abonnement Mécène, facultatif : sans ces deux secrets, rien n'est vendu et la page Mécène reste une annonce. Ce sont la clé secrète et le secret du webhook de production de Stripe ([mecene.md](cahiers-des-charges/mecene.md#11-stripe-pas-à-pas--toi)). La vente reste fermée tant que `PATRON_SALES` vaut `"closed"` dans `apps/api/wrangler.jsonc` : la page Mécène et son entrée dans le menu ne se montrent alors qu'aux admins et aux mécènes, qui seuls peuvent s'abonner. Passer `PATRON_SALES` à `"open"` ouvre la page à tous : c'est fait en production depuis le 2026-11-09 ; secrets posés le même jour.

```bash
pnpm exec wrangler secret put STRIPE_SECRET_KEY --env production
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET --env production
```

Le salon des mécènes sur Discord, facultatif : sans ces deux secrets et l'identifiant du rôle (`DISCORD_PATRON_ROLE_ID` dans `apps/api/wrangler.jsonc`), la page Mécène ne propose pas de relier son Discord. Ce sont le secret OAuth de l'application « Leximon Bot » et le jeton du bot ([mecene-avantages.md](cahiers-des-charges/mecene-avantages.md#4-rôle-et-salon-sur-le-discord)).

```bash
pnpm exec wrangler secret put DISCORD_CLIENT_SECRET --env production
pnpm exec wrangler secret put DISCORD_BOT_TOKEN --env production
```

## 7. Migrations · toi (la chaîne), agent (la commande)

`pnpm deploy:prod` fait tout cela seul. Pour un geste isolé, dans le terminal qui lance les commandes de production, ouvrir un tunnel SSH vers le conteneur de la base, puis :

```bash
ssh -N -L 54330:192.168.0.53:5432 pve &
export DATABASE_URL="$(cat ~/.config/leximon/home-db-url)"
pnpm db:migrate:prod
```

Les scripts `*:prod` refusent de tourner si `DATABASE_URL` est absente, locale ou sans TLS, et affichent l'hôte visé. Sans eux, les scripts liraient la base locale de `.env`.

## 8. Catalogue · agent

Même terminal, `DATABASE_URL` toujours exportée :

```bash
pnpm catalog:publish:prod
```

Met à jour les tables `collections` et `cards` de la base, puis copie les fichiers dans `apps/web/public/catalog/`, d'où le déploiement du web les envoie. **Après chaque publication, redéployer le web (étape 10) dans la foulée** : tant que ce n'est pas fait, les plis peuvent tirer des cartes que le site n'a pas encore.

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

Construit le site avec `NEXT_PUBLIC_API_URL=https://api.leximon.fr`, puis le déploie avec le catalogue et les en-têtes de cache (`apps/web/public/_headers` : un an pour les fichiers nommés par leur empreinte, une minute pour `manifest.json` et `engravings.json`). Refuse de partir si `public/catalog` est vide.

Le domaine `leximon.fr` est créé par le déploiement. Toi : supprimer avant tout enregistrement `A`, `AAAA` ou `CNAME` existant sur `leximon.fr` (une page d'attente, par exemple). Ne pas toucher aux `MX` ni aux `TXT`.

## 11. Redirection de www · fait

1. **DNS** → **Records** → ajouter `AAAA`, nom `www`, contenu `100::`, proxy **activé** (nuage orange).
2. **Rules** → **Redirect Rules** → modèle **Redirect from WWW to root** : `https://www.leximon.fr/*` vers `https://leximon.fr/${1}`, code 301, garder la query string.

## 12. E-mails · toi

Détail dans le [cahier des e-mails](cahiers-des-charges/e-mails.md).

**Codes de connexion (Cloudflare Email Service)**

1. **Compute** → **Email Service** → **Email Sending** → **Onboard Domain** → `mail.leximon.fr`. Cloudflare crée lui-même les enregistrements `cf-bounce` (MX, SPF, DKIM) et le DMARC du sous-domaine.
2. Attendre l'état vérifié.
3. **Demander une hausse du quota quotidien**, dès maintenant : un compte neuf démarre avec un quota prudent. Formulaire « Need a higher limit? » en bas de la page Limits d'Email Service (developers.cloudflare.com/email-service/platform/limits). Préciser : codes de connexion seulement, bêta de 40 personnes puis ouverture publique avec des pics pendant des streams.

**E-mails sur la partie (Cloudflare Email Service, D-050)**

1. **Onboard Domain** → `avis.leximon.fr`, comme `mail.leximon.fr` : un sous-domaine à part, pour que les rappels ne pèsent pas sur la réputation des codes.
2. Attendre l'état vérifié. Tant qu'il ne l'est pas, les envois sont refusés et journalisés, sans effet sur le jeu.
3. Le quota du jour est partagé avec les codes : `NOTIFY_DAILY_LIMIT` (200 par défaut, dans `wrangler.jsonc`) en garde pour eux. À relever avec la hausse de quota.

**Campagnes (Lettermint)**

1. Créer le compte sur lettermint.co, passer leur vérification de conformité.
2. Ajouter le domaine `infos.leximon.fr`, puis créer chez Cloudflare les enregistrements qu'ils donnent : deux `CNAME` DKIM (`lm1._domainkey.infos`, `lm2._domainkey.infos`) et le `CNAME` de retour, tous en **DNS only** (nuage gris).
3. Ajouter `TXT` `_dmarc.infos` = `v=DMARC1; p=none; rua=mailto:contact@leximon.fr; adkim=r; aspf=r`.
4. Créer un jeton d'envoi pour la route `broadcast`, puis un webhook vers `https://api.leximon.fr/email/webhooks/lettermint` (rebonds, plaintes, désinscriptions). Mettre le jeton et le secret du webhook en secrets (étape 6).
5. Leur demander de couper leur page de désinscription hébergée sur la route de diffusion.

**Domaine principal** : s'il n'existe pas, `TXT` `_dmarc` = `v=DMARC1; p=none; rua=mailto:contact@leximon.fr`. Le `MX` existant de `leximon.fr` ne bouge pas.

## 12 bis. Visites et recherche · toi, puis agent

D-052. Le site sert déjà `robots.txt` et `sitemap.xml`.

**Google Search Console**

1. Sur search.google.com/search-console, **Ajouter une propriété** → type **Domaine** → `leximon.fr`.
2. Google donne un `TXT` (`google-site-verification=…`). L'ajouter chez Cloudflare sur `leximon.fr` (nom `@`), puis **Valider**. Ne pas toucher aux autres `TXT`.
3. **Sitemaps** → `https://leximon.fr/sitemap.xml` → **Envoyer**.

**Umami, sur le serveur maison**

Les fichiers sont dans `infra/umami/` : Umami, sa base Postgres et un tunnel Cloudflare, qui publie `stats.leximon.fr` sans ouvrir de port chez toi.

**En place depuis le 2026-10-28** sur la VM `docker`, dossier `~/apps/leximon-umami/` : Umami et sa base tournent, la base sur le disque de la VM (`./data`, pas sur le partage virtiofs). Le tableau de bord est sur https://docker.tail148449.ts.net:8448, dans le tailnet seulement (`sudo tailscale serve --bg --https=8448 http://127.0.0.1:3000`) ; le mot de passe `admin` est dans `admin-password` (droits 600), le site `Leximon` est créé et son identifiant est dans `deploy:production`. Le tunnel `leximon-stats` (créé par `wrangler tunnel create`) publie `stats.leximon.fr` avec la seule route `^/(script\.js|api/send)$` vers `http://umami:3000` ; toute autre adresse répond 404. Son jeton est dans `.env`. Après une modification de `infra/umami/`, recopier les fichiers dans ce dossier.

Changer le jeton (Cloudflare → **Networking** → **Tunnels** → `leximon-stats` → **Refresh token**), puis le remettre dans `.env` sans qu'il passe par un chat :

```bash
ssh -t docker 'cd ~/apps/leximon-umami && read -rsp "Jeton du tunnel : " t && echo && t=${t##* } && sed -i "s|^TUNNEL_TOKEN=.*|TUNNEL_TOKEN=$t|" .env && docker compose up -d tunnel'
```

Vérifier : `curl -s https://stats.leximon.fr/script.js | head -c 80` répond du JavaScript, et `https://stats.leximon.fr/` répond 404. Après un déploiement du web, ouvrir leximon.fr sans bloqueur et regarder **Realtime** dans le tableau de bord.

La base d'Umami n'est pas sauvegardée : perdre les visites n'empêche pas de jouer.

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
   Un lien plein qui circule encore (post public) : « Ajouter des places » le rouvre sans changer d'adresse. Ceux qui tombent dessus quand il est plein laissent leur adresse dans la liste d'attente.
3. Sur ce lien, le testeur clique « Ouvrir mon premier sachet » et joue. Il crée son compte plus tard, sans nouveau lien.
4. Pour mesurer un canal, ajoute `?src=<code>` à tout lien posté (`https://leximon.fr/?src=tiktok-insultes`). Le premier code vu est gardé avec le joueur.
5. Suivi : `/admin/mesure` (rétention J1, J7, J30 par semaine, par lien ou source, par âge ; entonnoir ; fausse porte mécène ; liste des testeurs) et `/admin/retours` (le bouton « Un retour ? » du menu du joueur).

Ouvrir la bêta à tous : `BETA_INVITES` à `"off"` dans `env.production` de `apps/api/wrangler.jsonc`, et sans `NEXT_PUBLIC_BETA_INVITES=required` dans le script `deploy:production` de `apps/web/package.json` (l'accueil propose alors « Jouer » au lieu de la liste d'attente). Fait le 2026-11-08, mis en ligne par le `pnpm deploy:prod` suivant. Pour refermer la porte, remettre les deux à `required`.

Pour forcer la mise à jour de l'app mobile (quand l'API cesse de servir ce dont une vieille version a besoin) : passer `MOBILE_MIN_VERSION` à la version voulue (`"1.2.0"`) dans `env.production`, puis `pnpm deploy:api`. Une app plus ancienne affiche « Leximon a changé » à son prochain lancement ou retour au premier plan, avec un bouton vers le store.

## 14. Vérifications · toi et agent

| Test | Comment | Attendu |
|---|---|---|
| API | `curl https://api.leximon.fr/health` | `{"status":"ok"}` |
| Catalogue | `curl -I https://leximon.fr/catalog/manifest.json` | 200, `Cache-Control: public, max-age=60, must-revalidate` |
| Fichier immuable | `curl -I` sur un fichier de `collections/` cité par le manifeste | `max-age=31536000, immutable` |
| www | `curl -I https://www.leximon.fr/jouer` | 301 vers `https://leximon.fr/jouer` |
| Porte | Fenêtre privée sur https://leximon.fr/jouer | Bêta ouverte : le jeu s'ouvre en invité. Bêta fermée : renvoie vers « Sur invitation » |
| Invité | Fenêtre privée sur un lien de `/admin/invitations` | Le jeu s'ouvre, des plis à ouvrir ; une place prise dans l'admin |
| Code | Demander un code avec une adresse Gmail | Reçu en moins d'une minute, hors spam. « Afficher l'original » : DKIM `pass` pour `mail.leximon.fr` |
| Pli | Ouvrir un pli | Les cartes s'affichent avec leur gravure et leur son |
| Carte publique | https://leximon.fr/carte/accastillage, deux fois | La carte s'affiche, l'image de partage aussi |
| Erreurs | `pnpm --filter @leximon/api exec wrangler tail --env production` pendant les tests | Aucune erreur |
| Maintenance | Le lendemain, **Workers** → `leximon-api-production` → **Logs** | Une ligne « Maintenance done » après 3 h 17 UTC |
| Résumé | Le lendemain matin, le salon Discord | Un message « Leximon · <jour> », sans « lecture impossible » |
| En-têtes | `curl -I https://leximon.fr` | `content-security-policy` et `strict-transport-security` présents |

## 15. Sauvegardes · fait

La copie qui survit à la perte du serveur est celle de R2, chaque heure (étape 15 bis). Cette étape décrit la seconde : un `pg_dump` chaque nuit sur le pool ZFS `tank`, donc sur un autre disque que la base, gardé 30 jours. Les fichiers sont dans `infra/backup/`.

**En place depuis le 2026-10-26** sur le serveur maison : VM `docker` (Proxmox `pve`, joignable par Tailscale), dossier `~/apps/leximon-backup/`, sauvegardes dans `/mnt/media/backups/leximon`. Après une modification de `infra/backup/`, recopier les scripts dans ce dossier.

1. Y créer `.env` depuis `.env.example`, avec la chaîne de la base et le dossier de destination (`BACKUP_PATH`). Restreindre le fichier : `chmod 600 .env`.
2. Lancer :

```bash
docker compose up -d                                   # une sauvegarde chaque nuit à 4 h 30
docker compose run --rm backup /scripts/backup.sh      # une tout de suite
docker compose logs backup                             # « backup ok: … »
```

3. **Test de restauration**, une fois par mois :

```bash
docker compose run --rm backup /scripts/restore-test.sh
```

Il restaure le dernier fichier dans un Postgres jetable, à l'intérieur du conteneur, et compte les joueurs, les exemplaires, les cartes et les migrations. Il ne touche ni à la base ni aux sauvegardes.

Une sauvegarde ratée ne supprime aucune ancienne : la rotation ne passe qu'après un fichier vérifié.

### Restaurer pour de vrai

Si le serveur est perdu, le jeu repart sur Neon, en sommeil et gratuit, depuis le dernier fichier de R2. Le projet garde la base `neondb` d'avant la bascule, gelée en lecture seule : la nouvelle copie va dans une base vide.

1. Cloudflare → **R2** → `leximon-backups` → `hourly/` → télécharger le fichier le plus récent, puis le déchiffrer avec la clé privée du gestionnaire de mots de passe (D-061), copiée dans un fichier le temps du geste : `age --decrypt --identity cle.txt --output leximon-AAAAMMJJ-HHMMSS.dump leximon-AAAAMMJJ-HHMMSS.dump.age`. Les fichiers d'avant le chiffrement finissent par `.dump` et se restaurent tels quels.
2. Neon → **Databases** → **New database**, nommée `leximon`, puis récupérer sa chaîne directe.
3. Restaurer : `docker run --rm -v "$PWD:/backups" postgres:18.6-alpine pg_restore --no-owner --no-privileges --exit-on-error -d "postgresql://…nouvelle chaîne…" /backups/leximon-AAAAMMJJ-HHMMSS.dump`.
4. Vérifier les données, puis faire pointer l'ancienne configuration Hyperdrive dessus : `pnpm --filter @leximon/api exec wrangler hyperdrive update 43b07b65f2ab4ed797bc424b4e32e632 --connection-string="…"`.
5. Dans `apps/api/wrangler.jsonc`, section `production` : remettre cet identifiant dans `hyperdrive` et ajouter `"placement": { "region": "aws:eu-central-1" }`, puis `pnpm deploy:api`.

## 15 bis. Base sur le serveur maison · fait

La production tourne ici depuis le 2026-10-30 (D-053), jusqu'à ce que les mécènes couvrent une offre cloud.

**Ce qui est en place :**

- Conteneur Proxmox `leximon-db` (LXC 102, Debian 13, 2 cœurs, 1,5 Go, `192.168.0.53`), séparé de la VM `docker`, sur le SSD. Il démarre avec la machine.
- Postgres 18.6, réglé par `infra/home-db/postgres.conf`. Hors du conteneur, `pg_hba.conf` n'accepte `leximon_app` qu'en TLS, depuis `pve` (tunnel SSH, `192.168.0.8`) et la VM `docker` (`192.168.0.51`).
- Tunnel Cloudflare `leximon-db` (service `cloudflared` du conteneur), service Workers VPC `leximon-db` et configuration Hyperdrive `leximon-db-nas`, sans cache. Aucun port n'est ouvert et la base n'a aucun nom public.
- Certificat Cloudflare Origin pour `db.leximon.fr`, valable jusqu'en 2041 et vérifié par Workers VPC. Sa clé n'a jamais quitté le conteneur. Le nom n'existant pas en public, le petit résolveur `leximon-dns` du conteneur (`infra/home-db/leximon-dns.service`) le donne à `cloudflared`.
- Bucket R2 `leximon-backups`, en juridiction UE, rempli par `leximon-backup.timer` : `hourly/` gardé 3 jours, et `daily/` gardé 30 jours pour le dump de 3 h UTC.
- Les dumps partent chiffrés par `age` (D-061) pour la clé publique de `/etc/leximon/backup-recipients`. La clé privée n'est pas sur le serveur : elle est dans le gestionnaire de mots de passe du propriétaire, avec une copie sur papier. Sans clé publique, la sauvegarde s'arrête et l'alerte Discord part au bout de 3 heures.
- Toutes les 5 minutes, le Worker de production essaie la base et regarde l'âge du dernier dump. Il prévient sur Discord à la deuxième base muette ou au-delà de 3 heures sans dump, puis au retour à la normale. Son état vit dans le KV `leximon-watchdog`.
- L'API de staging reste sur la branche Neon `charge` ([rnd/charge.md](rnd/charge.md)), pour qu'un test de charge ne touche jamais la production.
- Mot de passe de la base : `~/.config/leximon/home-db-url` sur le PC du propriétaire, écrit pour le tunnel SSH de l'étape 7.

**Gestes courants :**

```bash
ssh pve pct exec 102 -- systemctl start leximon-backup.service        # une sauvegarde tout de suite
ssh pve pct exec 102 -- journalctl -u leximon-backup.service -n 20    # « backup ok: … »
ssh -t pve pct exec 102 -- /usr/local/bin/leximon-set-r2-keys         # changer les clés R2
```

**Mettre le chiffrement en place, ou changer de clé.** Dans cet ordre, sinon les sauvegardes s'arrêtent :

```bash
age-keygen                                  # sur le PC (paquet `age`) : affiche la clé privée (AGE-SECRET-KEY-…) et la publique (age1…)
ssh pve pct exec 102 -- apt-get install -y age
ssh pve pct exec 102 -- sh -c 'echo "age1…" > /etc/leximon/backup-recipients && chmod 644 /etc/leximon/backup-recipients'
ssh pve pct exec 102 -- sh -c 'cat > /usr/local/bin/leximon-backup' < infra/home-db/backup.sh
ssh pve pct exec 102 -- systemctl start leximon-backup.service
```

La clé privée va dans le gestionnaire de mots de passe et sur papier, nulle part ailleurs. Après un changement de clé, garder l'ancienne 30 jours, le temps que ses dumps expirent. Une fois par mois, avec le test de restauration de l'étape 15, télécharger le dernier fichier de `hourly/`, le déchiffrer et lancer `pg_restore --list` dessus : une clé qu'on n'a jamais essayée n'est pas une sauvegarde.

**Si le serveur tombe :** l'alerte arrive sur Discord en 10 minutes environ. Un redémarrage rend l'API en 2 minutes, sans rien à faire. Si le serveur ne revient pas, suivre « Restaurer pour de vrai » : on perd au plus une heure de parties.

**Limites connues :** un seul SSD d'entrée de gamme, pas d'onduleur, disque non chiffré (à faire), Workers VPC encore en bêta. À 5 itérations par seconde, le p95 de l'ouverture d'un sachet est à 188 ms, au-dessus du budget de 150 ms, sans cause établie.

**Matériel à acheter plus tard**, par ordre d'utilité, pour le HP ProDesk 600 G6 Microtower (4 emplacements de mémoire dont 1 occupé, 2 emplacements M.2 2280 de stockage dont 1 occupé d'après HP) :

| Priorité | Matériel | Référence | Pourquoi |
|---|---|---|---|
| 1 | Barrette DDR4-3200 UDIMM 16 Go, non ECC | SK Hynix HMA82GU6DJR8N-XN (la même), ou Crucial CT16G4DFRA32A, ou Kingston KVR32N22D8/16 | Double canal, et de la marge pour la VM et le conteneur |
| 2 | Second SSD NVMe M.2 2280, 500 Go | WD Red SN700 (WDS500G1R0C) | Miroir du SSD actuel, d'entrée de gamme : une panne de disque n'arrête plus le jeu |
| 3 | Onduleur avec USB | Eaton Ellipse ECO 650 FR (EL650USBFR) ou APC BX950MI-FR | Arrêt propre de Postgres et de Proxmox lors d'une coupure |
| 4 | Second disque 8 To | Seagate IronWolf ST8000VN004 (le même) | Miroir du pool `tank`, qui ne tient aujourd'hui que sur un disque |

Le processeur plafonne la mémoire à 2 666 MT/s : inutile de payer plus que du DDR4-3200.

## 16. Revenir en arrière · agent

Un déploiement raté :

```bash
cd apps/api && pnpm exec wrangler deployments list --env production
pnpm exec wrangler rollback --env production            # version précédente
cd ../web && pnpm exec wrangler rollback --env production
```

Le retour en arrière ne touche que le code. Les migrations sont additives, donc l'ancienne version de l'API marche sur la nouvelle base : on ne défait jamais une migration en production. Une donnée abîmée se répare depuis une sauvegarde (étapes 15 et 15 bis).

## Après la mise en ligne

**Mettre en prod : `pnpm deploy:prod`.** Le script ([infra/prod/deploy.sh](../infra/prod/deploy.sh)) refuse de partir hors de `main` ou avec des fichiers non commités, qui partiraient en ligne. Il lance ensuite `pnpm check` et `pnpm test:integration` (Docker lancé, base `leximon_test`), les migrations, le catalogue si une version plus récente que celle en ligne existe, l'API, le web, puis contrôle que les deux répondent. La chaîne de la base vient de `DATABASE_URL`, sinon de `~/.config/leximon/home-db-url` (droits 600), et le script ouvre seul le tunnel SSH vers le conteneur. Les commandes ci-dessous restent pour un geste isolé.

**Thèmes des cartes :** le serveur lit les thèmes dans `card_themes`, écrits à la publication du catalogue. Le déploiement ne republie que si une version plus récente existe : après l'ajout de cette écriture, lancer une fois `pnpm catalog:publish:prod`, sans quoi les révisions par thème restent vides jusqu'au prochain catalogue.

**Énigme du jour :** le serveur choisit le mot dans `riddle_words`, écrit à la publication du catalogue. Après la migration qui crée cette table, lancer une fois `pnpm catalog:publish:prod` (tunnel de l'étape 7), sinon l'écran dit qu'il n'y a pas d'énigme. `RIDDLE_FIRST_DAY` (`packages/core/src/rules.ts`) donne le jour de l'énigme n° 1 : le caler sur le jour de la mise en ligne.

**Joutes :** une question de joute affiche la définition gardée dans `cards.definition`, écrite à la publication du catalogue. Après la migration qui crée cette colonne, lancer une fois `pnpm catalog:publish:prod` (tunnel de l'étape 7), sinon une joute ne peut pas se lancer. Les joutes ne s'ouvrent qu'aux testeurs cochés sur leur fiche dans `/admin`.

**Nouveautés :** un changement que les joueurs voient s'annonce dans `CHANGELOG`, en tête de `packages/view-model/src/changelog.ts`, daté du jour de la mise en ligne et commité avant `pnpm deploy:prod`. Le web montre l'entrée une fois à chaque joueur (niveau 5 et plus, une fois par appareil) et la garde sur `/nouveautes`. L'app ne la montre qu'avec le build suivant, puisqu'elle embarque le journal : une entrée qui ne concerne que le web le dit dans son texte.

- Ajouter un réglage ou une liaison à l'API : l'écrire en haut de `apps/api/wrangler.jsonc` (local) **et** dans `env.production`. Wrangler ne recopie ni les variables ni les liaisons dans un environnement.
- Nouvelle version du catalogue : `pnpm catalog:publish:prod` (tunnel de l'étape 7) puis `pnpm deploy:web`, dans cet ordre et dans la foulée.
- Nouvelle migration : `pnpm db:migrate:prod` (tunnel de l'étape 7) avant `pnpm deploy:api`.
