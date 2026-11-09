# Recette des nouveautés

Ce qui a été construit du 4 au 6 novembre 2026, en deux parties :

- **Finitions hors du jeu** (FIN-01 à FIN-13) : le [cahier des finitions](cahiers-des-charges/finitions-hors-du-jeu.md) (accueil, icônes, images de partage, e-mails, cadres, emblèmes, fiches des stores), puis trois corrections du 5 novembre (écran Jouer sur petit téléphone, bilan du sachet, réglages de la révision). La plupart de ces tests renvoient à un test de la [recette du web](recette-web.md) ou de la [recette du mobile](recette-mobile.md) et disent ce qu'il faut y regarder ; les attendus complets restent dans le test cité.
- **Connexion avec Google** (GGL-01 à GGL-07), construite le 2026-11-08.
- **Joutes, lots 1 à 4** (JTE-01 à JTE-37 sur le web, MJT-01 à MJT-06 sur Android, PROD-01 à PROD-03 en production) : ce qu'on vérifie avant d'ouvrir les joutes aux testeurs, puis en production. Les règles sont en P91 ([regles-du-jeu.md](regles-du-jeu.md)), le cahier dans [joutes.md](cahiers-des-charges/joutes.md). Le lot 1 est construit depuis le 2026-11-05, web et mobile.

- **Mécène, lot 2** (MEC-01 à MEC-08), construit le 2026-11-08 : la page Mécène, le badge, les cosmétiques et l'admin, en mode test de Stripe. Le cahier est [mecene.md](cahiers-des-charges/mecene.md).

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

**Pour jouer seul, sans B ni C**, des bots tiennent lieu d'adversaires :

```bash
pnpm dev:bots <ton email> --challenge
```

Le script ouvre les joutes à ton compte et le monte au niveau 8 s'il est plus bas. Il crée quatre bots qui sont tes amis : Bot Étourdi, Bot Lettré, Bot Érudit et Bot Éclair, du plus faible au plus fort. Avec `--challenge`, chaque bot te lance une joute et joue sa manche, si bien que tu as quatre joutes à jouer. Tant que le script tourne, un bot joue sa manche quelques secondes après la tienne, que la joute soit amicale ou classée. Ctrl+C l'arrête. Une joute classée contre le même bot ne revient qu'au bout de 24 h, donc quatre joutes classées par jour au plus. Pour vérifier une règle entre deux humains (blocage, e-mail, courrier), il faut quand même B et C.

### Raccourcis en base locale

Certains tests des joutes demandent d'avancer le temps. Les commandes ci-dessous ne touchent que la base locale :

```bash
# Fait passer l'heure limite de toutes les joutes qui attendent leur second joueur
docker exec leximon-postgres-1 psql -U leximon -d leximon -c "update jousts set reply_by = now() - interval '1 minute' where ended_at is null and opponent_started_at is null and challenger_done_at is not null"

# Tournoi : met tes points de la semaine à 105, le plus haut possible en une semaine, de quoi finir premier de ton groupe même en Champion (après une première joute classée)
docker exec leximon-postgres-1 psql -U leximon -d leximon -c "update joust_group_members set points = 105, scored_at = now() where user_id = (select id from users where email = '<ton email>') and week = (select max(week) from joust_group_members where user_id = (select id from users where email = '<ton email>'))"

# Tournoi : met ton groupe de la semaine dans une autre ligue (remplace connetable par page, ecuyer, chevalier, banneret, marechal ou champion)
docker exec leximon-postgres-1 psql -U leximon -d leximon -c "update joust_groups set league = 'connetable' where id = (select group_id from joust_group_members where user_id = (select id from users where email = '<ton email>') order by week desc limit 1); update joust_group_members set league = 'connetable' where group_id = (select group_id from joust_group_members where user_id = (select id from users where email = '<ton email>') order by week desc limit 1)"

# Tournoi : recule toutes tes semaines de tournoi d'une semaine, récompenses comprises, comme si le tournoi venait de finir (à relancer autant de fois qu'il faut)
docker exec leximon-postgres-1 psql -U leximon -d leximon -c "update joust_groups set week = week - 1000 where id in (select group_id from joust_group_members where user_id = (select id from users where email = '<ton email>')); update joust_group_members set week = week - 1000 where group_id in (select group_id from joust_group_members where user_id = (select id from users where email = '<ton email>')); update joust_groups set week = week + 999 where id in (select group_id from joust_group_members where user_id = (select id from users where email = '<ton email>')); update joust_group_members set week = week + 999 where group_id in (select group_id from joust_group_members where user_id = (select id from users where email = '<ton email>')); update joust_week_rewards set week = week - 1000 where user_id = (select id from users where email = '<ton email>'); update joust_week_rewards set week = week + 999 where user_id = (select id from users where email = '<ton email>')"
```

Le tournoi va du lundi 0 h au dimanche minuit, heure de Paris ; la semaine 0 commence le lundi 2026-11-09, celle d'avant est la semaine « −1 ». Les raccourcis du tournoi visent ton dernier groupe : lance-les une fois la joute classée finie des deux côtés (le bot a joué sa manche), sinon c'est le groupe de la semaine d'avant qui change.

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

## Joutes · 2. L'accueil guidé et le deck

### JTE-04 · L'accueil guidé
- **Faire :** un compte qui n'a jamais joué de joute ouvre `/joutes`. Suivre les quatre temps : la lice, ton deck, l'entraînement, la première joute.
- **Attendu :**
  - Maître Furet accueille en plein écran, avec les quatre temps en haut et « Passer » à droite ;
  - la lice : tes vraies cartes et les siennes, deux par ligne, qui penchent vers l'autre côté, puis 15 s par mot, le plus de mots trouvés gagne, égalité au plus rapide ;
  - ton deck : 10 places vides, rien de posé d'avance, et la jauge des 25 points (voir JTE-05) ;
  - l'entraînement : 3 mots contre Maître Furet avec le vrai chrono, ses réponses dans le ruban du bas, puis le résultat révélé comme une vraie joute, sans gain ;
  - la première joute : ton avatar et 5 cartes de ton deck en éventail, « contre », un adversaire inconnu et 5 cartes face cachée ; « Trouver un adversaire » lance une joute classée, « Plus tard » mène à l'accueil des joutes.
  - Recharger la page ensuite : l'accueil guidé ne revient pas, ni sur le téléphone avec le même compte.
- **Retour :**

### JTE-05 · Composer son deck
- **Faire :** dans l'accueil guidé (ou « Modifier » depuis l'accueil des joutes), poser des cartes, en retirer, essayer de dépasser 25 points, puis 10 cartes. « Compléter pour moi » avec 3 cartes posées. Descendre sous 5 cartes, puis garder un deck de 7 cartes et recharger.
- **Attendu :** le deck et tes mots sont de vraies cartes ; tes mots sont rangés par rareté, la plus rare en haut, avec ce que coûte chaque rareté. Une carte posée reste dans la liste, pâlie avec une coche ; la toucher, ou la toucher dans le deck, la retire. La jauge suit chaque touche, et une phrase sous le deck dit ce qui reste (« Il te reste 12 points pour 6 places. Une carte Courante coûte 1 point, une Légendaire 6. ») ou pourquoi plus rien n'entre alors que des places sont vides. Au-delà de 25 points ou de 10 cartes, la carte n'entre pas et une phrase dit pourquoi. « Compléter pour moi » garde les 3 cartes et remplit les 7 places vides, avec des cartes aussi rares que les points le permettent. Sous 5 cartes, « Garder ce deck » est grisé ; « Garder ce deck » passe pour tout deck valide. Après le rechargement, le deck de 7 cartes est en éventail sur l'accueil.
- **Retour :**

### JTE-06 · Pas de joute sans deck
- **Faire :** un compte neuf passe le temps « Ton deck » sans garder de deck, finit l'accueil guidé. Puis un compte qui a moins de 5 mots en Esquisse ouvre `/joutes`.
- **Attendu :** le premier voit « Composer mon deck » à la place de « Joute classée », avec « Compose ton deck pour jouter : ce sont tes mots que tes adversaires devront trouver. ». Le second a ce bouton grisé, avec « Il te faut au moins 5 mots trouvés une fois pour faire un deck. Réponds à tes défis pour en trouver. »
- **Retour :**

### JTE-06b · Un testeur qui a déjà jouté
- **Faire :** un compte qui a joué des joutes avant cette version ouvre `/joutes`.
- **Attendu :** il voit l'accueil guidé une fois ; au temps « Ton deck », les places sont vides s'il n'a jamais gardé de deck (« Compléter pour moi » en refait un d'une touche), et son deck est posé s'il en a gardé un. S'il passe ce temps, sa prochaine joute garde le deck qu'il jouait.
- **Retour :**

### JTE-06c · La bulle « ? »
- **Faire :** sur l'accueil des joutes, toucher le « ? » en haut à droite, puis « Revoir l'accueil guidé ».
- **Attendu :** la règle en quatre lignes courtes, sans texte permanent sur l'écran. Le lien relance l'accueil guidé depuis la lice.
- **Retour :**

---

## Joutes · 3. Une joute entre amis

### JTE-07 · Lancer
- **Faire :** A clique « Défier un ami ». Regarder la liste, puis défier B.
- **Attendu :** « Joute classée » est le gros bouton, « Défier un ami » est à côté, plus petit. La liste montre les amis et les membres du clan qui peuvent jouter, avec avatar et pseudo. C n'y est pas. Un ami qui n'a pas le niveau ou l'accès n'y est pas non plus. Après « Défier », A arrive sur la joute : les deux avatars face à face, puis 3, 2, 1 (un toucher passe ce face-à-face).
- **Retour :**

### JTE-08 · Jouer sa partie
- **Faire :** A répond aux 5 questions : une juste, une fausse, et une laissée passer sans répondre. Puis « Voir le bilan ».
- **Attendu :**
  - la joute prend toute la largeur de la page ; en haut, le bandeau des deux joueurs (avatar, pseudo, score, une case par mot) et, au milieu, l'anneau du chrono, qui se vide, rougit et bat les 5 dernières secondes avec un tic, avec « Mot 1 sur 5 » dessous ;
  - la définition arrive sur une grande carte à deviner, retournée, aux couleurs de sa rareté, un « ? » à la place de la gravure et « Quel est ce mot ? » en pied ; 4 mots dessous ; un mot de la même famille que le mot cherché est remplacé dans la définition par une étiquette sombre « même famille » (jamais « … ») ;
  - après la réponse, la carte se retourne et montre la vraie carte du mot ;
  - une bonne réponse : le mot s'allume en vert, un éclat, un son, une vibration et un « +1 » qui s'envole ; une faute : la carte tremble, le choix passe en rouge et le bon mot s'allume en vert ;
  - la question laissée passer : « Le temps est écoulé : la question compte fausse. », puis la suivante ;
  - à la fin, le tampon « Partie jouée » ;
  - le bilan : les 5 cartes se retournent une à une, chacune marquée trouvée ou manquée avec son temps, le score se compte, la barre du niveau se remplit de 20 XP ; « Tes pièges » montre les 5 cartes du deck de A que B devra trouver ; « B a jusqu'à demain … On te prévient au courrier. » ; « Nouvelle joute » puis « Retour aux joutes ».
- **Retour :**

### JTE-09 · Reprendre après un rechargement
- **Faire :** lancer une nouvelle joute contre B. Pendant la question 2, recharger la page, puis « Reprendre la joute ».
- **Attendu :** après le face-à-face, la joute reprend à la question en cours, l'anneau là où il en était (le chrono a continué pendant le rechargement). Les questions déjà répondues ne reviennent pas ; leurs cases du ruban sont grises.
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
- **Attendu :** dans le bandeau du haut, le côté droit montre les réponses de A au même moment de sa partie, le côté gauche celles de B ; chaque côté a son score près de l'avatar.
- **Retour :**

### JTE-13 · Le résultat
- **Faire :** B finit sa partie et touche « Voir le résultat ». A ouvre sa lettre « Ta joute contre B est finie », puis `/joutes`.
- **Attendu :**
  - B voit la révélation tout de suite : les deux avatars, les questions retournées une à une sur deux colonnes avec le score qui monte de chaque côté, puis la bannière Victoire, Défaite ou Égalité (fanfare, éclats et vibration pour une victoire), les gains (XP, sachet), les cartes des deux parties (« Les mots de A », « Tes mots »), chacune marquée trouvée ou manquée, et « Ton mot … a piégé A. » ;
  - à égalité de bonnes réponses, le temps total départage ;
  - chez A, la joute est dans « Résultats à découvrir », scellée ; l'ouvrir casse le sceau et joue la même révélation de son côté ;
  - ensuite, la joute passe dans « Terminées » (« Victoire », « Classée · 3 à 2 ») et rouvrir la joute montre le résultat entier avec « Revoir », sur le web comme sur le téléphone.
- **Retour :**

### JTE-14 · La revanche
- **Faire :** sur le résultat, « Revanche ».
- **Attendu :** une nouvelle joute amicale s'ouvre, avec 5 nouvelles cartes tirées des decks.
- **Retour :**

---

## Joutes · 4. Une joute classée

### JTE-15 · Trouver un adversaire
- **Faire :** C ouvre le jeu (il doit être passé dans les 24 dernières heures). A clique « Trouver un adversaire ». Recommencer tout de suite.
- **Attendu :** la première fois, A tombe sur une joute contre B ou C : le jeu choisit parmi les joueurs proches de sa cote. Pas deux joutes classées contre le même adversaire en 24 h : la deuxième va vers l'autre joueur, ou s'arrête sur « Personne n'est disponible pour une joute classée en ce moment… » s'il n'y en a plus.
- **Retour :**

### JTE-16 · La cote reste cachée
- **Faire :** jouer une joute classée jusqu'au bout, puis ouvrir Classement depuis l'accueil des joutes.
- **Attendu :** aucune cote ne s'affiche, sauf en bas de Classement après 5 joutes classées : « Ta cote est de… ». Avant, « Ta cote se montre après 5 joutes classées. Encore N joutes. ». En base, `joust_ratings` a une ligne pour chacun des deux joueurs.
- **Retour :**

---

## Joutes · 4b. Tournois de la semaine, ligues et classements

Lot 3 bis, construit le 2026-11-07 : les tournois de la semaine remplacent les lauriers et les saisons. Les règles sont en P98, P91 et P51, le modèle dans [joutes-ligues.md](cahiers-des-charges/joutes-ligues.md), le calage dans [tournois.md](rnd/tournois.md). Les bots suffisent pour presque tout (`pnpm dev:bots <ton email> --challenge`) ; les raccourcis du tournoi sont dans « Préparer ».

### JTE-23 · L'en-tête de ligue
- **Faire :** ouvrir `/joutes` avant toute joute classée de la semaine.
- **Attendu :** en haut, un écu de papier marqué « I » et « Page », « Joue une joute classée pour entrer dans le tournoi de la semaine. », « Encore 5 joutes classées aujourd'hui », et le temps qui reste au tournoi (« Fin du tournoi dans N jours », « demain soir à minuit », « ce soir à minuit »). Un bouton « Classement » à côté de la bulle « ? ».
- **Retour :**

### JTE-24 · Les points d'une joute classée
- **Faire :** jouer une joute classée contre un bot et la gagner, puis une autre et la perdre. Puis une joute amicale.
- **Attendu :** à la révélation de la victoire, l'écu de ta ligue et « +3 points », puis « Ne de ton groupe, 3 points », en vert si ta place est dans la zone de montée, avec le bruit des pièces. La défaite affiche « Aucun point ». La joute amicale n'affiche aucun point. L'en-tête de `/joutes` dit « Ne sur 30 · 3 points » et « Si le tournoi finissait maintenant, tu monterais en Écuyer. » (ou resterais).
- **Retour :**

### JTE-25 · Cinq joutes classées par jour
- **Faire :** jouer des joutes classées jusqu'à en avoir 5 dans la journée, lancées ou reçues des bots.
- **Attendu :** l'en-tête compte « Encore N joutes classées aujourd'hui », jusqu'à « Tes joutes classées du jour sont jouées. Les joutes libres restent ouvertes. ». Le gros bouton devient « Joute libre ». « Nouvelle joute » sur une joute classée finie est refusé avec « Tu as joué tes 5 joutes classées du jour. Reviens demain, ou lance une joute libre. ».
- **Retour :**

### JTE-26 · La joute libre
- **Faire :** lancer une « Joute libre » et la jouer jusqu'au bout.
- **Attendu :** l'adversaire est choisi par le jeu (un bot), la liste marque la joute « Libre ». Elle donne ses XP comme les autres, mais aucun point ni place dans le tournoi, et la cote ne bouge pas. Sans joute classée dans la semaine, tu n'entres pas dans le tournoi.
- **Retour :**

### JTE-27 · Mon tournoi
- **Faire :** après une joute classée, ouvrir Classement.
- **Attendu :** l'onglet « Mon tournoi » s'ouvre : 30 lignes, toi surligné « (toi) », les autres places tenues par des automates (portrait gris, nom ancien, mention « automate »). « Zone de montée » au-dessus des premiers, un trait pointillé à la fin de cette zone ; en Page, pas de zone de descente. Sous la liste : « Ton groupe de la ligue Page. Les 10 premiers montent, personne ne descend. Les automates complètent les places libres. ». Plus tard dans la journée, les points des automates ont monté.
- **Retour :**

### JTE-28 · La fin de la semaine, en montant
- **Faire :** avec les raccourcis, mettre tes points à 105, puis reculer tes semaines de tournoi d'une semaine. Ouvrir `/joutes`, puis Classement. Réclamer. Recommencer avec la réserve de sachets bonus pleine.
- **Attendu :** l'en-tête est en Écuyer (écu vert « II ») et redemande une joute classée. Un point rouge sur « Classement ». En haut de Classement : « 10 écus et un sachet garni pour le tournoi de la semaine passée », « Tu as fini 1er de ton groupe en Page et tu passes en Écuyer. », « Réclamer » ; le toast « Tu reçois 10 écus et un sachet garni, rangé dans ta réserve. », le compteur d'écus monte. Réserve pleine, la récompense est refusée avec une phrase qui le dit, et elle attend.
- **Retour :**

### JTE-29 · La fin de la semaine, en descendant
- **Faire :** après une joute classée perdue, mettre ton groupe en Connétable, puis reculer tes semaines de tournoi d'une semaine. Ouvrir Classement.
- **Attendu :** en Connétable, ta place sans point était dans la « Zone de descente », en rouge. Après la fin : l'en-tête est en Maréchal (écu brun « V »), la récompense dit « 35 écus pour le tournoi de la semaine passée » et « … de ton groupe en Connétable et tu redescends en Maréchal. ».
- **Retour :**

### JTE-30 · Champion
- **Faire :** mettre ton groupe en Champion et tes points à 105, puis reculer tes semaines de tournoi d'une semaine.
- **Attendu :** en Champion, l'écu doré porte une couronne, l'emblème « Champion » s'affiche dans l'en-tête et dans les classements. Personne ne monte de Champion. Après la fin, premier du groupe : « 40 écus et un sachet garni Précieux pour le tournoi de la semaine passée », « Tu as fini 1er de ton groupe en Champion et tu restes en Champion. ».
- **Retour :**

### JTE-31 · L'échelle des ligues
- **Faire :** dans Classement, descendre jusqu'à « L'échelle des ligues ».
- **Attendu :** les 7 ligues de Champion à Page, chacune avec son écu, combien montent et descendent, et ses écus par semaine ; la tienne surlignée. Dessous, la règle en cinq phrases avec ses chiffres : 3 points la victoire, 5 joutes classées par jour, la fin du dimanche, les sachets des montées et du podium de Champion, les automates.
- **Retour :**

### JTE-32 · Amis, clan, général
- **Faire :** passer de « Mon tournoi » à « Amis » puis à « Clan ». Sur un compte sans clan, ouvrir « Clan ». Bloquer un joueur de ton groupe, puis rouvrir « Mon tournoi ».
- **Attendu :** Amis liste les amis entrés dans le tournoi de la semaine, toi compris, par ligue puis par points, places partagées à égalité. Sans clan : « Rejoins un clan pour voir le classement de ses jouteurs. ». L'onglet « Général » n'apparaît pas tant que 50 joueurs n'ont pas fait 5 joutes classées dans les 30 derniers jours. Le joueur bloqué garde sa place dans ton groupe sous « Jouteur », sans pseudo ni portrait, et disparaît des autres classements.
- **Retour :**

### JTE-33 · Sur un téléphone, en largeur
- **Faire :** ouvrir `/joutes` et Classement sur le web à 375 px de large.
- **Attendu :** rien ne dépasse ; les deux boutons de lancement tiennent ; dans l'échelle, la règle de montée passe sous le nom de la ligue ; les lignes du classement gardent place, nom et points.
- **Retour :**

---

## Joutes · 4c. Pièges et liste de souhaits

Lot 4, construit le 2026-11-07. Les règles sont en P91 et P77. Il faut deux comptes A et B, amis, ou A contre les bots.

### JTE-34 · Le compteur de pièges
- **Faire :** A défie B. B se trompe sur deux mots. Puis A ouvre `/joutes` et « Modifier » le deck.
- **Attendu :** sous « Ton deck », « Tes cartes ont piégé tes adversaires 2 fois. ». Les deux cartes qui ont piégé B portent un petit sceau rouge « 1 » (lu « 1 adversaire piégé » au lecteur d'écran), sur l'accueil comme dans l'éditeur. Une autre joute où B rate encore l'un des deux mots le fait passer à « 2 ». Une joute que B laisse sans réponse ne piège rien.
- **Retour :**

### JTE-35 · Les mots qui vont dans la liste
- **Faire :** jouer une joute où l'adversaire a dans son deck des mots que tu n'as pas (un compte récent contre un compte plus avancé). Regarder la révélation.
- **Attendu :** sous la ligne des pièges, « Les N mots que tu n'as pas vont dans ta liste de souhaits. » (« Le mot que tu n'as pas va… » pour un seul). Rien quand tu avais tous les mots, ni pendant l'entraînement contre Maître Furet.
- **Retour :**

### JTE-36 · Les mots que tu cherches
- **Faire :** ouvrir les échanges, onglet « Souhaits ». Toucher un mot de « Les mots que tu cherches », puis « Retirer » sur un autre. Obtenir un des mots (sachet ou échange) et revenir.
- **Attendu :** les mots vus en joute, du plus récent au plus ancien, chacun ouvre sa fiche. « Retirer » le fait partir de la liste, et il ne revient qu'à une prochaine joute où tu le croises. Un mot obtenu n'y est plus. Liste vide : « Ta liste est vide. Les mots que tu croises en joute sans les avoir y arrivent. ».
- **Retour :**

### JTE-37 · Ils cherchent tes doubles
- **Faire :** B a un mot en double que A cherche (JTE-35). B ouvre l'onglet « Souhaits » de ses échanges, puis « Proposer un échange ».
- **Attendu :** « Ils cherchent tes doubles » montre A, « A cherche un de tes doubles. », et seulement les mots que B peut lui échanger tout de suite, jamais le reste de la liste de A. « Proposer un échange » ouvre « Nouvelle offre » avec A déjà choisi. A doit avoir au moins un double à donner en retour, sinon il n'y est pas. Si A bloque B, ou B bloque A, A n'y est plus. Personne : « Personne ne cherche tes doubles pour l'instant… ».
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
- **Faire :** un compte neuf touche le bouton rond Joutes de l'écran Jouer et suit l'accueil guidé. Puis, sur l'accueil des joutes, « Modifier » le deck : ajouter et retirer des cartes, garder.
- **Attendu :** comme JTE-04 et JTE-05, l'entraînement contre Maître Furet compris. La feuille du deck monte du bas, défile jusqu'au bouton « Garder ce deck », et le compte des points suit chaque touche. Les cartes de la ligne du deck ouvrent leur fiche.
- **Retour :**

### MJT-02 · Une joute du téléphone au web
- **Faire :** A défie B depuis le téléphone et joue sa partie. B joue sur le web. A ouvre la lettre de fin dans le courrier du téléphone.
- **Attendu :** comme JTE-08 à JTE-13. Le chrono reste fluide. Une bonne réponse vibre une fois, une mauvaise deux fois. Les quatre choix restent lisibles et touchables sur un petit écran. La révélation vibre à la bannière et ses éclats restent fluides. La lettre mène aux joutes, la joute finie montre le résultat, « Revanche » et « Nouvelle joute ».
- **Retour :**

### MJT-03 · Sortir de l'app en pleine partie
- **Faire :** pendant une question, passer sur une autre app 10 secondes, puis revenir.
- **Attendu :** le chrono a continué : la question est perdue si son temps est passé, et la suivante arrive.
- **Retour :**

### MJT-04 · Réglage et mission
- **Faire :** Réglages, éteindre puis rallumer « Joutes ». Ouvrir les missions, « Y aller » sur « Joue une joute ».
- **Attendu :** le réglage tient après un relancement de l'app. « Y aller » ouvre les joutes.
- **Retour :**

### MJT-05 · Tournoi et classement
- **Faire :** sur le téléphone, ouvrir les joutes, puis « Classement ». Jouer une joute classée contre un bot et la gagner, puis une joute libre. Avec les raccourcis, finir une semaine (JTE-28).
- **Attendu :** comme JTE-23 à JTE-32 : l'en-tête de ligue en haut des joutes, « Joute libre » sous le bouton « Joute classée », le point rouge quand une récompense attend, « Réclamer », « Mon tournoi » avec ses automates et ses zones teintées, l'échelle des ligues, les onglets des classements. À la révélation, l'écu, « +3 points » et ta place dans le groupe.
- **Retour :**

### MJT-06 · Pièges et souhaits
- **Faire :** sur le téléphone, refaire JTE-34 à JTE-37 : le deck après une joute, la révélation, puis l'onglet « Souhaits » des échanges.
- **Attendu :** comme sur le web. Les sceaux restent lisibles sur les petites cartes du deck ; les cartes de la liste ouvrent leur fiche ; « Proposer un échange » ouvre la nouvelle offre avec le joueur choisi.
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
| Joutes classées par jour | 5, lancées ou reçues ; les joutes libres sans limite | |
| Points | 3 la victoire, 1 l'égalité, 0 la défaite | |
| Montées et descentes | de 10 montées en Page à 8 descentes en Champion (P98), calées par [la simulation](rnd/tournois.md) | |
| Points des automates | en moyenne 5 la semaine en Page, 20 en Écuyer, puis 10 de plus par ligue jusqu'à 70 en Champion | |
| Récompenses de la semaine | 10 à 40 écus selon la ligue, un sachet garni pour une montée, un sachet garni Précieux pour le podium de Champion | |
| Noms des ligues | Page, Écuyer, Chevalier, Banneret, Maréchal, Connétable, Champion | |

## Bannières du profil

Règle P99, web et app. Pour la recette, `pnpm dev:player <email> --level 30` donne les motifs des niveaux 15 et 30.

### BAN-01 · La bannière sur le profil

- Ton profil (`/profil`) et ta page publique (`/joueur/<pseudo>`) : en haut, une toile bordeaux unie à la place des rayures en diagonale. Sur l'app, la même toile en tête du profil, avec l'avatar à cheval sur son bord bas.
- Un profil privé montre toujours la toile unie bordeaux.

### BAN-02 · L'atelier : aperçu et essayage

- « Apparence » : la carte du profil (bannière, avatar dans son cadre, pseudo, niveau et titre) se tient à gauche sur grand écran et reste visible pendant qu'on fait défiler. Sur téléphone, elle est en haut.
- Les boutons « Apparence » du menu du joueur et du profil (et celui du profil sur l'app) portent aussi « Nouveau » : cliquer sur l'un l'enlève des deux.
- L'onglet « Bannières » porte une étiquette rouge « Nouveau » dans son coin, pour tout joueur, jusqu'à ce qu'il l'ouvre une fois sur cet appareil. Elle ne revient pas quand on recharge la page ou qu'on relance l'app.
- Toucher un avatar, un cadre, un titre, une teinte ou un motif le montre aussitôt sur la carte, sans rien enregistrer. Une barre apparaît en bas : « Tes changements ne sont pas encore enregistrés. », avec « Annuler » et « Enregistrer ». « Enregistrer » porte tout d'un coup (« Apparence enregistrée. ») ; « Annuler » remet la carte comme avant.
- Une pièce pas encore gagnée s'essaie aussi : elle s'entoure d'un pointillé doré, la carte porte « Essai », et la barre dit comment l'avoir (« Tu gagnes l'avatar Le Flûteau au niveau 40. D'ici là, tu peux seulement l'essayer. »). « Enregistrer » reste grisé.
- Quitter l'atelier sans enregistrer oublie les changements.

### BAN-03 · Acheter un motif en écus

- Choisir « Papier marbré » : la barre dit « Le motif Papier marbré coûte 250 écus. Achète-le pour le porter. » et son bouton devient « Acheter, 250 écus ».
- Le bouton ouvre une fenêtre avec l'aperçu, ton solde et ce qu'il te restera. Sans assez d'écus, le bouton est grisé et la fenêtre dit combien il manque.
- « Oui, l'acheter » : le son des pièces, les écus baissent, et tout le brouillon est enregistré avec le motif. Un invité ne peut pas acheter : il est invité à créer un compte.

### BAN-04 · L'image de partage

- Partager son profil : l'image montre la médaille à l'initiale posée sur ta bannière, dans son cadre doré.

## Connexion avec Google

D-057, [cahier](cahiers-des-charges/connexion-google.md). Web et Android ; l'iOS attend Apple. Avant tout, les étapes « La console Google » du cahier (§ 4) et les deux identifiants du client « Leximon local » dans `apps/api/.dev.vars` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), puis relancer l'API. Sans eux, le bouton n'apparaît pas. Prends une adresse Gmail qui n'a pas encore de compte, et une autre qui en a un par code.

### GGL-01 · Le bouton

- `/compte`, onglets « Créer un compte » et « Se connecter » : « Continuer avec Google » en haut du formulaire, blanc avec le « G » en couleurs, puis un trait « ou », puis l'adresse e-mail et « Recevoir un code ».
- Sans les identifiants dans `.dev.vars`, le bouton et le trait n'apparaissent pas.

### GGL-02 · Créer un compte avec Google

- Invité avec quelques cartes, onglet « Créer un compte », « Continuer avec Google » : une étape « Google ne nous transmet que ton adresse e-mail. », la tranche d'âge, « M'écrire quand il y a du nouveau » et « J'ai 15 ans ou plus ». Le bouton Google reste grisé tant que la case de l'âge n'est pas cochée. « Retour » ramène au formulaire.
- Cocher l'âge et les nouvelles, continuer : Google demande de choisir un compte, son écran ne parle que de l'adresse e-mail. Retour sur Jouer, « Bienvenue ! Ton compte est créé, tes cartes te suivent partout. », les cartes de l'invité sont là.
- `/compte` : « Connecté avec …@gmail.com par Google. », et « M'écrire quand il y a du nouveau » activé.

### GGL-03 · Se connecter avec Google

- Déconnecté, onglet « Se connecter », « Continuer avec Google » part tout de suite chez Google, sans étape d'âge.
- Avec l'adresse qui a un compte par code : retour sur Jouer avec « Ton compte Google est maintenant associé à ton compte. », connecté à ce compte et sa collection. La fois suivante, Google suffit, avec « Tu es connecté. ».
- Avec une adresse Gmail sans compte : retour sur `/compte`, onglet « Créer un compte », avec « Aucun compte n'utilise encore ce compte Google. Crée-le ici. » Aucun compte n'est créé.
- Annuler chez Google (flèche retour, ou « Annuler ») : retour sur `/compte`, sans message.

### GGL-04 · Un invité vers un compte qui joue déjà

- Invité avec des cartes, onglet « Se connecter », Google avec l'adresse qui a un compte et une collection : retour sur `/compte` avec « Tu vas perdre cette partie », « Si tu te connectes, les 3 cartes obtenues ici seront perdues. », « Garder ma partie » et « Perdre cette partie et me connecter ». Tu es toujours l'invité, avec ses cartes.
- « Garder ma partie » ramène au formulaire. « Perdre cette partie et me connecter » repasse par Google, puis connecte au compte, sans les cartes de l'invité.

### GGL-05 · Sur l'app Android

- Les mêmes tests que GGL-01 à GGL-04 et GGL-07 sur le téléphone. Google s'ouvre dans un onglet du navigateur par-dessus l'app, puis l'app revient seule, sans ouvrir une page en double.
- Fermer l'onglet sans choisir de compte : l'app reste sur le formulaire, sans message.
- Le bouton n'apparaît pas sur l'iPhone.

### GGL-07 · Associer Google à un compte

- Connecté avec un code, sans Google : `/compte` montre « Associer mon compte Google » sous « Connecté avec … ». Il disparaît une fois Google associé, et la ligne dit « par Google ».
- Choisir chez Google le compte de la même adresse : retour sur `/compte` avec « Ton compte Google est associé. Tu peux maintenant te connecter avec lui. ».
- Choisir un compte Google d'une autre adresse : « Ce compte Google n'a pas la même adresse que ton compte. Choisis celui de … ». Rien n'est associé.
- Annuler chez Google : retour sur `/compte`, sans message.

### GGL-06 · Tes données

- `/confidentialite`, « Compte de jeu » : un paragraphe dit ce que Google transmet (l'adresse et un identifiant) et ce qu'on ne garde pas (nom, photo, jetons).

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
6. Recycler au choix, trier par maîtrise, le passage de la main du chef : R-27, R-28, R-29.
7. La page Niveaux refaite : R-30.

| # | Écran | Retour | Lot |
|---|---|---|---|
| R-01 | Semaine de bienvenue | Le cuir vert de la fenêtre fait doublon avec le fond : autre texture, autre couleur (une texture neuve si besoin). | 3 ✓ |
| R-02 | Semaine de bienvenue, récompense | L'encart « Demain, le jour 2… t'offre un sachet garni » rend mal et ne fait pas jeu. | 2 ✓ |
| R-03 | Missions du jour | Retirer « Chaque mission rapporte 30 XP… » ; l'aide passe dans un bouton « ? » discret qui ouvre une bulle. | 1 ✓ |
| R-04 | Missions du jour | « Changer » plus discret, et une confirmation qui dit ce que fait le changement et qu'il n'y en a qu'un par jour. | 1 ✓ |
| R-05 | Missions du jour | Le titre d'une mission passe sur deux lignes à côté de son compteur. | 1 ✓ |
| R-06 | Fenêtre des écus | Illisible : un tableau visuel, chaque rareté avec son icône, une flèche et les écus gagnés. Montrer clairement à quoi servent les écus (le mot manquant). | 3 ✓ |
| R-07 | Fin d'un sachet | Faire respirer en hauteur : les trois boutons sont trop collés, « 25 / 539 (+5) » trop discret, « Ouvre une carte pour la lire. » sans doute de trop. | 2 ✓ |
| R-08 | Fin d'un sachet | La montée de niveau est moche et mal placée : un encart de gain enluminé (R-15), et moins de texte. | 2 ✓ |
| R-09 | Fenêtre « Tes sachets » | Mauvaise UX, désagréable à regarder : à refaire en visuel. | 3 ✓ |
| R-10 | Jouer, progression | « Au niveau 7, tu gagnes un sachet bonus » ne doit pas être une phrase complète. Le rond du sachet est ovale. | 1 ✓ |
| R-11 | Jouer, progression | L'icône du bouton « Ouvrir 1 coffret » est blanche sur jaune : invisible. | 1 ✓ |
| R-12 | Défis | L'aide du clavier (« 1 à 4 pour répondre… ») ne reste pas affichée tout le temps. | 1 ✓ |
| R-13 | Défis | Un effet au survol, même léger, sur les boutons de réponse. | 1 ✓ |
| R-14 | Fin de révision | Les informations arrivent une à une par une animation courte. L'écran est trop étroit : plus large. | 2 ✓ |
| R-15 | Gains, partout | « 1 sachet bonus gagné, rangé dans ta réserve. » ressort mal : une bordure d'enluminure et un fond texturé de couleur propre, repris pour tous les affichages de gains. | 2 ✓ |
| R-16 | Niveaux de maîtrise | Une icône dessinée avec soin pour chaque niveau (Esquisse…), sur la fin de révision et dans l'album partout où le niveau d'une carte se voit. | 2 ✓ |
| R-17 | Fin de révision | « +7 pour le clan » est à peine visible (couleur). | 1 ✓ |
| R-18 | Fin de révision | « Retour aux défis » plus visible, peut-être sans « Ouvrir un sachet ». | 2 ✓ |
| R-19 | Échanges, vide | Tout est trop collé : plus d'espace vertical. | 1 ✓ |
| R-20 | Échanges | Le panneau de « Reçues » est plus large que ceux d'« Envoyées » et « Nouvelle offre » : même largeur pour les trois. | 1 ✓ |
| R-21 | Clan, bandeau | Retirer « TON CLAN ». Sous le nom, la devise seule, un peu plus grande et plus détachée du nom. Le nombre de membres et l'entrée (libre ou non) passent à droite, au-dessus d'« Inviter » et des réglages, chacun avec son icône. | 1 ✓ |
| R-22 | Clan, objectif de la semaine | Incompréhensible pour un nouveau joueur (« 14 / 15 · 7 à toi », « À l'argent, un sachet bonus », « Encore 8 bonnes réponses… ») et expliqué nulle part : UX, UI et game design à reprendre. | 5 (cahier) |
| R-23 | Clan, bibliothèque | Pouvoir l'ouvrir et voir le détail des cartes du clan, comme un album commun. | 5 (cahier) |
| R-24 | Clan, membres | Une fenêtre avec la liste complète des membres, triable et filtrable. | 5 (cahier) |
| R-25 | Sachet, à la souris | Survoler le haut du sachet (la bande « déchirer ici ») le déchire ; un clic rejoue ensuite l'animation depuis le début. | 4 ✓ |
| R-26 | Fiche d'une carte | Toutes les fiches doivent avoir la même taille, sinon les flèches gauche et droite bougent d'une carte à l'autre. | 2 ✓ |
| R-27 | Écus, recycler | Le bouton ne doit pas recycler sans demander : on choisit les cartes à recycler, une ou plusieurs, avec tris et filtres pour choisir vite. | 6 ✓ |
| R-28 | Album, trier | Un tri par niveau de connaissance du mot (Dorure d'abord). | 6 ✓ |
| R-29 | Clan, chef | En local, le journal se remplit de « X prend la tête du clan », en alternance entre deux joueurs. | 6 ✓ |
| R-30 | Niveaux | Le visuel ne plaît pas du tout : la page est à refaire. | 7 ✓ |

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
- R-26 : la fenêtre d'une carte garde la même taille pour toutes les cartes (880 × 720 px au plus sur le web, 90 % de la hauteur sur téléphone). La carte et ses flèches ne bougent plus ; quand le texte est long, la feuille de droite défile dans son cadre. Vérifié en tournant huit cartes à 390, 1 500 et 2 000 px. Dans l'app, la fiche est une page entière, la carte reste en haut, les flèches ne bougent pas non plus.

**Lot 2, fin d'un sachet (2026-11-06).** Refaite sur le web et l'app, vérifiée à 390, 1 500 et 2 000 px et sur l'émulateur (montée de niveau réelle, du 12 au 13) :

- R-08 : la montée de niveau passe dans l'encart enluminé (le coffret dans le médaillon, « Niveau 13 », « Un coffret t'attend »). Une rareté complétée a le même encart, avec sa pierre. Ils arrivent une fois les cartes posées.
- R-07 : l'XP et la collection deviennent deux décomptes côte à côte, chacun avec son grand chiffre et sa barre ; la barre de la collection montre en vert les mots que le sachet vient d'ajouter, et « +5 » est une pastille verte. « Ouvre une carte pour la lire. » et la ligne de la semaine de bienvenue disparaissent. Plus d'air au-dessus des boutons et entre eux ; sur téléphone, les boutons sont l'un sous l'autre pour que chaque libellé tienne sur une ligne.
- Dans l'app, le tapis suit maintenant ce qu'il porte (les cartes restent lisibles, l'écran défile un peu après une montée de niveau) et le bouton principal est posé sur son bord, comme sur l'écran Jouer.

**Lot 2, semaine de bienvenue et autres gains (2026-11-06).** Web et app, vérifiés à 390, 1 500 et 2 000 px et sur l'émulateur :

- R-02 : sous un jour ouvert, l'encart « Demain, le jour 2… » laisse place à la frise des 7 jours. Le jour reçu y est coché ; la case de demain, plus grande, porte l'icône de son cadeau dans un anneau doré qui se soulève doucement, et « Demain » à la place de son numéro. La même frise reste seule, sans phrase, quand la case du jour est déjà prise. Seul le dernier jour garde sa phrase (le carnet prend le relais). Sur téléphone, les cases rétrécissent pour tenir sans se toucher ; dans l'app, la frise débordait à gauche et le titre était aligné à gauche, les deux sont corrigés.
- R-15, autres gains : après une réponse en défi, un niveau gagné et les sachets bonus du défi du jour ou de la Dorure passent dans l'encart enluminé, en petit, sous la ligne de la réponse (au-dessus du bouton sur téléphone). La réserve pleine reste une phrase, ce n'est pas un gain. Un mot qui monte de palier garde sa phrase, précédée de l'icône du palier : il revient à presque chaque première bonne réponse, un encart à chaque fois serait trop.

**Lot 3, les fenêtres (2026-11-06).** Web et app, vérifiés à 390, 1 500 et 2 000 px et sur l'émulateur :

- R-09 : « Tes sachets » montre les sachets au lieu de les raconter. Les sachets gratuits sont posés sur une planche des rayonnages, une place par sachet, les places vides en pointillés ; la prochaine se remplit d'or à mesure que son heure approche, avec « +1 dans 13 min » ou « Plein » en dessous. La réserve bonus suit sur sa propre planche, en sachets dorés, les garnis marqués de la pierre Rare. La règle de la réserve passe derrière un « ? ». En bas, les quatre façons d'en gagner, chacune avec son icône (coffrets de niveau, défi du jour, mots à la Dorure, objectifs de clan).
- R-06 : « Tes écus » donne le solde en grand, puis à quoi servent les écus en trois étapes dessinées (tes doubles, des écus, un mot qui te manque), puis un tableau rareté par rareté : la pierre et le nom, ce que rapporte un double (en vert, après une flèche) et ce que coûte un mot manquant, chacun avec l'écu. La règle du recyclage passe derrière un « ? ». Sur téléphone, la flèche des lignes disparaît pour que les chiffres tiennent.
- R-01 : la semaine de bienvenue a sa propre boîte, en toile de reliure bleu nuit tissée (une texture neuve, cuite comme le papier et le cuir) dans le même cadre d'or, avec des rayons plus discrets. Le coffret de niveau garde le cuir vert du tapis.

**Lot 4, le sachet à la souris (2026-11-06).** Web, vérifié à 390 et 1 500 px :

- R-25 : quand la souris passe sur la bande « déchirer ici », son bout gauche se soulève et se fend un peu, sans ouvrir le sachet ; il se recolle quand la souris s'en va. Un clic sur la bande joue toute la déchirure depuis le début, en un peu plus d'une demi-seconde, avec ses craquements, puis ouvre le sachet. Le glisser reste là : un glisser court se recolle, un glisser au-delà de 60 % de la bande ouvre. Sans animations, le clic ouvre tout de suite. Au doigt sur le web, un tap sur la bande déchire aussi tout. L'app, sans souris, garde le glisser et le tap sur le sachet.

**Lot 5, le cahier du clan (2026-11-06).** R-22 à R-24 sont dans [clan-lisible.md](cahiers-des-charges/clan-lisible.md), avec sa planche `/planches/clan` : l'objectif en route de quatre coffres avec une barre « Ta part » à part, la bibliothèque en album commun qui dit qui a chaque mot, les membres dans une fenêtre qu'on trie et qu'on filtre. Rien n'est codé avant les réponses aux questions C1 à C12.

**Lot 6, recycler au choix (2026-11-06).** Web et app, vérifiés à 390 et 1 500 px et sur l'émulateur :

- R-27 : « Recycler des doubles » (à la fin d'un sachet et dans la fenêtre des écus, que l'album ouvre aussi par son bouton des écus) ouvre une fenêtre avec toutes les cartes dont tu as un double (au milieu de l'écran sur le web, en feuille sur l'app). On cherche un mot, on trie (le plus de doubles, les plus rares, de A à Z) et on filtre par collection et par rareté. Une touche sur une ligne la coche : elle prend ce qui dépasse la carte et un double, ou un double s'il n'y en a qu'un. Les boutons − et + règlent le nombre, jusqu'à garder un seul exemplaire. « Garder un double » coche d'un coup, parmi les cartes affichées, ce qui dépasse la carte et un double, sans les Épiques ni les Légendaires ; « Tout cocher » coche tous les doubles des cartes affichées, en gardant un exemplaire de chacune, et « Tout décocher » les retire. Sur le web, la liste s'ouvre en fenêtre au milieu de l'écran. En bas, le bouton dit ce qu'il fait : « Recycler 7 doubles, +23 écus ». Une Épique ou une Légendaire cochée demande une confirmation qui la nomme. Les anciennes versions de l'app gardent le recyclage en une touche.
- R-28 : l'album a un quatrième tri, « Les mieux connues » : Dorure, Encre, Esquisse, puis les mots jamais révisés ; à niveau égal, le mot que la mémoire tient le plus longtemps d'abord.
- R-29 : un chef absent depuis 14 jours ne passe plus la main qu'à un adjoint ou un membre venu dans les 14 derniers jours ; si personne ne vient, il garde le rôle. Avant, deux absents se renvoyaient le rôle à chaque lecture de la page. Les lignes déjà écrites au journal de ta base locale restent.

**Lot 7, la page Niveaux (2026-11-06).** R-30 a d'abord eu sa planche `/planches/niveaux` (trois directions : A, la route ; B, la piste ; C, les coffrets). Le propriétaire a choisi A, faite le jour même sur le web et l'app, vérifiée à 390, 1 500 et 2 000 px et sur l'émulateur :

- En haut, la médaille du niveau dans un anneau vert qui se remplit avec l'XP, le titre porté, la barre « 765 / 870 XP » et « Encore 105 XP avant le niveau 18 ». Le « ? » à côté ouvre « D'où vient l'XP », chaque source avec son dessin. À droite (en dessous sur le téléphone), « Ouvrir un coffret » avec le nombre de coffrets qui attendent ; sans coffret, ce que donne le niveau suivant.
- Le chapitre est une route qui serpente sous un ruban à son nom : les niveaux ouverts sont des pièces dorées cochées, les coffrets à ouvrir des coffres qui sautillent, ton niveau la médaille qui brille, le suivant un anneau d'XP, la suite en gris. Chaque étape porte une étiquette : ce qu'elle débloque, sinon sa récompense (« Sachet garni et 4 autres » quand il y en a plus de deux). Les onglets en haut changent de chapitre.
- Toucher un coffre l'ouvre. Toucher une autre étape montre ce qu'elle donne : à droite de la route sur grand écran, dans une bulle sous l'étape sur le téléphone (au-dessus pour les dernières).
- « À débloquer » liste les parties du jeu encore fermées, avec leur niveau.
- Les coffrets s'ouvrent un par un ; « Tout ouvrir » est venu ensuite (plus bas).

Retour du propriétaire le même jour : la page ne doit plus défiler, et la route doit être plus belle. Fait sur le web et l'app, vérifié à 390, 1 500 et 2 000 px et sur l'émulateur :

- La page tient dans l'écran ; seule la route défile, dans un plateau creusé sous les onglets. Elle s'ouvre sur ton niveau (ou sur celui demandé par `#niveau-N`), et une bulle ouverte se place d'elle-même dans la vue.
- La route est en relief : bord sombre, lit de papier, pointillés au milieu ; la partie parcourue est pavée d'or et cloutée. Des objets de bibliothèque la bordent (livres, bougie, encrier, parchemin, livre ouvert), un fanion marque les niveaux qui débloquent quelque chose, et ton avatar se tient sur ta médaille, entouré de petites étoiles sur le web.
- Au bout de la route, un panneau mène au chapitre suivant ; fermé, il dit à quel niveau il s'ouvrira (« Tu le verras au niveau 21. »).
- Sur le téléphone, l'en-tête est resserré (anneau plus petit, bouton « Ouvrir un coffret » plus bas) et « À débloquer » passe sous la route, dans le plateau. Sur le web, le titre « Niveaux » disparaît sous 600 px : la barre du bas ramène au jeu.

« Tout ouvrir », demandé par le propriétaire le même jour, fait sur le web et l'app, vérifié à 390 et 1 500 px et sur l'émulateur :

- Dès que deux coffrets attendent, « Tout ouvrir » se tient à côté de « Ouvrir un coffret » en haut de la page Niveaux, et la fenêtre d'un coffret propose « Ouvrir les 9 coffrets » sous son bouton.
- Les coffrets s'ouvrent l'un après l'autre, du plus bas au plus haut (« Ouverture… 3 / 9 »), puis une seule fenêtre montre tout ce qu'ils ont donné, les récompenses pareilles comptées ensemble : « 5 sachets bonus », « 2 sachets garnis », chaque titre, avatar ou cadre à part.
- Si la réserve de sachets bonus se remplit en route, l'ouverture s'arrête et le dit : « Ta réserve de sachets bonus est pleine, donc 5 coffrets restent fermés. Ouvre un sachet bonus pour les récupérer. » Rien n'est perdu, les autres attendent.
- Côté serveur rien ne change : chaque coffret passe par la même réclamation qu'avant, une à la fois, ce qui garde les vieilles versions de l'app compatibles.

---

## Mécène · lot 2

Préparer : les clés de test de Stripe dans `apps/api/.dev.vars` et `stripe listen --forward-to localhost:8787/stripe/webhook` lancé ([mecene.md](cahiers-des-charges/mecene.md#11-stripe-pas-à-pas--toi), § 11). La vente reste fermée en local (`PATRON_SALES`) : passe ton compte admin (`pnpm admin:grant <email>`) pour acheter, ou lance l'API avec `--var PATRON_SALES:open`. Sans les clés, la page montre toujours la porte.

### MEC-01 · La porte, vente fermée
- **Faire :** ouvre `/mecene` avec un compte qui n'est pas admin.
- **Attendu :** ton avatar couronné en tête, « Bientôt » et « Devenir mécène », les trois avantages en tuiles illustrées (cosmétique du mois, un mot par trimestre, titre et badge), « Un mécène n'a ni sachet, ni XP, ni avantage aux échanges en plus. », les deux prix et « Préviens-moi ». Après le clic, « Noté. On te préviendra à l'ouverture des abonnements. »
- **Retour :**

### MEC-02 · L'offre
- **Faire :** ouvre `/mecene` en admin (ou vente ouverte), avec un compte qui n'a jamais été abonné ; puis avec un compte déclaré 15-17 ans ; puis en invité, vente ouverte.
- **Attendu :** la vitrine (avatar couronné, avantages en tuiles), puis les deux formules en grosses tuiles, « 3,99 € par mois » et « 29,99 € par an » avec le ruban « 2,50 € par mois », l'annuelle choisie d'avance ; la mention des 14 premiers jours gratuits, la case de renonciation non cochée, et « Devenir mécène » grisé tant qu'elle ne l'est pas. Le compte 15-17 ans voit en rouge « Tu as moins de 18 ans. Demande l'accord d'un parent avant de t'abonner. ». L'invité voit « Crée un compte pour t'abonner. » et « Créer mon compte » à la place de la case.
- **Retour :**

### MEC-03 · Payer
- **Faire :** coche la case, « Devenir mécène », paie avec la carte `4242 4242 4242 4242`.
- **Attendu :** la page de Stripe en français, avec l'essai de 14 jours. Au retour, les rayons dorés, la couronne qui tombe sur ton avatar, « Te voilà mécène ! » et le badge, puis trois étapes : « Aujourd'hui » le titre et le badge, la date de fin d'essai avec « Premier paiement de 3,99 € », et « Dès ce paiement » le cosmétique du mois et le droit de dénicher un mot (ces deux-là cadenassés). Dessous, « Tu peux résilier en un clic avant le …, sans rien payer. ». « Porter mon titre » n'apparaît que si tu portes un autre titre ; il met le titre Mécène et dit « Tu portes le titre Mécène. ». « Voir mon abonnement » mène à ta carte de mécène : avatar couronné, nom, badge, « Essai gratuit en cours » et la date du premier paiement. Si le webhook tarde, la page attend une dizaine de secondes, puis dit « Ton paiement est en cours de confirmation. » sans parler d'échec.
- **Retour :**

### MEC-04 · Le badge
- **Faire :** regarde ton profil, ton profil public (`/joueur/<pseudo>`) et la liste des joueurs ; dans l'atelier, l'onglet Titres.
- **Attendu :** le badge doré « Mécène » à côté du code joueur, une couronne seule dans la liste, « Ce mécène fait vivre Leximon. » au survol. Le titre « Mécène » se choisit dans l'atelier. Un fondateur a le badge rouge « Mécène fondateur ».
- **Retour :**

### MEC-05 · Gérer, résilier, reprendre
- **Faire :** « Gérer mon abonnement », résilie dans le portail de Stripe, reviens, puis « Reprendre mon abonnement ».
- **Attendu :** le portail s'ouvre. Résilié, la page dit « Ton essai s'arrête le …, sans aucun paiement. » (ou, après un paiement, « Ton abonnement s'arrête le …. Tes cosmétiques restent à toi. ») et le bouton devient « Reprendre mon abonnement ».
- **Retour :**

### MEC-06 · Fin d'essai et paiement refusé
- **Faire :** avec une horloge de test de Stripe, avance après la fin de l'essai ; puis recommence avec la carte `4000 0000 0000 0341` (refusée au paiement).
- **Attendu :** après le paiement, « Mécène depuis novembre 2026 » et le prochain paiement. Avec la carte refusée, « Ton dernier paiement n'est pas passé. Mets à jour ta carte pour rester mécène. » en rouge, le badge restant là tant que Stripe réessaie.
- **Retour :**

### MEC-07 · Le cosmétique du mois
- **Faire :** mets un cosmétique au mois en cours dans `PATRON_SCHEDULE` (`packages/core/src/rules.ts`, par exemple `cosmetics: { "2026-11": { kind: "frame", frame: "wax" } }`), puis ouvre `/mecene` en abonné qui a payé, et en joueur qui ne l'est pas.
- **Attendu :** le non-abonné lit « Ce mois-ci, les mécènes reçoivent le cadre Sceau de cire. ». Ton avatar en tête de la vitrine porte le cadre du mois. L'abonné voit sous sa carte un coffret qui sautille, « À réclamer » avec « Le cadre Sceau de cire, novembre 2026 » et « Réclamer » ; après, « Ajouté à ton apparence. » et le cadre dans l'atelier. Pendant l'essai, rien à réclamer. Remets le calendrier vide ensuite.
- **Retour :**

### MEC-08 · L'admin et le téléphone
- **Faire :** ouvre `/admin/mecenes`, puis « Rembourser et résilier » sur ton abonnement de test. Sur le téléphone, ouvre ton profil avec et sans badge.
- **Attendu :** les chiffres (mécènes, essais, résiliés, paiements refusés, fondateurs, revenu par mois) et la liste. Le remboursement demande une confirmation qui dit le montant, puis « Abonnement arrêté et 3,99 € remboursés. » ; le journal le note. Sur le téléphone, le badge s'affiche comme sur le web ; « Ton abonnement mécène » n'apparaît dans le profil qu'avec le badge, et sa page montre la même carte de mécène que le web (avatar couronné, nom, badge, statut) et le coffret à réclamer, puis dit « Ton abonnement se gère depuis ton compte sur leximon.fr. », sans lien ni prix.
- **Retour :**

## Mécène · lot 3, dénicher un mot

Préparer : `pnpm db:migrate`, puis `pnpm reserve:publish` (charge `content/reserve/reserve.json`). Un abonné annuel a un mot à dénicher dès son paiement ; un mensuel, après trois mois payés (avec une horloge de test de Stripe). Il faut un pseudo.

### MEC-09 · Ton mot dans le jeu
- **Faire :** ouvre `/mecene` en abonné annuel qui a payé, puis en abonné mensuel, puis pendant un essai.
- **Attendu :** sous ta carte de mécène, « Ton mot dans le jeu ». L'annuel lit « Tu peux dénicher un mot. » et le bouton « Dénicher un mot » ; le mensuel et l'essai lisent « Tu n'as pas de mot à dénicher pour l'instant. » et « Un mot par trimestre d'abonnement, dès le premier paiement pour un abonnement annuel. ». Le menu du joueur dit « Mon abonnement mécène » au lieu de « Devenir mécène ».
- **Retour :**

### MEC-10 · Chercher et dénicher
- **Faire :** « Dénicher un mot », tape « ebau », choisis « ébaucheur », puis « Dénicher ce mot ». Recommence sur le téléphone (profil, « Ton abonnement mécène »).
- **Attendu :** la liste suit la frappe, sans tenir compte des accents ; chaque mot a sa nature et sa définition du Littré, jamais sa rareté. « Dénicher » demande une confirmation en rouge (« Ce choix est définitif… »). Après, le mot en grand et « « ébaucheur » est à toi. Il paraîtra avec sa collection, signé de ton pseudo. ». De retour sur la page Mécène, le mot est listé, « Il paraîtra avec sa collection. », et les boutons « Dénicher » ont disparu de la recherche.
- **Retour :**

### MEC-11 · Deux mécènes, un mot
- **Faire :** avec deux comptes mécènes, ouvre la recherche sur le même mot, et confirme sur l'un puis sur l'autre. Puis, avec un compte sans pseudo, essaie de dénicher.
- **Attendu :** le second lit « Ce mot vient d'être déniché par un autre mécène. ». Sans pseudo : « Choisis d'abord un pseudo dans ton profil : il signera ta carte. ».
- **Retour :**

### MEC-12 · Parution et mot écarté
- **Faire :** `pnpm finds:export`, puis une série de la chaîne avec `select` ; publie une version qui contient le mot (`catalog:publish`). Pour un autre mot, `pnpm finds:reject <id>`.
- **Attendu :** `select` annonce le mot déniché en tête. Après la publication, la page Mécène dit « Paru, avec ton pseudo sur la carte. », la fiche de la carte montre « Déniché par [pseudo] » (web et téléphone, pour tous les joueurs), et le mécène a un exemplaire de plus, sans XP ni échange possible. Le mot écarté dit « Écarté au contrôle de qualité. Ton droit de dénicher t'est rendu. » et le droit revient.
- **Retour :**

## Mécène · éditions de bibliothèque et épingles

Préparer : `pnpm db:migrate`, un compte mécène qui a payé au moins une fois (horloge de test de Stripe) et qui possède quelques cartes.

### MEC-13 · Éditions de bibliothèque
- **Faire :** ouvre la fiche d'une carte de ton album, choisis « Sanguine », puis « Lavis » et « Appliquer à tout l'album ». Ouvre ton profil public depuis un autre compte. Recommence sur le téléphone. Puis ouvre la fiche avec un compte sans abonnement, et pendant un essai.
- **Attendu :** sous l'origine du mot, « Édition de bibliothèque » avec « Ordinaire », « Sanguine », « Lavis » et « Encre de Chine ». La gravure passe sur une feuille collée, aux couleurs de l'édition ; le cadre, la gemme et le mot gardent la couleur de la rareté. Après « Appliquer à tout l'album », le message « Tout ton album est imprimé au lavis. » et toutes les cartes de l'album changent. L'autre compte voit tes cartes épinglées dans leur édition. La page Mécène dit « Tu possèdes la sanguine, le lavis et l'encre de Chine. ». Sans abonnement ou pendant l'essai, rien n'apparaît sur la fiche. Après l'arrêt de l'abonnement, les éditions restent.
- **Retour :**

### MEC-14 · Trois cartes épinglées de plus
- **Faire :** regarde le nombre de places d'épingles de ton profil avant l'abonnement, pendant l'essai, après le premier paiement, puis après l'arrêt.
- **Attendu :** trois places de plus après le premier paiement, aucune pendant l'essai. À l'arrêt, les places en plus disparaissent et seules les premières cartes épinglées restent visibles.
- **Retour :**

### MEC-15 · Cabinet du mot
- **Préparer :** en local, `uv run python -m leximon_content ngram` (une fois), puis `cabinet` dans `content/pipeline`, puis `pnpm catalog:publish`.
- **Faire :** ouvre la fiche d'une carte pendant l'essai, après le premier paiement, puis après l'arrêt. Une fois abonné, touche « Ouvrir le cabinet du mot », sur le web (grand écran et téléphone) et sur le mobile. Essaie renfler, forlancer et cassandre.
- **Attendu :** le bouton n'apparaît qu'aux mécènes qui paient, ni pendant l'essai ni après l'arrêt ; l'adresse `/mecene/cabinet/<carte>` montre alors « Le cabinet du mot est réservé aux mécènes abonnés. ». Le cabinet montre la courbe d'usage depuis 1800 avec une phrase qui la lit (renfler : « Dès 1800, le mot est à son plus haut, puis se raréfie après 1980. »), la décennie pointée ou touchée avec son chiffre, l'article du Littré (sens numérotés, citations, étymologie, historique par siècle), la famille du mot (forlancer : vient de fors, de la même famille que forlonger, formuer…) dont les mots du jeu ouvrent leur carte, et la ligne des sources.
- **Retour :**

### MEC-16 · Page des mécènes
- **Faire :** ouvre `/mecenes` sans être connecté, puis abonne-toi avec un compte au profil public et rouvre la page. Sur la page Mécène, touche « Ne pas me citer », puis « Me citer à nouveau ». Recommence sur le mobile, depuis l'écran Mécène.
- **Attendu :** la page remercie sans rien vendre (ni prix, ni bouton, ni lien vers l'offre). Elle liste les mécènes qui paient et dont le profil est public, les fondateurs d'abord avec leur sceau, puis par date du premier paiement ; chaque pseudo ouvre son profil. Ni l'essai, ni un profil privé, ni un compte suspendu n'y figurent. « Ne pas me citer » retire le pseudo (la page se met à jour en cinq minutes au plus), « Me citer à nouveau » le remet. Sans mécène, la page dit « Aucun mécène ne figure encore sur cette page. ».
- **Retour :**

### MEC-17 · Vote des mécènes
- **Faire :** dans `/admin/mecenes`, ouvre un vote avec trois thèmes (nom et ce que la collection contiendrait), puis essaie d'en ouvrir un second. Sur la page Mécène, vote avec un compte qui a payé, change ta voix, puis regarde la même page avec un compte en essai. Recommence sur le mobile. Pour voir le résultat sans attendre une semaine, ferme le vote en base locale (`update patron_polls set closes_at = now()`).
- **Attendu :** le vote s'ouvre pour sept jours ; le second est refusé tant que le premier est ouvert. La page Mécène montre les trois thèmes et la date de fermeture ; « Voter pour ce thème » met « Ta voix » sur le thème choisi, et un autre choix la déplace. L'essai voit les thèmes sans bouton, avec « Ta voix comptera après ton premier paiement. ». Aucun compte de voix tant que le vote est ouvert. Une fois fermé, chaque thème montre ses voix, le gagnant est mis en avant et la page dit « La prochaine collection aura pour thème « … ». » (ou l'égalité). L'admin montre les voix de chaque vote, ouvert ou fermé, et le journal note l'ouverture.
- **Retour :**

### MEC-18 · Salon des mécènes sur Discord
- **Faire :** une fois les réglages posés (cahier des avantages, § 4), touche « Relier mon Discord » sur la page Mécène avec un compte qui a payé, accepte sur la page de Discord, puis regarde le serveur. Touche ensuite « Délier mon Discord ». Recommence sur le mobile. Avec un compte en essai, regarde le bloc.
- **Attendu :** Discord demande de connaître le compte et de rejoindre le serveur. Au retour, la page Mécène dit « Ton compte Discord est relié. Le rôle Mécène arrive dans une minute. » et nomme le compte relié ; le compte est sur le serveur, avec le rôle « Mécène » et l'accès au salon réservé. Délier retire le rôle. Une résiliation qui prend effet, ou la suppression du compte, retire aussi le rôle. L'essai lit « Le salon réservé sur Discord s'ouvre après ton premier paiement. », sans bouton. Un refus sur la page de Discord ramène sur la page Mécène avec « La liaison avec Discord n'a pas abouti. Réessaie. ».
- **Retour :**

### MEC-19 · Sceau de cire du sachet
- **Faire :** avec un compte qui a payé, ouvre un sachet sur Jouer, sur le web puis sur le mobile. Recommence avec un compte en essai, puis avec un ancien mécène fondateur dont l'abonnement est arrêté.
- **Attendu :** le sachet du mécène payant porte un sceau de cire rouge à la couronne, à cheval sur la ligne de déchirure. À l'ouverture, il se fend en deux et ses moitiés tombent pendant que la bande s'envole ; l'ouverture dure le même temps et les cartes se révèlent comme d'habitude. L'essai et l'ancien fondateur ont le sachet ordinaire. Avec « réduire les animations », le sceau disparaît sans tomber.
- **Retour :**

### MEC-20 · Courrier du dénichage
- **Faire :** déniche deux mots avec un compte mécène. Publie un catalogue qui contient le premier (`pnpm catalog:publish`), et écarte le second (`pnpm finds:reject <id>`). Ouvre le courrier sur le web puis sur le mobile, et touche chaque lettre.
- **Attendu :** deux lettres, à la couronne : « « mot » est paru, signé de ton pseudo » (Ton mot dans le jeu) et « « mot » n'a pas passé le contrôle » (Ton droit de dénicher t'est rendu). Chacune mène à la page Mécène. Publier ou écarter une seconde fois n'écrit pas de lettre de plus.
- **Retour :**

## Mauvais choix des QCM

Retour de bêta du 2026-10-31 : on trouvait la réponse par élimination (un verbe parmi des noms, un mot sans rapport avec le thème révisé). La nature des cartes vient de la publication du catalogue : en production, la colonne reste vide tant qu'une publication n'est pas passée, et les choix restent ceux d'avant.

### QCM-01 · Même nature
- **Faire :** lance plusieurs révisions et un défi du jour, et regarde les choix des questions sur un verbe (« trouver le mot » et « trouver la définition »).
- **Attendu :** quatre verbes (infinitifs en -er, -ir…) ou quatre définitions qui commencent par un verbe. Un nom n'a que des noms autour de lui, un adjectif que des adjectifs.
- **Retour :**

### QCM-02 · Révision d'un thème
- **Faire :** au niveau 3 au moins, révise un thème (Religion, Cuisine…), en Normal puis en Exigeant.
- **Attendu :** les mauvais choix sont des mots du thème, de la même nature que le mot demandé, possédés ou non.
- **Retour :**

### QCM-03 · Joutes
- **Faire :** joue une joute dont un mot du deck adverse est un verbe ou un adjectif.
- **Attendu :** les quatre mots proposés sont de la même nature, même si la rareté ou la collection doit changer pour cela.
- **Retour :**
