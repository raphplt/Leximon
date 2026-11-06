# Recette des finitions hors du jeu

Ce qui a été construit les 4 et 5 novembre 2026 : le [cahier des finitions](cahiers-des-charges/finitions-hors-du-jeu.md) (accueil, icônes, images de partage, e-mails, cadres, emblèmes, fiches des stores), puis trois corrections du 5 novembre (écran Jouer sur petit téléphone, bilan du sachet, réglages de la révision).

La plupart des tests existent déjà dans la [recette du web](recette-web.md) et la [recette du mobile](recette-mobile.md) : ce fichier dit dans quel ordre les passer et ce qu'il faut y regarder pour ces lots. Les attendus complets restent dans le test cité. Les tests propres à ce fichier sont ceux qu'aucune recette ne couvre : les e-mails reçus pour de vrai, les fiches des stores, les petits écrans.

Note ton retour sous **Retour** (« OK », ou ce qui cloche), ici ou dans le test cité.

## 0. Préparer

- Lancer le projet comme dans la [recette du web](recette-web.md#0-préparer) et la [recette du mobile](recette-mobile.md#0-préparer). Le web doit répondre sur le port 3000 : si un autre projet l'occupe, l'arrêter d'abord.
- Comptes : A sur le web, B sur le téléphone, une fenêtre privée pour l'invité.
- Pour le bilan d'un sachet, il faut des sachets : `/admin/joueurs`, fiche de B, « Offrir des plis bonus ».
- **Sans petit téléphone sous la main**, l'émulateur Android prend n'importe quel format. Une fois l'app ouverte :

```bash
adb shell wm size 1080x1920
```

Puis fermer l'app (`adb shell am force-stop fr.leximon.app`) et la rouvrir, sinon elle garde l'ancienne mise en page. `adb shell wm size reset` remet l'écran d'origine.

---

## 1. Accueil

### FIN-01 · L'accueil du site
- **Faire :** [PUB-01](recette-web.md#pub-01--page-daccueil) en grand écran et en 375 × 812, puis [PUB-02](recette-web.md#pub-02--liste-dattente) avec la bêta fermée.
- **Regarder surtout :** le sachet qu'on déchire sans compte au premier écran, et le bouton à portée du pouce sur téléphone.
- **Retour :**

### FIN-02 · Le premier écran de l'app sans invitation
- **Faire :** [CPT-04](recette-mobile.md#cpt-04--premier-lancement-sans-invitation).
- **Regarder surtout :** c'est le même premier écran que le site. Le sachet se déchire sans compte.
- **Retour :**

## 2. Icônes et images de partage

### FIN-03 · Icône, favicon et écran de lancement
- **Faire :** [PUB-04](recette-web.md#pub-04--image-de-partage) pour l'onglet du navigateur et le raccourci sur iPhone, puis [COQ-01](recette-mobile.md#coq-01--lancement) sur le téléphone. La nouvelle icône de l'app ne se voit qu'après un nouveau build.
- **Regarder surtout :** le sceau de cire au L sur le cuir vert, jamais rogné, lisible en tout petit dans l'onglet, sur fond clair comme sur fond sombre.
- **Retour :**

### FIN-04 · Images de partage
- **Faire :** [PUB-04](recette-web.md#pub-04--image-de-partage) en local. Une fois en ligne, coller un lien de carte et un lien de profil dans Discord et dans WhatsApp.
- **Attendu :** l'aperçu montre la carte posée sur le sous-main, le mot lisible même en petit. Une carte n'a pas sa gravure dans l'image : c'est voulu, elle porte l'initiale sur les hachures.
- **Retour :**

## 3. E-mails

### FIN-05 · L'aperçu d'une campagne
- **Faire :** [CAM-01](recette-web.md#cam-01--brouillon-et-aperçu).
- **Retour :**

### FIN-06 · Un vrai e-mail reçu
En local, aucun e-mail ne part : ce test se fait une fois le site en ligne.
- **Faire :** se connecter sur leximon.fr avec une adresse Gmail, puis lire le code dans Gmail sur ordinateur, dans l'app Gmail du téléphone, et en mode sombre. Si un rappel ou une nouvelle arrive, le regarder aussi.
- **Attendu :** une feuille crème sur le bois sombre, « Leximon » en brun avec un filet doré dessous. Le code est dans un encadré beige. Un bouton est en or, cerné d'encre, avec son épaisseur dessous. En bas, sur le bois, le lien du site, et « Se désabonner » sur un rappel ou une nouvelle. Aucune image à télécharger. Gmail en mode sombre peut foncer la feuille : le texte doit rester lisible.
- **Retour :**

## 4. Cadres d'avatar et emblèmes de clan

### FIN-07 · Les 13 cadres
- **Faire :** [PRO-06](recette-web.md#pro-06--atelier) sur le web, avec un compte au niveau 200 (`pnpm dev:player <email> --level 200`) pour tous les avoir, puis [MPR-01](recette-mobile.md#mpr-01--profil-et-atelier) sur le téléphone.
- **Regarder surtout :** chaque cadre en grand dans l'atelier, puis en petit dans la barre du haut et dans une liste (amis, membres du clan). Les gouttes d'encre, les perles, la dentelle et les rayons débordent du rond sans toucher le texte autour. Seuls les rayons du soleil royal tournent, et sur le web seulement ; ils restent immobiles avec « réduire les animations » activé dans le système.
- **Retour :**

### FIN-08 · Les emblèmes
- **Faire :** [CLA-03](recette-web.md#cla-03--créer-un-clan) : essayer plusieurs gravures et paires de couleurs, puis ouvrir le même clan sur le téléphone.
- **Attendu :** le bouclier est cerclé d'or comme les boutons du jeu, avec son épaisseur dessous. Le champ est plus clair en haut. Les couleurs vont avec la salle, et la gravure reste lisible sur chacune. Le web et le téléphone montrent le même bouclier.
- **Retour :**

## 5. Fiches des stores

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

## 6. Petits écrans et réglages

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
