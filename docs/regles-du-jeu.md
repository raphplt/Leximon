# Règles du jeu

**Source unique des choix métier de Leximon.** Tout ce que le propriétaire tranche sur le jeu (ce que le joueur gagne, paie, voit, peut faire) vit ici et nulle part ailleurs. Les décisions techniques (`docs/decisions.md`) expliquent comment ces règles sont construites et y renvoient ; elles gardent la trace de la date et du pourquoi, mais en cas d'écart, c'est ce fichier qui fait foi.

**Dernière mise à jour :** 2026-10-20.

- **Statuts :** **Tranché** · **Provisoire** (valeur de départ, à recalibrer sur les données réelles) · **À décider** (en bas du fichier).
- **Réglages chiffrés :** ils sont aussi dans `packages/core/src/rules.ts`, où le code les lit. Un changement se fait aux deux endroits dans le même commit, par une nouvelle période datée : il ne s'applique jamais rétroactivement aux joueurs existants.
- Les numéros P1 à P22 viennent de la north star et restent stables. Les nouvelles règles prennent la suite.

## Non négociable

| # | Règle | Raison |
|---|---|---|
| N1 | **Aucun hasard payant :** aucun booster ne s'achète, ni directement ni via une monnaie achetée ; aucune monnaie achetable en euros ; aucune carte ne se revend contre de l'argent. | PEGI 16 minimum, régime JONUM réservé aux majeurs, public scolaire visé |
| N2 | **Ce qui se paie a un contenu connu à l'avance :** abonnement, cosmétiques, decks imprimés, licences écoles. | Idem |
| N3 | **Échanges carte contre carte**, par offres structurées, sans messagerie libre. | Protéger un public jeune |
| N4 | **Contenu des cartes :** uniquement des sources autorisées (skill `carte-mot`). | Droits |

## Produit

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P1 | Positionnement | Jeu de collection qui fait apprendre. Le tirage et la collection restent forts. Pas une app d'apprentissage façon Duolingo. | Tranché |
| P3 | Plateformes | Web et mobile en parallèle. | Tranché |
| P5 | Illustrations | Gravures du domaine public, avec un traitement graphique propre. | Tranché |
| P7 | Nom | Leximon (nom de travail). | Tranché, marque à sécuriser |
| P8 | Cible | Grand public pour percer, B2B écoles rapidement derrière. | Tranché |
| P9 | Mot du jour | Écarté : déjà vu partout, dilue le message. | Tranché |
| P13 | Catalogue | Ambition de 10 000 cartes et plus. Au lancement, 1 000 à 2 000 mots, puis du nouveau contenu chaque semaine. Les expressions viennent après le lancement. | Tranché |
| P16 | Thèmes | Catégories transverses aux collections (mots loufoques, insultes d'antan…). Une part du catalogue parmi d'autres : le jeu ne tourne pas autour. | Tranché |

## Boosters (plis)

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P2 | Gratuité | Les boosters sont gratuits et se rechargent avec le temps (N1). | Tranché |
| P10 | Rythme | 5 cartes par booster, 1 booster toutes les 30 min, stock maximum 6. | Provisoire |
| P11 | Probabilités par carte | Courant 60 %, Peu courant 25 %, Rare 10 %, Précieux 4 %, Épique 0,9 %, Légendaire 0,1 %. Au moins une carte Peu courant ou mieux par booster. | Provisoire |
| P12 | Garanties | Une Épique garantie au 40e booster d'affilée sans en obtenir, une Légendaire au 150e (simulation : `docs/rnd/collection-sim.md`). | Provisoire |
| P14 | Structure | Un booster par collection, plus un booster « découverte » tiré dans tout le catalogue. Une carte appartient toujours à sa collection. | Tranché |
| P15 | Doublons | Pas de protection anti-doublons. La complétion repose sur les échanges et les plis bonus. | Tranché |
| P17 | Transparence | Probabilités et garanties ne sont jamais affichées aux joueurs (légal tant que les boosters sont gratuits). | Tranché |
| P18 | Stock unique | Un seul stock pour toutes les sources : un booster découverte consomme le même stock qu'un booster de collection. | Tranché |
| P19 | Garanties partagées | Les compteurs Épique et Légendaire comptent tous les boosters du joueur, quelle que soit leur source. | Tranché |
| P23 | Réserve de plis bonus | Les plis bonus (P29) vont dans une réserve séparée, plafonnée à 10 ; au-delà, ils sont perdus. La réserve ne sert que quand le stock gratuit est vide : un bonus ne bloque jamais la recharge. | Tranché le 2026-10-20 |

## Cartes et rareté

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P20 | Calcul de la rareté | Courant à Précieux : la fréquence réelle du mot (Google Ngram), seuils communs à tout le catalogue. Épique et Légendaire : réservées aux pépites, choisies par un jury automatique ; une pépite absente de tout Google Books est Légendaire. Détails : D-020, D-021. | Seuils provisoires |
| P21 | Mots courants au sens ancien | Acceptés (« punaise », « canaille » comme injures). Leur fréquence les classe Courant. | Tranché |
| P22 | Fréquence affichée | La fréquence réelle du mot figure sur la carte, discrètement, en chiffre seul. | Tranché |
| P44 | Affichage de la rareté | Sur la carte, une icône seule, de la série des gemmes (de l'éclat brut pour Courant à l'étoile pour Légendaire), dans la couleur de rareté. Le nom de la rareté reste dans l'interface, à côté de l'icône : vue agrandie, révélation d'un pli, album. | Tranché le 2026-10-20 |
| P24 | Rareté figée | Une carte publiée garde sa rareté et son identifiant pour toujours. Un mot reclassé devient une nouvelle carte ; une carte retirée quitte les boosters, les exemplaires possédés restent. | Tranché |
| P25 | Pépites | Au plus 2 % d'un lot en Légendaires et 6 % en Épiques, jamais un mot noté sous 6 sur 10 en charme. | Provisoire |

Noms des raretés : Courant (encore compris de beaucoup), Peu courant (vieilli), Rare (disparu de l'usage courant), Précieux (quasi absent du corpus moderne), Épique (une pépite quasi absente du corpus moderne), Légendaire (une pépite absente de tout Google Books).

## Contenu des cartes

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P4 | Rédaction | Rédaction maison à partir du Littré (domaine public), par un LLM, contrôlée automatiquement (D-019, D-021). | Tranché |
| P26 | Format | Définition de 25 mots au plus, en français moderne, reformulée. Étymologie courte, « Origine incertaine. » si elle n'est pas établie. Citation d'un auteur du domaine public, ou pas de citation. | Tranché |
| P27 | Relecture humaine | Par échantillon : environ 5 % au hasard, chaque Légendaire, chaque carte encore signalée par les contrôles. Une carte est publiée si sa relecture l'accepte (« OK », « Retouche ») ou si elle n'était pas à relire. | Tranché |
| P28 | Injures modernes | Un mot au sens injurieux moderne (raciste, sexiste, homophobe…) est exclu, même si le Littré l'ignore. | Tranché |
| P39 | Mots régionaux | Gardés, à condition que la définition dise la région (« En Lorraine, … »). Ils formeront le fonds d'une future collection « Parlers régionaux ». | Tranché le 2026-10-20 |
| P40 | Noms propres | Exclus : un nom de personne, de divinité, de lieu ou d'astre n'est pas un mot de la langue (« Palès », « Rigel »). | Tranché le 2026-10-20 |
| P41 | Indice dans la définition | À limiter : la définition évite le mot et les mots évidents de sa famille (pas « petite jarre » pour jarron), pour que le défi garde son sens. Toléré quand on ne peut pas faire autrement sans perdre en clarté. | Tranché le 2026-10-20 |
| P42 | Gravures | Une gravure du domaine public (ou CC0, CC BY 4.0 avec crédit) illustre la carte quand on en trouve une juste ; chaque gravure est validée avant publication. Une carte sans gravure est publiée avec sa grande initiale et la reçoit plus tard. | Tranché le 2026-10-20 |
| P43 | Rendu des gravures | L'encre seule, imprimée dans la couleur du mot (or ou irisé sur les cartes de nuit) ; à partir de Rare, un aplat de la couleur de rareté décalé sous l'encre, façon impression mal calée. Les sujets en hauteur débordent vers le haut de l'encart. | Tranché le 2026-10-20 |

## Collections

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P30 | Collections de lancement | Trois collections d'environ 500 cartes : « Les Fondateurs » (généraliste), « Caractères et travers » (mœurs, défauts, moqueries, injures d'antan), « Métiers et objets disparus ». Les injures d'antan vont toujours dans Caractères et travers. | Tranché le 2026-10-20 |

## Défis et maîtrise

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P31 | Ce qu'on révise | Seulement les mots que le joueur possède. La révision espacée (FSRS) choisit quand un mot revient ; un mot oublié revient le lendemain. | Tranché le 2026-10-20 |
| P32 | Formats | QCM à 4 choix : « trouver la définition » ou « trouver le mot ». Les mauvais choix viennent de la même collection. | Tranché le 2026-10-20 |
| P33 | Niveaux | Esquisse au départ, Encre quand le mot est retenu sur 7 jours, Dorure sur 30 jours (stabilité mémoire FSRS, objectif 90 % de rappel, intervalle maximal 365 jours). Un niveau ne redescend jamais. La maîtrise est rangée par mot : un échange ne la touche pas. | Provisoire |
| P29 | Plis bonus | 1 pli bonus le premier jour (heure de Paris) où le joueur répond à au moins 5 questions de défi avec au moins 3 bonnes réponses, une fois par jour ; 1 pli bonus chaque fois qu'une carte atteint la Dorure. Ils vont dans la réserve (P23). | Tranché le 2026-10-20 |

Le catalogue étant public, un tricheur peut trouver les bonnes réponses : ce sont les plafonds (une fois par jour, Dorure espacée de semaines par FSRS) qui limitent ce qu'il gagne, pas le secret des réponses.

## Échanges

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P6 | Principe | Dès le lancement, carte contre carte, avec garde-fous (N3). | Tranché |
| P34 | Forme d'une offre | Offre directe à un joueur désigné par son code public (8 caractères) : 1 à 3 cartes données contre 1 à 3 cartes voulues, un exemplaire de chaque. Pas de texte libre. | Tranché le 2026-10-20 |
| P35 | Ce qui s'échange | Seulement les doublons. Une Épique ou une Légendaire attend 7 jours après sa dernière obtention. | Provisoire |
| P36 | Garde-fous | Compte de plus de 3 jours ; 10 offres envoyées par 24 h glissantes ; une offre expire après 72 h. | Provisoire |

## Comptes

| # | Sujet | Règle | Statut |
|---|---|---|---|
| P37 | Compte invité | On joue sans inscription. L'inscription (lien magique, Apple, Google) transférera la collection de l'invité. | Tranché |
| P38 | Limites | 60 créations de compte invité par minute et par adresse IP (une classe derrière une même adresse) ; 120 requêtes par minute par joueur (D-018). | Provisoire |

## À décider

Rien pour l'instant.
