# La voix de Leximon

Guide d'écriture de tout texte que le joueur lit : interface web et mobile, landing, e-mails, notifications, textes de partage. Le contenu des cartes suit ses propres règles (skill `carte-mot`).

## Qui parle

**Un bouquiniste gouailleur.** Il connaît tous les vieux mots et ne s'en vante jamais. Il les sort avec malice, au bon moment, comme on montre une trouvaille à un pote. Ancien par le fond, populaire par la forme : la même idée que la direction artistique « Planche populaire » (D-022).

Il tutoie toujours. Il ne fait pas la leçon, ne rassure pas, ne s'excuse pas trois fois. Il dit les choses et passe à la suite.

**Sa signature : les mots du jeu dans l'interface.** De temps en temps, un mot rare du catalogue glisse dans une phrase banale. Le joueur le reconnaît, ou le découvre.

- « Raté. Tu t'es fait refiler un orviétan. »
- « Plus rien dans la besace. Prochain sachet dans 3 h. »

**Dose : une touche par écran au plus.** Le mot doit se comprendre par le contexte et ne jamais gêner l'action. Si on hésite, on écrit la version simple.

## Doser la voix selon le moment

Tous les textes n'ont pas le même ton. La voix monte quand le joueur a de la place pour la lire, elle se tait quand il veut agir.

| Moment | Ton | Exemples |
|---|---|---|
| Fonctionnel : formulaires, réglages, navigation | Neutre et sec. Pas de clin d'œil. | « Recevoir un code », « Me déconnecter » |
| Erreur | Sec. Ce qui s'est passé, puis quoi faire. Un clin d'œil de temps en temps, jamais sur une erreur qui fait perdre quelque chose. | « Mauvais code. », « Le serveur ne répond pas. Réessaie. » |
| Attente, écran vide, chargement | Voix pleine. C'est là qu'elle a de la place. | « On fouille les rayons… » |
| Récompense : première rareté, Dorure, niveau, Légendaire | La fête. L'emphase et le « ! » sont permis ici, et presque seulement ici. | « Ta première carte Légendaire ! », « Niveau 6 ! » |

Les grands moments du jeu méritent plus de mots que les écrans fonctionnels, pas moins.

## Règles d'écriture

- **Court.** Si une phrase peut sauter sans que le joueur soit perdu, elle saute.
- **Une idée par phrase.** Pas de « X : Y » à chaque phrase, pas de points-virgules.
- **On dit, on ne rassure pas.** Pas de promesse défensive (« et ça le restera », « rien n'est perdu »), pas de « pour l'instant » ni « dans un moment ».
- **Pas de détail technique qui ne sert pas l'action** : nombre de chiffres d'un code, licence d'une image en plein écran, nom d'un service.
- **Le « ! » se mérite.** Il est réservé aux récompenses.
- **Les chiffres plutôt que les adjectifs.** « Imprimé une fois sur 29 milliards de mots » vaut mieux que « un mot très rare ».

## Vendre le bénéfice

Hors du jeu (landing, partage, e-mails, fiches des stores), on vend ce que le joueur y gagne, pas la mécanique. Les ressorts :

- **La fierté** : le mot qu'on va placer ce soir.
- **La curiosité** : « Tu sais ce qu'est un charivarieur ? »
- **La collection** : combien tu en as, combien il en manque.
- **L'humour** : les insultes d'antan (collection « Caractères et travers ») sont le meilleur argument.

La mécanique (sachets, défis, échanges) s'explique une fois, brièvement, après l'envie.

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
> Si tu n'as pas demandé ce code, ignore simplement cet e-mail.

**Ouverture** (le premier e-mail de la liste d'attente, P55, écrit dans l'admin). Le bénéfice, puis un seul bouton.

> **Objet :** Leximon ouvre ses sachets
>
> C'est ouvert. Des mots que plus personne ne dit t'attendent. Gratuits, tous les jours.
>
> **[Ouvrir mon premier sachet]**
>
> *Leximon · leximon.fr — Ne plus recevoir ces e-mails*

**Désinscription** : la page ne retient personne. « Plus d'e-mails ? Confirme ci-dessous pour ne plus recevoir ces e-mails. » Bouton « Me désinscrire », puis « C'est fait ».

## Lexique

Un objet a un seul nom dans l'interface.

| On dit | On ne dit pas | Note |
|---|---|---|
| sachet | booster, paquet, pack | Le mot suit la forme du paquet (`PACK_NOUNS`, P47). « Booster » reste le mot des docs et du code. |
| sachet bonus | booster bonus, récompense | Il attend **en réserve**. |
| carte | | L'objet : on l'ouvre, on l'échange, on la range. |
| mot | | Ce que la carte porte : on le découvre, on le révise, on l'oublie. |
| doubles | doublons, exemplaires | Ce qui s'échange. « Doublon » reste le mot des docs. |
| album | collection (pour les cartes du joueur) | Une **collection** est un ensemble publié de cartes (« Caractères et travers »). |
| défi | quiz, exercice | Un défi pose des **questions**. |
| offre | proposition, demande | Ce qu'on envoie. Une offre acceptée devient un **échange**. |
| code joueur | identifiant, pseudo | |
| Encre, Dorure | niveau 1, niveau 2 | Toujours avec la majuscule : « passe à l'Encre ». |
| Courant, Peu courant, Rare, Précieux, Épique, Légendaire | | Avec la majuscule. « Un Précieux », « une Légendaire ». |
| niveau, XP | | Le niveau du joueur, à ne pas confondre avec l'Encre et la Dorure. |

## Boutons

- **Un verbe et un objet** : « Valider le code », pas « Continuer ».
- **Le résultat, pas l'étape** : « Vérifier l'offre », pas « Voir le récapitulatif ».
- **Pour une action grave, la conséquence dans le bouton** : « Perdre cette partie et me connecter ». Le paragraphe d'avertissement au-dessus devient souvent inutile.
- **Pendant l'attente**, le verbe à l'infinitif nominal : « Envoi… », « Vérification… ».

## Deux tests avant de valider un texte

1. **Le test du pote** : est-ce qu'on dirait cette phrase à voix haute à un ami ? Sinon, on la réécrit.
2. **Le test de la coupe** : on enlève la phrase. Si personne n'est perdu, elle reste enlevée.

## Avant, après

| Avant | Après |
|---|---|
| « C'est noté ! Tu recevras un seul e-mail : celui qui t'annonce l'ouverture. » | « Noté. On se revoit à l'ouverture. » |
| « Sachets gratuits, et ça le restera » | « Gratuits, tous les jours. » |
| « Pas de mot de passe : on t'envoie un code à 6 chiffres. On ne garde que ton adresse. » | *(supprimé)* |
| « J'ai trouvé une carte Légendaire sur Leximon : « talpinette » ! » | « Talpinette. Introuvable dans les livres d'aujourd'hui. Moi, je l'ai. » |
| « Rien à réviser. Prochain mot dans 3 h. » | « Tes mots tiennent bon. Le prochain revient dans 3 h. » |
| « Défi du jour réussi : un sachet bonus ! » | « Un sachet bonus pour le défi du jour ! » |
| « Impossible de joindre le serveur. » | « Le serveur ne répond pas. » |
| « Continuer » (écran du code) | « Valider le code » |
| « Voir le récapitulatif » (offre d'échange) | « Vérifier l'offre » |
| « Me connecter quand même » | « Perdre cette partie et me connecter » |
