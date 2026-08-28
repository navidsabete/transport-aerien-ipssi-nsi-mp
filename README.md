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

Puis, pour Q3 et Q4 spécifiquement (nécessaire avant de tester `/agg/itineraire` et
`/agg/destinations-lointaines`) :

```bash
mongosh "$MONGO_URI" db/prepare-derived-data.js
```

Ce script matérialise `routes_active` (65 993 routes opérées par une compagnie active, sur
66 985) et ajoute les coordonnées GeoJSON + l'index `2dsphere` sur `airports`.

**Pourquoi une préparation à part et pas tout dans la requête ?** Contrainte MongoDB, pas
choix de style : `$graphLookup` (Q3) interroge directement une collection nommée dans `from`,
il ne peut pas hériter d'un filtre appliqué juste avant dans le même pipeline — d'où
`routes_active`. `$geoNear` (Q4) exige un index géospatial déjà existant sur la collection
interrogée — impossible de le créer à la volée dans la requête qui l'utilise.

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
| `{ loc: "2dsphere" }` | `airports` | `$geoNear` | Q4 : distance depuis un aéroport de référence (CDG) — créé par `db/prepare-derived-data.js` |

**Index écarté :** `{ dst_airport: 1 }` sur `routes` a été mesuré (COLLSCAN 66 985 → IXSCAN 517,
techniquement efficace) puis supprimé — aucune des 4 questions ne filtre par `dst_airport` seul,
et aucune route API "arrivées" n'est prévue. Détail et capture dans `rapport/RAPPORT.md`
chapitre iii.

Capture avant/après sur `db.routes.find({ src_airport: "CDG" })` (voir `rapport/captures/`) : COLLSCAN, 66 985 documents examinés → IXSCAN, 524 documents examinés (= nombre retourné).

## 6. API

FastAPI + PyMongo (`api/main.py`). Liste complète des routes (`api/main.py`) :

| Route | Méthode(s) | Rôle |
|---|---|---|
| `/health` | GET | Diagnostic — auth Mongo + comptage des 3 collections |
| `/airports`, `/airports/{iata}` | GET, POST, PUT, DELETE | CRUD  de la collection `airports` ; branché sur le front |
| `/agg/q1` | GET | Q1 — 10 aéroports par nombre de destinations distinctes |
| `/agg/q2` | GET | Q2 — 10 compagnies actives par nombre de destinations distinctes |
| `/agg/itineraire?depart=X&arrivee=Y&max_escales=3` | GET | Q3 — `$graphLookup`, nécessite `db/prepare-derived-data.js` (`routes_active`) |
| `/agg/destinations-lointaines?origine=CDG&limite=10` | GET | Q4 — `$geoNear`, nécessite `db/prepare-derived-data.js` (index `2dsphere`) |
| `/agg/explain` | GET | Plan d'exécution (protocole avant/après index, §1.5) |
| `/admin/index` | POST, DELETE | Création/suppression des index à la demande |

Les 4 sont branchées côté front (`web/app.js`) : Q1/Q2 en tableau, Q3 en recherche
départ/arrivée avec reconstruction du trajet, Q4 en tableau des destinations par distance **+
carte Leaflet** (marqueurs placés aux coordonnées `airports.loc`, index `2dsphere` donc
exploité par le calcul *et* par l'affichage — bonus §1 "facultatif").

Testées via le protocole du sujet (§5) : `docker compose down -v` puis `up -d` depuis un état
arrêté, import + `create-indexes.js` + `prepare-derived-data.js`, puis appels `curl` réels sur
`localhost:8000`. Exemples : `CDG→MAO` → 1 escale (via Rio de Janeiro) ; destination la plus
lointaine en direct actif depuis CDG → Santiago du Chili, 11 686 km. Détail complet et pipelines
commentés dans `rapport/RAPPORT.md` chapitre iv.

Sans `db/prepare-derived-data.js`, ces deux routes échouaient avec un **404 trompeur** ;
corrigé, elles renvoient maintenant un **503 explicite** — 3 scénarios testés dans
`rapport/captures/erreurs-prerequis-manquants.txt`.

## 7. Installation

```bash
cp .env.example .env   # puis changez les mots de passe
docker compose up -d
```

Avant de démarrer, vérifiez que les ports 27017, 8000 et 3000 sont libres (voir l'en-tête de
`docker-compose.yml` — le 27017 est aussi celui des TP des jours 1 à 4).

| Service | Rôle | Port |
|---|---|---|
| `mongo` | MongoDB 7.0, auth activée, exécute `db/*.js` à la création du volume | 27017 |
| `api` | FastAPI + PyMongo (`api/main.py`) | 8000 — [http://localhost:8000/docs](http://localhost:8000/docs) |
| `web` | Front statique (nginx) | 3000 |

Vérification : `curl http://localhost:8000/health` puis ouvrir `http://localhost:3000`.

## 8. Bonus (facultatif, §8 du sujet)

5 des 6 bonus traités (détail, pipelines et captures dans `rapport/RAPPORT.md`) :

| Bonus | Traité | Reproduire |
|---|---|---|
| B1 — naïf vs correct (Q1) | oui | déjà dans `/agg/q1` + pipeline correct documenté |
| B2 — requête couverte | oui | mesure ponctuelle en base, aucun index laissé en place |
| B3 — changement d'échelle ×10 | oui | mesure ponctuelle sur une collection de test, supprimée après |
| B4 — validateur `$jsonSchema` | oui | `mongosh "mongodb://<MONGO_ROOT_USER>:<MONGO_ROOT_PASSWORD>@localhost:27017/transport?authSource=admin" db/apply-schema-validator.js` — nécessite le compte **admin** (`readWrite` n'a pas le droit `collMod`) |
| B5 — Replica Set + panne | non | pas traité |
| B6 — graphe caché (`$graphLookup`) | oui | déjà dans `/agg/itineraire` (Q3) |

Le validateur B4 n'est pas rejoué automatiquement par `docker compose up` (pas dans
`db/01-init-app-user.js`, qui tourne avant l'import, avant que `routes` existe) : ordre suivi —
import (§2) → `create-indexes.js` (§5) → `prepare-derived-data.js` (§2) → **`apply-schema-validator.js`**,
avant toute écriture CRUD que vous voulez voir protégée (les lectures/`/agg/*` ne sont jamais
affectées, un `$jsonSchema` ne s'applique qu'aux insert/update). Seule dépendance technique
réelle : `mongoimport --collection routes` doit être passé au moins une fois — `collMod` modifie
une collection existante, il ne peut pas en créer une (`NamespaceNotFound` sinon, vérifié).
`create-indexes.js`/`prepare-derived-data.js` n'ont aucun rapport avec le validateur, ils sont
juste dans cet ordre parce que c'est l'ordre naturel d'installation.

## 9. Répartition du travail dans le binôme

| Membre | Périmètre |
|---|---|
| **Navid Sabete** | Squelette du projet (`docker-compose.yml`, `api/main.py`, `db/01-init-app-user.js`, `web/`), front général (UI/UX), pipelines Q1 et Q2, CRUD |
| **Mathieu Ponnou** | Import des données, détection d'anomalies, index, pipelines Q3 et Q4, carte géospatiale, README et rapport |
