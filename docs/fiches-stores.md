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

Tant que la bêta est fermée, ajouter en tête : « Leximon est en bêta. On y entre par un lien d'invitation. »

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
- Partage avec des tiers : aucun. Neon, Cloudflare et Lettermint sont des sous-traitants, et Google ne compte pas leur usage comme un partage.

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
- image de présentation 1024 × 500 : `presentation-1024x500.png` ;
- 7 captures de téléphone en 1080 × 1920, à envoyer dans l'ordre : `android/01-sachet.jpg` à `android/07-fiche-precieux.jpg`. Elles ont été prises sur l'émulateur le 2026-10-27, barre d'état figée à 9:41.

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

**Classification par âge :**

- Grossièretés ou humour grossier : rare ou léger (les insultes d'antan).
- Thèmes adultes, violence : rare ou léger, en texte seulement.
- Contenu généré par les utilisateurs, messagerie : **oui**. Elle est filtrée et modérée, avec signalement, blocage et suppression du compte dans l'app.
- Jeux d'argent, contenu simulé de jeux d'argent : non.
- Accès web sans restriction : non.

On s'attend à 13+. L'inscription demande 15 ans, ce qui ne contredit pas la note.

**Confidentialité de l'app (étiquettes) :** aucun suivi entre apps. Toutes les données sont liées à l'utilisateur.

| Catégorie Apple | Finalités |
|---|---|
| Coordonnées › Adresse e-mail | Fonctionnalités de l'app, marketing du développeur (nouvelles, seulement si cochées) |
| Identifiants › Identifiant utilisateur | Fonctionnalités de l'app |
| Contenu utilisateur › Autre contenu utilisateur (discussion de clan, signalements) | Fonctionnalités de l'app |
| Contenu utilisateur › Service client (« Un retour ? ») | Fonctionnalités de l'app |
| Données d'utilisation › Interaction avec le produit | Analyse, fonctionnalités de l'app |
| Autres données (tranche d'âge) | Analyse |

**Captures :** iPhone 6,9 pouces (1320 × 2868), de 3 à 10, les mêmes scènes que sur Play. L'iPad n'est pas visé : à décocher si EAS le propose.

## Compte de démonstration

Les deux stores exigent un accès complet pour l'examen. L'examinateur ne lit pas notre boîte, donc une seule adresse se connecte avec un code fixe, et aucun e-mail ne part vers elle. Le code expire et ne tolère que 3 erreurs, comme les autres. Sans les deux secrets, ce compte n'existe pas.

Mise en place, une fois :

1. Choisir l'adresse (par exemple `examen@leximon.fr`, qui n'a pas besoin de boîte) et un code de 6 chiffres tiré au hasard : `shuf -i 100000-999999 -n 1`.
2. Les poser en secrets de production (voir [mise-en-ligne.md](mise-en-ligne.md), étape 6), puis `pnpm deploy:prod`.
3. Créer le compte par un lien d'invitation, avec cette adresse et ce code, comme un joueur.
4. Le garnir : ouvrir quelques sachets, faire un défi, pour que l'examinateur voie l'album rempli.

Changer le code après chaque examen n'est pas nécessaire. Le retirer (`wrangler secret delete`) ferme le compte d'un coup.

**Notes pour l'examen** (une fois le compte prêt) :

> Leximon se joue avec un compte. Sur l'écran d'accueil, « Me connecter », puis l'adresse et le code ci-dessous. Le compte est déjà entré dans la bêta, il a des sachets et des cartes. Ouvrir un sachet : onglet Jouer, toucher le sachet ou déchirer sa bande le long du pointillé.
