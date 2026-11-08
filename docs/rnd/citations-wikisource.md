# R&D · Citations tirées de Wikisource

- **Décision liée :** D-021 (chaîne de contenu), sources du skill `carte-mot`
- **Dates :** 2026-11-08 → 2026-11-08
- **Question :** Wikisource donne-t-il une citation juste aux cartes que le Littré laisse sans citation ?

## Contexte

Les citations des cartes viennent toutes du Littré. Dans la version 2026-11-08.6, beaucoup de cartes n'en ont pas :

| Collection | Cartes | Entrée du Littré avec au moins une citation | Cartes avec citation |
|---|---|---|---|
| Bêtes et plantes | 504 | 99 | 90 (18 %) |
| Métiers et objets disparus | 503 | 127 | 101 (20 %) |
| Les Fondateurs | 519 | 170 | 159 (31 %) |
| Caractères et travers | 539 | 304 | 292 (54 %) |

La chaîne prend déjà presque toutes les citations que le Littré offre (9 seulement laissées de côté dans Bêtes et plantes). Pour en avoir plus, il faut une autre source.

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Couverture | au moins 40 % des cartes sans citation en reçoivent une |
| Exactitude | 100 % des citations identiques au texte source, au mot près, coupures marquées « .... » |
| Droits | 100 % d'auteurs morts avant 1956, ou de textes publiés avant 1871 |
| Sens | 100 % des citations prennent le mot dans le sens de la carte |
| Coût | pas d'appel payant à l'API |

## Méthode testée

50 cartes de Bêtes et plantes sans citation, tirées au hasard (graine 1, `rnd/citations-wikisource/cards.json`).

1. **Recherche :** `rnd/citations-wikisource/fetch.py` cherche le mot entre guillemets dans l'espace principal de fr.wikisource. Il écarte les tables, index et dictionnaires, et garde 6 pages au plus. De chaque page, il garde les 3 premières phrases qui contiennent la forme trouvée.
2. **Droits :** l'auteur et l'année de publication sont lus dans le bloc caché `ws-data` de la page. L'année de mort de l'auteur vient de Wikidata, par sa page « Auteur: ». Une page passe si l'auteur est mort en 1955 au plus tard, ou si le texte est paru en 1870 au plus tard (même un auteur inconnu ne peut alors avoir vécu au-delà de 1955).
3. **Choix :** deux agents Claude Code, 25 cartes chacun, gardent au plus une phrase par carte. La consigne : le mot au sens de la carte, ni nom propre, ni renvoi, ni définition de dictionnaire ; 300 caractères au plus ; texte recopié tel quel, orthographe ancienne comprise ; aucune traduction, car les droits du traducteur ne se vérifient pas.
4. **Contrôle mécanique :** `rnd/citations-wikisource/check.py` vérifie que chaque citation se retrouve mot pour mot dans la phrase source, que les droits passent, que le mot y figure et la longueur.
5. **Relecture :** une relecture humaine des citations retenues.

## Résultats

| Étape | Cartes |
|---|---|
| Au moins une page Wikisource où le mot apparaît | 38 sur 50 |
| Au moins une page libre de droits | 35 sur 50 |
| Citation retenue par les agents | 19 sur 50 (38 %) |
| Citation qui passe le contrôle mécanique | 19 sur 19 |
| Citation bonne à la relecture | 16 sur 19 |

Exemples retenus :

- fenasse : « Je vous prie d'ordonner qu'on refasse le talus que les eaux avaient emporté vers la Brandie, qu'on le sème de fenasse » (Voltaire) ;
- chènevis : « Qui ne connaît les extravagances des poules qui ont mangé des graines de chènevis » (Baudelaire) ;
- murex : « Emprunter au murex sa pourpre tyrienne » (André Chénier) ;
- grondin : « Un grondin gronde » (Georges Fourest).

Les auteurs viennent surtout d'ouvrages d'histoire naturelle et d'agriculture (Buffon, Rozier, Sonnini, Daubenton dans l'Encyclopédie). Il y a aussi des écrivains : Voltaire, Baudelaire, Chénier, Colette, Raynal.

À la relecture, 3 citations sont faibles :
- grenadille : 230 caractères, sèches ;
- bernacle et castagneux : des tournures de définition (« On a appellé… »).

Pourquoi 31 cartes n'ont rien :
- **Aucune page sur Wikisource :** 12.
- **Seulement un autre sens ou une coquille de la transcription :** 10. Par exemple :
  - « luites » pour « luttes » ;
  - vêle seulement comme verbe ;
  - cochonnée seulement comme adjectif ;
  - ageasse glosé « une pie » par George Sand.
- **Seulement des définitions, des listes, des noms propres ou des noms de lieu :** 7.
- **Seulement une page sans auteur ni date, ou une traduction :** 2 (forpaiser chez du Fouilloux cité par Nicot, gaour chez Darwin traduit).

Temps : environ une heure pour 50 cartes, dont 17 minutes de recherche (3 cartes par minute, limitées par les appels à l'API de Wikisource). Coût d'API : nul.

## Recommandation

Adopter Wikisource comme seconde source de citations. L'essai donne 38 % de cartes en plus avec une citation (32 % après relecture), juste sous le seuil de 40 %. Aucune erreur d'exactitude ni de droits, grâce au contrôle mécanique.

Appliqué à Bêtes et plantes, cela ferait passer la collection d'environ 18 % à environ 45 % de cartes avec citation. Les autres collections, aux mots plus littéraires, devraient faire au moins aussi bien.

Avant de l'étendre à tout le catalogue :

- **Couverture :** chercher aussi le mot sans guillemets, pour trouver les pluriels et les formes conjuguées. Garder 10 pages au lieu de 6.
- **Éviter les tournures de définition :** écarter la page de l'Encyclopédie qui porte le mot comme titre d'article.
- **Inscrire Wikisource parmi les sources autorisées** du skill `carte-mot`. Seul le texte du domaine public est repris, jamais les notes ni les introductions modernes.
- **Garder la relecture humaine des citations**, ou au moins d'un échantillon, comme pour les cartes. Les transcriptions de Wikisource peuvent garder des coquilles d'OCR.

## Pour reproduire

```bash
uv run --project content/pipeline python rnd/citations-wikisource/fetch.py rnd/citations-wikisource/cards.json rnd/citations-wikisource/candidates.json
python3 rnd/citations-wikisource/check.py rnd/citations-wikisource/candidates.json rnd/citations-wikisource/picks.json
```

Machine du propriétaire (Arch Linux), API fr.wikisource et Wikidata du 2026-11-08. Les choix des agents sont dans `rnd/citations-wikisource/picks.json` ; la consigne donnée aux agents y est résumée à l'étape 3.
