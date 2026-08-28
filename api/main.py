"""Projet final NoSQL — squelette d'API REST (FastAPI + PyMongo).

Ce fichier est un POINT DE DÉPART volontairement minimal : un CRUD complet,
une route d'agrégation et une route de diagnostic. À vous de le remplacer par
les collections, les modèles et les pipelines de VOTRE sujet.

Ce qu'il illustre et qu'il faut conserver :
  - un seul MongoClient pour toute l'application (pool de connexions) ;
  - la sérialisation ObjectId -> str, sinon FastAPI ne sait pas répondre ;
  - la validation des entrées par Pydantic (jamais de dict brut inséré) ;
  - les bons codes HTTP (404, 422) et la pagination ;
  - les secrets lus dans l'environnement, jamais écrits dans le code.

Documentation interactive une fois démarré : http://localhost:8000/docs
"""

import os
from contextlib import asynccontextmanager
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import OperationFailure

MONGO_URI = os.environ["MONGO_URI"]
MONGO_DB = os.environ.get("MONGO_DB", "transport")
COLLECTION = os.environ.get("COLLECTION", "items")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:3000")

# Mettez AUTO_INDEX=false dans .env pour démarrer SANS index : c'est ce qui vous
# permet de capturer l'explain() "avant" exigé par le cahier des charges (§1.5).
AUTO_INDEX = os.environ.get("AUTO_INDEX", "true").lower() != "false"


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Démarrage / arrêt de l'application.

    `@app.on_event("startup")` est DÉPRÉCIÉ depuis FastAPI 0.93 : on utilise un
    gestionnaire de contexte `lifespan`. Ne recopiez pas l'ancienne forme.
    """
    if AUTO_INDEX:
        creer_index()
    yield
    client.close()


app = FastAPI(title="Projet NoSQL — API", version="1.0.0", lifespan=lifespan)

# En production, on liste les origines autorisées. Jamais allow_origins=["*"].
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# UN SEUL client pour tout le processus : il gère lui-même son pool.
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
col = db[COLLECTION]

# Collections du sujet "Réseau de vols" (Q3/Q4, cf. rapport/RAPPORT.md chapitre iv).
# routes_active et airports.loc sont préparées par db/prepare-derived-data.js — à
# rejouer après chaque import, sinon ces deux routes renvoient un jeu vide/404.
col_routes_active = db["routes_active"]
col_airports = db["airports"]


def creer_index() -> list[str]:
    """Les index font partie du code, pas d'une manipulation manuelle oubliée.

    Remplacez-les par les vôtres — et justifiez chacun par un explain().
    """
    return [
        col.create_index([("nom", ASCENDING)]),
        col.create_index([("categorie", ASCENDING), ("valeur", DESCENDING)]),
    ]


class ItemEntrant(BaseModel):
    """Ce que le client a le droit d'envoyer. Tout le reste est rejeté en 422."""

    nom: str = Field(min_length=1, max_length=200)
    categorie: str = Field(min_length=1, max_length=100)
    valeur: float = Field(ge=0)


def serialiser(doc: dict[str, Any]) -> dict[str, Any]:
    """ObjectId n'est pas sérialisable en JSON : on le convertit en chaîne."""
    doc["_id"] = str(doc["_id"])
    return doc


def en_object_id(item_id: str) -> ObjectId:
    try:
        return ObjectId(item_id)
    except InvalidId:
        raise HTTPException(status_code=422, detail="Identifiant invalide")


# --------------------------------------------------------------- diagnostic
@app.get("/health")
def health() -> dict[str, Any]:
    """Vérifie que l'API parle bien à MongoDB. Première commande du passage de validation."""
    client.admin.command("ping")
    return {"status": "ok", "base": MONGO_DB, "collection": COLLECTION,
            "documents": col.count_documents({})}


# --------------------------------------------------------------------- CRUD
@app.get("/items")
def lister(
    categorie: str | None = None,
    limite: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
) -> dict[str, Any]:
    """Liste paginée. La pagination n'est pas un bonus : sans elle, une
    collection de 70 000 documents fait tomber le navigateur."""
    filtre = {"categorie": categorie} if categorie else {}
    curseur = col.find(filtre).skip((page - 1) * limite).limit(limite)
    return {
        "page": page,
        "limite": limite,
        "total": col.count_documents(filtre),
        "resultats": [serialiser(d) for d in curseur],
    }


@app.get("/items/{item_id}")
def detail(item_id: str) -> dict[str, Any]:
    doc = col.find_one({"_id": en_object_id(item_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return serialiser(doc)


@app.post("/items", status_code=201)
def creer(item: ItemEntrant) -> dict[str, str]:
    resultat = col.insert_one(item.model_dump())
    return {"_id": str(resultat.inserted_id)}


@app.put("/items/{item_id}")
def modifier(item_id: str, item: ItemEntrant) -> dict[str, Any]:
    resultat = col.update_one({"_id": en_object_id(item_id)},
                              {"$set": item.model_dump()})
    if resultat.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return {"modifies": resultat.modified_count}


@app.delete("/items/{item_id}")
def supprimer(item_id: str) -> dict[str, int]:
    resultat = col.delete_one({"_id": en_object_id(item_id)})
    if resultat.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return {"supprimes": resultat.deleted_count}


# --------------------------------------------------------------- agrégation
@app.get("/agg/par-categorie")
def par_categorie(limite: int = Query(10, ge=1, le=50)) -> list[dict[str, Any]]:
    """Exemple d'agrégation exposée en REST.

    Question métier : « quelles catégories pèsent le plus, et quelle est leur
    valeur moyenne ? » — remplacez-la par une vraie question de votre sujet.
    """
    pipeline = [
        {"$group": {"_id": "$categorie",
                    "total": {"$sum": "$valeur"},
                    "moyenne": {"$avg": "$valeur"},
                    "n": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": limite},
        {"$project": {"_id": 0, "categorie": "$_id", "total": 1,
                      "moyenne": {"$round": ["$moyenne", 2]}, "n": 1}},
    ]
    return list(col.aggregate(pipeline))


# ------------------------------------------------------- sujet : reseau de vols
def _verifier_routes_active() -> None:
    """Q3 et Q4 dépendent de db/prepare-derived-data.js.

    Sans ce garde-fou, une collection `routes_active` absente ou vide ne lève AUCUNE
    exception côté MongoDB : `$graphLookup`/`distinct` renvoient juste un résultat
    vide, et l'API répondait alors un 404 « aucun trajet trouvé » trompeur, comme si
    la donnée métier manquait — alors que le vrai problème est un prérequis non
    rejoué. D'où une vérification explicite plutôt qu'un `try/except` (rien à
    attraper : Mongo ne plante pas ici, il répond juste « rien »).
    """
    if col_routes_active.estimated_document_count() == 0:
        raise HTTPException(
            status_code=503,
            detail="routes_active est vide ou absente — lancez "
                   "`mongosh \"$MONGO_URI\" db/prepare-derived-data.js` avant "
                   "d'utiliser cette route (voir README §2).",
        )


@app.get("/agg/itineraire")
def itineraire(
    depart: str = Query(..., min_length=3, max_length=3,
                        description="Code IATA de départ, ex. CDG"),
    arrivee: str = Query(..., min_length=3, max_length=3,
                         description="Code IATA d'arrivée, ex. MAO"),
    max_escales: int = Query(3, ge=0, le=5),
) -> dict[str, Any]:
    """Q3 — Comment relier X à Y avec le moins d'escales, compagnies actives uniquement ?

    $graphLookup part de `depart` et explore le graphe `routes_active` (déjà filtré
    sur airlines.active) jusqu'à `max_escales`. Le chemin le plus court est ensuite
    reconstruit en remontant les arêtes par profondeur décroissante — MongoDB donne
    l'ensemble des arêtes atteignables, pas directement la séquence : c'est une mise
    en forme de la réponse, pas un second calcul métier.

    Coût mesuré (rapport/RAPPORT.md, chapitre iv) : depuis un hub comme CDG,
    maxDepth=3 explore ~65 000 arêtes sur 65 993 en ~4,4 s — l'essentiel du graphe
    est atteignable en 3 escales (petit-monde), d'où le plafond à 5 côté API.
    """
    _verifier_routes_active()
    depart, arrivee = depart.upper(), arrivee.upper()
    pipeline = [
        {"$documents": [{"airport": depart}]},
        {"$graphLookup": {
            "from": "routes_active",
            "startWith": "$airport",
            "connectFromField": "dst_airport",
            "connectToField": "src_airport",
            "as": "reseau",
            "maxDepth": max_escales,
            "depthField": "escales",
        }},
    ]
    resultat = list(db.aggregate(pipeline))
    aretes = resultat[0]["reseau"] if resultat else []

    candidats = [a for a in aretes if a["dst_airport"] == arrivee]
    if not candidats:
        raise HTTPException(
            status_code=404,
            detail=f"Aucun trajet {depart} -> {arrivee} en {max_escales} escale(s) "
                   "maximum avec une compagnie active",
        )

    min_escales = min(a["escales"] for a in candidats)
    dernier = next(a for a in candidats if a["escales"] == min_escales)

    chemin = [dernier]
    courant = dernier["src_airport"]
    for profondeur in range(min_escales - 1, -1, -1):
        precedent = next(
            a for a in aretes if a["escales"] == profondeur and a["dst_airport"] == courant
        )
        chemin.insert(0, precedent)
        courant = precedent["src_airport"]

    return {
        "depart": depart,
        "arrivee": arrivee,
        "escales": min_escales,
        "vols": [
            {
                "de": v["src_airport"],
                "vers": v["dst_airport"],
                "compagnie": v["airline"]["name"],
                "compagnie_iata": v["airline"]["iata"],
                "avion": v.get("airplane"),
            }
            for v in chemin
        ],
    }


@app.get("/agg/destinations-lointaines")
def destinations_lointaines(
    origine: str = Query("CDG", min_length=3, max_length=3,
                         description="Code IATA de l'aéroport de référence"),
    limite: int = Query(10, ge=1, le=50),
) -> dict[str, Any]:
    """Q4 — 10 destinations les plus lointaines en vol direct actif depuis `origine`.

    $geoNear (index 2dsphere sur airports.loc) calcule la distance orthodromique
    depuis `origine` vers chaque destination directe active, triée décroissante.
    """
    origine = origine.upper()

    # 404 : l'aéroport n'existe pas. Distinct d'un 503 : il existe mais la donnée
    # dérivée (champ loc) n'a pas été préparée — deux causes différentes, deux
    # réponses différentes, sinon on fait croire à un problème de données là où
    # c'est un prérequis manquant (cf. _verifier_routes_active ci-dessus).
    aeroport_origine = col_airports.find_one({"iata": origine}, {"loc": 1})
    if aeroport_origine is None:
        raise HTTPException(status_code=404,
                            detail=f"Aéroport de référence introuvable : {origine}")
    if "loc" not in aeroport_origine:
        raise HTTPException(
            status_code=503,
            detail=f"{origine} existe mais n'a pas de coordonnées GeoJSON — lancez "
                   "`mongosh \"$MONGO_URI\" db/prepare-derived-data.js` avant "
                   "d'utiliser cette route (voir README §2).",
        )

    _verifier_routes_active()
    destinations = col_routes_active.distinct("dst_airport", {"src_airport": origine})
    if not destinations:
        raise HTTPException(status_code=404,
                            detail=f"Aucune destination active au départ de {origine}")

    pipeline = [
        {"$geoNear": {
            "near": aeroport_origine["loc"],
            "distanceField": "distance_m",
            "spherical": True,
            "query": {"iata": {"$in": destinations}},
        }},
        {"$sort": {"distance_m": -1}},
        {"$limit": limite},
        {"$project": {
            "_id": 0, "iata": 1, "name": 1, "city": 1, "country": 1,
            "distance_km": {"$round": [{"$divide": ["$distance_m", 1000]}, 0]},
        }},
    ]
    # $geoNear EXIGE un index 2d/2dsphere : contrairement aux deux cas ci-dessus,
    # c'est un vrai cas où MongoDB lève une exception (OperationFailure) s'il ne
    # trouve pas d'index exploitable — d'où le try/except, ici pertinent.
    try:
        resultats = list(col_airports.aggregate(pipeline))
    except OperationFailure as exc:
        raise HTTPException(
            status_code=503,
            detail="$geoNear a échoué (index 2dsphere manquant sur airports.loc ?) : "
                   f"{exc.details.get('errmsg', str(exc))}",
        ) from exc

    return {
        "origine": origine,
        "nb_destinations_directes_actives": len(destinations),
        "resultats": resultats,
    }


# -------------------------------------------------- index & plan d'exécution
@app.post("/admin/index", status_code=201)
def creer_les_index() -> dict[str, Any]:
    """Crée les index à la demande.

    Sert au protocole de capture avant/après du § 1.5 du cahier des charges.
    En production, cette route serait évidemment protégée.
    """
    return {"index_crees": creer_index()}


@app.delete("/admin/index")
def supprimer_les_index() -> dict[str, Any]:
    """Supprime tous les index sauf `_id_`, qui ne peut pas l'être."""
    avant = [i for i in col.index_information() if i != "_id_"]
    col.drop_indexes()
    return {"index_supprimes": avant}


def _chaine_de_stages(etage: dict[str, Any]) -> list[str]:
    """Déroule la pile de stages, du plus haut au plus bas.

    ATTENTION — c'est le piège de la question : le stage RACINE d'une requête
    indexée est `FETCH`, pas `IXSCAN`. L'IXSCAN est son `inputStage`. Ne
    rapportez jamais le seul stage racine : il vous ferait écrire
    « COLLSCAN -> FETCH », ce qui ne prouve rien.
    """
    chaine = []
    while etage:
        chaine.append(etage["stage"])
        etage = etage.get("inputStage") or (etage.get("inputStages") or [None])[0]
    return chaine


@app.get("/agg/explain")
def expliquer(categorie: str = "demo") -> dict[str, Any]:
    """Renvoie le plan d'exécution d'une requête : de quoi produire la capture
    avant/après index demandée dans le rapport, sans quitter l'API.

    Protocole complet :
      1. démarrer avec AUTO_INDEX=false, appeler cette route  -> COLLSCAN
      2. POST /admin/index
      3. rappeler cette route                                 -> FETCH <- IXSCAN
    """
    plan = db.command("explain",
                      {"find": COLLECTION, "filter": {"categorie": categorie}},
                      verbosity="executionStats")
    stats = plan["executionStats"]
    stages = _chaine_de_stages(stats["executionStages"])
    nb_rendus = stats["nReturned"]
    return {
        "stages": stages,                       # ex. ["FETCH", "IXSCAN"]
        "stage_racine": stages[0],
        "index_utilise": "IXSCAN" in stages,
        "totalDocsExamined": stats["totalDocsExamined"],
        "totalKeysExamined": stats["totalKeysExamined"],
        "nReturned": nb_rendus,
        # Le chiffre à commenter dans le rapport : on vise 1.
        "ratio_examines_sur_rendus": (
            round(stats["totalDocsExamined"] / nb_rendus, 1) if nb_rendus else None
        ),
        "executionTimeMillis": stats["executionTimeMillis"],
    }