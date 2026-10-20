# R&D · Gravures des cartes

- **Décision liée :** P5 de la north star (« Gravures du domaine public, avec un traitement graphique propre ») et D-022 (« Planche populaire »). Aucune décision technique encore : celle-ci reste à créer.
- **Dates :** 2026-10-20 → 2026-10-20
- **Question :** comment trouver, vérifier, traiter et servir une gravure du domaine public pour environ 1 500 cartes au lancement, puis quelques centaines par semaine ?

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Droits | Réutilisation commerciale sans redevance, sans clause NC ni SA. Œuvre dans le domaine public en France : auteur mort depuis plus de 70 ans |
| Automatisation | Recherche par mot-clé et téléchargement par API, sans aspirateur de site, dans les limites de débit publiées |
| Couverture | Un candidat pertinent trouvé automatiquement pour au moins 70 % des mots |
| Coût | Modèles : moins de 30 $ pour 1 500 cartes. Temps humain : moins d'une minute par carte en moyenne |
| Rendu | Traitement automatique et reproductible, fidèle à D-022, lisible dans l'encart de la carte (272 × 118 unités) |
| Poids | Moins de 40 Ko par gravure à la taille de la carte en 3x |

## Options testées

### 1. Les fonds et leur statut réel

Vérifiés sur les pages de conditions de chaque fonds (sources en fin de section).

| Fonds | Statut des images d'œuvres anciennes | Mention exigée | Usage commercial |
|---|---|---|---|
| **Gallica / BnF** | Redevance pour tout usage commercial, même pour le domaine public : 75 € HT par image pour le web ou le mobile, plus 5 € de frais techniques. Remise de 10 à 20 % entre 10 et 29 images, tarif négocié au-delà | « Source gallica.bnf.fr / BnF » | **Payant.** Environ 110 000 € au tarif public pour 1 500 images |
| **Wikimedia Commons** | Fichier par fichier. Les modèles « PD-Art » et « PD-scan » valent pour le droit américain. Commons ne garantit rien | Recommandée, pas exigée pour le domaine public | Oui pour les fichiers PD, CC0 et CC BY (avec crédit). Non pour CC BY-SA, trop risqué sur une image retravaillée |
| **Metropolitan Museum** (Open Access) | CC0 | Aucune | Oui |
| **Rijksmuseum** | Domaine public ou CC0 pour la plupart des objets, CC BY 4.0 pour certains | Demandée, pas exigée en CC0 | Oui |
| **Paris Musées** | CC0 depuis 2020 pour les œuvres libres de droits (plus de 150 000 images) | Charte de bonnes pratiques : créditer | Oui |
| **NYPL** (Public Domain Collections) | « No permission required; no restrictions on use » | Encouragée | Oui |
| **Library of Congress** | Statut indiqué objet par objet (« No known restrictions » le plus souvent pour les estampes anciennes) | Demandée | Oui, après vérification de l'objet |
| **British Library** (Flickr Commons, 1 million d'images de livres) | « No known copyright restrictions » : un avis de l'institution, pas une licence | Lien vers la notice | Oui, sans garantie |
| **Internet Archive** | Aucune licence accordée par IA ; l'utilisateur vérifie. Ses « Book Images » sur Flickr et Commons sont marquées « No known copyright restrictions » | Variable | Oui pour un livre vraiment ancien, après vérification de la date |
| **Biodiversity Heritage Library** | Ne revendique aucun droit sur ses numérisations. Domaine public : réutilisable. Œuvres sous droits : généralement CC BY-NC-SA | Crédit souhaité (« Image from the Biodiversity Heritage Library… ») | Oui pour le domaine public, non pour le reste |
| **Wellcome Collection** | Domaine public ou CC BY 4.0 pour l'essentiel (iconographie médicale, charlatans, métiers, planches de l'Encyclopédie). Une partie en CC BY-NC | CC BY : crédit et licence obligatoires | Oui pour PD et CC BY, non pour CC BY-NC |
| **British Museum** | Ses photos sont publiées en CC BY-NC-SA 4.0 ; usage commercial sous licence payante. Commons en héberge beaucoup, marquées « PD-Art » | « © The Trustees of the British Museum » | **À éviter** tant qu'un juriste n'a pas tranché |
| **Encyclopédie, ENCCRE** (exemplaire Mazarine) | Selon une source secondaire : CC BY-NC-ND, usage commercial soumis à redevance de l'Institut de France | — | **Non** |
| **Encyclopédie, ARTFL** (Chicago) | Aucune condition d'utilisation des images trouvée ; scans repris de la réimpression Pergamon de 1969 | — | **Non** pour les images. Les légendes des planches restent un index utile |
| **Old Book Illustrations** | Pas de restriction annoncée sur les images, sans garantie ; aspirateurs de site refusés | Aucune pour les images | Oui, mais recherche manuelle seulement |
| **Europeana** | Agrège les fonds européens ; filtre de réutilisabilité. Clé d'API gratuite exigée (essai sans clé : 401) | Selon le fonds | Selon le fonds |

**Pièges à retenir :**

- **Gallica, même via Commons.** Beaucoup de fichiers de Commons viennent de Gallica (« btv1b… » dans le nom ou la source). La BnF fonde sa redevance sur le régime des informations publiques (loi de 1978, aujourd'hui le CRPA), pas sur le droit d'auteur. L'article 14 de la directive 2019/790 dit qu'une reproduction non originale d'une œuvre d'art du domaine public n'est pas protégée par le droit d'auteur, mais la France fait partie des pays qui ne l'ont pas transposé explicitement. Le skill `carte-mot` interdit déjà les images Gallica : il faut aussi écarter leurs copies sur Commons, tant qu'un juriste n'a pas dit le contraire.
- **« Public domain » sur Commons n'est pas le domaine public français.** « PD-US-expired » veut dire publié avant 1931 aux États-Unis. En France, l'auteur doit être mort depuis plus de 70 ans, soit avant le 1er janvier 1956 en 2026. Les prorogations de guerre ne s'ajoutent pas aux 70 ans (Cass. civ. 1re, 27 février 2007), mais un auteur « mort pour la France » gagne 30 ans. Exemples : Daumier (mort en 1879), Grandville (1847) et Gavarni (1866) sont libres ; Sem (1934) aussi ; Benjamin Rabier (1939) l'est en France depuis 2010, mais il faut vérifier chaque illustrateur du XXe siècle.
- **Droit moral perpétuel en France.** Recadrer et teinter une gravure reste permis, mais il faut nommer l'auteur quand il est connu (« d'après Daumier, 1833 »).
- **Licence Etalab.** La Licence Ouverte couvre les métadonnées de la BnF (data.bnf.fr, notices de Gallica), pas ses images.
- **Une peinture n'est pas une gravure.** Dans l'essai, une huile de Jeaurat (« Le marchand d'orviétan », Paris Musées, CC0) est remontée comme candidat : le traitement en hachures la rend illisible. Il faut filtrer sur la technique.

Sources :
- Gallica et BnF : [Pour les professionnels (tarifs et redevance)](https://www.bnf.fr/fr/pour-les-professionnels), [À propos de Gallica](https://gallica.bnf.fr/accueil/fr/html/a-propos), [Faire une utilisation commerciale d'une reproduction](https://www.bnf.fr/fr/faire-une-utilisation-commerciale-dune-reproduction), [discussion de la base légale (LinuxFr, 2014)](https://linuxfr.org/users/pamputt/journaux/conditions-d-utilisation-des-contenus-de-gallica)
- Article 14 : [directive 2019/790](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=celex:32019L0790), [état de la transposition (Europeana)](https://www.dataspace-culturalheritage.eu/en/news/article-14-and-the-public-domain-the-state-of-play-across-europe)
- Prorogations de guerre : [Livres Hebdo](https://www.livreshebdo.fr/article/la-duree-des-droits-dauteur-est-bien-de-70-ans), [Squire Patton Boggs](https://larevue.squirepattonboggs.com/Prorogations-de-guerre-et-duree-de-protection-des-oeuvres_a243.html)
- Commons : [Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- Musées : [Met Open Access](https://metmuseum.github.io/), [Rijksmuseum, politique de données](https://data.rijksmuseum.nl/policy), [Paris Musées, open content](https://parismusees.paris.fr/en/actualite/open-content-150000-works-from-the-museum-collections-of-the-city-of-paris-freely), [British Museum, droits des images](https://www.britishmuseum.org/terms-use/copyright-and-permissions/images-and-photography), [Wellcome Collection, droits des images](https://docs.wellcomecollection.org/collections-information/lQ0fMyP8xr8hWWJiQkfl/enquiries/images-and-copyright/copyright-images)
- Bibliothèques : [NYPL, API](https://api.repo.nypl.org/), [NYPL, annonce de 2016](https://www.infodocket.com/2016/01/06/impressive-new-york-public-library-releases-new-resourcecollection-more-than-180000-public-domain-images-free-to-shareuse/), [Library of Congress, limites](https://www.loc.gov/apis/json-and-yaml/working-within-limits/), [Flickr Commons, « No known copyright restrictions »](https://www.flickr.com/commons/usage/), [British Library sur Flickr (Public Domain Review)](https://publicdomainreview.org/collection/the-british-library-s-mechanical-curator-million/), [Internet Archive, droits](https://help.archive.org/help/rights/), [BHL, droits et réutilisation](https://about.biodiversitylibrary.org/help/copyright-and-reuse/)
- Encyclopédie : [droits Mazarine (Sorbonne Université, source secondaire)](https://moodle-lettres.sorbonne-universite.fr/moodle-2023/mod/wiki/view.php?id=71139), [ARTFL, chiffres et sources](https://encyclopedie.uchicago.edu/node/185)
- [Old Book Illustrations, conditions](https://www.oldbookillustrations.com/terms-of-use/)

### 2. Les API

| Source | Recherche | Téléchargement | Limites publiées | Constaté pendant l'essai |
|---|---|---|---|---|
| **Wikimedia Commons** | `api.php`, `generator=search` (CirrusSearch) en espace Fichier, `filetype:bitmap`. Licence, auteur et date dans `extmetadata` | Vignettes aux tailles standard seulement (250, 330, 500, 960, 1280, 1920, 3840 px), via `iiurlwidth` | Sans compte : 1 requête simultanée, moins de 5 par seconde. Médias : 2 téléchargements simultanés, 25 Mbit/s. User-Agent identifiable obligatoire | 429 avec un User-Agent générique et des appels rapprochés, plus aucun avec un User-Agent identifiable et une requête par seconde. Médiane 0,66 s par recherche, 90e centile 1,45 s |
| **Met** | `/public/collection/v1.1/search` (`q`, `hasImages`, `medium=Prints`), paginé par `offset` et `limit` | `primaryImageSmall` (JPEG) | 80 requêtes par seconde, sans clé | `/v1/search` est retiré depuis le 2026-10-01 (410). Certains identifiants renvoyés n'existent plus (404) |
| **Rijksmuseum** | `data.rijksmuseum.nl/search/collection` (titre, description, type, `imageAvailable`) | IIIF | Sans clé ; aucune limite publiée | Non testé (Commons héberge déjà une grande partie du fonds en CC0) |
| **Gallica** | SRU, API IIIF Image 1.1 et Présentation 2.0 | IIIF | « Accès ouvert sauf usage abusif », aucun quota publié | Bloqué par Cloudflare (403) depuis cette machine, même pour les pages de conditions. Exclu de toute façon (redevance) |
| **Library of Congress** | API JSON de loc.gov | Serveur d'images | Recherche : 20 requêtes par minute, puis blocage d'une heure. Images : 150 par minute | Non testé |
| **NYPL** | Digital Collections API | Oui | 10 000 requêtes par jour et par jeton, inscription requise | Non testé |
| **Europeana** | Search API, filtre de réutilisabilité | Selon le fonds | Clé gratuite | 401 sans clé |
| **Internet Archive** | `advancedsearch` | Oui | Aucune clé | Non testé ; ses images de livres sont déjà sur Commons et Flickr |

**Constat :** Commons sert de point d'entrée unique. On y retrouve les fonds du Met, du Rijksmuseum, de Paris Musées, de la BHL, de la Library of Congress, de Wellcome et les images de livres d'Internet Archive, avec la licence et la source lisibles par l'API. Dans l'essai, 80 % des résultats de la méthode retenue avaient une licence libre (PD, CC0, « No restrictions »).

### 3. L'appariement mot → gravure

**Essai :** 15 mots de la collection des Fondateurs (`content/releases/2026-10-20.1`) : 10 concrets, 3 pour « Caractères et travers » (escogriffe, coquefredouille, équanimité), 2 plus délicats (brimborion, turlupinade). Les requêtes sont écrites à la main pour imiter ce qu'un modèle tirerait de la définition. Le mot rare lui-même n'est jamais cherché, sauf quand il désigne un nom propre (Turlupin). La pertinence est jugée à la main sur le titre, la description et la licence des 6 premiers résultats de chaque requête ; 4 vignettes ont été regardées.

Trois façons de chercher :

- **A. Une longue requête du sens**, en anglais et en français, sur Commons et le Met (`probe.py plain`).
- **B. La même, avec « engraving » ajouté** (`probe.py style`).
- **C. Trois requêtes courtes par mot**, de 1 à 3 mots, avec un terme de gravure et, pour les animaux, le nom latin, sur Commons seulement (`probe.py multi`).

Résultats :

| Méthode | Pertinent (gravure libre qui montre le sens) | Partiel | Rien |
|---|---|---|---|
| A. Longue requête | 5 / 15 | 7 | 3 |
| B. « engraving » ajouté | moins bon que A : 13 requêtes sur 30 sans résultat | — | — |
| C. Requêtes courtes multiples | **11 / 15** (6 sur les 10 premiers) | 3 | 1 |

- **A** : Commons renvoie surtout des photos modernes en CC BY-SA (émeu de 2021, garde-côtes japonais pour « sabord »). Le Met trouve des estampes, mais ses résultats sont maigres (5 requêtes sur 15 vides).
- **B** : Commons exige que chaque terme soit présent, donc une longue requête plus « engraving » ne trouve souvent plus rien.
- **C** : un terme de gravure dans une requête courte oriente vers les estampes, et plusieurs angles rattrapent les échecs. Le nom latin ouvre les planches de la BHL (marsouin : *Phocoena*, 1780).

Détail de la méthode C :

| Mot | Verdict | Meilleur candidat (licence) |
|---|---|---|
| casoar | Pertinent | « Engraving Casuarius casuarius », E. Evans (PD) ; planches de la BHL |
| clepsydre | Pertinent | Gravure de clepsydre, Montucla 1778 (PD) |
| cabasset | Partiel | Photos de casques du Met (CC0) : un objet, pas une gravure |
| lavandière | Pertinent | Cochin, « The Washerwoman », 1739 (Met, CC0) ; Lepère 1895 (PD) |
| orviétan | Pertinent | Helman, « Le charlatan françois », 1777 (Paris Musées, CC0) ; « Street vendor selling Orvietan », 1893 (PD) |
| défourner | Partiel | Boulangers génériques (Rijksmuseum, CC0). Le geste exact seulement chez Wellcome (CC BY 4.0) |
| époussette | Rien | — |
| escogriffe | Pertinent | « Caricature of a Tall Thin Man Carrying a Book », 1885 (Met, CC0) |
| coquefredouille | Pertinent | Daumier, « Mr Vieux-Niais », 1833 (Paris Musées, CC0) ; les fous de Beham |
| équanimité | Partiel | Allégories de la Tempérance (Met, CC0) : proche, pas juste |
| marsouin | Pertinent | Planche « Phocoena phocoena », 1780 (BHL, PD) |
| sabord | Pertinent | Van de Velde le Jeune, « A wreathed gunport », vers 1686 (PD) |
| glanure | Pertinent | Doré, « The Gleaners », Bible (PD) |
| brimborion | Pertinent | « Mes bon colifichets », Cris de Paris, 1774 (Paris Musées, CC0) |
| turlupinade | Pertinent | « Gaultier-Garguille, Gros-Guillaume et Turlupin » (PD) ; Bosse, Hôtel de Bourgogne (CC0) |

**Les mots abstraits (« Caractères et travers »).** La caricature et la scène de genre marchent bien, l'allégorie moins. Pour cette collection, il vaut mieux constituer d'avance une **banque de gravures de caractère**, choisie à la main une fois, dans laquelle le modèle pioche quand la recherche ne donne rien. Tous ces artistes sont dans le domaine public :
- Le Brun, *Expressions des passions* (mort en 1690) ;
- Lavater, *L'Art de connaître les hommes par la physionomie* (1801) ;
- les *Grimaces* de Boilly (1845) ;
- Grandville, *Les Métamorphoses du jour* (1847) ;
- Daumier, *Robert Macaire*, *Les Gens de justice* (1879) ;
- Gavarni (1866), Traviès (1859), Henry Monnier (1877), Cham (1879) ;
- Callot, *Les Gueux* et *Balli di Sfessania* (1635) ;
- Abraham Bosse (1676), les *Cris de Paris* ;
- Hogarth (1764), Gillray (1815), Rowlandson (1827), Cruikshank (1878), à prendre au Met en CC0 plutôt qu'au British Museum.

Pour « Métiers et objets disparus », les planches de l'Encyclopédie sont la meilleure source, puisque leurs légendes nomment chaque outil. Les légendes de l'ARTFL servent d'index pour trouver la planche ; l'image vient d'une copie réutilisable (Wellcome en CC BY 4.0, Commons, Internet Archive), pas d'ENCCRE ni de l'ARTFL. Sur Commons, ces planches sont mal décrites et difficiles à trouver par mot-clé (essai : presque rien pour « Encyclopédie boulanger planche »). Un index des planches reste donc à construire.

**Méthode proposée** (dans `content/pipeline`, comme les autres étapes) :

1. **Requêtes** : un modèle tire de la définition 4 à 6 requêtes courtes en français et en anglais, plus le nom latin pour la nature, et indique si le mot est concret ou abstrait.
2. **Recherche** : Commons, une requête par seconde. On garde les licences PD, CC0, PDM, « No restrictions » et CC BY 4.0. On écarte CC BY-SA, NC, les sources Gallica, BnF et British Museum, les auteurs morts après 1955 (date de mort lue dans Wikidata quand le fichier a un créateur) et les œuvres datées après 1930 sans auteur identifié. On dédoublonne et on garde jusqu'à 8 candidats en vignettes de 500 px.
3. **Choix assisté** : un modèle de vision reçoit la définition et les 8 vignettes. Il répond en JSON : le meilleur candidat ou « aucun », une note, si l'image est bien une gravure ou un dessin au trait (et non une peinture ou une photo), s'il y a un cachet ou une légende à couper, et un cadrage proposé.
4. **Validation humaine dans Directus** : galerie des candidats, choix du modèle présélectionné, cadrage modifiable, aperçu traité. À défaut de bon candidat : recherche à la main, banque de caractère, ou carte sans gravure (l'initiale actuelle).
5. **Traitement et publication** : voir les parties 4 et 5.

**Coût estimé des modèles pour 1 500 mots** (non mesuré ; tarifs de l'API en octobre 2026). Une image coûte environ largeur × hauteur / 750 jetons, soit environ 400 jetons pour une vignette de 500 × 600 ([documentation vision](https://platform.claude.com/docs/en/build-with-claude/vision)). Un appel de choix envoie environ 4 000 jetons (8 vignettes et la définition) et en reçoit environ 800 (avec la réflexion).

| Étape | Haiku 5.5 (0,10 $ / 0,50 $ par million) | Sonnet 5.5 (2 $ / 10 $) | Opus 5.5 (4 $ / 20 $) |
|---|---|---|---|
| Requêtes (environ 700 jetons envoyés, 300 reçus) | 0,30 $ | 6,60 $ | 13 $ |
| Choix sur image | 1,20 $ | 24 $ | 48 $ |
| Avec l'API Batch (moitié prix) | moins de 1 $ | 15 $ | 30 $ |

Mesuré ensuite sur 50 mots (partie 6), pour le choix sur image seulement :
- Sonnet 5.5 : 8,60 $ pour 1 500 cartes avec des vignettes de 330 px, environ 17,50 $ avec 8 vignettes de 500 px, moitié prix en batch ;
- Haiku 5.5 : 0,89 $ et environ 1,35 $.
- Sonnet réfléchit peu sur cette tâche (150 jetons de sortie), Haiku davantage (765).

**Temps humain estimé :**
- 15 à 30 s par carte quand le choix du modèle est bon ;
- 2 à 4 min quand il faut chercher à la main.
- Avec 70 % de bons choix : environ 7 h pour 1 050 cartes et 22 h pour les 450 autres, soit **une trentaine d'heures pour le lancement**.
- Si les échecs restent provisoirement sans gravure : environ 8 h.
- Pour 300 cartes par semaine : 2 à 6 h par semaine.

### 4. Le traitement « Planche populaire »

Essai sur 4 images (`treat.py`) :
- casoar (gravure sur bois, PD) ;
- « Mr Vieux-Niais » de Daumier (lithographie, CC0) ;
- sabord de Van de Velde (dessin à la plume, PD) ;
- « Le marchand d'orviétan » (huile, CC0), comme contre-exemple.

Pipeline :

1. **Niveaux de gris, puis correction du fond** : chaque pixel est divisé par un flou large de l'image. Le papier jauni, les taches et les rousseurs deviennent blancs ; les traits restent.
2. **Rognage des marges** : boîte englobante de l'encre, après un filtre médian qui ignore les poussières.
3. **Courbe raide** entre deux seuils (110 et 205) plutôt qu'un seuillage net : les hachures restent, les bords restent lissés.
4. **Sortie : l'encre seule**, en noir avec transparence. Les couleurs ne sont pas dans le fichier : la carte les prend dans les jetons de rareté au moment de l'affichage. Sur le web, `mask-image` et la couleur `ink` ; sur mobile, la propriété `tintColor` d'`expo-image`, déjà installé. Un seul fichier sert donc aux cartes crème et aux cartes de nuit (encre claire sur fond sombre pour Épique et Légendaire).
5. **Aplat de couleur** : deux essais.
   - Silhouette floutée du sujet derrière l'encre : informe et peu fiable (le paysage du casoar en reçoit autant que l'oiseau).
   - **Médaillon** : un disque de la couleur de rareté, légèrement décalé, avec la gravure contenue dans l'encart et fondue en ovale sur le papier. Lisible, reproductible, sans détourage, et aucun sujet n'est coupé.

Résultats :
- Les vraies gravures et lithographies (casoar, Daumier, sabord) passent très bien.
- La peinture devient une bouillie sombre : il faut la filtrer en amont.
- Daumier garde son cadre, sa légende et le cachet du musée : le cadrage doit être fixé à la validation, proposé par le modèle.
- L'encart du web est très large (272 × 118, rapport 2,3) : un sujet en hauteur n'en occupe que le tiers central. Un recadrage serré coupait la tête du casoar.

**Poids et temps** (encre seule, WebP qualité 80, transparence avec perte à 60, méthode 4 ; AMD Ryzen 7 5700X, Pillow 12.1.1, NumPy 2.5.4) :

| Image | Hauteur 360 px (encart en 3x) | Hauteur 720 px (vue agrandie) | Traitement | Encodage WebP 360 px |
|---|---|---|---|---|
| casoar | 30 Ko | 101 Ko | 128 ms | 27 ms |
| Daumier | 12 Ko | 48 Ko | 243 ms | 7 ms |
| sabord | 14 Ko | 37 Ko | 135 ms | 11 ms |
| orviétan (peinture) | 30 Ko | 109 Ko | 383 ms | 13 ms |

- **AVIF n'apporte rien ici** : de -9 % à +17 % selon l'image, et 2 à 4 fois plus lent à encoder. Les hachures fines sont du bruit pour lui.
- **La transparence en WebP sans perte double le poids** (29 à 70 Ko à 360 px).
- Retenu : **WebP seul**, en deux hauteurs (360 et 720 px), 12 à 30 Ko pour l'encart.
- Pour 1 500 cartes : 30 à 45 Mo pour l'encart et 110 à 150 Mo pour les vues agrandies.

### 5. Stockage et service

- **Nommage par empreinte**, comme le catalogue (D-023) : `gravures/<carte>.<empreinte12>.<hauteur>.webp`. Le fichier ne change jamais et se met en cache sans limite.
- **Champ ajouté à la carte** (ajout rétrocompatible au schéma de `packages/contract`) : `engraving: { file, width, height, credit, sourceUrl, licence }`. Un ancien client ignore le champ.
- **Reproductible** : on garde l'original téléchargé, le cadrage validé et une version de traitement. Changer la recette (seuils, aplat) régénère tout à l'identique, sous de nouvelles empreintes.
- **R2, servi par le CDN** (D-005) :
  - 0,015 $ par Go et par mois au-delà de 10 Go gratuits ;
  - aucun frais de sortie ;
  - 0,36 $ par million de lectures au-delà de 10 millions gratuites par mois ([tarifs R2](https://developers.cloudflare.com/r2/pricing/)).
  - Les 200 Mo du lancement tiennent dans l'offre gratuite.
- **En local**, comme le catalogue : `apps/web/public/catalog/gravures/`, ignoré par git. Les binaires ne vont pas dans `content/releases`, qui est versionné.
- **Crédits** : une page de crédits dans l'app (comme pour le Littré), et sur la vue détaillée de la carte une ligne du type « D'après Daumier, 1833 · Paris Musées (CC0) ». Pour une image en CC BY 4.0, cette ligne est obligatoire, avec la licence.

### 6. Mesure des modèles de vision (50 mots)

**Protocole :**

- **Mots** : 17 de « Caractères et travers » (`caracteres-1`), 17 de « Métiers et objets disparus » (`metiers-1`), 16 des Fondateurs (13 publiés dans `2026-10-20.1`, 3 de `fondateurs-2`). Aucun des 15 mots de l'essai précédent. Concrets et abstraits mêlés.
- **Recherche** (`vision_fetch.py`) : méthode C, trois requêtes courtes écrites à la main par mot, sur Commons seulement. Filtre strict :
  - licences PD, CC0, PDM, « No restrictions » ou CC BY 4.0 ;
  - ni Gallica, ni BnF, ni British Museum (titre, description, source, auteur) ;
  - auteur mort avant 1956, et œuvre datée après 1930 écartée si l'auteur est inconnu.
- **Candidats** : jusqu'à 6 par mot, pris tour à tour dans chaque requête, en vignettes de 330 px. Une requête à la fois, une par seconde.
- **Résultat de la recherche** :
  - 1 086 résultats, dont 431 écartés : 193 pour la licence, 121 pour la source (Gallica surtout), 117 récents sans auteur connu ;
  - 267 vignettes gardées, 5,6 par mot en moyenne ;
  - 2 mots sans aucun candidat : lucubrateur, pagure.
- **Modèles** (`vision_eval.py`) : Sonnet 5.5 et Haiku 5.5, effort `medium`, sortie JSON imposée par un schéma.
  - Même consigne et mêmes images pour les deux : le mot, sa définition, puis les vignettes numérotées.
  - Réponse : numéro du candidat ou « aucun », note de pertinence, technique du candidat choisi et de chacun des autres.
  - La consigne refuse les peintures, les photos et les thèmes seulement voisins, et préfère « aucun » à une image fausse.
  - Deux passes complètes par modèle, pour mesurer la stabilité.
- **Référence** (`out/vision/reference.json`) : établie à l'œil sur chaque planche de vignettes, avant de lancer les modèles, avec trois conditions :
  - le candidat montre le sens du mot, pas un thème voisin ;
  - c'est une gravure, une lithographie ou un dessin au trait ;
  - il reste lisible en petit.
- **Ce que donne la référence** :
  - 31 mots sur 50 ont au moins un bon candidat : 12 sur 17 pour les caractères, 8 sur 17 pour les métiers, 11 sur 16 pour les Fondateurs ;
  - 17 mots ont des candidats, mais aucun qui convienne.
  - Un seul juge : la référence est stricte et discutable au cas par cas (voir les exemples).

**Résultats** (48 mots ayant des candidats ; deux passes par modèle) :

| Mesure | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|
| Bonne réponse : bon candidat, ou « aucun » à raison | **41 et 39 sur 48 (85 %, 81 %)** | 35 et 35 sur 48 (73 %) |
| Bon candidat choisi, quand il en existe un (31 mots) | **29 et 28 (94 %, 90 %)** | 25 et 25 (81 %) |
| Précision des propositions (choix justes / choix faits) | 83 %, 78 % | 69 %, 69 % |
| « Aucun » à raison (17 mots sans bon candidat) | 12, 11 | 10, 10 |
| « Aucun » à tort | 1, 1 | 2, 2 |
| Mauvais candidat alors qu'un bon existait | 1, 2 | 4, 4 |
| Proposition alors qu'aucun ne convenait | 5, 6 | 7, 7 |
| Peinture choisie (20 peintures parmi les candidats) | **0, 0** | **0, 0** |
| Photo choisie (35 photos parmi les candidats) | 1, 1 | 2, 2 |
| Peintures reconnues comme telles | 18 et 18 sur 20 | 19 et 20 sur 20 |
| Même réponse d'une passe à l'autre | 45 sur 48 (94 %) | 43 sur 48 (90 %) |
| Jetons par carte (entrée, sortie avec réflexion) | 2 115, 150 | 2 115, 765 |
| Coût réel par carte | 0,0057 $ | 0,0006 $ |
| Latence médiane (90e centile) | 2,4 s (4,0 s) | 5,7 s (6,7 s) |
| 1 500 cartes, vignettes de cet essai (≤ 6 en 330 px) | 8,60 $, **4,30 $ en batch** | 0,89 $, 0,45 $ en batch |
| 1 500 cartes, 8 vignettes de 500 px (méthode proposée) | environ 17,50 $, 8,80 $ en batch | environ 1,35 $, 0,70 $ en batch |

- **Coût réel** : calculé à partir de l'usage renvoyé par l'API, aux tarifs de `llm.py`.
- **Extrapolation à 8 vignettes de 500 px** : l'API compte environ largeur × hauteur / 750 jetons par image, soit 214 par vignette de 330 px dans cet essai (mesuré avec `count_tokens`) et environ 490 en 500 px. La consigne et le schéma pèsent environ 1 200 jetons.
- **Mesure complète** (4 passes de 48 appels, pilotes compris) : **0,61 $**.

**Exemples parlants :**

- **Jamais de peinture.** Pour jaqueline (cruche de grès), les candidats sont des photos de cruches du Met et des natures mortes peintes. Les deux modèles répondent « aucun » aux deux passes. Même chose pour grivoiser (râpes à tabac, en photo) et papillonage (allégories peintes de Bellini et Giotto).
- **Le bon sujet, quand il existe.**
  - girouetterie : une girouette à tête d'homme politique ;
  - picrochole : l'*Ira* de Callot ;
  - éventaillier et dépâtisser : les planches de l'Encyclopédie (copies Wellcome et Rijksmuseum) ;
  - schlague : « Corporal Schlague », trouvé par Haiku à la seconde passe.
- **Haiku rate des cas que Sonnet trouve.**
  - scramaison : verriers au four ; Haiku répond « aucun » ;
  - afflouer : un Indiaman échoué ; Haiku répond « aucun » ;
  - cromlek : Haiku choisit un dolmen, que l'anglais appelle *cromlech* ;
  - éteignoir : Haiku choisit des mouchettes au lieu de la « Famille des Éteignoirs » de Devéria. Sonnet fait la même erreur à sa seconde passe.
- **L'erreur commune : un thème voisin quand rien ne convient.**
  - cominge : un placard de 1686 sur un mortier, couvert de texte ;
  - barillard : une galère sans son barillard ;
  - calebottin : un atelier de cordonnier, sans le panier à fil ;
  - tillotter : une carte postale photographique de teillage (Sonnet).
  - Ces propositions se rejettent en quelques secondes à la validation.
- **Les cas discutables.**
  - cromlek : Sonnet refuse les dolmens, la référence accepte un plan de cercle de pierres ;
  - schlague : les deux modèles choisissent la *Spießgasse* de Jost Amman (passage par les piques), voisine du sujet sans être la bastonnade.
- **Deux ratés du filtre de droits sur 267 vignettes.**
  - Une carte d'éventailliste du British Museum, nommée « BM Heal,60.11 », que le motif « (BM 2012,… » ne reconnaissait pas ;
  - une planche de J. F. Horrabin, mort en 1962, sans lien vers Wikidata.
  - Les données structurées de Commons (créateur, P170) étaient vides pour tous les fichiers vérifiés : la date de mort ne se lit que dans le texte de l'auteur. La validation humaine doit donc revoir les droits, et le filtre doit être durci (motif « (BM », champ de source, recherche de l'auteur par son nom).
- **Les animaux par leur nom latin.**
  - pagure et diabloteau ne remontent que des photos sous CC BY-SA, et l'avion Blackburn Skua.
  - Il faut toujours ajouter un terme de planche (« plate », « illustration ») au nom latin, comme « Casuarius plate » dans le premier essai.

**Recommandation : Sonnet 5.5**, effort `medium`, par l'API Batch.

- **Meilleur sur tous les critères de choix** :
  - 4 bons choix de plus sur 31 ;
  - deux fois moins d'erreurs quand un bon candidat existe ;
  - moins de propositions inutiles ;
  - un peu plus stable d'une passe à l'autre.
- **Coût pour 1 500 cartes** : 4 à 9 $ selon la taille des vignettes.
- **Haiku coûte dix fois moins, mais pas en temps humain** : sur 1 500 cartes, ses choix ratés feraient environ 110 cartes de plus à chercher à la main (3,5 bons choix de moins sur 50), soit 4 à 7 h de plus pour moins de 10 $ d'économie.
- **Haiku est aussi plus lent** (5,7 s contre 2,4 s), car il réfléchit cinq fois plus longtemps.
- **Validation de chaque gravure** : nécessaire avec l'un comme avec l'autre. Une proposition sur cinq reste fausse, surtout des thèmes voisins, et le filtre de droits laisse passer quelques fichiers.

## Résultats

| Option | Droits | Automatisation | Couverture (essai, 15 mots) | Coût modèles (1 500 cartes) | Rendu | Poids (encart 3x) |
|---|---|---|---|---|---|---|
| Gallica | Payant (environ 75 € par image) | IIIF, mais bloqué par Cloudflare depuis ici | Non testé | — | — | — |
| Commons, longue requête du sens | Bon après filtrage des licences | API, 1 req/s | 5 / 15 | — | — | — |
| **Commons, requêtes courtes multiples** | Bon après filtrage (80 % de résultats libres) | API, 1 req/s, médiane 0,66 s | **11 / 15**, 3 partiels | 1 à 30 $ selon le modèle | — | — |
| Commons, même méthode, mesure sur 50 mots | 2 ratés du filtre sur 267 vignettes | API, 1 req/s, médiane 0,77 s | **31 / 50** (62 %), 2 mots sans candidat | — | — | — |
| Présélection par Sonnet 5.5 | — | JSON, 2,4 s par carte | Bon choix pour 29 des 31 mots qui en ont un ; 85 % de bonnes réponses | **8,60 $, 4,30 $ en batch** (mesuré, vignettes de 330 px) | — | — |
| Présélection par Haiku 5.5 | — | JSON, 5,7 s par carte | Bon choix pour 25 sur 31 ; 73 % de bonnes réponses | 0,89 $, 0,45 $ en batch (mesuré) | — | — |
| Met seul | CC0 | API, 80 req/s | 5 requêtes sur 15 vides | — | — | — |
| Traitement « encre seule + médaillon » | — | Automatique, moins de 0,5 s par image | — | 0 $ | Bon sur gravures et lithographies, mauvais sur peintures | 12 à 30 Ko (WebP) |

## Recommandation

Chercher sur **Wikimedia Commons** par **requêtes courtes multiples générées depuis la définition**, avec un filtre strict :
- licences PD, CC0 ou CC BY 4.0 ;
- auteur mort avant 1956 ;
- ni Gallica, ni BnF, ni British Museum.

Puis faire **présélectionner par Sonnet 5.5** (partie 6), valider chaque gravure dans Directus, et **publier l'encre seule en WebP**, colorée par la carte selon sa rareté, dans un **médaillon de couleur**.

- **Couverture** : un bon candidat pour 11 mots sur 15 dans le premier essai, et 31 sur 50 dans la mesure à plus grande échelle (62 %, sous le seuil de 70 %). Aucune redevance.
- **Présélection** : quand un bon candidat existe, Sonnet le choisit 9 fois sur 10, pour 4 à 9 $ les 1 500 cartes en batch.
- **Seule dépense notable, le temps de validation** : avec environ 57 % des cartes bien présélectionnées, 4 à 7 h pour les valider ; 21 à 43 h de plus pour chercher les autres à la main, ou environ 8 h en tout si elles restent provisoirement sans gravure.

**À faire trancher par le propriétaire :**

1. **Modèle de vision pour la présélection** : Haiku 5.5 (0,45 à 0,70 $ en batch) ou Sonnet 5.5 (4,30 à 8,80 $ en batch). Mesure faite sur 50 mots. Recommandation : **Sonnet 5.5**, qui trouve 29 bons candidats sur 31 contre 25 pour Haiku, et fait gagner plus de temps de validation qu'il ne coûte.
2. **Validation** : chaque gravure, ou seulement un échantillon comme D-021 (au risque d'images fausses en ligne). Recommandation : **chaque gravure**. La précision mesurée des propositions de Sonnet est de 78 à 83 %, loin des 90 % qui permettraient un échantillon, et le filtre de droits laisse passer quelques fichiers (2 sur 267).
3. **Mots sans gravure** : publier avec l'initiale actuelle, ou attendre la gravure. Recommandation : publier, et compléter plus tard.
4. **Banque de gravures de caractère**, choisie à la main pour les mots abstraits, et droit de réutiliser une même gravure sur deux ou trois cartes. Recommandation : oui pour la banque, réutilisation limitée à « Caractères et travers ».
5. **Direction artistique** : aplat en médaillon (proposé) ou détourage du sujet ; agrandir l'encart (aujourd'hui 272 × 118) pour les sujets en hauteur.
6. **Juriste** (déjà prévu par D-019) : copies Gallica et British Museum sur Commons, et crédits exigés.

**Dépendances à proposer, pas à installer :**
- **Chaîne Python** :
  - `pillow` (traitement, WebP) ;
  - `numpy` (correction du fond) ;
  - plus tard, en option : `opencv-python-headless` (effacer les cachets, seuillage adaptatif) et `rembg` (détourage, modèle ONNX lourd), seulement si le médaillon ne suffit pas.
  - `httpx` et `anthropic` y sont déjà.
- **Web et mobile** : aucune (`mask-image` en CSS, `tintColor` d'`expo-image` déjà installé).
- **Envoi vers R2** : à décider avec la mise en production du catalogue (D-005, D-023).

**Reste à vérifier :**
- la couverture avec des requêtes générées par un modèle (4 à 6 par mot, terme de planche ajouté au nom latin) plutôt que les trois requêtes écrites à la main de la mesure ;
- un filtre de droits durci : motif « (BM » et champ de source pour le British Museum, date de mort de l'auteur cherchée par son nom ;
- un index des planches de l'Encyclopédie pour « Métiers et objets disparus », où la mesure ne trouve un bon candidat que pour 8 mots sur 17 ;
- le rendu réel dans le composant de carte (web et Expo), surtout sur les cartes de nuit ;
- l'avis du juriste sur les points ci-dessus.

## Pour reproduire

Machine : AMD Ryzen 7 5700X (8 cœurs), Arch Linux, Python 3.14.8, Pillow 12.1.1 (AVIF intégré), NumPy 2.5.4. Les scripts n'utilisent que la bibliothèque standard, plus Pillow et NumPy pour le traitement. Ils écrivent dans `rnd/gravures/out/`, ignoré par git.

```bash
python3 rnd/gravures/probe.py plain   # A : longue requête du sens, Commons et Met
python3 rnd/gravures/probe.py style   # B : la même avec « engraving »
python3 rnd/gravures/probe.py multi   # C : trois requêtes courtes par mot, Commons
# out/candidates-<méthode>.json : 6 premiers résultats par requête, licence, date, temps de réponse

python3 rnd/gravures/fetch_thumbs.py  # les 4 vignettes de 1 280 px de l'essai de traitement
python3 rnd/gravures/treat.py         # aperçus et fichiers WebP/AVIF dans out/treated/, poids et temps
```

Pour les parties 1 à 5, la pertinence a été jugée à la main sur les métadonnées des résultats et sur 4 vignettes, sans appeler de modèle.

Mesure des modèles de vision (partie 6). Les mots et leurs requêtes sont dans `vision_words.py`. Les appels au modèle passent par l'environnement `uv` de `content/pipeline`, qui lit la clé dans `.env` ; aucune dépendance n'est ajoutée au projet. anthropic 1.15.0, Python 3.13.12.

```bash
python3 rnd/gravures/vision_fetch.py    # 150 recherches Commons, filtre, vignettes de 330 px (environ 35 min)
python3 rnd/gravures/vision_sheets.py   # une planche numérotée par mot, pour la référence faite à l'œil
cd content/pipeline
uv run python ../../rnd/gravures/vision_eval.py estimate                    # coût estimé, sans appel
uv run python ../../rnd/gravures/vision_eval.py run claude-sonnet-5-5       # puis claude-haiku-5-5 ; --tag pass2 pour une seconde passe
cd ../..
python3 rnd/gravures/vision_score.py    # tableau de résultats contre out/vision/reference.json
```

`vision_eval.py` reprend là où il s'est arrêté et refuse de dépasser `--budget` (1,80 $ par défaut, tous les fichiers de résultats comptés).
