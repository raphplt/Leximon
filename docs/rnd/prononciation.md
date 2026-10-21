# R&D · Prononciation des mots

- **Décision liée :** D-032 et P57. Touche aussi D-023 (catalogue statique), D-019 et D-021 (chaîne de contenu), N1 et N2 (ce qui se paie), et la ligne « Abonnement premium » des règles du jeu.
- **Dates :** 2026-10-21 → 2026-10-21
- **Question :** comment faire entendre la prononciation de chacun des 1 561 mots du catalogue (version `2026-10-20.3`) : avec quelle qualité, quelle couverture et quel coût ?

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Couverture | Un son pour 100 % des cartes, y compris les plus rares |
| Justesse | Pas de faute audible sur les pièges du catalogue : finale prononcée (*ambesas*, *comput*), « ch » grec (*chorographe*), mot pris pour de l'anglais (*léthifère*) |
| Droits | Usage commercial, fichiers gardés sans limite de durée, crédit affichable carte par carte |
| Sources | Seulement celles du skill `carte-mot` ; le Wiktionnaire sert à vérifier, jamais à reprendre |
| Coût | Quelques dollars pour tout le catalogue, puis presque rien par lot hebdomadaire |
| Architecture | Fichiers statiques versionnés avec le catalogue et servis par le CDN (D-023) ; aucune lecture de la base |
| Poids | Moins de 10 Ko par mot |

## Options testées

Toutes les mesures portent sur le catalogue réel. Machine : Linux x86_64, eSpeak NG 1.52, Piper 1.8.0, ffmpeg. API Wikimedia interrogées une requête à la fois, une par seconde environ, avec le User-Agent `LeximonContentPipeline/0.1 (https://leximon.fr; contact@leximon.fr)`. Dépense d'API : 0 $. Aucun compte créé ; aucune clé de fournisseur de synthèse n'est disponible dans le projet.

### 1. Enregistrements humains (Wikimedia Commons, Lingua Libre)

**Méthode** (`wiki.py`) :
- recherche de `File:Fr-<mot>.ogg` sur Commons, 50 titres par requête ;
- relevé des fichiers cités par les modèles `{{écouter}}` du Wiktionnaire ;
- recherche Commons `LL-Q150 (fra)-<locuteur>-<mot>.wav` pour les 671 mots que le Wiktionnaire ne relie à aucun enregistrement. Sur un premier passage de 51 mots, la recherche trouvait tout ce que le Wiktionnaire reliait, plus 2 mots ;
- licence et auteur de chacun des 1 637 fichiers trouvés (`extmetadata`).

Puis, sur un échantillon de 52 enregistrements (12 des 20 mots difficiles et 40 mots tirés au hasard), mesure du niveau, du silence et de la taille (`human_sample.py`), et contrôle de ce qui est dit avec un reconnaisseur de phonèmes (voir option 3).

**Couverture : 894 mots sur 1 561 (57,3 %).**
- La convention `Fr-<mot>.ogg` est presque morte : 3 mots seulement. Sur les 1 596 liens audio du Wiktionnaire vers nos mots, 1 575 sont des enregistrements Lingua Libre.
- 438 mots ont plusieurs enregistrements.
- La couverture s'effondre là où la prononciation est la moins évidente :

| Rareté | Mots avec enregistrement |
|---|---|
| Courant | 451 / 526 (86 %) |
| Peu commun | 208 / 356 (58 %) |
| Rare | 99 / 248 (40 %) |
| Épique | 28 / 88 (32 %) |
| Précieux | 98 / 311 (32 %) |
| Légendaire | 10 / 32 (31 %) |

**Droits :**
- licences des fichiers trouvés : CC BY-SA 4.0 (1 444), CC0 (144), CC BY 4.0 (25), CC BY-SA 3.0 (21), CC BY 2.0 fr (3) ;
- seulement 150 mots ont un enregistrement CC0 ou CC BY ;
- crédit à afficher : nom du locuteur, licence, lien vers le fichier (« Voix : Lyokoï, Lingua Libre, CC BY-SA 4.0 »). On compte 89 locuteurs, mais quatre font les deux tiers des fichiers : Lyokoï (338), Jérémy-Günther-Heinz Jähnick (321), WikiLucas00 (218), LoquaxFR (172) ;
- avec CC BY-SA, un fichier retouché (silence coupé, volume normalisé) se diffuse lui-même sous CC BY-SA, en indiquant les changements. La partage à l'identique ne s'étend pas à la carte ni à l'application. C'est une lecture de la licence, pas un avis juridique.

**Qualité :**
- WAV de 1,13 s et 105 Ko en médiane, ramenés à environ 3,4 Ko en Opus 24 kbit/s mono ;
- 0,21 s de silence en tête (médiane) ;
- le niveau moyen va de −32,4 à −18,5 dB selon le locuteur, soit 14 dB d'écart : il faut normaliser le volume ;
- un locuteur sur trois lit *épichérème* avec un [ʃ] : le reconnaisseur entend [ibiʃeʁɛm] chez Guilhelma, [epikʁɛm] chez WikiLucas00 et un [ɡ] chez Lepticed7. Les bénévoles lisent un mot affiché qu'ils ne connaissent pas toujours. Un enregistrement de mot rare se vérifie donc comme un texte.

### 2. Prononciation écrite (notation phonétique)

**Wiktionnaire** (`wiki.py`, 50 pages par requête) :
- une page pour 1 541 mots (98,7 %), une section française pour 1 522 ;
- **une notation phonétique pour 1 486 mots (95,2 %)**, plusieurs variantes pour 78 ;
- le skill `carte-mot` n'autorise le Wiktionnaire que pour **vérifier**.

**Littré, XMLittré** (`sources.py`, domaine public, source déjà autorisée) :
- une graphie prononcée pour **1 560 mots (99,9 %)**, par exemple « ko-ro-gra-f' », « an-be-zas' », « é-pi-ké-rê-m' » ;
- c'est une orthographe régularisée : z écrit quand le s sonne [z], apostrophe pour une consonne finale prononcée, « ll mouillées » pour [j] ;
- une table de règles écrite en une heure (`littre_ipa.py`, environ 60 règles) la convertit en notation phonétique. Elle concorde avec le Wiktionnaire pour **1 380 mots sur 1 485 (92,9 %)** et pour **les 20 mots difficiles sur 20** ;
- la plupart des écarts tiennent à la diérèse du XIXe siècle (« di-a-pré » contre [dja.pʁe]) et à quelques règles manquantes ;
- le texte se lit à part : lu directement par eSpeak NG, sans conversion, la graphie du Littré ne donne que 77,6 % de concordance.

**Autres sources :**
- lexèmes Wikidata (CC0) : 193 mots, dont 2 avec une notation phonétique et 8 avec un son. Inutilisable ;
- Lexique 3.83 : colonne phonologique pour 415 mots (26,6 %). Sa licence CC BY-SA n'en permet que des scores dérivés ;
- au passage : 15 mots du catalogue n'existent sur le Wiktionnaire qu'avec une capitale (*Agnès*, *Artaban*, *Durandal*, *Pnyx*, *Plutus*, *Lilliput*…), et 5 seulement dans la graphie du Littré (*extrinséque*, *gastrolàtre*, *réverencier*, *épepiner*, *croûtier*). Voir « Hors sujet ».

### 3. Synthèse vocale pré-générée

**Les 20 mots difficiles** (`words20.json`), tirés des erreurs d'eSpeak NG sur tout le catalogue :

| Piège | Mots |
|---|---|
| Finale prononcée | ambesas, comput, orémus, tacet, palus, introït |
| « ch » grec | chorographe, épichérème, nychthémère, picrochole, didrachme |
| Pris pour de l'anglais | casoar, lycanthrope, léthifère, apathiste |
| Latin, italien | pensum, canzone, quinquatries |
| Régional (témoins) | magnaud, faraud |

Les mots régionaux ne posent presque aucun problème. Plus d'une centaine de mots ont une étymologie normande, picarde, wallonne ou provençale, et presque tous sont bien lus. Les vrais pièges sont les mots savants et ceux qu'on croit anglais.

#### 3a. Fournisseurs en nuage (Azure, Google, Amazon Polly, ElevenLabs)

Non essayés : aucun compte, aucune clé dans le projet. Mesuré sur la documentation officielle (liens en fin de rapport).

| | Azure AI Speech | Google Cloud TTS | Amazon Polly | ElevenLabs |
|---|---|---|---|---|
| Meilleures voix fr-FR | Vivienne, Rémy (HD « Dragon »), Denise, Henri et 12 autres (neural) | Chirp 3 HD (30 voix), Neural2, Studio | Léa, Rémi (neural) ; Ambre, Céline, Florian, Léa, Rémi (génératif) | Bibliothèque de voix, modèles v3, v4, Multilingual v2 |
| `<phoneme alphabet="ipa">` en fr-FR | **Oui** pour les voix neural et Dragon HD ; non pour Dragon HD Omni. Lexique PLS sur les voix neural | Oui pour Neural2 et WaveNet. Chirp 3 HD : **la documentation se contredit**, à tester | **Oui** pour les voix neural et standard, plus des lexiques PLS. Génératif : « partiel », sans détail | **Non** en français : les balises phonème ne marchent que sur un modèle anglais |
| Prix par million de caractères | Neural 15 $, HD 22 $ | Chirp 3 HD 30 $, Neural2 16 $ | Neural 16 $, génératif 30 $ | 40 à 80 $ (offre API) |
| Gratuit par mois | 0,5 M, **sans usage commercial** | 1 M (Chirp 3 HD, Neural2) | 1 M en neural, les 12 premiers mois | 10 000 caractères, sans usage commercial |
| Droits sur les fichiers | Usage commercial avec une ressource payante (S0), aucune limite de conservation | Utilisables « pour vos applications » ; rien d'explicite sur la conservation | « You can cache and replay » : le plus clair des quatre | Licence commerciale sur offre payante, hors modèles bêta |
| Hébergement UE | France Central, West Europe, Sweden Central | Point d'accès `eu-` ; la présence de Chirp 3 HD y est à vérifier | Paris (eu-west-3) en neural ; génératif à Francfort | Résidence UE réservée à l'offre Entreprise |

**Coût pour tout le catalogue :**
- lecture brute : 13 584 caractères ;
- lecture guidée : 110 604 caractères, parce que le balisage SSML est facturé ;
- dans tous les cas, cela tient dans l'offre gratuite mensuelle. Au tarif public, le plus cher (30 $ le million) coûte 3,30 $ ;
- un lot hebdomadaire de quelques centaines de mots ne coûte rien de mesurable.

Le prix ne départage donc pas les fournisseurs : ce qui compte, c'est le support de la notation phonétique en français et les droits sur les fichiers. Mistral (Voxtral) et OpenAI n'offrent aucun contrôle par phonème ; les modèles vocaux d'OpenAI ferment le 6 janvier 2027.

#### 3b. Synthèse neuronale locale (Piper), essayée pour de vrai

C'est la seule synthèse neuronale qu'on puisse faire tourner sans compte. Elle mesure aussi ce que vaut le fait de guider la voix par la notation phonétique.

**L'outil :**
- Piper 1.8.0 (moteur GPL-3, utilisé hors ligne dans la chaîne seulement), voix `fr_FR-siwis-medium` (jeu de données SIWIS, CC BY 4.0, crédit à afficher) ;
- autres voix françaises de Piper : *upmc* (CC BY-SA), *tom* (AGPL, exclue), *mls* (CC BY 4.0), *gilles* (CC0, basse qualité).

**Deux lectures par mot** (`piper_trial.py`) : la lecture brute (Piper convertit lui-même le texte en phonèmes, avec eSpeak NG) et la lecture guidée (la notation phonétique est donnée directement au modèle).

**Contrôle à la machine** (`phone_rec.py`, `score.py`) : un reconnaisseur de phonèmes multilingue (`facebook/wav2vec2-lv-60-espeak-cv-ft`) note ce que dit chaque fichier.
- Il est bruité. Il manque souvent un [o] final : *faraud* et *magnaud* sont ratés quelle que soit la source.
- On ne lui demande donc que le son qui décide de chaque mot difficile.

| Source | Son décisif entendu (20 mots difficiles) | Taux d'erreur de phonèmes, 20 mots difficiles | Taux d'erreur, 39 mots au hasard |
|---|---|---|---|
| Humain (Commons) | 7 / 12 enregistrements existants | 0,25 | 0,19 |
| Piper, lecture brute | **1 / 20** | 0,44 | 0,22 |
| Piper, lecture guidée | **15 / 20** | 0,27 | 0,20 |

**Exemples de mots ratés en lecture brute** (phonèmes de Piper) :
- *ambesas* [ɑ̃bza], *comput* [kɔ̃py], *orémus* [oʁemy], *tacet* [tasɛ] : la finale n'est pas prononcée ;
- *chorographe* [ʃoʁɔɡʁaf], *épichérème* [epiʃeʁɛm], *didrachme* [didʁaʃm] : le « ch » est lu [ʃ] ;
- *léthifère* [leɪθɪfə] et *casoar* [kasɔː] : lus en anglais ;
- *quinquatries* [kɛ̃katʁi], *canzone* [kɑ̃zon], *pensum* [pɑ̃sɔm].

**En lecture guidée**, le reconnaisseur entend la finale, le [k] et l'accent français. Restent incertains : *nychthémère* (le [k] n'est pas entendu), *pensum* et *canzone*.

**Sur tout le catalogue** (`g2p.py`, `piper_g2p.py`) : la lecture brute d'eSpeak NG, celle de Piper, concorde avec le Wiktionnaire pour 94,5 % des mots. La comparaison tolère les variations d'usage : e et ɛ, o et ɔ, e muet, semi-voyelles. Parmi les 82 écarts :
- 11 finales ;
- 7 « ch » grecs ;
- 9 lectures à l'anglaise ;
- environ 40 autres vraies fautes (*pusillanime* [pyzijanim], *fritillaire*, *postillonner*, *clayer* [klɛjœʁ], *spencer* [spɑ̃se]) ;
- le reste, des variantes acceptables ou des erreurs du Wiktionnaire (*dicacité* noté [di.da.si.te]).

Il faut donc compter environ 5 % de fautes en lecture brute, concentrées sur les mots les plus rares.

**Poids et vitesse :** 2,6 Ko par mot en Opus 24 kbit/s, 22 ms de synthèse par mot sur processeur, aucun coût. La qualité de la voix *siwis* reste à juger à l'oreille : elle est en dessous des grandes voix du nuage, mais un reconnaisseur la comprend aussi bien qu'un enregistrement humain (taux d'erreur de 0,20 contre 0,19).

**Concordance entre deux sources autorisées** (`littre_ipa.py`) :
- le Littré converti et eSpeak NG s'accordent sur **1 333 mots (89,8 %)**, dont **98,9 %** concordent aussi avec le Wiktionnaire ;
- ils divergent sur 152 mots (10 %). Le Wiktionnaire donne raison au Littré 57 fois, à eSpeak 80 fois, aux deux 4 fois et à aucun 11 fois.

L'accord des deux suffit donc pour valider automatiquement. Le désaccord désigne une file d'environ 150 mots à faire trancher par le Wiktionnaire, puis par une personne pour la dizaine restante.

### 4. Synthèse du navigateur (`speechSynthesis`)

**Mesuré :**
- le navigateur intégré de l'application de bureau (Chromium 152 sous Linux) expose **0 voix** (`voices.html`) : la fonction y est muette ;
- sous Linux, Firefox et Chromium passent par speech-dispatcher, c'est-à-dire eSpeak NG. Ils feraient donc au mieux la lecture brute mesurée plus haut (1 réussite sur 20 mots difficiles, environ 5 % de fautes sur le catalogue), avec une voix robotique.

**Non mesurable ici** (aucun appareil Apple, Windows ou Android sous la main) : chaque système apporte ses voix (Apple : Thomas, Amélie ; Windows : Hortense, Denise en ligne dans Edge ; Android : moteur Google, selon l'appareil), et sa lecture des mots rares nous échappe.

**Ce qui ferme la piste :**
- l'API Web Speech ne permet ni notation phonétique ni SSML : on ne peut pas corriger un mot ;
- la même carte sonnerait différemment, ou pas du tout, d'un appareil à l'autre ;
- sur iOS, `AVSpeechSynthesizer` accepte bien une notation phonétique, mais `expo-speech` ne l'expose pas.

## Résultats

| Option | Couverture | Justesse sur les 20 pièges | Coût du catalogue | Droits | Travail de chaîne |
|---|---|---|---|---|---|
| Enregistrements humains Commons | 57 % (31 % des Légendaires) | 7 / 12 existants ; un locuteur sur trois se trompe sur *épichérème* | 0 $ | 92 % en CC BY-SA : crédit par carte, fichier retouché sous CC BY-SA | Recherche, choix parmi plusieurs prises, vérification, normalisation, crédits |
| Synthèse brute (eSpeak NG, Piper, navigateur) | 100 % | 1 / 20 ; environ 5 % de fautes sur le catalogue | 0 $ | Piper : CC BY 4.0, avec crédit | Faible, mais fautes non corrigées |
| Synthèse guidée, Piper local | 100 % | 15 / 20 (le reste est surtout le bruit du reconnaisseur) | 0 $ | CC BY 4.0, avec crédit | Notation validée par mot, génération, R2 |
| Synthèse guidée, nuage (Azure ou Polly) | 100 % | Non mesurée (pas de clé) ; balise phonème documentée en fr-FR | Moins de 4 $, dans l'offre gratuite | Usage commercial avec une offre payante, sans crédit | Comme Piper, plus un compte fournisseur |
| `speechSynthesis` | 0 à 100 % selon l'appareil | Non corrigeable | 0 $ | Sans objet | Aucun, mais aucun contrôle |
| Notation : Littré converti | 99,9 % | 20 / 20 | 0 $ | Domaine public | Convertisseur à finir et à tester |
| Notation : Wiktionnaire | 95,2 % | Référence | 0 $ | Vérification seulement (`carte-mot`) | Lecture des pages en cache |

## Recommandation

1. **Une notation phonétique validée par carte, tirée du Littré.**
   - On la convertit avec des règles, puis on la compare à la lecture d'eSpeak NG.
   - Quand les deux s'accordent (90 % des mots, justes à 99 %), elle est validée automatiquement.
   - Les autres (environ 150 mots au lancement) passent à la relecture dans Directus, avec la notation du Wiktionnaire en regard pour vérifier, comme le permet le skill.
   - Cette notation sert ensuite à tout : guider la synthèse, contrôler un enregistrement, et peut-être l'afficher sur la carte.
2. **Une voix de synthèse guidée par cette notation pour toutes les cartes**, plutôt que l'humain d'abord. Je m'écarte ici de l'hypothèse de départ, pour trois raisons mesurées :
   - les enregistrements manquent justement sur les cartes rares : le joueur entendrait un humain sur les Courantes et une machine sur les Légendaires ;
   - ils changent de voix, de micro et de volume d'une carte à l'autre (14 dB d'écart) ;
   - ils se trompent parfois sur les mots savants.

   Une seule voix guidée donne 100 % de couverture, un son homogène et une justesse qu'on contrôle. Les enregistrements Lingua Libre peuvent rester en complément (« écouter un locuteur »), avec leur crédit, s'ils passent le même contrôle.
3. **Fournisseur : un essai avec clé sur les 20 mots avant de choisir**, pour moins de 0,01 $.
   - Azure (voix neural ou Dragon HD, France Central) et Polly (voix neural, Paris) documentent la balise phonème en français et autorisent l'usage commercial ;
   - Google Chirp 3 HD est à vérifier ;
   - Piper reste la solution sans fournisseur : gratuite et locale, elle suit la notation, mais sa voix est plus modeste.
4. **Des fichiers statiques versionnés avec le catalogue**, sans aucune lecture de la base :
   - Opus d'environ 3 Ko, nommés par leur empreinte, environ 5 Mo pour le catalogue ;
   - servis par R2 et le CDN, comme les gravures (D-028) ;
   - un champ optionnel `pronunciation` dans le catalogue (ajout rétrocompatible) : notation, fichier, crédit ;
   - le format qui se lit sur les anciens iOS (Opus ou AAC) est à vérifier sur appareil.
5. **Pas de `speechSynthesis`**, même en secours : il est muet sur certaines machines, varie selon l'appareil et ne se corrige pas.

**Reste à vérifier :**
- la voix du fournisseur retenu, à l'oreille, sur les 20 mots, en lecture brute et guidée ;
- le support réel de la balise phonème sur Chirp 3 HD et sur les voix génératives de Polly ;
- la lecture d'Opus dans Safari sur iOS et dans l'app Expo ;
- l'écoute de `out/ecoute.html` par le propriétaire, pour juger la voix Piper et les enregistrements.

## Décisions du propriétaire (2026-10-21)

Tranché :

1. **Gratuit pour tous, jamais premium** (P57).
2. **Une seule voix de synthèse, guidée par la notation phonétique, pour toutes les cartes** (D-032). Aucun enregistrement humain, même en complément. La question des licences audio (CC BY-SA ou CC0) ne se pose donc plus, et la voix de la maison enregistrée par un comédien est écartée elle aussi.
3. **Voix : Google Cloud Text-to-Speech, Chirp 3 HD « Charon », guidée par la notation** (choisie à l'écoute le 2026-10-21, point d'accès `eu-texttospeech`). Azure a été abandonné : impossible d'activer l'abonnement étudiant depuis le compte de l'école.
4. **Le Wiktionnaire contrôle la notation** tirée du Littré, sans jamais être repris (D-032).

Encore ouvert :

1. **L'affichage de la notation phonétique**, sur la carte ou à côté : le propriétaire penche pour le oui, à tester sur maquettes. Ce serait toujours la notation du Littré convertie, jamais celle du Wiktionnaire.

### Essai Google (2026-10-21)

Script `google_trial.py`, 20 mots difficiles, point d'accès UE, environ 5 000 caractères facturés (dans l'offre gratuite). La balise `<phoneme>` est bien acceptée **et appliquée** par Chirp 3 HD : la documentation se contredisait. Exemple : avec Charon, *épichérème* passe de [ʃ] à [k] une fois guidé.

| Voix | Son décisif entendu sans guide | Guidée | Taux d'erreur, guidée |
|---|---|---|---|
| Piper siwis | 1 / 20 | 15 / 20 | 0,27 |
| Kokoro ff_siwis | 2 / 20 | 13 / 20 | 0,31 |
| Chirp 3 HD Charon | 9 / 20 | 14 / 20 | 0,23 |
| Chirp 3 HD Kore | 9 / 20 | 12 / 20 | 0,19 |
| Neural2 G | 10 / 20 | 15 / 20 | 0,21 |

Sans guide, Google se trompe déjà beaucoup moins que les voix locales : il connaît *chorographe*, *didrachme* et *lycanthrope*. Aucune voix ne réussit *pensum* ni *canzone*.

**Coût pour le catalogue :** environ 110 000 caractères avec le balisage SSML. Au tarif public de Chirp 3 HD (30 $ le million), cela ferait 3,30 $, mais le volume tient dans l'offre gratuite mensuelle (1 million de caractères, à reconfirmer sur la page des tarifs).

## Travail de chaîne de contenu à prévoir

Estimations, non mesurées :
- **Notation** (environ 1 jour) : un module `pronunciation` dans `content/pipeline`, comprenant :
  - le convertisseur du Littré, avec des tests sur les 1 485 mots qui ont une référence ;
  - la lecture d'eSpeak NG (dépendance système de la chaîne locale, ou `piper-tts` qui l'embarque : nouvelle dépendance Python à faire valider) ;
  - le relevé des notations du Wiktionnaire en cache ;
  - un champ `ipa` et une file de relecture dans Directus.
- **Audio** (environ 1 jour) :
  - génération guidée par lots ;
  - normalisation du volume et coupe des silences (ffmpeg) ;
  - encodage, nom par empreinte, dépôt sur R2 ;
  - champ `pronunciation` dans `release`, et schéma Zod du catalogue dans `packages/contract`.
- **Enregistrements humains, si retenus** (environ 1 jour de plus) : recherche Commons (le code de `wiki.py`), choix d'une prise, contrôle par le reconnaisseur ou à l'oreille, crédits.
- **Web et mobile** (une demi-journée) : un bouton d'écoute sur la vue agrandie, `expo-audio` côté mobile, et le crédit quand il y en a un.

## Hors sujet, relevé en passant

- 15 mots du catalogue n'existent sur le Wiktionnaire qu'avec une capitale : *agnès*, *artaban*, *courtain*, *durandal*, *euphrosyne*, *grippeminaud*, *icarie*, *lilliput*, *longchamps*, *lémuries*, *nicaise*, *panagie*, *plutus*, *pnyx*, *prudoterie*. Certains semblent contredire P40 (noms propres exclus) : à revoir dans la chaîne.
- 5 mots n'existent que dans la graphie du Littré (*extrinséque*, *gastrolàtre*, *réverencier*, *épepiner*, *croûtier*) : la carte affiche-t-elle la graphie moderne ?

## Pour reproduire

Code jetable dans `rnd/prononciation/`. Les résultats et les fichiers audio vont dans `rnd/prononciation/out/`, qui n'est pas versionné. Lancer depuis la racine du dépôt.

```bash
python3 rnd/prononciation/wiki.py all                 # Wiktionnaire, Commons, licences, rapport (environ 15 min)
python3 rnd/prononciation/sources.py littre lexique wikidata report
# voix Piper (63 Mo, CC BY 4.0) : https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/siwis/medium
uv run rnd/prononciation/piper_g2p.py <dossier de la voix>
python3 rnd/prononciation/g2p.py                      # eSpeak NG 1.52 du système
python3 rnd/prononciation/g2p.py --source piper       # eSpeak embarqué par Piper
python3 rnd/prononciation/littre_ipa.py
uv run rnd/prononciation/piper_trial.py <dossier de la voix>                 # 20 mots difficiles
python3 rnd/prononciation/human_sample.py             # 52 enregistrements, niveaux
uv run rnd/prononciation/piper_trial.py <dossier de la voix> rnd/prononciation/words40.json
uv run rnd/prononciation/phone_rec.py rnd/prononciation/out/human/*.opus rnd/prononciation/out/audio/*.opus   # 1,3 Go de modèle
python3 rnd/prononciation/score.py
python3 rnd/prononciation/ecoute.py                   # page d'écoute out/ecoute.html
```

`voices.html` liste les voix `speechSynthesis` d'un navigateur. Dépendances : Python 3.13, ffmpeg, eSpeak NG ; les scripts `uv run` déclarent les leurs (piper-tts 1.8.0, torch 2.9.1 CPU, transformers 4.57.1), installées hors du monorepo.

## Sources

- Azure : [langues et voix](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts), [prononciation SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-pronunciation), [voix HD](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices), [régions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions?tabs=tts), [tarifs](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/), [API des prix](https://prices.azure.com/api/retail/prices), [conditions de produit](https://www.microsoft.com/licensing/terms/productoffering/MicrosoftAzure/MCA)
- Google : [tarifs](https://cloud.google.com/text-to-speech/pricing), [Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd), [voix](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types), [SSML](https://docs.cloud.google.com/text-to-speech/docs/ssml), [phonèmes](https://docs.cloud.google.com/text-to-speech/docs/phonemes), [points d'accès](https://docs.cloud.google.com/text-to-speech/docs/endpoints), [usage des fichiers](https://docs.cloud.google.com/text-to-speech/docs/basics), [conditions](https://cloud.google.com/terms/service-terms)
- Amazon Polly : [voix](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html), [voix génératives](https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html), [balises SSML](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html), [phonème](https://docs.aws.amazon.com/polly/latest/dg/phoneme-tag.html), [lexiques](https://docs.aws.amazon.com/polly/latest/dg/managing-lexicons.html), [tarifs](https://aws.amazon.com/polly/pricing/), [FAQ](https://aws.amazon.com/polly/faqs/)
- ElevenLabs : [contrôles](https://elevenlabs.io/docs/best-practices/prompting/controls), [modèles](https://elevenlabs.io/docs/overview/models), [tarifs API](https://elevenlabs.io/pricing/api), [conditions](https://elevenlabs.io/terms-of-use), [résidence des données](https://elevenlabs.io/docs/overview/administration/data-residency)
- Autres : [Mistral Voxtral TTS](https://docs.mistral.ai/models/voxtral-mini-tts-3-0), [OpenAI TTS](https://developers.openai.com/api/docs/guides/text-to-speech), [voix Piper](https://huggingface.co/rhasspy/piper-voices), [Piper](https://github.com/OHF-voice/piper1-gpl), [reconnaisseur wav2vec2](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft), [Lingua Libre](https://lingualibre.org)
