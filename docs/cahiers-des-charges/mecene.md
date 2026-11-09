# Cahier des charges · Abonnement Mécène et paiement Stripe

- **Statut :** tranché le 2026-11-08 sur huit questions (§ 9) ; trois points restent à confirmer (§ 10). Lots 1 (socle), 2 (page Mécène, badge, cosmétiques, admin) et 3 (dénichage, sans le signe de l'exemplaire) construits le 2026-11-08 ; à essayer avec les clés de test de Stripe (§ 11), recette MEC-01 à MEC-12 dans [recette-nouveautes.md](../recette-nouveautes.md).
- **Règles concernées :** P72 (gratuit et payant) et P73 (abonnement Mécène), dans [regles-du-jeu.md](../regles-du-jeu.md), qui fait foi. Décision technique : D-059.
- **D'où ça vient :** le propriétaire veut brancher Stripe, sur le compte qu'il a déjà, et construire l'offre Mécène. La stratégie commerciale ouvre la vente vers mi-janvier 2027, si les seuils sont atteints (2 000 joueurs actifs par mois, 10 % de rétention à 7 jours, 3 % de clics sur la fausse porte) et après relecture des documents par un avocat.
- **Objectif :** tout construire maintenant, en mode test de Stripe, vente fermée. Le jour où les seuils et l'avocat sont là, on passe les clés en production et on ouvre.

## Ce qui existe

- **La fausse porte** `/mecene` (`apps/web/src/beta/patron-screen.tsx`) : l'offre, son prix, « Préviens-moi », comptés dans `player_interest` (`patron_door`, `patron_notify`) et lus dans `/admin/mesure`. Sa liste d'avantages ne suit plus P73 (« ta voix sur l'ordre des collections », « ton pseudo dans les crédits ») : elle est à réécrire.
- **Les cosmétiques** : avatars gravés, cadres et titres, portés par `players.avatar`, `.frame`, `.title`. Ceux qu'un joueur possède se déduisent de ce qu'il a réclamé (niveaux, semaine de bienvenue, succès) ; le calendrier vit dans `packages/core/src/rules.ts`.
- **Les variantes d'exemplaire** : `user_cards.variant` (`"standard"` aujourd'hui) fait déjà partie de la clé primaire. La carte dénichée s'y range sans nouvelle table d'exemplaires.
- **Les cartes épinglées** (`pinned_cards`) et le profil public.
- **Les tranches d'âge** déclarées à l'inscription : `15-17`, `18-24`… (`player_age_brackets`), facultatives.
- **La réserve de mots** : le pré-tri de la chaîne de contenu, en local (`content/pipeline/data/prescreen.jsonl`), qui n'existe pas en production.
- **Aucun paiement**, aucune dépendance Stripe.

## 1. Ce que voit le joueur

### Page Mécène, sur le web

- **Avant l'ouverture** (vente fermée, `PATRON_SALES`) : la page et son entrée dans le menu sont cachées à qui ne peut pas encore acheter (choix du 2026-11-09) ; `/mecene` renvoie vers Jouer. Seuls les admins et les mécènes la voient. La fausse porte (avantages, prix, « Préviens-moi ») ne sert plus qu'à qui ne peut pas acheter une fois la vente ouverte.
- **Vente ouverte, joueur non abonné** :
  - les avantages, le cosmétique du mois (« Ce mois-ci, les mécènes reçoivent le cadre Sceau de cire. »), le prix ;
  - deux choix, « 3,99 € par mois » et « 29,99 € par an », et « résiliable en un clic » ;
  - pendant la fenêtre fondatrice, le bandeau « Mécène fondateur », avec son dernier jour et le cadre Tessère ;
  - une case non cochée : « Je veux profiter tout de suite de mon abonnement et je renonce à mon droit de rétractation. » (libellé final par l'avocat) ;
  - compte déclaré 15-17 ans : « Tu as moins de 18 ans. Demande l'accord d'un parent avant de t'abonner. » au-dessus du bouton ;
  - un invité voit l'offre, et le bouton l'envoie créer un compte : on ne s'abonne qu'avec un compte.
- **Le bouton « Devenir mécène »** part sur la page de paiement de Stripe (Checkout), puis revient sur `/mecene?merci`.
- **Retour de Stripe** : « Te voilà mécène ! » et la suite (titre et badge, cosmétique du mois, mot à dénicher). Si le webhook n'est pas encore arrivé, la page attend quelques secondes en relisant le statut, puis dit « Ton paiement est en cours de confirmation. » sans jamais dire « échec ».
- **Joueur abonné** : son statut (« Mécène depuis mars 2027 », « Prochain paiement le 14 avril, 3,99 € », ou « Mécène jusqu'au 22 mars » après une résiliation), les cosmétiques du mois à réclamer, ses mots dénichés et le bouton « Dénicher un mot » s'il lui reste un droit, et « Gérer mon abonnement » (portail client de Stripe : moyen de paiement, factures, passage à l'annuel, résiliation).
- **Abonnement résilié, encore en cours** : « Ton abonnement s'arrête le 14 mars. Tes cosmétiques, tes éditions et tes cartes signées restent à toi. » et « Reprendre mon abonnement ».
- **Paiement refusé** : « Ton dernier paiement n'est pas passé. Mets à jour ta carte pour rester mécène. » avec le lien du portail, tant que Stripe réessaie.

### Ailleurs dans le jeu

- **Le badge de mécène** sur le profil public et dans la liste des joueurs ; au survol, « Ce mécène fait vivre Leximon. » ; « Mécène fondateur » pour les fondateurs (badge rouge, au survol « Ce mécène fondateur a soutenu Leximon dès le premier mois. », au passé puisqu'il le garde à vie).
- **Le titre « Mécène »** (ou « Mécène fondateur ») se choisit parmi les titres, tant que l'abonnement court.
- **L'entrée « Devenir mécène »** reste là où est la fausse porte (menu du joueur, profil). Jamais pendant l'ouverture d'un sachet, jamais dans une fenêtre qui bloque (P73).

### Sur le mobile

- Le badge, le titre, les cosmétiques et la carte dénichée d'un mécène s'affichent comme sur le web.
- Un mécène voit sa page Mécène en lecture : statut, cosmétiques à réclamer, mots dénichés, et « Ton abonnement se gère depuis ton compte sur leximon.fr. » sans lien.
- Un joueur non abonné ne voit pas d'entrée Mécène : aucun bouton, lien ni prix, que Google et Apple interdisent hors de leur paiement.
- Dénicher un mot se fait aussi sur le mobile : ce n'est pas un achat, c'est un avantage déjà payé.

## 2. Règles

### Abonnement

- **Une offre, deux rythmes** : 3,99 € par mois ou 29,99 € par an, prix TTC, TVA non applicable. Passer du mois à l'an (ou l'inverse) se fait dans le portail ; Stripe calcule le prorata.
- **Est mécène** un joueur dont l'abonnement est payé, ou en retard de paiement tant que Stripe réessaie. Il cesse de l'être quand Stripe abandonne ou quand la période résiliée se termine.
- **Pas d'essai gratuit** : le premier paiement a lieu à l'abonnement, et tout arrive avec lui.
- **Fondateur** : premier paiement pendant les trente premiers jours de vente, du 9 novembre au 8 décembre 2026 inclus (`founding` dans `PATRON_SCHEDULE`, décidé le 2026-11-09). Le badge « Mécène fondateur » et le cadre Tessère (`founderCosmetics`, donné avec le badge, sans rien à réclamer) restent à vie. Le prix tient tant que l'abonnement ne s'interrompt pas, pour tout abonné : un fondateur qui revient paie le prix du moment.
- **Une hausse de prix** ne touche que les nouveaux abonnés : un nouveau prix dans Stripe, les abonnements en cours gardent le leur.

### Cosmétique du mois

- Le calendrier vit dans `rules.ts` : à chaque mois, son cosmétique, dévoilé le 1er à minuit (heure de Paris), jamais plus tôt.
- **Un mécène reçoit le cosmétique d'un mois dès qu'une période payée couvre au moins un jour de ce mois.** Un abonné annuel reçoit donc chaque mois celui du mois. Le cosmétique se réclame sur la page Mécène, comme une récompense de niveau, et reste à vie.
- Un cosmétique de mécène n'imite aucun signe de rareté (P72) : ni or, ni reflet, ni couleur de rareté.

### Ton mot dans le jeu

- **Les droits** :
  - annuel : un droit au premier paiement de l'année, puis un au début de chaque trimestre payé (quatre par an) ;
  - mensuel : un droit au premier paiement, puis un tous les trois paiements (quatre par an, comme l'annuel). Les paiements se comptent sur toute la vie du compte : arrêter puis reprendre ne redonne pas de mot (§ 10, point 1).
- Un droit non utilisé se garde tant que l'abonnement court, et se perd à l'arrêt (P73). Un mot écarté au contrôle qualité rend son droit, même après l'arrêt : le joueur a payé ce mot.
- **La réserve** : les mots pré-triés et pas encore publiés, avec leur définition courte, sans leur rareté. On cherche par début de mot ou on feuillette par thème. Aucun champ libre.
- **Un mot ne se déniche qu'une fois** : le premier qui le réserve l'a. Deux mécènes au même instant : un seul l'obtient, l'autre lit « Ce mot vient d'être déniché par un autre mécène. ».
- **Après la réservation** : « *Lucubrateur* est à toi. Il paraîtra avec sa collection. » Le mot sort de la réserve pour tout le monde.
- **À la parution**, dans la prochaine collection où il a sa place :
  - la carte porte « Déniché par [pseudo] », à vie, pour tous les joueurs ;
  - le mécène reçoit son **exemplaire du dénicheur** et une notification : « Ta carte est sortie ! *Lucubrateur*, déniché par toi. » ;
  - les autres joueurs la trouvent dans les sachets comme toute carte.
- **L'exemplaire du dénicheur** :
  - une variante d'exemplaire à part, unique, qui se voit au premier coup d'œil (un signe propre, à dessiner, qui n'imite aucune rareté) ;
  - il compte dans l'album, s'épingle sur le profil, se joue en défi et en joute comme toute carte, et ses réponses comptent en maîtrise et en XP ;
  - il ne s'échange pas, ne se recycle pas, et ne rapporte pas d'XP à son arrivée (ni XP de mot nouveau, ni complétion de rareté) ;
  - s'il gagne ensuite un exemplaire ordinaire du même mot, celui-ci suit les règles habituelles (doubles, échanges).
- **Le pseudo sur la carte** est celui du jour de la publication, repris à chaque nouvelle version du catalogue. Un mécène qui supprime son compte disparaît de la carte à la version suivante. Un mécène sans pseudo en choisit un avant de dénicher.

### Ce qui reste à vie, ce qui se perd

| À l'arrêt de l'abonnement | Reste | Se perd |
|---|---|---|
| Cosmétiques réclamés, cadre Tessère des fondateurs | Oui | |
| Badge « Mécène fondateur » | Oui | |
| Cartes dénichées, leur signature et l'exemplaire du dénicheur | Oui | |
| Mot réservé, pas encore paru | Oui, il paraît quand même | |
| Badge et titre « Mécène » | | Oui |
| Droits de dénicher non utilisés | | Oui |
| Cabinet du mot et carnet (lots suivants) | | Oui |

### Mineurs, rétractation, remboursement

- **15-17 ans** : l'achat reste ouvert, avec la mention du parent. Un parent qui le demande obtient le remboursement et la résiliation, depuis l'admin. Un compte de moins de 15 ans n'existe pas.
- **Rétractation** : la case de renonciation est obligatoire pour payer. Sa date est gardée.
- **Remboursement** : à la main, depuis l'admin, qui rembourse chez Stripe et résilie. Un remboursement complet fait directement dans le tableau de bord de Stripe est lu aussi (sans résilier : la résiliation s'y fait à part). Un abonnement remboursé retire le cosmétique du mois concerné s'il n'a pas été réclamé ; ce qui est réclamé reste.

## 3. Technique

### Stripe, côté tableau de bord · toi

- Un produit « Mécène » et trois prix en EUR : `patron_monthly` (3,99 €, mensuel), `patron_yearly` (29,99 €, annuel), désignés par leur `lookup_key`.
- Pas de Stripe Tax. Pied des factures : « TVA non applicable, art. 293 B du CGI », avec ton nom, ton SIRET et ton adresse.
- Reçus et factures envoyés par Stripe à chaque paiement.
- Portail client : changer de rythme, moyen de paiement, factures, résilier en fin de période. Pas de pause.
- Relances des paiements refusés (Smart Retries) puis résiliation de l'abonnement à la fin.
- Deux points de webhook (production, staging), et la CLI Stripe en local.

### Données (migration additive)

- **`patron_subscriptions`**, une ligne par compte : identifiants Stripe du client, du dernier checkout ouvert et de l'abonnement, statut, rythme, fin de la période en cours, résiliation prévue, `first_paid_at`, `founder_at`, `waiver_accepted_at`. Le serveur fait foi : ces champs ne s'écrivent que depuis un webhook ou une lecture de Stripe.
- **`patron_periods`**, une ligne par facture payée : début, fin, facture, remboursée ou non. C'est la source des cosmétiques et des droits, calculés à la volée.
- **`patron_cosmetic_claims`** (lot 2) : (compte, mois) en clé primaire, ce qui a été réclamé.
- **`stripe_events`** : l'identifiant de chaque événement reçu, en clé primaire. Un événement rejoué ne fait rien.
- **`reserve_words`** (lot 3) : la réserve publiée (identifiant, lemme, définition courte, thème, collection probable, version), sans la rareté.
- **`word_finds`** (lot 3) : un mot déniché par ligne, le mot en clé primaire (un mot, un dénicheur), le compte, l'état (`reserved`, `published`, `rejected`), la carte parue.
- **`user_cards.variant = "finder"`** (lot 3) pour l'exemplaire du dénicheur.

### API (Hono, Workers)

Construit aux lots 1 et 2 (`apps/api/src/patron/`), sauf la réserve.

- `GET /me/patron` : la vente (`open`, `closed`, `unavailable` sans les secrets), si le joueur peut acheter, fondateur ou non, la fenêtre fondatrice ouverte (`foundingOffer`), compte déclaré 15-17 ans (`minor`), le badge (`mark`), le cosmétique du mois, ceux à réclamer, et l'abonnement (`patron` ou `none`, rythme, fin de période, résiliation prévue, paiement en échec, mécène depuis). Les droits de dénicher viendront au lot 3.
- `POST /me/patron/checkout` (`plan`, `waiverAccepted: true`, clé d'idempotence) : refuse un invité, un abonné, ou tout le monde sauf les admins tant que la vente est fermée ; crée le client Stripe au premier passage (identifiant du joueur en métadonnée, sans adresse ni nom : Checkout demande l'adresse des reçus) ; expire le checkout précédent resté ouvert ; ouvre une session Checkout en mode abonnement, payée tout de suite ; rend l'adresse de la page de paiement. La clé d'idempotence est passée à Stripe : deux clics font une session.
- `POST /me/patron/portal` : une session du portail client, pour un compte qui a eu un abonnement.
- `POST /me/patron/refresh` : relit l'abonnement chez Stripe et rend le même corps que `GET /me/patron`. La page l'appelle au retour du portail (`/mecene?abonnement`), pour montrer une résiliation sans attendre le webhook.
- `POST /me/patron/cosmetics/:month/claim` : un mois payé (une période non remboursée qui en couvre un jour), pas encore réclamé, dont le calendrier a un cosmétique ; ligne du joueur verrouillée, une réclamation par mois. Le cosmétique entre dans l'apparence avec ceux des niveaux, et le titre « Mécène » (ou « Mécène fondateur ») y est tant que l'abonnement court.
- Le badge (`patron`) est ajouté au profil, au profil public et à la liste des joueurs (champ additif, `null` par défaut pour les anciennes versions).
- `GET /admin/patrons` (chiffres, revenu du mois, abonnés par dernier changement, page de 50) et `POST /admin/patrons/:userId/refund` (clé d'idempotence : rembourse le dernier paiement non remboursé, résilie tout de suite, note l'action au journal).
- `GET /me/patron/reserve` (`q` : début du mot, sans accent ni casse ; `theme` ; pages de 30 par curseur) et `POST /me/patron/reserve/:wordId/find` (lot 3, fait). Le dénichage verrouille la ligne d'abonnement du mécène (deux dénichages ne dépensent pas le même droit) ; le mot en clé primaire de `word_finds` le donne à un seul mécène. Refus : `no_right`, `taken`, `no_pseudo`, `not_in_reserve`. Redénicher son propre mot répond pareil. `GET /me/patron` porte `finds` (droits restants, mots dénichés et leur état).
- `POST /stripe/webhook` : corps brut, signature vérifiée par la bibliothèque de Stripe (tolérance de 5 minutes), événement relu avec Zod, noté dans `stripe_events` dans la même transaction que son effet, ligne du joueur verrouillée. Événements traités : `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` ; les autres sont acquittés sans effet. L'abonnement est relu chez Stripe avant d'écrire, donc l'ordre d'arrivée ne compte pas. Une facture de zéro ne fait pas de période. Un client que le jeu n'a pas créé (autre produit du même compte Stripe) est ignoré.
- Un second abonnement vivant à côté du premier (deux checkouts payés malgré l'expiration) est résilié tout de suite et laissé dans les journaux ; s'il a été payé, le remboursement se fait à la main.
- Aucun statut n'est accordé sur le seul retour de Checkout : il vient du webhook.
- **Vente fermée ou ouverte :** la variable `PATRON_SALES` du Worker (`"closed"` ou `"open"`, dans `apps/api/wrangler.jsonc`), comme `BETA_INVITES`, plutôt qu'un bouton de l'admin : ouvrir se fait au déploiement, et tant que c'est fermé, les admins peuvent payer pour de vrai. Le premier mois de vente se date dans `PATRON_SCHEDULE` (`packages/core/src/rules.ts`).
- **Remboursements :** l'admin du lot 2 rembourse et note la période remboursée ; un remboursement fait à la main dans le tableau de bord de Stripe n'est pas encore lu.
- **Suppression de compte :** l'abonnement est résilié tout de suite chez Stripe et le client perd l'identifiant du joueur, avant d'effacer le compte ; si Stripe ne répond pas, rien n'est effacé (503) et le joueur réessaie. Le client Stripe garde ses factures (obligation comptable).

### Contenu

- La commande `reserve` de la chaîne écrit `content/reserve/reserve.json` (mots pré-triés « ok », pas encore publiés ni rédigés, première définition du Littré coupée à 240 signes, nature) ; `pnpm reserve:publish` (ou `:prod`) la charge dans la base. Un mot que la réserve ne liste plus en sort, sauf s'il est déniché. Les thèmes ne viennent que de la rédaction : la réserve n'en a pas, on y cherche par le début du mot.
- `pnpm finds:export` (ou `:prod`) écrit `content/pipeline/data/finds.json` ; `select` place ces mots en tête de la série (« déniché ») et prévient s'il en manque un dans le vivier.
- `catalog:publish` passe à `published` les mots dénichés que la version publie, donne au dénicheur son exemplaire (`user_cards.variant = "finder"`, sans XP ni réclamation) et écrit `finders.json` (pseudo du dénicheur par carte, relu à chaque publication) à côté du manifeste. Le web et le mobile affichent « Déniché par [pseudo] » sur la fiche de la carte.
- `pnpm finds:reject <id>` passe un mot à `rejected` : le droit revient au mécène, même après l'arrêt. Le mécène le lit sur sa page Mécène, et une lettre du courrier le prévient (comme à la parution).

### Admin

- Page « Mécènes » (`/admin/mecenes`, faite au lot 2) : mécènes, résiliés encore en cours, paiements refusés, fondateurs, revenu par mois (dernier paiement de chacun, un annuel pour un douzième) ; chaque abonné avec son dernier paiement et « Rembourser et résilier ». L'historique complet des paiements reste dans Stripe.
- `/admin/mesure` : conversion de la page Mécène.

### Tests

- `packages/core` : statut d'après l'abonnement, cosmétiques couverts par des périodes, droits de dénicher (mensuel, annuel, changement de rythme, arrêt, mot rendu), fondateur.
- Intégration contre un vrai Postgres, Stripe simulé par des événements signés : webhook rejoué, événements dans le désordre, deux réservations du même mot en même temps, deux réclamations du même cosmétique, remboursement, relecture de l'abonnement au retour du portail.
- Recette en mode test de Stripe, avec les horloges de test (renouvellement, paiement refusé).

## 4. Lots

1. **Socle** (fait le 2026-11-08) : migration `0047`, SDK `stripe`, `GET /me/patron`, checkout, portail, webhook, `PATRON_SALES`, règles dans `core` (statut, fondateur), suppression de compte, tests. Rien de visible pour les joueurs.
2. **Page Mécène, badge et cosmétiques** (fait le 2026-11-08) : page Mécène web (porte avant la vente, offre, retour de Stripe, abonné, résilié, paiement refusé), badge et titre, cosmétique du mois réclamé ; sur le mobile, badge et page en lecture, que seul un joueur qui porte le badge atteint (lien dans son profil) ; admin Mécènes. Prix dans `PATRON_SCHEDULE` (à changer en même temps que ceux de Stripe). Restent : le calendrier des cosmétiques (un mois se remplit dans `PATRON_SCHEDULE` le 1er au plus tôt). Conversion de la page dans `/admin/mesure` faite le 2026-11-09.
3. **Dénichage** (fait le 2026-11-08) : droits dans `core` (`earnedFinds`, `findsLeft`, `monthsPerFind` dans `PATRON_SCHEDULE`), migration `0050` (`reserve_words`, `word_finds`), réserve publiée, recherche et dénichage (web `/mecene/denicher` et mobile `/denicher`), section « Ton mot dans le jeu » sur la page Mécène, exemplaire du dénicheur donné à la publication, « Déniché par » sur la fiche de carte, liens avec la chaîne de contenu. Courrier à la parution et à l'écart fait le 2026-11-09 (recette MEC-20) ; l'app ignore désormais une lettre d'un type qu'elle ne connaît pas. Reste le signe de l'exemplaire dans l'album et sur la carte (§ 10, point 2).
4. **Ouverture** : conditions de vente (`/conditions-de-vente`, liées sous le bouton d'abonnement), paragraphe des CGU et section « Abonnement Mécène » de « Tes données » rédigés le 2026-11-09, à faire relire ; clés de production, `PATRON_SALES` à `"open"`. Pas de lien vers les conditions de vente dans l'app mobile, qui ne vend rien (règles des stores).

Lots suivants, hors de ce cahier : cabinet du mot et carnet (février), éditions de bibliothèque, dos de carte et thème d'album (mars), « Offrir Mécène », achat intégré sur le mobile.

## 5. Textes

À écrire avec [voix.md](../voix.md), en reprenant ceux de la stratégie : vitrine, badge, après l'achat, mot réservé, parution, abonnement arrêté. S'y ajoutent : paiement en attente de confirmation, paiement refusé, mot déjà déniché, mention du parent, case de renonciation.

## 6. Ce qui est à ta charge

- **Stripe** : produit, prix, pied de facture, portail, relances, webhooks (une fiche pas à pas viendra avec le lot 1).
- **Franchise de TVA** : vérifier avec un comptable que ta micro-entreprise y est, et suivre les seuils (franchise, et 10 000 € de ventes vers le reste de l'UE). Au-delà, bascule vers Managed Payments (D-059).
- **Avocat** avant d'ouvrir : CGV, CGU, case de renonciation, mineurs.
- **Les cosmétiques** du calendrier et le signe de l'exemplaire du dénicheur (§ 10, point 2).

## 7. Risques

- **Le webhook n'arrive pas** (Workers ou base injoignable) : Stripe réessaie pendant trois jours ; la page Mécène relit l'abonnement chez Stripe si le webhook tarde, sans rien accorder qui ne vienne de Stripe.
- **Le serveur maison tombe** pendant un paiement : Stripe encaisse quand même, et le webhook rejoué rattrape à la remise en route.
- **La réserve vidée** par les dénichages plus vite qu'on publie : c'est un bon problème (stratégie), on élargit les collections.

## 8. Hors champ

Cabinet du mot, carnet, éditions de bibliothèque, dos de carte, thème d'album, « Offrir Mécène », achat intégré Google et Apple, RevenueCat, cosmétiques à l'unité.

## 9. Décisions

Tranché par le propriétaire le 2026-11-08 :

| # | Question | Choix |
|---|---|---|
| Q1 | Encaisser sur le web | Stripe en direct, sur son compte existant, en franchise de TVA (D-059) |
| Q2 | Premier lot de vente | Paiement, statut, cosmétique du mois, fondateur et dénichage |
| Q3 | Mobile | Statut seul, achat sur le web ; achat intégré plus tard |
| Q4 | Essai | Aucun essai gratuit (retiré le 2026-11-09) : le premier paiement a lieu à l'abonnement |
| Q5 | Exemplaire du dénicheur | Exemplaire spécial, visible comme unique, non échangeable et sans XP, épinglable et jouable comme toute carte |
| Q6 | Fondateur qui revient | Prix fondateur perdu à l'arrêt, badge et sceau gardés |
| Q7 | Comptes 15-17 ans | Achat ouvert, mention du parent, remboursement sur demande d'un parent |
| Q8 | Dépendance | SDK officiel `stripe` dans `apps/api` |

## 10. À confirmer

1. **Premier mot d'un abonné mensuel.**
   - a. Après trois mois payés, comme le dit la stratégie (« un mot par trimestre, un dès le départ pour l'annuel »). L'annuel garde un vrai avantage ; le texte « Va dénicher ton premier mot » ne vaut que pour l'annuel.
   - b. Un mot au premier paiement, puis tous les trois mois. Plus fort à la conversion, mais un mot signé à vie pour 3,99 € puis une résiliation.
   - **Tranché le 2026-11-09 : b.** Attendre trois mois donnait l'impression de payer dans le vide. Les paiements se comptent sur toute la vie du compte, ce qui empêche d'enchaîner les abonnements d'un mois pour récolter des mots.
2. **Le signe de l'exemplaire du dénicheur** : un sceau de cire en coin, un ex-libris au dos, ou un liseré gravé, sans or ni couleur de rareté. À dessiner, avec les cosmétiques du calendrier, par toi ou un graphiste (50 à 150 € pièce, estimation).
3. **Jouer la carte dénichée** : je lis « sans XP » comme « rien à l'arrivée », et ses réponses en défi comptent comme pour toute carte (maîtrise, XP de la réponse), puisque tu veux qu'elle se joue comme les autres. C'est une petite entorse à P72 (« ni maîtrise, ni XP »), sur un mot à la fois. **Confirmé le 2026-11-09 :** ses réponses comptent comme pour toute carte.

## 11. Stripe pas à pas · toi

À faire d'abord en **mode test** (bascule en haut du tableau de bord), puis une seconde fois en production le jour de l'ouverture.

1. **Version de l'API.** Développeurs → Workbench → l'onglet de la version : noter celle du compte. Le webhook ci-dessous se crée avec la version du SDK, `2026-10-28.endive`, quelle que soit celle du compte.
2. **Produit et prix.** Catalogue de produits → Ajouter un produit « Mécène » (description : « Abonnement Mécène de Leximon »). Deux prix récurrents en EUR, sans taxe :
   - 3,99 € par mois, puis dans « Options avancées » la clé de recherche (lookup key) `patron_monthly` ;
   - 29,99 € par an, clé `patron_yearly`.
3. **Factures.** Paramètres → Facturation → Factures : pied de page « TVA non applicable, art. 293 B du CGI », avec ton nom, ton SIRET et ton adresse dans les informations de l'entreprise. Paramètres → E-mails clients : cocher les reçus des paiements réussis et des remboursements.
4. **Portail client.** Paramètres → Facturation → Portail client : autoriser la mise à jour du moyen de paiement, l'historique des factures, le changement de formule entre les deux prix du produit Mécène (prorata), et la résiliation **en fin de période**, sans motif obligatoire. Pas de pause. Lien de retour : `https://leximon.fr/mecene`.
5. **Relances.** Paramètres → Facturation → Abonnements et e-mails → Gérer les paiements échoués : Smart Retries, puis « résilier l'abonnement » quand toutes les tentatives échouent. Sur la même page, activer l'e-mail des renouvellements à venir, au moins 30 jours avant : les conditions de vente promettent ce rappel pour la formule annuelle.
6. **Webhook.** Développeurs → Webhooks → Ajouter une destination : `https://api.leximon.fr/stripe/webhook`, version `2026-10-28.endive`, événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded` (un remboursement complet fait depuis le tableau de bord de Stripe retire la période, comme celui de l'admin). Copier le secret de signature (`whsec_…`).
7. **Clés.** Développeurs → Clés API : une clé secrète restreinte suffit, avec les droits en écriture sur Customers, Checkout Sessions, Customer portal, Subscriptions et Refunds, et en lecture sur Prices et Invoices (le remboursement de l'admin retrouve le paiement d'une facture). En local, la clé secrète standard `sk_test_…` suffit. Puis `wrangler secret put` (voir [mise-en-ligne.md](../mise-en-ligne.md#6-secrets-de-lapi--toi)).

**En local :** mettre la clé de test dans `apps/api/.dev.vars` (`STRIPE_SECRET_KEY`), installer la [CLI Stripe](https://docs.stripe.com/stripe-cli), puis :

```bash
stripe listen --forward-to localhost:8787/stripe/webhook
```

Elle affiche un `whsec_…` à mettre dans `STRIPE_WEBHOOK_SECRET`. Avec `PATRON_SALES` à `"closed"`, il faut un compte admin (`pnpm admin:grant <email>`) pour aller jusqu'au paiement ; carte de test `4242 4242 4242 4242`. Les horloges de test (Facturation → Horloges de test) font passer les renouvellements sans attendre.

