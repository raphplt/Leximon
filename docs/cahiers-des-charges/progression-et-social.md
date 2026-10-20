# Cahier des charges · Progression et social

- **Statut :** arbitré par le propriétaire le 2026-10-20 ; restent les décisions en fin de document.
- **Couvre :** niveau de compte, profil public, clans, classements, modes de jeu entre joueurs.
- **Décisions liées :** D-006 (comptes), D-007 (temps réel), D-018 (limites de débit), D-025 (défis), D-027 (plis bonus).
- **Règles tranchées :** dans [regles-du-jeu.md](../regles-du-jeu.md) (N5, P8, P48 à P52), qui fait foi. Ce document détaille comment les mettre en œuvre.

## Public visé

**Décision du propriétaire (2026-10-20) : un jeu grand public, en B2C classique.** Les mineurs ne sont pas le public de référence, et une version pour les écoles n'est pas prévue (peut-être jamais).

Conséquences :
- un social complet est possible : discussion de clan, noms libres, profils publics ;
- **en échange, la modération devient une fonctionnalité à part entière** (voir Clans), exigée par la loi (DSA) et par les stores ;
- **inscription à partir de 15 ans** (P8) : en France, c'est l'âge à partir duquel un joueur consent seul au traitement de ses données ;
- **la règle « aucun hasard payant » reste entière.** Un pli gagné par la progression est gratuit. Si un passe de saison payant voit le jour, il ne contient que des cosmétiques, jamais de pli.

## Règles communes

- **Compte inscrit requis** pour tout ce qui est visible des autres : profil public, clan, discussion, classements, parties entre joueurs. Un invité gagne de l'expérience, qui le suit à l'inscription. L'inscription (feuille de route) passe donc avant tout le reste.
- **Le serveur fait foi** : expérience, niveaux, scores et résultats de partie sont calculés côté serveur.
- **Réglages datés, jamais rétroactifs** : barème d'expérience, courbe de niveaux, classement suivent la règle de `packages/core/src/rules.ts`.
- **Rien de temps réel** tant que la R&D D-007 n'a pas conclu.

## 1. Niveau de compte

**Validé par le propriétaire.**

### Principe

Chaque action utile rapporte de l'expérience (XP). L'XP fait monter le niveau. Chaque niveau donne une récompense, à réclamer d'un toucher.

### Ce qui rapporte de l'XP

Valeurs de départ, à calibrer par simulation (en étendant `rnd/collection-sim`).

| Action | XP | Pourquoi |
|---|---|---|
| Ouvrir un pli | 10 | limité de fait par le stock (au plus 48 par jour) |
| Mot nouveau dans la collection | 5 (Courant) à 50 (Légendaire) | récompense la collection, pas les doublons |
| Bonne réponse à un défi | 15 | l'apprentissage doit peser autant que l'ouverture |
| Mot qui atteint l'Encre ou la Dorure (P33) | 25 | idem |
| Premier pli de la journée | 20 | habitude quotidienne |
| Échange conclu | 20 | fait vivre les échanges |
| Rareté complétée dans une collection | 100 à 500 | grands objectifs |

Les plafonds des défis (P29) limitent aussi l'XP qu'un tricheur peut en tirer.

### Courbe

- **XP pour passer du niveau n au suivant :** 100 + 20 × (n − 1). Il faut 1 620 XP pour le niveau 10, 11 020 pour le niveau 30.
- **Joueur régulier** (8 plis et quelques défis par jour, environ 300 XP) : niveau 10 en 5 à 6 jours, niveau 30 en un peu plus d'un mois.
- **Pas de plafond.** Au-delà d'un certain niveau (50 par exemple), les récompenses deviennent cosmétiques et les paliers s'espacent.
- **La courbe ne s'allonge que par la fin.** On ne modifie jamais le coût d'un niveau déjà atteignable, sinon un joueur pourrait perdre un niveau.

### Récompenses

| Palier | Récompense |
|---|---|
| Chaque niveau | 1 pli bonus, ou un petit cosmétique |
| Tous les 5 niveaux | un avatar gravé, un dos de carte, un titre (« Lexicographe en herbe »), un emplacement de carte épinglée en plus |
| Niveau 5 | ouverture des échanges et des clans (freine les comptes multiples créés pour farmer) |
| Tous les 10 niveaux | une récompense marquante : cadre de profil animé, emblème de clan rare |

- **Plis bonus :** ils vont dans la réserve de plis bonus qui existe déjà (P23, plafonnée à 10, ouverte une fois le stock vide). Ils accélèrent la collection : la simulation doit en tenir compte.
- **Réclamer :** une récompense ne se donne pas toute seule. Le joueur la réclame, ce qui fait un moment à l'écran et garde l'écriture idempotente.

### Mise en œuvre

- **Données :** une table `user_progress` (une ligne par joueur : XP totale) et une table `user_level_rewards` (une ligne par récompense réclamée, clé joueur + niveau). Le niveau se calcule à partir de l'XP, par une fonction pure de `packages/core`.
- **Écriture de l'XP :** dans la même transaction que l'action, pour que la barre bouge tout de suite à l'écran.
  - Pour l'ouverture d'un pli, le nombre de requêtes est verrouillé par un test (D-016). L'ajout d'XP se glisse dans une requête existante (CTE) plutôt que d'ajouter un aller-retour.
- **Réclamation :** `POST /me/level-rewards/{niveau}`. Le serveur vérifie le niveau atteint, et l'insertion ne fait rien si la récompense est déjà réclamée.
- **Réponses :** l'ouverture renvoie l'XP gagnée et le nouveau total, pour l'animation du récapitulatif.

## 2. Profil public

### Contenu

- pseudo, avatar, titre choisi, niveau ;
- clan (nom et emblème, lien vers sa page) ;
- **cartes épinglées :** 3 au départ, jusqu'à 6 avec les niveaux. Le joueur les choisit parmi celles qu'il possède ;
- statistiques : mots possédés sur le total du catalogue, collections complétées, Légendaires, mots maîtrisés, membre depuis.

### Visibilité

Deux réglages : **public** (par défaut, vu de tous par un lien, apparaît dans les classements) ou **privé** (le joueur seul ; dans les classements et le clan, il n'apparaît que par son pseudo et son avatar, sans lien vers son profil).

### Pseudo et avatar

- **Pseudo :** unique, 3 à 20 caractères, filtré par une liste d'exclusion (celle des injures de la chaîne, `exclusions.py`, plus une liste générale), signalable. Modifiable une fois par mois.
- **Avatar : portraits tirés de gravures du domaine public** (validé par le propriétaire). Une partie est disponible d'emblée, les autres se gagnent par les niveaux. Pas de photo envoyée : rien à modérer, et c'est dans la direction artistique.

### Mise en œuvre

- **Page web :** `/joueur/{pseudo}`, rendue par le serveur, partageable, avec une image de partage générée par la file (D-002).
- **API :** `GET /players/{pseudo}` (applique la visibilité, limite de débit), `PATCH /me/profile`, `PUT /me/pinned-cards`.
- **Cartes épinglées :** le serveur vérifie la possession. Si un échange fait tomber une carte épinglée à zéro exemplaire, elle est désépinglée dans la même transaction.
- **Statistiques :** calculées à la lecture (un comptage sur `user_cards` par joueur, indexé) et mises en cache une minute. Le profil n'est pas un chemin critique.

## 3. Clans

### Règles de base

- **Pas de nombre maximum de membres** (décision du propriétaire).
- **Un seul clan par joueur.** Après l'avoir quitté, il faut attendre 24 h avant d'en rejoindre un autre : on ne change pas de clan pour toucher deux fois une récompense.
- **Rôles :** chef (un seul), adjoints, membres. Le chef et les adjoints acceptent les demandes, excluent un membre et modèrent la discussion. Si le chef est absent 14 jours, le rôle passe à l'adjoint le plus ancien.
- **Entrée :** ouverte, sur demande, ou sur invitation (code à partager).
- **Accès :** compte inscrit, niveau 5.
- **Nom :** choisi librement par le chef (décision du propriétaire), unique, 3 à 30 caractères, filtré par la liste d'exclusion et signalable. Emblème : une gravure et deux couleurs, dans une liste. Description courte libre, soumise aux mêmes règles que la discussion.

### Ce qu'on fait dans un clan

1. **La discussion** (voir plus bas).
2. **La bibliothèque du clan** (validée) : la part de chaque collection que possède au moins un membre. « À nous tous, il nous manque 12 Fondateurs. »
3. **L'objectif de la semaine (coopératif) :** par exemple « Découvrir 300 mots nouveaux ensemble », proportionnel au nombre de membres actifs. Trois paliers (bronze, argent, or). Chaque membre qui a contribué au minimum reçoit les récompenses du palier atteint.
4. **Le journal du clan :** des événements écrits par le serveur (« Raph a trouvé une Légendaire : ribonborder ! », « Objectif d'argent atteint »), mêlés à la discussion.
5. **Plus tard, les dons :** un membre demande une carte Courant ou Peu courant, un autre lui donne un doublon (comme dans Clash Royale). Il faut d'abord les règles d'échange. À limiter aux raretés basses, aux doublons et à quelques dons par jour, pour éviter qu'on fasse passer des cartes rares d'un compte à l'autre.

**Sans plafond de membres :** dans un très grand clan, la bibliothèque est vite complète et la discussion défile trop vite pour être lue. À surveiller pendant la bêta. Si besoin, un plafond technique pourra être ajouté par un réglage daté.

### La discussion

Une discussion texte par clan, modérée.

**Modération, en quatre couches :**
1. **À l'envoi :** filtre automatique par liste d'exclusion. Un message refusé ne part pas, et l'auteur sait pourquoi. Limite de débit (un message toutes les 2 s, 500 caractères au plus).
2. **Par les joueurs :** signaler un message, bloquer un joueur (on ne voit plus ses messages, nulle part).
3. **Par le clan :** le chef et les adjoints suppriment un message et rendent muet un membre pour une durée choisie.
4. **Par nous :** les signalements arrivent dans un outil d'administration. Une sanction (masquer, rendre muet, bannir) est motivée et notifiée au joueur, qui peut la contester.
   - En option, un modèle classe chaque message après coup (via la file) et masque les plus graves avant tout signalement. Coût à chiffrer selon le volume.

**Ce que la loi et les stores demandent :**
- **DSA (règlement européen) :** un moyen de signaler un contenu illicite, une décision motivée, une voie de contestation, et un point de contact.
- **App Store (règle 1.2) et Google Play :** pour tout contenu écrit par les joueurs, un filtre, un signalement, un blocage, et des coordonnées de contact publiées.

Les quatre couches ci-dessus y répondent. Il faut aussi des conditions d'utilisation et une charte de la discussion, à rédiger avant la bêta.

**Mise en œuvre :**
- Les messages vivent dans Postgres (`clan_messages`, index sur le clan et la date) et sont purgés après une durée à fixer (90 jours par exemple).
- **Temps réel à évaluer** (demande du propriétaire, ajouté à la R&D D-007). La discussion n'est pas dans le chemin critique, donc la règle d'architecture ne l'exclut pas.
  - **Piste :** un Durable Object Cloudflare par clan, qui garde les connexions WebSocket ouvertes et les met en sommeil quand personne n'écrit (hibernation). On reste chez le même hébergeur (D-005).
  - **À mesurer :** coût par joueur connecté, tenue d'un pic de connexions, comportement d'un très grand clan.
- **Repli, ou première version si la R&D tarde :** l'écran de discussion interroge l'API toutes les quelques secondes, uniquement quand il est ouvert, en demandant les messages après le dernier reçu (curseur). Une requête vide coûte très peu. Le stockage est le même dans les deux cas.
- Notifications push des mentions, par la file.

### Mise en œuvre du reste

- **Tables :** `clans` (avec un champ `kind`, au cas où), `clan_members` (clé : le joueur, ce qui garantit un seul clan), `clan_join_requests`, `clan_messages`, `clan_weekly_progress`, `moderation_reports`, `user_blocks`.
- **Objectif, journal, bibliothèque :** alimentés par la file à partir des actions des joueurs. Quelques secondes de retard ne gênent pas, et rien n'alourdit l'ouverture d'un pli.

## 4. Classements

**Pas en v1** (décision du propriétaire). Ils dépendent des modes de jeu, encore à explorer (partie 5).

### Pistes retenues pour la suite

- **Une cote globale Glicko-2** (validée par le propriétaire), sur les parties entre joueurs.
  - Pour des parties asynchrones et des joueurs à la fréquence irrégulière, Glicko-2 fait mieux que l'Elo classique : il tient compte de l'incertitude sur la cote d'un joueur qui joue peu ou revient après une pause. Il s'affiche comme un seul nombre, comme l'Elo.
  - Calculée côté serveur, une fonction pure de `packages/core`.
- **Le modèle du Scrabble duplicate :** tous les joueurs reçoivent exactement la même partie (mêmes mots, mêmes questions), et on les classe par leur score rapporté au meilleur score possible.
  - Le classement est juste sans mise en relation entre joueurs, et la chance du tirage ne joue pas.
  - Il se prête à une partie quotidienne ou hebdomadaire, et à des événements de streamers (tout le monde joue la même grille en même temps).
  - La Fédération française de Scrabble classe aussi ses joueurs par séries (comme des divisions) : une source d'inspiration pour l'affichage.
- **Les ligues hebdomadaires** à la Duolingo (groupes de 30 joueurs, montées et descentes) restent possibles, sur l'XP de la semaine.
- **Clans :** un classement des clans devra tenir compte de l'absence de plafond de membres : une moyenne des meilleurs contributeurs, pas une somme, sinon le plus gros clan gagne toujours.

### Mise en œuvre, le moment venu

- Scores et cotes mis à jour par la file après chaque partie.
- Classements mondiaux recalculés toutes les 5 minutes par une tâche planifiée et servis en cache par le CDN. Pas besoin de Redis.

## 5. Modes de jeu entre joueurs

La collection reste le cœur du jeu, mais les modes de jeu comptent. **Ce sera une R&D** (skill `spike`) : plusieurs pistes à prototyper et à faire essayer, sans en choisir une d'avance.

### Contraintes

- Pas de temps réel avant la conclusion de la R&D D-007.
- **Aucune mise de cartes :** perdre une carte sur une partie ressemblerait à un jeu d'argent.
- Un mode de jeu doit donner de la valeur à la collection ou à l'apprentissage, idéalement aux deux.

### Pistes à explorer

| Piste | Principe | Premier avis |
|---|---|---|
| **Joute asynchrone** | Chaque joueur choisit 5 cartes de sa collection. L'adversaire doit trouver la définition de chacun de ces mots parmi 4 propositions. Chacun joue son tour dans les 24 h. | Valorise la collection (des mots rares piègent l'adversaire) et l'apprentissage. Faisable sans temps réel. |
| **Duplicate** | Tout le monde joue la même partie, classement au pourcentage du meilleur score (voir Classements). | Juste, simple à classer, idéal pour les événements. |
| **Le Dictionnaire (bluff)** | Chaque joueur invente une fausse définition, les autres doivent trouver la vraie. | Très drôle entre amis. Le texte libre passe par la même modération que la discussion. Les fausses définitions des joueurs peuvent être complétées par celles d'autres mots de la collection. |
| **Combat de cartes à statistiques** | Chaque carte a des valeurs (attaque, défense), comme Pokémon. | Les mots n'ont pas de statistiques naturelles : il faudrait les inventer (époque, longueur, rareté). Long à équilibrer. |
| **Duel en direct** | Les mêmes questions en même temps, le plus rapide gagne. | Idéal pour les streamers, dépend de la R&D D-007. |

### Besoins communs

- **Le moteur de questions des défis** (D-025, P32) : QCM à 4 choix, dont les mauvais choix sont les définitions d'autres mots de la même collection. La joute et le duplicate peuvent le reprendre tel quel, sans rien générer de plus.
- **Sécurité :** le serveur envoie les propositions sans dire laquelle est juste, valide la réponse et mesure le temps. Le client ne connaît jamais la bonne réponse avant d'avoir répondu.
- **Récompenses :** XP, et la cote ou le classement du mode.

## Ordre de réalisation proposé

1. **Inscription** (déjà prévue) : prérequis de tout le social.
2. **Niveau de compte**, avec l'XP du pli dans le récapitulatif d'ouverture.
3. **Profil public**, avec pseudo, avatars gravés et cartes épinglées.
4. **Clans** : discussion modérée, bibliothèque, objectif de la semaine, journal.
5. **R&D des modes de jeu**, puis **classements** (cote Glicko-2, duplicate).

La R&D D-007 peut avancer en parallèle, pour décider du temps réel de la discussion avant les clans.

Pour la bêta de novembre, le réaliste est l'ouverture (lot A de [ouverture.md](ouverture.md)), le niveau de compte et un profil simple. Les clans viennent juste après, une fois la modération prête.

## Décisions

Les règles tranchées le 2026-10-20 sont dans [regles-du-jeu.md](../regles-du-jeu.md) : public et âge (P8), texte des joueurs (N5), niveau de compte (P48), avatar (P49), clans (P50), classements (P51), modes de jeu (P52). Le temps réel de la discussion de clan est évalué dans la R&D D-007.

**À prendre** (aussi listées dans [regles-du-jeu.md](../regles-du-jeu.md#à-décider)) :
1. **Plis bonus en récompense de niveau :** oui (recommandé : gratuits, dans la réserve P23), ou seulement des cosmétiques.
2. **Visibilité par défaut du profil :** public (recommandé pour un jeu grand public), ou privé.
3. **Modération automatique de la discussion par un modèle :** dès la bêta, ou seulement si les signalements ne suffisent plus.
4. **Durée de conservation des messages de clan :** 90 jours (recommandé), ou plus.
5. **Niveau minimum pour les clans :** niveau 5 (recommandé), et le même seuil pour les échanges, en plus de P36.
