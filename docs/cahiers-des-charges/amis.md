# Cahier des charges · Amis

- **Statut :** concept validé par le propriétaire le 2026-10-24 (amitié acceptée, lien d'ami avec places de bêta et récompense, podium de la semaine, réactions prédéfinies). Les réglages chiffrés sont provisoires.
- **Règles concernées :** P75 à P79, et P51, P59, P63, P64 retouchées, dans [regles-du-jeu.md](../regles-du-jeu.md), qui fait foi.
- **D'où ça vient :** en dehors du clan, rien ne relie deux joueurs. Pour échanger, il faut taper un code à 8 caractères. Et rien n'aide un joueur à faire venir les siens.
- **Objectif :** le clan est la communauté ; les amis sont le cercle proche. Ils doivent faire trois choses : faire venir de nouveaux joueurs, donner une raison d'échanger, et donner une raison de revenir (voir ce que les autres trouvent, se mesurer à eux).

## Ce qui existe

- **Échanges** (P34 à P36) : une offre se fait au code public du joueur (8 caractères), dès le niveau 5.
- **Profil public** (P60, P62) : pseudo, avatar, clan, cartes épinglées, statistiques, ouvert au niveau 8. Un profil privé ne montre que le pseudo et l'avatar.
- **Bloquer** (P63) : chacun disparaît pour l'autre, plus d'offre entre eux.
- **Bêta fermée** (D-041) : un lien d'invitation par groupe, créé dans l'admin, avec un nombre de places.
- **Courrier** (D-039) : les lettres écrites par la file d'événements de jeu.
- **Objectif du clan** (P66) : les bonnes réponses en défi de la semaine, du lundi 0 h au dimanche soir, heure de Paris.

## 1. L'amitié

- **Une demande que l'autre accepte.** Le lien vaut dans les deux sens. Deux demandes croisées valent acceptation.
- **Comptes inscrits seulement, dès le niveau 1.** Un invité n'a pas de pseudo et peut disparaître. Pour envoyer ou accepter une demande, il faut un pseudo : l'écran Amis le demande s'il manque.
- **Où l'on envoie une demande :**
  - depuis le profil public d'un joueur (« Ajouter en ami ») ;
  - par son pseudo exact, dans l'écran Amis (pas d'annuaire, pas de recherche approchée) ;
  - depuis un membre de son clan ;
  - après un échange conclu, depuis la lettre du courrier ;
  - par le lien d'ami (§ 2), sans demande à accepter.
- **Répondre :** accepter ou refuser. Un refus ne prévient personne : chez l'expéditeur, la demande disparaît sans un mot. Une demande sans réponse expire au bout de 30 jours.
- **Retirer un ami :** sans prévenir l'autre, des deux côtés à la fois.
- **Bloquer** (P63) rompt l'amitié et efface les demandes entre les deux joueurs.
- **Qui peut m'envoyer une demande :** réglage « Tout le monde » (par défaut) ou « Personne ». Avec « Personne », seul le lien d'ami fait des amis.
- **Garde-fous provisoires :**
  - 200 amis au plus ;
  - 20 demandes envoyées par 24 h glissantes ;
  - 50 demandes envoyées en attente au plus ;
  - une demande refusée ne peut pas être renvoyée au même joueur avant 7 jours.
- **Entre amis, le profil est toujours entier** : même privé, même avant le niveau 8.

## 2. Le lien d'ami

- **Chaque joueur inscrit a son lien** : `leximon.fr/ami/<code>`, avec le code public déjà utilisé pour les échanges. On le copie ou on le partage depuis l'écran Amis.
- **Celui qui arrive par ce lien** voit qui l'invite (avatar et pseudo), puis ouvre son premier sachet comme sur un lien d'invitation. Le parrain est gardé avec le joueur, comme le `?src=` (D-041).
- **L'amitié se fait à la création du compte**, sans demande à accepter, puisque le filleul est venu par le lien. Avant cela, il est invité et ne peut pas avoir d'ami.
- **Pendant la bêta fermée**, le lien ouvre la porte : **3 places par joueur inscrit**. Une place se prend à la création de l'invité, comme pour un lien d'invitation. Un lien sans place restante mène à la page « Sur invitation ». Les liens de l'admin ne changent pas.
- **La récompense :** quand le filleul atteint le niveau 5, chacun reçoit **un sachet bonus** (réserve P23). Le niveau 5 prouve qu'il joue vraiment : environ deux jours de jeu régulier.
  - **5 filleuls récompensés par mois au plus** (heure de Paris) pour un même parrain. Au-delà, l'amitié se fait toujours, sans sachet.
  - **Un seul parrain par joueur** : le premier lien d'ami suivi. Un joueur venu par un lien d'invitation de l'admin n'a pas de parrain.
  - Pas de récompense pour un compte qui existait déjà : seul un joueur arrivé par le lien compte.
- **Mesure :** dans `/admin/mesure`, les joueurs venus par un lien d'ami forment une source « Lien d'ami », avec le nombre de filleuls par parrain.

## 3. La liste d'amis

Un écran « Amis » (`/amis`), ouvert à tous les comptes inscrits.

- **En haut :** les demandes reçues (accepter, refuser), puis mon lien d'ami avec le nombre de places de bêta restantes.
- **Le podium de la semaine** (§ 6).
- **La liste**, triée par dernière venue :
  - avatar, pseudo, niveau, emblème du clan ;
  - « En ligne » ou « Vu il y a 2 jours » (`lastSeenAt`) ;
  - le nombre d'échanges possibles (§ 4), s'il y en a.
- **Toucher un ami** ouvre sa fiche : son profil entier, puis « Proposer un échange », « Comparer nos albums », « Retirer de mes amis ».
- **Les demandes envoyées en attente**, repliées en bas, avec « Annuler ».
- **Écran vide :** le lien d'ami en grand, pour le partager.

## 4. Les échanges suggérés

- **Pour chaque ami, deux listes :**
  - mes cartes échangeables (doublons, P35) qu'il n'a pas du tout ;
  - ses cartes échangeables que je n'ai pas du tout.
- **Le nombre d'échanges possibles** est le plus petit des deux. Il s'affiche dans la liste d'amis.
- **« Proposer un échange »** depuis la fiche d'un ami ouvre l'écran des échanges, ami déjà choisi, sans code à taper. Les deux listes y sont mises en avant. Les règles de l'offre ne changent pas (P34 à P36 : niveau 5, nombre de cartes, délais des Épiques et Légendaires).
- Personne d'autre qu'un ami ne voit ces listes : elles révèlent la collection.

## 5. Comparer deux albums

- Depuis la fiche d'un ami, « Comparer nos albums » ouvre son album à côté du mien, collection par collection.
- **Trois filtres :** « Il l'a, pas moi », « Je l'ai, pas lui », « On l'a tous les deux ».
- Une carte que je n'ai pas reste face cachée, comme dans mon album : comparer ne révèle pas ses mots.
- Le niveau de maîtrise d'un ami ne se montre pas.

## 6. Le podium de la semaine

- **Entre amis seulement :** moi et mes amis, classés sur les **bonnes réponses en défi de la semaine**, du lundi 0 h au dimanche soir, heure de Paris, comme l'objectif du clan (P66).
- **Sans récompense.** Pas d'XP, pas de sachet : on se mesure, c'est tout.
- **Ce qu'on voit :** les trois premiers sur la marche, puis ma place (« 4e sur 12 »), et la liste entière en la dépliant.
- **Le lundi,** le premier de la semaine passée garde une couronne à côté de son pseudo dans la liste d'amis, pendant une semaine.
- C'est une entorse locale à P51 (pas de classement en v1) : P51 vise les classements publics, qui restent pour plus tard.

## 7. Le fil des amis

- **Ce qui y entre**, pour chaque ami :
  - une Épique ou une Légendaire trouvée ;
  - un mot passé à la Dorure ;
  - un niveau de compte multiple de 5 ;
  - une collection complétée.
- **Ce qui n'y entre pas :** les sachets ordinaires, les défis, les échanges.
- **Réactions prédéfinies, une par joueur et par événement**, qu'on peut changer ou retirer : « Chapeau », « Jaloux », « Veinard », « Bien joué ». Aucun texte libre.
- **Le courrier** prévient l'auteur à la première réaction sur un événement. La lettre se lit avec les réactions du moment (« Lucie et 2 autres ont réagi à ta Légendaire »).
- **Réglage :** « Montrer mes trouvailles à mes amis », activé par défaut. Éteint, rien de moi n'entre dans le fil.
- Un événement est gardé 30 jours.
- **Où le lire :** sous la liste d'amis, et un point sur l'onglet quand il y a du neuf.

## 8. Le courrier

Nouvelles lettres :

- une demande d'ami reçue (avec « Accepter » et « Refuser ») ;
- une demande acceptée ;
- un filleul arrivé, puis un filleul au niveau 5 avec son sachet bonus (chez les deux joueurs) ;
- une première réaction sur un de mes événements.

Et sur la lettre d'un échange conclu, « Ajouter en ami » si l'autre ne l'est pas déjà.

## 9. Ce qui ne se fait pas

- **Aucun cadeau de carte.** Il contournerait l'échange carte contre carte et permettrait de vider un second compte dans le premier.
- **Aucun message privé.** Pas de texte libre entre deux joueurs sans modération par modèle.
- **Aucun annuaire de joueurs**, aucune suggestion d'amis : on ajoute quelqu'un qu'on connaît.

## 10. Suppression du compte et sanctions

- **Supprimer son compte** (P64) efface ses amitiés, ses demandes, ses événements et ses réactions. Chez ses filleuls, le parrain devient « Un joueur parti ».
- **Un compte suspendu ou fermé** (P68) disparaît des listes d'amis et du fil le temps de la sanction.

## 11. Réalisation

### Données

Migrations additives, une par lot.

- **`friendships`** : une ligne par sens (`user_id`, `friend_id`, `created_at`), écrites ensemble dans la même transaction. La liste d'un joueur et son plafond se lisent sans `OR`.
- **`friend_requests`** : (`sender_id`, `recipient_id`) en clé, `created_at`, `declined_at`. Une demande est en attente sans refus et pendant 30 jours ; un refus est gardé 7 jours pour la règle de la nouvelle demande, puis effacé par la maintenance.
- **`user_preferences`** : deux colonnes de plus, `friend_requests_open` et `share_finds`, vraies par défaut.
- **`referrals`** : le filleul en clé, son parrain (`set null` si le parrain supprime son compte), la date d'arrivée, la date du niveau 5, si le sachet est dû (plafond du mois), et les deux dates de réclamation.
- **`players.friend_places_used`** : les places de bêta prises par le lien d'ami, par une seule mise à jour conditionnelle (comme `invites.uses`).
- **`friend_feed_events`** : l'auteur, le genre, la charge (carte, niveau, collection), une clé de dédoublonnage, la date ; effacés après 30 jours. Pas de copie par lecteur : le fil se lit en joignant les amis à l'index (`user_id`, `id desc`).
- **`friend_reactions`** : (`event_id`, `user_id`) en clé, la réaction.
- **Courrier :** nouveaux genres `friend_request`, `friend_accepted`, `referral_arrived`, `referral_qualified`, `friend_reaction`.

Chaque table liée à `users.id` part en cascade avec le compte, et entre dans `USER_REFERENCES` du transfert d'un invité.

### Serveur

- **Règles** dans `packages/core/src/friend/` : `FRIEND_SCHEDULE` daté (plafonds, délais, places, niveau du parrainage, plafond du mois), et les fonctions pures (refus d'une demande, nombre d'échanges possibles, classement du podium, événements du fil). Testées.
- **Routes** (compte inscrit avec pseudo, limite de débit du joueur, clés d'idempotence par la clé naturelle des lignes) :
  - `GET /me/friends` : amis, demandes, lien et places ;
  - `POST /me/friend-requests` (pseudo ou code), `POST /me/friend-requests/:code/accept|decline`, `DELETE /me/friend-requests/:code` ;
  - `DELETE /me/friends/:code` ;
  - `GET /me/friends/:code` : profil entier et échanges suggérés ; `GET /me/friends/:code/cards` : ses cartes, pour comparer ;
  - `GET /me/friends/podium`, `GET /me/friends/feed`, `PUT|DELETE /me/friend-reactions/:id` ;
  - `GET /referrers/:code` (public) : qui invite, et s'il reste une place ;
  - `POST /me/referrals/:code/claim` : le sachet du parrainage.
- **Verrous :** accepter une demande verrouille les deux lignes `players` dans l'ordre des identifiants, pour que deux acceptations croisées ou un plafond atteint à deux ne cèdent pas. Le sachet se réclame comme un coffret (portefeuille verrouillé d'abord, refus si la réserve est pleine).
- **File d'événements :** un événement `level_up` part quand un pli, un défi ou un échange fait passer un niveau. Le consommateur en tire le niveau 5 du filleul et les niveaux multiples de 5 du fil. Les trouvailles (`cards_obtained`) et la Dorure (`answer_given`) alimentent le fil ; il relit tout dans la base, rejouer un message ne change rien.
- **Podium :** calculé à la lecture depuis `review_logs` sur moi et mes amis (201 joueurs au plus, index `user_id, reviewed_at`), cette semaine et la précédente pour la couronne. Pas de table.
- **Échanges suggérés :** une requête par lecture, sur la page d'amis affichée, avec la même règle d'attente des Épiques et Légendaires que les offres.

### Web

- Écran `/amis`, ouvert depuis le menu du joueur et depuis l'écran Jouer ; fiche d'un ami ; page publique `/ami/[code]` pour le lien d'ami.
- `ami` dans `/echanges?avec=<code>` : l'ami choisi, les suggestions en avant.
- Comparer : l'album avec `?ami=<code>` et ses trois filtres.
- Logique et textes dans `packages/view-model/src/friends.ts`, testés.

### Lots

1. **L'amitié :** tables, règles, routes, blocage et suppression du compte, courrier, écran Amis (demandes, liste, ajout par pseudo et depuis un profil, retrait, réglage).
2. **Le lien d'ami :** page `/ami/[code]`, places de bêta, amitié à la création du compte, événement `level_up`, sachet du parrainage, source « Lien d'ami » dans la mesure.
3. **Échanger et comparer :** échanges suggérés, échange depuis la fiche, album comparé.
4. **Le podium.**
5. **Le fil et les réactions.**

Chaque lot : `pnpm check`, `pnpm test:integration` (avec des requêtes concurrentes pour chaque écriture), vérification dans le navigateur, un commit.
