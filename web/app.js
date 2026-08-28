const API = "http://localhost:8000";

// Carte Leaflet de Q4 -- creee une seule fois, reutilisee a chaque actualisation
// (bonus "index geospatial 2dsphere reellement exploite par le front", cf. rapport).
let carteQ4 = null;
let coucheQ4 = null;

function obtenirCarteQ4() {
    if (carteQ4) {
        return carteQ4;
    }

    carteQ4 = L.map("q4-map");

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
    }).addTo(carteQ4);

    coucheQ4 = L.layerGroup().addTo(carteQ4);

    return carteQ4;
}

function afficherCarteQ4(origine, destinations) {
    const carte = obtenirCarteQ4();

    coucheQ4.clearLayers();

    const points = [[origine.lat, origine.lon]];

    L.circleMarker([origine.lat, origine.lon], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 1,
    })
        .bindPopup(`<strong>${sanitizeText(origine.name)}</strong><br>${sanitizeText(origine.iata)} — origine`)
        .addTo(coucheQ4);

    destinations.forEach(dest => {
        if (typeof dest.lat !== "number" || typeof dest.lon !== "number") {
            return;
        }

        points.push([dest.lat, dest.lon]);

        L.polyline([[origine.lat, origine.lon], [dest.lat, dest.lon]], {
            color: "#2563eb",
            weight: 1.5,
            opacity: 0.45,
        }).addTo(coucheQ4);

        L.circleMarker([dest.lat, dest.lon], {
            radius: 6,
            color: "#0f9f6e",
            fillColor: "#0f9f6e",
            fillOpacity: 0.9,
        })
            .bindPopup(
                `<strong>${sanitizeText(dest.name)}</strong><br>${sanitizeText(dest.iata)} — ${formatNumber(dest.distance_km)} km`
            )
            .addTo(coucheQ4);
    });

    if (points.length > 1) {
        carte.fitBounds(points, { padding: [24, 24] });
    } else {
        carte.setView(points[0], 4);
    }

    // Leaflet a besoin d'un recalcul de taille si le conteneur etait masque au chargement.
    setTimeout(() => carte.invalidateSize(), 0);
}

async function appel(chemin) {
    const response = await fetch(API + chemin);


    if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;

        try {
            const data = await response.json();

            if (data.detail) {
                detail = data.detail;
            }
        } catch (_) {
            // Réponse non JSON : on conserve le message HTTP.
        }

        throw new Error(detail);
    }

    return response.json();


}

function setStatus(online, label) {
    const dot = document.getElementById("status-dot");
    const statusLabel = document.getElementById("status-label");


    dot.classList.remove("online", "offline");

    if (online) {
        dot.classList.add("online");
    } else {
        dot.classList.add("offline");
    }

    statusLabel.textContent = label;


}

function setMessage(element, text, type) {
    element.textContent = text;
    element.className = `message visible ${type}`;
}

function formatNumber(value) {
    if (typeof value !== "number") {
        return value ?? "—";
    }


    return new Intl.NumberFormat("fr-FR").format(value);


}

function sanitizeText(value) {
    if (value === null || value === undefined) {
        return "—";
    }


    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");


}

/* ---------------------------------------------------------------
HEALTH
---------------------------------------------------------------- */

async function verifierHealth() {
    const healthMessage =
        document.getElementById("health-message");


    const button =
        document.getElementById("btn-health");

    button.disabled = true;
    button.textContent = "Vérification…";

    try {
        const data = await appel("/health");

        setStatus(true, "API connectée");

        document.getElementById("kpi-base").textContent =
            data.base ?? "MongoDB";

        document.getElementById("kpi-documents").textContent =
            formatNumber(data.documents);

        document.getElementById("kpi-health").textContent =
            "Opérationnelle";

        document.getElementById("api-database").textContent =
            data.base ?? "MongoDB";

        setMessage(
            healthMessage,
            `Connexion réussie — ${formatNumber(
                data.documents ?? 0
            )} routes disponibles.`,
            "success"
        );

    } catch (error) {

        setStatus(false, "API indisponible");

        document.getElementById("kpi-health").textContent =
            "Indisponible";

        setMessage(
            healthMessage,
            `Impossible de contacter l'API : ${error.message}`,
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Vérifier la connexion";
    }


}

/* ---------------------------------------------------------------
Q1 — TOP 10 AÉROPORTS
---------------------------------------------------------------- */

async function chargerQ1() {


    const button =
        document.getElementById("btn-q1");

    const table =
        document.getElementById("table-q1");

    const empty =
        document.getElementById("q1-empty");

    const corps =
        table.querySelector("tbody");

    button.disabled = true;
    button.textContent = "Chargement…";

    table.hidden = true;
    empty.hidden = false;

    empty.textContent =
        "Analyse des aéroports en cours…";

    try {

        const lignes =
            await appel("/agg/q1");

        if (!Array.isArray(lignes) || !lignes.length) {

            empty.textContent =
                "Aucune donnée disponible.";

            return;
        }

        corps.innerHTML = lignes
            .map((ligne, index) => `
            <tr>

                <td>
                    <span class="rank">
                        ${index + 1}
                    </span>
                </td>

                <td>
                    <strong>
                        ${sanitizeText(ligne.nom)}
                    </strong>
                    <br>
                    <span class="muted">
                        ${sanitizeText(ligne.iata)}
                    </span>
                </td>

                <td>
                    ${sanitizeText(ligne.ville)}
                </td>

                <td>
                    ${sanitizeText(ligne.pays)}
                </td>

                <td class="number">
                    ${formatNumber(ligne.nombre_destinations)}
                </td>

            </tr>
        `)
            .join("");

        table.hidden = false;
        empty.hidden = true;

    } catch (error) {

        empty.hidden = false;

        empty.textContent =
            `Erreur lors du chargement : ${error.message}`;

    } finally {

        button.disabled = false;
        button.textContent = "↻ Actualiser";
    }


}

/* ---------------------------------------------------------------
Q2 — TOP 10 COMPAGNIES ACTIVES
---------------------------------------------------------------- */

async function chargerQ2() {


    const button =
        document.getElementById("btn-q2");

    const table =
        document.getElementById("table-q2");

    const empty =
        document.getElementById("q2-empty");

    const corps =
        table.querySelector("tbody");

    button.disabled = true;
    button.textContent = "Chargement…";

    table.hidden = true;
    empty.hidden = false;

    empty.textContent =
        "Analyse des compagnies en cours…";

    try {

        const lignes =
            await appel("/agg/q2");

        if (!Array.isArray(lignes) || !lignes.length) {

            empty.textContent =
                "Aucune donnée disponible.";

            return;
        }

        corps.innerHTML = lignes
            .map((ligne, index) => `
            <tr>

                <td>
                    <span class="rank">
                        ${index + 1}
                    </span>
                </td>

                <td>
                    <strong>
                        ${sanitizeText(ligne.nom)}
                    </strong>
                </td>

                <td>
                    <span class="category-code">
                        ${sanitizeText(ligne.iata)}
                    </span>
                </td>

                <td>
                    ${sanitizeText(ligne.pays)}
                </td>

                <td class="number">
                    ${formatNumber(ligne.nombre_destinations)}
                </td>

            </tr>
        `)
            .join("");

        table.hidden = false;
        empty.hidden = true;

    } catch (error) {

        empty.hidden = false;

        empty.textContent =
            `Erreur lors du chargement : ${error.message}`;

    } finally {

        button.disabled = false;
        button.textContent = "↻ Actualiser";
    }


}

/* ---------------------------------------------------------------
EXPLAIN
---------------------------------------------------------------- */

async function afficherExplain() {


    const button =
        document.getElementById("btn-explain");

    const placeholder =
        document.getElementById("explain-placeholder");

    const bloc =
        document.getElementById("explain");

    button.disabled = true;
    button.textContent = "Chargement…";

    try {

        const data =
            await appel("/agg/explain");

        bloc.textContent =
            JSON.stringify(data, null, 2);

        placeholder.hidden = true;
        bloc.hidden = false;

    } catch (error) {

        placeholder.hidden = false;

        placeholder.textContent =
            `Erreur : ${error.message}`;

        bloc.hidden = true;

    } finally {

        button.disabled = false;
        button.textContent =
            "Afficher explain()";
    }


}

/* ---------------------------------------------------------------
Q3 — RECHERCHE D'UN TRAJET
---------------------------------------------------------------- */

async function rechercherTrajet() {


    const fromInput =
        document.getElementById("from");

    const toInput =
        document.getElementById("to");

    const message =
        document.getElementById("route-message");

    const from =
        fromInput.value.trim().toUpperCase();

    const to =
        toInput.value.trim().toUpperCase();

    fromInput.value = from;
    toInput.value = to;

    if (!from || !to) {

        setMessage(
            message,
            "Veuillez renseigner un aéroport de départ et une destination.",
            "error"
        );

        return;
    }

    if (from.length !== 3 || to.length !== 3) {

        setMessage(
            message,
            "Les codes IATA doivent comporter exactement 3 caractères.",
            "error"
        );

        return;
    }

    if (from === to) {

        setMessage(
            message,
            "Le départ et la destination doivent être différents.",
            "error"
        );

        return;
    }

    const result =
        document.getElementById("route-result");

    const stopsLabel =
        document.getElementById("route-stops");

    const pathContainer =
        document.getElementById("route-path");

    result.hidden = true;
    message.textContent = "";
    message.className = "message";

    try {

        const data = await appel(
            `/agg/itineraire?depart=${encodeURIComponent(from)}&arrivee=${encodeURIComponent(to)}`
        );

        const vols = data.vols ?? [];

        if (!vols.length) {

            setMessage(
                message,
                `Aucun trajet trouvé entre ${from} et ${to}.`,
                "error"
            );

            return;
        }

        stopsLabel.textContent =
            data.escales === 0
                ? "Vol direct"
                : `${data.escales} escale${data.escales > 1 ? "s" : ""}`;

        const aeroports =
            [vols[0].de, ...vols.map(vol => vol.vers)];

        pathContainer.innerHTML = aeroports
            .map((code, index) => {
                const chip = `<span class="route-airport">${sanitizeText(code)}</span>`;

                if (index === aeroports.length - 1) {
                    return chip;
                }

                return `${chip}<span class="route-arrow">→</span>`;
            })
            .join("");

        const details = vols
            .map(vol => `${sanitizeText(vol.de)} → ${sanitizeText(vol.vers)} — ${sanitizeText(vol.compagnie)} (${sanitizeText(vol.compagnie_iata)})`)
            .join("<br>");

        pathContainer.insertAdjacentHTML(
            "beforeend",
            `<div class="muted route-legs">${details}</div>`
        );

        result.hidden = false;

        setMessage(
            message,
            `Trajet trouvé entre ${from} et ${to}.`,
            "success"
        );

    } catch (error) {

        setMessage(
            message,
            `Erreur lors de la recherche : ${error.message}`,
            "error"
        );
    }


}

/* ---------------------------------------------------------------
Q4 — DESTINATIONS LES PLUS LOINTAINES
---------------------------------------------------------------- */

async function chargerQ4() {


    const button =
        document.getElementById("btn-q4");

    const input =
        document.getElementById("q4-airport");

    const table =
        document.getElementById("table-q4");

    const empty =
        document.getElementById("q4-empty");

    const corps =
        table.querySelector("tbody");

    const origine =
        input.value.trim().toUpperCase();

    input.value = origine;

    if (origine.length !== 3) {

        empty.hidden = false;
        table.hidden = true;

        empty.textContent =
            "Le code IATA de l'aéroport de référence doit comporter 3 caractères.";

        return;
    }

    button.disabled = true;
    button.textContent = "Chargement…";

    table.hidden = true;
    empty.hidden = false;

    empty.textContent =
        "Calcul des distances en cours…";

    try {

        const data =
            await appel(`/agg/destinations-lointaines?origine=${encodeURIComponent(origine)}&limite=10`);

        const lignes =
            data.resultats ?? [];

        if (!lignes.length) {

            empty.textContent =
                "Aucune donnée disponible.";

            return;
        }

        if (data.origine_detail) {
            afficherCarteQ4(data.origine_detail, lignes);
        }

        corps.innerHTML = lignes
            .map((ligne, index) => `
            <tr>

                <td>
                    <span class="rank">
                        ${index + 1}
                    </span>
                </td>

                <td>
                    <strong>
                        ${sanitizeText(ligne.name)}
                    </strong>
                    <br>
                    <span class="muted">
                        ${sanitizeText(ligne.iata)}
                    </span>
                </td>

                <td>
                    ${sanitizeText(ligne.city)}
                </td>

                <td>
                    ${sanitizeText(ligne.country)}
                </td>

                <td class="number">
                    ${formatNumber(ligne.distance_km)} km
                </td>

            </tr>
        `)
            .join("");

        table.hidden = false;
        empty.hidden = true;

    } catch (error) {

        empty.hidden = false;

        empty.textContent =
            `Erreur lors du chargement : ${error.message}`;

    } finally {

        button.disabled = false;
        button.textContent = "↻ Actualiser";
    }


}

/* ---------------------------------------------------------------
ÉVÉNEMENTS
---------------------------------------------------------------- */

document
    .getElementById("btn-health")
    .addEventListener("click", verifierHealth);

document
    .getElementById("btn-q1")
    .addEventListener("click", chargerQ1);

document
    .getElementById("btn-q2")
    .addEventListener("click", chargerQ2);

document
    .getElementById("btn-explain")
    .addEventListener("click", afficherExplain);

document
    .getElementById("btn-route")
    .addEventListener("click", rechercherTrajet);

document
    .getElementById("btn-q4")
    .addEventListener("click", chargerQ4);

document
    .getElementById("from")
    .addEventListener("input", event => {


        event.target.value =
            event.target.value
                .replace(/[^a-zA-Z]/g, "")
                .toUpperCase();
    });


document
    .getElementById("to")
    .addEventListener("input", event => {


        event.target.value =
            event.target.value
                .replace(/[^a-zA-Z]/g, "")
                .toUpperCase();
    });


document
    .getElementById("from")
    .addEventListener("keydown", event => {


        if (event.key === "Enter") {
            rechercherTrajet();
        }
    });


document
    .getElementById("to")
    .addEventListener("keydown", event => {


        if (event.key === "Enter") {
            rechercherTrajet();
        }
    });


/*

* Vérification automatique au chargement.
  */
verifierHealth();
