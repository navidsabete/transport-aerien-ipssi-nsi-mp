"""Air Routes — API REST FastAPI + MongoDB.

API du projet final NoSQL — Réseau de vols.

Collections :
    routes    : liaisons aériennes
    airports  : aéroports
    airlines  : compagnies aériennes

Questions métier :
    Q1 — Quels sont les 10 aéroports possédant le plus grand nombre de destinations différentes ?
    Q2 — Quelles sont les 10 compagnies actives desservant le plus de destinations différentes ?

Documentation interactive : http://localhost:8000/docs
"""

import os
from contextlib import asynccontextmanager
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
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
        routes.create_index([("src_airport", ASCENDING)], name="routes_src_airport" ),
        airports.create_index([("iata", ASCENDING)], name="airports_iata"),
        airlines.create_index([("id", ASCENDING)], name="airlines_id" ),
        routes.create_index([("airline.id", ASCENDING)], name="routes_airline_id"),
    ]
    return index_crees


class AirportEntrant(BaseModel):
    """
    Schéma utilisé par le frontend pour créer/modifier
    un aéroport.

    Variables correspondant au dataset :

        id
        name
        city
        country
        iata
        icao
        lat
        lon
        altitude
        timezone
        dst
        tz_db
        type
        source
    """

    id: int | None = Field(
        default=None,
        description="Identifiant de l'aéroport",
    )

    name: str = Field(
        min_length=1,
        max_length=200,
        description="Nom de l'aéroport",
    )

    city: str = Field(
        min_length=1,
        max_length=100,
        description="Ville",
    )

    country: str = Field(
        min_length=1,
        max_length=100,
        description="Pays",
    )

    iata: str = Field(
        min_length=3,
        max_length=3,
        description="Code IATA",
    )

    icao: str | None = Field(
        default=None,
        max_length=4,
        description="Code ICAO",
    )

    lat: float | None = Field(
        default=None,
        ge=-90,
        le=90,
        description="Latitude",
    )

    lon: float | None = Field(
        default=None,
        ge=-180,
        le=180,
        description="Longitude",
    )

    altitude: float | None = Field(
        default=None,
        description="Altitude",
    )

    timezone: str | None = Field(
        default=None,
        max_length=50,
        description="Fuseau horaire",
    )

    dst: str | None = Field(
        default=None,
        max_length=20,
        description="DST",
    )

    tz_db: str | None = Field(
        default=None,
        max_length=100,
        description="Nom du fuseau dans la base TZ",
    )

    type: str | None = Field(
        default=None,
        max_length=50,
        description="Type d'aéroport",
    )

    source: str | None = Field(
        default=None,
        max_length=100,
        description="Source des données",
    )

    @field_validator("iata")
    @classmethod
    def valider_iata(cls, value: str) -> str:
        value = value.strip().upper()

        if not value.isalpha():
            raise ValueError(
                "Le code IATA doit contenir exactement 3 lettres."
            )

        return value

    @field_validator("icao")
    @classmethod
    def normaliser_icao(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip().upper()

        if value == "":
            return None

        return value

    @field_validator(
        "name",
        "city",
        "country",
        "timezone",
        "dst",
        "tz_db",
        "type",
        "source",
    )
    @classmethod
    def nettoyer_texte(
        cls,
        value: str,
    ) -> str:
        return value.strip()


# ============================================================
# SERIALISATION
# ============================================================

def serialiser_airport(
    document: dict[str, Any],
) -> dict[str, Any]:
    """
    Retourne uniquement les variables métier du schéma airport.

    Le _id MongoDB reste interne et n'est pas envoyé au frontend.
    """

    return {
        "id": document.get("id"),
        "name": document.get("name"),
        "city": document.get("city"),
        "country": document.get("country"),
        "iata": document.get("iata"),
        "icao": document.get("icao"),
        "lat": document.get("lat"),
        "lon": document.get("lon"),
        "altitude": document.get("altitude"),
        "timezone": document.get("timezone"),
        "dst": document.get("dst"),
        "tz_db": document.get("tz_db"),
        "type": document.get("type"),
        "source": document.get("source"),
    }


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
# ============================================================
# CREATE AIRPORT
# ============================================================

@app.post(
    "/airports",
    status_code=status.HTTP_201_CREATED,
)
def creer_airport(
    airport: AirportEntrant,
) -> dict[str, Any]:
    """
    Crée un nouvel aéroport.
    """

    donnees = airport.model_dump()

    existe = airports.find_one(
        {"iata": donnees["iata"]}
    )

    if existe is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"L'aéroport {donnees['iata']} existe déjà."
            ),
        )

    resultat = airports.insert_one(donnees)

    document = airports.find_one(
        {"_id": resultat.inserted_id}
    )

    return {
        "message": "Aéroport créé avec succès.",
        "airport": serialiser_airport(document),
    }


# ============================================================
# READ — LISTE PAGINEE
# ============================================================

@app.get("/airports")
def lister_airports(
    pays: str | None = None,
    ville: str | None = None,
    limite: int = Query(
        20,
        ge=1,
        le=100,
    ),
    page: int = Query(
        1,
        ge=1,
    ),
) -> dict[str, Any]:
    """
    Liste paginée des aéroports.
    """

    filtre: dict[str, Any] = {}

    if pays:
        filtre["country"] = pays.strip()

    if ville:
        filtre["city"] = ville.strip()

    skip = (page - 1) * limite

    curseur = (
        airports
        .find(filtre)
        .sort("iata", 1)
        .skip(skip)
        .limit(limite)
    )

    total = airports.count_documents(filtre)

    return {
        "page": page,
        "limite": limite,
        "total": total,
        "resultats": [
            serialiser_airport(document)
            for document in curseur
        ],
    }


# ============================================================
# READ — DETAIL
# ============================================================

@app.get("/airports/{iata}")
def detail_airport(
    iata: str,
) -> dict[str, Any]:
    """
    Retourne le détail d'un aéroport à partir du code IATA.
    """

    code = iata.strip().upper()

    if len(code) != 3 or not code.isalpha():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Code IATA invalide.",
        )

    document = airports.find_one(
        {"iata": code}
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Aucun aéroport trouvé pour le code {code}."
            ),
        )

    return serialiser_airport(document)


# ============================================================
# UPDATE
# ============================================================

@app.put("/airports/{iata}")
def modifier_airport(
    iata: str,
    airport: AirportEntrant,
) -> dict[str, Any]:
    """
    Modifie un aéroport.

    Le code IATA de l'URL reste la référence.
    """

    code = iata.strip().upper()

    if len(code) != 3 or not code.isalpha():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Code IATA invalide.",
        )

    donnees = airport.model_dump()

    if donnees["iata"] != code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Le code IATA fourni doit correspondre "
                "au code IATA de l'URL."
            ),
        )

    champs = {
        "id": donnees["id"],
        "name": donnees["name"],
        "city": donnees["city"],
        "country": donnees["country"],
        "iata": donnees["iata"],
        "icao": donnees["icao"],
        "lat": donnees["lat"],
        "lon": donnees["lon"],
        "altitude": donnees["altitude"],
        "timezone": donnees["timezone"],
        "dst": donnees["dst"],
        "tz_db": donnees["tz_db"],
        "type": donnees["type"],
        "source": donnees["source"],
    }

    resultat = airports.update_one(
        {"iata": code},
        {"$set": champs},
    )

    if resultat.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Aucun aéroport trouvé pour le code {code}."
            ),
        )

    document = airports.find_one(
        {"iata": code}
    )

    return {
        "message": "Aéroport modifié avec succès.",
        "airport": serialiser_airport(document),
    }


# ============================================================
# DELETE
# ============================================================

@app.delete("/airports/{iata}")
def supprimer_airport(
    iata: str,
) -> dict[str, Any]:
    """
    Supprime un aéroport.
    """

    code = iata.strip().upper()

    if len(code) != 3 or not code.isalpha():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Code IATA invalide.",
        )

    resultat = airports.delete_one(
        {"iata": code}
    )

    if resultat.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Aucun aéroport trouvé pour le code {code}."
            ),
        )

    return {
        "message": "Aéroport supprimé avec succès.",
        "iata": code,
        "supprimes": resultat.deleted_count,
    }



# --------------------------------------------------------------- agrégation

@app.get("/agg/q1")
def q1_aeroports_connectes(limite: int = Query(10, ge=1, le=50)) -> list[dict[str, Any]]:
    """
    Q1 — Quels sont les 10 aéroports possédant le plus grand nombre de destinations différentes ?

    Le calcul porte sur les routes de départ. Les destinations sont dédupliquées avec $addToSet.
    Le $lookup vers airports est effectué après le classement afin de limiter le nombre de documents enrichis.
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
        raise HTTPException(status_code=500,
            detail=f"Erreur lors de l'agrégation Q1 : {exc}",
        )


# ================================================================
# Q2 — Top 10 des compagnies actives
# ================================================================

@app.get("/agg/q2")
def q2_compagnies_actives(limite: int = Query(10, ge=1, le=50)) -> list[dict[str, Any]]:
    """
    Q2 — Quelles sont les 10 compagnies actives desservant le plus de destinations différentes ?

    Seules les compagnies dont airlines.active == "Y" sont conservées.
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
        raise HTTPException(status_code=500,
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


def _chaine_de_stages(etage: dict[str, Any]) -> list[str]:
    """Déroule la pile des stages MongoDB."""

    chaine = []

    while etage:
        stage = etage.get("stage")

        if stage:
            chaine.append(stage)

        etage = ( etage.get("inputStage") or (etage.get("inputStages") or [None])[0] )

    return chaine


@app.get("/agg/explain")
def expliquer(src_airport: str = Query("CDG", min_length=3, max_length=3)) -> dict[str, Any]:
    """
    Explique une recherche de routes par aéroport de départ.

    Cette route permet de comparer le plan d'exécution avant/après création de l'index routes.src_airport.
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
        raise HTTPException(status_code=500,
            detail=f"Erreur explain() : {exc}",
        )

    stats = plan["executionStats"]
    stages = _chaine_de_stages(stats["executionStages"])
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