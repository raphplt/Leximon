# Fiches des stores

Textes et réponses à recopier dans la Play Console et App Store Connect. Identifiant de l'app sur les deux stores : `fr.leximon.app`. Le ton suit [voix.md](voix.md) (« Vendre le bénéfice »).

Les chiffres (1 561 cartes, trois collections) suivent le catalogue publié : à revoir à chaque nouvelle collection.

## Textes communs

**Description longue** (Play : 4 000 signes au plus, App Store : pareil) :

> Tu sais ce qu'est un charivarieur ? Un croûtier ? Un morgueur ?
>
> Leximon est un jeu de cartes à collectionner où chaque carte est un mot que plus personne ne dit. 1 561 mots rares et anciens du français, chacun avec sa définition, son étymologie, sa prononciation et une gravure d'époque.
>
> DES MOTS À PLACER CE SOIR
> Lucubrateur : celui qui travaille la nuit, à la lueur de la lampe. Imprimé une fois sur 17 milliards de mots.
> Clabaudeur : celui qui crie beaucoup et sans raison.
> Croûtier : mauvais peintre.
> Orviétan : remède de charlatan, et par extension tout ce qui sert à tromper.
>
> COMMENT ÇA SE JOUE
> • Des sachets gratuits qui se rechargent au fil de la journée. Tu les déchires du doigt, les cartes sortent une à une.
> • Six raretés, de Courant à Légendaire. Incline le téléphone : la lumière glisse sur les cartes.
> • Des défis pour retenir tes mots. Écris-le de tête une semaine plus tard, ta carte passe à l'Encre. Un mois plus tard, à la Dorure. Les défis rapportent des sachets bonus.
> • Tes doubles s'échangent avec les autres joueurs, carte contre carte.
> • Trois collections : Les Fondateurs, Caractères et travers (les insultes d'antan), Métiers et objets disparus.
> • Un clan, des amis, un profil où épingler tes plus belles trouvailles.
>
> Rien ne s'achète : ni sachet, ni monnaie. Pas de publicité, pas de traceur.
>
> Inscription à partir de 15 ans.

Tant que l'inscription passe par une invitation, ajouter en tête : « Pendant le lancement, on s'inscrit sur invitation. Demande la tienne sur leximon.fr. » Jamais le mot « bêta » dans une fiche : Apple refuse les versions bêta sur l'App Store (règle 2.2) et les renvoie à TestFlight.

**Nouveautés de la version 1.0.0** (500 signes au plus) :

> Première version. Les sachets se déchirent du doigt, et la lumière suit l'inclinaison du téléphone.

**Adresses :**

| Champ | Adresse |
|---|---|
| Site | https://leximon.fr |
| Contact, assistance | contact@leximon.fr, page https://leximon.fr/mentions |
| Politique de confidentialité | https://leximon.fr/confidentialite |
| Suppression du compte (Play) | https://leximon.fr/confidentialite (section « Tes droits » : dans l'app, Réglages puis « Supprimer mon compte », ou par e-mail) |

## Google Play

| Champ | Valeur |
|---|---|
| Nom (30 signes) | Leximon : mots rares en cartes |
| Description courte (80 signes) | Chaque carte est un mot oublié du français. Ouvre, collectionne, échange. |
| Catégorie | Jeux › Mots (le classement « Cartes » est occupé par le solitaire et le poker) |
| Tags | Cartes à collectionner, Mots, Culture, Solo, pris dans la liste de Google. Jamais « Hors ligne » : le jeu a besoin du réseau |
| Coordonnées publiques | contact@leximon.fr, https://leximon.fr, pas de téléphone |
| Contient des annonces | Non |
| Achats dans l'appli | Non |
| Public cible | 16-17 ans et 18 ans et plus. Ne pas cocher les moins de 13 ans : le règlement Familles s'appliquerait |

**Classification du contenu (questionnaire IARC), catégorie « Jeu » :**

- Violence, sexualité, langue : **oui**, au niveau le plus léger, en texte seulement. Des définitions y font allusion (*sicaire*, *garrotte*, *gourgandine*, *ribauderie*), et *Caractères et travers* est faite d'insultes d'antan.
- Peur, jeux d'argent, humour grossier, symboles nazis : non.
- Interactions entre utilisateurs : **oui** (discussion de clan, pseudos, échanges de cartes). On peut bloquer, signaler, et la discussion est modérée.
- Interactions limitées aux amis : non. Aucun réglage ne le permet.
- Partage de la position : non.
- Achats numériques, récompenses convertibles, NFT : non. Les sachets ne s'achètent pas.

On s'attend à PEGI 12 au plus, avec la mention « Interactions entre utilisateurs ». L'inscription demande 15 ans : la note ne restreint personne.

**Sécurité des données :**

- Données chiffrées en transit : oui.
- Suppression possible : oui, dans l'app et par l'adresse ci-dessus.
- Partage avec des tiers : aucun. Cloudflare et Lettermint sont des sous-traitants, et Google ne compte pas leur usage comme un partage.

| Type de données | Collectée | Obligatoire | Finalités |
|---|---|---|---|
| Infos personnelles › Adresse e-mail | Oui | Oui | Fonctionnement de l'appli, gestion du compte, communications du développeur |
| Infos personnelles › Nom (le pseudo : Google y range les surnoms) | Oui | Oui | Fonctionnement de l'appli, gestion du compte |
| Infos personnelles › ID utilisateur (identifiant du compte, code joueur) | Oui | Oui | Fonctionnement de l'appli, gestion du compte |
| Infos personnelles › Autres infos (tranche d'âge) | Oui | Non | Analyses |
| Messages › Autres messages dans l'appli (discussion de clan) | Oui | Non | Fonctionnement de l'appli, prévention des fraudes et sécurité (modération) |
| Activité dans l'appli › Interactions avec l'appli (jours d'ouverture, partie) | Oui | Oui | Fonctionnement de l'appli, analyses |
| Activité dans l'appli › Autres contenus générés (« Un retour ? », signalements) | Oui | Non | Fonctionnement de l'appli, prévention des fraudes et sécurité |

Rien d'autre : ni position, ni contacts, ni photos, ni identifiant publicitaire, ni rapport de plantage. L'adresse IP gardée avec chaque connexion sert à la sécurité, pas à situer le joueur, et ne se déclare pas.

**Accès à l'appli :** tout ou partie de l'app est restreinte. Il faut un compte de démonstration (voir plus bas).

**Visuels**, dans [apps/mobile/store/](../apps/mobile/store/) :

- icône 512 × 512 : `icon-512.png` ;
- image de présentation 1024 × 500 : `presentation-1024x500.png`, tirée de la planche `/planches/stores` du web (voir plus bas) ;
- 7 captures de téléphone en 1080 × 2160 (le format le plus haut que Google Play accepte, 2:1), à envoyer dans l'ordre : `android/01-sachet.jpg` à `android/07-fiche-precieux.jpg`. Elles ont été prises sur l'émulateur le 2026-11-05, dans l'allure « La Bibliothèque », barre d'état figée à 9:41.

## App Store

| Champ | Valeur |
|---|---|
| Nom (30 signes) | Leximon |
| Sous-titre (30 signes) | Les mots oubliés, en cartes |
| Texte promotionnel (170 signes) | Trois collections, 1 561 mots que plus personne ne dit. Des sachets gratuits, des défis pour les retenir, des doubles à échanger. |
| Mots-clés (100 signes) | `vocabulaire,français,dictionnaire,collection,tcg,langue,étymologie,culture,quiz,insultes,lexique` |
| Catégories | Jeux, sous-catégories Cartes et Mots |
| Copyright | 2026 Raphaël Plassart |
| Chiffrement | Aucun hors HTTPS. Déclaré dans `app.json`, la question ne revient pas à chaque build |
| Droits relatifs au contenu | Oui, contenus tiers avec les droits : définitions, citations et gravures viennent du domaine public ou de licences libres |

**Classification par âge :**

- Grossièretés ou humour grossier : rare ou léger (les insultes d'antan).
- Thèmes adultes, violence : rare ou léger, en texte seulement.
- Contenu généré par les utilisateurs, messagerie : **oui**. Elle est filtrée et modérée, avec signalement, blocage et suppression du compte dans l'app.
- Jeux d'argent, contenu simulé de jeux d'argent : non.
- Accès web sans restriction : non.

- Validation de l'âge : **oui** (la case « 15 ans ou plus », obligatoire pour créer un compte). Apple l'exige dès qu'il y a réseaux sociaux.
- Réseaux sociaux : **oui** (amis, fil des trouvailles, discussion de clan).
- Concours : peu fréquent (podium de la semaine, objectif du clan). Simulation de jeux de hasard : aucune. Jeux d'argent, coffres à butin : non, rien ne s'achète.
- Contenus à caractère sexuel ou nudité : aucun (des mots, pas de représentation).

Apple calcule 13+. On remplace par **16+** : les conditions d'utilisation imposent 15 ans, et Apple demande une note qui respecte ce minimum. L'app n'est pas proposée en Afghanistan ni au Maroc (lois locales sur les apps sociales).

**Confidentialité de l'app (étiquettes) :** aucun suivi entre apps (« Non » à la question du suivi pour chaque donnée). Toutes les données sont liées à l'utilisateur. Le pseudo n'est pas un « Nom » au sens d'Apple (prénom, nom de famille).

| Catégorie Apple | Finalités |
|---|---|
| Coordonnées › Adresse e-mail | Fonctionnalités de l'app, marketing du développeur (nouvelles, seulement si cochées) |
| Identifiants › Identifiant utilisateur | Fonctionnalités de l'app |
| Contenu utilisateur › Autre contenu utilisateur (discussion de clan, signalements) | Fonctionnalités de l'app |
| Contenu utilisateur › Service client (« Un retour ? ») | Fonctionnalités de l'app |
| Données d'utilisation › Interaction avec le produit | Analyse, fonctionnalités de l'app |
| Autres données (tranche d'âge) | Analyse |

**Captures :** 7 captures iPhone « écran moyen » (1206 × 2622, la taille qu'App Store Connect demande en 2026), dans [apps/mobile/store/ios/](../apps/mobile/store/ios/), à envoyer dans l'ordre. Elles ont été reprises le 2026-11-05 dans l'allure « La Bibliothèque », sur l'émulateur Android réglé comme un iPhone 16 Pro Max (440 × 956 points), barre d'état effacée, puis réduites. À refaire sur un vrai iPhone si l'app y diffère. L'iPad n'est pas visé.

**En-tête et résultats de recherche :** `en-tete-5244x2950.png` et `en-tete-3840x1646.png` (en PNG : Apple refuse le JPEG ici), deux cartes sans texte (le nom de l'app s'affiche par-dessus) : le sachet entre deux cartes sur le sous-main.

**Refaire l'image de présentation et les en-têtes :** avec le web lancé en local, ouvrir `/planches/stores?format=play` (1024 × 500), `?format=header` (1920 × 823) ou `?format=poster` (2622 × 1475), et la photographier sans le badge de Next, par exemple avec Chrome sans fenêtre :

```bash
google-chrome-stable --headless --hide-scrollbars --window-size=1920,823 --force-device-scale-factor=2 --virtual-time-budget=6000 --screenshot=en-tete-3840x1646.png "http://localhost:3000/planches/stores?format=header"
```

`play` se prend à l'échelle 1 et `poster` à l'échelle 2 (5244 × 2950).

## Compte de démonstration

Les deux stores exigent un accès complet pour l'examen. L'examinateur ne lit pas notre boîte, donc une seule adresse se connecte avec un code fixe, et aucun e-mail ne part vers elle. Le code expire et ne tolère que 3 erreurs, comme les autres. Sans les deux secrets, ce compte n'existe pas.

Mise en place, une fois :

1. Choisir l'adresse (par exemple `examen@leximon.fr`, qui n'a pas besoin de boîte) et un code de 6 chiffres tiré au hasard : `shuf -i 100000-999999 -n 1`.
2. Les poser en secrets de production (voir [mise-en-ligne.md](mise-en-ligne.md), étape 6), puis `pnpm deploy:prod`.
3. Créer le compte par un lien d'invitation, avec cette adresse et ce code, comme un joueur.
4. Le garnir : ouvrir quelques sachets, faire un défi, pour que l'examinateur voie l'album rempli.

Changer le code après chaque examen n'est pas nécessaire. Le retirer (`wrangler secret delete`) ferme le compte d'un coup.

**Notes pour l'examen**, en anglais, à coller dans le champ Notes d'App Store Connect et dans les réponses à l'équipe d'examen. Elles répondent à ce qu'Apple a demandé au premier envoi (2026-10-29), parce que le compte développeur avait peu d'historique : une vidéo et les points 2 à 6 ci-dessous.

La vidéo (point 1) se filme sur un vrai iPhone à jour, l'app installée par TestFlight. Elle part du lancement de l'app et montre l'inscription, la connexion, l'ouverture d'un sachet, la discussion de clan, le signalement et le blocage d'un joueur, puis la suppression du compte (sur un compte jetable). Apple demande un appareil physique, pas le simulateur.

> **1. Screen recording.** Attached: recorded on an iPhone running the latest iOS, from app launch through sign-up, sign-in, opening a pack, a challenge, clan chat, reporting and blocking a player, and account deletion. The app has no paid content.
>
> **2. Purpose and audience.** Leximon is a free collectible card game about rare and forgotten French words. Each card is a word, with its definition, etymology, pronunciation and a period engraving. Players open free packs that refill during the day, take challenges that help them remember the words (spaced repetition), and trade duplicate cards one for one. It is for French speakers aged 15 and over who enjoy words, literature and quizzes. Nothing is sold: no packs, no currency, no ads.
>
> **3. Access.** Sign-up is by invitation during the launch phase. Please use the demo account: on the home screen tap « Me connecter », enter the e-mail address below, then the 6-digit code below as the password (no e-mail is needed for this account). The account already has packs and cards. To open a pack: Jouer tab, tap the pack or tear its strip. Report and block: open a player's profile from Amis or a clan. Account deletion: Réglages → Supprimer mon compte.
>
> **4. External services.** Cloudflare (hosting of the API and website, delivery of the card catalogue, sending of sign-in codes by e-mail), Lettermint (news e-mails, only for players who opt in). Sign-in uses our own e-mail one-time code, with no third-party login. No payment processor, no advertising, no analytics SDK, no AI service in the app.
>
> **5. Regions.** The app is in French and works the same in every region where it is offered.
>
> **6. Third-party material.** Definitions are written in-house from public-domain dictionaries (mainly Littré, 1863–1872). Quotations come from public-domain authors. Engravings are public domain or CC0, from museum open-access collections (The Met, Rijksmuseum, Paris Musées), and each card credits its source. The app does not operate in a regulated industry.

L'adresse et le code vont dans les champs « Nom d'utilisateur » et « Mot de passe » de la section, pas dans ce fichier.
