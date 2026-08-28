// db/prepare-derived-data.js
// Prepare les donnees derivees necessaires a Q3 et Q4 (rapport/RAPPORT.md, chapitre iv).
// A rejouer apres db/create-indexes.js, et a chaque reimport de routes.json/airports.dat.
// Idempotent : $out remplace entierement routes_active, createIndex ne fait rien si deja present.
//
// Usage : mongosh "<MONGO_URI>/transport" db/prepare-derived-data.js

print("1/3 -- Ajout des coordonnees GeoJSON (loc) sur airports, derivees de lat/lon");
db.airports.updateMany({}, [
  { $set: { loc: { type: "Point", coordinates: ["$lon", "$lat"] } } }
]);
printjson(db.airports.createIndex({ loc: "2dsphere" }));
// NB : l'aeroport a (0,0) (cf. rapport, chapitre ii) obtient un point GeoJSON valide
// mais fictif -- a exclure explicitement de toute lecture de $geoNear si un jour utilise
// comme origine.

print("2/3 -- Materialisation de routes_active (routes operees par une compagnie active)");
db.routes.aggregate([
  {
    $lookup: {
      from: "airlines",
      localField: "airline.id",
      foreignField: "id",
      as: "al"
    }
  },
  { $unwind: "$al" },
  // Insensible a la casse : cf. anomalie airlines.active = 'n' minuscule (chapitre ii)
  { $match: { "al.active": { $regex: /^Y$/i } } },
  { $project: { src_airport: 1, dst_airport: 1, airline: 1, airplane: 1, stops: 1 } },
  { $out: "routes_active" }
]);
print("routes_active :", db.routes_active.countDocuments(), "documents");
// Attendu : 65 993 (66 985 routes - 992 operees par une compagnie inactive)

print("3/3 -- Index sur routes_active.src_airport (point de depart du \$graphLookup de Q3)");
printjson(db.routes_active.createIndex({ src_airport: 1 }));

print("OK -- pret pour Q3 (\$graphLookup) et Q4 (\$geoNear)");
