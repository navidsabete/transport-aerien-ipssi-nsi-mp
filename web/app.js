const API = "http://localhost:8000";

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

    try {

        const data = await appel(
            `/agg/q3-trajet?depart=${encodeURIComponent(from)}&arrivee=${encodeURIComponent(to)}`
        );

        if (!data || !data.trouve) {

            setMessage(
                message,
                `Aucun trajet trouvé entre ${from} et ${to}.`,
                "error"
            );

            return;
        }

        const escales =
            Math.max(0, (data.etapes?.length ?? 1) - 2);

        const chemin =
            data.etapes?.join(" → ") ?? `${from} → ${to}`;

        setMessage(
            message,
            `Trajet trouvé : ${chemin} — ${escales} escale(s).`,
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
