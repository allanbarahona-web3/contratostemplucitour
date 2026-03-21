const form = document.getElementById("contractForm");
const previewEl = document.getElementById("contractPreview");
const statusText = document.getElementById("statusText");
const previewButton = document.getElementById("previewButton");
const downloadButton = document.getElementById("downloadButton");
const emailButton = document.getElementById("emailButton");
const waButton = document.getElementById("waButton");
const addCompanionButton = document.getElementById("addCompanionButton");
const companionsContainer = document.getElementById("companionsContainer");
const addItineraryButton = document.getElementById("addItineraryButton");
const itineraryContainer = document.getElementById("itineraryContainer");
const hasMinorCompanionInput = document.getElementById("hasMinorCompanion");
const minorSection = document.getElementById("minorSection");
const addMinorButton = document.getElementById("addMinorButton");
const minorsContainer = document.getElementById("minorsContainer");
const minorAnnexPreview = document.getElementById("minorAnnexPreview");
const clientNationalitySelect = document.getElementById("clientNationality");
const clientNationalityOtherWrap = document.getElementById("clientNationalityOtherWrap");

const erickSignaturePreview = document.getElementById("erickSignaturePreview");
const lucitoursLogoPath = "./assets/logo-lucitour.png";
const DEBUG_TAG = "[ContratosTemp]";
const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const DEFAULT_PRODUCTION_API_BASE = "https://contratostempapi-h5ppc.ondigitalocean.app";
const storedApiBase = normalizeBaseUrl(window.localStorage.getItem("contractsApiBase"));
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const hasLocalStoredApiBase = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(storedApiBase);
if (!isLocalHost && hasLocalStoredApiBase) {
  window.localStorage.removeItem("contractsApiBase");
}
const runtimeStoredApiBase = !isLocalHost && hasLocalStoredApiBase ? "" : storedApiBase;
const API_BASE = runtimeStoredApiBase || configuredApiBase || DEFAULT_PRODUCTION_API_BASE;
const AUTH_TOKEN_KEY = "contractsTempAuthToken";

const loginGate = document.getElementById("loginGate");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");
const loginPasswordInput = document.getElementById("loginPassword");
const toggleLoginPasswordButton = document.getElementById("toggleLoginPassword");
const layoutEl = document.querySelector("main.layout");
const sessionControlsEl = document.getElementById("sessionControls");
const badgeEl = document.getElementById("agentBadge");
const logoutButton = document.getElementById("logoutButton");
let currentAuthenticatedUser = null;

const setupPasswordToggle = () => {
  if (!loginPasswordInput || !toggleLoginPasswordButton) {
    return;
  }

  toggleLoginPasswordButton.addEventListener("click", () => {
    const isVisible = loginPasswordInput.type === "text";
    loginPasswordInput.type = isVisible ? "password" : "text";
    toggleLoginPasswordButton.classList.toggle("active", !isVisible);
    toggleLoginPasswordButton.setAttribute("aria-pressed", String(!isVisible));
    toggleLoginPasswordButton.setAttribute("aria-label", isVisible ? "Mostrar contrasena" : "Ocultar contrasena");
    toggleLoginPasswordButton.setAttribute("title", isVisible ? "Mostrar contrasena" : "Ocultar contrasena");
  });
};

const handleLogout = () => {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  currentAuthenticatedUser = null;
  loginForm.reset();
  form.elements.contractNumber.value = "Generando...";
  setUnauthenticatedUi("Sesion cerrada. Ingresa tus credenciales.");
  statusText.textContent = "Sesion cerrada correctamente.";

  const emailInput = loginForm.querySelector('input[name="email"]');
  if (emailInput) {
    emailInput.focus();
  }
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const contractVar = (value) => `<span class="contract-var">${escapeHtml(value)}</span>`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CR");
};

const toMoney = (value) => {
  const amount = Number.parseFloat(String(value || "0"));
  if (!Number.isFinite(amount)) return 0;
  return amount;
};

const formatMoney = (value) => toMoney(value).toFixed(2);

const debugLog = (...args) => {
  console.log(DEBUG_TAG, ...args);
};

const debugError = (...args) => {
  console.error(DEBUG_TAG, ...args);
};

const setLoginStatus = (message, isError = false) => {
  loginStatus.textContent = message;
  loginStatus.classList.toggle("error", isError);
};

const setAuthenticatedUi = (user) => {
  loginGate.style.display = "none";
  layoutEl.style.display = "grid";
  if (sessionControlsEl) {
    sessionControlsEl.classList.remove("hidden");
  }
  if (badgeEl) {
    badgeEl.textContent = `Agente activo: ${user.fullName} (${user.email})`;
  }
};

const setUnauthenticatedUi = (message = "Ingresa tus credenciales.") => {
  loginGate.style.display = "grid";
  layoutEl.style.display = "none";
  if (sessionControlsEl) {
    sessionControlsEl.classList.add("hidden");
  }
  if (badgeEl) {
    badgeEl.textContent = "";
  }
  setLoginStatus(message);
};

const apiFetch = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = payload.message || "No se pudo completar la solicitud.";
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }

  return payload;
};

const validateSession = async (token) =>
  apiFetch("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

const reserveContractNumber = async (token) => {
  const payload = await apiFetch("/contracts/next-number", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  form.elements.contractNumber.value = payload.contractNumber;
  return payload;
};

const setupAuth = async () => {
  setUnauthenticatedUi("Verificando sesion...");

  const existingToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!existingToken) {
    setUnauthenticatedUi("Ingresa tus credenciales.");
    return;
  }

  try {
    const user = await validateSession(existingToken);
    currentAuthenticatedUser = user;
    setAuthenticatedUi(user);
    await reserveContractNumber(existingToken);
    setLoginStatus("Sesion activa.");
  } catch (error) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    currentAuthenticatedUser = null;
    setUnauthenticatedUi("Tu sesion expiro. Inicia sesion nuevamente.");
    debugError("Sesion invalida", error);
  }
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar imagen: ${src}`));
    image.src = src;
  });

const NATIONALITY_OPTIONS = [
  "Costa Rica",
  "Guatemala",
  "El Salvador",
  "Honduras",
  "Nicaragua",
  "Panama",
  "Mexico",
  "Colombia",
  "Otra opcion",
];

const nationalityOptionsHtml = (selectedValue = "") =>
  NATIONALITY_OPTIONS.map(
    (option) =>
      `<option value="${escapeHtml(option)}" ${selectedValue === option ? "selected" : ""}>${escapeHtml(option)}</option>`,
  ).join("");

const buildTutorOptions = (selectedValue = "") => {
  const titularName = form.elements.clientFullName.value.trim() || "Titular (sin nombre)";
  const companionNames = Array.from(companionsContainer.querySelectorAll('[data-field="fullName"]'))
    .map((input) => input.value.trim())
    .filter(Boolean);

  const options = [
    { value: titularName, label: `${titularName} (Titular)` },
    ...companionNames.map((name) => ({ value: name, label: `${name} (Acompanante)` })),
  ];

  return options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(
          option.label,
        )}</option>`,
    )
    .join("");
};

const addCompanionRow = (initial = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-card";
  row.innerHTML = `
    <div class="card-row">
      <h4>Acompanante</h4>
      <button type="button" class="ghost remove-row">Eliminar</button>
    </div>
    <div class="card-grid">
      <label>Nombre completo<input data-field="fullName" value="${escapeHtml(initial.fullName || "")}" required /></label>
      <label>Tipo ID
        <select data-field="idType" required>
          <option value="Cedula" ${initial.idType === "Cedula" ? "selected" : ""}>Cedula</option>
          <option value="Pasaporte" ${initial.idType === "Pasaporte" ? "selected" : ""}>Pasaporte</option>
          <option value="DIMEX" ${initial.idType === "DIMEX" ? "selected" : ""}>DIMEX</option>
        </select>
      </label>
      <label>Numero ID<input data-field="idNumber" value="${escapeHtml(initial.idNumber || "")}" required /></label>
      <label>Correo<input data-field="email" type="email" value="${escapeHtml(initial.email || "")}" required /></label>
      <label>Telefono<input data-field="phone" value="${escapeHtml(initial.phone || "")}" required /></label>
      <label>Direccion<input data-field="address" value="${escapeHtml(initial.address || "")}" required /></label>
      <label>Estado civil<input data-field="civilStatus" value="${escapeHtml(initial.civilStatus || "")}" required /></label>
      <label>Profesion<input data-field="profession" value="${escapeHtml(initial.profession || "")}" required /></label>
      <label>Nacionalidad
        <select data-field="nationality" required>
          ${nationalityOptionsHtml(initial.nationality || "Costa Rica")}
        </select>
      </label>
      <label data-field-wrap="nationalityOther" class="hidden">Otra nacionalidad
        <input data-field="nationalityOther" value="${escapeHtml(initial.nationalityOther || "")}" />
      </label>
    </div>
  `;

  const nationalitySelect = row.querySelector('[data-field="nationality"]');
  const nationalityOtherWrap = row.querySelector('[data-field-wrap="nationalityOther"]');
  const syncCompanionNationality = () => {
    const isOther = nationalitySelect.value === "Otra opcion";
    nationalityOtherWrap.classList.toggle("hidden", !isOther);
  };
  nationalitySelect.addEventListener("change", syncCompanionNationality);
  syncCompanionNationality();

  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    refreshTutorOptions();
  });

  companionsContainer.appendChild(row);
};

const addMinorRow = (initial = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-card";
  row.innerHTML = `
    <div class="card-row">
      <h4>Menor</h4>
      <button type="button" class="ghost remove-row">Eliminar</button>
    </div>
    <div class="card-grid">
      <label>Nombre del menor<input data-field="minorName" value="${escapeHtml(initial.minorName || "")}" required /></label>
      <label>Identificacion del menor<input data-field="minorId" value="${escapeHtml(initial.minorId || "")}" required /></label>
      <label>Nombre del tutor legal<input data-field="tutorName" value="${escapeHtml(initial.tutorName || "")}" required /></label>
      <label>Tipo ID tutor legal
        <select data-field="tutorIdType" required>
          <option value="Cedula" ${initial.tutorIdType === "Cedula" ? "selected" : ""}>Cedula</option>
          <option value="Pasaporte" ${initial.tutorIdType === "Pasaporte" ? "selected" : ""}>Pasaporte</option>
          <option value="DIMEX" ${initial.tutorIdType === "DIMEX" ? "selected" : ""}>DIMEX</option>
        </select>
      </label>
      <label>ID tutor legal<input data-field="tutorId" value="${escapeHtml(initial.tutorId || "")}" required /></label>
      <label>Tutor/adulto que viaja con el menor
        <select data-field="travelingWith" required>
          ${buildTutorOptions(initial.travelingWith || "")}
        </select>
      </label>
    </div>
  `;

  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    syncMinorSectionVisibility();
  });

  minorsContainer.appendChild(row);
};

const addItineraryRow = (initial = {}) => {
  const kind = initial.kind || "custom";
  const removable = initial.removable ?? true;
  const isLocked = kind === "opening" || kind === "closing";
  const kindLabel =
    kind === "opening" ? "Inicio del Viaje" : kind === "closing" ? "Fin del Viaje" : "Actividad";

  const row = document.createElement("div");
  row.className = "dynamic-card compact";
  row.dataset.kind = kind;
  row.innerHTML = `
    <div class="card-grid itinerary-grid">
      <label><input value="${kindLabel}" readonly /></label>
      <label>Fecha<input data-field="date" type="date" value="${escapeHtml(initial.date || "")}" ${
        isLocked ? "readonly" : ""
      } required /></label>
      <label>Detalle<input data-field="detail" value="${escapeHtml(initial.detail || "")}" placeholder="Tour a X lugar" ${
        isLocked ? "readonly" : ""
      } required /></label>
      <div class="row-end">
        ${
          removable
            ? '<button type="button" class="ghost remove-row">Eliminar</button>'
            : '<span class="locked-hint">No eliminar</span>'
        }
      </div>
    </div>
  `;

  const removeButton = row.querySelector(".remove-row");
  if (removeButton) {
    removeButton.addEventListener("click", () => {
      row.remove();
    });
  }

  const closingRow = itineraryContainer.querySelector('[data-kind="closing"]');
  if (kind === "custom" && closingRow) {
    itineraryContainer.insertBefore(row, closingRow);
    return;
  }

  itineraryContainer.appendChild(row);
};

const recalcBalance = () => {
  const total = toMoney(form.elements.totalAmount.value);
  const reservation = toMoney(form.elements.reservationAmount.value);
  const balance = Math.max(total - reservation, 0);
  form.elements.balanceAmount.value = formatMoney(balance);

  const installmentCount = Number.parseInt(String(form.elements.installmentCount.value || "1"), 10);
  const safeCount = Number.isFinite(installmentCount) && installmentCount > 0 ? installmentCount : 1;
  const monthlyAmount = balance / safeCount;
  form.elements.monthlyInstallmentAmount.value = formatMoney(monthlyAmount);
};

const recalcPaymentDueDate = () => {
  const startDate = form.elements.startDate.value;
  if (!startDate) {
    form.elements.paymentDueDate.value = "";
    return;
  }

  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    form.elements.paymentDueDate.value = "";
    return;
  }

  start.setDate(start.getDate() - 22);
  form.elements.paymentDueDate.value = start.toISOString().slice(0, 10);
};

const resolveNationality = (base, other) =>
  base === "Otra opcion" ? String(other || "").trim() || "Otra opcion" : base;

const refreshTutorOptions = () => {
  const selects = minorsContainer.querySelectorAll('[data-field="travelingWith"]');
  selects.forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = buildTutorOptions(currentValue);
  });
};

const collectCompanions = () =>
  Array.from(companionsContainer.querySelectorAll(".dynamic-card")).map((card) => ({
    fullName: card.querySelector('[data-field="fullName"]').value.trim(),
    idType: card.querySelector('[data-field="idType"]').value.trim(),
    idNumber: card.querySelector('[data-field="idNumber"]').value.trim(),
    email: card.querySelector('[data-field="email"]').value.trim(),
    phone: card.querySelector('[data-field="phone"]').value.trim(),
    address: card.querySelector('[data-field="address"]').value.trim(),
    civilStatus: card.querySelector('[data-field="civilStatus"]').value.trim(),
    profession: card.querySelector('[data-field="profession"]').value.trim(),
    nationality: resolveNationality(
      card.querySelector('[data-field="nationality"]').value.trim(),
      card.querySelector('[data-field="nationalityOther"]')?.value.trim(),
    ),
  }));

const collectMinors = () =>
  Array.from(minorsContainer.querySelectorAll(".dynamic-card")).map((card) => ({
    name: card.querySelector('[data-field="minorName"]').value.trim(),
    idNumber: card.querySelector('[data-field="minorId"]').value.trim(),
    tutorName: card.querySelector('[data-field="tutorName"]').value.trim(),
    tutorIdType: card.querySelector('[data-field="tutorIdType"]').value.trim(),
    tutorId: card.querySelector('[data-field="tutorId"]').value.trim(),
    travelingWith: card.querySelector('[data-field="travelingWith"]').value.trim(),
  }));

const getResponsibleAdultIdentity = (data, fullName) => {
  const normalized = String(fullName || "").trim().toLowerCase();
  if (!normalized) {
    return { idType: "ID", idNumber: "-" };
  }

  const titularName = String(data.clientFullName || "").trim().toLowerCase();
  if (normalized === titularName) {
    return {
      idType: String(data.clientIdType || "ID").trim() || "ID",
      idNumber: String(data.clientIdNumber || "-").trim() || "-",
    };
  }

  const companion = (data.companions || []).find(
    (person) => String(person.fullName || "").trim().toLowerCase() === normalized,
  );
  if (companion) {
    return {
      idType: String(companion.idType || "ID").trim() || "ID",
      idNumber: String(companion.idNumber || "-").trim() || "-",
    };
  }

  return { idType: "ID", idNumber: "-" };
};

const collectItinerary = () =>
  Array.from(itineraryContainer.querySelectorAll(".dynamic-card")).map((card) => ({
    date: card.querySelector('[data-field="date"]').value,
    detail: card.querySelector('[data-field="detail"]').value.trim(),
  }));

const resetDefaultItinerary = () => {
  const startDate = form.elements.startDate.value;
  const endDate = form.elements.endDate.value;

  itineraryContainer.innerHTML = "";
  addItineraryRow({
    kind: "opening",
    removable: false,
    date: startDate,
    detail: "",
  });
  addItineraryRow({
    kind: "closing",
    removable: false,
    date: endDate,
    detail: "",
  });
};

const syncMinorSectionVisibility = () => {
  const enabled = hasMinorCompanionInput.checked;
  minorSection.classList.toggle("hidden", !enabled);

  if (!enabled) {
    minorsContainer.innerHTML = "";
    minorAnnexPreview.classList.add("hidden");
    return;
  }

  if (minorsContainer.children.length === 0) {
    addMinorRow();
  }

  refreshTutorOptions();
};

const getFormData = () => {
  const formData = new FormData(form);
  const parsedCount = Number.parseInt(String(formData.get("installmentCount") || "1"), 10);
  const installmentCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
  return {
    contractNumber: formData.get("contractNumber"),
    issuedAt: formData.get("issuedAt"),
    destination: formData.get("destination"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    accommodationType: formData.get("accommodationType"),
    lodgingType: formData.get("lodgingType"),
    clientFullName: formData.get("clientFullName"),
    clientIdType: formData.get("clientIdType"),
    clientIdNumber: formData.get("clientIdNumber"),
    clientEmail: formData.get("clientEmail"),
    clientPhone: formData.get("clientPhone"),
    clientAddress: formData.get("clientAddress"),
    civilStatus: formData.get("civilStatus"),
    profession: formData.get("profession"),
    clientNationality: resolveNationality(
      formData.get("clientNationality"),
      formData.get("clientNationalityOther"),
    ),
    totalAmount: toMoney(formData.get("totalAmount")),
    reservationAmount: toMoney(formData.get("reservationAmount")),
    balanceAmount: toMoney(formData.get("balanceAmount")),
    paymentDueDate: formData.get("paymentDueDate"),
    installmentCount,
    monthlyInstallmentAmount: toMoney(formData.get("monthlyInstallmentAmount")),
    companions: collectCompanions(),
    hasMinorCompanion: hasMinorCompanionInput.checked,
    minors: collectMinors(),
    itineraryItems: collectItinerary(),
    luggageClause: formData.get("luggageClause"),
      generatedByAgentName: currentAuthenticatedUser?.fullName || "-",
      generatedByAgentEmail: currentAuthenticatedUser?.email || "-",
  };
};

const buildMinorAnnexHtml = (data) => {
  if (!data.hasMinorCompanion || data.minors.length === 0) {
    return "";
  }

  const issuedAt = formatDate(data.issuedAt);
  const annexes = data.minors
    .map(
      (minor, index) => {
        const travelingAdultIdentity = getResponsibleAdultIdentity(data, minor.travelingWith);
        return `
      <section class="annex-block">
        <h3>ANEXO DE AUTORIZACION PARA VIAJE DE MENOR DE EDAD ${index + 1}</h3>
        <p><strong>Numero de anexo:</strong> ANX-MEN-${escapeHtml(data.contractNumber)}-${String(index + 1).padStart(2, "0")}</p>
        <p><strong>Contrato Numero:</strong> ${escapeHtml(data.contractNumber)}</p>
        <p>Este anexo complementa el CONTRATO GENERAL DE VIAJE TURISTICO N. ${escapeHtml(data.contractNumber)} y documenta la autorizacion del tutor/patria potestad para el menor indicado.</p>

        <p><strong>PRIMERO: DATOS DEL MENOR</strong></p>
        <ul>
          <li>Menor: ${escapeHtml(minor.name)}</li>
          <li>Identificacion: ${escapeHtml(minor.idNumber)}</li>
          <li>Destino del Tour: ${escapeHtml(data.destination)}</li>
          <li>Fechas del Tour: ${formatDate(data.startDate)} a ${formatDate(data.endDate)}</li>
        </ul>

        <p><strong>SEGUNDO: DATOS DE QUIEN EJERCE PATRIA POTESTAD / TUTOR LEGAL</strong></p>
        <ul>
          <li>Nombre completo: ${escapeHtml(minor.tutorName)}</li>
          <li>Identificacion: ${escapeHtml(minor.tutorIdType || "ID")} ${escapeHtml(minor.tutorId)}</li>
          <li>Telefono de contacto: -</li>
        </ul>

        <p><strong>TERCERO: ADULTO RESPONSABLE QUE ACOMPANA AL MENOR DURANTE EL VIAJE</strong></p>
        <ul>
          <li>Nombre completo: ${escapeHtml(minor.travelingWith)}</li>
          <li>Identificacion: ${escapeHtml(travelingAdultIdentity.idType)} ${escapeHtml(travelingAdultIdentity.idNumber)}</li>
          <li>Telefono de contacto: -</li>
        </ul>

        <p><strong>CUARTO: DECLARACION DE AUTORIZACION</strong></p>
        <p>La persona firmante, en su condicion de tutor legal y/o quien ejerce la patria potestad, declara bajo fe de juramento que cuenta con facultades legales suficientes para autorizar el viaje del menor e identifica expresamente a ${escapeHtml(minor.travelingWith)} como el adulto responsable que acompanara al menor durante el viaje. Asimismo, exonera a Lucitours de responsabilidad por informacion inexacta o documentacion insuficiente aportada por el representante.</p>

        <p><strong>QUINTO: DOCUMENTO DE RESPALDO</strong></p>
        <p>Este anexo debe estar acompanado por el permiso notarial, judicial o documento equivalente exigido por la normativa migratoria aplicable.</p>

        <p><strong>FIRMAS</strong></p>
        <div class="annex-signatures">
          <div class="annex-sign-box">
            <p>______________________________</p>
            <p><strong>1) Tutor legal / Patria potestad</strong></p>
            <p>${escapeHtml(minor.tutorName)}</p>
            <p>${escapeHtml(minor.tutorIdType || "ID")}: ${escapeHtml(minor.tutorId)}</p>
          </div>
          <div class="annex-sign-box">
            <p>______________________________</p>
            <p><strong>2) Adulto autorizado que acompana al menor en el viaje</strong></p>
            <p>${escapeHtml(minor.travelingWith)}</p>
            <p>${escapeHtml(travelingAdultIdentity.idType)}: ${escapeHtml(travelingAdultIdentity.idNumber)}</p>
          </div>
        </div>
        <div class="annex-signatures">
          <div class="annex-sign-box">
            <p><strong>Fecha de emision:</strong> ${issuedAt}</p>
          </div>
        </div>
      </section>
    `;
      },
    )
    .join("");

  return `
    <h3>ANEXO DE AUTORIZACION PARA VIAJE DE MENORES DE EDAD</h3>
    <p>Este anexo complementa el contrato general y aplica para todos los menores registrados.</p>
    ${annexes}
  `;
};

const buildContractHtml = (data) => {
  const signatureDate = formatDate(new Date().toISOString().slice(0, 10));

  const companionsIntro = data.companions.length
    ? `
      <p>Adicionalmente, comparecen como acompañantes del Tour:</p>
      <ul>${data.companions
        .map(
          (person) =>
              `<li>${contractVar(person.fullName)}, mayor de edad, ${contractVar(person.civilStatus)}, ${contractVar(
              person.profession,
              )}, portador de ${contractVar(person.idType)} número ${contractVar(
              person.idNumber,
              )}, vecino de ${contractVar(person.address)}, correo electrónico ${contractVar(
              person.email,
              )}, teléfono ${contractVar(person.phone)}.</li>`,
        )
        .join("")}</ul>
    `
    : "";

  const minorsIntro = data.minors.length
    ? `
      <p>El Cliente declara que viaja con menor(es) de edad:</p>
      <ul>${data.minors
        .map(
          (minor) =>
              `<li>${contractVar(minor.name)}, documento de menor número ${contractVar(
              minor.idNumber,
              )}, en calidad de representado por ${contractVar(minor.tutorName)}.</li>`,
        )
        .join("")}</ul>
      <p>La autorización y consentimiento de representación de menor de edad se incorpora como anexo obligatorio de este Contrato.</p>
    `
    : "";

  const itineraryHtml = data.itineraryItems.length
    ? `<ul>${data.itineraryItems
          .map((item) => `<li>Fecha: ${contractVar(formatDate(item.date))} | Actividad: ${contractVar(item.detail)}</li>`)
        .join("")}</ul>`
    : "<p>Sin actividades registradas.</p>";

  const clientAndCompanionSignatureBlocks = [
    {
      name: data.clientFullName,
      idType: data.clientIdType,
      idNumber: data.clientIdNumber,
      role: "Cliente",
    },
    ...data.companions.map((person) => ({
      name: person.fullName,
      idType: person.idType,
      idNumber: person.idNumber,
      role: "Acompañante",
    })),
  ]
    .map(
      (person) => `
      <div class="signature-box signature-box--person">
        <div class="signature-sign-area" aria-hidden="true"></div>
          <p><strong>${contractVar(person.name)}</strong></p>
          <p>${contractVar(person.idType)}: ${contractVar(person.idNumber)}</p>
          <p>Rol: ${contractVar(person.role)}</p>
          <p>Fecha: ${contractVar(signatureDate)}</p>
      </div>
    `,
    )
    .join("");

  const erickSignatureBlock = `
    <div class="signature-box signature-box--erick">
        <div class="signature-sign-area" aria-hidden="true"></div>
      <p><strong>ERICK JOSUE BONILLA PEREIRA</strong></p>
      <p>Cédula de identidad: 1-1597-0559</p>
      <p>Representante legal de Lucitours</p>
        <p>Fecha: ${contractVar(signatureDate)}</p>
    </div>
  `;

  return `
      <h3>CONTRATO GENERAL DE VIAJE TURÍSTICO A ${contractVar(data.destination)}</h3>
      <p><strong>Contrato Número:</strong> ${contractVar(data.contractNumber)}</p>
      <p><strong>Agente Responsable:</strong> ${contractVar(data.generatedByAgentName)} (${contractVar(data.generatedByAgentEmail)})</p>

    <p><strong>Entre nosotros:</strong></p>
    <p>
      (a) ERICK JOSUE BONILLA PEREIRA, mayor, soltero, administrador de agencia de viajes, portador de la cédula de identidad número 1-1597-0559,
      vecino de Cartago, en condición de representante legal, con facultades de apoderado generalísimo sin límite de suma de
      VIAJES LUCITOURS TURISMO INTERNACIONAL SOCIEDAD ANONIMA, cédula jurídica número 3-101-874546, en adelante denominada "Lucitours"; y
    </p>
    <p>
        (b) ${contractVar(data.clientFullName)}, mayor de edad, ${contractVar(data.civilStatus)}, ${contractVar(
    data.profession,
    )}, portador de ${contractVar(data.clientIdType)} número ${contractVar(
    data.clientIdNumber,
    )}, vecino de ${contractVar(data.clientAddress)}, correo electrónico ${contractVar(
    data.clientEmail,
    )}, teléfono ${contractVar(data.clientPhone)}, en adelante denominado como el "Cliente".
    </p>

    ${companionsIntro}
    ${minorsIntro}

    <p>Haciendo mención a los comparecientes en conjunto, denominados como las "Partes", hemos convenido en celebrar el presente CONTRATO GENERAL DE VIAJE TURÍSTICO, el cual se regirá por las siguientes cláusulas:</p>

    <h3>CLÁUSULAS</h3>
    <p><strong>PRIMERO: OBJETO.</strong> El presente Contrato será el documento base para regular las cláusulas y condiciones referentes a la contratación del paquete turístico internacional acordado entre las Partes.</p>
      <p><strong>SEGUNDO: DESTINO.</strong> El país a visitar por parte del Cliente es ${contractVar(data.destination)}, y manifiesta expresamente que dicho destino fue elegido y reservado de forma voluntaria para la realización del Tour.</p>
      <p><strong>TERCERO: FECHAS DEL TOUR Y PLAZO.</strong> Las fechas de ejecución del Tour serán del ${contractVar(formatDate(
      data.startDate,
      ))} al ${contractVar(formatDate(data.endDate))}, mismas que se entenderán como plazo del presente Contrato.</p>

    <p><strong>CUARTO: PRECIO, FORMA DE PAGO Y MEDIOS DE PAGO.</strong></p>
    <ul>
        <li>Precio total del Tour: USD ${contractVar(formatMoney(data.totalAmount))}</li>
        <li>Pago inicial (reserva): USD ${contractVar(formatMoney(data.reservationAmount))}</li>
        <li>Saldo pendiente: USD ${contractVar(formatMoney(data.balanceAmount))}</li>
        <li>Saldo dividido en ${contractVar(data.installmentCount)} cuota(s) mensual(es) de USD ${contractVar(formatMoney(
      data.monthlyInstallmentAmount,
      ))}</li>
        <li>Fecha límite de pago total: ${contractVar(formatDate(data.paymentDueDate))}</li>
    </ul>
      <p>Los medios de pago para realizar los pagos son los siguientes:</p>
      <ul>
        <li>Cuenta bancaria (IBAN): CR25011610400074756807, Banco Promerica.</li>
        <li>Sinpe Móvil: 7296-9551.</li>
        <li>Pagos en efectivo o tarjeta en oficinas de Lucitours.</li>
      </ul>

    <p><strong>QUINTO: DEPÓSITO DE RESERVA.</strong> La cuota de reserva inicial se utiliza como depósito mínimo para reservar y garantizar el espacio del Cliente en el Tour y los operadores turísticos, por lo que dicho depósito no será transferible, reutilizable ni reembolsable.</p>
    <p>En caso de incumplimiento en pagos, Lucitours podrá notificar una fecha límite para poner al día los montos. De mantenerse el incumplimiento, Lucitours podrá excluir al Cliente del Tour y los dineros recibidos al momento no serán reembolsables.</p>

      <p><strong>SEXTO: ALOJAMIENTOS Y HOSPEDAJES.</strong> Como parte del Tour, el Cliente será alojado en establecimientos tipo hostel, hotel u otros similares, conforme a la logística del viaje, disponibilidad y condiciones operativas del proveedor.</p>
        <p>Como referencia de preferencia del Cliente, se registra tipo de hospedaje ${contractVar(
        data.lodgingType,
        )} y acomodación solicitada ${contractVar(data.accommodationType)}. Esta preferencia no constituye garantía absoluta y estará sujeta a disponibilidad y criterios operativos del Tour.</p>
      <p>La asignación final de habitaciones y tipo de acomodación será determinada por Lucitours según criterios operativos, pudiendo incluir habitaciones individuales, dobles, múltiples o compartidas.</p>
      <p>El Cliente reconoce y acepta expresamente que la acomodación podrá implicar el uso de habitaciones compartidas con otros participantes del Tour, ya sean conocidos o no, así como el uso de baños privados o compartidos, según disponibilidad del hospedaje.</p>
      <p>Lucitours podrá modificar el hospedaje originalmente previsto, incluyendo cambios de establecimiento, categoría o tipo de habitación, siempre que se mantengan condiciones razonables de servicio dentro del Tour contratado.</p>
      <p>Todo lo anterior estará sujeto a disponibilidad, necesidades operativas del Tour, así como a casos fortuitos o de fuerza mayor.</p>

    <p><strong>SÉPTIMO: CHECK IN Y ASIGNACIÓN DE ASIENTOS.</strong> Lucitours realizará el check in según apertura de aerolínea. La asignación de asientos la realiza la aerolínea de forma aleatoria.</p>
    <p>Equipaje permitido: ${contractVar(data.luggageClause)}</p>

    <p><strong>OCTAVO: SEGURO DE VIAJE.</strong> Lucitours podrá colaborar con la adquisición de seguro de viaje mediante agencia aliada Assist Card, siendo opcional para el Cliente.</p>
    <p>El Cliente acepta que, en caso de no contratar seguro con Lucitours o bien no contar con un seguro viajero propio durante el Tour en este mismo acto, exonera a Lucitours de toda responsabilidad por cualquier accidente, enfermedad, gasto médico, muerte o repatriación.</p>
    <p>Asimismo, el Cliente declara que exime a Lucitours, en este mismo acto y en la medida permitida por ley, de responsabilidad por gastos médicos, hospitalarios, emergencias, cancelaciones, retrasos, pérdida de equipaje u otras contingencias cubribles por el seguro de viaje.</p>

    <p><strong>NOVENO: PERSONAL DE ACOMPAÑAMIENTO.</strong> Dependiendo del Tour, Lucitours podrá asignar personal de acompañamiento desde Costa Rica.</p>
    <p>El Cliente debe presentarse con al menos 3 horas de anticipación al aeropuerto y con toda la documentación requerida para viajar. Lucitours no será responsable por llegada tardía, documentos vencidos o documentación incompleta del Cliente.</p>

    <p><strong>DÉCIMO: FICHA DE ACTIVIDADES E ITINERARIO.</strong></p>
    ${itineraryHtml}
    <p>Lucitours podrá modificar itinerario, ruta, hospedajes u orden del Tour cuando sea necesario para seguridad, resguardo y ejecución efectiva del servicio.</p>

    <p><strong>DÉCIMO PRIMERO: TRANSPORTES.</strong> Lucitours brindará, por medio de terceros contratados, transportes relacionados con el Tour (vehículo privado, microbús, colectivo o transporte público). Todo transporte fuera de itinerario corre por cuenta del Cliente.</p>
    <p><strong>DÉCIMO SEGUNDO: ALIMENTACIÓN.</strong> El Tour no incluye alimentación, salvo indicación expresa en la publicación del tour o bien que el hospedaje indique que se incluye el desayuno con el hospedaje; por lo tanto, el Cliente debe asumir sus costos de alimentación durante el tour.</p>

    <p><strong>DÉCIMO TERCERO: CANCELACIÓN DEL TOUR.</strong> La cancelación del Tour podrá darse por: enfermedad/muerte debidamente justificadas; imposibilidad de prestación por parte del operador; fuerza mayor o caso fortuito; y causas no previstas que imposibiliten la ejecución del Tour.</p>
    <p>En los supuestos que correspondan, Lucitours gestionará reintegros ante terceros operadores y podrá aplicar penalidades conforme políticas de proveedores.</p>

    <p><strong>DÉCIMO CUARTO: DERECHOS Y OBLIGACIONES DEL CLIENTE.</strong> El Cliente se obliga, entre otros, a pagar montos económicos según contrato; brindar documentación veraz y vigente; respetar horarios, itinerarios y normas de proveedores; resguardar pertenencias personales; asumir gastos no incluidos; y gestionar correctamente documentación de menor(es), cuando aplique.</p>

    <p><strong>DÉCIMO QUINTO: DERECHOS Y OBLIGACIONES DE LUCITOURS.</strong> Lucitours se obliga, entre otros, a ejecutar el Tour contratado; contratar y pagar a proveedores del servicio; brindar acompañamiento contractual y soporte operativo; y gestionar check in cuando corresponda.</p>

    <p><strong>DÉCIMO SEXTO: EXONERACIÓN DE RESPONSABILIDAD.</strong> El Cliente exonera a Lucitours por eventos no atribuibles directamente a su gestión, incluyendo, entre otros: enfermedades, accidentes, robos o pérdidas durante el Tour; atrasos, desvío o pérdida de vuelos; cierre de atracciones o condiciones climáticas adversas; eventualidades de terceros proveedores; y problemas por documentación dudosa, falsa, vencida o insuficiente.</p>

    <p><strong>DÉCIMO SÉPTIMO BIS: EMISIÓN DE TIQUETES AÉREOS.</strong> El Cliente reconoce y acepta que la emisión de los tiquetes aéreos forma parte de la gestión operativa del Tour, la cual será realizada por Lucitours conforme a criterios de disponibilidad, condiciones de mercado y coordinación con proveedores.</p>
    <p>En ese sentido, la emisión de los tiquetes aéreos no necesariamente se realizará de forma inmediata al momento del pago de la reserva, pagos parciales o incluso la cancelación total del Tour, pudiendo efectuarse en cualquier momento hasta un plazo máximo de cuarenta y ocho (48) horas previas al inicio del viaje.</p>
    <p>El Cliente entiende y acepta que la confirmación de su espacio dentro del Tour es independiente del momento de emisión de los tiquetes aéreos, y que estos podrán ser adquiridos en una fecha posterior según condiciones operativas y comerciales.</p>
    <p>Lucitours garantiza la prestación del servicio de transporte aéreo conforme a lo contratado, por lo que el Cliente renuncia a cualquier reclamo relacionado exclusivamente con el momento de emisión de los tiquetes, siempre que los mismos sean entregados dentro del plazo indicado y el servicio sea efectivamente brindado.</p>

    <p><strong>DÉCIMO SÉPTIMO: MODIFICACIONES AL CONTRATO.</strong> Toda modificación deberá formalizarse por escrito mediante adenda firmada por las Partes.</p>
    <p><strong>DÉCIMO OCTAVO: RESOLUCIÓN ALTERNA DE CONFLICTOS Y LEY APLICABLE.</strong> Este Contrato se regirá por la legislación de la República de Costa Rica. Cualquier controversia intentará resolverse primero por vía conciliatoria antes de acudir a la vía judicial.</p>
    <p><strong>DÉCIMO NOVENO: CONFIDENCIALIDAD.</strong> Toda información comercial, operativa y documental conocida con ocasión del Contrato será tratada como confidencial durante su vigencia y por un año adicional a su terminación.</p>
      <p><strong>VIGÉSIMO: NOTIFICACIONES Y COMUNICACIONES.</strong></p>
      <ul>
        <li><strong>Lucitours:</strong> contratos@lucitour.com y WhatsApp 6015-9906.</li>
        <li><strong>Cliente:</strong> Dirección ${contractVar(data.clientAddress)}, correo ${contractVar(data.clientEmail)} y teléfono ${contractVar(data.clientPhone)}.</li>
      </ul>
    <p><strong>VIGÉSIMO PRIMERO: INTEGRIDAD CONTRACTUAL.</strong> Las Partes aceptan que este Contrato y sus anexos constituyen el acuerdo total entre ellas respecto del Tour contratado.</p>

    <p>En fe de lo anterior, las Partes declaran haber leído y comprendido integralmente el presente Contrato, aceptándolo en todas sus cláusulas.</p>

    <h3>FIRMAS</h3>
    <p><strong>Número de contrato:</strong> ${escapeHtml(data.contractNumber)}</p>

    <div class="signatures">
      ${clientAndCompanionSignatureBlocks}
      ${erickSignatureBlock}
    </div>
  `;
};

const ensureValidForm = () => {
  if (!form.reportValidity()) {
    throw new Error("Completa los campos obligatorios.");
  }

  const total = toMoney(form.elements.totalAmount.value);
  const reservation = toMoney(form.elements.reservationAmount.value);
  const balance = toMoney(form.elements.balanceAmount.value);
  const installmentCount = Number.parseInt(String(form.elements.installmentCount.value || "0"), 10);

  if (reservation > total) {
    throw new Error("La reserva no puede ser mayor al monto global.");
  }

  if (!Number.isFinite(installmentCount) || installmentCount <= 0) {
    throw new Error("La cantidad de cuotas debe ser mayor a cero.");
  }

  const expectedMonthlyAmount = balance / installmentCount;
  const currentMonthlyAmount = toMoney(form.elements.monthlyInstallmentAmount.value);
  if (Math.abs(expectedMonthlyAmount - currentMonthlyAmount) > 0.01) {
    recalcBalance();
  }

  if (collectItinerary().length === 0) {
    throw new Error("Debes agregar al menos un item de itinerario.");
  }

  if (hasMinorCompanionInput.checked && collectMinors().length === 0) {
    throw new Error("Marcaste menor de edad, pero no agregaste datos del menor.");
  }

};

const renderPreview = () => {
  const data = getFormData();
  previewEl.innerHTML = buildContractHtml(data);

  const annexHtml = buildMinorAnnexHtml(data);
  if (annexHtml) {
    minorAnnexPreview.innerHTML = annexHtml;
    minorAnnexPreview.classList.remove("hidden");
  } else {
    minorAnnexPreview.innerHTML = "";
    minorAnnexPreview.classList.add("hidden");
  }

  statusText.textContent = "Vista previa actualizada.";
  return data;
};

const buildPdfCaptureNode = () => {
  const captureRoot = document.createElement("section");
  const sourceWidth = Math.ceil(previewEl.getBoundingClientRect().width || previewEl.offsetWidth || 980);

  captureRoot.style.position = "fixed";
  captureRoot.style.left = "-10000px";
  captureRoot.style.top = "0";
  captureRoot.style.width = `${sourceWidth}px`;
  captureRoot.style.padding = "0";
  captureRoot.style.margin = "0";
  captureRoot.style.background = "#ffffff";
  captureRoot.style.zIndex = "-1";

  const addPaperClone = (paperEl) => {
    if (!paperEl || paperEl.classList.contains("hidden")) return;
    const clone = paperEl.cloneNode(true);
    clone.style.width = "100%";
    clone.style.margin = "0 0 16px 0";
    clone.style.minHeight = "0";
    clone.style.border = "0";
    clone.style.borderRadius = "0";
    clone.style.boxShadow = "none";
    captureRoot.appendChild(clone);
  };

  addPaperClone(previewEl);
  addPaperClone(minorAnnexPreview);
  document.body.appendChild(captureRoot);

  return captureRoot;
};

const collectClauseBlockRanges = (captureRoot) => {
  const ranges = [];
  const papers = captureRoot.querySelectorAll(".contract-paper");

  papers.forEach((paper) => {
    const headings = Array.from(paper.querySelectorAll("h3"));
    const clausesTitle = headings.find((h3) => /cl[aá]usulas/i.test(h3.textContent || ""));
    if (!clausesTitle) return;

    const clausesTitleIndex = headings.indexOf(clausesTitle);
    const endTitle = headings.slice(clausesTitleIndex + 1).find((h3) => /firmas/i.test(h3.textContent || ""));

    const clauseStarts = [];
    let current = clausesTitle.nextElementSibling;
    while (current && current !== endTitle) {
      if (
        current.tagName === "P" &&
        current.firstElementChild &&
        current.firstElementChild.tagName === "STRONG" &&
        /:\s*/.test(current.firstElementChild.textContent || "")
      ) {
        clauseStarts.push(current);
      }
      current = current.nextElementSibling;
    }

    clauseStarts.forEach((startEl, index) => {
      const nextStart = clauseStarts[index + 1] || endTitle || null;
      const start = Math.max(0, startEl.offsetTop - 10);
      const end = nextStart
        ? Math.max(start + 1, nextStart.offsetTop - 10)
        : Math.max(start + 1, paper.offsetTop + paper.offsetHeight - 10);
      ranges.push({ start, end });
    });
  });

  return ranges;
};

const generatePdfBlob = async (onProgress = () => {}) => {
  debugLog("Inicio de generatePdfBlob");
  onProgress("Validando datos del contrato...");
  ensureValidForm();
  onProgress("Construyendo vista previa para PDF...");
  const data = renderPreview();

  await new Promise((resolve) => setTimeout(resolve, 40));
  onProgress("Renderizando paginas...");
  debugLog("Renderizando html2canvas del contenido de contrato");

  const captureNode = buildPdfCaptureNode();
  const captureHeightCssPx = Math.max(captureNode.scrollHeight, 1);
  const clauseBlockRangesCssPx = collectClauseBlockRanges(captureNode);
  const protectedRangesCssPx = Array.from(captureNode.querySelectorAll(".signature-box--erick")).map((el) => {
    const start = Math.max(0, el.offsetTop - 18);
    const end = Math.min(captureHeightCssPx, el.offsetTop + el.offsetHeight + 18);
    return { start, end };
  });

  const canvas = await window
    .html2canvas(captureNode, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    })
    .finally(() => {
      captureNode.remove();
    });
  debugLog("Canvas renderizado", { width: canvas.width, height: canvas.height });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 26;
  const headerHeight = 18;
  const firstPageHeaderHeight = 64;
  const footerHeight = 24;
  const contentTopInset = 6;
  const contentBottomInset = 12;
  const printableWidth = pageWidth - margin * 2;
  const contentHeight = Math.max(
    1,
    pageHeight - margin * 2 - headerHeight - footerHeight - contentTopInset - contentBottomInset,
  );

  onProgress("Aplicando encabezado y paginacion...");
  const logoImage = await loadImage(lucitoursLogoPath).catch(() => null);
  if (!logoImage) {
    debugLog("No se pudo cargar logo para header; se continua sin logo");
  }

  const scaleToCanvas = canvas.height / captureHeightCssPx;
  const textBlockRangesCssPx = Array.from(captureNode.querySelectorAll("h3, .signature-box")).map((el) => {
    const start = Math.max(0, el.offsetTop - 6);
    const end = Math.min(captureHeightCssPx, el.offsetTop + el.offsetHeight + 6);
    return { start, end };
  });

  const allProtectedRangesCssPx = [...protectedRangesCssPx, ...clauseBlockRangesCssPx, ...textBlockRangesCssPx].sort(
    (a, b) => a.start - b.start,
  );

  const mergedProtectedRangesCssPx = allProtectedRangesCssPx.reduce((acc, range) => {
    const last = acc[acc.length - 1];
    if (!last || range.start > last.end) {
      acc.push({ ...range });
      return acc;
    }
    last.end = Math.max(last.end, range.end);
    return acc;
  }, []);

  const protectedRangesPx = mergedProtectedRangesCssPx.map((range) => ({
    start: Math.floor(range.start * scaleToCanvas),
    end: Math.ceil(range.end * scaleToCanvas),
  }));

  const pxPerPt = canvas.width / printableWidth;
  const pageSliceHeightPx = Math.max(1, Math.floor(contentHeight * pxPerPt));
  const minSliceHeightPx = Math.max(1, Math.floor(pageSliceHeightPx * 0.55));
  const maxSliceHeightPx = Math.max(1, Math.floor(pageSliceHeightPx * 1.45));
  let renderedPx = 0;
  let renderedPages = 0;

  while (renderedPx < canvas.height) {
    let sliceEndPx = Math.min(renderedPx + pageSliceHeightPx, canvas.height);

    for (const range of protectedRangesPx) {
        const rangeHeight = range.end - range.start;
        if (rangeHeight > maxSliceHeightPx) {
          continue;
        }

      const cutsProtectedBlock = range.start < sliceEndPx && range.end > sliceEndPx;
      if (!cutsProtectedBlock) continue;

      const moveUpHeight = range.start - renderedPx;
      if (moveUpHeight >= minSliceHeightPx) {
        sliceEndPx = range.start;
        break;
      }

      const moveDownEnd = Math.min(canvas.height, range.end);
      const moveDownHeight = moveDownEnd - renderedPx;
      if (moveDownHeight <= maxSliceHeightPx || canvas.height - moveDownEnd < minSliceHeightPx) {
        sliceEndPx = moveDownEnd;
      }
      break;
    }

    const sliceHeightPx = Math.max(1, sliceEndPx - renderedPx);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo preparar la pagina PDF.");
    }

    ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    if (renderedPages > 0) {
      pdf.addPage();
    }

    const sliceHeightPt = sliceHeightPx / pxPerPt;
    const isFirstPage = renderedPages === 0;
    const pageHeaderHeight = isFirstPage ? firstPageHeaderHeight : headerHeight;
    pdf.addImage(
      pageCanvas.toDataURL("image/png"),
      "PNG",
      margin,
      margin + pageHeaderHeight + contentTopInset,
      printableWidth,
      sliceHeightPt,
      undefined,
      "FAST",
    );

    renderedPx += sliceHeightPx;
    renderedPages += 1;
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);

    if (page === 1) {
      const logoX = margin;
      const logoY = margin - 1;
      const logoSize = 36;
      if (logoImage) {
        pdf.addImage(logoImage, "PNG", logoX, logoY, logoSize, logoSize);
      }

      const headerRightX = pageWidth - margin;
      pdf.setTextColor(49, 73, 106);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("VIAJES LUCITOURS TURISMO INTERNACIONAL", headerRightX, margin + 13, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("3-101-874546", headerRightX, margin + 29, { align: "right" });
      pdf.text("+506 6015-9906", headerRightX, margin + 44, { align: "right" });
      pdf.text("contratos@lucitour.com", headerRightX, margin + 59, { align: "right" });
    }

    const lineY = margin + (page === 1 ? firstPageHeaderHeight : headerHeight) - 5;
    pdf.setDrawColor(210, 214, 220);
    pdf.line(margin, lineY, pageWidth - margin, lineY);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(90, 98, 112);
    pdf.text(`Pagina ${page} de ${totalPages}`, pageWidth / 2, pageHeight - margin + 8, {
      align: "center",
    });
  }

  const safeName = String(data.clientFullName || "CLIENTE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "");
  const safeContract = String(data.contractNumber || "CONTRATO")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "");

  onProgress("PDF listo para descarga.");
  debugLog("PDF generado", { contractNumber: data.contractNumber });

  return {
    blob: pdf.output("blob"),
    fileName: `CONTRATO-${safeContract}-${safeName}.PDF`,
    contractNumber: data.contractNumber,
  };
};

const downloadBlob = (blob, fileName) => {
  debugLog("Disparando descarga", { fileName, size: blob.size });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const withBusyButton = async (button, fn) => {
  const oldLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Procesando...";
  try {
    await fn();
  } finally {
    button.disabled = false;
    button.textContent = oldLabel;
  }
};

previewButton.addEventListener("click", () => {
  try {
    ensureValidForm();
    renderPreview();
  } catch (error) {
    statusText.textContent = error.message || "No se pudo generar la vista previa.";
  }
});

downloadButton.addEventListener("click", () => {
  withBusyButton(downloadButton, async () => {
    try {
      debugLog("Click en Generar y descargar PDF");
      statusText.textContent = "Generando PDF...";
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const { blob, fileName } = await generatePdfBlob((message) => {
        statusText.textContent = message;
      });

      statusText.textContent = "Descargando PDF...";
      downloadBlob(blob, fileName);
        const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
          await reserveContractNumber(token);
        }
      statusText.textContent = "PDF generado y descargado.";
      debugLog("Descarga completada");
    } catch (error) {
      debugError("Error al generar PDF", error);
      statusText.textContent = error.message || "Error al generar PDF.";
    }
  });
});

emailButton.addEventListener("click", () => {
  try {
    ensureValidForm();
    const data = getFormData();
    const subject = encodeURIComponent(`Contrato para firma - ${data.contractNumber}`);
    const body = encodeURIComponent(
      `Adjuntar PDF generado de contrato ${data.contractNumber}.\nCliente: ${data.clientFullName}.`,
    );
    window.open(`mailto:${data.clientEmail}?subject=${subject}&body=${body}`, "_blank");
    statusText.textContent = "Correo preparado. Adjunta el PDF descargado manualmente.";
  } catch (error) {
    statusText.textContent = error.message || "No se pudo preparar el correo.";
  }
});

waButton.addEventListener("click", () => {
  try {
    ensureValidForm();
    const data = getFormData();
    const text = encodeURIComponent(
      `Hola ${data.clientFullName}, te compartimos tu contrato ${data.contractNumber}. Adjuntaremos el PDF en este chat.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
    statusText.textContent = "WhatsApp preparado. Adjunta el PDF descargado manualmente.";
  } catch (error) {
    statusText.textContent = error.message || "No se pudo preparar WhatsApp.";
  }
});

addCompanionButton.addEventListener("click", () => {
  addCompanionRow();
  refreshTutorOptions();
});

addItineraryButton.addEventListener("click", () => {
  addItineraryRow({
    kind: "custom",
    removable: true,
    date: "",
    detail: "",
  });
});

addMinorButton.addEventListener("click", () => {
  addMinorRow();
  refreshTutorOptions();
});

hasMinorCompanionInput.addEventListener("change", () => {
  syncMinorSectionVisibility();
});

clientNationalitySelect.addEventListener("change", () => {
  const isOther = clientNationalitySelect.value === "Otra opcion";
  clientNationalityOtherWrap.classList.toggle("hidden", !isOther);
});

form.elements.clientFullName.addEventListener("input", () => {
  refreshTutorOptions();
});

companionsContainer.addEventListener("input", (event) => {
  if (event.target && event.target.matches('[data-field="fullName"]')) {
    refreshTutorOptions();
  }
});

form.elements.startDate.addEventListener("change", () => {
  const firstDateInput = itineraryContainer.querySelector('[data-kind="opening"] [data-field="date"]');
  if (firstDateInput) {
    firstDateInput.value = form.elements.startDate.value;
  }
  recalcPaymentDueDate();
});

form.elements.endDate.addEventListener("change", () => {
  const lastDateInput = itineraryContainer.querySelector('[data-kind="closing"] [data-field="date"]');
  if (lastDateInput) {
    lastDateInput.value = form.elements.endDate.value;
  }
});

form.elements.totalAmount.addEventListener("input", () => {
  recalcBalance();
});

form.elements.reservationAmount.addEventListener("input", () => {
  recalcBalance();
});

form.elements.installmentCount.addEventListener("input", () => {
  recalcBalance();
});

const bootstrap = () => {
  setUnauthenticatedUi("Ingresa tus credenciales.");
  downloadButton.removeAttribute("disabled");
  downloadButton.disabled = false;
    form.elements.contractNumber.value = "Generando...";

  const today = new Date().toISOString().slice(0, 10);
  form.elements.issuedAt.value = today;
  form.elements.startDate.value = today;
  form.elements.endDate.value = today;
  recalcPaymentDueDate();
  recalcBalance();
  form.elements.installmentCount.value = "1";
  recalcBalance();
  resetDefaultItinerary();
  syncMinorSectionVisibility();
  clientNationalityOtherWrap.classList.add("hidden");
  statusText.textContent =
      "Lista para uso temporal. El número de contrato se genera desde el backend al iniciar sesión.";
  debugLog("Bootstrap completado");
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const website = String(formData.get("website") || "");

  if (!email || !password) {
    setLoginStatus("Completa correo y contrasena.", true);
    return;
  }

  loginButton.disabled = true;
  setLoginStatus("Iniciando sesion...");

  try {
    const result = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, website }),
    });

    window.localStorage.setItem(AUTH_TOKEN_KEY, result.accessToken);
    currentAuthenticatedUser = result.user;
    setAuthenticatedUi(result.user);
    await reserveContractNumber(result.accessToken);
    setLoginStatus("Sesion iniciada.");
    statusText.textContent = "Sesion iniciada correctamente.";
  } catch (error) {
    setLoginStatus(error.message || "No se pudo iniciar sesion.", true);
    debugError("Login fallido", error);
  } finally {
    loginButton.disabled = false;
  }
});

if (logoutButton) {
  logoutButton.addEventListener("click", handleLogout);
}

setupPasswordToggle();

window.addEventListener("error", (event) => {
  debugError("window.error", event.error || event.message || event);
});

window.addEventListener("unhandledrejection", (event) => {
  debugError("unhandledrejection", event.reason || event);
});

bootstrap();
setupAuth();
