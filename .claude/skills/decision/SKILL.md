---
name: decision
description: Consigner ou modifier une décision technique de Leximon dans docs/decisions.md. À utiliser dès que le propriétaire tranche un choix de technologie, d'architecture ou d'outillage, qu'une R&D conclut, ou qu'une décision existante est remise en cause.
---

# Consigner une décision technique

Les décisions techniques vivent dans un seul fichier : `docs/decisions.md`. Les choix métier (règles du jeu) sont dans `docs/regles-du-jeu.md` : quand une décision technique met en œuvre une règle du jeu, la règle et ses valeurs vont dans ce fichier, la décision y renvoie par son numéro (P-xx).

## Étapes

1. **Lire `docs/decisions.md` en entier.** Vérifier si une décision couvre déjà le sujet.
2. **Ne consigner qu'un choix tranché par le propriétaire.** S'il n'a pas tranché, proposer les options avec une recommandation et s'arrêter là.
3. **Selon le cas :**
   - **Nouveau sujet :** ajouter une section à la fin, avec le numéro suivant (`D-011`, `D-012`…).
   - **Une R&D conclut :** mettre à jour la section existante. Remplacer « R&D en cours » par « Acceptée (date) », remplir **Choix**, et ajouter le lien vers le rapport `docs/rnd/<sujet>.md`.
   - **Un choix change :** ne pas réécrire l'ancienne section. Passer son statut à « Remplacée par D-xxx », puis ajouter la nouvelle décision.
4. **Si la stack change**, mettre à jour la ligne « Stack » de `AGENTS.md`. Ne toucher à rien d'autre dans ce fichier.

## Format d'une section

```markdown
## D-0XX · Sujet : choix retenu

- **Statut :** Acceptée (AAAA-MM-JJ)
- **Choix :** ce qui est retenu, en une ou deux phrases.
- **Pourquoi :** la raison principale, pas un comparatif complet.
- **Conséquences :** ce que ça impose au code ou à l'organisation.
```

## Règles

- Quatre à six lignes par décision. Le comparatif détaillé des options va dans un rapport de R&D, pas ici.
- Pas de doublon : une décision ne se recopie pas dans un autre fichier, on y renvoie par son numéro.
- Dates au format AAAA-MM-JJ.
