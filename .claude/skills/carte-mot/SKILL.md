---
name: carte-mot
description: Rédiger, enrichir ou relire le contenu d'une carte Leximon (mot rare ou ancien du français, ou expression). À utiliser pour écrire une définition, une étymologie, choisir une citation ou une illustration, contrôler une carte, ou faire tourner la chaîne de contenu sur des lots de mots.
---

# Rédiger ou relire une carte-mot

Une erreur publique sur un mot coûte cher en crédibilité. On préfère une carte incomplète et signalée à une carte inventée.

## Champs d'une carte

| Champ | Règle |
|---|---|
| `lemma` | Graphie de référence. Variantes anciennes dans `variants` |
| `pos` | Catégorie grammaticale abrégée : n. m., n. f., adj., v. tr., loc.… |
| `era` | Siècle de première attestation connue, ou période d'usage principal |
| `definition` | Rédaction maison, 25 mots maximum, en français moderne et clair |
| `etymology` | Courte. Si elle n'est pas établie, écrire « origine incertaine » |
| `quote` | Citation d'un auteur mort depuis plus de 70 ans, avec auteur, œuvre et date |
| `sources` | Les dictionnaires anciens consultés, avec édition et entrée |
| `frequency` | Fréquence Google Ngram, en occurrences par milliard de mots (1990-2019). Calculée par la chaîne, affichée discrètement sur la carte |
| `pepite` | Mot rare qui a du charme ou une histoire. Choisie par la chaîne d'après les notes de charme d'un jury automatique, dans les proportions de la pyramide (D-021), jamais cochée à la main. Seule une pépite peut être Épique ou Légendaire |
| `rarity` | Calculée par la chaîne à partir de `frequency` et `pepite` (D-020, D-021), jamais choisie à la main. Figée une fois la carte publiée (la base le refuse) : un mot reclassé devient une nouvelle carte |
| `collection` | Une collection principale, d'autres en tags |
| `illustration` | Fichier issu d'une source autorisée, avec l'URL d'origine et la licence |

## Sources

**Autorisées :**
- le Littré via XMLittré (`content/pipeline/data/littre/`) : texte brut uniquement, crédit « XMLittré, François Gannaz (littre.org) » ;
- autres dictionnaires du domaine public : Académie jusqu'à la 8e édition (1935), Godefroy, Furetière, Trévoux, Larousse du XIXe, à partir de transcriptions réutilisables (pas les scans Gallica) ;
- Wikidata (lexèmes, CC0) ;
- fréquences : Google Books Ngram (CC BY, à créditer), Lexique 3.83 (CC BY-SA, scores dérivés seulement) ;
- illustrations : Met Open Access, Rijksmuseum, Paris Musées (CC0), Wikimedia Commons uniquement si le fichier est marqué domaine public ou CC0.

**À n'utiliser que pour repérer ou vérifier, sans rien reprendre :** Wiktionnaire (CC BY-SA). Ses catégories servent à trouver des candidats ; ses textes ne doivent pas se retrouver dans une carte.

**Interdites :**
- TLFi, CNRTL, Frantext (tous droits réservés) ;
- images Gallica (réutilisation commerciale payante) ;
- dictionnaires modernes sous droits (Robert, Larousse actuels) ;
- images générées par IA comme illustration principale.

## Style

- Une définition se lit en une respiration. Pas de « Se dit de… » à rallonge, pas de jargon lexicographique.
- Reformuler la définition ancienne, ne pas la copier. Le mot peut être ancien, la phrase ne l'est pas.
- Ton sobre et précis. Le côté drôle ou insolite vient du mot lui-même, pas d'un commentaire ajouté.
- Pour une expression, ajouter en une ou deux phrases l'histoire de son origine si elle est attestée.

## Chaîne automatique

Les commandes sont dans `AGENTS.md`, les choix dans D-021. Pour chaque lot :

1. **Pré-tri** (Haiku) : seuls les mots jugés prometteurs sur un extrait du Littré sont rédigés.
2. **Rédaction** (Sonnet), avec l'avis du modèle sur le mot (`suitability`).
3. **Rejet automatique** : un brouillon dont l'avis n'est pas « ok » n'arrive jamais dans Directus.
4. **Vérification de fidélité** (Opus) : la carte est comparée à son entrée du Littré. Un sens, une date ou une étymologie contredits ou inventés la signalent. Une carte signalée repart une fois chez le rédacteur avec les problèmes relevés, puis elle est revérifiée.
5. **Jury des pépites** (Opus) : les mots assez rares sont notés par lots, deux fois chacun. Les meilleures notes deviennent pépites, jamais sous 6 sur 10.
6. **Relecture par échantillon** dans Directus : environ 5 % des cartes au hasard, chaque Légendaire, chaque carte encore signalée après correction ou par un contrôle mécanique. Les autres sont publiées sans relecture.

## Contrôle avant validation

La chaîne vérifie ces points ; le relecteur d'un échantillon les reprend.

- [ ] La définition est rédigée par nous et tient en 25 mots maximum.
- [ ] Chaque affirmation (sens, date, étymologie) s'appuie sur une source citée dans `sources`.
- [ ] La citation est exacte, attribuée et dans le domaine public.
- [ ] L'illustration a une URL d'origine et une licence autorisée.
- [ ] Le mot n'a pas de sens injurieux moderne (raciste, sexiste, homophobe…), même absent du Littré.
- [ ] Les doutes sont signalés (« origine incertaine », champ `review_notes`), jamais comblés par une supposition.
- [ ] La carte a passé les contrôles automatiques (D-021). Un humain relit dans Directus un échantillon d'environ 5 %, chaque Légendaire et chaque carte signalée. Une erreur trouvée dans l'échantillon fait corriger la chaîne, pas seulement la carte.
