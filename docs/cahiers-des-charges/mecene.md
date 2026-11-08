# Cahier des charges · Abonnement Mécène et paiement Stripe

- **Statut :** tranché le 2026-11-08 sur huit questions (§ 9) ; trois points restent à confirmer (§ 10). Rien n'est construit.
- **Règles concernées :** P72 (gratuit et payant) et P73 (abonnement Mécène), dans [regles-du-jeu.md](../regles-du-jeu.md), qui fait foi. Décision technique : D-059.
- **D'où ça vient :** le propriétaire veut brancher Stripe, sur le compte qu'il a déjà, et construire l'offre Mécène. La stratégie commerciale ouvre la vente vers mi-janvier 2027, si les seuils sont atteints (2 000 joueurs actifs par mois, 10 % de rétention à 7 jours, 3 % de clics sur la fausse porte) et après relecture des documents par un avocat.
- **Objectif :** tout construire maintenant, en mode test de Stripe, derrière un interrupteur de l'admin. Le jour où les seuils et l'avocat sont là, on passe les clés en production et on ouvre.

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

- **Avant l'ouverture** (interrupteur fermé) : la fausse porte, avec les avantages de P73 réécrits, le prix et « Préviens-moi ».
- **Vente ouverte, joueur non abonné** :
  - les avantages, le cosmétique du mois en image (« Ce mois-ci chez les mécènes : le cadre Cadeler. »), le prix ;
  - deux choix, « 3,99 € par mois » et « 29,99 € par an », et « 14 jours gratuits, résiliables en un clic » si le joueur n'a jamais eu d'essai ;
  - pendant le premier mois de vente, le bandeau « Mécène fondateur » et le Sceau du fondateur en image ;
  - une case non cochée : « Je veux profiter tout de suite de mon abonnement et je renonce à mon droit de rétractation. » (libellé final par l'avocat) ;
  - compte déclaré 15-17 ans : « Tu as moins de 18 ans : demande l'accord d'un parent avant de t'abonner. » au-dessus du bouton ;
  - un invité voit l'offre, et le bouton l'envoie créer un compte : on ne s'abonne qu'avec un compte.
- **Le bouton « Devenir mécène »** part sur la page de paiement de Stripe (Checkout), puis revient sur `/mecene?merci`.
- **Retour de Stripe** : « Te voilà mécène ! » et la suite selon le cas (essai en cours, premier mot à dénicher, cosmétique à réclamer). Si le webhook n'est pas encore arrivé, la page attend quelques secondes en relisant le statut, puis dit « Ton paiement est en cours de confirmation. » sans jamais dire « échec ».
- **Joueur abonné** : son statut (« Mécène depuis mars 2027 », « Prochain paiement le 14 avril, 3,99 € », ou « Ton essai se termine le 22 mars »), les cosmétiques du mois à réclamer, ses mots dénichés et le bouton « Dénicher un mot » s'il lui reste un droit, et « Gérer mon abonnement » (portail client de Stripe : moyen de paiement, factures, passage à l'annuel, résiliation).
- **Abonnement résilié, encore en cours** : « Ton abonnement s'arrête le 14 mars. Tes cosmétiques, tes éditions et tes cartes signées restent à toi. » et « Reprendre mon abonnement ».
- **Paiement refusé** : « Ton dernier paiement n'est pas passé. Mets à jour ta carte pour rester mécène. » avec le lien du portail, tant que Stripe réessaie.

### Ailleurs dans le jeu

- **Le badge de mécène** sur le profil public et dans la liste des joueurs ; au survol, « Mécène. Fait vivre Leximon. » ; « Mécène fondateur » pour les fondateurs.
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
- **Est mécène** un joueur dont l'abonnement est en essai, payé, ou en retard de paiement tant que Stripe réessaie. Il cesse de l'être quand Stripe abandonne ou quand la période résiliée se termine.
- **L'essai de 14 jours** : carte bancaire demandée, un seul essai par compte, à vie. Pendant l'essai, le joueur a le titre et le badge. Le cosmétique du mois, le droit de dénicher et le statut de fondateur n'arrivent qu'au premier paiement, pour qu'on ne les récolte pas en enchaînant les essais.
- **Fondateur** : premier paiement pendant le premier mois de vente (dates dans `rules.ts`). Le badge « Mécène fondateur » et le Sceau du fondateur restent à vie. Le prix fondateur tient tant que l'abonnement ne s'interrompt pas : un fondateur qui revient paie le prix du moment. Tant que le prix ne monte pas, cela ne change rien.
- **Une hausse de prix** ne touche que les nouveaux abonnés : un nouveau prix dans Stripe, les abonnements en cours gardent le leur.

### Cosmétique du mois

- Le calendrier vit dans `rules.ts` : à chaque mois, son cosmétique, dévoilé le 1er à minuit (heure de Paris), jamais plus tôt.
- **Un mécène reçoit le cosmétique d'un mois dès qu'une période payée couvre au moins un jour de ce mois.** Un abonné annuel reçoit donc chaque mois celui du mois. Le cosmétique se réclame sur la page Mécène, comme une récompense de niveau, et reste à vie.
- Un cosmétique de mécène n'imite aucun signe de rareté (P72) : ni or, ni reflet, ni couleur de rareté.

### Ton mot dans le jeu

- **Les droits** :
  - annuel : un droit au premier paiement de l'année, puis un au début de chaque trimestre payé (quatre par an) ;
  - mensuel : un droit tous les trois mois payés (voir § 10, point 1).
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
  - il compte dans l'album, s'épingle sur le profil, se joue en défi et en joute comme toute carte ;
  - il ne s'échange pas, ne se recycle pas, et ne rapporte pas d'XP à son arrivée (ni XP de mot nouveau, ni complétion de rareté) ;
  - s'il gagne ensuite un exemplaire ordinaire du même mot, celui-ci suit les règles habituelles (doubles, échanges).
- **Le pseudo sur la carte** est celui du jour de la publication, repris à chaque nouvelle version du catalogue. Un mécène qui supprime son compte disparaît de la carte à la version suivante. Un mécène sans pseudo en choisit un avant de dénicher.

### Ce qui reste à vie, ce qui se perd

| À l'arrêt de l'abonnement | Reste | Se perd |
|---|---|---|
| Cosmétiques réclamés, Sceau du fondateur | Oui | |
| Badge « Mécène fondateur » | Oui | |
| Cartes dénichées, leur signature et l'exemplaire du dénicheur | Oui | |
| Mot réservé, pas encore paru | Oui, il paraît quand même | |
| Badge et titre « Mécène » | | Oui |
| Droits de dénicher non utilisés | | Oui |
| Cabinet du mot et carnet (lots suivants) | | Oui |

### Mineurs, rétractation, remboursement

- **15-17 ans** : l'achat reste ouvert, avec la mention du parent. Un parent qui le demande obtient le remboursement et la résiliation, depuis l'admin. Un compte de moins de 15 ans n'existe pas.
- **Rétractation** : la case de renonciation est obligatoire pour payer. Sa date est gardée.
- **Remboursement** : à la main, depuis l'admin, qui rembourse chez Stripe et résilie. Un abonnement remboursé retire le cosmétique du mois concerné s'il n'a pas été réclamé ; ce qui est réclamé reste.

## 3. Technique

### Stripe, côté tableau de bord · toi

- Un produit « Mécène » et trois prix en EUR : `patron_monthly` (3,99 €, mensuel), `patron_yearly` (29,99 €, annuel), désignés par leur `lookup_key`.
- Pas de Stripe Tax. Pied des factures : « TVA non applicable, art. 293 B du CGI », avec ton nom, ton SIRET et ton adresse.
- Reçus et factures envoyés par Stripe à chaque paiement.
- Portail client : changer de rythme, moyen de paiement, factures, résilier en fin de période. Pas de pause.
- Relances des paiements refusés (Smart Retries) puis résiliation de l'abonnement à la fin.
- Deux points de webhook (production, staging), et la CLI Stripe en local.

### Données (migration additive)

- **`patron_subscriptions`**, une ligne par compte : identifiants Stripe du client et de l'abonnement, statut, rythme, fin de la période en cours, fin de l'essai, résiliation prévue, `trial_used_at`, `founder_at`, `waiver_accepted_at`. Le serveur fait foi : ces champs ne s'écrivent que depuis un webhook ou une lecture de Stripe.
- **`patron_periods`**, une ligne par facture payée : début, fin, facture, remboursée ou non. C'est la source des cosmétiques et des droits, calculés à la volée.
- **`patron_cosmetic_claims`** : (compte, mois) en clé primaire, ce qui a été réclamé.
- **`stripe_events`** : l'identifiant de chaque événement reçu, en clé primaire. Un événement rejoué ne fait rien.
- **`reserve_words`** : la réserve publiée (identifiant, lemme, définition courte, thème, collection probable, version), sans la rareté.
- **`word_finds`** : un mot déniché par ligne, le mot en clé primaire (un mot, un dénicheur), le compte, l'état (`reserved`, `published`, `rejected`), la carte parue.
- **`user_cards.variant = "finder"`** pour l'exemplaire du dénicheur.

### API (Hono, Workers)

- `GET /me/patron` : statut, rythme, dates, fondateur, cosmétiques à réclamer, droits restants, mots dénichés.
- `POST /patron/checkout` (`plan`, `waiverAccepted`, clé d'idempotence) : vérifie que la vente est ouverte, que le joueur a un compte et n'est pas déjà abonné ; crée ou retrouve le client Stripe (identifiant du joueur en métadonnée, sans adresse ni nom) ; ouvre une session Checkout en mode abonnement, avec 14 jours d'essai si aucun essai n'a eu lieu ; rend l'adresse de la page de paiement.
- `POST /patron/portal` : une session du portail client, pour un abonné.
- `POST /patron/cosmetics/:month/claim` : réclame un cosmétique couvert par une période payée.
- `GET /reserve?prefix=&theme=&cursor=` et `POST /reserve/:wordId/find` : la réserve paginée par curseur, et la réservation (verrou sur la ligne du joueur, droit vérifié, conflit sur le mot qui rend un résultat « déjà déniché », pas une exception).
- `POST /webhooks/stripe` : corps brut, signature vérifiée par `constructEventAsync`, événement noté dans `stripe_events` dans la même transaction que son effet. Événements traités : `checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. Pour l'abonnement, on relit l'objet chez Stripe plutôt que de croire l'ordre d'arrivée.
- Hors du webhook, la route attend la confirmation : aucun statut n'est accordé sur le seul retour de Checkout.
- Interrupteur de vente dans l'admin, et premier mois de vente daté dans `rules.ts`.
- Suppression de compte : l'abonnement est résilié tout de suite chez Stripe, le client Stripe garde ses factures (obligation comptable) sans identifiant du joueur.

### Contenu

- Une commande `reserve` de la chaîne publie la réserve (mots pré-triés retenus, première définition du Littré, thème) dans `content/releases`, et `pnpm reserve:publish` la charge dans la base (dev, puis production).
- Une commande `pnpm finds:export` sort les mots dénichés ; `select` les place en tête de la collection où ils ont leur place, et `release` y écrit le pseudo du dénicheur.
- Un mot déniché qui échoue au contrôle qualité passe à `rejected` dans la base, ce qui rend le droit et prévient le mécène.

### Admin

- Page « Mécènes » : nombre d'abonnés, revenu du mois, essais en cours, résiliations ; un abonné avec ses paiements, « Rembourser et résilier ».
- `/admin/mesure` : conversion de la page Mécène, essais convertis.

### Tests

- `packages/core` : statut d'après l'abonnement, cosmétiques couverts par des périodes, droits de dénicher (mensuel, annuel, changement de rythme, arrêt, mot rendu), fondateur.
- Intégration contre un vrai Postgres, Stripe simulé par des événements signés : webhook rejoué, événements dans le désordre, deux réservations du même mot en même temps, deux réclamations du même cosmétique, essai refusé au second abonnement, remboursement.
- Recette en mode test de Stripe, avec les horloges de test (fin d'essai, renouvellement, paiement refusé).

## 4. Lots

1. **Socle** : migration, Stripe (produit, prix, webhooks), `GET /me/patron`, checkout, portail, interrupteur, règles dans `core`, tests. Rien de visible pour les joueurs.
2. **Page Mécène, badge et cosmétiques** : page Mécène web (tous les états du § 1), badge et titre, cosmétique du mois réclamé ; statut et cosmétiques sur le mobile ; admin Mécènes.
3. **Dénichage** : réserve publiée, recherche et réservation (web et mobile), exemplaire du dénicheur, « Déniché par » dans le catalogue et sur la carte, liens avec la chaîne de contenu.
4. **Ouverture** : CGV et CGU relues par l'avocat, page « Tes données » mise à jour, clés de production, ouverture par l'interrupteur.

Lots suivants, hors de ce cahier : cabinet du mot et carnet (février), éditions de bibliothèque, dos de carte et thème d'album (mars), « Offrir Mécène », achat intégré sur le mobile.

## 5. Textes

À écrire avec [voix.md](../voix.md), en reprenant ceux de la stratégie : vitrine, badge, après l'achat, mot réservé, parution, abonnement arrêté. S'y ajoutent : essai en cours, paiement en attente de confirmation, paiement refusé, mot déjà déniché, mention du parent, case de renonciation.

## 6. Ce qui est à ta charge

- **Stripe** : produit, prix, pied de facture, portail, relances, webhooks (une fiche pas à pas viendra avec le lot 1).
- **Franchise de TVA** : vérifier avec un comptable que ta micro-entreprise y est, et suivre les seuils (franchise, et 10 000 € de ventes vers le reste de l'UE). Au-delà, bascule vers Managed Payments (D-059).
- **Avocat** avant d'ouvrir : CGV, CGU, case de renonciation, mineurs.
- **Les cosmétiques** du calendrier : Sceau du fondateur, Cadeler, Le Lucubrateur, et le signe de l'exemplaire du dénicheur (§ 10, point 2).

## 7. Risques

- **Le webhook n'arrive pas** (Workers ou base injoignable) : Stripe réessaie pendant trois jours ; la page Mécène relit l'abonnement chez Stripe si le webhook tarde, sans rien accorder qui ne vienne de Stripe.
- **Le serveur maison tombe** pendant un paiement : Stripe encaisse quand même, et le webhook rejoué rattrape à la remise en route.
- **Un essai abusé** par des comptes multiples : rien à récolter pendant l'essai, donc peu d'intérêt.
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
| Q4 | Essai | 14 jours avec carte ; cosmétique, dénichage et fondateur au premier paiement |
| Q5 | Exemplaire du dénicheur | Exemplaire spécial, visible comme unique, non échangeable et sans XP, épinglable et jouable comme toute carte |
| Q6 | Fondateur qui revient | Prix fondateur perdu à l'arrêt, badge et sceau gardés |
| Q7 | Comptes 15-17 ans | Achat ouvert, mention du parent, remboursement sur demande d'un parent |
| Q8 | Dépendance | SDK officiel `stripe` dans `apps/api` |

## 10. À confirmer

1. **Premier mot d'un abonné mensuel.**
   - a. Après trois mois payés, comme le dit la stratégie (« un mot par trimestre, un dès le départ pour l'annuel »). L'annuel garde un vrai avantage ; le texte « Va dénicher ton premier mot » ne vaut que pour l'annuel.
   - b. Un mot au premier paiement, puis tous les trois mois. Plus fort à la conversion, mais un mot signé à vie pour 3,99 € puis une résiliation.
   - **Recommandation : a.**
2. **Le signe de l'exemplaire du dénicheur** : un sceau de cire en coin, un ex-libris au dos, ou un liseré gravé, sans or ni couleur de rareté. À dessiner, avec les cosmétiques du calendrier, par toi ou un graphiste (50 à 150 € pièce, estimation).
3. **Jouer la carte dénichée** : je lis « sans XP » comme « rien à l'arrivée », et ses réponses en défi comptent comme pour toute carte (maîtrise, XP de la réponse), puisque tu veux qu'elle se joue comme les autres. C'est une petite entorse à P72 (« ni maîtrise, ni XP »), sur un mot à la fois. À confirmer.
