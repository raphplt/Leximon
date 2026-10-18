---
name: spike
description: Mener une R&D courte (spike) sur une question technique ouverte de Leximon et en rendre compte dans docs/rnd/. À utiliser pour les décisions au statut « R&D en cours » de docs/decisions.md (WebSockets qui tiennent les pics, animations et effets de cartes…) ou pour toute comparaison de technologies avec mesures.
---

# Mener un spike de R&D

Un spike répond à une seule question, avec des mesures, dans un temps limité. Il ne produit pas de code de production.

## Étapes

1. **Cadrer avec le propriétaire avant de coder :**
   - la question, en une phrase ;
   - les critères de choix et leur seuil d'acceptation ;
   - les options à tester ;
   - le temps alloué.

   Partir de la section concernée de `docs/decisions.md` si elle existe.
2. **Coder dans `rnd/<sujet>/`.** Ce code est jetable : jamais importé par `apps/` ou `packages/`, jamais déployé en production.
3. **Mesurer pour de vrai :** chiffres, appareil ou machine utilisés, conditions de test. Une impression n'est pas une mesure. Pour la tenue en charge, un script k6 versionné dans `rnd/<sujet>/`.
4. **Rédiger le rapport `docs/rnd/<sujet>.md`** avec le modèle ci-dessous.
5. **Présenter la recommandation au propriétaire.** S'il tranche, mettre à jour la décision avec le skill `decision`.

## Modèle de rapport

```markdown
# R&D · <sujet>

- **Décision liée :** D-0XX
- **Dates :** AAAA-MM-JJ → AAAA-MM-JJ
- **Question :** une phrase.

## Critères
| Critère | Seuil d'acceptation |

## Options testées
Pour chacune : comment elle a été testée, ce qui a été mesuré.

## Résultats
| Option | Critère 1 | Critère 2 | … |

## Recommandation
Le choix proposé, en deux ou trois phrases, et ce qu'il reste à vérifier.

## Pour reproduire
Commandes, appareil, version des outils.
```

## Règles

- Un rapport par sujet. S'il faut refaire un essai, mettre à jour le rapport existant plutôt qu'en créer un second.
- Le rapport ne recopie pas la décision. Il donne les preuves, la décision y renvoie.
