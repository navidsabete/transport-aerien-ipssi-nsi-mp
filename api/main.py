"""Air Routes — API REST FastAPI + MongoDB.

API du projet final NoSQL — Réseau de vols.

Collections :
    routes    : liaisons aériennes
    airports  : aéroports
    airlines  : compagnies aériennes

Questions métier :
    Q1 — Quels sont les 10 aéroports possédant le plus grand nombre
         de destinations différentes ?

    Q2 — Quelles sont les 10 compagnies actives desservant le plus
         de destinations différentes ?

Documentation interactive : http://localhost:8000/docs
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
from pymongo.errors import PyMongoError

MONGO_URI = os.environ["MONGO_URI"]
MONGO_DB = os.environ.get("MONGO_DB", "transport")
COLLECTION = os.environ.get("COLLECTION", "routes")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:3000")

# Mettez AUTO_INDEX=false dans .env pour démarrer SANS index : c'est ce qui vous
# permet de capturer l'explain() "avant" exigé par le cahier des charges (§1.5).
AUTO_INDEX = os.environ.get("AUTO_INDEX", "true").lower() != "false"


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Démarrage / arrêt de l'application."""
    if AUTO_INDEX:
        creer_index()
    yield
    client.close()


app = FastAPI(title="Projet NoSQL — API", version="1.0.0", lifespan=lifespan)

# En production, on liste les origines autorisées. Jamais allow_origins=["*"].
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# UN SEUL client pour tout le processus : il gère lui-même son pool.
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
col = db[COLLECTION]
routes = db["routes"]
airports = db["airports"]
airlines = db["airlines"]


def creer_index() -> list[str]:
    """Crée les index retenus pour les requêtes du projet."""

    index_crees = [
        routes.create_index(
            [("src_airport", ASCENDING)],
            name="routes_src_airport",
        ),
        airports.create_index(
            [("iata", ASCENDING)],
            name="airports_iata",
        ),
        airlines.create_index(
            [("id", ASCENDING)],
            name="airlines_id",
        ),
        routes.create_index(
            [("airline.id", ASCENDING)],
            name="routes_airline_id",
        ),
    ]

    return index_crees


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
    try:
        client.admin.command("ping")
    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"MongoDB indisponible : {exc}",
        )

    return {
        "status": "ok",
        "base": MONGO_DB,
        "collection": COLLECTION,
        "documents": routes.count_documents({}),
        "collections": {
            "routes": routes.count_documents({}),
            "airports": airports.count_documents({}),
            "airlines": airlines.count_documents({}),
        },
    }


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

@app.get("/agg/q1")
def q1_aeroports_connectes(
    limite: int = Query(10, ge=1, le=50),
) -> list[dict[str, Any]]:
    """
    Q1 — Quels sont les 10 aéroports possédant le plus grand nombre
    de destinations différentes ?

    Le calcul porte sur les routes de départ.
    Les destinations sont dédupliquées avec $addToSet.

    Le $lookup vers airports est effectué après le classement afin
    de limiter le nombre de documents enrichis.
    """

    pipeline = [
        {
            "$group": {
                "_id": "$src_airport",
                "destinations": {
                    "$addToSet": "$dst_airport"
                },
            }
        },
        {
            "$project": {
                "_id": 0,
                "iata": "$_id",
                "nombre_destinations": {
                    "$size": "$destinations"
                },
            }
        },
        {
            "$sort": {
                "nombre_destinations": -1,
                "iata": 1,
            }
        },
        {
            "$limit": limite
        },
        {
            "$lookup": {
                "from": "airports",
                "localField": "iata",
                "foreignField": "iata",
                "as": "airport",
            }
        },
        {
            "$unwind": "$airport"
        },
        {
            "$project": {
                "_id": 0,
                "iata": 1,
                "nom": "$airport.name",
                "ville": "$airport.city",
                "pays": "$airport.country",
                "nombre_destinations": 1,
            }
        },
        {
            "$sort": {
                "nombre_destinations": -1,
                "iata": 1,
            }
        },
    ]

    try:
        return list(routes.aggregate(pipeline))
    except PyMongoError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'agrégation Q1 : {exc}",
        )


# ================================================================
# Q2 — Top 10 des compagnies actives
# ================================================================

@app.get("/agg/q2")
def q2_compagnies_actives(
    limite: int = Query(10, ge=1, le=50),
) -> list[dict[str, Any]]:
    """
    Q2 — Quelles sont les 10 compagnies actives desservant
    le plus de destinations différentes ?

    Seules les compagnies dont airlines.active == "Y"
    sont conservées.
    """

    pipeline = [
        {
            "$group": {
                "_id": "$airline.id",
                "destinations": {
                    "$addToSet": "$dst_airport"
                },
            }
        },
        {
            "$project": {
                "_id": 0,
                "airline_id": "$_id",
                "nombre_destinations": {
                    "$size": "$destinations"
                },
            }
        },
        {
            "$lookup": {
                "from": "airlines",
                "localField": "airline_id",
                "foreignField": "id",
                "as": "airline",
            }
        },
        {
            "$unwind": "$airline"
        },
        {
            "$match": {
                "airline.active": "Y"
            }
        },
        {
            "$project": {
                "_id": 0,
                "airline_id": 1,
                "nom": "$airline.name",
                "iata": "$airline.iata",
                "icao": "$airline.icao",
                "pays": "$airline.country",
                "active": "$airline.active",
                "nombre_destinations": 1,
            }
        },
        {
            "$sort": {
                "nombre_destinations": -1,
                "nom": 1,
            }
        },
        {
            "$limit": limite
        },
    ]

    try:
        return list(routes.aggregate(pipeline))
    except PyMongoError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'agrégation Q2 : {exc}",
        )





# -------------------------------------------------- index & plan d'exécution
@app.post("/admin/index", status_code=201)
def creer_les_index() -> dict[str, Any]:
    """Crée les index utilisés par le projet."""

    return {
        "index_crees": creer_index()
    }


@app.delete("/admin/index")
def supprimer_les_index() -> dict[str, Any]:
    """Supprime les index applicatifs en conservant _id_."""

    avant = {
        "routes": [
            name
            for name in routes.index_information()
            if name != "_id_"
        ],
        "airports": [
            name
            for name in airports.index_information()
            if name != "_id_"
        ],
        "airlines": [
            name
            for name in airlines.index_information()
            if name != "_id_"
        ],
    }

    routes.drop_indexes()
    airports.drop_indexes()
    airlines.drop_indexes()

    return {
        "index_supprimes": avant
    }


def _chaine_de_stages(
    etage: dict[str, Any],
) -> list[str]:
    """Déroule la pile des stages MongoDB."""

    chaine = []

    while etage:
        stage = etage.get("stage")

        if stage:
            chaine.append(stage)

        etage = (
            etage.get("inputStage")
            or (etage.get("inputStages") or [None])[0]
        )

    return chaine


@app.get("/agg/explain")
def expliquer(
    src_airport: str = Query("CDG", min_length=3, max_length=3),
) -> dict[str, Any]:
    """
    Explique une recherche de routes par aéroport de départ.

    Cette route permet de comparer le plan d'exécution avant/après
    création de l'index routes.src_airport.

    Avant :
        COLLSCAN

    Après :
        FETCH -> IXSCAN
    """

    filtre = {
        "src_airport": src_airport.upper()
    }

    try:
        plan = db.command(
            "explain",
            {
                "find": "routes",
                "filter": filtre,
            },
            verbosity="executionStats",
        )
    except PyMongoError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur explain() : {exc}",
        )

    stats = plan["executionStats"]

    stages = _chaine_de_stages(
        stats["executionStages"]
    )

    nb_rendus = stats["nReturned"]

    return {
        "requete": {
            "collection": "routes",
            "filtre": filtre,
        },
        "stages": stages,
        "stage_racine": stages[0] if stages else None,
        "index_utilise": "IXSCAN" in stages,
        "totalDocsExamined": stats["totalDocsExamined"],
        "totalKeysExamined": stats["totalKeysExamined"],
        "nReturned": nb_rendus,
        "ratio_examines_sur_rendus": (
            round(
                stats["totalDocsExamined"] / nb_rendus,
                1,
            )
            if nb_rendus
            else None
        ),
        "executionTimeMillis": stats["executionTimeMillis"],
    }