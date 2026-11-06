# Recette des joutes

Ce qu'on vérifie avant d'ouvrir les joutes aux testeurs, puis en production : chaque test, ce qu'on doit voir, et ta place pour noter. Les règles sont en P91 ([regles-du-jeu.md](regles-du-jeu.md)), le cahier dans [joutes.md](cahiers-des-charges/joutes.md). Le lot 1 est construit depuis le 2026-11-05, web et mobile.

Pour chaque test, note dans **Retour** : « OK », ou ce que tu as vu à la place. Une capture d'écran aide.

## 0. Préparer

### Lancer le projet

Comme dans [recette-web.md](recette-web.md#0-préparer) : `pnpm install`, `docker compose up -d`, `pnpm db:migrate`, puis `pnpm dev`. Le web répond sur http://localhost:3000, l'API sur http://localhost:8787. Le code de connexion s'affiche dans le terminal de `pnpm dev`.

Si ta base locale est neuve, lance une fois `pnpm catalog:publish` : il écrit la définition de chaque carte, et sans elle aucune carte ne peut entrer dans un deck.

### Les comptes

Il faut trois comptes inscrits, chacun dans son propre navigateur ou profil :

| Nom | Compte | Rôle |
|---|---|---|
| A | `contact@leximon.fr` | Toi, admin. Lance les joutes |
| B | `recette-b@example.com` | L'ami défié |
| C | `recette-c@example.com` | L'adversaire de la joute classée |

Pour chacun :

1. Se connecter une fois sur le site, puis choisir un pseudo dans le profil.
2. Monter au niveau des joutes. Elles s'ouvrent au niveau 8 depuis le 2026-11-06 (au 15 avant) :

   ```bash
   pnpm dev:player recette-b@example.com --level 10
   ```

3. Avoir au moins 5 mots en Esquisse : ouvrir quelques sachets (les coffrets des niveaux sautés en donnent), puis faire une révision dans Défis et répondre juste à au moins 5 mots.
4. Dans `/admin/joueurs`, ouvrir sa fiche et cliquer « Ouvrir les joutes ».

Ensuite, A et B deviennent amis (page Amis, par pseudo). C reste hors des amis de A.

### Raccourcis en base locale

Certains tests demandent d'avancer le temps. Les commandes ci-dessous ne touchent que la base locale :

```bash
# Fait passer l'heure limite de toutes les joutes qui attendent leur second joueur
docker exec leximon-postgres-1 psql -U leximon -d leximon -c "update jousts set reply_by = now() - interval '1 minute' where ended_at is null and opponent_started_at is null and challenger_done_at is not null"
```

---

## 1. La porte

### JOU-01 · Qui peut jouter
- **Faire :** ouvrir `/joutes` avec un invité, puis avec un compte sans pseudo, puis avec un compte sous le niveau 8, puis avec un compte au bon niveau mais dont la case n'est pas cochée dans l'admin. Enfin, avec A.
- **Attendu :**
  - invité : « Crée un compte pour jouter contre d'autres joueurs. », avec « Créer mon compte » ;
  - sans pseudo : « Choisis un pseudo… », avec « Choisir mon pseudo » ;
  - sous le niveau : l'écran fermé avec le cadenas et le niveau qui ouvre les joutes ;
  - case pas cochée : « Les joutes s'ouvrent d'abord à quelques testeurs, le temps de régler le chrono. Elles arrivent bientôt pour tout le monde. » ;
  - A : la règle du jeu, « Trouver un adversaire », « Défier un ami », son deck et la liste de ses joutes (« Aucune joute pour l'instant. Lance la première. »).
- **Retour :**

### JOU-02 · L'entrée depuis Jouer
- **Faire :** sur l'écran Jouer, toucher le bouton rond Joutes avec A, puis avec un compte sous le niveau 8. Sur grand écran, la tuile Joutes de la colonne de gauche.
- **Attendu :** A arrive sur `/joutes`. Sous le niveau, un message dit le niveau qui les ouvre.
- **Retour :**

### JOU-03 · L'admin
- **Faire :** sur la fiche de B dans `/admin/joueurs`, fermer puis rouvrir les joutes. Regarder le journal des actions.
- **Attendu :** le bouton passe de « Ouvrir les joutes » à « Fermer les joutes » et le texte au-dessus change. La fiche dit le nombre de joutes jouées (« Il a joué 3 joutes. »). Le journal garde « Accès aux joutes » à chaque changement. B fermé ne peut plus lancer de joute ni changer son deck.
- **Retour :**

---

## 2. Le deck

### JOU-04 · Le deck d'office
- **Faire :** A ouvre `/joutes` sans avoir jamais touché à son deck.
- **Attendu :** « Le jeu a composé ce deck avec tes mots les plus rares. Change-le quand tu veux. » Le compte dit les cartes et les points (« 10 cartes sur 10, 23 points sur 25 »), moins de 10 si A n'a pas assez de mots en Esquisse. Seuls des mots trouvés au moins une fois y entrent.
- **Retour :**

### JOU-05 · Changer son deck
- **Faire :** « Changer mon deck ». Retirer des cartes, en ajouter, essayer de dépasser 25 points, puis 10 cartes. Descendre sous 5 cartes. Garder un deck de 7 cartes, recharger la page.
- **Attendu :** le compte des points suit chaque touche. Au-delà de 25 points ou de 10 cartes, la carte n'entre pas et une phrase dit pourquoi. Sous 5 cartes, « Garder ce deck » est grisé. Après le rechargement, le deck de 7 cartes est là et le texte « composé d'office » a disparu.
- **Retour :**

### JOU-06 · Pas assez de mots
- **Faire :** un compte ouvert aux joutes qui a moins de 5 mots en Esquisse ouvre `/joutes`.
- **Attendu :** les deux boutons de lancement sont grisés, avec « Il te faut au moins 5 mots trouvés une fois pour faire un deck. Réponds à tes défis pour en trouver. »
- **Retour :**

---

## 3. Une joute entre amis

### JOU-07 · Lancer
- **Faire :** A clique « Défier un ami ». Regarder la liste, puis défier B.
- **Attendu :** la liste montre les amis et les membres du clan qui peuvent jouter, avec avatar et pseudo. C n'y est pas. Un ami qui n'a pas le niveau ou l'accès n'y est pas non plus. Après « Défier », A arrive sur la joute : « Joute contre B », la règle du chrono et « Jouer ».
- **Retour :**

### JOU-08 · Jouer sa partie
- **Faire :** A clique « Jouer » et répond aux 5 questions : une juste, une fausse, et une laissée passer sans répondre.
- **Attendu :**
  - en haut, « Question 1 sur 5 » et les secondes qui restent ; la barre du chrono se vide et rougit dans les dernières secondes ;
  - une définition, 4 mots, sans le mot cherché dans la définition ;
  - après un choix : le bon mot en vert, le mauvais choix en rouge, « Bonne réponse » ou « Mauvaise réponse », puis la question suivante seule ;
  - la question laissée passer : « Le temps était écoulé. La question compte fausse. », puis la suivante ;
  - à la fin : « Ta partie est jouée. B a jusqu'à … pour jouer la sienne. » ;
  - le niveau de A a gagné 20 XP.
- **Retour :**

### JOU-09 · Reprendre après un rechargement
- **Faire :** lancer une nouvelle joute contre B. Pendant la question 2, recharger la page, puis « Reprendre la joute ».
- **Attendu :** la joute reprend à la question en cours, avec le temps qui lui restait (le chrono a continué pendant le rechargement). Les questions déjà répondues ne reviennent pas.
- **Retour :**

### JOU-10 · Quitter en cours de partie
- **Faire :** lancer une joute, répondre à une question, fermer l'onglet. Revenir sur `/joutes` après 5 minutes.
- **Attendu :** la partie de A est close : les questions non jouées comptent fausses, et la joute attend B.
- **Retour :**

### JOU-11 · La lettre de B
- **Faire :** B ouvre le jeu et son courrier.
- **Attendu :** une lettre « A te défie en joute » ; un clic mène à `/joutes`. Dans la liste de B, la joute est en tête avec « Jouer ». Dès que B commence sa partie, la lettre passe en lue.
- **Retour :**

### JOU-12 · La partie de B, contre le fantôme
- **Faire :** B joue sa partie.
- **Attendu :** avant de jouer, « Tu joues contre la partie enregistrée de A. ». Pendant la partie, une ligne dit où en était A au même moment (« À la 2e question, A en avait 1. Tu en as 1. »). Le compte de B suit ses bonnes réponses.
- **Retour :**

### JOU-13 · Le résultat
- **Faire :** B voit l'écran de fin. A ouvre sa lettre « Ta joute contre B est finie ».
- **Attendu :**
  - un titre qui dit qui gagne ;
  - les scores (« Tu as trouvé 3 mots sur 5 en 34 s, et A 2 sur 5 en 41 s. ») ; à égalité de bonnes réponses, le temps total départage ;
  - les mots qui ont piégé l'autre (« Tes mots … ont piégé A. ») ;
  - les deux listes de réponses, trouvé ou raté et le temps ; chaque mot ouvre sa carte ;
  - la récompense du gagnant : 20 XP de plus, et un sachet bonus à sa première victoire du jour ;
  - la même joute, vue par A, montre le même résultat de son côté.
- **Retour :**

### JOU-14 · La revanche
- **Faire :** sur le résultat, « Proposer une revanche ».
- **Attendu :** une nouvelle joute amicale s'ouvre, avec 5 nouvelles cartes tirées des decks.
- **Retour :**

---

## 4. Une joute classée

### JOU-15 · Trouver un adversaire
- **Faire :** C ouvre le jeu (il doit être passé dans les 24 dernières heures). A clique « Trouver un adversaire ». Recommencer tout de suite.
- **Attendu :** la première fois, A tombe sur une joute contre B ou C : le jeu choisit parmi les joueurs proches de sa cote. Pas deux joutes classées contre le même adversaire en 24 h : la deuxième va vers l'autre joueur, ou s'arrête sur « Personne n'est disponible pour une joute classée en ce moment… » s'il n'y en a plus.
- **Retour :**

### JOU-16 · La cote reste cachée
- **Faire :** jouer une joute classée jusqu'au bout.
- **Attendu :** aucune cote ni aucun rang ne s'affichent nulle part. En base, `joust_ratings` a une ligne pour chacun des deux joueurs.
- **Retour :**

---

## 5. Les limites

### JOU-17 · Cinq joutes en attente
- **Faire :** A lance des joutes contre B sans que B les joue, jusqu'à la sixième.
- **Attendu :** la sixième est refusée : « Tu as déjà 5 joutes qui attendent leur adversaire. Lance la suivante quand l'une d'elles est finie. »
- **Retour :**

### JOU-18 · Un double clic ne lance qu'une joute
- **Faire :** double-cliquer vite sur « Défier » dans la liste des amis.
- **Attendu :** une seule joute est créée.
- **Retour :**

### JOU-19 · Les récompenses par jour
- **Faire :** jouer 6 joutes dans la journée avec A.
- **Attendu :** les 5 premières rapportent leur XP, la sixième plus rien. Le sachet de la première victoire n'est donné qu'une fois par jour (heure de Paris). Si la réserve de sachets bonus est pleine, la victoire ne le donne pas, mais une autre victoire du même jour peut encore le donner.
- **Retour :**

### JOU-20 · Sans réponse en 24 h
- **Faire :** A lance une joute contre B, qui ne la joue pas. Lancer la commande « heure limite » de la préparation, puis A ouvre `/joutes`.
- **Attendu :** la joute revient à A, « La joute te revient, car B n'a pas joué à temps. », avec ses récompenses et une lettre de fin. B la voit perdue : « La joute revient à ton adversaire, car tu n'as pas joué à temps. »
- **Retour :**

---

## 6. Courrier, e-mail, missions

### JOU-21 · L'e-mail des lettres en attente
- **Faire :** en local, l'API écrit les e-mails dans sa console. A lance une joute à B, qui ne revient pas pendant 30 minutes (entre 8 h et 21 h). Puis recommencer avec « Joutes » éteint dans les réglages de B (Réglages, notifications : « Quand un joueur te lance une joute »).
- **Attendu :** le premier e-mail nomme la joute à jouer. Le réglage éteint, l'e-mail ne la nomme plus.
- **Retour :**

### JOU-22 · La mission « Joue une joute »
- **Faire :** sur A, ouvrir les missions du jour. Si la mission n'est pas tirée, changer une mission (une fois par jour) jusqu'à la voir, ou réessayer le lendemain. Cliquer « Y aller », jouer sa partie, revenir aux missions.
- **Attendu :** « Joue une joute », avec « Y aller » qui mène à `/joutes`. Elle passe à « faite » dès que la partie de A est finie, sans attendre B. Elle n'est jamais tirée pour un invité, ni pour un compte dont les joutes sont fermées.
- **Retour :**

---

## 7. Sur l'app Android

Le mobile se prépare comme dans [recette-mobile.md](recette-mobile.md). Les comptes sont les mêmes. L'écran des joutes du mobile n'a encore tourné sur aucun téléphone : c'est la partie la plus à risque de cette recette.

### MJO-01 · Hall et deck
- **Faire :** A touche le bouton rond Joutes de l'écran Jouer. Ouvrir « Changer mon deck », ajouter et retirer des cartes, garder.
- **Attendu :** comme JOU-01 et JOU-05. La feuille du deck monte du bas, défile jusqu'au bouton « Garder ce deck », et le compte des points suit chaque touche. Les cartes de la ligne du deck ouvrent leur fiche.
- **Retour :**

### MJO-02 · Une joute du téléphone au web
- **Faire :** A défie B depuis le téléphone et joue sa partie. B joue sur le web. A ouvre la lettre de fin dans le courrier du téléphone.
- **Attendu :** comme JOU-08 à JOU-13. Le chrono reste fluide. Une bonne réponse vibre une fois, une mauvaise deux fois. Les quatre choix restent lisibles et touchables sur un petit écran. La lettre mène aux joutes, la joute finie montre le résultat et « Proposer une revanche ».
- **Retour :**

### MJO-03 · Sortir de l'app en pleine partie
- **Faire :** pendant une question, passer sur une autre app 10 secondes, puis revenir.
- **Attendu :** le chrono a continué : la question est perdue si son temps est passé, et la suivante arrive.
- **Retour :**

### MJO-04 · Réglage et mission
- **Faire :** Réglages, éteindre puis rallumer « Joutes ». Ouvrir les missions, « Y aller » sur « Joue une joute ».
- **Attendu :** le réglage tient après un relancement de l'app. « Y aller » ouvre les joutes.
- **Retour :**

---

## 8. En production

À faire une fois les joutes mises en ligne par `pnpm deploy:prod`.

### PROD-01 · Le catalogue
- **Faire :** lancer une fois `pnpm catalog:publish:prod`, puis ouvrir `/joutes` avec ton compte, coché dans `/admin`.
- **Attendu :** ton deck se compose. Sans cette commande, il reste vide et aucune joute ne se lance.
- **Retour :**

### PROD-02 · Ouvrir aux testeurs
- **Faire :** cocher « Ouvrir les joutes » sur la fiche de chaque testeur choisi. Les prévenir.
- **Attendu :** les testeurs voient les joutes ; les autres joueurs voient seulement que les joutes s'ouvrent bientôt.
- **Retour :**

### PROD-03 · Une vraie joute
- **Faire :** jouer une joute amicale contre un testeur, puis une classée.
- **Attendu :** comme JOU-07 à JOU-16. L'e-mail de lettres en attente part bien de la production.
- **Retour :**

---

## Ce que tu juges

Ces réglages ne sont ni justes ni faux : ils se décident à l'usage. Dis ce que tu en penses après quelques joutes.

| Réglage | Aujourd'hui | Ta décision |
|---|---|---|
| Chrono par question | 15 s, à essayer à 10 et 20 s avec les testeurs (`answerMs` dans `packages/core/src/rules.ts`) | |
| Durée d'une partie au plus | 5 minutes | |
| Délai après le chrono pour une réponse en route | 2 s, pour le réseau | |
| Réserve pleine à la première victoire du jour | le sachet est perdu, une autre victoire du jour peut le donner | |
| La revanche | toujours une joute amicale | |
| Gains | 20 XP par joute jouée, 20 de plus par victoire, sur 5 joutes par jour | |

## Retours de la recette

Les retours qui demandent un changement s'écrivent ici, datés, avec ce qu'on en fait.
