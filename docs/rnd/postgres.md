# R&D · Fournisseur Postgres de production

- **Décision liée :** D-005
- **Dates :** 2026-10-20 → 2026-10-20
- **Question :** quel Postgres managé offre le meilleur rapport qualité-prix à grande échelle et l'offre gratuite la plus généreuse, derrière Cloudflare Hyperdrive, dans le respect du GAR ?

Étude documentaire, pas de mesure : prix relevés le 2026-10-20 sur les pages et API de prix officielles des fournisseurs. Les montants sont mensuels (730 h), hors taxes, au tarif public sans engagement. « ? » signale un point que la documentation publique ne permet pas de confirmer.

## Critères

| Critère | Seuil d'acceptation |
|---|---|
| Contrat GAR v2026 | Hébergement de préférence dans l'UE (art. 4 § 31) ; aucun transfert de données personnelles hors UE, y compris par les sous-traitants, sans accord écrit (annexe 4 § 6). Changer d'hébergeur après le branchement demande l'accord préalable du ministère. |
| Restauration à l'instant (PITR) | 7 jours au moins dès qu'il y a des joueurs (portefeuilles, échanges) |
| Haute disponibilité | Secours avec bascule automatique au palier 2 |
| Latence | Calcul toujours allumé en production : un réveil de plusieurs secondes casse le budget de 150 ms au 95e centile de l'ouverture d'un pli |
| Hyperdrive | Connexion TCP/TLS directe, liste d'IP autorisées (plages publiées par Cloudflare) |
| Postgres | Partitionnement déclaratif, fonctions plpgsql, triggers (migrations actuelles) |

**Paliers chiffrés** (d'après la charge visée dans `docs/architecture.md`) :

- **P0, lancement :** 0,25 à 0,5 vCPU, environ 1 Go.
- **P1, 20 000 joueurs par jour :** 2 vCPU et 8 Go, 25 Go de disque, PITR 7 jours.
- **P2, 250 000 joueurs par jour :** 8 vCPU et 32 Go, secours HA, 100 Go, PITR 14 jours, 1 à 2 To de trafic sortant.

## Options étudiées

Seize fournisseurs : Neon, Supabase, Xata, Aiven, Crunchy Bridge, PlanetScale, Nile, Scaleway (Managed et Serverless), OVHcloud, Clever Cloud, Exoscale, UpCloud, AWS RDS et Aurora, Google Cloud SQL, DigitalOcean, Prisma Postgres. Ceux qui ratent un critère bloquant sont écartés en fin de section Résultats.

## Résultats

### Offre gratuite

| Fournisseur | Ce qui est offert | Limite gênante |
|---|---|---|
| **Neon** | 1 Go par projet (20 Go par compte), 100 heures de calcul par mois et par projet jusqu'à 2 unités (8 Go de RAM), branches de test, sans carte bancaire, sans limite de durée | Mise en veille après 5 min (réveil en quelques centaines de ms) ; PITR de 6 h ; société américaine (Databricks), Francfort |
| Aiven | 1 vCPU, 1 Go de RAM, 1 Go de disque, société finlandaise | 20 connexions, région non choisie, peut être éteint si inutilisé |
| Supabase | 500 Mo, Paris possible | Pause après une semaine sans activité, pas de sauvegarde |
| Prisma Postgres | 2 Go, 200 000 requêtes par mois | Arrêt au quota, 5 connexions directes utiles |
| Clever Cloud | 256 Mo, 5 connexions | Test seulement |

**L'offre gratuite la plus généreuse est celle de Neon**, de loin : assez pour une bêta fermée, avec des branches pour les tests.

**Côté Cloudflare**, Hyperdrive gratuit plafonne à 100 000 requêtes par jour. Le forfait Workers Paid (5 $ par mois) le rend illimité : à prendre dès la bêta publique.

### Coût mensuel par palier

Les fournisseurs sont classés par prix au palier 2.

| Fournisseur | Société, région | P0 | P1 | P2 | PITR | HA automatique |
|---|---|---|---|---|---|---|
| Scaleway Managed | FR, Paris | 12 € | 88 € | 462 € | **Aucun** (sauvegarde logique quotidienne) | Oui |
| Xata | US, Francfort | 9 $ | 77–147 $ | ≥ 589 $ + trafic ? | Oui, durée ? | Oui |
| PlanetScale | US, Francfort | 5 $ | 61–117 $ | 778 $ (4 vCPU) à 1 456–1 516 $ (8 vCPU) | 2 jours (davantage en option) | Oui (3 nœuds) |
| Google Cloud SQL | US, Paris | n/a | 122 $ | 977 $ + trafic ? | 7 jours | Oui |
| **OVHcloud** | **FR, Paris (3 zones) ou Gravelines** | 54 € | 143 € (PITR 2 j) ou 327 € (HA, PITR 14 j) | **1 115 à 1 307 €**, trafic inclus | 2, 14 ou 30 jours selon l'offre | Oui (offre Production) |
| Supabase | US/Singapour, Paris | 0 ou 25 $ | 228 $ | 1 130–1 220 $ | 7 jours (≈ 100 $) | **Non** (Enterprise seulement) |
| AWS RDS | US, Paris | n/a | 146 $ | 1 250–1 340 $ | 7 jours | Oui |
| Exoscale | CH/AT, Francfort ou Vienne | 42 € | 384 € | 1 351 € | 14 jours | Oui |
| Neon | US, Francfort | 0 à 20 $ | 127 $ (Launch) à 254 $ (Scale) | 1 390–1 490 $ | 7 à 30 jours | Pas de secours chaud (bascule de 1 à 10 min si une zone tombe) |
| Crunchy Bridge | US (Snowflake), Paris | 12,50 $ | 178 $ | 1 410–1 425 $ | 10 jours inclus | Oui |
| Aiven | FI, Paris (sur OVH, GCP, AWS) | 0 ou 25 $ | 400–475 $ | 1 600–1 800 $ | 14 jours | Oui |

### Ce qui distingue les finalistes

**OVHcloud (Public Cloud Databases)**
- Société française cotée, rentable (40 % de marge d'EBITDA sur l'exercice 2025).
- Pas d'exposition au Cloud Act, et des données qui restent en France : c'est le meilleur dossier pour le GAR.
- Ce qui est inclus :
  - un PITR continu, avec une copie hors région ;
  - un PgBouncer intégré ;
  - des « forks » à un instant donné, pour la préproduction ;
  - tout le trafic sortant, ce qui pèse au palier 2.
- Le service est construit avec Aiven (Finlande).
- Les limites :
  - pas d'offre gratuite (200 € de crédit le premier mois) ;
  - l'offre d'entrée coûte 54 € par mois ;
  - le PITR de 7 jours impose l'offre Production à 2 nœuds (327 € au palier 1) ;
  - une montée de gamme ne se défait pas.

**PlanetScale**
- Le moins cher parmi les offres sérieuses aux paliers 0 et 1, avec une vraie HA à 3 nœuds.
- Partenaire de Cloudflare : la base se crée depuis le tableau de bord Cloudflare et se règle sur la facture Cloudflare.
- Les limites : société américaine, Francfort seulement, PITR de 2 jours par défaut, dernière levée de fonds en 2021.

**Neon**
- La meilleure offre gratuite, et le plus agréable pour développer : branches de base de données en copie à l'écriture.
- Les limites :
  - racheté par Databricks en 2025, avec trois changements de prix et de contrat en un an ;
  - pas de secours chaud ;
  - pas de Paris ;
  - le plus cher au palier 2.

**Scaleway Managed**
- Le moins cher en UE à tous les paliers, français, sans Cloud Act.
- Mais aucune restauration à l'instant n'est documentée : jusqu'à 24 h de pertes (portefeuilles, échanges) en cas d'incident. Disqualifiant tant que Scaleway ne confirme pas un PITR.

### Écartés

- **Nile :** pas de fonctions plpgsql ni de triggers ; nos migrations ne passent pas.
- **Supabase :** pas de bascule automatique hors Enterprise.
- **Scaleway Serverless SQL :** pas de HA ; réveil de plusieurs secondes.
- **Clever Cloud :** réplicas promus à la main.
- **Prisma Postgres :** pas de PITR ; 5 connexions directes sur l'offre Starter.
- **DigitalOcean :** pas de Paris, et prix de l'offre Advanced 8 vCPU non publié.
- **UpCloud :** prix officiels inaccessibles.
- **Crunchy Bridge :** avenir incertain depuis le rachat par Snowflake.

### Points valables pour tous

- **Hyperdrive met en cache les lectures par défaut** (60 s), et une écriture n'invalide pas le cache. Pour Leximon, c'est un bug en production : une collection relue juste après l'ouverture d'un pli peut revenir périmée. La configuration Hyperdrive de production doit être créée **sans cache** (`--caching-disabled`) ; le catalogue, lui, ne lit jamais la base.
- **Hyperdrive se branche sur l'accès direct**, pas sur le pooler du fournisseur, et limite lui-même le nombre de connexions vers la base (environ 100 en offre payante).
- **Placement :** pour que le Worker s'exécute à côté de la base, indiquer la région explicitement (`placement.region`, par exemple `aws:eu-west-3`) plutôt que le mode `smart`.
- **Pilote :** node-postgres 8.16.3 au moins. Nous avons 8.23.1.

## Recommandation

**Production : OVHcloud, à Paris.**
- C'est la seule offre qui remplit tous les critères (PITR, HA automatique, toujours allumée) chez un hébergeur français sans exposition au Cloud Act. C'est ce que le GAR préfère, et un argument de vente auprès des écoles.
- Au palier 2, elle coûte 10 à 30 % de plus que Google ou PlanetScale, mais le trafic sortant est inclus, et elle évite une migration à faire approuver par le ministère plus tard.

**D'ici là : Neon gratuit pour la bêta.**
- Bascule vers OVH avant le branchement au GAR, ou dès que le gratuit ne suffit plus (stockage de 1 Go, heures de calcul).
- La migration, `pg_dump` puis restauration sur une petite base, prend moins d'une heure d'interruption ; nos migrations sont du Postgres standard.
- La mise en veille de Neon coûte quelques centaines de millisecondes sur la première requête après 5 minutes d'inactivité : acceptable en bêta, pas au lancement public.

**Si l'on préfère ne jamais migrer :** OVH dès la bêta publique, avec l'offre Essential (54 € par mois), puis Production quand le PITR de 7 jours devient nécessaire.

**Reste à vérifier :**
- **Scaleway :** existe-t-il un PITR ? Si oui, c'est le moins cher en UE à tous les paliers.
- **OVH :** Aiven est-il un sous-traitant au sens du RGPD ? Quel est le périmètre HDS ? Laquelle des deux pages de prix est juste pour l'offre Discovery B3-4 (62 € ou 75 €) ?
- **Hyperdrive :** tester la connexion vers OVH, avec le certificat d'autorité du projet en `verify-full`.

## Pour reproduire

**Pages et API de prix consultées le 2026-10-20 :**
- neon.com/pricing ;
- supabase.com/pricing ;
- xata.io/pricing ;
- api.aiven.io/v1/service_types ;
- api.crunchybridge.com/providers ;
- planetscale.com/pricing.md?region=eu-central ;
- scaleway.com/en/pricing/managed-databases ;
- api.ovh.com/1.0/order/catalog/public/cloud?ovhSubsidiary=FR ;
- api.clever-cloud.com/v2/products/addonproviders ;
- portal.exoscale.com/api/pricing/dbaas-pg ;
- liste de prix AWS (AmazonRDS/eu-west-3) ;
- cloud.google.com/sql/pricing.

**Documentation et contrat :**
- developers.cloudflare.com/hyperdrive : limites, prix, cache, guides par fournisseur ;
- contrat GAR v2026 (gar.education.fr).
