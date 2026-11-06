# Recette des nouveautés

Ce qui a été construit du 4 au 6 novembre 2026, en deux parties :

- **Finitions hors du jeu** (FIN-01 à FIN-13) : le [cahier des finitions](cahiers-des-charges/finitions-hors-du-jeu.md) (accueil, icônes, images de partage, e-mails, cadres, emblèmes, fiches des stores), puis trois corrections du 5 novembre (écran Jouer sur petit téléphone, bilan du sachet, réglages de la révision). La plupart de ces tests renvoient à un test de la [recette du web](recette-web.md) ou de la [recette du mobile](recette-mobile.md) et disent ce qu'il faut y regarder ; les attendus complets restent dans le test cité.
- **Joutes, lot 1** (JTE-01 à JTE-22 sur le web, MJT-01 à MJT-04 sur Android, PROD-01 à PROD-03 en production) : ce qu'on vérifie avant d'ouvrir les joutes aux testeurs, puis en production. Les règles sont en P91 ([regles-du-jeu.md](regles-du-jeu.md)), le cahier dans [joutes.md](cahiers-des-charges/joutes.md). Le lot 1 est construit depuis le 2026-11-05, web et mobile.

Pour chaque test, note dans **Retour** : « OK », ou ce que tu as vu à la place. Une capture d'écran aide.

## 0. Préparer

### Lancer le projet

Comme dans [recette-web.md](recette-web.md#0-préparer) et [recette-mobile.md](recette-mobile.md#0-préparer) : `pnpm install`, `docker compose up -d`, `pnpm db:migrate`, puis `pnpm dev`. Le web répond sur http://localhost:3000 (si un autre projet occupe ce port, l'arrêter d'abord), l'API sur http://localhost:8787. Le code de connexion s'affiche dans le terminal de `pnpm dev`.

Si ta base locale est neuve, lance une fois `pnpm catalog:publish` : il écrit la définition de chaque carte, et sans elle aucune carte ne peut entrer dans un deck de joute.

### Les comptes

Il faut trois comptes inscrits, chacun dans son propre navigateur ou profil, et une fenêtre privée pour l'invité. B sert aussi sur le téléphone :

| Nom | Compte | Rôle |
|---|---|---|
| A | `contact@leximon.fr` | Toi, admin. Lance les joutes, regarde l'atelier et les clans |
| B | `recette-b@example.com` | L'ami défié, et le compte du téléphone |
| C | `recette-c@example.com` | L'adversaire de la joute classée |

Pour les joutes, pour chacun :

1. Se connecter une fois sur le site, puis choisir un pseudo dans le profil.
2. Monter au niveau des joutes. Elles s'ouvrent au niveau 8 depuis le 2026-11-06 (au 15 avant) :

   ```bash
   pnpm dev:player recette-b@example.com --level 10
   ```

3. Avoir au moins 5 mots en Esquisse : ouvrir quelques sachets (les coffrets des niveaux sautés en donnent), puis faire une révision dans Défis et répondre juste à au moins 5 mots.
4. Dans `/admin/joueurs`, ouvrir sa fiche et cliquer « Ouvrir les joutes ».

Ensuite, A et B deviennent amis (page Amis, par pseudo). C reste hors des amis de A.

### Raccourcis en base locale

Certains tests des joutes demandent d'avancer le temps. Les commandes ci-dessous ne touchent que la base locale :

```bash
# Fait passer l'heure limite de toutes les joutes qui attendent leur second joueur
docker exec leximon-postgres-1 psql -U leximon -d leximon -c "update jousts set reply_by = now() - interval '1 minute' where ended_at is null and opponent_started_at is null and challenger_done_at is not null"
```

### Pour les finitions

- Pour le bilan d'un sachet, il faut des sachets : `/admin/joueurs`, fiche de B, « Offrir des plis bonus ».
- **Sans petit téléphone sous la main**, l'émulateur Android prend n'importe quel format. Une fois l'app ouverte :

```bash
adb shell wm size 1080x1920
```

Puis fermer l'app (`adb shell am force-stop fr.leximon.app`) et la rouvrir, sinon elle garde l'ancienne mise en page. `adb shell wm size reset` remet l'écran d'origine.

---

## Finitions · 1. Accueil

### FIN-01 · L'accueil du site
- **Faire :** [PUB-01](recette-web.md#pub-01--page-daccueil) en grand écran et en 375 × 812, puis [PUB-02](recette-web.md#pub-02--liste-dattente) avec la bêta fermée.
- **Regarder surtout :** le sachet qu'on déchire sans compte au premier écran, et le bouton à portée du pouce sur téléphone.
- **Retour :**

### FIN-02 · Le premier écran de l'app sans invitation
- **Faire :** [CPT-04](recette-mobile.md#cpt-04--premier-lancement-sans-invitation).
- **Regarder surtout :** c'est le même premier écran que le site. Le sachet se déchire sans compte.
- **Retour :**

## Finitions · 2. Icônes et images de partage

### FIN-03 · Icône, favicon et écran de lancement
- **Faire :** [PUB-04](recette-web.md#pub-04--image-de-partage) pour l'onglet du navigateur et le raccourci sur iPhone, puis [COQ-01](recette-mobile.md#coq-01--lancement) sur le téléphone. La nouvelle icône de l'app ne se voit qu'après un nouveau build.
- **Regarder surtout :** le sceau de cire au L sur le cuir vert, jamais rogné, lisible en tout petit dans l'onglet, sur fond clair comme sur fond sombre.
- **Retour :**

### FIN-04 · Images de partage
- **Faire :** [PUB-04](recette-web.md#pub-04--image-de-partage) en local. Une fois en ligne, coller un lien de carte et un lien de profil dans Discord et dans WhatsApp.
- **Attendu :** l'aperçu montre la carte posée sur le sous-main, le mot lisible même en petit. Une carte n'a pas sa gravure dans l'image : c'est voulu, elle porte l'initiale sur les hachures.
- **Retour :**

## Finitions · 3. E-mails

### FIN-05 · L'aperçu d'une campagne
- **Faire :** [CAM-01](recette-web.md#cam-01--brouillon-et-aperçu).
- **Retour :**

### FIN-06 · Un vrai e-mail reçu
En local, aucun e-mail ne part : ce test se fait une fois le site en ligne.
- **Faire :** se connecter sur leximon.fr avec une adresse Gmail, puis lire le code dans Gmail sur ordinateur, dans l'app Gmail du téléphone, et en mode sombre. Si un rappel ou une nouvelle arrive, le regarder aussi.
- **Attendu :** une feuille crème sur le bois sombre, « Leximon » en brun avec un filet doré dessous. Le code est dans un encadré beige. Un bouton est en or, cerné d'encre, avec son épaisseur dessous. En bas, sur le bois, le lien du site, et « Se désabonner » sur un rappel ou une nouvelle. Aucune image à télécharger. Gmail en mode sombre peut foncer la feuille : le texte doit rester lisible.
- **Retour :**

## Finitions · 4. Cadres d'avatar et emblèmes de clan

### FIN-07 · Les 13 cadres
- **Faire :** [PRO-06](recette-web.md#pro-06--atelier) sur le web, avec un compte au niveau 200 (`pnpm dev:player <email> --level 200`) pour tous les avoir, puis [MPR-01](recette-mobile.md#mpr-01--profil-et-atelier) sur le téléphone.
- **Regarder surtout :** chaque cadre en grand dans l'atelier, puis en petit dans la barre du haut et dans une liste (amis, membres du clan). Les gouttes d'encre, les perles, la dentelle et les rayons débordent du rond sans toucher le texte autour. Seuls les rayons du soleil royal tournent, et sur le web seulement ; ils restent immobiles avec « réduire les animations » activé dans le système.
- **Retour :**

### FIN-08 · Les emblèmes
- **Faire :** [CLA-03](recette-web.md#cla-03--créer-un-clan) : essayer plusieurs gravures et paires de couleurs, puis ouvrir le même clan sur le téléphone.
- **Attendu :** le bouclier est cerclé d'or comme les boutons du jeu, avec son épaisseur dessous. Le champ est plus clair en haut. Les couleurs vont avec la salle, et la gravure reste lisible sur chacune. Le web et le téléphone montrent le même bouclier.
- **Retour :**

## Finitions · 5. Fiches des stores

### FIN-09 · Les images des fiches
- **Faire :** ouvrir les fichiers de [apps/mobile/store/](../apps/mobile/store/) :
  - `presentation-1024x500.png` ;
  - les 7 captures de `android/` ;
  - les 7 captures de `ios/` ;
  - les deux en-têtes de `ios/`.

  Les comparer à l'ordre et aux textes de [fiches-stores.md](fiches-stores.md).
- **Attendu :**
  - Les captures montrent, dans l'ordre : le sachet, l'ouverture, une carte révélée, une fiche épique, l'album, une question de défi, une fiche précieuse.
  - La barre d'état affiche 9:41. On ne voit ni outil de développement, ni message d'erreur, ni donnée personnelle.
  - L'image de présentation et les en-têtes montrent le sachet entre deux cartes sur le sous-main, sans texte sur les en-têtes, parce que le store y pose le nom de l'app.
  - Les captures iPhone viennent de l'émulateur Android réglé comme un iPhone : à refaire sur un vrai iPhone si l'app y diffère.
- **Retour :**

### FIN-10 · Refaire une image
- **Faire :** suivre « Refaire l'image de présentation et les en-têtes » dans [fiches-stores.md](fiches-stores.md), pour `?format=play`.
- **Attendu :** la même image que `presentation-1024x500.png`, sans le badge de Next.
- **Retour :**

## Finitions · 6. Petits écrans et réglages

### FIN-11 · L'écran Jouer sur un petit téléphone
- **Faire :** [MJO-01](recette-mobile.md#mjo-01--écran-jouer-jou-01-à-jou-03) sur trois formats : 16:9 (`1080x1920`), 2:1 (`1080x2160`) et ton téléphone.
- **Attendu :** le sachet et les boutons ronds rapetissent pour tenir dans la place. Rien ne passe sous la barre des onglets, rien ne sort de l'écran, et le bouton d'ouverture reste visible.
- **Retour :**

### FIN-12 · Le bilan d'un sachet
- **Faire :** [MJO-06](recette-mobile.md#mjo-06--bilan-jou-06-jou-07) en 2:1, puis en 16:9, avec le dernier sachet du stock : le second bouton devient alors « Voir mon album ».
- **Attendu :** en 2:1, les cartes rapetissent et les deux boutons tiennent au-dessus du bouton Jouer, sans défiler. En 16:9, le bilan défile pour atteindre « Voir mon album ». « TON SACHET » ne touche pas le cadre doré.
- **Retour :**

### FIN-13 · Les réglages de la révision
- **Faire :** [DEF-07](recette-web.md#def-07--réglages-de-la-révision) et [DEF-18](recette-web.md#def-18--types-de-questions-et-entraînement) sur le web, puis la même roue dentée dans Défis sur le téléphone.
- **Attendu :**
  - Aucune note sous les boutons.
  - Les types de questions s'appellent « Questions à l'écoute », « Paires en fin de série » et « Mots dits à voix haute ». Ce dernier est le même nom que dans les Réglages de l'app.
  - Dis si « Exigeant » reste clair sans son explication.
- **Retour :**

---

## Joutes · 1. La porte

### JTE-01 · Qui peut jouter
- **Faire :** ouvrir `/joutes` avec un invité, puis avec un compte sans pseudo, puis avec un compte sous le niveau 8, puis avec un compte au bon niveau mais dont la case n'est pas cochée dans l'admin. Enfin, avec A.
- **Attendu :**
  - invité : « Crée un compte pour jouter contre d'autres joueurs. », avec « Créer mon compte » ;
  - sans pseudo : « Choisis un pseudo… », avec « Choisir mon pseudo » ;
  - sous le niveau : l'écran fermé avec le cadenas et le niveau qui ouvre les joutes ;
  - case pas cochée : « Les joutes s'ouvrent d'abord à quelques testeurs, le temps de régler le chrono. Elles arrivent bientôt pour tout le monde. » ;
  - A : la règle du jeu, « Trouver un adversaire », « Défier un ami », son deck et la liste de ses joutes (« Aucune joute pour l'instant. Lance la première. »).
- **Retour :**

### JTE-02 · L'entrée depuis Jouer
- **Faire :** sur l'écran Jouer, toucher le bouton rond Joutes avec A, puis avec un compte sous le niveau 8. Sur grand écran, la tuile Joutes de la colonne de gauche.
- **Attendu :** A arrive sur `/joutes`. Sous le niveau, un message dit le niveau qui les ouvre.
- **Retour :**

### JTE-03 · L'admin
- **Faire :** sur la fiche de B dans `/admin/joueurs`, fermer puis rouvrir les joutes. Regarder le journal des actions.
- **Attendu :** le bouton passe de « Ouvrir les joutes » à « Fermer les joutes » et le texte au-dessus change. La fiche dit le nombre de joutes jouées (« Il a joué 3 joutes. »). Le journal garde « Accès aux joutes » à chaque changement. B fermé ne peut plus lancer de joute ni changer son deck.
- **Retour :**

---

## Joutes · 2. Le deck

### JTE-04 · Le deck d'office
- **Faire :** A ouvre `/joutes` sans avoir jamais touché à son deck.
- **Attendu :** « Le jeu a composé ce deck avec tes mots les plus rares. Change-le quand tu veux. » Le compte dit les cartes et les points (« 10 cartes sur 10, 23 points sur 25 »), moins de 10 si A n'a pas assez de mots en Esquisse. Seuls des mots trouvés au moins une fois y entrent.
- **Retour :**

### JTE-05 · Changer son deck
- **Faire :** « Changer mon deck ». Retirer des cartes, en ajouter, essayer de dépasser 25 points, puis 10 cartes. Descendre sous 5 cartes. Garder un deck de 7 cartes, recharger la page.
- **Attendu :** le compte des points suit chaque touche. Au-delà de 25 points ou de 10 cartes, la carte n'entre pas et une phrase dit pourquoi. Sous 5 cartes, « Garder ce deck » est grisé. Après le rechargement, le deck de 7 cartes est là et le texte « composé d'office » a disparu.
- **Retour :**

### JTE-06 · Pas assez de mots
- **Faire :** un compte ouvert aux joutes qui a moins de 5 mots en Esquisse ouvre `/joutes`.
- **Attendu :** les deux boutons de lancement sont grisés, avec « Il te faut au moins 5 mots trouvés une fois pour faire un deck. Réponds à tes défis pour en trouver. »
- **Retour :**

---

## Joutes · 3. Une joute entre amis

### JTE-07 · Lancer
- **Faire :** A clique « Défier un ami ». Regarder la liste, puis défier B.
- **Attendu :** la liste montre les amis et les membres du clan qui peuvent jouter, avec avatar et pseudo. C n'y est pas. Un ami qui n'a pas le niveau ou l'accès n'y est pas non plus. Après « Défier », A arrive sur la joute : « Joute contre B », la règle du chrono et « Jouer ».
- **Retour :**

### JTE-08 · Jouer sa partie
- **Faire :** A clique « Jouer » et répond aux 5 questions : une juste, une fausse, et une laissée passer sans répondre.
- **Attendu :**
  - en haut, « Question 1 sur 5 » et les secondes qui restent ; la barre du chrono se vide et rougit dans les dernières secondes ;
  - une définition, 4 mots, sans le mot cherché dans la définition ;
  - après un choix : le bon mot en vert, le mauvais choix en rouge, « Bonne réponse » ou « Mauvaise réponse », puis la question suivante seule ;
  - la question laissée passer : « Le temps était écoulé. La question compte fausse. », puis la suivante ;
  - à la fin : « Ta partie est jouée. B a jusqu'à … pour jouer la sienne. » ;
  - le niveau de A a gagné 20 XP.
- **Retour :**

### JTE-09 · Reprendre après un rechargement
- **Faire :** lancer une nouvelle joute contre B. Pendant la question 2, recharger la page, puis « Reprendre la joute ».
- **Attendu :** la joute reprend à la question en cours, avec le temps qui lui restait (le chrono a continué pendant le rechargement). Les questions déjà répondues ne reviennent pas.
- **Retour :**

### JTE-10 · Quitter en cours de partie
- **Faire :** lancer une joute, répondre à une question, fermer l'onglet. Revenir sur `/joutes` après 5 minutes.
- **Attendu :** la partie de A est close : les questions non jouées comptent fausses, et la joute attend B.
- **Retour :**

### JTE-11 · La lettre de B
- **Faire :** B ouvre le jeu et son courrier.
- **Attendu :** une lettre « A te défie en joute » ; un clic mène à `/joutes`. Dans la liste de B, la joute est en tête avec « Jouer ». Dès que B commence sa partie, la lettre passe en lue.
- **Retour :**

### JTE-12 · La partie de B, contre le fantôme
- **Faire :** B joue sa partie.
- **Attendu :** avant de jouer, « Tu joues contre la partie enregistrée de A. ». Pendant la partie, une ligne dit où en était A au même moment (« À la 2e question, A en avait 1. Tu en as 1. »). Le compte de B suit ses bonnes réponses.
- **Retour :**

### JTE-13 · Le résultat
- **Faire :** B voit l'écran de fin. A ouvre sa lettre « Ta joute contre B est finie ».
- **Attendu :**
  - un titre qui dit qui gagne ;
  - les scores (« Tu as trouvé 3 mots sur 5 en 34 s, et A 2 sur 5 en 41 s. ») ; à égalité de bonnes réponses, le temps total départage ;
  - les mots qui ont piégé l'autre (« Tes mots … ont piégé A. ») ;
  - les deux listes de réponses, trouvé ou raté et le temps ; chaque mot ouvre sa carte ;
  - la récompense du gagnant : 20 XP de plus, et un sachet bonus à sa première victoire du jour ;
  - la même joute, vue par A, montre le même résultat de son côté.
- **Retour :**

### JTE-14 · La revanche
- **Faire :** sur le résultat, « Proposer une revanche ».
- **Attendu :** une nouvelle joute amicale s'ouvre, avec 5 nouvelles cartes tirées des decks.
- **Retour :**

---

## Joutes · 4. Une joute classée

### JTE-15 · Trouver un adversaire
- **Faire :** C ouvre le jeu (il doit être passé dans les 24 dernières heures). A clique « Trouver un adversaire ». Recommencer tout de suite.
- **Attendu :** la première fois, A tombe sur une joute contre B ou C : le jeu choisit parmi les joueurs proches de sa cote. Pas deux joutes classées contre le même adversaire en 24 h : la deuxième va vers l'autre joueur, ou s'arrête sur « Personne n'est disponible pour une joute classée en ce moment… » s'il n'y en a plus.
- **Retour :**

### JTE-16 · La cote reste cachée
- **Faire :** jouer une joute classée jusqu'au bout.
- **Attendu :** aucune cote ni aucun rang ne s'affichent nulle part. En base, `joust_ratings` a une ligne pour chacun des deux joueurs.
- **Retour :**

---

## Joutes · 5. Les limites

### JTE-17 · Cinq joutes en attente
- **Faire :** A lance des joutes contre B sans que B les joue, jusqu'à la sixième.
- **Attendu :** la sixième est refusée : « Tu as déjà 5 joutes qui attendent leur adversaire. Lance la suivante quand l'une d'elles est finie. »
- **Retour :**

### JTE-18 · Un double clic ne lance qu'une joute
- **Faire :** double-cliquer vite sur « Défier » dans la liste des amis.
- **Attendu :** une seule joute est créée.
- **Retour :**

### JTE-19 · Les récompenses par jour
- **Faire :** jouer 6 joutes dans la journée avec A.
- **Attendu :** les 5 premières rapportent leur XP, la sixième plus rien. Le sachet de la première victoire n'est donné qu'une fois par jour (heure de Paris). Si la réserve de sachets bonus est pleine, la victoire ne le donne pas, mais une autre victoire du même jour peut encore le donner.
- **Retour :**

### JTE-20 · Sans réponse en 24 h
- **Faire :** A lance une joute contre B, qui ne la joue pas. Lancer la commande « heure limite » de la préparation, puis A ouvre `/joutes`.
- **Attendu :** la joute revient à A, « La joute te revient, car B n'a pas joué à temps. », avec ses récompenses et une lettre de fin. B la voit perdue : « La joute revient à ton adversaire, car tu n'as pas joué à temps. »
- **Retour :**

---

## Joutes · 6. Courrier, e-mail, missions

### JTE-21 · L'e-mail des lettres en attente
- **Faire :** en local, l'API écrit les e-mails dans sa console. A lance une joute à B, qui ne revient pas pendant 30 minutes (entre 8 h et 21 h). Puis recommencer avec « Joutes » éteint dans les réglages de B (Réglages, notifications : « Quand un joueur te lance une joute »).
- **Attendu :** le premier e-mail nomme la joute à jouer. Le réglage éteint, l'e-mail ne la nomme plus.
- **Retour :**

### JTE-22 · La mission « Joue une joute »
- **Faire :** sur A, ouvrir les missions du jour. Si la mission n'est pas tirée, changer une mission (une fois par jour) jusqu'à la voir, ou réessayer le lendemain. Cliquer « Y aller », jouer sa partie, revenir aux missions.
- **Attendu :** « Joue une joute », avec « Y aller » qui mène à `/joutes`. Elle passe à « faite » dès que la partie de A est finie, sans attendre B. Elle n'est jamais tirée pour un invité, ni pour un compte dont les joutes sont fermées.
- **Retour :**

---

## Joutes · 7. Sur l'app Android

Le mobile se prépare comme dans [recette-mobile.md](recette-mobile.md). Les comptes sont les mêmes. L'écran des joutes du mobile n'a encore tourné sur aucun téléphone : c'est la partie la plus à risque des joutes.

### MJT-01 · Hall et deck
- **Faire :** A touche le bouton rond Joutes de l'écran Jouer. Ouvrir « Changer mon deck », ajouter et retirer des cartes, garder.
- **Attendu :** comme JTE-01 et JTE-05. La feuille du deck monte du bas, défile jusqu'au bouton « Garder ce deck », et le compte des points suit chaque touche. Les cartes de la ligne du deck ouvrent leur fiche.
- **Retour :**

### MJT-02 · Une joute du téléphone au web
- **Faire :** A défie B depuis le téléphone et joue sa partie. B joue sur le web. A ouvre la lettre de fin dans le courrier du téléphone.
- **Attendu :** comme JTE-08 à JTE-13. Le chrono reste fluide. Une bonne réponse vibre une fois, une mauvaise deux fois. Les quatre choix restent lisibles et touchables sur un petit écran. La lettre mène aux joutes, la joute finie montre le résultat et « Proposer une revanche ».
- **Retour :**

### MJT-03 · Sortir de l'app en pleine partie
- **Faire :** pendant une question, passer sur une autre app 10 secondes, puis revenir.
- **Attendu :** le chrono a continué : la question est perdue si son temps est passé, et la suivante arrive.
- **Retour :**

### MJT-04 · Réglage et mission
- **Faire :** Réglages, éteindre puis rallumer « Joutes ». Ouvrir les missions, « Y aller » sur « Joue une joute ».
- **Attendu :** le réglage tient après un relancement de l'app. « Y aller » ouvre les joutes.
- **Retour :**

---

## Joutes · 8. En production

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
- **Attendu :** comme JTE-07 à JTE-16. L'e-mail de lettres en attente part bien de la production.
- **Retour :**

---

## Joutes · Ce que tu juges

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

### 2026-11-06 · Retours sur les écrans du jeu

Chaque retour vaut pour le web (téléphone et grand écran) et pour l'app, sauf ceux qui tiennent à la souris ou au clavier. La colonne **Lot** dit quand il est traité ; une coche (✓) veut dire livré, à revoir dans la recette.

**En général.** Il y a trop de texte, et surtout trop de phrases complètes : les joueurs ne liront pas tout. Une phrase reste quand elle est nécessaire pour comprendre ; sinon, un libellé court, un chiffre, une icône ou un visuel. La règle est écrite dans [voix.md](voix.md#moins-de-phrases-sur-les-écrans-de-jeu) depuis le 2026-11-06.

**Tranché le 2026-11-06.** Au survol, la bande du sachet se soulève et se fend un peu sous la souris sans l'ouvrir ; un clic sur la bande joue toute la déchirure depuis le début, et le glisser reste possible (R-25). La ligne « Demain… » laisse place à la frise des 7 jours, la case de demain mise en avant avec l'icône de son cadeau, et disparaît de la fin d'un sachet (R-02). Le clan (R-22 à R-24) passe d'abord par un cahier avec maquettes et questions fermées.

**Les lots.**

1. Corrections visuelles simples : R-03, R-04, R-05, R-10, R-11, R-12, R-13, R-17, R-19, R-20, R-21.
2. L'encart de gain enluminé et les fins d'écran : R-15, puis R-02, R-07, R-08, R-14, R-18, et les icônes de maîtrise R-16.
3. Les fenêtres : « Tes sachets » R-09, écus R-06, semaine de bienvenue R-01.
4. Le sachet à la souris : R-25.
5. Le cahier du clan : R-22, R-23, R-24.

| # | Écran | Retour | Lot |
|---|---|---|---|
| R-01 | Semaine de bienvenue | Le cuir vert de la fenêtre fait doublon avec le fond : autre texture, autre couleur (une texture neuve si besoin). | 3 |
| R-02 | Semaine de bienvenue, récompense | L'encart « Demain, le jour 2… t'offre un sachet garni » rend mal et ne fait pas jeu. | 2 |
| R-03 | Missions du jour | Retirer « Chaque mission rapporte 30 XP… » ; l'aide passe dans un bouton « ? » discret qui ouvre une bulle. | 1 ✓ |
| R-04 | Missions du jour | « Changer » plus discret, et une confirmation qui dit ce que fait le changement et qu'il n'y en a qu'un par jour. | 1 ✓ |
| R-05 | Missions du jour | Le titre d'une mission passe sur deux lignes à côté de son compteur. | 1 ✓ |
| R-06 | Fenêtre des écus | Illisible : un tableau visuel, chaque rareté avec son icône, une flèche et les écus gagnés. Montrer clairement à quoi servent les écus (le mot manquant). | 3 |
| R-07 | Fin d'un sachet | Faire respirer en hauteur : les trois boutons sont trop collés, « 25 / 539 (+5) » trop discret, « Ouvre une carte pour la lire. » sans doute de trop. | 2 |
| R-08 | Fin d'un sachet | La montée de niveau est moche et mal placée : un encart de gain enluminé (R-15), et moins de texte. | 2 |
| R-09 | Fenêtre « Tes sachets » | Mauvaise UX, désagréable à regarder : à refaire en visuel. | 3 |
| R-10 | Jouer, progression | « Au niveau 7, tu gagnes un sachet bonus » ne doit pas être une phrase complète. Le rond du sachet est ovale. | 1 ✓ |
| R-11 | Jouer, progression | L'icône du bouton « Ouvrir 1 coffret » est blanche sur jaune : invisible. | 1 ✓ |
| R-12 | Défis | L'aide du clavier (« 1 à 4 pour répondre… ») ne reste pas affichée tout le temps. | 1 ✓ |
| R-13 | Défis | Un effet au survol, même léger, sur les boutons de réponse. | 1 ✓ |
| R-14 | Fin de révision | Les informations arrivent une à une par une animation courte. L'écran est trop étroit : plus large. | 2 ✓ |
| R-15 | Gains, partout | « 1 sachet bonus gagné, rangé dans ta réserve. » ressort mal : une bordure d'enluminure et un fond texturé de couleur propre, repris pour tous les affichages de gains. | 2 (fin de révision ✓) |
| R-16 | Niveaux de maîtrise | Une icône dessinée avec soin pour chaque niveau (Esquisse…), sur la fin de révision et dans l'album partout où le niveau d'une carte se voit. | 2 ✓ |
| R-17 | Fin de révision | « +7 pour le clan » est à peine visible (couleur). | 1 ✓ |
| R-18 | Fin de révision | « Retour aux défis » plus visible, peut-être sans « Ouvrir un sachet ». | 2 ✓ |
| R-19 | Échanges, vide | Tout est trop collé : plus d'espace vertical. | 1 ✓ |
| R-20 | Échanges | Le panneau de « Reçues » est plus large que ceux d'« Envoyées » et « Nouvelle offre » : même largeur pour les trois. | 1 ✓ |
| R-21 | Clan, bandeau | Retirer « TON CLAN ». Sous le nom, la devise seule, un peu plus grande et plus détachée du nom. Le nombre de membres et l'entrée (libre ou non) passent à droite, au-dessus d'« Inviter » et des réglages, chacun avec son icône. | 1 ✓ |
| R-22 | Clan, objectif de la semaine | Incompréhensible pour un nouveau joueur (« 14 / 15 · 7 à toi », « À l'argent, un sachet bonus », « Encore 8 bonnes réponses… ») et expliqué nulle part : UX, UI et game design à reprendre. | 5 |
| R-23 | Clan, bibliothèque | Pouvoir l'ouvrir et voir le détail des cartes du clan, comme un album commun. | 5 |
| R-24 | Clan, membres | Une fenêtre avec la liste complète des membres, triable et filtrable. | 5 |
| R-25 | Sachet, à la souris | Survoler le haut du sachet (la bande « déchirer ici ») le déchire ; un clic rejoue ensuite l'animation depuis le début. | 4 |

**Relecture du lot 1 (2026-11-06).** Quatre points revenus, repris le jour même :

- Missions : les lignes n'étaient pas alignées (barre plus longue sur une mission faite). Toutes les missions partagent maintenant les mêmes colonnes : barre, compteur et boutons tombent au même endroit, faite ou non, sur le web comme sur l'app. Le « ? » passe dans le coin, le titre tient sur une ligne.
- Bulle d'aide (missions, clavier des défis) : texte blanc sur fond clair, et pas un vrai popover. Elle s'ouvre maintenant au-dessus de tout, avec une flèche vers son bouton, du côté où elle tient, en encre foncée ; le bouton du clavier est cerclé de crème pour se voir sur le tapis.
- Échanges : les trois onglets ont la même largeur et commencent à la même hauteur (vérifié à 390, 1 500 et 2 000 px).
- Page clan qui plante : l'erreur venait d'un état intermédiaire pendant les modifications, la page s'affiche (téléphone, grand écran, clan visité, app). L'écran d'erreur écrit désormais la cause dans la console, pour la retrouver si ça revient.

**Lot 2, fin de révision (2026-11-06).** Refaite sur le web et l'app, vérifiée à 390, 1 500 et 2 000 px et sur l'émulateur :

- R-14 : l'écran s'élargit (980 px de large sur le web, 7 cartes par ligne à 1 500 px). Le score, les étiquettes (XP, clan, jours joués), le gain, puis les mots arrivent l'un après l'autre en un peu plus d'une seconde, sans animation si le joueur les a coupées.
- R-15 : le sachet bonus s'affiche dans un encart de cuir rouge cerclé d'or vieilli, avec un filet doré et ses quatre losanges, le sachet dessiné dans un médaillon. Le même encart servira à la fin d'un sachet (montée de niveau) et aux autres gains dans la suite du lot.
- R-16 : quatre icônes dessinées (page blanche, esquisse, encre, dorure), sous chaque mot qui monte, dans l'album, sur la fiche d'une carte et dans « Ta mémoire ».
- R-18 : « Retour aux défis » devient le bouton principal quand la révision est finie ; quand il reste des mots à revoir, « Encore 10 questions » passe devant et le retour reste un vrai bouton juste à côté.

