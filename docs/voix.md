# La voix de Leximon

Guide d'écriture de tout texte que le joueur lit : interface web et mobile, landing, e-mails, notifications, textes de partage. Le contenu des cartes suit ses propres règles (skill `carte-mot`).

Ce guide a été revu après la revue complète des textes du jeu (octobre 2026). Deux testeurs de la bêta trouvaient la prose « générée par IA » : des sentences creuses, des fragments sans verbe, du jargon qui cachait la règle. La consigne d'avant (« court », « une idée par phrase ») poussait vers ce ton sec. La règle d'aujourd'hui : **d'abord clair, ensuite court, et le caractère seulement là où il a de la place.**

## Qui parle

**Un bouquiniste qui connaît ses vieux mots et parle simplement.** Il s'appelle Maître Furet (décidé le 2026-11-01) : de « fureter », avec un salut à Antoine Furetière. Il tutoie toujours. Il explique une règle comme on l'explique à un ami à côté de soi : en phrases complètes, avec les vrais chiffres. Il ne fait pas la leçon, ne rassure pas, ne s'excuse pas trois fois.

Son nom ne paraît que là où il a de la place : accueil, récompense, retour après une absence, nouveautés. Ce n'est pas une mascotte : pas de conseil permanent, jamais pendant une action. Il ne reproche jamais une absence et ne menace jamais de perdre une série (P88).

Il a de l'humour, mais il ne force pas. Une phrase drôle qui oblige à relire pour comprendre est ratée.

**Les mots rares, avec mesure.** Un mot du catalogue peut glisser dans une phrase, à condition que la phrase se comprenne sans le connaître. Jamais sur un écran fonctionnel, jamais dans une erreur, jamais en liste de mots obscurs (« Sacripants, médicastres et pendardeaux. » a été rejeté).

## Doser la voix selon le moment

La voix monte quand le joueur a de la place pour la lire. Elle se tait quand il veut agir ou comprendre.

| Moment | Ton | Exemples validés |
|---|---|---|
| Fonctionnel : formulaires, réglages, navigation, règles | Simple et précis. Aucun clin d'œil. | « Recevoir un code », « Tu pourras le changer une fois par mois. » |
| Erreur | Ce qui s'est passé, puis quoi faire. Aucun clin d'œil. | « Le serveur ne répond pas. Réessaie. », « Ce pseudo n'est pas autorisé. Choisis-en un autre. » |
| Attente, écran vide | Un peu de voix, si la phrase reste claire. | « On fouille les rayons… », « Silence de cathédrale. Lance la conversation. » |
| Récompense : première rareté, Dorure, niveau | La fête. Le « ! » est permis ici, et presque seulement ici. | « Ta première carte Légendaire ! », « Toutes les cartes Rares réunies ! » |
| Landing, partage | Le bénéfice, avec du caractère. | « La langue a jeté des mots superbes. On les a ramassés. », « Noté. On se revoit à l'ouverture. » |

## Règles d'écriture

- **Des phrases complètes, avec un verbe.** Pas de fragments (« Doré. », « Pas parti. », « Toi-même ? Non. »). Un titre ou un bouton peut être sans verbe, une phrase d'explication jamais.
- **La règle en clair.** Quand un texte explique comment ça marche, il donne la condition et le chiffre : « Écris ce mot de mémoire 7 jours après une révision pour passer à l'Encre. » Pas de jargon interne qui cache la règle (« un mot monte », « des questions à choix », « file en réserve »).
- **Pas de sentence ni de fausse chute.** Pas de maximes (« Plus le mot est rare, plus la carte l'est. »), pas de paradoxes fabriqués (« Trop tard pour attendre : c'est ouvert. »), pas de punchline en deuxième phrase (« Il y reste. », « Pas pour longtemps. », « Ou plus. »).
- **Pas de fausse gouaille.** Les images toutes faites et l'argot plaqué sonnent faux (« Le serveur lambine. », « Ce lien a fait son temps. », « Tes cartes restent au chaud. »). On écrit ce qui se passe.
- **Pas de gabarit d'appli non plus.** Simple ne veut pas dire administratif : « Cette page a planté. » plutôt que « Une erreur est survenue. », « ignore cet e-mail » plutôt que « ignore simplement cet e-mail ».
- **Pas d'enchaînement « X : Y », ni de tiret pour coller deux idées.** On fait deux phrases, ou une phrase avec « et », « pour », « quand ».
- **Accords justes avec les variables.** Chaque texte qui contient un nombre prévoit 0, 1 et plusieurs (« ta carte », « tes 3 cartes », jamais « tes 1 carte »). Une rareté s'accorde avec « carte » : « ta première carte Précieuse ». Le test unitaire du texte couvre ces cas.
- **Pas de phrase de trop.** Une deuxième phrase doit apporter une information. Mais on ne coupe jamais au prix de la clarté : une phrase complète vaut mieux que deux fragments.
- **On dit, on ne rassure pas.** Pas de promesse défensive (« et ça le restera », « rien n'est perdu »). « Pour l'instant » est permis quand il dit vrai (« Personne ne t'a envoyé d'offre pour l'instant. »).
- **Pas de détail technique qui ne sert pas l'action** : nombre de chiffres d'un code, licence d'une image, nom d'un service.
- **Le « ! » se mérite.** Il est réservé aux récompenses.
- **Les chiffres plutôt que les adjectifs.** « Imprimé une fois sur 29 milliards de mots » vaut mieux que « un mot très rare ».

## Vendre le bénéfice

Hors du jeu (landing, partage, e-mails, fiches des stores), on vend ce que le joueur y gagne, pas la mécanique. Les ressorts :

- **La fierté** : le mot qu'on va placer ce soir.
- **La curiosité** : « Tu sais ce qu'est un charivarieur ? »
- **La collection** : combien tu en as, combien il en manque.
- **L'humour** : les insultes d'antan (collection « Caractères et travers ») sont le meilleur argument.

La mécanique (sachets, défis, échanges) s'explique une fois, simplement, après l'envie.

## Les textes qui sortent du jeu

Ils sont lus par des gens qui ne jouent pas encore : ils font venir les joueurs.

- **Partage** : le mot d'abord, la rareté chiffrée ensuite, le jeu en dernier. Jamais de phrase de notification système (« J'ai trouvé une carte X sur Leximon ! »).
- **Notifications de révision** : on parle du mot à réviser, pas du nombre de défis en attente. « *Lucubrateur* est à réviser. »
- **E-mails** : un objet de cinq mots au plus, une seule action par e-mail. Pas d'image, pas de pixel, pas de lien pisté.

### Exemples d'e-mails

**Code de connexion** (rendu dans `apps/api/src/email/sign-in-code.ts`). Le code d'abord, dans l'objet comme dans le texte : on le lit sans ouvrir l'e-mail. Pas de lien de désinscription : c'est un service, pas des nouvelles.

> **Objet :** 482913, ton code Leximon
>
> 482913
>
> Voici ton code de connexion Leximon, valable 10 minutes.
>
> Si tu n'as pas demandé ce code, ignore cet e-mail.

**Ouverture** (le premier e-mail de la liste d'attente, écrit dans l'admin). Le bénéfice, puis un seul bouton.

> **Objet :** Leximon ouvre ses sachets
>
> C'est ouvert. Des mots que plus personne ne dit t'attendent, et tes sachets sont gratuits tous les jours.
>
> **[Ouvrir mon premier sachet]**
>
> *Leximon · leximon.fr · Ne plus recevoir ces e-mails*

**Désinscription** : la page ne retient personne. « Confirme ci-dessous pour ne plus recevoir ces e-mails. » Bouton « Me désinscrire », puis une phrase qui dit ce qui change : « Tu ne recevras plus de rappel pour tes sachets. »

## Lexique

Un objet a un seul nom dans l'interface.

| On dit | On ne dit pas | Note |
|---|---|---|
| sachet | booster, paquet, pack | Le mot suit la forme du paquet (`PACK_NOUNS`). « Booster » reste le mot des docs et du code. |
| sachet bonus | booster bonus, récompense | Il attend **en réserve**. |
| carte | | L'objet : on l'ouvre, on l'échange, on la range. |
| mot | | Ce que la carte porte : on le découvre, on le révise, on l'oublie. |
| doubles | doublons, exemplaires | Ce qui s'échange. « Doublon » reste le mot des docs. |
| album | collection (pour les cartes du joueur) | Une **collection** est un ensemble publié de cartes (« Caractères et travers »). |
| défi | quiz, exercice | Un défi pose des **questions**. |
| offre | proposition, demande | Ce qu'on envoie. Une offre acceptée devient un **échange**. |
| code joueur | identifiant, pseudo | |
| Encre, Dorure | niveau 1, niveau 2 | Toujours avec la majuscule : « passe à l'Encre ». |
| Courant, Peu courant, Rare, Précieux, Épique, Légendaire | | Avec la majuscule, accordé avec « carte » : « une carte Précieuse », « les cartes Légendaires ». |
| niveau, XP | | Le niveau du joueur, à ne pas confondre avec l'Encre et la Dorure. |
| récompenses | coffrets (sur un bouton) | Le bouton qui ouvre les coffrets de niveau dit « Récompenses ». |

## Boutons

- **Un verbe et un objet** : « Valider le code », pas « Continuer ».
- **Le résultat, pas l'étape** : « Vérifier l'offre », pas « Voir le récapitulatif ».
- **Pour une action grave, la conséquence dans le bouton** : « Perdre cette partie et me connecter ». Le paragraphe d'avertissement au-dessus devient souvent inutile.
- **Pendant l'attente**, le nom de l'action : « Envoi… », « Chargement de tes cartes… ».

## Trois tests avant de valider un texte

1. **Le test du pote** : est-ce qu'on dirait cette phrase à voix haute à un ami, sans qu'il demande « c'est-à-dire ? » ? Sinon, on la réécrit.
2. **Le test du nouveau joueur** : quelqu'un qui découvre le jeu comprend-il la règle sans connaître nos mots internes ? Sinon, on dit la règle en clair.
3. **Le test de la coupe** : on enlève la phrase. Si personne n'est perdu, elle reste enlevée.

## Avant, après

| Avant | Après |
|---|---|
| « C'est noté ! Tu recevras un seul e-mail : celui qui t'annonce l'ouverture. » | « Noté. On se revoit à l'ouverture. » |
| « Doré. Il ne bouge plus. » | « Ce mot a atteint la Dorure, le dernier palier. » |
| « Juste à la prochaine révision, et c'est l'Encre. » | « Écris-le de mémoire à la prochaine révision pour passer à l'Encre. » |
| « Trois bonnes réponses sur cinq, et un sachet bonus file en réserve. » | « Trouve trois bonnes réponses sur cinq pour gagner un sachet bonus. » |
| « Rien de ce côté. Pas pour longtemps. » | « Aucune carte ne correspond à ce filtre. » |
| « Ton premier Précieux ! » | « Ta première carte Précieuse ! » |
| « Tes 1 carte, tes sachets et ta progression passent sur ton compte. » | « Ta carte, tes sachets et ta progression passent sur ton compte. » |
| « Pas de compte, pas de profil. Crée-le, ta partie suit. » | « Crée un compte pour avoir un profil public et garder ta partie. » |
| « Toi-même ? Non. » | « Tu ne peux pas te bloquer toi-même. » |
| « Le serveur lambine. » | « Le serveur ne répond pas. » |
| « Une erreur est survenue. » | « Cette page a planté. » |
| « Rien à réviser. Prochain mot dans 3 h. » | « Tes mots tiennent bon. Le prochain revient dans 3 h. » |
| « Continuer » (écran du code) | « Valider le code » |
| « Me connecter quand même » | « Perdre cette partie et me connecter » |
