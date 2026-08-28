/* =========================================================
AIR ROUTES — FRONTEND
API REST + CRUD AIRPORTS + Q1/Q2/Q4 + ITINERAIRE + EXPLAIN
========================================================= */

/* =========================================================
CONFIGURATION
========================================================= */

const API_BASE = "http://localhost:8000";

/* =========================================================
SCHEMA AIRPORT
========================================================= */

const AIRPORT_FIELDS = [
    "id",
    "name",
    "city",
    "country",
    "iata",
    "icao",
    "lat",
    "lon",
    "altitude",
    "timezone",
    "dst",
    "tz_db",
    "type",
    "source"
];

/* =========================================================
OUTILS GENERAUX
========================================================= */

async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });


    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        let message = `Erreur HTTP ${response.status}`;

        if (data?.detail) {
            message =
                typeof data.detail === "string"
                    ? data.detail
                    : JSON.stringify(data.detail);
        }

        throw new Error(message);
    }

    return data;


}

/* Alias conservé pour compatibilité */
async function appel(path, options = {}) {
    return apiFetch(path, options);
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }


    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");


}

/* Alias utilisé par Q4 et l'itinéraire */
function sanitizeText(value) {
    return escapeHtml(value);
}

function formatNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }


    const number = Number(value);

    if (Number.isNaN(number)) {
        return escapeHtml(value);
    }

    return new Intl.NumberFormat("fr-FR").format(number);


}

function formatDecimal(value, digits = 4) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }


    const number = Number(value);

    if (Number.isNaN(number)) {
        return "—";
    }

    return number.toFixed(digits);


}

function showMessage(element, text, type = "success") {
    if (!element) {
        return;
    }


    element.textContent = text;
    element.className = `message visible ${type}`;


}

function setMessage(element, text, type = "success") {
    showMessage(element, text, type);
}

function hideMessage(element) {
    if (!element) {
        return;
    }


    element.textContent = "";
    element.className = "message";


}

function setButtonLoading(
    button,
    loading,
    loadingText = "Chargement..."
) {
    if (!button) {
        return;
    }


    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;

        delete button.dataset.originalText;
        button.disabled = false;
    }


}

function numberOrNull(input) {
    if (!input || input.value.trim() === "") {
        return null;
    }


    const value = Number(input.value);

    return Number.isNaN(value) ? null : value;


}

function stringOrNull(input) {
    if (!input || input.value.trim() === "") {
        return null;
    }


    return input.value.trim();


}

/* =========================================================
HEALTH
========================================================= */

const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const kpiHealth = document.getElementById("kpi-health");
const kpiBase = document.getElementById("kpi-base");
const kpiDocuments = document.getElementById("kpi-documents");
const apiDatabase = document.getElementById("api-database");
const healthMessage = document.getElementById("health-message");
const btnHealth = document.getElementById("btn-health");

async function checkHealth() {
    if (!btnHealth) {
        return;
    }


    setButtonLoading(
        btnHealth,
        true,
        "Vérification..."
    );

    hideMessage(healthMessage);

    try {
        const data = await apiFetch("/health");

        statusDot?.classList.remove("offline");
        statusDot?.classList.add("online");

        if (statusLabel) {
            statusLabel.textContent = "API opérationnelle";
        }

        if (kpiHealth) {
            kpiHealth.textContent = "Opérationnel";
        }

        if (kpiBase) {
            kpiBase.textContent = data.base ?? "—";
        }

        if (apiDatabase) {
            apiDatabase.textContent = data.base ?? "—";
        }

        if (kpiDocuments) {
            kpiDocuments.textContent =
                formatNumber(data.documents);
        }

        showMessage(
            healthMessage,
            "Connexion au service API réussie.",
            "success"
        );
    } catch (error) {
        statusDot?.classList.remove("online");
        statusDot?.classList.add("offline");

        if (statusLabel) {
            statusLabel.textContent = "API indisponible";
        }

        if (kpiHealth) {
            kpiHealth.textContent = "Hors ligne";
        }

        if (kpiBase) {
            kpiBase.textContent = "—";
        }

        if (kpiDocuments) {
            kpiDocuments.textContent = "—";
        }

        if (apiDatabase) {
            apiDatabase.textContent = "—";
        }

        showMessage(
            healthMessage,
            error.message,
            "error"
        );
    } finally {
        setButtonLoading(btnHealth, false);
    }


}

btnHealth?.addEventListener("click", checkHealth);

/* =========================================================
CRUD AIRPORTS — ELEMENTS
========================================================= */

const airportFormWrapper =
    document.getElementById("airport-form-wrapper");

const airportForm =
    document.getElementById("airport-form");

const airportFormTitle =
    document.getElementById("airport-form-title");

const airportMessage =
    document.getElementById("airport-message");

const btnNewAirport =
    document.getElementById("btn-new-airport");

const btnCancelAirport =
    document.getElementById("btn-cancel-airport");

const btnCancelAirport2 =
    document.getElementById("btn-cancel-airport-2");

const btnSaveAirport =
    document.getElementById("btn-save-airport");

/* Champs du formulaire */

const airportId =
    document.getElementById("airport-id");

const airportName =
    document.getElementById("airport-name");

const airportCity =
    document.getElementById("airport-city");

const airportCountry =
    document.getElementById("airport-country");

const airportIata =
    document.getElementById("airport-iata");

const airportIcao =
    document.getElementById("airport-icao");

const airportLat =
    document.getElementById("airport-lat");

const airportLon =
    document.getElementById("airport-lon");

const airportAltitude =
    document.getElementById("airport-altitude");

const airportTimezone =
    document.getElementById("airport-timezone");

const airportDst =
    document.getElementById("airport-dst");

const airportTzDb =
    document.getElementById("airport-tz-db");

const airportType =
    document.getElementById("airport-type");

const airportSource =
    document.getElementById("airport-source");

/* Filtres */

const airportFilterCity =
    document.getElementById("airport-filter-city");

const airportFilterCountry =
    document.getElementById("airport-filter-country");

const btnAirportSearch =
    document.getElementById("btn-airport-search");

const airportTable =
    document.getElementById("airport-table");

const airportTableBody =
    document.getElementById("airport-table-body");

const airportEmpty =
    document.getElementById("airport-empty");

const airportPrev =
    document.getElementById("airport-prev");

const airportNext =
    document.getElementById("airport-next");

const airportPageInfo =
    document.getElementById("airport-page-info");

let airportPage = 1;
const airportLimit = 10;
let airportEditingIata = null;

/* =========================================================
FORMULAIRE AIRPORT
========================================================= */

function openAirportForm(airport = null) {
    if (!airportFormWrapper || !airportForm) {
        return;
    }


    airportFormWrapper.hidden = false;
    hideMessage(airportMessage);
    airportForm.reset();

    if (airport) {
        airportEditingIata = airport.iata;

        if (airportFormTitle) {
            airportFormTitle.textContent =
                `Modifier ${airport.iata}`;
        }

        airportIata.value = airport.iata ?? "";
        airportIata.disabled = true;

        airportId.value = airport.id ?? "";
        airportName.value = airport.name ?? "";
        airportCity.value = airport.city ?? "";
        airportCountry.value = airport.country ?? "";
        airportIcao.value = airport.icao ?? "";
        airportLat.value = airport.lat ?? "";
        airportLon.value = airport.lon ?? "";
        airportAltitude.value = airport.altitude ?? "";
        airportTimezone.value = airport.timezone ?? "";
        airportDst.value = airport.dst ?? "";
        airportTzDb.value = airport.tz_db ?? "";
        airportType.value = airport.type ?? "";
        airportSource.value = airport.source ?? "";

        if (btnSaveAirport) {
            btnSaveAirport.textContent =
                "Enregistrer les modifications";
        }
    } else {
        airportEditingIata = null;

        if (airportFormTitle) {
            airportFormTitle.textContent =
                "Nouvel aéroport";
        }

        airportIata.disabled = false;

        if (btnSaveAirport) {
            btnSaveAirport.textContent =
                "Créer l'aéroport";
        }
    }

    airportFormWrapper.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    setTimeout(() => {
        airportIata?.focus();
    }, 100);


}

function closeAirportForm() {
    airportEditingIata = null;


    airportForm?.reset();

    if (airportIata) {
        airportIata.disabled = false;
    }

    if (airportFormTitle) {
        airportFormTitle.textContent =
            "Nouvel aéroport";
    }

    if (btnSaveAirport) {
        btnSaveAirport.textContent =
            "Créer l'aéroport";
    }

    if (airportFormWrapper) {
        airportFormWrapper.hidden = true;
    }

    hideMessage(airportMessage);


}

btnNewAirport?.addEventListener(
    "click",
    () => openAirportForm()
);

btnCancelAirport?.addEventListener(
    "click",
    closeAirportForm
);

btnCancelAirport2?.addEventListener(
    "click",
    closeAirportForm
);

/* =========================================================
CHARGEMENT AIRPORTS
========================================================= */

async function loadAirports() {
    if (
        !airportTableBody ||
        !airportEmpty ||
        !airportTable
    ) {
        return;
    }


    airportTableBody.innerHTML = "";
    airportEmpty.hidden = true;
    airportTable.hidden = false;

    try {
        const params = new URLSearchParams();

        params.set("page", airportPage);
        params.set("limite", airportLimit);

        const city =
            airportFilterCity?.value.trim();

        const country =
            airportFilterCountry?.value.trim();

        if (city) {
            params.set("ville", city);
        }

        if (country) {
            params.set("pays", country);
        }

        const data = await apiFetch(
            `/airports?${params.toString()}`
        );

        const airports = data.resultats || [];

        if (airports.length === 0) {
            airportTable.hidden = true;
            airportEmpty.hidden = false;
            airportEmpty.textContent =
                "Aucun aéroport trouvé.";
        } else {
            renderAirports(airports);
        }

        updateAirportPagination(
            data.total || 0
        );
    } catch (error) {
        airportTable.hidden = true;
        airportEmpty.hidden = false;

        airportEmpty.textContent =
            `Impossible de charger les aéroports : ${error.message}`;

        if (airportPageInfo) {
            airportPageInfo.textContent = "Erreur";
        }
    }


}

/* =========================================================
RENDU AIRPORTS
========================================================= */

function renderAirports(airports) {
    if (!airportTableBody) {
        return;
    }


    airportTableBody.innerHTML =
        airports.map(airport => {
            const iata =
                escapeHtml(airport.iata);

            return `
            <tr>
                <td class="number">
                    ${escapeHtml(airport.id ?? "—")}
                </td>

                <td>
                    <span class="category-code">
                        ${iata}
                    </span>
                </td>

                <td>
                    <strong>
                        ${escapeHtml(airport.name)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(airport.city)}
                </td>

                <td>
                    ${escapeHtml(airport.country)}
                </td>

                <td>
                    <span class="category-code">
                        ${escapeHtml(airport.icao ?? "—")}
                    </span>
                </td>

                <td class="muted">
                    ${formatDecimal(airport.lat)}
                </td>

                <td class="muted">
                    ${formatDecimal(airport.lon)}
                </td>

                <td>
                    ${formatNumber(airport.altitude)}
                </td>

                <td>
                    ${escapeHtml(airport.timezone ?? "—")}
                </td>

                <td>
                    ${escapeHtml(airport.dst ?? "—")}
                </td>

                <td>
                    ${escapeHtml(airport.tz_db ?? "—")}
                </td>

                <td>
                    ${escapeHtml(airport.type ?? "—")}
                </td>

                <td>
                    ${escapeHtml(airport.source ?? "—")}
                </td>

                <td>
                    <div class="table-actions">
                        <button
                            class="btn btn-secondary btn-small"
                            type="button"
                            data-action="edit-airport"
                            data-iata="${iata}"
                        >
                            Modifier
                        </button>

                        <button
                            class="btn btn-small btn-danger"
                            type="button"
                            data-action="delete-airport"
                            data-iata="${iata}"
                        >
                            Supprimer
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join("");


}

/* =========================================================
PAGINATION
========================================================= */

function updateAirportPagination(total) {
    if (!airportPageInfo) {
        return;
    }


    const totalPages = Math.max(
        1,
        Math.ceil(total / airportLimit)
    );

    airportPageInfo.textContent =
        `Page ${airportPage} / ${totalPages} · ` +
        `${formatNumber(total)} aéroport(s)`;

    if (airportPrev) {
        airportPrev.disabled =
            airportPage <= 1;
    }

    if (airportNext) {
        airportNext.disabled =
            airportPage >= totalPages;
    }


}

airportPrev?.addEventListener(
    "click",
    () => {
        if (airportPage > 1) {
            airportPage--;
            loadAirports();
        }
    }
);

airportNext?.addEventListener(
    "click",
    () => {
        airportPage++;
        loadAirports();
    }
);

btnAirportSearch?.addEventListener(
    "click",
    () => {
        airportPage = 1;
        loadAirports();
    }
);

[
    airportFilterCity,
    airportFilterCountry
].forEach(input => {
    input?.addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                event.preventDefault();
                airportPage = 1;
                loadAirports();
            }
        }
    );
});

/* =========================================================
CREATE / UPDATE AIRPORT
========================================================= */

airportForm?.addEventListener(
    "submit",
    async event => {
        event.preventDefault();


        hideMessage(airportMessage);

        const payload = {
            id: numberOrNull(airportId),

            name: airportName.value.trim(),

            city: airportCity.value.trim(),

            country: airportCountry.value.trim(),

            iata: airportIata.value
                .trim()
                .toUpperCase(),

            icao: stringOrNull(airportIcao),

            lat: numberOrNull(airportLat),

            lon: numberOrNull(airportLon),

            altitude: numberOrNull(airportAltitude),

            timezone: stringOrNull(airportTimezone),

            dst: stringOrNull(airportDst),

            tz_db: stringOrNull(airportTzDb),

            type: stringOrNull(airportType),

            source: stringOrNull(airportSource)
        };

        /* Validation IATA */

        if (
            payload.iata.length !== 3 ||
            !/^[A-Z0-9]{3}$/.test(payload.iata)
        ) {
            showMessage(
                airportMessage,
                "Le code IATA doit contenir exactement 3 caractères alphanumériques.",
                "error"
            );
            return;
        }

        /* Validation ICAO */

        if (
            payload.icao &&
            (
                payload.icao.length !== 4 ||
                !/^[A-Z0-9]{4}$/.test(
                    payload.icao
                )
            )
        ) {
            showMessage(
                airportMessage,
                "Le code ICAO doit contenir exactement 4 caractères alphanumériques.",
                "error"
            );
            return;
        }

        /* Validation des champs obligatoires */

        if (!payload.name) {
            showMessage(
                airportMessage,
                "Le nom de l'aéroport est obligatoire.",
                "error"
            );
            return;
        }

        if (!payload.city) {
            showMessage(
                airportMessage,
                "La ville est obligatoire.",
                "error"
            );
            return;
        }

        if (!payload.country) {
            showMessage(
                airportMessage,
                "Le pays est obligatoire.",
                "error"
            );
            return;
        }

        const isEditing =
            Boolean(airportEditingIata);

        setButtonLoading(
            btnSaveAirport,
            true,
            isEditing
                ? "Modification..."
                : "Création..."
        );

        try {
            if (isEditing) {
                /*
                 * UPDATE
                 * PUT /airports/{iata}
                 *
                 * L'IATA d'origine est conservé dans
                 * airportEditingIata car le champ est
                 * désactivé pendant la modification.
                 */

                await apiFetch(
                    `/airports/${encodeURIComponent(
                        airportEditingIata
                    )}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(payload)
                    }
                );
            } else {
                /*
                 * CREATE
                 * POST /airports
                 */

                await apiFetch(
                    "/airports",
                    {
                        method: "POST",
                        body: JSON.stringify(payload)
                    }
                );
            }

            closeAirportForm();

            /*
             * Retour à la première page après
             * une création ou modification.
             */
            airportPage = 1;

            await loadAirports();

            showMessage(
                airportMessage,
                isEditing
                    ? "Aéroport modifié avec succès."
                    : "Aéroport créé avec succès.",
                "success"
            );
        } catch (error) {
            showMessage(
                airportMessage,
                error.message,
                "error"
            );
        } finally {
            setButtonLoading(
                btnSaveAirport,
                false
            );
        }
    }


);

/* =========================================================
MODIFIER / SUPPRIMER
========================================================= */

airportTableBody?.addEventListener(
    "click",
    async event => {
        const button =
            event.target.closest(
                "button[data-action]"
            );


        if (!button) {
            return;
        }

        const action =
            button.dataset.action;

        const iata =
            button.dataset.iata;

        if (!iata) {
            return;
        }

        if (action === "edit-airport") {
            await editAirport(iata);
        }

        if (action === "delete-airport") {
            await deleteAirport(iata);
        }
    }


);

/* =========================================================
DETAIL / MODIFICATION AIRPORT
========================================================= */

async function editAirport(iata) {
    try {
        const airport =
            await apiFetch(
                `/airports/${encodeURIComponent(iata)}`
            );


        openAirportForm(airport);
    } catch (error) {
        showMessage(
            airportMessage,
            error.message,
            "error"
        );
    }


}

/* =========================================================
DELETE AIRPORT
========================================================= */

async function deleteAirport(iata) {
    const confirmation = window.confirm(
        `Voulez-vous vraiment supprimer l'aéroport ${iata} ?\n\n` +
        "Cette opération est définitive."
    );


    if (!confirmation) {
        return;
    }

    try {
        await apiFetch(
            `/airports/${encodeURIComponent(iata)}`,
            {
                method: "DELETE"
            }
        );

        showMessage(
            airportMessage,
            `L'aéroport ${iata} a été supprimé.`,
            "success"
        );

        /*
         * Si le dernier élément de la page vient
         * d'être supprimé, on revient à la page précédente.
         */
        if (
            airportTableBody &&
            airportTableBody.children.length === 1 &&
            airportPage > 1
        ) {
            airportPage--;
        }

        await loadAirports();
    } catch (error) {
        showMessage(
            airportMessage,
            error.message,
            "error"
        );
    }


}

/* =========================================================
Q1 — AEROPORTS AVEC LE PLUS DE DESTINATIONS
========================================================= */

const btnQ1 =
    document.getElementById("btn-q1");

const tableQ1 =
    document.getElementById("table-q1");

const q1Empty =
    document.getElementById("q1-empty");

async function loadQ1() {
    if (
        !btnQ1 ||
        !tableQ1 ||
        !q1Empty
    ) {
        return;
    }


    setButtonLoading(
        btnQ1,
        true,
        "Analyse..."
    );

    try {
        const data =
            await apiFetch("/agg/q1");

        const rows =
            Array.isArray(data)
                ? data
                : [];

        const tbody =
            tableQ1.querySelector("tbody");

        if (!tbody) {
            return;
        }

        tbody.innerHTML =
            rows.map(
                (row, index) => `
                <tr>
                    <td>
                        <span class="rank">
                            ${index + 1}
                        </span>
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(row.iata)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(row.nom)}
                    </td>

                    <td>
                        ${escapeHtml(row.ville)}
                    </td>

                    <td>
                        ${escapeHtml(row.pays)}
                    </td>

                    <td class="number">
                        ${formatNumber(
                    row.nombre_destinations
                )}
                    </td>
                </tr>
            `
            ).join("");

        tableQ1.hidden =
            rows.length === 0;

        q1Empty.hidden =
            rows.length > 0;

        if (rows.length === 0) {
            q1Empty.textContent =
                "Aucun résultat retourné par l'API.";
        }
    } catch (error) {
        tableQ1.hidden = true;
        q1Empty.hidden = false;

        q1Empty.textContent =
            `Erreur Q1 : ${error.message}`;
    } finally {
        setButtonLoading(
            btnQ1,
            false
        );
    }


}

btnQ1?.addEventListener(
    "click",
    loadQ1
);

/* =========================================================
Q2 — AEROPORTS / DESTINATIONS
========================================================= */

const btnQ2 =
    document.getElementById("btn-q2");

const tableQ2 =
    document.getElementById("table-q2");

const q2Empty =
    document.getElementById("q2-empty");

async function loadQ2() {
    if (
        !btnQ2 ||
        !tableQ2 ||
        !q2Empty
    ) {
        return;
    }


    setButtonLoading(
        btnQ2,
        true,
        "Analyse..."
    );

    try {
        const data =
            await apiFetch("/agg/q2");

        const rows =
            Array.isArray(data)
                ? data
                : [];

        const tbody =
            tableQ2.querySelector("tbody");

        if (!tbody) {
            return;
        }

        tbody.innerHTML =
            rows.map(
                (row, index) => `
                <tr>
                    <td>
                        <span class="rank">
                            ${index + 1}
                        </span>
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(row.nom)}
                        </strong>
                    </td>

                    <td>
                        <span class="category-code">
                            ${escapeHtml(
                    row.iata ?? "—"
                )}
                        </span>
                    </td>

                    <td>
                        <span class="category-code">
                            ${escapeHtml(
                    row.icao ?? "—"
                )}
                        </span>
                    </td>

                    <td>
                        ${escapeHtml(row.pays)}
                    </td>

                    <td class="number">
                        ${formatNumber(
                    row.nombre_destinations
                )}
                    </td>
                </tr>
            `
            ).join("");

        tableQ2.hidden =
            rows.length === 0;

        q2Empty.hidden =
            rows.length > 0;

        if (rows.length === 0) {
            q2Empty.textContent =
                "Aucun résultat retourné par l'API.";
        }
    } catch (error) {
        tableQ2.hidden = true;
        q2Empty.hidden = false;

        q2Empty.textContent =
            `Erreur Q2 : ${error.message}`;
    } finally {
        setButtonLoading(
            btnQ2,
            false
        );
    }


}

btnQ2?.addEventListener(
    "click",
    loadQ2
);

/* =========================================================
Q4 — DESTINATIONS LES PLUS LOINTAINES
========================================================= */

let carteQ4 = null;
let coucheQ4 = null;

function obtenirCarteQ4() {
    const mapElement =
        document.getElementById("q4-map");


    if (
        !mapElement ||
        typeof L === "undefined"
    ) {
        return null;
    }

    if (carteQ4) {
        return carteQ4;
    }

    carteQ4 =
        L.map("q4-map");

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                "&copy; OpenStreetMap contributors",
            maxZoom: 18
        }
    ).addTo(carteQ4);

    coucheQ4 =
        L.layerGroup()
            .addTo(carteQ4);

    return carteQ4;


}

function afficherCarteQ4(
    origine,
    destinations
) {
    const carte =
        obtenirCarteQ4();


    if (
        !carte ||
        !coucheQ4
    ) {
        return;
    }

    if (
        typeof origine.lat !== "number" ||
        typeof origine.lon !== "number"
    ) {
        return;
    }

    coucheQ4.clearLayers();

    const points = [
        [
            origine.lat,
            origine.lon
        ]
    ];

    /* Aéroport origine */

    L.circleMarker(
        [
            origine.lat,
            origine.lon
        ],
        {
            radius: 8,
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 1
        }
    )
        .bindPopup(
            `<strong>${sanitizeText(
                origine.name
            )}</strong><br>` +
            `${sanitizeText(
                origine.iata
            )} — origine`
        )
        .addTo(coucheQ4);

    /* Destinations */

    destinations.forEach(dest => {
        if (
            typeof dest.lat !== "number" ||
            typeof dest.lon !== "number"
        ) {
            return;
        }

        points.push([
            dest.lat,
            dest.lon
        ]);

        /* Ligne origine → destination */

        L.polyline(
            [
                [
                    origine.lat,
                    origine.lon
                ],
                [
                    dest.lat,
                    dest.lon
                ]
            ],
            {
                color: "#2563eb",
                weight: 1.5,
                opacity: 0.45
            }
        ).addTo(coucheQ4);

        /* Destination */

        L.circleMarker(
            [
                dest.lat,
                dest.lon
            ],
            {
                radius: 6,
                color: "#0f9f6e",
                fillColor: "#0f9f6e",
                fillOpacity: 0.9
            }
        )
            .bindPopup(
                `<strong>${sanitizeText(
                    dest.name
                )}</strong><br>` +
                `${sanitizeText(
                    dest.iata
                )} — ` +
                `${formatNumber(
                    dest.distance_km
                )} km`
            )
            .addTo(coucheQ4);
    });

    if (points.length > 1) {
        carte.fitBounds(
            points,
            {
                padding: [
                    24,
                    24
                ]
            }
        );
    } else {
        carte.setView(
            points[0],
            4
        );
    }

    setTimeout(
        () => carte.invalidateSize(),
        0
    );


}

async function chargerQ4() {
    const button =
        document.getElementById("btn-q4");


    const input =
        document.getElementById("q4-airport");

    const table =
        document.getElementById("table-q4");

    const empty =
        document.getElementById("q4-empty");

    if (
        !button ||
        !input ||
        !table ||
        !empty
    ) {
        return;
    }

    const corps =
        table.querySelector("tbody");

    if (!corps) {
        return;
    }

    const origine =
        input.value
            .trim()
            .toUpperCase();

    input.value = origine;

    if (
        origine.length !== 3 ||
        !/^[A-Z0-9]{3}$/.test(
            origine
        )
    ) {
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
            await apiFetch(
                `/agg/destinations-lointaines?` +
                `origine=${encodeURIComponent(
                    origine
                )}&limite=10`
            );

        const lignes =
            data.resultats ?? [];

        if (!lignes.length) {
            empty.textContent =
                "Aucune donnée disponible.";

            return;
        }

        if (data.origine_detail) {
            afficherCarteQ4(
                data.origine_detail,
                lignes
            );
        }

        corps.innerHTML =
            lignes.map(
                (ligne, index) => `
                <tr>
                    <td>
                        <span class="rank">
                            ${index + 1}
                        </span>
                    </td>

                    <td>
                        <strong>
                            ${sanitizeText(
                    ligne.name
                )}
                        </strong>
                        <br>

                        <span class="muted">
                            ${sanitizeText(
                    ligne.iata
                )}
                        </span>
                    </td>

                    <td>
                        ${sanitizeText(
                    ligne.city
                )}
                    </td>

                    <td>
                        ${sanitizeText(
                    ligne.country
                )}
                    </td>

                    <td class="number">
                        ${formatNumber(
                    ligne.distance_km
                )} km
                    </td>
                </tr>
            `
            ).join("");

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

document
    .getElementById("btn-q4")
    ?.addEventListener(
        "click",
        chargerQ4
    );

/* =========================================================
ITINERAIRE
========================================================= */

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

        const data = await apiFetch(
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

/* =========================================================
EXPLAIN
========================================================= */

const btnExplain =
    document.getElementById("btn-explain");

const explain =
    document.getElementById("explain");

const explainPlaceholder =
    document.getElementById(
        "explain-placeholder"
    );

let explainVisible = false;

btnExplain?.addEventListener(
    "click",
    async () => {
        /*
        * Si explain est déjà affiché,
        * on le masque.
        */


        if (
            explainVisible &&
            explain &&
            explainPlaceholder
        ) {
            explain.hidden = true;
            explainPlaceholder.hidden = false;

            btnExplain.textContent =
                "Afficher explain()";

            explainVisible = false;

            return;
        }

        setButtonLoading(
            btnExplain,
            true,
            "Chargement..."
        );

        try {
            const data =
                await apiFetch(
                    "/agg/explain"
                );

            if (explain) {
                explain.textContent =
                    JSON.stringify(
                        data,
                        null,
                        2
                    );

                explain.hidden = false;
            }

            if (explainPlaceholder) {
                explainPlaceholder.hidden = true;
            }

            btnExplain.textContent =
                "Masquer explain()";

            explainVisible = true;
        } catch (error) {
            if (explainPlaceholder) {
                explainPlaceholder.textContent =
                    `Impossible de charger explain() : ${error.message}`;

                explainPlaceholder.hidden = false;
            }
        } finally {
            setButtonLoading(
                btnExplain,
                false
            );
        }
    }


);

/* =========================================================
NORMALISATION IATA / ICAO
========================================================= */

[
    airportIata,
    airportIcao
].forEach(input => {
    input?.addEventListener(
        "input",
        () => {
            input.value =
                input.value.toUpperCase();
        }
    );
});

/* =========================================================
INITIALISATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        await checkHealth();
        await loadAirports();
    }
);
