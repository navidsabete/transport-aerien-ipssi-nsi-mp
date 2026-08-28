// db/create-indexes.js
// Cree les 4 index justifies du projet (voir rapport/RAPPORT.md, chapitre iii,
// section Indexation, pour la mesure explain() avant/apres et le besoin reel de chacun).
// A rejouer apres chaque import (idempotent : createIndex ne fait rien si l'index existe deja
// SOUS LE MEME NOM -- d'ou les noms explicites ci-dessous, qui doivent rester identiques a
// ceux de creer_index() dans api/main.py, sinon l'API refuse de demarrer au prochain redemarrage
// (IndexOptionsConflict : meme cle, nom different). Vecu en direct pendant le developpement.
//
// Usage : mongosh "<MONGO_URI>/transport" db/create-indexes.js

print("routes.src_airport -- Q1 (regroupement par aeroport de depart), Q3 (depart du $graphLookup)");
printjson(db.routes.createIndex({ src_airport: 1 }, { name: "routes_src_airport" }));

print("airports.iata -- \$lookup routes->airports pour Q1 (filtrer aeroport fantome) et Q4 (coordonnees)");
printjson(db.airports.createIndex({ iata: 1 }, { name: "airports_iata" }));

print("airlines.id -- \$lookup routes->airlines pour Q2/Q3/Q4 (statut active)");
printjson(db.airlines.createIndex({ id: 1 }, { name: "airlines_id" }));

print("routes.airline.id -- Q2 (regroupement des routes par compagnie)");
printjson(db.routes.createIndex({ "airline.id": 1 }, { name: "routes_airline_id" }));

// NB : { dst_airport: 1 } sur routes a ete mesure puis ECARTE (cf. rapport, chapitre iii) :
// aucune des 4 questions ne filtre/groupe par dst_airport seul. Ne pas le recreer sans
// une nouvelle justification (ex. route API "vols arrivant a Y").

print("Index actuels :");
print("- routes:"); printjson(db.routes.getIndexes().map(i => i.name));
print("- airports:"); printjson(db.airports.getIndexes().map(i => i.name));
print("- airlines:"); printjson(db.airlines.getIndexes().map(i => i.name));
