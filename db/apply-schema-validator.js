// db/apply-schema-validator.js
// Bonus B4 (sujet, section facultative) : validateur $jsonSchema sur routes.
// A rejouer apres chaque import, avec un compte ADMIN (pas l'utilisateur applicatif :
// readWrite n'a pas le droit collMod, verifie en le tentant -- "not authorized").
//
// Usage : mongosh "mongodb://<ROOT_USER>:<ROOT_PASSWORD>@mongo:27017/transport?authSource=admin" \
//         db/apply-schema-validator.js

const resultat = db.runCommand({
  collMod: "routes",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["src_airport", "dst_airport", "airline"],
      properties: {
        src_airport: { bsonType: "string", pattern: "^[A-Za-z0-9]{3}$", description: "code IATA 3 caracteres" },
        dst_airport: { bsonType: "string", pattern: "^[A-Za-z0-9]{3}$", description: "code IATA 3 caracteres" },
        stops: { bsonType: ["int", "long"], minimum: 0, description: "nombre d escales, >= 0" },
        airline: {
          bsonType: "object",
          required: ["id", "iata"],
          properties: {
            id: { bsonType: ["int", "long"] },
            iata: { bsonType: "string" },
          },
        },
      },
    },
  },
  // moderate, pas strict : les 66 985 documents importes bruts (routes vers un aeroport
  // fantome, chapitre ii du rapport) ne respectent pas forcement ce schema ajoute apres
  // coup -- strict bloquerait la moindre correction ponctuelle sur ces documents herites.
  validationLevel: "moderate",
  validationAction: "error",
});

printjson(resultat);
print("routes.countDocuments() apres application (doit rester 66985) :", db.routes.countDocuments());
