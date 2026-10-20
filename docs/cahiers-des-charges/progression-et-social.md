# Cahier des charges · Progression et social

- **Statut :** proposition, à valider par le propriétaire (2026-10-20).
- **Couvre :** niveau de compte, profil public, clans, classements, duels entre joueurs.
- **Décisions liées :** D-006 (comptes), D-007 (temps réel), D-018 (limites de débit). Règles produit d'AGENTS.md.

## Règles communes

Elles s'appliquent à tout ce qui suit.

- **Public scolaire, donc des mineurs.**
  - Rien de ce qu'un joueur écrit librement n'est vu par un autre, sauf le pseudo, filtré et signalable. C'est la règle « sans messagerie libre » étendue au social.
  - Profil privé par défaut, comme le recommande la CNIL pour les mineurs.
  - Pas de photo envoyée par le joueur (voir Profil public).
- **Compte inscrit requis** pour tout ce qui est visible des autres : profil public, clan, classements, duels. Un invité gagne de l'expérience, qui le suit à l'inscription. Il faut donc l'inscription (feuille de route) avant tout le reste.
- **Aucun hasard payant.** Un pli gagné par la progression est gratuit. Si un passe de saison payant voit le jour, il ne contient que des cosmétiques, jamais de pli.
- **Le serveur fait foi** : expérience, niveaux, scores et résultats de duel sont calculés côté serveur.
- **Réglages datés, jamais rétroactifs** : barème d'expérience, courbe de niveaux, taille des clans suivent la règle de `packages/core/src/rules.ts`.
- **Rien de temps réel** tant que la R&D D-007 n'a pas conclu : tout est asynchrone.

## 1. Niveau de compte

### Principe

Chaque action utile rapporte de l'expérience (XP). L'XP fait monter le niveau. Chaque niveau donne une récompense, à réclamer d'un toucher.

### Ce qui rapporte de l'XP

Valeurs de départ, à calibrer par simulation (en étendant `rnd/collection-sim`).

| Action | XP | Pourquoi |
|---|---|---|
| Ouvrir un pli | 10 | limité de fait par le stock (au plus 48 par jour) |
| Mot nouveau dans la collection | 5 (Courant) à 50 (Légendaire) | récompense la collection, pas les doublons |
| Défi réussi | 15 | l'apprentissage doit peser autant que l'ouverture |
| Mot maîtrisé (niveau de maîtrise franchi) | 25 | idem |
| Premier pli de la journée | 20 | habitude quotidienne |
| Échange conclu | 20 | fait vivre les échanges |
| Rareté complétée dans une collection | 100 à 500 | grands objectifs |

Les défis et la maîtrise ne sont pas encore construits : leur barème suivra leurs règles.

### Courbe

- **XP pour passer du niveau n au suivant :** 100 + 20 × (n − 1). Il faut 1 620 XP pour le niveau 10, 11 020 pour le niveau 30.
- **Joueur régulier** (8 plis et quelques défis par jour, environ 300 XP) : niveau 10 en 5 à 6 jours, niveau 30 en un peu plus d'un mois.
- **Pas de plafond.** Au-delà d'un certain niveau (50 par exemple), les récompenses deviennent cosmétiques et les paliers s'espacent.
- **La courbe ne s'allonge que par la fin.** On ne modifie jamais le coût d'un niveau déjà atteignable, sinon un joueur pourrait perdre un niveau.

### Récompenses

| Palier | Récompense |
|---|---|
| Chaque niveau | 1 pli bonus, ou un petit cosmétique |
| Tous les 5 niveaux | un avatar, un dos de carte, un titre (« Lexicographe en herbe »), un emplacement de carte épinglée en plus |
| Niveau 5 | ouverture des échanges et des clans (freine les comptes multiples créés pour farmer) |
| Tous les 10 niveaux | une récompense marquante : cadre de profil animé, emblème de clan rare |

- **Plis bonus :** ils s'ajoutent à un compteur séparé, hors du plafond de 6 du stock, sinon ils seraient perdus quand le stock est plein. On les ouvre une fois le stock vide. Ils accélèrent la collection : la simulation doit en tenir compte.
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

Trois réglages, choisis par le joueur :

| Réglage | Qui voit le profil |
|---|---|
| Privé (par défaut) | le joueur seul |
| Clan | les membres de son clan |
| Public | tout le monde, par un lien ; apparaît sous son pseudo dans les classements |

À décider : un joueur au profil privé apparaît-il dans sa ligue (voir Classements) ? Recommandation : oui, avec son pseudo et son avatar, sans lien vers son profil.

### Pseudo et avatar

- **Pseudo :** unique, 3 à 20 caractères, filtré par une liste d'exclusion (celle des injures de la chaîne, `exclusions.py`, plus une liste générale), signalable. Modifiable une fois par mois.
- **Avatar : pas de photo envoyée.** Recommandation : un choix de portraits tirés des gravures du domaine public, dont certains se gagnent par les niveaux. Raisons :
  - une photo d'un mineur est une donnée personnelle sensible ;
  - modérer des images demande un service externe et une équipe ;
  - des portraits gravés vont avec la direction artistique, et en faire des récompenses nourrit la progression.

### Mise en œuvre

- **Page web :** `/joueur/{pseudo}`, rendue par le serveur, partageable, avec une image de partage générée par la file (D-002).
- **API :** `GET /players/{pseudo}` (applique la visibilité, limite de débit), `PATCH /me/profile`, `PUT /me/pinned-cards`.
- **Cartes épinglées :** le serveur vérifie la possession. Si un échange fait tomber une carte épinglée à zéro exemplaire, elle est désépinglée dans la même transaction.
- **Statistiques :** calculées à la lecture (un comptage sur `user_cards` par joueur, indexé) et mises en cache une minute. Le profil n'est pas un chemin critique.

## 3. Clans

### Principe

Un groupe de joueurs qui avancent ensemble. Ce sont les objectifs communs qui font vivre un clan, pas la discussion, qui est exclue ici.

### Règles de base

- **Taille :** 30 membres au plus (réglage daté).
- **Un seul clan par joueur.** Après l'avoir quitté, il faut attendre 24 h avant d'en rejoindre un autre : on ne change pas de clan pour toucher deux fois une récompense.
- **Rôles :** chef (un seul), adjoints, membres. Le chef et les adjoints acceptent les demandes et excluent un membre. Si le chef est absent 14 jours, le rôle passe à l'adjoint le plus ancien.
- **Entrée :** ouverte, sur demande, ou sur invitation (code à partager).
- **Accès :** compte inscrit, niveau 5.

### Nom et emblème, sans texte libre

- **Recommandation : des noms générés à partir des mots du jeu.** Le chef choisit parmi des propositions (« Les Faquins de la Billevesée », « La Confrérie des Escogriffes »), qu'il peut relancer. Aucune modération, et c'est dans le ton du jeu.
- **Autre option :** nom libre, filtré et signalable. Il faut alors une file de signalements traitée par quelqu'un.
- **Emblème :** une gravure et deux couleurs, à choisir dans une liste.
- **Description :** des étiquettes à choisir (« Détente », « On complète tout », « Actif tous les jours »), pas de texte.

### Ce qu'on fait dans un clan

1. **L'objectif de la semaine (coopératif) :** par exemple « Découvrir 300 mots nouveaux ensemble », proportionnel au nombre de membres. Trois paliers (bronze, argent, or). Chaque membre qui a contribué au minimum reçoit les récompenses du palier atteint.
2. **La bibliothèque du clan :** la part de chaque collection que possède au moins un membre. « À nous tous, il nous manque 12 Fondateurs. » Le thème du jeu, vécu à plusieurs.
3. **Le journal du clan :** des événements écrits par le serveur (« Raph a trouvé une Légendaire : ribonborder ! », « Objectif d'argent atteint »). Les membres réagissent par des réactions prédéfinies (bravo, jaloux, etc.), pas par du texte.
4. **Plus tard, les dons :** un membre demande une carte Courant ou Peu courant, un autre lui donne un doublon (comme dans Clash Royale). C'est un excellent ciment de clan, mais il faut d'abord les règles d'échange. À limiter aux raretés basses, aux doublons et à quelques dons par jour, pour éviter un marché noir de cartes rares entre comptes.
5. **Le classement des clans** (voir Classements).

### Plus tard : les classes

Pour les licences écoles, une classe sera un clan privé géré par l'enseignant. Prévoir un champ `kind` dans la table des clans dès le départ.

### Mise en œuvre

- **Tables :** `clans`, `clan_members` (clé : le joueur, ce qui garantit un seul clan), `clan_join_requests`, `clan_weekly_progress`, `clan_feed_events` (purgés après 30 jours).
- **Rejoindre un clan plein :** la ligne du clan est verrouillée (`FOR UPDATE`) le temps de compter les membres, avec un test d'intégration de demandes simultanées (règle d'architecture).
- **Objectif et journal :** alimentés par la file à partir des actions des joueurs. Quelques secondes de retard ne gênent pas, et rien n'alourdit l'ouverture d'un pli.
- **Bibliothèque :** recalculée par la file quand un membre gagne un mot nouveau ou quitte le clan.

## 4. Classements

### Sur quoi classer

| Critère | Pour | Contre |
|---|---|---|
| Score de collection (points par mot possédé, selon sa rareté) | reflète le cœur du jeu | figé : les anciens restent en tête, et la chance pèse |
| XP de la semaine | remis à zéro chaque lundi, un nouveau venu a sa chance | récompense l'activité plus que la collection |
| Mots maîtrisés | récompense l'apprentissage, idéal pour les écoles | dépend des défis, pas encore construits |

### Recommandation

- **Joueurs : des ligues hebdomadaires, comme Duolingo.**
  - Des groupes de 30 joueurs d'activité proche, classés à l'XP de la semaine.
  - Le lundi, les 7 premiers montent d'une division, les 5 derniers descendent.
  - Une dizaine de divisions aux noms du jeu (Gazette, Almanach, Chronique… jusqu'à Encyclopédie).
  - Raison : être 12e sur 30 motive, être 84 213e sur 250 000 non.
- **Tableau d'honneur permanent :** le top 100 mondial au score de collection, et les premiers joueurs à compléter chaque collection. C'est le prestige des collectionneurs.
- **Clans :** classement hebdomadaire à la somme de l'XP des membres, avec un plafond par membre, pour qu'un seul joueur très actif ne porte pas tout le clan. Top 100 mondial, et le rang de son propre clan.
- **Récompenses :** cosmétiques, titres et plis bonus pour une montée de division ou un podium. Tout est gratuit.

### Mise en œuvre

- **Scores de la semaine :** une table `weekly_scores` (semaine, joueur, score), mise à jour par la file à chaque gain d'XP.
- **Ligues :** formées le lundi par la tâche quotidienne (cron). Classer 30 joueurs est une requête triviale.
- **Classements mondiaux :** une photo prise toutes les 5 minutes par une tâche planifiée, servie en cache par le CDN. Un classement n'a pas besoin d'être exact à la seconde, et la base n'est pas sollicitée par chaque visiteur. Pas besoin de Redis.
- **Triche :** l'XP ne vient que d'actions validées par le serveur, sous limites de débit (D-018). Une vérification d'anomalies (XP hors norme) pourra passer par la file.

## 5. Duels entre joueurs

### Contraintes

- La collection reste le cœur du jeu : un duel doit lui donner de la valeur, pas la remplacer.
- Pas de temps réel avant la conclusion de la R&D D-007.
- Pas de texte libre entre joueurs.
- **Aucune mise de cartes :** perdre une carte sur un duel ressemblerait à un jeu d'argent.

### Pistes

| Piste | Principe | Avis |
|---|---|---|
| **A. Joute asynchrone (recommandée)** | Chaque joueur choisit 5 cartes de sa collection. L'adversaire doit trouver la définition de chacun de ces mots parmi 4 propositions. Un mot rare rapporte plus s'il est trouvé. Chacun joue son tour quand il veut, dans les 24 h. | Valorise la collection (des mots rares piègent l'adversaire) et l'apprentissage (on connaît les mots qu'on a maîtrisés). Faisable sans temps réel. |
| B. Le Dictionnaire (jeu du bluff) | Trouver la vraie définition parmi des fausses plausibles. | Même moteur que A. Dans le jeu de société, les joueurs inventent les fausses définitions, ce qui est exclu ici (texte libre). Parfait pour un mode classe. |
| C. Combat de cartes à statistiques | Chaque carte a une attaque et une défense, comme Pokémon. | Les mots n'ont pas de statistiques naturelles : des valeurs inventées sembleraient arbitraires. Long à équilibrer. Déconseillé pour l'instant. |
| D. Duel en direct | Les mêmes questions en même temps, le plus rapide gagne. | Idéal pour les streamers, mais dépend de la R&D D-007. Plus tard. |

### Ce qu'il faut pour la piste A

- **Des fausses définitions :** trois par carte, plausibles mais fausses, générées par la chaîne de contenu et contrôlées comme le reste (ni vraies par accident, ni injurieuses). Elles serviront aussi aux défis. C'est un coût LLM à chiffrer, donc à valider avant de lancer.
- **Mise en relation :** défier un membre de son clan, un joueur dont on a le pseudo, ou un adversaire au hasard de niveau proche.
- **Sécurité :** le serveur envoie les 4 propositions sans dire laquelle est juste, valide la réponse et mesure le temps. Le client ne connaît jamais la bonne réponse avant d'avoir répondu.
- **Récompenses :** XP et points de ligue.
- **Données :** `duels` (deux joueurs, decks, état, échéance) et `duel_answers`. Les notifications de tour passent par la file (D-007).

Les duels arrivent après les défis, dont ils partagent le moteur de questions.

## Ordre de réalisation proposé

1. **Inscription** (déjà prévue) : prérequis de tout le social.
2. **Niveau de compte**, avec l'XP du pli dans le récapitulatif d'ouverture.
3. **Profil public**, avec pseudo, avatars gravés et cartes épinglées.
4. **Défis** (déjà prévus), qui alimentent l'XP et préparent les duels.
5. **Clans** : objectif de la semaine, bibliothèque, journal.
6. **Classements** : ligues, tableau d'honneur, clans.
7. **Duels** (piste A), puis les dons de clan une fois les échanges en place.

Pour la bêta de novembre, le réaliste est l'ouverture (lot A de [ouverture.md](ouverture.md)), le niveau de compte et un profil simple. Les clans, les classements et les duels viendront après.

## Décisions à prendre

1. **Barème d'XP et courbe :** partir des valeurs ci-dessus et les calibrer par simulation.
2. **Plis bonus en récompense :** oui (recommandé, gratuits et hors du plafond du stock), ou seulement des cosmétiques.
3. **Avatar :** portraits gravés à choisir (recommandé), ou photos envoyées avec modération.
4. **Visibilité par défaut :** privée (recommandé), et le pseudo apparaît-il dans les ligues pour un profil privé ?
5. **Noms de clan :** générés à partir des mots du jeu (recommandé), ou libres avec modération.
6. **Taille des clans :** 30 membres (recommandé).
7. **Classements :** ligues hebdomadaires, tableau d'honneur et classement des clans (recommandé).
8. **Duels :** piste A, et accord pour chiffrer la génération des fausses définitions.
9. **Niveau 5 pour accéder aux échanges et aux clans.**
