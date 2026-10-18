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
| `rarity` | Calculée par la chaîne de contenu, jamais choisie à la main |
| `collection` | Une collection principale, d'autres en tags |
| `illustration` | Fichier issu d'une source autorisée, avec l'URL d'origine et la licence |

## Sources

**Autorisées :**
- dictionnaires du domaine public : Littré, Académie jusqu'à la 8e édition (1935), Godefroy, Furetière, Trévoux, Larousse du XIXe ;
- Wikidata (lexèmes, CC0) ;
- fréquences : Google Books Ngram (CC BY, à créditer), Lexique 3.83 (CC BY-SA, scores dérivés seulement) ;
- illustrations : Met Open Access, Rijksmuseum, Paris Musées (CC0), Wikimedia Commons uniquement si le fichier est marqué domaine public ou CC0.

**À n'utiliser que pour vérifier, sans rien reprendre :** Wiktionnaire (CC BY-SA). Ses textes ne doivent pas se retrouver dans une carte.

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

## Contrôle avant validation

- [ ] La définition est rédigée par nous et tient en 25 mots maximum.
- [ ] Chaque affirmation (sens, date, étymologie) s'appuie sur une source citée dans `sources`.
- [ ] La citation est exacte, attribuée et dans le domaine public.
- [ ] L'illustration a une URL d'origine et une licence autorisée.
- [ ] Les doutes sont signalés (« origine incertaine », champ `review_notes`), jamais comblés par une supposition.
- [ ] La carte passe en relecture humaine dans Directus. Aucune carte n'est publiée sans validation humaine.
