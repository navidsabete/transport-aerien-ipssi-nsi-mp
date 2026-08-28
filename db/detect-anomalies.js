// db/detect-anomalies.js
// Requetes de detection d'anomalies sur le jeu "Transport aerien".
// A rejouer a chaque import (mongosh) pour verifier que les chiffres du rapport
// (rapport/RAPPORT.md, chapitre ii) sont toujours a jour.
//
// Usage : mongosh "<MONGO_URI>/transport" db/detect-anomalies.js

print("=== 1. Routes dont l'aeroport de DEPART (src_airport) n'existe pas dans airports.iata ===");
printjson(db.routes.aggregate([
  {
    $lookup: {
      from: "airports",
      localField: "src_airport",
      foreignField: "iata",
      as: "src_match"
    }
  },
  { $match: { src_match: { $size: 0 } } },
  { $count: "routes_avec_src_airport_introuvable" }
]).toArray());

print("=== 2. Routes dont l'aeroport d'ARRIVEE (dst_airport) n'existe pas dans airports.iata ===");
printjson(db.routes.aggregate([
  {
    $lookup: {
      from: "airports",
      localField: "dst_airport",
      foreignField: "iata",
      as: "dst_match"
    }
  },
  { $match: { dst_match: { $size: 0 } } },
  { $count: "routes_avec_dst_airport_introuvable" }
]).toArray());

print("=== 3. Routes affectees par AU MOINS UN des deux aeroports introuvable (src OU dst) ===");
printjson(db.routes.aggregate([
  {
    $lookup: {
      from: "airports",
      localField: "src_airport",
      foreignField: "iata",
      as: "src_match"
    }
  },
  {
    $lookup: {
      from: "airports",
      localField: "dst_airport",
      foreignField: "iata",
      as: "dst_match"
    }
  },
  {
    $match: {
      $or: [
        { src_match: { $size: 0 } },
        { dst_match: { $size: 0 } }
      ]
    }
  },
  { $count: "routes_affectees" }
]).toArray());

print("=== 3bis. Total de routes (pour calcul du pourcentage) ===");
printjson(db.routes.countDocuments());

print("=== 4. Aeroports sans code IATA valide (3 caracteres alphanumeriques) - inclut les valeurs '\\N' ===");
printjson(db.airports.aggregate([
  {
    $match: {
      $expr: {
        $cond: [
          { $eq: [{ $type: "$iata" }, "string"] },
          { $not: { $regexMatch: { input: "$iata", regex: /^[A-Za-z0-9]{3}$/ } } },
          true
        ]
      }
    }
  },
  { $count: "aeroports_iata_invalide" }
]).toArray());

print("=== 5. Aeroports avec coordonnees (0,0) - valeur sentinelle 'null island' ===");
printjson(db.airports.find({ lat: { $gt: -0.0001, $lt: 0.0001 }, lon: { $gt: -0.0001, $lt: 0.0001 } }).toArray());

print("=== 6. Doublons de routes (meme compagnie + meme trajet) ===");
printjson(db.routes.aggregate([
  {
    $group: {
      _id: { airline: "$airline.id", src: "$src_airport", dst: "$dst_airport" },
      n: { $sum: 1 }
    }
  },
  { $match: { n: { $gt: 1 } } },
  { $count: "trajets_dupliques" }
]).toArray());

print("=== 7. Compagnies referencees dans routes.airline.id mais absentes de airlines.id ===");
printjson(db.routes.aggregate([
  { $group: { _id: "$airline.id" } },
  {
    $lookup: {
      from: "airlines",
      localField: "_id",
      foreignField: "id",
      as: "match"
    }
  },
  { $match: { match: { $size: 0 } } },
  { $count: "airline_id_orphelins" }
]).toArray());

print("=== 8. Valeurs de airlines.active hors du vocabulaire canonique {Y, N} (casse, autre) ===");
printjson(db.airlines.aggregate([
  { $match: { active: { $nin: ["Y", "N"] } } },
  { $project: { _id: 0, id: 1, name: 1, active: 1 } }
]).toArray());

print("=== 9. Repartition des routes selon le statut de leur compagnie (Y = active, N/n = inactive) ===");
printjson(db.routes.aggregate([
  {
    $lookup: {
      from: "airlines",
      localField: "airline.id",
      foreignField: "id",
      as: "al"
    }
  },
  { $unwind: { path: "$al", preserveNullAndEmptyArrays: true } },
  {
    $group: {
      _id: { $toUpper: { $ifNull: ["$al.active", "INCONNU"] } },
      n: { $sum: 1 }
    }
  }
]).toArray());
