# R&D · Inscription et transfert de la collection de l'invité

- **Décision liée :** D-006 (comptes), D-018 (limites de débit), D-030 (inscription), règles P8, P37, P38, P54
- **Dates :** 2026-10-20 → 2026-10-20
- **Question :** comment construire l'inscription (e-mail, Apple, Google) sur Better Auth en gardant la collection de l'invité, avec quel fournisseur d'e-mail, et quelles règles de fusion et d'âge ?

Étude documentaire, sans code ni mesure. Prix relevés le 2026-10-20 sur les pages officielles, hors taxes. Le comportement de Better Auth est lu dans le code de la version installée (1.7.11, `node_modules`) et dans sa documentation. « ? » signale un point non confirmé.

## En bref

| Question | Recommandation |
|---|---|
| 1. Fournisseur d'e-mail | **Scaleway Transactional Email** : seul des huit étudiés dont la documentation garantit des données en France, sans maison mère américaine, et le moins cher (≈ 7 € par mois à 20 000 joueurs par jour, 75 à 120 € à 250 000). Repli : Brevo. |
| 2. Better Auth | Garder `anonymous`, ajouter `emailOTP` (code à 6 chiffres) plutôt que `magicLink`, Apple et Google. Transfert dans `onLinkAccount`, dans **notre** transaction, avec `disableDeleteAnonymousUser: true`. Aucune table Better Auth à ajouter : changement additif. |
| 3. Fusion avec un compte existant | **Tranché : option A, aucune fusion** (P54). Seul un nouveau compte reçoit la partie d'un invité ; vers un compte qui joue déjà, l'invité est abandonné après avertissement. La fusion bornée (C), d'abord proposée, n'est pas retenue. |
| 4. Apple et Google | Compte Apple Developer (99 $/an) et projet Google Cloud à ouvrir par le propriétaire. Sign in with Apple obligatoire sur iOS dès qu'on propose Google. Tout se code avant, avec l'e-mail seul. |
| 5. Âge | Case « J'ai 15 ans ou plus » à l'inscription, sans date de naissance ; ne garder ni le nom ni la photo du profil Apple ou Google. Avis d'un juriste sur la loi de 2026 sur les réseaux sociaux avant d'ouvrir les clans. |

## Ce qui existe aujourd'hui

- `apps/api/src/auth.ts` : Better Auth 1.7.11, plugin `anonymous()` seul, base via l'adaptateur Drizzle (node-postgres, Hyperdrive), instance créée à chaque requête, limiteur interne coupé (D-018), cache de session signé de 5 min.
- Le web crée un invité au premier appel (`POST /api/auth/sign-in/anonymous`, `apps/web/src/lib/api.ts`), limité à 60 par minute et par IP.
- Un nouveau joueur reçoit un portefeuille plein : 6 plis, soit 30 cartes (`createFullWallet`). **Chaque invité créé vaut donc 30 cartes gratuites** : c'est le chiffre qui borne toute règle de fusion.
- Toutes les tables de jeu référencent `users.id` avec `on delete cascade` : `booster_wallets`, `booster_bonus_awards`, `user_cards`, `booster_opens`, `booster_open_requests`, `players`, `user_mastery`, `review_logs`, `trades` (les deux côtés). L'ancienneté exigée pour échanger (P36) se lit sur `users.created_at`.

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Hébergement des données | Données des joueurs traitées dans l'UE, sans transfert hors UE si possible (D-005). Le GAR ne l'impose plus (P8 : pas de version école), mais la règle reste celle de tout le projet. |
| Sans état | Rien en mémoire entre deux requêtes ; limites de débit chez Cloudflare (D-018) |
| Workers | API HTTP appelée par `fetch`, sans SMTP ni dépendance Node |
| Collection de l'invité | Jamais perdue sans que le joueur l'ait accepté ; transfert atomique et idempotent |
| Triche | Une fusion ne doit pas rapporter plus que ce que les échanges permettent déjà (D-026) |
| Clients publiés | Changement additif : l'invité actuel continue de marcher |
| Données personnelles | Le minimum : une adresse e-mail ou un identifiant Apple/Google, rien d'autre |

## 1. Fournisseur d'e-mail

### Volume estimé

Hypothèses : sessions longues (Better Auth renouvelle la session chaque jour d'usage), donc un e-mail surtout à l'inscription et à la connexion sur un nouvel appareil ; environ la moitié des inscrits passent par l'e-mail, l'autre par Apple ou Google ; 3 % des joueurs du jour reçoivent un code un jour ordinaire, jusqu'à 15 % un jour de vague venue d'un stream.

| Palier | Jour ordinaire | Jour de pic | Par mois |
|---|---|---|---|
| 20 000 joueurs par jour | ≈ 600 à 1 000 | ≈ 3 000 | **≈ 30 000** |
| 250 000 joueurs par jour | ≈ 8 000 à 12 000 | ≈ 40 000 | **≈ 300 000** |

Les notifications (offre d'échange reçue) passeront d'abord par le push : elles ne changent pas l'ordre de grandeur.

### Comparaison

Prix publics hors taxes, relevés le 2026-10-20.

| Fournisseur | Société, données | Hors UE | Gratuit | ≈ 30 000 / mois | ≈ 300 000 / mois | SPF de `leximon.fr` |
|---|---|---|---|---|---|---|
| **Scaleway TEM** | FR, Paris uniquement ; « aucune donnée répliquée hors UE », non soumis au Cloud Act (selon Scaleway) | **Aucun transfert** | 300 par mois | **≈ 7 €** | **≈ 75 €** (Essential) ou 120 € (Scale, IP dédiée incluse) | Fusion dans l'enregistrement racine, ou sous-domaine d'envoi |
| Brevo | FR ; stockage UE (Google Cloud Belgique, OVH) | Support par Brevo Inc. (US) et Brevo Inde, Zendesk… | 300 par jour | 35 € | 289 € | Inchangé (DKIM seul sur IP partagée) |
| Mailjet | FR (groupe Sinch, SE) ; Google Cloud UE | Zendesk, Stripe (US) | 6 000 par mois, 200 par jour | ≈ 37 € | ≈ 244 € et plus | Ajout à la racine exigé |
| Lettermint | NL ; UpCloud NL | Slack, Stripe | 300 par mois | 40 € | 175 € | Inchangé (sous-domaine de retour) |
| Amazon SES | US ; région Paris possible | Société US (Cloud Act) | Non (crédits la 1re année) | 3 à 5 $ | 30 à 48 $ | Inchangé (MAIL FROM personnalisé) ; signature SigV4 à écrire |
| Cloudflare Email Sending | US ; lieu de traitement non documenté | Société US | Inclus dans Workers Paid : 3 000 par mois | ≈ 14,5 $ | ≈ 109 $ | Inchangé ; **écrit son propre `_dmarc`** ; en bêta |
| Resend | US ; envoi depuis l'Irlande, mais métadonnées et journaux aux États-Unis | Oui, tout | 3 000 par mois, 100 par jour | 20 $ | 215 à 240 $ | Inchangé |
| Postmark | US (ActiveCampaign) ; Chicago | Oui, tout | 100 par mois | 42 à 51 $ | 245 à 294 $ | Inchangé |

Tous ont une API HTTP appelable par `fetch` depuis un Worker. Cloudflare a même une liaison native (`send_email`), sans clé d'API. Postmark sépare le mieux le transactionnel du marketing ; Scaleway interdit le marketing, ce qui protège aussi sa réputation d'envoi.

### SPF, DKIM, DMARC sur `leximon.fr`

- **Un seul enregistrement SPF par nom** (RFC 7208, § 3.2 et § 4.5) : un second enregistrement fait échouer SPF (« permerror ») pour tous les envois, y compris le routage de `contact@`. On **complète** l'enregistrement existant, par exemple `v=spf1 include:_spf.mx.cloudflare.net include:_spf.tem.scaleway.com ~all`, en restant sous 10 requêtes DNS.
- La plupart des fournisseurs évitent la question en utilisant un **sous-domaine de retour** (Return-Path) qui porte son propre SPF ; SPF vérifie ce domaine d'enveloppe, pas le From. Scaleway, lui, vérifie le domaine d'envoi lui-même : soit on fusionne à la racine (les rebonds arrivent alors au MX de Cloudflare), soit on envoie depuis un sous-domaine (`mail.leximon.fr`) avec son SPF et son MX.
- **DKIM** : un enregistrement TXT donné par le fournisseur (sélecteur sous `_domainkey`).
- **DMARC** : en ajouter un (`_dmarc.leximon.fr`), d'abord `p=none` avec rapports, puis `quarantine`. Gmail et Yahoo l'exigent des gros expéditeurs.
- **Adresses relais d'Apple** : déclarer le domaine d'envoi chez Apple (section 4), avec SPF valide sur le domaine d'enveloppe.

### Recommandation

**Scaleway TEM**, envoi depuis `leximon.fr` avec SPF fusionné. C'est le seul qui tient sans réserve la règle « données dans l'UE, sans transfert », et le moins cher à tous les paliers. Points à traiter : son API est encore en `v1alpha1` (enveloppe mince, facile à changer) ; le quota par défaut est de 10 000 e-mails par mois, **à faire relever avant la bêta publique** ; l'offre gratuite (300 par mois) suffit au développement et à une bêta fermée.

**Repli :** Brevo (français, stockage UE, 300 par jour gratuits, mais accès depuis les États-Unis et l'Inde et 4 fois plus cher). Cloudflare Email Sending serait le plus simple à brancher : à revoir quand il sortira de bêta avec un traitement documenté dans l'UE.

## 2. Better Auth : ce qui convient, ce qui doit changer

### Ce que fait le plugin `anonymous` (lu dans le code 1.7.11)

- Se connecter par un autre moyen **crée ou retrouve un autre utilisateur** : l'invité n'est jamais « promu » sur place. `linkSocial` ne sert pas non plus, il refuse une adresse différente de celle de l'invité (fictive), sauf `allowDifferentEmails`, à proscrire.
- Un crochet *after* repère toute connexion réussie (`/sign-in/*`, `/callback/*`, `/magic-link/verify`, `/sign-in/email-otp`…) faite avec une session invité. Il appelle `onLinkAccount({ anonymousUser, newUser, ctx })` **après** la création du nouvel utilisateur et de sa session, puis **supprime l'invité**, donc toutes ses lignes de jeu par cascade, y compris l'historique d'échange de ses partenaires.
- La session invité vient du cookie. Pour un retour OAuth sans ce cookie (navigateur intégré d'Expo, retour Apple en POST), l'identifiant de l'invité est gardé dans l'état OAuth côté serveur : la liaison marche aussi.
- Si `onLinkAccount` lève une erreur, l'invité n'est pas supprimé et la réponse est une erreur ; la session du nouveau compte est peut-être déjà posée (à vérifier).

### Conséquences pour nous

1. **`disableDeleteAnonymousUser: true`** : la suppression par défaut est dangereuse (cascades). Le transfert et le sort de l'invité se font dans `onLinkAccount`, dans une transaction à nous, avec le client Drizzle de la requête (déjà disponible dans `createAuth`).
2. **Deux cas, détectés côté serveur :** le compte cible n'a aucune donnée de jeu (inscription) → on déplace tout ; il en a (connexion à un compte existant) → règle de fusion (section 3).
3. **Déplacer les lignes plutôt que l'identité.** Re-pointer `user_id` de l'invité vers le nouveau compte, table par table, sous verrou des deux portefeuilles dans un ordre fixe (identifiant croissant). Quelques centaines de lignes par invité. L'autre voie (rattacher le compte Apple ou l'e-mail à l'ancien utilisateur invité) éviterait de toucher les tables de jeu, mais contourne Better Auth (cache de session signé, objet `newSession`) : plus fragile.
4. **Un test qui liste toutes les clés étrangères vers `users.id`** (via `information_schema`) et échoue si une table n'est pas prise en charge par le transfert : sans lui, la prochaine table (expérience, clans) serait perdue en silence.
5. **Ancienneté :** recopier le `created_at` de l'invité sur le nouveau compte, sinon l'inscription remet à zéro les 3 jours exigés pour échanger (P36).
6. **Idempotence :** une fois transféré, l'invité est marqué (colonne additive `merged_into`, ou supprimé en fin de transaction) ; un second appel ne fait rien.

### E-mail : code plutôt que lien magique

| | Lien magique (`magicLink`) | Code à 6 chiffres (`emailOTP`) |
|---|---|---|
| Liaison avec l'invité | Seulement si le lien s'ouvre dans le navigateur qui porte le cookie invité. Lien ouvert sur un autre appareil, ou dans Safari depuis l'app mobile : **compte vide, invité orphelin** | Toujours : le code se tape dans l'appareil de l'invité |
| Mobile (Expo) | Liens universels (iOS) et App Links (Android) à configurer, puis `magicLink.verify` dans l'app | Rien de plus qu'un champ |
| Filtres anti-spam des messageries | Certains ouvrent les liens pour les analyser et consomment le jeton à usage unique (Better Auth le consomme au premier appel) | Pas concerné |
| Confort | Un clic | Recopier 6 chiffres (iOS et Android les proposent depuis l'e-mail) |

**Recommandation :** `emailOTP` (connexion et inscription par code), quitte à ajouter plus tard un lien dans le même e-mail sur le web. Dans les deux cas, aucune table nouvelle : les codes vont dans `verifications`, qui existe.

### Apple et Google

- **Web :** redirection OAuth classique, retour sur `/api/auth/callback/{apple,google}`. Apple exige un secret client : un JWT signé par la clé `.p8`, valable 6 mois au plus. La documentation conseille `jose` pour le générer ; on peut aussi le générer hors ligne tous les 5 mois et le ranger en secret (aucune dépendance), ou le signer en WebCrypto.
- **Mobile :** connexion native, puis `signIn.social({ provider, idToken })` : pas de redirection. Côté Apple, `appBundleIdentifier` (ou `audience` en liste) pour accepter les jetons émis pour l'app. Nouvelles dépendances à proposer au moment du mobile : `@better-auth/expo`, `expo-secure-store`, `expo-apple-authentication`, et pour Google une bibliothèque de connexion native (`@react-native-google-signin/google-signin`) ou `expo-auth-session`.
- **Liaison implicite :** Better Auth rattache un compte Google à un utilisateur existant de même adresse si l'adresse est vérifiée des deux côtés. Garder ce réglage par défaut (`requireLocalEmailVerified`), qui empêche la prise de compte par une adresse non vérifiée.
- **Apple « Masquer mon adresse » :** l'adresse est un relais `@privaterelay.appleid.com`. Pour y écrire, déclarer le domaine d'envoi dans le portail Apple (« Sign in with Apple for Email Communication »), avec SPF valide sur le domaine d'enveloppe et DKIM aligné sur le From.

### Ce qui reste à régler dans l'API

- **Limites de débit des envois** (Better Auth a son limiteur coupé) : par IP avec une liaison Cloudflare (fenêtres de 10 ou 60 s seulement), et par adresse e-mail en base (par exemple 5 codes par heure, compté dans `verifications`). Protège la réputation d'envoi, le budget et contre l'envoi massif à une victime.
- **Envoi sans bloquer la réponse :** `advanced.backgroundTasks` de Better Auth avec `waitUntil` (AsyncLocalStorage, `nodejs_compat` est déjà activé).
- **Suppression du compte** dans l'app (exigée par Apple, 5.1.1(v)) : `user.deleteUser` de Better Auth, plus la révocation du jeton Apple.
- **Jetons OAuth** : Better Auth garde les jetons Apple et Google dans `accounts`. Le seul usage prévu est la révocation Apple à la suppression du compte : activer `account.encryptOAuthTokens`.
- **IP et navigateur stockés dans `sessions`** : utiles contre l'abus, mais à mentionner dans la politique de confidentialité, avec une durée de conservation.

### Rétrocompatibilité

Additif. Les tables `accounts` et `verifications` existent déjà ; les nouvelles routes s'ajoutent sous `/api/auth/*`. Un client qui ne connaît que l'invité continue de jouer comme avant. Seules nouveautés de schéma possibles, toutes additives : une colonne `merged_into` ou une table de journal des fusions.

## 3. Fusion avec un compte existant (règle métier, tranchée : option A)

Cas typique : le joueur a un compte sur son téléphone, ouvre le site sur un ordinateur, le web lui crée un invité sans rien demander, il ouvre ses 6 plis, puis se connecte. Ce cas sera fréquent, et presque toujours petit.

Le risque : créer des invités à la chaîne (60 par minute et par IP), ouvrir leurs 30 cartes gratuites, puis se connecter à chaque fois au même compte. Sans borne, une fusion additive vaut 30 cartes par minute.

### Options

| | Règle | Pour | Contre |
|---|---|---|---|
| A | **Refus :** le compte existant fait foi, l'invité est abandonné après un avertissement (« la partie jouée ici en invité, N cartes, sera perdue ») ; le joueur peut annuler et rester invité | Aucune triche possible ; le plus simple ; c'est ce que font la plupart des jeux mobiles (on garde une sauvegarde, jamais les deux) | Perte réelle dans le cas typique |
| B | **Fusion complète :** tout s'additionne | Rien n'est perdu | Ferme à invités : inacceptable sans borne |
| C | **Fusion bornée** (recommandée) : cartes et maîtrise rejoignent le compte, portefeuille et garanties jamais, au plus une fois par 7 jours et par compte ; au-delà, option A | Le cas typique ne perd rien ; gain d'un tricheur borné à 30 cartes par semaine, contre 48 plis possibles par jour en jouant normalement, et moins que ce qu'un réseau de comptes jetables fait déjà passer par les échanges | Un peu plus de code et de tests |
| D | **Demander après coup :** la connexion n'est pas bloquée ; l'app propose « Ajouter tes N cartes d'invité ? », valable 24 h, sous les bornes de C | Le joueur choisit en connaissance de cause, sans révéler avant la connexion qu'une adresse a un compte | Un écran et une route de plus ; à garder pour plus tard si C déçoit |

**Tranché le 2026-10-20 : option A** (P54). C, puis B et D, ne sont pas retenues : la fusion bornée demandait un délai daté, une règle de maîtrise à garder et deux chemins de plus à tester, pour un gain faible ; et toute fusion, même bornée, laisse une ferme à cartes avec des invités jetables. Un invité vide (un nouveau navigateur) se connecte sans avertissement, puisqu'il n'a rien à perdre. Le tableau ci-dessous est gardé pour mémoire.

### Ce que deviendrait chaque donnée avec l'option C (non retenue)

| Donnée | Règle proposée | Pourquoi |
|---|---|---|
| `user_cards` | Quantités additionnées ; `last_obtained_at` remis à l'heure de la fusion | Une Épique ou une Légendaire reçue par fusion attend 7 jours avant d'être échangée (P35), comme une carte tirée |
| `user_mastery` | Par mot, on garde **la ligne entière** du niveau le plus haut, puis de la plus grande stabilité | L'état FSRS (stabilité, difficulté, échéance, répétitions) forme un tout : on ne mélange jamais les champs. Un niveau ne redescend jamais (P33) |
| Stock gratuit et recharge | Ceux du compte, inchangés | Additionner revient à offrir 6 plis par invité |
| Réserve de plis bonus (P23) | Celle du compte, inchangée | Idem, et la réserve a son propre plafond |
| Compteurs de garantie (P12, P19) | Ceux du compte, inchangés | Prendre le plus avancé des deux permettrait de « mûrir » une garantie sur des invités |
| Attributions de plis bonus | Celles du compte | Leur clé (joueur, motif, jour ou carte) empêche déjà un double gain |
| Échanges | Offres en attente de l'invité annulées ; historique conservé sur l'invité archivé | Un échange entre l'invité et le compte deviendrait un échange avec soi-même (contrainte `trades_not_self`) |
| Journal des plis et des réponses | Restent sur l'invité archivé | Audit ; rien à recalculer |
| Code joueur | Celui du compte ; celui de l'invité n'est jamais réattribué | Un code n'est jamais réutilisé (D-026) |
| Ancienneté du compte | Celle du compte | Un invité ancien ne doit pas vieillir un compte récent |

Pour une inscription (compte neuf), tout part vers le nouveau compte, y compris portefeuille, garanties, réserve et ancienneté : c'est le même joueur, et un invité ne peut s'inscrire qu'une fois.

**À noter :** les invités abandonnés (jamais revenus, ou archivés après une connexion) s'accumulent ; une purge après quelques mois d'inactivité sera nécessaire, au titre de la durée de conservation (RGPD).

## 4. Prérequis Apple et Google (à faire par le propriétaire)

| Démarche | Coût | Délai, contraintes |
|---|---|---|
| **Apple Developer Program** (indispensable pour publier sur iOS) | 99 $ par an | Particulier : nom légal affiché comme vendeur sur l'App Store. Organisation : numéro D-U-N-S, site et adresse e-mail au domaine. Ensuite : App ID avec Sign in with Apple, Service ID (web) et domaine `leximon.fr`, URL de retour, clé `.p8` (téléchargeable une seule fois) |
| **Sign in with Apple pour l'e-mail** | Gratuit | Déclarer le domaine d'envoi pour écrire aux adresses relais (32 sources pour un particulier) |
| **Projet Google Cloud et écran de consentement OAuth** | Gratuit | Avec les seules portées `openid`, `email`, `profile`, pas d'audit. Passer l'écran en « En production » (en « Test » : 100 testeurs déclarés). La vérification de la marque (nom et logo affichés) demande domaine vérifié, page d'accueil et politique de confidentialité sur `leximon.fr`. Identifiants OAuth : un client Web, un iOS, un Android (empreinte SHA-1 de la clé de signature EAS) |
| **Google Play Console** (pour Android, pas pour la connexion Google) | 25 $ une fois | Compte personnel créé après le 13/11/2023 : test fermé avec 12 testeurs pendant 14 jours avant la production. Un compte d'organisation (D-U-N-S) en est dispensé |

**Règles des stores qui pèsent sur le produit :**

- **Apple 4.8 :** proposer Google sur iOS oblige à proposer aussi un service qui ne collecte que nom et e-mail, permet de masquer l'adresse et ne piste pas : en pratique, Sign in with Apple. L'e-mail seul (notre propre système) en est dispensé.
- **Apple 5.1.1(v) :** suppression du compte dans l'app ; pas d'inscription exigée pour jouer, ce que l'invité respecte déjà.

**Ce qui se code sans attendre :** tout le parcours par code e-mail et le transfert de l'invité, testés contre Postgres avec un faux envoi d'e-mail. Google se teste avec un projet en mode « Test » et les comptes du propriétaire. Apple ne se teste pas sans le compte payant : on code contre la documentation et un faux jeton dans les tests, puis on vérifie en vrai une fois le compte ouvert.

## 5. Âge minimum et données collectées

- **Règle du jeu :** inscription à partir de 15 ans (P8).
- **Loi Informatique et Libertés, art. 45 :** avant 15 ans, un traitement fondé sur le consentement demande aussi l'accord d'un parent. Pour les données nécessaires au contrat (le compte de jeu), la CNIL admet qu'un mineur conclue lui-même un contrat courant ; les choix facultatifs (profil public, plus tard) relèvent du consentement.
- **CNIL, recommandation 7 :** une vérification d'âge proportionnée au risque, minimale, sans conservation au-delà du résultat. L'auto-déclaration seule est à éviter pour les traitements risqués (publicité ciblée), ce que Leximon n'a pas.
- **Loi de 2026 interdisant les réseaux sociaux avant 15 ans** (adoptée en juillet 2026, nouveaux comptes interdits depuis le 1er septembre 2026, comptes existants vérifiés avant le 1er janvier 2027) : la presse cite une exemption des projets éducatifs ; le texte exact, sa définition du réseau social et la méthode de vérification exigée restent à lire. Au lancement (pas de texte libre, échanges structurés), Leximon en paraît éloigné ; les clans avec discussion et profils publics pourraient l'en rapprocher.

**Ce que cela donne pour le formulaire :**

- une adresse e-mail, ou rien du tout avec Apple ou Google ;
- une case « J'ai 15 ans ou plus », obligatoire, sans date de naissance ; on garde seulement la date à laquelle elle a été cochée ;
- pas de nom réel : le pseudo, modéré (N5), se choisit plus tard, au premier geste visible des autres. Ne pas recopier le nom ni la photo renvoyés par Apple ou Google (`mapProfileToUser` de Better Auth) ;
- pas de case marketing précochée ; les e-mails autres que la connexion attendent un consentement explicite.

## Recommandation

1. **E-mail :** Scaleway TEM, SPF fusionné à la racine, DKIM et DMARC ajoutés ; relever le quota avant la bêta publique.
2. **Better Auth :** `anonymous` gardé, `emailOTP` (code) plutôt que `magicLink`, Apple et Google ensuite. `disableDeleteAnonymousUser: true` et transfert dans `onLinkAccount`, dans notre transaction, avec un test qui couvre toute clé étrangère vers `users.id`. Rien d'incompatible avec les clients actuels.
3. **Fusion :** proposé : option C (cartes et maîtrise au plus une fois par 7 jours, jamais portefeuille, réserve ni garanties). Tranché par le propriétaire : option A, aucune fusion (P54).
4. **Ordre de travail :** e-mail et transfert d'abord (aucun prérequis payant), Google ensuite, Apple avec le mobile, quand le compte développeur sera ouvert.
5. **Formulaire :** adresse e-mail et case « 15 ans ou plus », rien d'autre.

À consigner dans D-006 (et D-018 pour les limites d'envoi) une fois tranché.

## Reste à vérifier

1. Comportement de Better Auth quand `onLinkAccount` lève une erreur : la session du nouveau compte est-elle déjà posée ? Si oui, l'invité devient orphelin ; prévoir une reprise.
2. Que la liaison invité fonctionne avec `signIn.social({ idToken })` depuis Expo (cookie envoyé par `expoClient`).
3. Scaleway TEM : relèvement du quota (délai), stabilité de l'API `v1alpha1`, nombre de requêtes DNS de l'enregistrement SPF fusionné, et qu'un envoi réel arrive en boîte de réception chez Gmail, Outlook, Orange et Free (tests avec un vrai domaine).
4. Texte promulgué de la loi de 2026 sur les réseaux sociaux : champ, exemption éducative, vérification d'âge exigée. À faire relire par un juriste avant les clans.
5. Délais réels de la vérification de marque Google et de l'inscription Apple (D-U-N-S si organisation).

## Pour reproduire

- Code de Better Auth lu dans `node_modules/.pnpm/better-auth@1.7.11_*/node_modules/better-auth/dist/plugins/anonymous/index.mjs`, `magic-link/`, `email-otp/`, `api/routes/account.mjs` (`linkSocial`), et `@better-auth/core/dist/types/init-options.d.mts` (`accountLinking`, `backgroundTasks`, `disableIpTracking`).
- Code de Leximon : `apps/api/src/auth.ts`, `apps/api/src/boosters/open-booster.ts` (portefeuille plein à la création), `packages/db/src/schema/game.ts`.

### Sources consultées (2026-10-20)

- Better Auth : [anonymous](https://better-auth.com/docs/plugins/anonymous), [magic link](https://better-auth.com/docs/plugins/magic-link), [Apple](https://better-auth.com/docs/authentication/apple), [Expo](https://better-auth.com/docs/integrations/expo), [guide de passage à 1.7](https://better-auth.com/docs/guides/1-7-upgrade-guide)
- Apple : [App Review Guidelines (4.8, 5.1.1)](https://developer.apple.com/app-store/review/guidelines/), [inscription au programme](https://developer.apple.com/programs/enroll/), [comparatif des adhésions](https://developer.apple.com/support/compare-memberships/), [relais d'e-mail privé](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service)
- Google : [audience de l'app OAuth](https://support.google.com/cloud/answer/15549945?hl=en), [vérification de marque](https://support.google.com/cloud/answer/13464321), [test fermé Play Console](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- CNIL : [recommandation 4](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans), [recommandation 7](https://www.cnil.fr/fr/recommandation-7-verifier-lage-de-lenfant-et-laccord-des-parents-dans-le-respect-de-sa-vie-privee)
- Loi de 2026 sur les réseaux sociaux : [L'Étudiant](https://www.letudiant.fr/lifestyle/interdiction-les-reseaux-sociaux-aux-moins-de-15-ans-la-loi-adoptee-par-le-parlement.html), [Siècle Digital](https://siecledigital.fr/2026/03/31/reseaux-sociaux-le-senat-impose-sa-vision-pour-les-moins-de-15-ans/) (presse ; texte officiel à lire sur Légifrance)
- Scaleway TEM : [prix](https://www.scaleway.com/en/pricing/managed-services/), [confidentialité des données](https://www.scaleway.com/en/docs/transactional-email/reference-content/data-privacy/), [authentification du domaine](https://www.scaleway.com/en/docs/transactional-email/how-to/authenticate-domain/)
- Brevo : [prix](https://www.brevo.com/pricing/), [sous-traitants (CGU, annexe 3)](https://www.brevo.com/legal/termsofuse/), [lieu de stockage](https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location)
- Mailjet : [prix](https://www.mailjet.com/pricing/), [lieu de stockage](https://documentation.mailjet.com/hc/en-us/articles/360042712274-Where-is-my-personal-data-stored), [sous-traitants Sinch](https://sinch.com/legal/data-protection-agreement-sub-processors/)
- Resend : [prix](https://resend.com/pricing), [régions](https://resend.com/docs/dashboard/domains/regions), [sous-traitants](https://resend.com/legal/subprocessors)
- Postmark : [prix](https://postmarkapp.com/pricing), [confidentialité UE](https://postmarkapp.com/eu-privacy), [flux de messages](https://postmarkapp.com/message-streams)
- Amazon SES : [prix](https://aws.amazon.com/ses/pricing/), [MAIL FROM personnalisé](https://docs.aws.amazon.com/ses/latest/dg/mail-from.html)
- Cloudflare Email Service : [prix](https://developers.cloudflare.com/email-service/platform/pricing/), [limites](https://developers.cloudflare.com/email-service/platform/limits/), [domaines](https://developers.cloudflare.com/email-service/configuration/domains/)
- Lettermint : [prix](https://lettermint.co/pricing), [sous-traitants](https://lettermint.co/subprocessors)
- SPF : [RFC 7208](https://www.rfc-editor.org/rfc/rfc7208.html)
