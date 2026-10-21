# Cahier des charges · E-mails

- **Statut :** validé par le propriétaire (2026-10-21). Les cinq choix sont tranchés : D-034 (fournisseurs), D-035 (file et schéma), D-036 (rendu), P61 (consentement).
- **Décisions liées :** D-005 (Cloudflare, Queues), D-018 (limites de débit), D-030 (code par e-mail), D-031 (administration).
- **Règles liées :** P37 (inscription par code), P54, P55 (liste d'attente : un seul e-mail, puis effacement), P61 (consentement), P8 (15 ans et plus).
- **Objectif :** que Leximon écrive pour de vrai. (A) Les codes de connexion partent. (B) L'admin envoie des campagnes, la première étant l'e-mail d'ouverture à la liste d'attente.

## Ce qui existe

- La connexion passe par un code à 6 chiffres (plugin `emailOTP`), envoyé par l'interface `EmailSender` (`apps/api/src/account/email-sender.ts`).
- En développement local, le code s'affiche dans la console avec l'adresse masquée (`maskEmail`). Ailleurs, l'envoi échoue volontairement (`EmailSenderNotConfiguredError`) et la route répond 503.
- L'envoi des codes a ses limites de débit : 5 par minute et par IP, 1 par minute et par adresse (clé HMAC, jamais l'adresse).
- La liste d'attente (`waitlist_signups`) ne garde que l'adresse et la date. L'admin la consulte et l'exporte en CSV, chaque export est journalisé dans `admin_actions`.
- L'API est un Worker avec une seule tâche planifiée (maintenance quotidienne). Aucune file n'est branchée.
- `/confidentialite` dit : « pas de traceur », un seul e-mail pour la liste d'attente, puis effacement.

## Hors périmètre

- Les e-mails automatiques du jeu (rappel de révision, offre d'échange reçue). Ils viendront après, sur la même base.
- L'édition riche (glisser-déposer, images). Une campagne est un texte court avec au plus un bouton.
- Le suivi des ouvertures et des clics : aucun pixel, aucun lien traqué. `/confidentialite` promet « pas de traceur ».

## Choix tranchés

Les options écartées restent ci-dessous pour mémoire.

### 1. Fournisseurs d'envoi : Cloudflare pour les codes, Lettermint pour les campagnes (D-034)

**Point bloquant découvert :** Scaleway Transactional Email, recommandé par D-030, interdit les e-mails marketing (« You cannot use Transactional Email to send marketing emails », FAQ Scaleway). Cloudflare Email Service aussi (« Can I use Email Service for marketing emails? No. »). Une campagne vers les joueurs est un e-mail marketing.

| | Cloudflare Email Service | Lettermint | Brevo | Scaleway TEM | Amazon SES (Paris) |
|---|---|---|---|---|---|
| Société, hébergement | Cloudflare, déjà notre hébergeur (D-005) | Lettermint B.V. (Pays-Bas), infrastructure UE (UpCloud, OVH) | Brevo (Paris), données en UE | Scaleway (France), `fr-par` | Amazon (États-Unis), `eu-west-3` |
| Codes et campagnes | **Codes seulement** | Oui, sur deux routes séparées | Oui | **Codes seulement** | Oui |
| Gratuit | 3 000 par mois inclus dans Workers Paid | 300 par mois | 300 **par jour** | 300 par mois | Crédits de bienvenue AWS seulement |
| Au-delà | 0,35 $ les 1 000 | Forfaits mensuels : 40 à 55 € le mois à 50 000 | Forfaits mensuels | 0,25 € les 1 000 | 0,10 $ les 1 000 |
| Appel depuis le Worker | Liaison `send_email`, sans clé | `fetch`, en-tête `x-lettermint-token` | `fetch`, clé d'API | `fetch`, clé d'API | Signature SigV4 à écrire |
| Envoi par lots | Non (50 destinataires par e-mail) | 500 e-mails par appel, **une clé d'idempotence par e-mail** (24 h) | 1 000 variantes par appel | Non | 50 par appel |
| Rebonds et plaintes | Événements dans une file Queues | Webhooks signés HMAC-SHA256 | Webhooks à jeton, non signés | Webhooks via SNS, signature X.509 | SNS, signature X.509 |
| Limite | Bêta publique, quota quotidien prudent au départ | Société jeune et petite | Plafond quotidien de l'offre gratuite | Interdit les campagnes | Société américaine, plus de code |

**Choix du propriétaire :**

- **Codes : Cloudflare Email Service.** Les 3 000 e-mails mensuels sont inclus dans Workers Paid, qu'on paie de toute façon pour Queues. Pas de clé, pas de nouveau sous-traitant, et surtout pas de plafond quotidien : une offre gratuite à 300 par jour bloquerait le 301e inscrit d'un stream.
- **Campagnes : Lettermint**, en offre gratuite (300 par mois, assez pour les tests et les petites listes). On passe à un palier payant le seul mois d'un envoi de masse. Il dédoublonne chaque e-mail d'un lot et signe ses webhooks.
- Deux sous-domaines, donc deux réputations : une plainte sur une campagne ne bloque jamais les connexions.

**À faire à l'ouverture des comptes :**
- Cloudflare : demander une hausse du quota quotidien avant l'ouverture (formulaire de leur page « Limits »).
- Lettermint : passer leur vérification de conformité ; demander la coupure de la page de désinscription hébergée sur la route de diffusion. À défaut, on garde la leur et on reçoit les désinscriptions par webhook (`message.unsubscribed`).

### 2. File pour les envois de masse : Cloudflare Queues (D-035)

| | A. Cloudflare Queues, alimentée par une tâche planifiée | B. Postgres seul, vidé par une tâche planifiée | C. Cloudflare Workflows |
|---|---|---|---|
| Principe | Une tâche planifiée chaque minute met en file la part de la minute (débit choisi). Le consommateur envoie par lots de 100. | La tâche planifiée envoie elle-même, par lots, pendant au plus une minute. | Une exécution durable par campagne, une étape par lot. |
| Reprises | Natives : `retry()` avec délai, file des messages morts | À coder (compteur de tentatives, délai) | Natives, par étape |
| Débit | Réglé par la tâche planifiée, concurrence plafonnée | Réglé par la tâche, une seule exécution à la fois | Pauses `sleep` entre les lots |
| Pause, annulation | Immédiates : la tâche n'alimente plus, le consommateur rend les lignes | Immédiates | Un signal à envoyer à l'exécution |
| Coût | Inclus dans Workers Paid (500 messages pour 50 000 e-mails) | Rien | Inclus, mais limites d'étapes par exécution |
| Ce qui reste à faire après | Les notifications du jeu utiliseront la même file (D-005) | Une file quand même pour les autres tâches | Une autre primitive à apprendre |

**Recommandation : A.** C'est la file déjà prévue par D-005 et par AGENTS.md. La base reste la seule source de vérité : la file ne transporte que des identifiants de lignes, donc un message perdu, rejoué ou en double ne change rien (détail plus bas).

La tâche planifiée passe d'une fois par jour à chaque minute. La maintenance quotidienne garde son horaire, distinguée par `controller.cron`.

### 3. Schéma (D-035)

Trois tables nouvelles, une migration additive.

**`email_campaigns`**

| Colonne | Rôle |
|---|---|
| `id` | uuid |
| `name`, `subject`, `body_markdown` | Le contenu. Le corps est rendu à l'envoi par notre modèle (choix 5). |
| `button_label`, `button_url` | Au plus une action par e-mail (`docs/voix.md`). URL en `https://` uniquement. |
| `audience` | `waitlist`, `players` (joueurs consentants, choix 4) ou `test` |
| `test_recipients` | Adresses de la liste de test (20 au plus), seulement pour `test` |
| `status` | `draft` → `scheduled` → `sending` ⇄ `paused` → `completed`, ou `cancelled` |
| `rate_per_minute` | Débit plafond, 1 000 par défaut |
| `scheduled_at`, `launched_at`, `completed_at`, `waitlist_erased_at` | Dates clés |
| `created_by`, `launched_by` | Admins (`users.id`) |
| `recipient_count` | Figé à la confirmation |

Index unique partiel : une seule campagne `waitlist` peut avoir `launched_at` rempli. C'est la base, pas l'interface, qui interdit le second envoi.

**`email_campaign_sends`** (une ligne par destinataire)

| Colonne | Rôle |
|---|---|
| `id` | uuid. **C'est la clé d'idempotence envoyée au fournisseur** et la cible du lien de désinscription. |
| `campaign_id`, `email`, `user_id` | Unicité `(campaign_id, email)`. `user_id` rempli pour un joueur. `email` effacé après la campagne (voir plus bas). |
| `status` | `pending`, `queued`, `sending`, `sent`, `failed`, `bounced`, `complained`, `suppressed`, `cancelled` |
| `attempts`, `claimed_at`, `sent_at`, `provider_message_id`, `last_error` | Suivi. `last_error` ne contient jamais l'adresse. |

Index `(campaign_id, status)` pour les compteurs et pour la reprise.

**`email_suppressions`**

| Colonne | Rôle |
|---|---|
| `email` | Clé primaire, en minuscules |
| `reason` | `unsubscribed`, `hard_bounce`, `complaint`, `manual` |
| `source` | Campagne ou webhook d'origine |
| `created_at` | |

Elle s'applique à toutes les campagnes, jamais aux codes de connexion : un joueur désinscrit doit pouvoir se connecter. Les rebonds durs sur les codes sont bloqués par la liste de suppression propre à Cloudflare.

L'adresse y reste en clair. C'est la liste d'opposition que la CNIL demande de garder, et la comparer à l'audience reste une simple jointure. Variante possible : une empreinte HMAC, mais il faudrait `pgcrypto` pour comparer en SQL.

**Durée de conservation :** les adresses de `email_campaign_sends` sont effacées 30 jours après la fin d'une campagne (maintenance quotidienne), ou dès l'effacement de la liste d'attente pour celle-ci. Les compteurs restent.

**Transfert d'invité (D-030) :** la table de consentement (choix 4) a une clé étrangère vers `users.id`. Le test qui liste ces clés l'exigera : un invité n'a pas d'adresse, donc rien à transférer, mais le cas sera écrit.

### 4. Consentement pour écrire aux joueurs : opt-in explicite (P61)

C'est un choix métier : il est inscrit dans `regles-du-jeu.md` (P61) et dans `/confidentialite`.

| | A. Opt-in explicite | B. Soft opt-in (CNIL) |
|---|---|---|
| À l'inscription | Une case **non cochée** : « M'écrire quand il y a du nouveau » | Une mention avec une case pour refuser, cochée par défaut côté « j'accepte » |
| Base légale | Consentement, sans discussion | Exception « client » : la CNIL la réserve aux coordonnées recueillies lors d'une vente ou d'une prestation, pour des produits analogues. Un jeu gratuit ne rentre pas clairement dedans. |
| Joueurs de 15 à 17 ans | Rien à justifier | Prospection de mineurs sans consentement : exposé |
| Audience | Plus petite | Plus grande |
| Délivrabilité | Liste engagée, peu de plaintes | Plus de plaintes, et Gmail coupe au-delà de 0,3 % |

**Recommandation : A.**

- Une case non cochée à la création du compte, et le même interrupteur dans les réglages.
- Le consentement est daté et sa source gardée (`inscription`, `réglages`), comme preuve.
- Se désinscrire d'une campagne retire le consentement.
- Les e-mails nécessaires au service (code, sécurité, changement des conditions) ne demandent aucun consentement et ne passent pas par les campagnes.

Table `email_consents (user_id, granted_at, source, revoked_at)` plutôt qu'une colonne dans `users` : on ne touche pas au schéma de Better Auth et on garde l'historique.

### 5. Rendu des modèles : maison, sans dépendance (D-036)

| | A. Modèle maison, sans dépendance | B. React Email | C. MJML |
|---|---|---|---|
| Principe | Gabarit en tableau HTML, styles en ligne, et un petit convertisseur Markdown écrit par nous | Composants React rendus en HTML | Langage de balises compilé en HTML |
| Dans un Worker | Oui | Oui, mais React et son moteur de rendu dans l'API | Non, il dépend de Node |
| Sécurité | On échappe tout. Le Markdown n'accepte ni HTML ni image. | Dépend de l'usage | Dépend de l'usage |
| Dépendances | Aucune | Deux ou trois | Une, lourde |

**Recommandation : A.**

- Le Markdown accepté est réduit : paragraphes, `**gras**`, `*italique*`, liens `https://`, listes à puces, intertitres `##`. Le reste s'affiche tel quel, échappé.
- Le gabarit fait 600 px de large, en tableaux et en styles en ligne (ce que lisent Outlook, Gmail et Apple Mail). Il utilise une police serif système (Georgia) et les couleurs papier de D-022, sans image distante : rien n'est bloqué, rien ne trace.
- Chaque e-mail part en HTML et en texte brut, rendus par la même fonction pure.
- Les tests vérifient l'échappement, la version texte et la présence des en-têtes.

## Volet A · Les codes de connexion

### Envoi

- `cloudflareEmailSender` implémente `EmailSender` : un appel à la liaison `send_email` (`env.EMAIL.send`), sans clé ni `fetch`.
- **Choix de l'envoyeur :**
  - développement local : la console, comme aujourd'hui ;
  - expéditeur configuré (`EMAIL_CODE_FROM` non vide) : Cloudflare ;
  - sinon : `EmailSenderNotConfiguredError`. Le comportement « fail closed » ne change pas.
- **Erreurs :** la liaison lève une erreur avec un `code`.
  - `E_RATE_LIMIT_EXCEEDED`, `E_DAILY_LIMIT_EXCEEDED`, `E_INTERNAL_SERVER_ERROR` et `E_DELIVERY_FAILED` donnent une erreur typée « temporaire » ;
  - les autres codes donnent une erreur « refusée » ;
  - le journal ne garde que le code, jamais le message ni l'adresse.
- **Variables :** `EMAIL_CODE_FROM` (`Leximon <code@mail.leximon.fr>`) et `EMAIL_REPLY_TO` (`contact@leximon.fr`). Aucun secret.
- **Liaison restreinte :** la liaison `send_email` n'accepte que l'expéditeur des codes (`allowed_sender_addresses`). Un bogue ailleurs dans l'API ne peut pas s'en servir pour écrire au nom de Leximon depuis une autre adresse.
- **En développement,** `wrangler dev` simule la liaison et la console garde le code, comme avant.

### Le modèle du code

Validé par le propriétaire le 2026-10-21.

**Objet :** `482913, ton code Leximon`. Le code se lit dans la notification, sans ouvrir l'e-mail.

**Texte :**

```
482913

Ton code pour entrer dans Leximon. Il vaut 10 minutes.

Pas demandé ? Ignore ce message.

Leximon · leximon.fr
```

**HTML :**
- même texte ;
- le code en grand, chasse fixe, lettres espacées, sur un cartouche papier ;
- aucun lien sauf le pied de page ;
- aucun lien de désinscription, aucun en-tête `List-Unsubscribe`.

Ton fonctionnel, donc neutre et sec (`docs/voix.md`) : pas de clin d'œil, pas de « ne partage jamais ce code ».

### Domaines d'envoi et DNS

Deux sous-domaines, un par fournisseur, pour que la réputation des campagnes ne touche ni les codes ni `contact@leximon.fr` :

| Usage | Sous-domaine | Expéditeur | Fournisseur |
|---|---|---|---|
| Codes de connexion | `mail.leximon.fr` | `Leximon <code@mail.leximon.fr>` | Cloudflare Email Service |
| Campagnes | `infos.leximon.fr` | `Leximon <bonjour@infos.leximon.fr>` | Lettermint (volet B) |

Les réponses vont à `contact@leximon.fr`. Le MX existant de `leximon.fr` n'est pas touché.

**Codes, Cloudflare.** Si la zone `leximon.fr` est chez Cloudflare, l'intégration (« Email Sending » puis « Onboard Domain » sur `mail.leximon.fr`) crée elle-même ces enregistrements :

| Type | Nom | Valeur | Rôle |
|---|---|---|---|
| MX (×3) | `cf-bounce.mail.leximon.fr` | `route1.mx.cloudflare.net`, `route2…`, `route3…` | Retour des rebonds |
| TXT | `cf-bounce.mail.leximon.fr` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF |
| TXT | `cf-bounce._domainkey.mail.leximon.fr` | clé donnée par Cloudflare | DKIM |
| TXT | `_dmarc.mail.leximon.fr` | `v=DMARC1; p=none; rua=mailto:contact@leximon.fr` | DMARC du sous-domaine |

**Campagnes, Lettermint** (valeurs exactes dans leur tableau de bord après l'ajout de `infos.leximon.fr`) :

| Type | Nom | Valeur | Rôle |
|---|---|---|---|
| CNAME | `lm1._domainkey.infos.leximon.fr` | donnée par Lettermint | DKIM, clé 1 |
| CNAME | `lm2._domainkey.infos.leximon.fr` | donnée par Lettermint | DKIM, clé 2 (rotation automatique) |
| CNAME | sous-domaine de retour donné par Lettermint | donnée par Lettermint | Return-Path : rebonds et SPF aligné, pas de SPF séparé |
| TXT | `_dmarc.infos.leximon.fr` | `v=DMARC1; p=none; rua=mailto:contact@leximon.fr; adkim=r; aspf=r` | DMARC, exigé par Gmail et Yahoo pour les envois de masse |

**Pour le domaine principal :** `_dmarc.leximon.fr` en `v=DMARC1; p=none; rua=mailto:contact@leximon.fr`, s'il n'existe pas encore. Toutes les politiques passeront à `p=quarantine` après quelques semaines de rapports propres.

- Les CNAME de Lettermint restent en « DNS only » (nuage gris) chez Cloudflare.
- Les rapports DMARC arriveront dans `contact@leximon.fr`. Un service de lecture des rapports pourra venir plus tard.

### Rebonds des codes

On ne branche pas les événements de Cloudflare pour les codes. Cloudflare tient sa propre liste de suppression (rebonds durs, plaintes) et refuse l'envoi à une adresse qui y figure (`E_RECIPIENT_SUPPRESSED`, rangé dans « refusée »). Notre liste de suppression ne sert qu'aux campagnes (volet B).

### Tests du volet A

- Rendu du code : objet, texte, HTML, échappement, pas de lien de désinscription.
- Envoyeur Cloudflare avec une liaison simulée : message envoyé, erreurs temporaires et refusées, aucune adresse ni message d'erreur du fournisseur dans les journaux.
- Choix de l'envoyeur : console en local, Cloudflare si l'expéditeur est configuré, refus sinon.

## Volet B · Les campagnes dans `/admin`

### Écrans

**Campagnes :** la liste avec statut et compteurs, et un bouton « Nouvelle campagne ».

**Édition d'une campagne (brouillon) :**
- nom, objet (compteur de mots, alerte au-delà de 5), corps en Markdown, bouton (libellé et lien), audience ;
- aperçu HTML (dans une `iframe` isolée) et texte, rendu par l'API avec le vrai modèle ;
- « M'envoyer un test » : un envoi immédiat à l'adresse de l'admin connecté, objet préfixé `[Test]`, hors file et hors compteurs.

**Lancement :**
- l'API calcule le nombre exact de destinataires, suppression déduite ;
- l'écran l'affiche et demande de **taper ce nombre** pour confirmer ;
- au choix, envoi immédiat ou à une date ;
- bouton : « Envoyer à 48 213 adresses ».

**Suivi :**
- compteurs : en attente, envoyés, échoués, rebonds, plaintes, désinscriptions ;
- boutons « Mettre en pause », « Reprendre », « Annuler l'envoi ».

**Liste d'attente :**
- l'écran existant gagne l'état de la campagne d'ouverture ;
- une fois la campagne terminée ou annulée, il propose « Effacer les 48 213 adresses », confirmé par saisie.

### Lancer

La confirmation fait tout dans une transaction :
- relire le compte ;
- refuser s'il a changé (réponse `recipient_count_changed` avec le nouveau nombre) ;
- créer les lignes d'envoi en un seul `INSERT … SELECT` (audience moins suppression) ;
- passer la campagne en `scheduled` ou `sending` ;
- journaliser dans `admin_actions` (`launch_campaign`, avec le nombre et la date prévue).

**La liste est figée à la confirmation**, même pour un envoi programmé. Un joueur qui consent après ne la reçoit pas. Un joueur qui se désinscrit entre-temps est quand même écarté au moment de l'envoi.

La confirmation porte une clé d'idempotence, comme les autres actions admin : un double clic ne lance rien deux fois.

### Envoyer par la file

Les lignes passent par ces statuts :

```
pending ──(tâche de la minute)──▶ queued ──(consommateur)──▶ sending ──▶ sent
                                                                     ├─▶ failed (refus définitif)
                                                                     └─▶ pending (erreur temporaire, nouvel essai)
```

1. **Chaque minute,** la tâche planifiée démarre les campagnes programmées échues. Pour chaque campagne en `sending`, elle prend au plus `rate_per_minute` lignes `pending` (`FOR UPDATE SKIP LOCKED`), les passe en `queued`, puis les met en file par messages de 100 identifiants, étalés sur la minute (`delaySeconds`).
2. **Le consommateur** (`max_batch_size` 1, concurrence plafonnée à 4) :
   - réserve ses lignes d'un seul `UPDATE … SET status = 'sending' WHERE id = ANY(…) AND status = 'queued' AND campagne en sending RETURNING` ;
   - écarte celles qui sont entre-temps dans la suppression (`suppressed`) ;
   - envoie le lot par `POST /v1/send/batch`, chaque e-mail avec `idempotency_key = send.id` ;
   - marque `sent` avec l'identifiant du message.
3. **Erreur temporaire** (429, 5xx, délai dépassé) : les lignes repassent en `pending`, et le message est rejoué avec le délai de `Retry-After`, ou un délai croissant à défaut. Au-delà de 5 essais par ligne, la ligne passe en `failed`.
4. **Refus partiel d'un lot :** Lettermint renvoie les e-mails acceptés avant l'échec (`details.accepted`). Ceux-là passent en `sent`, et le reste est rejoué avec les mêmes clés.
5. **Lignes bloquées** (un consommateur mort en plein envoi) : la tâche de la minute remet en `pending` les lignes `queued` ou `sending` depuis plus de 15 minutes. Le renvoi reprend la même clé d'idempotence, donc Lettermint ne renvoie pas l'e-mail.
6. **Fin :** quand plus aucune ligne n'est `pending`, `queued` ni `sending`, la campagne passe en `completed`.

**Pause :** la tâche n'alimente plus la file, et le consommateur rend en `pending` les lignes d'une campagne qui n'est plus en `sending`. **Annulation :** les lignes non envoyées passent en `cancelled`. Chaque geste est journalisé.

### Aucun double envoi

Trois verrous indépendants :

1. **En base,** chaque ligne ne passe de `queued` à `sending` qu'une fois : deux consommateurs qui reçoivent le même message, ou deux tâches qui se chevauchent, ne réservent pas la même ligne.
2. **Chez le fournisseur,** la clé d'idempotence par destinataire (`send.id`, gardée 24 h) absorbe le seul trou restant : un consommateur qui meurt après l'acceptation et avant d'écrire `sent`. Une ligne n'est remise en circuit qu'après 15 minutes, donc bien avant l'expiration de la clé.
3. **Par l'unicité `(campaign_id, email)` :** une même adresse n'a qu'une ligne par campagne, même si elle est à la fois joueur et inscrite sur la liste d'attente.

**Test d'intégration :**
- deux consommateurs lancés en même temps sur les mêmes messages ;
- deux tâches de la minute en même temps ;
- un message rejoué après l'envoi.

Le faux fournisseur doit avoir vu chaque destinataire une fois et une seule.

### Webhooks de Lettermint

`POST /webhooks/lettermint`, public mais signé.

1. Lire le corps brut. Vérifier `X-Lettermint-Signature` (`t=…,v1=…`) en HMAC-SHA256, en temps constant. Vérifier que `X-Lettermint-Delivery` égale `t` et date de moins de 5 minutes. Sinon, 401.
2. Valider le corps avec Zod (schéma dans `packages/contract`). Un type d'événement inconnu répond 204 et n'est pas traité.
3. Traiter, de façon idempotente (un même événement peut arriver plusieurs fois) :
   - `message.hard_bounced` ajoute l'adresse à la suppression (`hard_bounce`) et passe la ligne d'envoi en `bounced` ;
   - `message.spam_complaint` ajoute l'adresse à la suppression (`complaint`), retire le consentement et passe la ligne en `complained` ;
   - `message.unsubscribed` (si la page hébergée reste active) ajoute la suppression et retire le consentement ;
   - `message.failed` passe la ligne en `failed`.
4. La ligne d'envoi est retrouvée par `metadata.send_id`, posé à l'envoi.

On ne s'abonne pas à `message.delivered` : 50 000 appels pour rien.

Secrets : `LETTERMINT_SENDING_TOKEN`, `LETTERMINT_WEBHOOK_SECRET`, `EMAIL_LINK_SECRET` (jetons de désinscription). Variables : `EMAIL_CAMPAIGN_FROM`, `LETTERMINT_BROADCAST_ROUTE`, `PUBLIC_WEB_URL`, `PUBLIC_API_URL`.

### Désinscription

- **Lien dans chaque e-mail de campagne :** `https://leximon.fr/desinscription/<jeton>`. Le jeton vaut `<send.id>.<HMAC-SHA256(EMAIL_LINK_SECRET, "unsubscribe:v1:" + send.id)>`. Il ne contient pas l'adresse, et on ne peut pas le fabriquer sans le secret.
- **En-têtes (RFC 8058) :**
  - `List-Unsubscribe: <https://api.leximon.fr/email/unsubscribe/<jeton>>` ;
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
  Gmail et Yahoo font alors un `POST` sans passer par la page.
- **Page publique `/desinscription/[jeton]`,** sans connexion : « Ne plus recevoir les nouvelles de Leximon ? » et un bouton « Me désinscrire ». Le `GET` ne désinscrit jamais, parce que les antivirus des messageries ouvrent les liens.
- **`POST /email/unsubscribe/:token` :**
  - vérifie le jeton en temps constant ;
  - ajoute l'adresse à la suppression et retire le consentement du joueur (`user_id`) ;
  - est idempotent, et répond pareil si l'adresse a déjà été effacée ;
  - est limité à 30 requêtes par minute et par IP (nouvelle liaison, D-018).
- **Les e-mails de code ne portent ni ce lien ni ces en-têtes.**

### Liste d'attente (P55)

- **Une seule campagne vers la liste d'attente** peut partir. L'index unique partiel le garantit en base.
- **Le lancement ferme la liste,** dans la même transaction et sous un verrou consultatif que l'inscription partage. Sans lui, une adresse arrivée pendant le lancement serait gardée sans jamais recevoir l'e-mail. Ensuite, `POST /waitlist` répond `410 waitlist_closed`, et l'accueil dit que c'est ouvert.
- **L'effacement :**
  - n'est possible qu'une fois la campagne `completed` ou `cancelled` ;
  - est confirmé par saisie du nombre d'adresses ;
  - vide `waitlist_signups` et efface les adresses des lignes d'envoi de cette campagne, en gardant les compteurs ;
  - est journalisé (`erase_waitlist`, avec le nombre).
- **Une fois la liste effacée,** l'audience « liste d'attente » disparaît de l'éditeur.

### Routes nouvelles

| Route | Rôle |
|---|---|
| `GET /admin/campaigns`, `POST /admin/campaigns`, `GET/PUT /admin/campaigns/:id` | Liste, création, lecture, modification d'un brouillon |
| `POST /admin/campaigns/preview` | Rendu HTML et texte |
| `POST /admin/campaigns/:id/test` | Envoi de test à l'admin connecté |
| `GET /admin/campaigns/:id/audience` | Nombre exact de destinataires |
| `POST /admin/campaigns/:id/launch` | Confirmation (nombre attendu, date éventuelle, clé d'idempotence) |
| `POST /admin/campaigns/:id/pause`, `/resume`, `/cancel` | Contrôle de l'envoi |
| `POST /admin/waitlist/erase` | Effacement (nombre attendu) |
| `POST /email/unsubscribe/:token` | Désinscription, publique |
| `POST /webhooks/lettermint` | Événements du fournisseur, signés |
| `GET/PUT /me/email-preferences` | Consentement du joueur (choix 4) |

Côté web :
- la case à l'inscription (`account-screen.tsx`) et l'interrupteur dans les réglages ;
- la page `/desinscription/[jeton]` ;
- les écrans admin.

### Charge : 50 000 adresses

**Durée** (débit par défaut de 1 000 par minute) :
- 50 minutes ;
- 500 messages de file, 500 appels au fournisseur.

Le débit se règle par campagne. Pour un domaine neuf, mieux vaut un premier envoi à 500 par minute (environ 1 h 40) : Gmail ralentit les domaines sans historique qui envoient d'un coup.

**Limites des Workers :**

| Étape | Coût estimé | Limite |
|---|---|---|
| Confirmation : `INSERT … SELECT` de 50 000 lignes | 1 à 3 s, côté Postgres, quasiment pas de CPU du Worker | Requête HTTP : 30 s de CPU, pas de limite de durée tant que le client attend |
| Tâche de la minute : une sélection, une mise à jour, un `sendBatch` | Moins de 50 ms de CPU | 30 s de CPU, 15 min de durée |
| Consommateur, un lot de 100 | ~30 ms de CPU (100 rendus par substitution, 100 HMAC, un JSON de ~1,5 Mo), 1 à 3 s de durée | 30 s de CPU, 15 min de durée, 25 Mo par appel au fournisseur |
| Webhooks | Rebonds et plaintes seulement : quelques centaines | — |

À 100 000 adresses, tout double, et rien n'approche une limite.

**Coût** de l'envoi d'ouverture à 50 000 adresses :
- Lettermint, palier 50 000 pendant le mois de l'ouverture : 40 à 55 € selon le forfait, puis retour à l'offre gratuite ;
- codes : 3 000 inclus dans Workers Paid, puis 0,35 $ les 1 000 ;
- Queues : 1 500 opérations, dans le million inclus de Workers Paid ;
- Postgres : 150 000 écritures, négligeable.

## Sécurité, en bref

- **Secrets** en variables d'environnement uniquement : le jeton d'envoi, le secret des webhooks et le secret des liens sont distincts, pour qu'une fuite de l'un n'ouvre pas le reste.
- **Webhooks :** signature HMAC vérifiée avant toute lecture du contenu, fenêtre de 5 minutes contre le rejeu, traitement idempotent.
- **Jetons de désinscription :** pas d'adresse dans l'URL, pas de date d'expiration (un lien doit marcher des mois après), révocables en changeant le secret. Ils ne permettent qu'une chose : se désinscrire.
- **Campagnes réservées au rôle admin,** vérifié à chaque requête (D-031). Lancement, pause, annulation et effacement sont journalisés dans la transaction qui les applique.
- **Contenu :** le Markdown n'accepte ni HTML ni image, les liens sont en `https://`, tout est échappé.
- **Journaux :** jamais d'adresse en clair, `maskEmail` partout.

## Documents à mettre à jour

- `docs/decisions.md` : D-030 (fournisseur), nouvelles décisions pour la file des e-mails, le schéma et le rendu (skill `decision`).
- `docs/regles-du-jeu.md` : P61, consentement aux e-mails de campagne. P55 précisée : le lancement ferme la liste.
- `docs/voix.md` : exemples d'e-mails (code, ouverture).
- `/confidentialite` : nom du fournisseur et pays, campagnes avec consentement, désinscription en un clic, durées de conservation.
- `docs/feuille-de-route.md` : l'état des deux volets.

## Ordre de livraison

1. Ce cahier et les cinq choix, validés le 2026-10-21.
2. Volet A : envoi des codes par Cloudflare, modèle du code, DNS.
3. Volet B : schéma (campagnes, envois, suppression, consentement), Lettermint et ses webhooks, file, écrans admin, désinscription, liste d'attente, tests concurrents.

## Sources

- Scaleway TEM : [FAQ](https://www.scaleway.com/en/docs/transactional-email/faq/) (marketing interdit), [limites](https://www.scaleway.com/en/docs/transactional-email/reference-content/tem-capabilities-and-limits/), [tarifs](https://www.scaleway.com/en/pricing/managed-services/), [webhooks](https://www.scaleway.com/en/docs/transactional-email/reference-content/webhook-events-payloads/).
- Lettermint : [tarifs](https://lettermint.co/pricing), [routes](https://lettermint.co/docs/platform/projects-and-routes/routes), [idempotence et lots](https://lettermint.co/docs/platform/emails/idempotency), [limites](https://lettermint.co/docs/platform/emails/limitations), [suppressions](https://lettermint.co/docs/platform/emails/suppressions), [webhooks signés](https://lettermint.co/docs/platform/webhooks/signing), [événements](https://lettermint.co/docs/platform/webhooks/events), [domaines](https://lettermint.co/docs/platform/domains/introduction), [sous-traitants](https://lettermint.co/subprocessors).
- Brevo : [limites d'API](https://developers.brevo.com/docs/api-limits), [webhooks sécurisés](https://developers.brevo.com/docs/secured-webhooks).
- Cloudflare : [limites des Workers](https://developers.cloudflare.com/workers/platform/limits/), [limites de Queues](https://developers.cloudflare.com/queues/platform/limits/), [tarifs de Queues](https://developers.cloudflare.com/queues/platform/pricing/).
