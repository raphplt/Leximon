# Cahier des charges · Clan v2

- **Statut :** proposition du 2026-10-22, à valider par le propriétaire. Les décisions à trancher sont en fin de document.
- **Règles concernées :** P65, P66 et P70 dans [regles-du-jeu.md](../regles-du-jeu.md), qui fait foi une fois les décisions prises.
- **D'où ça vient :** les retours de la première prise en main ([recette-web.md](../recette-web.md#retours-du-2026-10-22), point 1.3). L'objectif de la semaine se remplit en une journée, par un seul joueur. Le clan n'a pas de progression propre.
- **Objectif :** que le clan donne une raison de revenir chaque jour, et que chaque bonne réponse en défi serve aussi la bande.

## Ce qui existe

- **L'objectif de la semaine** compte les mots nouveaux des membres : 5, 10 et 15 par membre actif pour le bronze, l'argent et l'or. Un sachet ouvre 5 mots, donc l'or tombe dès le premier jour.
- **L'or** donne un sachet bonus et une gravure ou une couleur d'emblème de plus.
- **Le recompte** passe par la file `leximon-game-events` (événement `cards_obtained`), à partir de `user_cards`.
- **La page du clan** montre l'en-tête (emblème, nom, devise), l'objectif, la bibliothèque, les membres, puis la discussion mêlée au journal.

## 1. L'objectif compte les bonnes réponses

**Principe.** Une bonne réponse en défi d'un membre, pendant la semaine et après son arrivée dans le clan, compte pour le clan. C'est une mesure d'assiduité : on ne la gonfle pas en ouvrant des sachets, car un défi ne pose que des mots que le joueur possède, dus pour une révision ou jamais révisés (P31).

**Ordres de grandeur.** D'après les profils de la simulation des niveaux ([level-sim](../rnd/level-sim.md)), les bonnes réponses par semaine sont :

| Profil | Bonnes réponses par semaine |
|---|---|
| Occasionnel (3 jours sur 7, 4 par séance) | 12 |
| Régulier (tous les jours, 8 par séance) | 56 |
| Assidu (tous les jours, 20 par séance) | 140 |

**Cibles proposées, par membre actif :**

| Palier | Cible | Récompense |
|---|---|---|
| Bronze | 15 | la barre seulement |
| Argent | 30 | 1 sachet bonus |
| Or | 50 | 1 sachet bonus |
| Enluminure (dès le niveau 5 du clan) | 80 | 1 sachet bonus |

Il faut donc, en moyenne, un membre régulier pour l'or, et des assidus pour l'enluminure.

Exemples : un clan de trois réguliers fait 168 bonnes réponses et touche l'or (150). Un assidu et deux occasionnels font 164, l'or aussi. Personne ne remplit l'objectif seul dans un clan de trois.

- **Membre actif :** un sachet ouvert ou une réponse en défi dans les 7 jours avant le premier passage de la semaine. Aujourd'hui, seul le sachet compte.
- **Part minimale pour toucher les sachets :** 15 bonnes réponses, soit deux séances environ (aujourd'hui, 5 mots).
- **Plafond :** 3 sachets d'objectif par joueur et par semaine (aujourd'hui 2), même s'il change de clan.
- **Le reste ne change pas :** semaine du lundi au dimanche, heure de Paris ; cible fixée au premier passage ; sachets réclamés jusqu'à la fin de la semaine suivante ; réserve pleine, le sachet attend.

## 2. Le niveau du clan

**Principe (P70).** Le clan gagne de l'XP par l'activité de ses membres. Ses niveaux ne débloquent que du visible et du collectif, jamais un avantage de jeu.

**XP proposée :**
- 1 XP par bonne réponse d'un membre, jusqu'à 100 par membre et par semaine. Au-delà, un assidu ne fait plus monter le clan à lui seul.
- Un bonus pour chaque palier atteint dans la semaine : bronze 50, argent 100, or 200, enluminure 300. Ce bonus fixe pèse plus lourd pour un petit clan que pour un grand.

**Courbe de départ :** passer du niveau n au suivant demande 500 + 250 × (n − 1) XP, sans maximum. Rythme obtenu, à vérifier par simulation avant de construire :

| Clan | XP par semaine | Niveau 5 | Niveau 10 | Niveau 20 |
|---|---|---|---|---|
| 5 réguliers, or chaque semaine | 630 | 6 semaines | 5 mois | 19 mois |
| 30 réguliers, or chaque semaine | 2 030 | 2 semaines | 7 semaines | 6 mois |

Un grand clan monte plus vite. C'est voulu, comme dans Clash of Clans, et sans effet sur le jeu.

**Ce que débloquent les niveaux :**

| Niveau | Déblocage |
|---|---|
| 2, 3, 4, 6, 7, 8, 9 | une gravure ou une couleur d'emblème (les 8 objets que donne l'or aujourd'hui, puis d'autres) |
| 5 | le palier Enluminure |
| 10, 15, 20, puis tous les 5 niveaux | une bannière : le fond gravé de l'en-tête du clan, visible aussi dans la recherche |
| les autres niveaux après 10 | une gravure ou une couleur |

L'or ne donne plus d'objet d'emblème : ces objets viennent des niveaux.

**Où le niveau se voit :**
- une médaille sur l'emblème, partout où il apparaît (page du clan, recherche, profil, image de partage du profil) ;
- la barre d'XP du clan dans l'en-tête ;
- une ligne au journal, « Le clan passe au niveau 6 ! ».

## 3. L'écran

Défauts relevés le 2026-10-22 sur la page actuelle :

1. **L'or dépassé :** « 35 / 15 » s'affiche, avec la barre pleine et plus rien à viser. *Corrigé par les nouvelles cibles. Au-delà du dernier palier, la ligne dit « Or ! 35 bonnes réponses ».*
2. **La récompense de tous les paliers en une phrase.** On ne montre que celle du prochain : « À l'argent, un sachet bonus. »
3. **« de Les Fondateurs »** dans la bibliothèque. *Corrigé le 2026-10-22 : « des Fondateurs ».*
4. **L'emblème de l'en-tête** se lit mal : la gravure est trop fine à cette taille.
5. **« Modérée »** en tête de la discussion ne sert à rien.
6. **Les membres** affichent « 6 mots », ce qui ne veut pas dire grand-chose. Ils sont triés par part de la semaine, avec « 23 cette semaine ».

**Changements :**
- **En-tête :** l'emblème plus grand, avec sa médaille de niveau, et la barre d'XP du clan sous le nom.
- **Objectif :** « Objectif de la semaine », puis le titre « 150 bonnes réponses », la barre à 3 ou 4 paliers, « 96 / 150 · 23 à toi » et la récompense du prochain palier. Il reste la carte du haut.
- **Jouer :** dans « Aujourd'hui », une ligne pour l'objectif du clan (anneau de progression, « 96 / 150 »), qui mène au défi. Le défi devient le geste du clan.
- **Fin d'un défi :** « +8 pour le clan » sous le score.
- **Recherche de clans :** le niveau et la bannière sur chaque ligne.

## 4. Mise en œuvre

- **Règles (`packages/core`) :**
  - `clan/goal.ts` compte des bonnes réponses ;
  - un nouveau `clan/level.ts` regroupe la courbe, le niveau d'une XP et les déblocages par niveau ;
  - `CLAN_GOAL_SCHEDULE` est corrigé en place (pas de joueurs) et `CLAN_LEVEL_SCHEDULE` est ajouté.
- **Base (migrations additives) :**
  - colonnes `answers` sur `clan_weeks` et `clan_week_members` ;
  - `xp` sur `clan_weeks` et `clans` ;
  - valeur `illuminated` ajoutée à l'enum `goal_tier` ;
  - les colonnes `words` partent dans une migration ultérieure.
- **Recompte :**
  - la route qui enregistre une réponse publie `answers_recorded` (le joueur) sur la file, après la transaction ;
  - le consommateur regroupe les événements d'un même joueur, recompte ses bonnes réponses de la semaine depuis `review_logs` (index `review_logs_user_reviewed_idx` déjà là), puis l'XP de la semaine du clan et `clans.xp` ;
  - le calcul est idempotent : l'XP d'une semaine se recalcule entière, et les semaines closes ne bougent plus.
- **Journal :** le passage de niveau a la clé d'événement `level:N`, ce qui évite les doublons.
- **Emblème :** les objets ouverts se déduisent du niveau du clan, au lieu d'être gardés au passage de l'or.
- **Contrat :** `level`, `xp` et le seuil suivant sur le clan ; `answers`, `myAnswers` et le quatrième palier sur l'objectif. L'API ne casse aucun client publié (il n'y en a pas encore).
- **Tests :**
  - règles pures, y compris la courbe ;
  - intégration : recompte concurrent de deux membres du même clan, plafond par membre, passage de niveau publié une seule fois.
- **Simulation :** un script dans `rnd/clan-sim/`, sur le modèle de `rnd/level-sim/`, cale les cibles et la courbe sur des clans de 3, 8 et 30 membres aux profils mêlés.

## Décisions à trancher

1. **L'unité de l'objectif :** une bonne réponse en défi, comme tu l'as demandé. *Recommandé, et rien d'autre ne compte.*
2. **Les cibles par membre actif :** 15, 30, 50, plus 80 pour l'enluminure. *Recommandé, à caler par la simulation.*
3. **L'XP du clan :**
   - *A, recommandé :* les bonnes réponses, plafonnées à 100 par membre et par semaine, plus un bonus par palier. Chaque réponse se voit, et un grand clan monte plus vite.
   - *B :* les paliers seulement. Le niveau ne dépend pas de la taille du clan, mais une réponse isolée ne se voit plus.
4. **Un quatrième palier au niveau 5 du clan :** nom proposé, « Enluminure ». *Recommandé.*
5. **Les objets d'emblème viennent des niveaux du clan, plus de l'or.** *Recommandé : une seule source, plus lisible.*
6. **L'objectif du clan dans « Aujourd'hui » sur Jouer, et « +N pour le clan » en fin de défi.** *Recommandé.*
7. **La simulation avant de coder :** une heure environ, sans coût d'API. *Recommandé.*
