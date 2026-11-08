# Cahier des charges · Connexion avec Google

- **Statut :** tranché le 2026-11-08 : le propriétaire retient toutes les recommandations du § 8 (D-057).
- **Règles concernées :** P37 (l'inscription transfère la partie de l'invité, « code, Apple, Google »), P54 (invité qui se connecte à un compte qui joue déjà), P61 (nouvelles par e-mail), dans [regles-du-jeu.md](../regles-du-jeu.md), qui fait foi.
- **D'où ça vient :** le propriétaire veut un bouton « Continuer avec Google » à côté du code par e-mail. La bêta s'ouvre à tous le 2026-11-09.
- **Objectif :** créer son compte ou se connecter en deux gestes, sans attendre un e-mail. Chaque inscription par Google est aussi un code de moins à envoyer, alors que le quota d'envoi est la première limite de la bêta ouverte.

## Ce qui existe

- **Better Auth 1.7.11** côté API (`apps/api/src/auth.ts`), avec les plugins `anonymous` (l'invité), `emailOTP` (le code à 6 chiffres), `admin` (rôle et bannissement) et `expo` (la session du mobile, gardée dans le trousseau). Cette version sait faire Google, sans nouvelle dépendance : le fournisseur `google`, `requestSignUp`, `disableImplicitSignUp`, les données jointes au voyage (`additionalData`, relues au retour par `getOAuthState`), et le rattachement de comptes.
- **Le passage invité → compte** (`onLinkAccount`, `link-on-sign-in.ts`) se déclenche à toute connexion faite avec une session d'invité, Google compris. Il déplace la partie de l'invité vers un nouveau compte, ou l'abandonne si le compte joue déjà (P54) et que le joueur l'a accepté (`acceptGuestLoss`).
- **Le code par e-mail** montre ce qui va se passer avant de connecter (`/link-preview` : transfert, partie perdue, compte existant), puis demande « J'ai 15 ans ou plus » quand un compte se crée.
- **On ne garde que l'adresse** : ni nom ni photo, quoi que le client envoie (`databaseHooks.user.create.before`).
- **L'arrivée** (invitation, lien d'ami, `?src=`) est lue dans des en-têtes que le client envoie avec la requête qui crée le joueur.
- **L'écran Compte** propose « Créer un compte » ou « Se connecter » (le choix est gardé dans l'adresse : `/compte?connexion`), sur le web et le mobile.
- **Le mobile** a déjà `expo-web-browser` et le schéma `leximon://`.

## 1. Ce que voit le joueur

- **Un bouton « Continuer avec Google »** en haut du formulaire, dans les deux onglets, puis un trait « ou », puis l'adresse e-mail et « Recevoir un code ». Le bouton suit les règles de marque de Google (le « G » en couleurs, sur fond blanc, avec le texte « Continuer avec Google ») : c'est exigé pour que Google valide l'écran d'accord.
- **Onglet « Créer un compte » :** un clic sur Google ouvre d'abord une petite fenêtre « J'ai 15 ans ou plus », avec la tranche d'âge facultative et « M'écrire quand il y a du nouveau ». « Continuer » part ensuite chez Google. L'âge ne se demande qu'ici, comme pour le code (§ 8, Q4).
- **Onglet « Se connecter » :** un clic part tout de suite chez Google.
- **Retour de Google :**
  - le compte existe, ou vient d'être créé, et rien de l'invité n'est perdu : retour au jeu (`/jouer`), « Tu es connecté. » ;
  - « Se connecter » avec un Google qui n'a pas de compte : retour sur `/compte`, onglet « Créer un compte », avec « Aucun compte n'utilise encore ce compte Google. Crée-le ici. » (Q5) ;
  - l'invité a des cartes et le compte joue déjà (P54) : retour sur `/compte` avec l'avertissement du code (« Si tu te connectes, les 12 cartes obtenues ici seront perdues. ») et le bouton « Perdre cette partie et me connecter », qui repart chez Google en disant que la perte est acceptée (Q8) ;
  - le joueur a annulé chez Google : retour sur `/compte`, sans message d'erreur ;
  - compte suspendu, ou autre échec : retour sur `/compte` avec une phrase claire.
- **Page du joueur connecté :** « Connecté avec raphael@gmail.com », et « par Google » quand c'est sa façon d'entrer.

## 2. Règles

- **Un compte, plusieurs façons d'entrer.** Une adresse Gmail qui a déjà un compte par code retrouve ce compte en passant par Google : Google a vérifié l'adresse, et c'est le même joueur (Q3).
- **L'invité suit comme avec le code** (P37, P54) : vers un nouveau compte, tout passe ; vers un compte qui joue déjà, rien n'est fusionné, et la perte se confirme.
- **Seule l'adresse est gardée** (Q6) : on demande à Google `openid` et `email`, ni nom ni photo. Les jetons de Google ne servent à rien après la connexion : ils ne sont pas gardés.
- **Les nouvelles par e-mail** (P61) : la case se coche dans la fenêtre d'âge, décochée par défaut, et se date comme à l'inscription par code.
- **L'arrivée** (lien d'ami, invitation, `?src=`) est gardée même quand le compte se crée sans passer par un invité : elle voyage avec la demande chez Google.

## 3. Technique

- **API (`auth.ts`) :**
  - `socialProviders.google` : `clientId` et `clientSecret` lus dans les secrets, `scope: ["openid", "email"]` sans les valeurs par défaut, `disableImplicitSignUp: true` (un compte ne se crée que si le client le demande avec `requestSignUp`), `mapProfileToUser` qui ne garde que l'adresse ;
  - `account.accountLinking` : `trustedProviders: ["google"]`, pour le rattachement de Q3 ;
  - `databaseHooks.account.create.before` : jetons d'accès et d'identité mis à `null` avant d'écrire, sauf si Better Auth en a besoin pour finir la connexion (à vérifier au lot 1) ;
  - `validateUserInfo` : pour une création par Google, « 15 ans ou plus » se lit dans les données du voyage (`getOAuthState`), et non dans le corps de la requête comme pour le code ;
  - `linkGuestOnSignIn` : `acceptGuestLoss` se lit aussi dans les données du voyage ;
  - `admitNewPlayer` : invitation, lien d'ami et source lus dans les données du voyage quand les en-têtes manquent (au retour de Google, ce n'est pas le client qui appelle) ;
  - `errorCallbackURL` : `/compte?erreur=<code>`, et les codes de Better Auth (`signup_disabled`, `access_denied`, `unable_to_link_account`…) traduits dans `packages/view-model/src/account.ts` ;
  - secrets `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.dev.vars` et par `wrangler secret put` pour la production. Sans eux, l'API ne propose pas Google, et le client cache le bouton (champ `google` dans la réponse de `/me/account`, ou route dédiée).
- **Web :** un appel `POST /api/auth/sign-in/social` (`provider: "google"`, `callbackURL`, `errorCallbackURL`, `requestSignUp` pour l'onglet Créer, `additionalData`), puis `window.location.assign(url)`. Le cookie de l'état et celui de l'invité vivent sur `api.leximon.fr`. Ce domaine est sur le même site que `leximon.fr`, donc les cookies `SameSite=Lax` partent bien au retour de Google, qui est une navigation de premier niveau.
- **Mobile :** `authClient.signIn.social` du client Expo, qui ouvre Google dans `expo-web-browser` et revient par `leximon://compte` ; le plugin `expo` de l'API rend la session au trousseau (Q2).
- **Données personnelles :** la page « Tes données » (`/confidentialite`) dit que Google peut servir à se connecter, ce qu'on en reçoit (l'adresse et un identifiant Google) et ce qu'on n'en garde pas. Les conditions n'ont pas à changer.
- **Tests :**
  - intégration contre un vrai Postgres, avec les appels à Google simulés : création avec et sans âge, connexion sans compte refusée, rattachement à un compte par code, invité transféré, invité abandonné avec et sans accord, compte suspendu, arrivée gardée ;
  - `view-model` : les messages d'erreur.

## 4. La console Google · toi

Dans le projet « Leximon » de la console Google Cloud, rubrique **Google Auth Platform** :

1. **Branding :** nom « Leximon », adresse d'assistance `contact@leximon.fr`, logo carré de 120 px, page d'accueil `https://leximon.fr`, règles de confidentialité `https://leximon.fr/confidentialite`, conditions `https://leximon.fr/conditions`, domaine autorisé `leximon.fr`, adresse de contact du développeur.
2. **Audience :** « Externe », puis « Publier l'application ». Avec seulement `openid` et `email`, Google n'exige pas de revue de sécurité. En « Test », seuls 100 testeurs déclarés pourraient se connecter.
3. **Accès aux données :** ajouter `openid` et `.../auth/userinfo.email`, rien d'autre.
4. **Clients :** deux clients OAuth de type « Application Web » :
   - « Leximon production » : origine `https://leximon.fr`, URI de redirection `https://api.leximon.fr/api/auth/callback/google` ;
   - « Leximon local » : origine `http://localhost:3000`, URI de redirection `http://localhost:8787/api/auth/callback/google`.
5. **Secrets :** l'identifiant et le secret du client local vont dans `apps/api/.dev.vars`. Ceux du client de production se posent avec `pnpm --filter @leximon/api exec wrangler secret put GOOGLE_CLIENT_ID --env production`, puis de même pour `GOOGLE_CLIENT_SECRET`. Ils ne passent jamais par une conversation ni par un fichier versionné.
6. **Vérification de la marque :** demandée depuis Branding. Elle prend quelques jours. Tant qu'elle n'est pas faite, l'écran de Google peut afficher le domaine au lieu du nom et du logo.

## 5. iOS

L'App Store exige « Se connecter avec Apple » dès qu'une app propose la connexion par Google (règle 4.8 de la revue d'Apple). L'app iOS n'est pas encore publiée : Google y reste caché jusqu'au lot Apple (Q1).

## 6. Lots

1. **API :** Google avec Better Auth, données du voyage (âge, accord de perte, nouvelles, arrivée), jetons non gardés, erreurs, tests d'intégration. Sans les secrets, rien ne change pour les joueurs.
2. **Web :** bouton, fenêtre d'âge, retours d'erreur et avertissement de perte, « par Google » sur la page du joueur, page « Tes données ».
3. **Android :** la même chose dans l'app, par le navigateur. Recette sur un téléphone.
4. **Plus tard, avec Apple :** iOS.

## 7. Ce qui ne change pas

- Le code par e-mail reste, tel quel.
- La règle de l'invité (P37, P54) ne change pas : seule la façon d'entrer s'ajoute.
- Aucun nom, aucune photo ne vient de Google : le pseudo et l'avatar restent ceux du jeu.

## 8. Questions ouvertes

Chaque question a une recommandation en premier.

- **Q1. Où proposer Google ?**
  - (a) Web et Android d'abord, iOS avec Apple plus tard. *Recommandé* : l'app iOS n'est pas publiée, et Apple impose son bouton avec celui de Google.
  - (b) Partout, avec Apple dans le même lot (deux fournisseurs, compte développeur Apple, plus long).
  - (c) Le web seulement pour l'instant.
- **Q2. Sur Android, par où passer ?**
  - (a) Par le navigateur intégré (`expo-web-browser`, déjà là), retour par `leximon://`. *Recommandé* : aucune dépendance nouvelle, le même client Google que le web.
  - (b) Le sélecteur de compte natif d'Android (bibliothèque `@react-native-google-signin`, empreinte de la clé de l'app, client Android dans la console). Un peu plus fluide, mais une dépendance native de plus.
- **Q3. Une adresse Gmail qui a déjà un compte par code ?**
  - (a) Google se rattache à ce compte : même joueur, deux façons d'entrer. *Recommandé.*
  - (b) Refusé, avec « Connecte-toi avec un code à cette adresse ».
- **Q4. Quand demander « J'ai 15 ans ou plus » pour un compte créé par Google ?**
  - (a) Dans une petite fenêtre avant de partir chez Google, depuis l'onglet « Créer un compte » seulement. *Recommandé* : simple, et rien ne se crée sans l'âge.
  - (b) Au retour de Google, sur un écran « Presque fini ». Il faudrait garder le compte Google en suspens sans créer le joueur : plus lourd, et plus fragile.
- **Q5. « Se connecter » avec un Google qui n'a pas de compte ?**
  - (a) Pas de compte créé : retour à l'onglet « Créer un compte » avec une phrase qui le dit. *Recommandé* : l'âge n'a pas été demandé.
  - (b) Création directe, sans la case d'âge (contraire à la règle actuelle).
- **Q6. Que demander à Google ?**
  - (a) L'adresse seulement, sans garder de jeton. *Recommandé* : c'est la règle actuelle (ni nom, ni photo), et l'écran d'accord de Google reste le plus court.
  - (b) Le nom et la photo aussi, pour proposer un pseudo ou un avatar.
- **Q7. Le bouton ?**
  - (a) Le bouton Google officiel (fond blanc, « G » en couleurs), au-dessus du formulaire, puis « ou ». *Recommandé* : Google vérifie le respect de sa marque.
  - (b) Un bouton du jeu, en papier, avec le « G » officiel dessus. Plus dans l'allure, mais à la limite des règles de Google.
- **Q8. Un invité avec des cartes se connecte par Google à un compte qui joue déjà ?**
  - (a) Retour sur `/compte` avec l'avertissement et « Perdre cette partie et me connecter », qui repart chez Google. *Recommandé* : c'est le parcours du code.
  - (b) Refus simple, avec « Utilise un autre compte Google pour garder cette partie ».
