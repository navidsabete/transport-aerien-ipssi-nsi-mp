/* =========================================================
   AIR ROUTES — FRONTEND
   API REST + CRUD AIRPORTS + Q1/Q2 + EXPLAIN
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE = "http://localhost:8000";


/* =========================================================
   SCHEMA AIRPORT
   =========================================================

   Les propriétés utilisées partout dans le frontend sont :

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

    const response = await fetch(
        `${API_BASE}${path}`,
        {
            ...options,

            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );


    let data = null;


    try {
        data = await response.json();
    } catch {
        data = null;
    }


    if (!response.ok) {

        let message =
            `Erreur HTTP ${response.status}`;


        if (data?.detail) {

            if (
                typeof data.detail === "string"
            ) {
                message = data.detail;
            } else {
                message =
                    JSON.stringify(
                        data.detail
                    );
            }
        }


        throw new Error(message);
    }


    return data;
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }


    const number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {
        return escapeHtml(value);
    }


    return new Intl.NumberFormat(
        "fr-FR"
    ).format(number);
}


function formatDecimal(value, digits = 4) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }


    const number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {
        return "—";
    }


    return number.toFixed(digits);
}


function showMessage(
    element,
    text,
    type = "success"
) {

    element.textContent = text;

    element.className =
        `message visible ${type}`;
}


function hideMessage(element) {

    element.textContent = "";

    element.className =
        "message";
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

        button.dataset.originalText =
            button.textContent;

        button.textContent =
            loadingText;

        button.disabled = true;

    } else {

        button.textContent =
            button.dataset.originalText ||
            button.textContent;

        button.disabled = false;
    }
}


/* =========================================================
   HEALTH
   ========================================================= */

const statusDot =
    document.getElementById(
        "status-dot"
    );

const statusLabel =
    document.getElementById(
        "status-label"
    );

const kpiHealth =
    document.getElementById(
        "kpi-health"
    );

const kpiBase =
    document.getElementById(
        "kpi-base"
    );

const kpiDocuments =
    document.getElementById(
        "kpi-documents"
    );

const apiDatabase =
    document.getElementById(
        "api-database"
    );

const healthMessage =
    document.getElementById(
        "health-message"
    );

const btnHealth =
    document.getElementById(
        "btn-health"
    );


async function checkHealth() {

    setButtonLoading(
        btnHealth,
        true,
        "Vérification..."
    );

    hideMessage(
        healthMessage
    );


    try {

        const data =
            await apiFetch(
                "/health"
            );


        statusDot.classList.remove(
            "offline"
        );

        statusDot.classList.add(
            "online"
        );


        statusLabel.textContent =
            "API opérationnelle";


        kpiHealth.textContent =
            "Opérationnel";


        kpiBase.textContent =
            data.base ??
            "—";


        apiDatabase.textContent =
            data.base ??
            "—";


        kpiDocuments.textContent =
            formatNumber(
                data.documents
            );


        showMessage(
            healthMessage,
            "Connexion au service API réussie.",
            "success"
        );

    } catch (error) {

        statusDot.classList.remove(
            "online"
        );

        statusDot.classList.add(
            "offline"
        );


        statusLabel.textContent =
            "API indisponible";


        kpiHealth.textContent =
            "Hors ligne";


        kpiBase.textContent =
            "—";


        kpiDocuments.textContent =
            "—";


        showMessage(
            healthMessage,
            error.message,
            "error"
        );

    } finally {

        setButtonLoading(
            btnHealth,
            false
        );
    }
}


btnHealth.addEventListener(
    "click",
    checkHealth
);


/* =========================================================
   CRUD AIRPORTS
   ========================================================= */

const airportFormWrapper =
    document.getElementById(
        "airport-form-wrapper"
    );

const airportForm =
    document.getElementById(
        "airport-form"
    );

const airportFormTitle =
    document.getElementById(
        "airport-form-title"
    );

const airportMessage =
    document.getElementById(
        "airport-message"
    );

const btnNewAirport =
    document.getElementById(
        "btn-new-airport"
    );

const btnCancelAirport =
    document.getElementById(
        "btn-cancel-airport"
    );

const btnCancelAirport2 =
    document.getElementById(
        "btn-cancel-airport-2"
    );

const btnSaveAirport =
    document.getElementById(
        "btn-save-airport"
    );


/*
 * Chaque variable frontend correspond
 * exactement à une propriété du modèle Airport.
 */

const airportId =
    document.getElementById(
        "airport-id"
    );

const airportName =
    document.getElementById(
        "airport-name"
    );

const airportCity =
    document.getElementById(
        "airport-city"
    );

const airportCountry =
    document.getElementById(
        "airport-country"
    );

const airportIata =
    document.getElementById(
        "airport-iata"
    );

const airportIcao =
    document.getElementById(
        "airport-icao"
    );

const airportLat =
    document.getElementById(
        "airport-lat"
    );

const airportLon =
    document.getElementById(
        "airport-lon"
    );

const airportAltitude =
    document.getElementById(
        "airport-altitude"
    );

const airportTimezone =
    document.getElementById(
        "airport-timezone"
    );

const airportDst =
    document.getElementById(
        "airport-dst"
    );

const airportTzDb =
    document.getElementById(
        "airport-tz-db"
    );

const airportType =
    document.getElementById(
        "airport-type"
    );

const airportSource =
    document.getElementById(
        "airport-source"
    );


const airportFilterCity =
    document.getElementById(
        "airport-filter-city"
    );

const airportFilterCountry =
    document.getElementById(
        "airport-filter-country"
    );

const btnAirportSearch =
    document.getElementById(
        "btn-airport-search"
    );

const airportTable =
    document.getElementById(
        "airport-table"
    );

const airportTableBody =
    document.getElementById(
        "airport-table-body"
    );

const airportEmpty =
    document.getElementById(
        "airport-empty"
    );

const airportPrev =
    document.getElementById(
        "airport-prev"
    );

const airportNext =
    document.getElementById(
        "airport-next"
    );

const airportPageInfo =
    document.getElementById(
        "airport-page-info"
    );


let airportPage = 1;

const airportLimit = 10;

let airportEditingIata = null;


/* =========================================================
   FORMULAIRE
   ========================================================= */

function openAirportForm(
    airport = null
) {

    airportFormWrapper.hidden =
        false;

    hideMessage(
        airportMessage
    );

    airportForm.reset();


    if (airport) {

        airportEditingIata =
            airport.iata;


        airportFormTitle.textContent =
            `Modifier ${airport.iata}`;


        /*
         * IATA est l'identifiant métier utilisé
         * par les routes PUT/DELETE.
         */

        airportIata.value =
            airport.iata ?? "";

        airportIata.disabled =
            true;


        airportId.value =
            airport.id ?? "";

        airportName.value =
            airport.name ?? "";

        airportCity.value =
            airport.city ?? "";

        airportCountry.value =
            airport.country ?? "";

        airportIcao.value =
            airport.icao ?? "";

        airportLat.value =
            airport.lat ?? "";

        airportLon.value =
            airport.lon ?? "";

        airportAltitude.value =
            airport.altitude ?? "";

        airportTimezone.value =
            airport.timezone ?? "";

        airportDst.value =
            airport.dst ?? "";

        airportTzDb.value =
            airport.tz_db ?? "";

        airportType.value =
            airport.type ?? "";

        airportSource.value =
            airport.source ?? "";


        btnSaveAirport.textContent =
            "Enregistrer les modifications";

    } else {

        airportEditingIata =
            null;

        airportFormTitle.textContent =
            "Nouvel aéroport";

        airportIata.disabled =
            false;

        btnSaveAirport.textContent =
            "Créer l'aéroport";
    }


    airportFormWrapper.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });


    setTimeout(
        () => airportIata.focus(),
        100
    );
}


function closeAirportForm() {

    airportEditingIata =
        null;

    airportForm.reset();

    airportIata.disabled =
        false;

    airportFormTitle.textContent =
        "Nouvel aéroport";

    btnSaveAirport.textContent =
        "Créer l'aéroport";

    airportFormWrapper.hidden =
        true;

    hideMessage(
        airportMessage
    );
}


btnNewAirport.addEventListener(
    "click",
    () => openAirportForm()
);

btnCancelAirport.addEventListener(
    "click",
    closeAirportForm
);

btnCancelAirport2.addEventListener(
    "click",
    closeAirportForm
);


/* =========================================================
   CONVERSION DES VALEURS
   ========================================================= */

function numberOrNull(input) {

    if (
        !input ||
        input.value.trim() === ""
    ) {
        return null;
    }


    const value =
        Number(input.value);


    return Number.isNaN(value)
        ? null
        : value;
}


function stringOrNull(input) {

    if (
        !input ||
        input.value.trim() === ""
    ) {
        return null;
    }


    return input.value.trim();
}


/* =========================================================
   CHARGEMENT AIRPORTS
   ========================================================= */

async function loadAirports() {

    airportTableBody.innerHTML =
        "";

    airportEmpty.hidden =
        true;

    airportTable.hidden =
        false;


    try {

        const params =
            new URLSearchParams();


        params.set(
            "page",
            airportPage
        );

        params.set(
            "limite",
            airportLimit
        );


        const city =
            airportFilterCity.value.trim();

        const country =
            airportFilterCountry.value.trim();


        if (city) {

            params.set(
                "ville",
                city
            );
        }


        if (country) {

            params.set(
                "pays",
                country
            );
        }


        const data =
            await apiFetch(
                `/airports?${params.toString()}`
            );


        const airports =
            data.resultats || [];


        if (
            airports.length === 0
        ) {

            airportTable.hidden =
                true;

            airportEmpty.hidden =
                false;

        } else {

            renderAirports(
                airports
            );
        }


        updateAirportPagination(
            data.total || 0
        );

    } catch (error) {

        airportTable.hidden =
            true;

        airportEmpty.hidden =
            false;

        airportEmpty.textContent =
            `Impossible de charger les aéroports : ${error.message}`;

        airportPageInfo.textContent =
            "Erreur";
    }
}


/* =========================================================
   RENDU AIRPORTS
   ========================================================= */

function renderAirports(
    airports
) {

    airportTableBody.innerHTML =
        airports.map(
            airport => {

                const iata =
                    escapeHtml(
                        airport.iata
                    );


                return `
                    <tr>

                        <td class="number">
                            ${escapeHtml(
                                airport.id ?? "—"
                            )}
                        </td>

                        <td>
                            <span class="category-code">
                                ${iata}
                            </span>
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    airport.name
                                )}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(
                                airport.city
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                airport.country
                            )}
                        </td>

                        <td>
                            <span class="category-code">
                                ${escapeHtml(
                                    airport.icao ?? "—"
                                )}
                            </span>
                        </td>

                        <td class="muted">
                            ${formatDecimal(
                                airport.lat
                            )}
                        </td>

                        <td class="muted">
                            ${formatDecimal(
                                airport.lon
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                airport.altitude
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                airport.timezone ?? "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                airport.dst ?? "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                airport.tz_db ?? "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                airport.type ?? "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                airport.source ?? "—"
                            )}
                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    class="btn btn-secondary btn-small"
                                    type="button"
                                    data-action="edit-airport"
                                    data-iata="${iata}">
                                    Modifier
                                </button>

                                <button
                                    class="btn btn-small btn-danger"
                                    type="button"
                                    data-action="delete-airport"
                                    data-iata="${iata}">
                                    Supprimer
                                </button>

                            </div>

                        </td>

                    </tr>
                `;
            }
        ).join("");
}


/* =========================================================
   PAGINATION
   ========================================================= */

function updateAirportPagination(
    total
) {

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                airportLimit
            )
        );


    airportPageInfo.textContent =
        `Page ${airportPage} / ${totalPages} · ${formatNumber(total)} aéroport(s)`;


    airportPrev.disabled =
        airportPage <= 1;


    airportNext.disabled =
        airportPage >= totalPages;
}


airportPrev.addEventListener(
    "click",
    () => {

        if (
            airportPage > 1
        ) {

            airportPage--;

            loadAirports();
        }
    }
);


airportNext.addEventListener(
    "click",
    () => {

        airportPage++;

        loadAirports();
    }
);


btnAirportSearch.addEventListener(
    "click",
    () => {

        airportPage = 1;

        loadAirports();
    }
);


[
    airportFilterCity,
    airportFilterCountry
].forEach(
    input => {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    airportPage = 1;

                    loadAirports();
                }
            }
        );
    }
);


/* =========================================================
   CREATE / UPDATE
   ========================================================= */

airportForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        hideMessage(
            airportMessage
        );


        const payload = {

            id:
                numberOrNull(
                    airportId
                ),

            name:
                airportName.value.trim(),

            city:
                airportCity.value.trim(),

            country:
                airportCountry.value.trim(),

            iata:
                airportIata.value
                    .trim()
                    .toUpperCase(),

            icao:
                stringOrNull(
                    airportIcao
                ),

            lat:
                numberOrNull(
                    airportLat
                ),

            lon:
                numberOrNull(
                    airportLon
                ),

            altitude:
                numberOrNull(
                    airportAltitude
                ),

            timezone:
                stringOrNull(
                    airportTimezone
                ),

            dst:
                stringOrNull(
                    airportDst
                ),

            tz_db:
                stringOrNull(
                    airportTzDb
                ),

            type:
                stringOrNull(
                    airportType
                ),

            source:
                stringOrNull(
                    airportSource
                )
        };


        if (
            payload.iata.length !== 3 ||
            !/^[A-Z]+$/.test(
                payload.iata
            )
        ) {

            showMessage(
                airportMessage,
                "Le code IATA doit contenir exactement 3 lettres.",
                "error"
            );

            return;
        }


        if (
            payload.icao &&
            (
                payload.icao.length !== 4 ||
                !/^[A-Z0-9]+$/.test(
                    payload.icao
                )
            )
        ) {

            showMessage(
                airportMessage,
                "Le code ICAO doit contenir 4 caractères alphanumériques.",
                "error"
            );

            return;
        }


        const isEditing =
            Boolean(
                airportEditingIata
            );


        setButtonLoading(
            btnSaveAirport,
            true,
            isEditing
                ? "Modification..."
                : "Création..."
        );


        try {

            if (isEditing) {

                await apiFetch(
                    `/airports/${encodeURIComponent(
                        airportEditingIata
                    )}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(
                            payload
                        )
                    }
                );

            } else {

                await apiFetch(
                    "/airports",
                    {
                        method: "POST",
                        body: JSON.stringify(
                            payload
                        )
                    }
                );
            }


            closeAirportForm();

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

airportTableBody.addEventListener(
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


        if (
            action === "edit-airport"
        ) {

            await editAirport(
                iata
            );
        }


        if (
            action === "delete-airport"
        ) {

            await deleteAirport(
                iata
            );
        }
    }
);


/* =========================================================
   DETAIL AIRPORT
   ========================================================= */

async function editAirport(
    iata
) {

    try {

        const airport =
            await apiFetch(
                `/airports/${encodeURIComponent(
                    iata
                )}`
            );


        openAirportForm(
            airport
        );

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

async function deleteAirport(
    iata
) {

    const confirmation =
        window.confirm(
            `Voulez-vous vraiment supprimer l'aéroport ${iata} ?\n\n` +
            "Cette opération est définitive."
        );


    if (!confirmation) {
        return;
    }


    try {

        await apiFetch(
            `/airports/${encodeURIComponent(
                iata
            )}`,
            {
                method: "DELETE"
            }
        );


        showMessage(
            airportMessage,
            `L'aéroport ${iata} a été supprimé.`,
            "success"
        );


        if (
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
   Q1
   ========================================================= */

const btnQ1 =
    document.getElementById(
        "btn-q1"
    );

const tableQ1 =
    document.getElementById(
        "table-q1"
    );

const q1Empty =
    document.getElementById(
        "q1-empty"
    );


async function loadQ1() {

    setButtonLoading(
        btnQ1,
        true,
        "Analyse..."
    );


    try {

        /*
         * Endpoint réel du main.py
         */
        const data =
            await apiFetch(
                "/agg/q1"
            );


        const rows =
            Array.isArray(data)
                ? data
                : [];


        const tbody =
            tableQ1.querySelector(
                "tbody"
            );


        tbody.innerHTML =
            rows.map(
                (row, index) => {

                    return `
                        <tr>

                            <td>
                                <span class="rank">
                                    ${index + 1}
                                </span>
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        row.iata
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHtml(
                                    row.nom
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    row.ville
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    row.pays
                                )}
                            </td>

                            <td class="number">
                                ${formatNumber(
                                    row.nombre_destinations
                                )}
                            </td>

                        </tr>
                    `;
                }
            ).join("");


        tableQ1.hidden =
            rows.length === 0;


        q1Empty.hidden =
            rows.length > 0;


        if (
            rows.length === 0
        ) {

            q1Empty.textContent =
                "Aucun résultat retourné par l'API.";
        }

    } catch (error) {

        tableQ1.hidden =
            true;

        q1Empty.hidden =
            false;

        q1Empty.textContent =
            `Erreur Q1 : ${error.message}`;

    } finally {

        setButtonLoading(
            btnQ1,
            false
        );
    }
}


btnQ1.addEventListener(
    "click",
    loadQ1
);


/* =========================================================
   Q2
   ========================================================= */

const btnQ2 =
    document.getElementById(
        "btn-q2"
    );

const tableQ2 =
    document.getElementById(
        "table-q2"
    );

const q2Empty =
    document.getElementById(
        "q2-empty"
    );


async function loadQ2() {

    setButtonLoading(
        btnQ2,
        true,
        "Analyse..."
    );


    try {

        /*
         * Endpoint réel du main.py
         */
        const data =
            await apiFetch(
                "/agg/q2"
            );


        const rows =
            Array.isArray(data)
                ? data
                : [];


        const tbody =
            tableQ2.querySelector(
                "tbody"
            );


        tbody.innerHTML =
            rows.map(
                (row, index) => {

                    return `
                        <tr>

                            <td>
                                <span class="rank">
                                    ${index + 1}
                                </span>
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        row.nom
                                    )}
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
                                ${escapeHtml(
                                    row.pays
                                )}
                            </td>

                            <td class="number">
                                ${formatNumber(
                                    row.nombre_destinations
                                )}
                            </td>

                        </tr>
                    `;
                }
            ).join("");


        tableQ2.hidden =
            rows.length === 0;


        q2Empty.hidden =
            rows.length > 0;


        if (
            rows.length === 0
        ) {

            q2Empty.textContent =
                "Aucun résultat retourné par l'API.";
        }

    } catch (error) {

        tableQ2.hidden =
            true;

        q2Empty.hidden =
            false;

        q2Empty.textContent =
            `Erreur Q2 : ${error.message}`;

    } finally {

        setButtonLoading(
            btnQ2,
            false
        );
    }
}


btnQ2.addEventListener(
    "click",
    loadQ2
);


/* =========================================================
   EXPLAIN
   ========================================================= */

const btnExplain =
    document.getElementById(
        "btn-explain"
    );

const explain =
    document.getElementById(
        "explain"
    );

const explainPlaceholder =
    document.getElementById(
        "explain-placeholder"
    );


let explainVisible = false;


btnExplain.addEventListener(
    "click",
    async () => {

        if (explainVisible) {

            explain.hidden =
                true;

            explainPlaceholder.hidden =
                false;

            btnExplain.textContent =
                "Afficher explain()";

            explainVisible =
                false;

            return;
        }


        setButtonLoading(
            btnExplain,
            true,
            "Chargement..."
        );


        try {

            /*
             * Endpoint réel du main.py.
             */
            const data =
                await apiFetch(
                    "/agg/explain"
                );


            explain.textContent =
                JSON.stringify(
                    data,
                    null,
                    2
                );


            explain.hidden =
                false;

            explainPlaceholder.hidden =
                true;

            btnExplain.textContent =
                "Masquer explain()";

            explainVisible =
                true;

        } catch (error) {

            explainPlaceholder.textContent =
                `Impossible de charger explain() : ${error.message}`;

        } finally {

            setButtonLoading(
                btnExplain,
                false
            );
        }
    }
);


/* =========================================================
   NORMALISATION IATA
   ========================================================= */

[
    airportIata,
    airportIcao
].forEach(
    input => {

        input.addEventListener(
            "input",
            () => {

                input.value =
                    input.value
                        .toUpperCase();
            }
        );
    }
);


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