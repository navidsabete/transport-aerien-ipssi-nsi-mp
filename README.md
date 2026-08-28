# Projet final — Back-end de WebApp adossé à MongoDB

**Sujet choisi : Transport aérien — « Réseau de vols »**

IPSSI Montpellier · Mastère Dév, Data & IA, 4ᵉ année · Module MIA4

## 1. Questions métier

1. Quels sont les 10 aéroports possédant le plus grand nombre de destinations différentes ? (tri décroissant)
2. Quelles sont les 10 compagnies actives desservant le plus de destinations différentes ? (tri décroissant)
3. Comment relier X à Y avec le moins d'escales, en ne considérant que des vols réellement opérés aujourd'hui (compagnies actives) ?
4. Quelles sont les 10 destinations les plus lointaines desservies en vol direct par une compagnie active depuis un aéroport de référence (ex. Paris-CDG) ?

Q2, Q3 et Q4 filtrent sur les compagnies **actives** (`airlines.active = "Y"`) : 992 routes sur
66 985 (1,48 %) sont opérées par une compagnie inactive et doivent être exclues de ces trois
pipelines (voir chapitre ii du rapport). Q4 nécessite en plus un index géospatial `2dsphere` sur
`airports` (coordonnées GeoJSON dérivées de `lat`/`lon`) pour calculer une distance depuis CDG.

## 2. Jeu de données

| Source | Fichier | Volume | Contenu |
|---|---|---|---|
| [mongodb-sample-dataset](https://github.com/neelabalan/mongodb-sample-dataset) (`sample_training/routes`) | `db/data/routes.json` | **66 985 documents** | liaisons aériennes réelles : compagnie (embarquée), aéroport de départ/arrivée, escales, type d'avion |
| [OpenFlights](https://github.com/jpatokal/openflights) (`data/airports.dat`) | `db/data/airports.dat` | 7 698 documents | aéroports : nom, ville, pays, code IATA/ICAO, coordonnées géographiques, altitude, fuseau horaire |
| [OpenFlights](https://github.com/jpatokal/openflights) (`data/airlines.dat`) | `db/data/airlines.dat` | 6 162 documents | compagnies aériennes : nom, alias, codes IATA/ICAO, callsign, pays, statut actif |

Import :

```bash
mongoimport --uri "$MONGO_URI" --collection routes --file db/data/routes.json

mongoimport --uri "$MONGO_URI" --collection airports --type csv \
  --fields "id,name,city,country,iata,icao,lat,lon,altitude,timezone,dst,tz_db,type,source" \
  --file db/data/airports.dat

mongoimport --uri "$MONGO_URI" --collection airlines --type csv \
  --fields "id,name,alias,iata,icao,callsign,country,active" \
  --file db/data/airlines.dat
```

Puis, **après chaque import** (obligatoire, y compris sur la machine du binôme ou en cloné frais) :

```bash
mongosh "$MONGO_URI" db/create-indexes.js
```

Ce script crée les 4 index justifiés (§5) de façon idempotente — le rejouer ne fait rien s'ils
existent déjà. Sans lui, les `$lookup` des pipelines Q1/Q2/Q4 et la route "vols au départ de X"
tournent en COLLSCAN (voir chapitre iii du rapport pour la mesure : jusqu'à 3 min pour un
`$lookup` non indexé sur `routes`↔`airports`).

## 3. Collections et modélisation

| Collection | Volume | Rôle |
|---|---|---|
| `routes` | 66 985 | Collection principale. Chaque route **embarque** un résumé de la compagnie (`airline: {id, name, alias, iata}`) et **référence** ses deux aéroports par code IATA (`src_airport`, `dst_airport`) |
| `airports` | 7 698 | Référentiel des aéroports (géolocalisation, pays) |
| `airlines` | 6 162 | Référentiel des compagnies (métadonnées complètes : ICAO, callsign, statut actif) |

**Embed vs référence :** l'`airline` est embarquée dans chaque route car elle est quasi systématiquement lue en même temps que la route (affichage d'un trajet) et sa taille est bornée (4 champs) — dupliquer ce petit sous-document 67 000 fois évite un `$lookup` sur la requête la plus fréquente de l'API. À l'inverse, `airports` reste une collection séparée et référencée : elle a un cycle de vie indépendant des routes, elle est partagée par des dizaines de routes différentes (un aéroport ne doit pas être dupliqué), et certaines questions métier (carte, pays) portent sur l'aéroport seul, indépendamment de toute route. La collection `airlines` (référentiel complet, distincte de l'`airline` embarquée) sert de source canonique pour les agrégations "par compagnie" et matérialise le `$lookup` significatif exigé par le cahier des charges.

*Ce qui nous ferait changer d'avis : si l'API devait lister/éditer les compagnies indépendamment des routes (CRUD compagnies), l'embed deviendrait un problème de désynchronisation — il faudrait alors référencer partout et accepter le coût du `$lookup`.*

## 4. Anomalies détectées

Voir [`rapport/RAPPORT.md`](rapport/RAPPORT.md) chapitre ii) pour le détail (méthode de détection, ampleur, traitement retenu). Les requêtes de détection réutilisables sont dans [`db/detect-anomalies.js`](db/detect-anomalies.js) :

```bash
mongosh "$MONGO_URI" db/detect-anomalies.js
```

Résumé : 659 routes sur 66 985 (0,98 %) référencent un aéroport absent d'`airports` ; 1 627 aéroports sur 7 698 (21,1 %) n'ont pas de code IATA valide ; 1 aéroport a des coordonnées (0,0) ; 992 routes sur 66 985 (1,48 %) sont opérées par une compagnie inactive ; `airlines.active` contient une valeur mal cassée (`'n'` au lieu de `'N'`, 1 document sur 6 162).

## 5. Index

| Index | Collection | Requête servie | Besoin réel |
|---|---|---|---|
| `{ src_airport: 1 }` | `routes` | `find({ src_airport: "CDG" })` | Q1, Q3, route API "vols au départ de X" |
| `{ iata: 1 }` | `airports` | `find({ iata: "JFK" })` | `$lookup` routes→airports pour Q1 (filtrer aéroport fantôme) et Q4 (coordonnées) |
| `{ id: 1 }` | `airlines` | `find({ id: 410 })` | `$lookup` routes→airlines pour Q2/Q3/Q4 (statut `active`) |
| `{ "airline.id": 1 }` | `routes` | `find({ "airline.id": 410 })` | Q2, route API "vols d'une compagnie" |
| `{ loc: "2dsphere" }` *(à créer)* | `airports` | — | Q4 : distance depuis un aéroport de référence (CDG) via `$geoNear` |

**Index écarté :** `{ dst_airport: 1 }` sur `routes` a été mesuré (COLLSCAN 66 985 → IXSCAN 517,
techniquement efficace) puis supprimé — aucune des 4 questions ne filtre par `dst_airport` seul,
et aucune route API "arrivées" n'est prévue. Détail et capture dans `rapport/RAPPORT.md`
chapitre iii.

Capture avant/après sur `db.routes.find({ src_airport: "CDG" })` (voir `rapport/captures/`) : COLLSCAN, 66 985 documents examinés → IXSCAN, 524 documents examinés (= nombre retourné). *Capture préliminaire, à refaire en fin de journée sur la requête réellement la plus appelée par l'API.*

## 6. API

_À venir — routes CRUD + `/agg/*` (créneau 14h00–15h15)._

## 7. Installation

_À venir — `docker-compose.yml`, `.env.example`, front (créneau en cours)._

## 8. Répartition du travail dans le binôme

_À compléter._
