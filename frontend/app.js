const form = document.getElementById("contractForm");
const previewEl = document.getElementById("contractPreview");
const statusText = document.getElementById("statusText");
const previewButton = document.getElementById("previewButton");
const sendAndDownloadButton =
  document.getElementById("sendAndDownloadButton") ||
  document.getElementById("downloadButton") ||
  document.getElementById("emailButton");
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
const reservationAmountError = document.getElementById("reservationAmountError");
const idFrontDocumentInput = document.getElementById("idFrontDocument");
const idBackDocumentInput = document.getElementById("idBackDocument");
const passportDocumentInput = document.getElementById("passportDocument");
const contractDocumentsInput = document.getElementById("contractDocuments");
const historySearchInput = document.getElementById("historySearch");
const historySearchButton = document.getElementById("historySearchButton");
const historyList = document.getElementById("historyList");
const signingLinkActions = document.getElementById("signingLinkActions");
const signingLinkInput = document.getElementById("signingLinkInput");
const openSigningLinkButton = document.getElementById("openSigningLinkButton");
const copySigningLinkButton = document.getElementById("copySigningLinkButton");
const shareSigningLinkButton = document.getElementById("shareSigningLinkButton");
const companionSigningLinksEl = document.getElementById("companionSigningLinks");

const MAX_DOCUMENT_COUNT = 20;
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_TOTAL_BYTES = 25 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const lucitoursLogoPath = "./assets/logo-lucitour.png";
const DEBUG_TAG = "[ContratosTemp]";
const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const LOCAL_DEVELOPMENT_API_BASE = "http://localhost:3001";
const API_BASE = configuredApiBase || (isLocalHost ? LOCAL_DEVELOPMENT_API_BASE : "");
const DEBUG_ENABLED = Boolean(window.APP_CONFIG?.DEBUG);
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
const sessionLiveBadgeEl = document.getElementById("sessionLiveBadge");
const logoutButton = document.getElementById("logoutButton");
let currentAuthenticatedUser = null;
let sessionEventSource = null;
let historySearchDebounce = null;
let latestSigningLinkUrl = "";

const setSessionLiveBadge = (state = "off") => {
  if (!sessionLiveBadgeEl) {
    return;
  }

  const classes = ["state-off", "state-connecting", "state-live", "state-reconnecting"];
  sessionLiveBadgeEl.classList.remove(...classes);

  const labelByState = {
    off: "Sin conexion",
    connecting: "Conectando...",
    live: "Conectado",
    reconnecting: "Reconectando...",
  };

  const stateClass = `state-${state}`;
  sessionLiveBadgeEl.classList.add(classes.includes(stateClass) ? stateClass : "state-off");
  sessionLiveBadgeEl.textContent = labelByState[state] || labelByState.off;
};

const hideSigningLinkActions = () => {
  latestSigningLinkUrl = "";
  if (signingLinkActions) {
    signingLinkActions.classList.add("hidden");
  }
  if (openSigningLinkButton) {
    openSigningLinkButton.setAttribute("href", "#");
  }
  if (signingLinkInput) {
    signingLinkInput.value = "";
  }
  if (shareSigningLinkButton) {
    shareSigningLinkButton.setAttribute("href", "#");
  }
  if (companionSigningLinksEl) {
    companionSigningLinksEl.innerHTML = "";
    companionSigningLinksEl.classList.add("hidden");
  }
};

const buildWhatsappShareUrl = (signingUrl, signerName = "") => {
  const normalizedUrl = String(signingUrl || "").trim();
  const normalizedSigner = String(signerName || "").trim();
  const signerText = normalizedSigner ? ` para ${normalizedSigner}` : "";
  return `https://wa.me/?text=${encodeURIComponent(
    `Hola, te compartimos el enlace para firmar tu contrato de viaje${signerText}: ${normalizedUrl}`,
  )}`;
};

const showSigningLinkActions = (signingUrl, signingLinks = []) => {
  const normalized = String(signingUrl || "").trim();
  if (!normalized) {
    hideSigningLinkActions();
    return;
  }

  latestSigningLinkUrl = normalized;
  if (signingLinkInput) {
    signingLinkInput.value = normalized;
  }
  if (openSigningLinkButton) {
    openSigningLinkButton.setAttribute("href", normalized);
  }

  if (shareSigningLinkButton) {
    const waUrl = buildWhatsappShareUrl(normalized);
    shareSigningLinkButton.setAttribute("href", waUrl);
  }

  if (companionSigningLinksEl) {
    const companions = Array.isArray(signingLinks)
      ? signingLinks.filter((item) => String(item?.signerKey || "") !== "client")
      : [];

    if (companions.length > 0) {
      companionSigningLinksEl.innerHTML = companions
        .map((item) => {
          const url = String(item?.signingUrl || "").trim();
          if (!url) {
            return "";
          }

          const signerName = escapeHtml(item?.signerName || "Acompanante");
          const role = escapeHtml(item?.signerRole || "ACOMPANANTE");
          const shareUrl = buildWhatsappShareUrl(url, item?.signerName || "");

          return `
            <article class="companion-signing-item">
              <p><strong>${signerName}</strong> (${role})</p>
              <label class="full">Link de firma
                <input type="text" readonly value="${escapeAttr(url)}" />
              </label>
              <div class="sign-link-buttons">
                <a class="agent-nav-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">Ver contrato</a>
                <button type="button" class="ghost" data-action="copy-companion-link" data-signing-url="${escapeAttr(url)}">Copiar link</button>
                <a class="agent-nav-link" href="${escapeAttr(shareUrl)}" target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
              </div>
            </article>
          `;
        })
        .join("");
      companionSigningLinksEl.classList.remove("hidden");
    } else {
      companionSigningLinksEl.innerHTML = "";
      companionSigningLinksEl.classList.add("hidden");
    }
  }

  if (signingLinkActions) {
    signingLinkActions.classList.remove("hidden");
  }
};

const setupPasswordToggle = () => {
  if (!loginPasswordInput || !toggleLoginPasswordButton) {
    return;
  }

  toggleLoginPasswordButton.addEventListener("click", () => {
    const isVisible = loginPasswordInput.type === "text";
    loginPasswordInput.type = isVisible ? "password" : "text";
    toggleLoginPasswordButton.textContent = isVisible ? "Mostrar" : "Ocultar";
    toggleLoginPasswordButton.classList.toggle("active", !isVisible);
    toggleLoginPasswordButton.setAttribute("aria-pressed", String(!isVisible));
    toggleLoginPasswordButton.setAttribute("aria-label", isVisible ? "Mostrar contrasena" : "Ocultar contrasena");
    toggleLoginPasswordButton.setAttribute("title", isVisible ? "Mostrar contrasena" : "Ocultar contrasena");
  });
};

const resetContractWorkspace = () => {
  form.reset();
  companionsContainer.innerHTML = "";
  itineraryContainer.innerHTML = "";
  minorsContainer.innerHTML = "";
  hasMinorCompanionInput.checked = false;

  previewEl.innerHTML = "";
  minorAnnexPreview.innerHTML = "";
  minorAnnexPreview.classList.add("hidden");

  const today = new Date().toISOString().slice(0, 10);
  form.elements.contractNumber.value = "Generando...";
  form.elements.issuedAt.value = today;
  form.elements.startDate.value = today;
  form.elements.endDate.value = today;
  form.elements.installmentCount.value = "1";

  clientNationalityOtherWrap.classList.add("hidden");
  if (form.elements.clientNationalityOther) {
    form.elements.clientNationalityOther.required = false;
    form.elements.clientNationalityOther.value = "";
    form.elements.clientNationalityOther.setCustomValidity("");
    markFieldValidity(form.elements.clientNationalityOther);
  }
  if (reservationAmountError) {
    reservationAmountError.textContent = "";
    reservationAmountError.classList.add("hidden");
  }
  recalcPaymentDueDate();
  recalcBalance();
  resetDefaultItinerary();
  syncMinorSectionVisibility();
  refreshTutorOptions();
};

const setReservationInlineMessage = (message = "") => {
  if (!reservationAmountError) {
    return;
  }

  const normalized = String(message || "").trim();
  reservationAmountError.textContent = normalized;
  reservationAmountError.classList.toggle("hidden", !normalized);
};

const markFieldValidity = (field) => {
  if (!field || !(field instanceof HTMLElement)) {
    return;
  }

  if ("validity" in field && !field.validity.valid) {
    field.setAttribute("aria-invalid", "true");
  } else {
    field.removeAttribute("aria-invalid");
  }
};

const prepareNextContract = async (token) => {
  resetContractWorkspace();
  if (token) {
    await reserveContractNumber(token);
  }
};

const escapeAttr = (value) => String(value || "").replace(/"/g, "&quot;");

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderHistory = (items = []) => {
  if (!historyList) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No se encontraron contratos.</p>';
    return;
  }

  historyList.innerHTML = items
    .map(
      (item) => `
        <article class="history-item">
          <div class="history-item-head">
            <p class="history-item-title">${escapeHtml(item.contractNumber)}</p>
            <p class="history-item-sub">${escapeHtml(formatDateTime(item.createdAt))}</p>
          </div>
          <p class="history-item-sub">Cliente: ${escapeHtml(item.clientFullName)}</p>
          <div class="history-item-meta">
            <span>ID: ${escapeHtml(item.clientIdNumber)}</span>
            <span>Correo: ${escapeHtml(item.clientEmail)}</span>
            <span>Destino: ${escapeHtml(item.destination || "-")}</span>
            <span>Adjuntos: ${escapeHtml(String(item.documentCount || 0))}</span>
          </div>
          <div class="history-item-actions">
            <button type="button" class="ghost" data-action="files" data-contract-id="${escapeAttr(item.id)}">Ver archivos</button>
            ${
              String(item.status || "").toUpperCase() === "SIGNED"
                ? `<button type="button" class="ghost" data-action="resend-signed" data-contract-id="${escapeAttr(
                    item.id,
                  )}">Reenviar firmado</button>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");
};

const loadContractHistory = async (query = "") => {
  if (!historyList) {
    return;
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    historyList.innerHTML = '<p class="history-empty">Inicia sesion para ver historial.</p>';
    return;
  }

  historyList.innerHTML = '<p class="history-empty">Cargando historial...</p>';
  try {
    const params = new URLSearchParams();
    const q = String(query || "").trim();
    if (q) params.set("q", q);
    params.set("limit", "40");
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const result = await apiFetch(`/contracts${suffix}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    renderHistory(result.items || []);
  } catch (error) {
    debugError("No se pudo cargar historial", error);
    historyList.innerHTML = '<p class="history-empty">No se pudo cargar el historial.</p>';
  }
};

const openContractFiles = async (contractId) => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error("Sesion no activa.");
  }

  const files = await apiFetch(`/contracts/${contractId}/files`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (files?.pdf?.url) {
    window.open(files.pdf.url, "_blank", "noopener,noreferrer");
  }

  if (Array.isArray(files?.documents)) {
    files.documents.forEach((doc) => {
      if (doc?.url) {
        window.open(doc.url, "_blank", "noopener,noreferrer");
      }
    });
  }
};

const resendSignedContract = async (contractId) => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error("Sesion no activa.");
  }

  return apiFetch(`/contracts/${contractId}/resend-signed-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

const showResendSignedSummary = (result) => {
  const sent = Array.isArray(result?.sentTo) ? result.sentTo : [];
  const failed = Array.isArray(result?.failedTo) ? result.failedTo : [];
  const contractNumber = String(result?.contractNumber || "").trim() || "-";

  const lines = [
    `Contrato: ${contractNumber}`,
    `Enviados: ${sent.length}`,
    `Fallidos: ${failed.length}`,
  ];

  if (sent.length) {
    lines.push("", "Correos enviados:", ...sent.map((email) => `- ${email}`));
  }

  if (failed.length) {
    lines.push("", "Correos con fallo:", ...failed.map((email) => `- ${email}`));
  }

  window.alert(lines.join("\n"));
};

const blobToFile = (blob, fileName, mimeType) =>
  new File([blob], fileName, {
    type: mimeType,
    lastModified: Date.now(),
  });

const withFilePrefix = (file, prefix) =>
  new File([file], `${prefix}-${file.name}`, {
    type: file.type,
    lastModified: file.lastModified || Date.now(),
  });

const toWebpFile = async (file) => {
  const imageBitmap = await createImageBitmap(file);
  const maxEdge = 2000;
  const width = imageBitmap.width;
  const height = imageBitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    imageBitmap.close();
    throw new Error("No se pudo preparar la compresion de imagen.");
  }

  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close();

  const webpBlob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo convertir la imagen a WEBP."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      0.82,
    );
  });

  const baseName = String(file.name || "imagen")
    .replace(/\.[^.]+$/u, "")
    .trim();
  const safeBase = baseName || "imagen";
  return blobToFile(webpBlob, `${safeBase}.webp`, "image/webp");
};

const prepareDocumentAttachments = async (fileList) => {
  const files = Array.from(fileList || []);

  const prepared = [];

  for (const originalFile of files) {
    const mimeType = String(originalFile.type || "").toLowerCase();
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
      throw new Error("Solo se permiten PDF, JPG, PNG o WEBP en adjuntos.");
    }

    let fileToUpload = originalFile;
    if (mimeType === "image/jpeg" || mimeType === "image/png") {
      fileToUpload = await toWebpFile(originalFile);
    }

    if (fileToUpload.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error(`El archivo ${fileToUpload.name} supera 5 MB.`);
    }

    prepared.push(fileToUpload);
  }

  return prepared;
};

const collectAllContractDocuments = async () => {
  const groups = [];
  
  // Documentos del titular (de la sección "Adjuntos del contrato")
  if (idFrontDocumentInput?.files?.[0]) {
    groups.push({ prefix: "titular-cedula-frente", files: [idFrontDocumentInput.files[0]] });
  }
  if (idBackDocumentInput?.files?.[0]) {
    groups.push({ prefix: "titular-cedula-reverso", files: [idBackDocumentInput.files[0]] });
  }
  if (passportDocumentInput?.files?.[0]) {
    groups.push({ prefix: "titular-pasaporte", files: [passportDocumentInput.files[0]] });
  }
  
  // Documentos de cada acompañante
  const companionCards = companionsContainer.querySelectorAll(".dynamic-card");
  companionCards.forEach((card, index) => {
    const companionIndex = index + 1;
    const idFront = card.querySelector('[data-field="idFrontDocument"]');
    const idBack = card.querySelector('[data-field="idBackDocument"]');
    const passport = card.querySelector('[data-field="passportDocument"]');
    
    if (idFront?.files?.[0]) {
      groups.push({ prefix: `acompanante${companionIndex}-cedula-frente`, files: [idFront.files[0]] });
    }
    if (idBack?.files?.[0]) {
      groups.push({ prefix: `acompanante${companionIndex}-cedula-reverso`, files: [idBack.files[0]] });
    }
    if (passport?.files?.[0]) {
      groups.push({ prefix: `acompanante${companionIndex}-pasaporte`, files: [passport.files[0]] });
    }
  });
  
  // Documentos de cada menor y su tutor
  const minorCards = minorsContainer.querySelectorAll(".dynamic-card");
  minorCards.forEach((card, index) => {
    const minorIndex = index + 1;
    
    // Documentos del menor
    const minorIdFront = card.querySelector('[data-field="minorIdFrontDocument"]');
    const minorIdBack = card.querySelector('[data-field="minorIdBackDocument"]');
    const minorPassport = card.querySelector('[data-field="minorPassportDocument"]');
    
    if (minorIdFront?.files?.[0]) {
      groups.push({ prefix: `menor${minorIndex}-cedula-frente`, files: [minorIdFront.files[0]] });
    }
    if (minorIdBack?.files?.[0]) {
      groups.push({ prefix: `menor${minorIndex}-cedula-reverso`, files: [minorIdBack.files[0]] });
    }
    if (minorPassport?.files?.[0]) {
      groups.push({ prefix: `menor${minorIndex}-pasaporte`, files: [minorPassport.files[0]] });
    }
    
    // Documentos del tutor
    const tutorIdFront = card.querySelector('[data-field="tutorIdFrontDocument"]');
    const tutorIdBack = card.querySelector('[data-field="tutorIdBackDocument"]');
    const tutorPassport = card.querySelector('[data-field="tutorPassportDocument"]');
    
    if (tutorIdFront?.files?.[0]) {
      groups.push({ prefix: `menor${minorIndex}-tutor-cedula-frente`, files: [tutorIdFront.files[0]] });
    }
    if (tutorIdBack?.files?.[0]) {
      groups.push({ prefix: `menor${minorIndex}-tutor-cedula-reverso`, files: [tutorIdBack.files[0]] });
    }
    if (tutorPassport?.files?.[0]) {
      groups.push({ prefix: `menor${minorIndex}-tutor-pasaporte`, files: [tutorPassport.files[0]] });
    }
  });
  
  // Documentos de reserva inicial (mantener los viejos campos por compatibilidad)
  if (idFrontDocumentInput?.files?.[0]) {
    groups.push({ prefix: "cedula-frente", files: [idFrontDocumentInput.files[0]] });
  }
  if (idBackDocumentInput?.files?.[0]) {
    groups.push({ prefix: "cedula-reverso", files: [idBackDocumentInput.files[0]] });
  }
  if (passportDocumentInput?.files?.[0]) {
    groups.push({ prefix: "pasaporte", files: [passportDocumentInput.files[0]] });
  }
  if (contractDocumentsInput?.files) {
    groups.push({ prefix: "soporte", files: Array.from(contractDocumentsInput.files) });
  }

  const allPrepared = [];
  for (const group of groups) {
    if (!group.files.length) {
      continue;
    }
    const prepared = await prepareDocumentAttachments(group.files);
    prepared.forEach((file) => {
      allPrepared.push(withFilePrefix(file, group.prefix));
    });
  }

  if (allPrepared.length > MAX_DOCUMENT_COUNT) {
    throw new Error(`Solo puedes adjuntar hasta ${MAX_DOCUMENT_COUNT} archivos.`);
  }

  const totalSize = allPrepared.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_DOCUMENT_TOTAL_BYTES) {
    throw new Error("El total de adjuntos supera 25 MB.");
  }

  return allPrepared;
};

const handleLogout = () => {
  stopSessionStream();
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  currentAuthenticatedUser = null;
  loginForm.reset();
  resetContractWorkspace();
  setUnauthenticatedUi("Sesion cerrada. Ingresa tus credenciales.");
  statusText.textContent = "Sesion cerrada correctamente.";

  const emailInput = loginForm.querySelector('input[name="email"]');
  if (emailInput) {
    emailInput.focus();
  }

  if (historyList) {
    historyList.innerHTML = '<p class="history-empty">Inicia sesion para ver historial.</p>';
  }
  hideSigningLinkActions();
};

const stopSessionStream = () => {
  if (sessionEventSource) {
    sessionEventSource.close();
    sessionEventSource = null;
  }

  setSessionLiveBadge("off");
};

const startSessionStream = (token) => {
  stopSessionStream();

  const normalizedToken = String(token || "").trim();
  if (!normalizedToken || !API_BASE || typeof window.EventSource === "undefined") {
    setSessionLiveBadge("off");
    return;
  }

  const streamUrl = `${API_BASE}/auth/session-stream?token=${encodeURIComponent(normalizedToken)}`;
  const source = new EventSource(streamUrl);
  sessionEventSource = source;
  setSessionLiveBadge("connecting");

  source.addEventListener("heartbeat", () => {
    setSessionLiveBadge("live");
  });

  source.addEventListener("session-replaced", () => {
    stopSessionStream();
    invalidateSessionFromServer("Tu sesion fue cerrada porque se inicio en otra maquina.");
  });

  source.addEventListener("session-invalid", () => {
    stopSessionStream();
    invalidateSessionFromServer("Tu sesion ya no es valida. Inicia sesion nuevamente.");
  });

  // EventSource reintenta automaticamente cuando la conexion se corta.
  source.addEventListener("error", () => {
    const activeToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!activeToken || activeToken !== normalizedToken) {
      stopSessionStream();
      return;
    }

    setSessionLiveBadge("reconnecting");
  });
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
  if (!DEBUG_ENABLED) return;
  console.log(DEBUG_TAG, ...args);
};

const debugError = (...args) => {
  if (!DEBUG_ENABLED) return;
  console.error(DEBUG_TAG, ...args);
};

const setLoginStatus = (message, isError = false) => {
  loginStatus.textContent = message;
  loginStatus.classList.toggle("error", isError);
};

const setAuthenticatedUi = (user) => {
  loginGate.style.display = "none";
  layoutEl.style.display = "grid";
  layoutEl.style.setProperty("display", "grid", "important");
  loginGate.style.setProperty("display", "none", "important");
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
  loginGate.style.setProperty("display", "grid", "important");
  layoutEl.style.setProperty("display", "none", "important");
  if (sessionControlsEl) {
    sessionControlsEl.classList.add("hidden");
  }
  if (badgeEl) {
    badgeEl.textContent = "";
  }
  setLoginStatus(message);
};

const invalidateSessionFromServer = (message = "Tu sesion expiro. Inicia sesion nuevamente.") => {
  stopSessionStream();
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  currentAuthenticatedUser = null;
  loginForm.reset();
  resetContractWorkspace();
  setUnauthenticatedUi(message);
  statusText.textContent = message;
  hideSigningLinkActions();

  const emailInput = loginForm.querySelector('input[name="email"]');
  if (emailInput) {
    emailInput.focus();
  }
};

const apiFetch = async (path, options = {}) => {
  if (!API_BASE) {
    throw new Error("No hay API configurada. Define APP_CONFIG.API_BASE en config.js.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") {
      invalidateSessionFromServer("Tu sesion fue cerrada porque se inicio en otra maquina.");
    }
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
  // No mostrar UI de login hasta verificar si hay token válido
  const existingToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
  
  if (!existingToken) {
    setUnauthenticatedUi("Ingresa tus credenciales.");
    return;
  }

  // Si hay token, verificar su validez ANTES de cambiar UI
  try {
    const user = await validateSession(existingToken);
    currentAuthenticatedUser = user;
    setAuthenticatedUi(user);
    startSessionStream(existingToken);
    await prepareNextContract(existingToken);
    await loadContractHistory(historySearchInput?.value || "");
    setLoginStatus("Sesion activa.");
  } catch (error) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    currentAuthenticatedUser = null;
    setUnauthenticatedUi("Tu sesion expiro. Inicia sesion nuevamente.");
    debugError("Sesion invalida", error);
  }
};

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

const CIVIL_STATUS_OPTIONS = ["Soltero", "Viudo", "Divorciado", "Casado"];

const normalizeIdTypeLabel = (value) => {
  const normalized = String(value || "").trim();
  const lowercase = normalized.toLowerCase();
  if (lowercase === "cedula" || lowercase === "cédula") {
    return "Cédula";
  }
  return normalized;
};

const normalizeCivilStatusLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const match = CIVIL_STATUS_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return match || "Soltero";
};

const nationalityOptionsHtml = (selectedValue = "") =>
  NATIONALITY_OPTIONS.map(
    (option) =>
      `<option value="${escapeHtml(option)}" ${selectedValue === option ? "selected" : ""}>${escapeHtml(option)}</option>`,
  ).join("");

const civilStatusOptionsHtml = (selectedValue = "") => {
  const normalizedSelected = normalizeCivilStatusLabel(selectedValue);
  return CIVIL_STATUS_OPTIONS.map(
    (option) =>
      `<option value="${escapeHtml(option)}" ${normalizedSelected === option ? "selected" : ""}>${escapeHtml(option)}</option>`,
  ).join("");
};

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
  const companionIndex = companionsContainer.children.length;
  const row = document.createElement("div");
  row.className = "dynamic-card";
  row.innerHTML = `
    <div class="card-row">
      <h4>Acompañante ${companionIndex + 1}</h4>
      <button type="button" class="ghost remove-row">Eliminar</button>
    </div>
    <div class="card-grid">
      <label>Nombre completo<input data-field="fullName" value="${escapeHtml(initial.fullName || "")}" required /></label>
      <label>Tipo ID
        <select data-field="idType" required>
          <option value="Cédula" ${["Cedula", "Cédula"].includes(initial.idType) ? "selected" : ""}>Cédula</option>
          <option value="Pasaporte" ${initial.idType === "Pasaporte" ? "selected" : ""}>Pasaporte</option>
          <option value="DIMEX" ${initial.idType === "DIMEX" ? "selected" : ""}>DIMEX</option>
        </select>
      </label>
      <label>Numero ID<input data-field="idNumber" value="${escapeHtml(initial.idNumber || "")}" required /></label>
      <label>Correo<input data-field="email" type="email" value="${escapeHtml(initial.email || "")}" required /></label>
      <label>Telefono<input data-field="phone" value="${escapeHtml(initial.phone || "")}" required /></label>
      <label>Contacto emergencia<input data-field="emergencyContactName" value="${escapeHtml(
        initial.emergencyContactName || "",
      )}" required /></label>
      <label>Telefono emergencia<input data-field="emergencyContactPhone" value="${escapeHtml(
        initial.emergencyContactPhone || "",
      )}" required /></label>
      <label>Direccion<input data-field="address" value="${escapeHtml(initial.address || "")}" required /></label>
      <label>Estado civil
        <select data-field="civilStatus" required>
          ${civilStatusOptionsHtml(initial.civilStatus || "Soltero")}
        </select>
      </label>
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
    
    <div class="card-subsection">
      <h5>Documentos</h5>
      <div class="card-grid">
        <label>Cédula (frente)
          <input data-field="idFrontDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
        <label>Cédula (reverso)
          <input data-field="idBackDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
        <label>Pasaporte
          <input data-field="passportDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
      </div>
    </div>
  `;

  const nationalitySelect = row.querySelector('[data-field="nationality"]');
  const nationalityOtherInput = row.querySelector('[data-field="nationalityOther"]');
  const nationalityOtherWrap = row.querySelector('[data-field-wrap="nationalityOther"]');
  const syncCompanionNationality = () => {
    const isOther = nationalitySelect.value === "Otra opcion";
    nationalityOtherWrap.classList.toggle("hidden", !isOther);

    if (nationalityOtherInput) {
      nationalityOtherInput.required = isOther;
      if (!isOther) {
        nationalityOtherInput.value = "";
        nationalityOtherInput.setCustomValidity("");
        markFieldValidity(nationalityOtherInput);
      }
    }
  };
  nationalitySelect.addEventListener("change", syncCompanionNationality);
  syncCompanionNationality();

  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    refreshTutorOptions();
    renumberCompanions();
  });

  companionsContainer.appendChild(row);
};

const addMinorRow = (initial = {}) => {
  const minorIndex = minorsContainer.children.length;
  const row = document.createElement("div");
  row.className = "dynamic-card";
  row.innerHTML = `
    <div class="card-row">
      <h4>Menor ${minorIndex + 1}</h4>
      <button type="button" class="ghost remove-row">Eliminar</button>
    </div>
    <div class="card-grid">
      <label>Nombre del menor<input data-field="minorName" value="${escapeHtml(initial.minorName || "")}" required /></label>
      <label>Identificacion del menor<input data-field="minorId" value="${escapeHtml(initial.minorId || "")}" required /></label>
      <label>Nombre del tutor legal<input data-field="tutorName" value="${escapeHtml(initial.tutorName || "")}" required /></label>
      <label>Tipo ID tutor legal
        <select data-field="tutorIdType" required>
          <option value="Cédula" ${["Cedula", "Cédula"].includes(initial.tutorIdType) ? "selected" : ""}>Cédula</option>
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
    
    <div class="card-subsection">
      <h5>Documentos del menor</h5>
      <div class="card-grid">
        <label>Cédula menor (frente)
          <input data-field="minorIdFrontDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
        <label>Cédula menor (reverso)
          <input data-field="minorIdBackDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
        <label>Pasaporte menor
          <input data-field="minorPassportDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
      </div>
    </div>
    
    <div class="card-subsection">
      <h5>Documentos del tutor legal</h5>
      <div class="card-grid">
        <label>Cédula tutor (frente)
          <input data-field="tutorIdFrontDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
        <label>Cédula tutor (reverso)
          <input data-field="tutorIdBackDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
        <label>Pasaporte tutor
          <input data-field="tutorPassportDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </label>
      </div>
    </div>
  `;

  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    syncMinorSectionVisibility();
    renumberMinors();
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
      <label>Detalle<input data-field="detail" value="${escapeHtml(initial.detail || "")}" placeholder="Tour a X lugar" required /></label>
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
    syncItineraryDateBounds();
    return;
  }

  itineraryContainer.appendChild(row);
  syncItineraryDateBounds();
};

const getTourDateRange = () => {
  const startDate = String(form.elements.startDate.value || "").trim();
  const endDate = String(form.elements.endDate.value || "").trim();
  return { startDate, endDate };
};

const syncItineraryDateBounds = (autocorrect = false) => {
  const { startDate, endDate } = getTourDateRange();
  const dateInputs = itineraryContainer.querySelectorAll('[data-field="date"]');

  dateInputs.forEach((input) => {
    input.min = startDate || "";
    input.max = endDate || "";

    const value = String(input.value || "").trim();
    if (!value || !startDate || !endDate) {
      input.setCustomValidity("");
      return;
    }

    if (value < startDate || value > endDate) {
      if (autocorrect) {
        input.value = value < startDate ? startDate : endDate;
        input.setCustomValidity("");
      } else {
        input.setCustomValidity("La fecha de itinerario debe estar dentro del rango del viaje.");
      }
    } else {
      input.setCustomValidity("");
    }
  });
};

const recalcBalance = () => {
  enforceReservationLimit(true);

  const total = toMoney(form.elements.totalAmount.value);
  const reservation = toMoney(form.elements.reservationAmount.value);
  const balance = Math.max(total - reservation, 0);
  form.elements.balanceAmount.value = formatMoney(balance);

  const installmentCount = Number.parseInt(String(form.elements.installmentCount.value || "1"), 10);
  const safeCount = Number.isFinite(installmentCount) && installmentCount > 0 ? installmentCount : 1;
  const monthlyAmount = balance / safeCount;
  form.elements.monthlyInstallmentAmount.value = formatMoney(monthlyAmount);
};

const enforceReservationLimit = (autocorrect = false) => {
  const total = toMoney(form.elements.totalAmount.value);
  const reservationInput = form.elements.reservationAmount;
  reservationInput.max = String(total);

  const reservation = toMoney(reservationInput.value);
  if (autocorrect && reservation > total) {
    reservationInput.value = formatMoney(total);
    setReservationInlineMessage("La reserva no puede superar el monto total. Se ajusto automaticamente.");
  }

  const normalizedReservation = toMoney(reservationInput.value);
  if (normalizedReservation > total) {
    reservationInput.setCustomValidity("La reserva no puede ser mayor al monto total.");
    markFieldValidity(reservationInput);
    setReservationInlineMessage("La reserva no puede ser mayor al monto total.");
  } else {
    reservationInput.setCustomValidity("");
    markFieldValidity(reservationInput);
    setReservationInlineMessage("");
  }
};

const hardClampReservation = () => {
  enforceReservationLimit(true);
  recalcBalance();
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

const renumberCompanions = () => {
  const cards = companionsContainer.querySelectorAll(".dynamic-card");
  cards.forEach((card, index) => {
    const h4 = card.querySelector("h4");
    if (h4) {
      h4.textContent = `Acompañante ${index + 1}`;
    }
  });
};

const renumberMinors = () => {
  const cards = minorsContainer.querySelectorAll(".dynamic-card");
  cards.forEach((card, index) => {
    const h4 = card.querySelector("h4");
    if (h4) {
      h4.textContent = `Menor ${index + 1}`;
    }
  });
};

const collectCompanions = () =>
  Array.from(companionsContainer.querySelectorAll(".dynamic-card")).map((card) => ({
    fullName: card.querySelector('[data-field="fullName"]').value.trim(),
    idType: normalizeIdTypeLabel(card.querySelector('[data-field="idType"]').value),
    idNumber: card.querySelector('[data-field="idNumber"]').value.trim(),
    email: card.querySelector('[data-field="email"]').value.trim(),
    phone: card.querySelector('[data-field="phone"]').value.trim(),
    emergencyContactName: card.querySelector('[data-field="emergencyContactName"]').value.trim(),
    emergencyContactPhone: card.querySelector('[data-field="emergencyContactPhone"]').value.trim(),
    address: card.querySelector('[data-field="address"]').value.trim(),
    civilStatus: normalizeCivilStatusLabel(card.querySelector('[data-field="civilStatus"]').value),
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
    tutorIdType: normalizeIdTypeLabel(card.querySelector('[data-field="tutorIdType"]').value),
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
    clientIdType: normalizeIdTypeLabel(formData.get("clientIdType")),
    clientIdNumber: formData.get("clientIdNumber"),
    clientEmail: formData.get("clientEmail"),
    clientPhone: formData.get("clientPhone"),
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    clientAddress: formData.get("clientAddress"),
    civilStatus: normalizeCivilStatusLabel(formData.get("civilStatus")),
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
  const contractDestinationUpper = String(data.destination || "").trim().toLocaleUpperCase("es-CR");

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
                )}, teléfono ${contractVar(person.phone)}, contacto de emergencia ${contractVar(
                person.emergencyContactName,
                )}, teléfono de emergencia ${contractVar(person.emergencyContactPhone)}.</li>`,
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
      signerKey: "client",
      name: data.clientFullName,
      idType: data.clientIdType,
      idNumber: data.clientIdNumber,
      role: "Cliente",
      isClient: true,
    },
    ...data.companions.map((person, index) => ({
      signerKey: `companion-${index}`,
      name: person.fullName,
      idType: person.idType,
      idNumber: person.idNumber,
      role: "Acompañante",
      isClient: false,
    })),
  ]
    .map(
      (person) => `
      <div class="signature-box signature-box--person">
        <div class="signature-sign-area" data-signer-key="${escapeAttr(
          person.signerKey,
        )}" aria-hidden="true">
          <span class="signature-sign-label">${person.isClient ? "Firma del cliente" : "Firma del acompa\u00f1ante"}</span>
        </div>
          <p><strong>${contractVar(person.name)}</strong></p>
          <p>${contractVar(person.idType)}: ${contractVar(person.idNumber)}</p>
          <p>${contractVar(person.role)}</p>
          <p>Fecha: ${contractVar(signatureDate)}</p>
      </div>
    `,
    )
    .join("");

  const erickSignatureBlock = `
    <div class="signature-box signature-box--erick">
        <div class="signature-sign-area signature-sign-area--erick" aria-hidden="true">
          <img src="./assets/firmaerick.png" alt="Firma de Erick Bonilla" />
        </div>
      <p><strong>ERICK JOSUE BONILLA PEREIRA</strong></p>
      <p>Cédula de identidad: 1-1597-0559</p>
      <p>Representante legal de Lucitours</p>
        <p>Fecha: ${contractVar(signatureDate)}</p>
    </div>
  `;

  return `
      <h3>CONTRATO GENERAL DE VIAJE TURÍSTICO A ${contractVar(contractDestinationUpper)}</h3>
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
    )}, teléfono ${contractVar(data.clientPhone)}, contacto de emergencia ${contractVar(
    data.emergencyContactName,
    )}, teléfono de emergencia ${contractVar(data.emergencyContactPhone)}, en adelante denominado como el "Cliente".
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

    <p><strong>DÉCIMO TERCERO: CANCELACIONES, REEMBOLSOS, CRÉDITOS Y FUERZA MAYOR.</strong></p>
    <p><strong>13.1 Política de Reembolsos y Plazos de Devolución.</strong> En caso de que proceda un reembolso total o parcial por cualquier concepto relacionado con los servicios contratados, el Cliente acepta y reconoce que Lucitours dispondrá de un plazo mínimo de tres (3) meses y máximo de seis (6) meses calendario para efectuar dicha devolución. El plazo comenzará a computarse a partir de la fecha en que Lucitours confirme formalmente la procedencia del reembolso.</p>
    <p>El Cliente acepta que este plazo responde a la operativa del sector turístico, incluyendo procesos de recuperación de fondos con terceros proveedores como aerolíneas, hoteles, operadores y servicios internacionales, los cuales no dependen directamente de Lucitours. El Cliente renuncia expresamente a cualquier reclamación adicional, intereses, indemnización o penalización relacionada con el tiempo de espera dentro del plazo establecido.</p>
    <p><strong>13.2 Política de Créditos a Favor (Voucher).</strong> Como alternativa al reembolso, Lucitours podrá ofrecer al Cliente un crédito a favor (voucher) equivalente al monto pagado, utilizable en futuros viajes, servicios o experiencias ofrecidas por la agencia. Este crédito tendrá una vigencia de hasta doce (12) meses y será transferible previa autorización de Lucitours. La aceptación del crédito por parte del Cliente implica la renuncia al reembolso en dinero.</p>
    <p><strong>13.3 Responsabilidad frente a Terceros Proveedores.</strong> Lucitours actúa como intermediario entre el Cliente y terceros proveedores (incluyendo, pero no limitado a, aerolíneas, hoteles, operadores turísticos y transportistas). Por lo tanto, Lucitours no será responsable por cancelaciones, retrasos, modificaciones, pérdidas o incumplimientos atribuibles a dichos proveedores. Cualquier gestión de reembolso estará sujeta a las políticas y tiempos de respuesta de estos terceros.</p>
    <p><strong>13.4 Cancelaciones por Parte del Cliente.</strong> En caso de cancelación voluntaria por parte del Cliente, los montos pagados podrán estar sujetos a penalidades, cargos administrativos y condiciones de los proveedores. Si la cancelación se realiza con menos de veintidós (22) días calendario de antelación a la fecha de inicio del viaje, aplicará una penalidad equivalente al diez por ciento (10%) del valor total del contrato. Lucitours no garantiza reembolsos en estos casos, pudiendo ofrecer únicamente créditos a favor según la evaluación del caso.</p>
    <p><strong>13.5 Fuerza Mayor.</strong> Lucitours no será responsable por la imposibilidad total o parcial de prestar los servicios contratados cuando esto se deba a causas de fuerza mayor, incluyendo pero no limitado a: pandemias, conflictos políticos, desastres naturales, restricciones gubernamentales, huelgas, cancelaciones masivas o cualquier evento fuera del control razonable de la agencia. En estos casos, Lucitours podrá reprogramar el servicio o emitir un crédito a favor, sin obligación inmediata de reembolso.</p>
    <p><strong>13.6 Aceptación de Condiciones.</strong> Al contratar los servicios, el Cliente declara haber leído, entendido y aceptado todas las condiciones de esta cláusula, incluyendo tiempos de reembolso, políticas de crédito y limitaciones de responsabilidad.</p>

    <p><strong>DÉCIMO CUARTO: DERECHOS Y OBLIGACIONES DEL CLIENTE.</strong> El Cliente se obliga, entre otros, a pagar montos económicos según contrato; brindar documentación veraz y vigente; respetar horarios, itinerarios y normas de proveedores; resguardar pertenencias personales; asumir gastos no incluidos; y gestionar correctamente documentación de menor(es), cuando aplique.</p>

    <p><strong>DÉCIMO CUARTO BIS: CONDUCTA Y NORMAS DEL CLIENTE.</strong> El Cliente se compromete a mantener una conducta respetuosa, adecuada y alineada con las normas de convivencia durante todo el desarrollo del tour, tanto con el personal de la Agencia como con otros participantes, proveedores y terceros.</p>
    <p>Queda estrictamente prohibido cualquier comportamiento que implique agresión verbal o física, discriminación, acoso, consumo excesivo de sustancias que afecten la convivencia, incumplimiento de normas locales o cualquier acción que ponga en riesgo la operación del tour o la experiencia del grupo.</p>
    <p>LUCI TOURS TURISMO INTERNACIONAL S.A. se reserva el derecho de excluir, sin derecho a reembolso alguno, a cualquier Cliente cuya conducta sea considerada inapropiada, riesgosa o perjudicial para el desarrollo del tour o la experiencia de terceros.</p>
    <p>Asimismo, cualquier gasto adicional derivado de dicha exclusión será asumido en su totalidad por el Cliente.</p>

    <p><strong>DÉCIMO QUINTO: DERECHOS Y OBLIGACIONES DE LUCITOURS.</strong> Lucitours se obliga, entre otros, a ejecutar el Tour contratado; contratar y pagar a proveedores del servicio; brindar acompañamiento contractual y soporte operativo; y gestionar check in cuando corresponda.</p>

    <p><strong>DÉCIMO SEXTO: EXONERACIÓN Y LIMITACIÓN DE RESPONSABILIDAD.</strong> El Cliente reconoce y acepta que la participación en el tour implica riesgos inherentes propios de los viajes nacionales e internacionales, incluyendo, pero no limitado a, condiciones climáticas adversas, retrasos, cancelaciones, accidentes, enfermedades, situaciones políticas, sociales o sanitarias, y cualquier otro evento fuera del control razonable de la Agencia.</p>
    <p>En consecuencia, el Cliente exonera expresa e irrevocablemente a LUCI TOURS TURISMO INTERNACIONAL S.A. de toda responsabilidad por daños, pérdidas, lesiones, gastos médicos, retrasos, modificaciones de itinerario, pérdida de equipaje, o cualquier otra contingencia que pueda surgir durante el desarrollo del tour, cuando estos no sean atribuibles directamente a dolo o culpa grave comprobada de la Agencia.</p>
    <p>Asimismo, el Cliente acepta que la Agencia no garantiza resultados subjetivos del viaje, tales como satisfacción personal, experiencias individuales, condiciones climáticas específicas, calidad percibida de servicios de terceros, ni expectativas personales no estipuladas expresamente en el presente contrato.</p>
    <p>La responsabilidad total de la Agencia, en cualquier caso comprobado, se limitará exclusivamente al monto efectivamente pagado por el Cliente por los servicios contratados.</p>

    <p><strong>DÉCIMO SÉPTIMO: INTERMEDIACIÓN Y RESPONSABILIDAD DE TERCEROS.</strong> El Cliente reconoce que LUCI TOURS TURISMO INTERNACIONAL S.A. actúa exclusivamente como intermediario entre el Cliente y los distintos proveedores de servicios turísticos, incluyendo, pero no limitado a, aerolíneas, hoteles, operadores turísticos, empresas de transporte y otros prestadores.</p>
    <p>En consecuencia, la Agencia no será responsable por actos, omisiones, incumplimientos, retrasos, cancelaciones, sobreventas, cambios de itinerario, pérdidas, daños o cualquier otra situación atribuible a dichos proveedores.</p>
    <p>El Cliente acepta que cualquier reclamación derivada de servicios prestados por terceros deberá dirigirse directamente contra el proveedor correspondiente, conforme a sus propias políticas, términos y condiciones.</p>

    <p><strong>DÉCIMO OCTAVO: EMISIÓN DE TIQUETES AÉREOS.</strong> El Cliente reconoce y acepta que la emisión de los tiquetes aéreos forma parte de la gestión operativa del Tour, la cual será realizada por Lucitours conforme a criterios de disponibilidad, condiciones de mercado y coordinación con proveedores.</p>
    <p>En ese sentido, la emisión de los tiquetes aéreos no necesariamente se realizará de forma inmediata al momento del pago de la reserva, pagos parciales o incluso la cancelación total del Tour, pudiendo efectuarse en cualquier momento hasta un plazo máximo de cuarenta y ocho (48) horas previas al inicio del viaje.</p>
    <p>El Cliente entiende y acepta que la confirmación de su espacio dentro del Tour es independiente del momento de emisión de los tiquetes aéreos, y que estos podrán ser adquiridos en una fecha posterior según condiciones operativas y comerciales.</p>
    <p>Lucitours garantiza la prestación del servicio de transporte aéreo conforme a lo contratado, por lo que el Cliente renuncia a cualquier reclamo relacionado exclusivamente con el momento de emisión de los tiquetes, siempre que los mismos sean entregados dentro del plazo indicado y el servicio sea efectivamente brindado.</p>

    <p><strong>DÉCIMO NOVENO: MODIFICACIONES AL CONTRATO.</strong> Toda modificación deberá formalizarse por escrito mediante adenda firmada por las Partes.</p>
    <p><strong>VIGÉSIMO: RESOLUCIÓN ALTERNA DE CONFLICTOS Y LEY APLICABLE.</strong> Este Contrato se regirá por la legislación de la República de Costa Rica. Cualquier controversia intentará resolverse primero por vía conciliatoria antes de acudir a la vía judicial.</p>
    <p><strong>VIGÉSIMO PRIMERO: CONFIDENCIALIDAD.</strong> Toda información comercial, operativa y documental conocida con ocasión del Contrato será tratada como confidencial durante su vigencia y por un año adicional a su terminación.</p>
      <p><strong>VIGÉSIMO SEGUNDO: NOTIFICACIONES Y COMUNICACIONES.</strong></p>
      <ul>
        <li><strong>Lucitours:</strong> contratos@lucitour.com y WhatsApp 6015-9906.</li>
        <li><strong>Cliente:</strong> Dirección ${contractVar(data.clientAddress)}, correo ${contractVar(data.clientEmail)} y teléfono ${contractVar(data.clientPhone)}.</li>
      </ul>
    <p><strong>VIGÉSIMO TERCERO: INTEGRIDAD CONTRACTUAL.</strong> Las Partes aceptan que este Contrato y sus anexos constituyen el acuerdo total entre ellas respecto del Tour contratado.</p>

    <p><strong>VIGÉSIMO CUARTO: AUTORIZACIÓN DE USO DE IMAGEN.</strong> El Cliente autoriza de forma expresa, voluntaria y gratuita a LUCI TOURS TURISMO INTERNACIONAL S.A. para captar, reproducir, publicar y utilizar su imagen, voz y/o apariencia en fotografías, videos o cualquier material audiovisual generado durante el desarrollo del tour.</p>
    <p>Dicho material podrá ser utilizado con fines comerciales, publicitarios y promocionales en redes sociales, sitios web, campañas de marketing y cualquier otro medio de difusión de la Agencia, sin limitación territorial ni temporal.</p>
    <p>El Cliente renuncia a cualquier compensación económica derivada del uso de su imagen en los términos aquí establecidos.</p>
    <p>En caso de no estar de acuerdo, el Cliente deberá manifestarlo por escrito previo al inicio del tour.</p>

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
  form.classList.add("was-validated");
  enforceReservationLimit(false);
  syncItineraryDateBounds(false);

  if (!form.reportValidity()) {
    const firstInvalid = form.querySelector(":invalid");
    if (firstInvalid && typeof firstInvalid.focus === "function") {
      firstInvalid.focus();
    }
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

  const { startDate, endDate } = getTourDateRange();
  for (const item of collectItinerary()) {
    const itineraryDate = String(item.date || "").trim();
    if (itineraryDate && startDate && endDate && (itineraryDate < startDate || itineraryDate > endDate)) {
      throw new Error("Las fechas del itinerario deben estar dentro del rango de inicio y fin del viaje.");
    }
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

// Cache for asset data URIs so Puppeteer never needs to fetch external URLs.
const _assetDataCache = {};
const loadAssetDataUri = async (path) => {
  if (_assetDataCache[path]) return _assetDataCache[path];
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        _assetDataCache[path] = reader.result;
        resolve(reader.result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const buildContractPdfHtml = (data, assets = {}) => {
  const baseUrl = window.location.origin;
  const signatureDate = formatDate(new Date().toISOString().slice(0, 10));
  const contractDestinationUpper = String(data.destination || "").trim().toLocaleUpperCase("es-CR");

  // ── helpers ──────────────────────────────────────────────────────────────
  const v = (val) =>
    `<span class="cv">${escapeHtml(String(val ?? "___"))}</span>`;

  const clause = (title, body) =>
    `<section class="clause"><p><strong>${title}</strong></p>${body}</section>`;

  // ── parties ───────────────────────────────────────────────────────────────
  const companionsIntro = data.companions.length
    ? `<section class="clause">
        <p>Adicionalmente, comparecen como acompañantes del Tour:</p>
        <ul>${data.companions
          .map(
            (p) =>
              `<li>${v(p.fullName)}, mayor de edad, ${v(p.civilStatus)}, ${v(p.profession)}, portador de ${v(p.idType)} número ${v(p.idNumber)}, vecino de ${v(p.address)}, correo electrónico ${v(p.email)}, teléfono ${v(p.phone)}, contacto de emergencia ${v(p.emergencyContactName)}, teléfono de emergencia ${v(p.emergencyContactPhone)}.</li>`,
          )
          .join("")}</ul>
      </section>`
    : "";

  const minorsIntro = data.minors.length
    ? `<section class="clause">
        <p>El Cliente declara que viaja con menor(es) de edad:</p>
        <ul>${data.minors
          .map(
            (m) =>
              `<li>${v(m.name)}, documento de menor número ${v(m.idNumber)}, en calidad de representado por ${v(m.tutorName)}.</li>`,
          )
          .join("")}</ul>
        <p>La autorización y consentimiento de representación de menor de edad se incorpora como anexo obligatorio de este Contrato.</p>
      </section>`
    : "";

  // ── itinerary ─────────────────────────────────────────────────────────────
  const itineraryHtml = data.itineraryItems.length
    ? `<ul>${data.itineraryItems
        .map(
          (item) =>
            `<li>Fecha: ${v(formatDate(item.date))} | Actividad: ${v(item.detail)}</li>`,
        )
        .join("")}</ul>`
    : "<p>Sin actividades registradas.</p>";

  // ── signature blocks ──────────────────────────────────────────────────────
  const signerBlocks = [
    {
      signerKey: "client",
      name: data.clientFullName,
      idType: data.clientIdType,
      idNumber: data.clientIdNumber,
      role: "Cliente",
      isClient: true,
      imageBase64: data.clientSignatureBase64 || null,
    },
    ...data.companions.map((p, i) => ({
      signerKey: `companion-${i}`,
      name: p.fullName,
      idType: p.idType,
      idNumber: p.idNumber,
      role: "Acompañante",
      isClient: false,
      imageBase64: null,
    })),
  ]
    .map(
      (person) => `
      <div class="sig-box">
        <div class="sig-area"
             data-signer-key="${escapeAttr(person.signerKey)}">
          <span class="sig-label">${person.isClient ? "Firma del cliente" : "Firma del acompañante"}</span>
          ${
            person.imageBase64
              ? `<img class="sig-img" src="${escapeAttr(person.imageBase64)}" alt="Firma de ${escapeAttr(person.name)}" />`
              : ""
          }
        </div>
        <p class="sig-name">${v(person.name)}</p>
        <p>${v(person.idType)}: ${v(person.idNumber)}</p>
        <p>${v(person.role)}</p>
        <p>Fecha: ${v(signatureDate)}</p>
      </div>`,
    )
    .join("");

  const erickImgSrc = assets.erickSrc || `${baseUrl}/assets/firmaerick.png`;
  const erickBlock = `
    <div class="sig-box">
      <div class="sig-area sig-area--company" data-signer-key="company">
        <span class="sig-label">Firma del representante</span>
        <img class="sig-img sig-img--company"
             src="${escapeAttr(erickImgSrc)}"
             alt="Firma de Erick Bonilla" />
      </div>
      <p class="sig-name">ERICK JOSUE BONILLA PEREIRA</p>
      <p>Cédula: 1-1597-0559</p>
      <p>Representante legal de Lucitours</p>
      <p>Fecha: ${v(signatureDate)}</p>
    </div>`;

  // ── minors annex pages ────────────────────────────────────────────────────
  const minorAnnexPages =
    data.hasMinorCompanion && data.minors.length > 0
      ? data.minors
          .map((minor, index) => {
            const adult = getResponsibleAdultIdentity(data, minor.travelingWith);
            return `
          <section class="annex-page">
            <h2>ANEXO DE AUTORIZACIÓN PARA VIAJE DE MENOR DE EDAD ${index + 1}</h2>
            <p><strong>Número de anexo:</strong> ANX-MEN-${escapeHtml(data.contractNumber)}-${String(index + 1).padStart(2, "0")}</p>
            <p><strong>Contrato Número:</strong> ${escapeHtml(data.contractNumber)}</p>
            <p>Este anexo complementa el CONTRATO GENERAL DE VIAJE TURÍSTICO N. ${escapeHtml(data.contractNumber)} y documenta la autorización del tutor/patria potestad para el menor indicado.</p>

            <section class="annex-clause">
              <p><strong>PRIMERO: DATOS DEL MENOR</strong></p>
              <ul>
                <li>Menor: ${escapeHtml(minor.name)}</li>
                <li>Identificación: ${escapeHtml(minor.idNumber)}</li>
                <li>Destino del Tour: ${escapeHtml(data.destination)}</li>
                <li>Fechas del Tour: ${formatDate(data.startDate)} a ${formatDate(data.endDate)}</li>
              </ul>
            </section>

            <section class="annex-clause">
              <p><strong>SEGUNDO: DATOS DE QUIEN EJERCE PATRIA POTESTAD / TUTOR LEGAL</strong></p>
              <ul>
                <li>Nombre completo: ${escapeHtml(minor.tutorName)}</li>
                <li>Identificación: ${escapeHtml(minor.tutorIdType || "ID")} ${escapeHtml(minor.tutorId)}</li>
                <li>Teléfono de contacto: —</li>
              </ul>
            </section>

            <section class="annex-clause">
              <p><strong>TERCERO: ADULTO RESPONSABLE QUE ACOMPAÑA AL MENOR</strong></p>
              <ul>
                <li>Nombre completo: ${escapeHtml(minor.travelingWith)}</li>
                <li>Identificación: ${escapeHtml(adult.idType)} ${escapeHtml(adult.idNumber)}</li>
                <li>Teléfono de contacto: —</li>
              </ul>
            </section>

            <section class="annex-clause">
              <p><strong>CUARTO: DECLARACIÓN DE AUTORIZACIÓN</strong></p>
              <p>La persona firmante, en su condición de tutor legal y/o quien ejerce la patria potestad, declara bajo fe de juramento que cuenta con facultades legales suficientes para autorizar el viaje del menor e identifica expresamente a ${escapeHtml(minor.travelingWith)} como el adulto responsable que acompañará al menor durante el viaje. Asimismo, exonera a Lucitours de responsabilidad por información inexacta o documentación insuficiente aportada por el representante.</p>
            </section>

            <section class="annex-clause">
              <p><strong>QUINTO: DOCUMENTO DE RESPALDO</strong></p>
              <p>Este anexo debe estar acompañado por el permiso notarial, judicial o documento equivalente exigido por la normativa migratoria aplicable.</p>
            </section>

            <section class="annex-sigs">
              <div class="annex-sig-col">
                <p class="annex-sig-line">______________________________</p>
                <p><strong>1) Tutor legal / Patria potestad</strong></p>
                <p>${escapeHtml(minor.tutorName)}</p>
                <p>${escapeHtml(minor.tutorIdType || "ID")}: ${escapeHtml(minor.tutorId)}</p>
              </div>
              <div class="annex-sig-col">
                <p class="annex-sig-line">______________________________</p>
                <p><strong>2) Adulto autorizado que acompaña al menor</strong></p>
                <p>${escapeHtml(minor.travelingWith)}</p>
                <p>${escapeHtml(adult.idType)}: ${escapeHtml(adult.idNumber)}</p>
              </div>
            </section>
            <p><strong>Fecha de emisión:</strong> ${formatDate(data.issuedAt)}</p>
          </section>`;
          })
          .join("")
      : "";

  // ── full HTML document ────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Contrato ${escapeHtml(data.contractNumber)} — Lucitours</title>
<style>
/* ── reset & page ───────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page {
  size: A4 portrait;
  margin: 22mm 18mm 24mm 20mm;
}

html, body {
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  color: #0a0a0a;
  background: #fff;
  line-height: 1.55;
}

/* ── document header ────────────────────────────────────────────── */
.doc-header {
  display: flex;
  align-items: flex-start;
  gap: 16pt;
  padding-bottom: 10pt;
  border-bottom: 1.5pt solid #0a0a0a;
  margin-bottom: 14pt;
}

.doc-header-logo {
  width: 60pt;
  height: auto;
  flex-shrink: 0;
}

.doc-header-text { flex: 1; }

.doc-header-text h1 {
  font-size: 11.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 3pt;
}

.doc-header-text .doc-meta {
  font-size: 9.5pt;
  color: #222;
  line-height: 1.4;
}

/* ── contract title ─────────────────────────────────────────────── */
.contract-title {
  font-size: 11pt;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 12pt 0 8pt;
}

/* ── contract meta table ────────────────────────────────────────── */
.contract-meta {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
  margin-bottom: 10pt;
}

.contract-meta td {
  padding: 2pt 6pt;
  vertical-align: top;
}

.contract-meta td:first-child {
  font-weight: 700;
  white-space: nowrap;
  width: 44mm;
}

/* ── section headings ───────────────────────────────────────────── */
.section-heading {
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 14pt 0 6pt;
  border-bottom: 0.75pt solid #555;
  padding-bottom: 2pt;
}

/* ── clause blocks ──────────────────────────────────────────────── */
.clause {
  page-break-inside: avoid;
  break-inside: avoid;
  margin-bottom: 6pt;
}

.clause p, .clause li {
  font-size: 10.5pt;
  line-height: 1.55;
  margin-bottom: 3pt;
  word-break: break-word;
  overflow-wrap: anywhere;
  text-align: justify;
}

.clause ul, .clause ol {
  margin: 4pt 0 4pt 16pt;
  padding: 0;
}

.clause li { margin-bottom: 2pt; }

/* ── contract variable highlight ────────────────────────────────── */
.cv { font-weight: 700; color: #0a0a0a; }

/* ── signature page ─────────────────────────────────────────────── */
.sig-page {
  page-break-inside: avoid;
  break-inside: avoid;
  padding-top: 10pt;
}

.sig-page-title {
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 18pt;
  letter-spacing: 0.04em;
}

.sig-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20pt;
  align-items: start;
}

.sig-box {
  page-break-inside: avoid;
  break-inside: avoid;
}

.sig-area {
  height: 70pt;
  border-bottom: 1pt solid #0a0a0a;
  margin-bottom: 6pt;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 4pt;
}

.sig-area--company {
  border: none;
  border-bottom: 1pt solid #0a0a0a;
  justify-content: center;
}

.sig-label {
  position: absolute;
  top: -8pt;
  left: 8pt;
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #333;
  background: #fff;
  padding: 0 4pt;
}

.sig-img {
  max-width: 100%;
  max-height: 62pt;
  object-fit: contain;
  display: block;
}

.sig-img--company {
  max-width: 160pt;
  max-height: 62pt;
  margin: 0 auto;
}

.sig-name {
  font-weight: 700;
  font-size: 10pt;
  margin-bottom: 2pt;
}

.sig-box p {
  font-size: 9.5pt;
  line-height: 1.45;
  margin: 1pt 0;
}

/* ── minor annex pages ──────────────────────────────────────────── */
.annex-page {
  page-break-before: always;
  break-before: page;
  padding-top: 10pt;
}

.annex-page h2 {
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.04em;
  margin-bottom: 12pt;
}

.annex-page p {
  font-size: 10.5pt;
  line-height: 1.55;
  margin-bottom: 3pt;
  text-align: justify;
}

.annex-page ul {
  margin: 4pt 0 4pt 16pt;
  padding: 0;
}

.annex-page li {
  font-size: 10.5pt;
  line-height: 1.5;
  margin-bottom: 2pt;
}

.annex-clause {
  page-break-inside: avoid;
  break-inside: avoid;
  margin-bottom: 6pt;
}

.annex-sigs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20pt;
  margin-top: 24pt;
  page-break-inside: avoid;
  break-inside: avoid;
}

.annex-sig-col p {
  font-size: 9.5pt;
  line-height: 1.45;
  margin: 2pt 0;
}

.annex-sig-line {
  font-size: 10pt;
  margin-bottom: 3pt !important;
}

/* ── print tweaks ───────────────────────────────────────────────── */
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  a { color: inherit; text-decoration: none; }
}
</style>
</head>
<body>

<!-- ── Document header ── -->
<header class="doc-header">
  <img class="doc-header-logo"
       src="${escapeAttr(assets.logoSrc || `${baseUrl}/assets/logo-lucitour.png`)}"
       alt="Lucitours" />
  <div class="doc-header-text">
    <h1>Viajes Lucitours Turismo Internacional S.A.</h1>
    <p class="doc-meta">
      Cédula jurídica: 3-101-874546 &nbsp;|&nbsp;
      contratos@lucitour.com &nbsp;|&nbsp; Tel. 6015-9906<br />
      Contrato N.° <strong>${escapeHtml(data.contractNumber)}</strong> &nbsp;|&nbsp;
      Emitido: ${escapeHtml(formatDate(data.issuedAt || new Date().toISOString().slice(0, 10)))} &nbsp;|&nbsp;
      Agente: ${escapeHtml(data.generatedByAgentName || "")}
    </p>
  </div>
</header>

<!-- ── Title ── -->
<h2 class="contract-title">Contrato General de Viaje Turístico a ${escapeHtml(contractDestinationUpper)}</h2>

<!-- ── Contract meta ── -->
<table class="contract-meta">
  <tr><td>Número de contrato:</td><td>${escapeHtml(data.contractNumber)}</td></tr>
  <tr><td>Destino:</td><td>${escapeHtml(data.destination)}</td></tr>
  <tr><td>Fechas del Tour:</td><td>${escapeHtml(formatDate(data.startDate))} al ${escapeHtml(formatDate(data.endDate))}</td></tr>
  <tr><td>Emitido el:</td><td>${escapeHtml(formatDate(data.issuedAt || new Date().toISOString().slice(0, 10)))}</td></tr>
</table>

<!-- ── Parties ── -->
<h3 class="section-heading">Partes</h3>

<section class="clause">
  <p>(a) <strong>ERICK JOSUE BONILLA PEREIRA</strong>, mayor, soltero, administrador de agencia de viajes, portador de la cédula de identidad número <strong>1-1597-0559</strong>, vecino de Cartago, en condición de representante legal, con facultades de apoderado generalísimo sin límite de suma de <strong>VIAJES LUCITOURS TURISMO INTERNACIONAL SOCIEDAD ANONIMA</strong>, cédula jurídica número 3-101-874546, en adelante denominada <strong>"Lucitours"</strong>; y</p>
</section>

<section class="clause">
  <p>(b) ${v(data.clientFullName)}, mayor de edad, ${v(data.civilStatus)}, ${v(data.profession)}, portador de ${v(data.clientIdType)} número ${v(data.clientIdNumber)}, vecino de ${v(data.clientAddress)}, correo electrónico ${v(data.clientEmail)}, teléfono ${v(data.clientPhone)}, contacto de emergencia ${v(data.emergencyContactName)}, teléfono de emergencia ${v(data.emergencyContactPhone)}, en adelante denominado como el <strong>"Cliente"</strong>.</p>
</section>

${companionsIntro}
${minorsIntro}

<section class="clause">
  <p>Haciendo mención a los comparecientes en conjunto, denominados como las <strong>"Partes"</strong>, hemos convenido en celebrar el presente <strong>CONTRATO GENERAL DE VIAJE TURÍSTICO</strong>, el cual se regirá por las siguientes cláusulas:</p>
</section>

<!-- ── Clauses ── -->
<h3 class="section-heading">Cláusulas</h3>

${clause(
  "PRIMERO: OBJETO.",
  `<p>El presente Contrato será el documento base para regular las cláusulas y condiciones referentes a la contratación del paquete turístico internacional acordado entre las Partes.</p>`,
)}

${clause(
  "SEGUNDO: DESTINO.",
  `<p>El país a visitar por parte del Cliente es ${v(data.destination)}, y manifiesta expresamente que dicho destino fue elegido y reservado de forma voluntaria para la realización del Tour.</p>`,
)}

${clause(
  "TERCERO: FECHAS DEL TOUR Y PLAZO.",
  `<p>Las fechas de ejecución del Tour serán del ${v(formatDate(data.startDate))} al ${v(formatDate(data.endDate))}, mismas que se entenderán como plazo del presente Contrato.</p>`,
)}

${clause(
  "CUARTO: PRECIO, FORMA DE PAGO Y MEDIOS DE PAGO.",
  `<ul>
    <li>Precio total del Tour: USD ${v(formatMoney(data.totalAmount))}</li>
    <li>Pago inicial (reserva): USD ${v(formatMoney(data.reservationAmount))}</li>
    <li>Saldo pendiente: USD ${v(formatMoney(data.balanceAmount))}</li>
    <li>Saldo dividido en ${v(data.installmentCount)} cuota(s) mensual(es) de USD ${v(formatMoney(data.monthlyInstallmentAmount))}</li>
    <li>Fecha límite de pago total: ${v(formatDate(data.paymentDueDate))}</li>
  </ul>
  <p>Los medios de pago para realizar los pagos son los siguientes:</p>
  <ul>
    <li>Cuenta bancaria (IBAN): CR25011610400074756807, Banco Promerica.</li>
    <li>Sinpe Móvil: 7296-9551.</li>
    <li>Pagos en efectivo o tarjeta en oficinas de Lucitours.</li>
  </ul>`,
)}

${clause(
  "QUINTO: DEPÓSITO DE RESERVA.",
  `<p>La cuota de reserva inicial se utiliza como depósito mínimo para reservar y garantizar el espacio del Cliente en el Tour y los operadores turísticos, por lo que dicho depósito no será transferible, reutilizable ni reembolsable.</p>
  <p>En caso de incumplimiento en pagos, Lucitours podrá notificar una fecha límite para poner al día los montos. De mantenerse el incumplimiento, Lucitours podrá excluir al Cliente del Tour y los dineros recibidos al momento no serán reembolsables.</p>`,
)}

${clause(
  "SEXTO: ALOJAMIENTOS Y HOSPEDAJES.",
  `<p>Como parte del Tour, el Cliente será alojado en establecimientos tipo hostel, hotel u otros similares, conforme a la logística del viaje, disponibilidad y condiciones operativas del proveedor.</p>
  <p>Como referencia de preferencia del Cliente, se registra tipo de hospedaje ${v(data.lodgingType)} y acomodación solicitada ${v(data.accommodationType)}. Esta preferencia no constituye garantía absoluta y estará sujeta a disponibilidad y criterios operativos del Tour.</p>
  <p>La asignación final de habitaciones y tipo de acomodación será determinada por Lucitours según criterios operativos, pudiendo incluir habitaciones individuales, dobles, múltiples o compartidas.</p>
  <p>El Cliente reconoce y acepta expresamente que la acomodación podrá implicar el uso de habitaciones compartidas con otros participantes del Tour, ya sean conocidos o no, así como el uso de baños privados o compartidos, según disponibilidad del hospedaje.</p>
  <p>Lucitours podrá modificar el hospedaje originalmente previsto, incluyendo cambios de establecimiento, categoría o tipo de habitación, siempre que se mantengan condiciones razonables de servicio dentro del Tour contratado.</p>
  <p>Todo lo anterior estará sujeto a disponibilidad, necesidades operativas del Tour, así como a casos fortuitos o de fuerza mayor.</p>`,
)}

${clause(
  "SÉPTIMO: CHECK IN Y ASIGNACIÓN DE ASIENTOS.",
  `<p>Lucitours realizará el check in según apertura de aerolínea. La asignación de asientos la realiza la aerolínea de forma aleatoria.</p>
  <p>Equipaje permitido: ${v(data.luggageClause)}</p>`,
)}

${clause(
  "OCTAVO: SEGURO DE VIAJE.",
  `<p>Lucitours podrá colaborar con la adquisición de seguro de viaje mediante agencia aliada Assist Card, siendo opcional para el Cliente.</p>
  <p>El Cliente acepta que, en caso de no contratar seguro con Lucitours o bien no contar con un seguro viajero propio durante el Tour en este mismo acto, exonera a Lucitours de toda responsabilidad por cualquier accidente, enfermedad, gasto médico, muerte o repatriación.</p>
  <p>Asimismo, el Cliente declara que exime a Lucitours, en este mismo acto y en la medida permitida por ley, de responsabilidad por gastos médicos, hospitalarios, emergencias, cancelaciones, retrasos, pérdida de equipaje u otras contingencias cubribles por el seguro de viaje.</p>`,
)}

${clause(
  "NOVENO: PERSONAL DE ACOMPAÑAMIENTO.",
  `<p>Dependiendo del Tour, Lucitours podrá asignar personal de acompañamiento desde Costa Rica.</p>
  <p>El Cliente debe presentarse con al menos 3 horas de anticipación al aeropuerto y con toda la documentación requerida para viajar. Lucitours no será responsable por llegada tardía, documentos vencidos o documentación incompleta del Cliente.</p>`,
)}

${clause(
  "DÉCIMO: FICHA DE ACTIVIDADES E ITINERARIO.",
  `${itineraryHtml}
  <p>Lucitours podrá modificar itinerario, ruta, hospedajes u orden del Tour cuando sea necesario para seguridad, resguardo y ejecución efectiva del servicio.</p>`,
)}

${clause(
  "DÉCIMO PRIMERO: TRANSPORTES.",
  `<p>Lucitours brindará, por medio de terceros contratados, transportes relacionados con el Tour (vehículo privado, microbús, colectivo o transporte público). Todo transporte fuera de itinerario corre por cuenta del Cliente.</p>`,
)}

${clause(
  "DÉCIMO SEGUNDO: ALIMENTACIÓN.",
  `<p>El Tour no incluye alimentación, salvo indicación expresa en la publicación del tour o bien que el hospedaje indique que se incluye el desayuno con el hospedaje; por lo tanto, el Cliente debe asumir sus costos de alimentación durante el tour.</p>`,
)}

${clause(
  "DÉCIMO TERCERO: CANCELACIONES, REEMBOLSOS, CRÉDITOS Y FUERZA MAYOR.",
  `<p><strong>13.1 Política de Reembolsos y Plazos de Devolución.</strong> En caso de que proceda un reembolso total o parcial por cualquier concepto relacionado con los servicios contratados, el Cliente acepta y reconoce que Lucitours dispondrá de un plazo mínimo de tres (3) meses y máximo de seis (6) meses calendario para efectuar dicha devolución. El plazo comenzará a computarse a partir de la fecha en que Lucitours confirme formalmente la procedencia del reembolso.</p>
  <p>El Cliente acepta que este plazo responde a la operativa del sector turístico, incluyendo procesos de recuperación de fondos con terceros proveedores como aerolíneas, hoteles, operadores y servicios internacionales, los cuales no dependen directamente de Lucitours. El Cliente renuncia expresamente a cualquier reclamación adicional, intereses, indemnización o penalización relacionada con el tiempo de espera dentro del plazo establecido.</p>
  <p><strong>13.2 Política de Créditos a Favor (Voucher).</strong> Como alternativa al reembolso, Lucitours podrá ofrecer al Cliente un crédito a favor (voucher) equivalente al monto pagado, utilizable en futuros viajes, servicios o experiencias ofrecidas por la agencia. Este crédito tendrá una vigencia de hasta doce (12) meses y será transferible previa autorización de Lucitours. La aceptación del crédito por parte del Cliente implica la renuncia al reembolso en dinero.</p>
  <p><strong>13.3 Responsabilidad frente a Terceros Proveedores.</strong> Lucitours actúa como intermediario entre el Cliente y terceros proveedores (incluyendo, pero no limitado a, aerolíneas, hoteles, operadores turísticos y transportistas). Por lo tanto, Lucitours no será responsable por cancelaciones, retrasos, modificaciones, pérdidas o incumplimientos atribuibles a dichos proveedores. Cualquier gestión de reembolso estará sujeta a las políticas y tiempos de respuesta de estos terceros.</p>
  <p><strong>13.4 Cancelaciones por Parte del Cliente.</strong> En caso de cancelación voluntaria por parte del Cliente, los montos pagados podrán estar sujetos a penalidades, cargos administrativos y condiciones de los proveedores. Si la cancelación se realiza con menos de veintidós (22) días calendario de antelación a la fecha de inicio del viaje, aplicará una penalidad equivalente al diez por ciento (10%) del valor total del contrato. Lucitours no garantiza reembolsos en estos casos, pudiendo ofrecer únicamente créditos a favor según la evaluación del caso.</p>
  <p><strong>13.5 Fuerza Mayor.</strong> Lucitours no será responsable por la imposibilidad total o parcial de prestar los servicios contratados cuando esto se deba a causas de fuerza mayor, incluyendo pero no limitado a: pandemias, conflictos políticos, desastres naturales, restricciones gubernamentales, huelgas, cancelaciones masivas o cualquier evento fuera del control razonable de la agencia. En estos casos, Lucitours podrá reprogramar el servicio o emitir un crédito a favor, sin obligación inmediata de reembolso.</p>
  <p><strong>13.6 Aceptación de Condiciones.</strong> Al contratar los servicios, el Cliente declara haber leído, entendido y aceptado todas las condiciones de esta cláusula, incluyendo tiempos de reembolso, políticas de crédito y limitaciones de responsabilidad.</p>`,
)}

${clause(
  "DÉCIMO CUARTO: DERECHOS Y OBLIGACIONES DEL CLIENTE.",
  `<p>El Cliente se obliga, entre otros, a pagar montos económicos según contrato; brindar documentación veraz y vigente; respetar horarios, itinerarios y normas de proveedores; resguardar pertenencias personales; asumir gastos no incluidos; y gestionar correctamente documentación de menor(es), cuando aplique.</p>`,
)}

${clause(
  "DÉCIMO CUARTO BIS: CONDUCTA Y NORMAS DEL CLIENTE.",
  `<p>El Cliente se compromete a mantener una conducta respetuosa, adecuada y alineada con las normas de convivencia durante todo el desarrollo del tour, tanto con el personal de la Agencia como con otros participantes, proveedores y terceros.</p>
  <p>Queda estrictamente prohibido cualquier comportamiento que implique agresión verbal o física, discriminación, acoso, consumo excesivo de sustancias que afecten la convivencia, incumplimiento de normas locales o cualquier acción que ponga en riesgo la operación del tour o la experiencia del grupo.</p>
  <p>LUCI TOURS TURISMO INTERNACIONAL S.A. se reserva el derecho de excluir, sin derecho a reembolso alguno, a cualquier Cliente cuya conducta sea considerada inapropiada, riesgosa o perjudicial para el desarrollo del tour o la experiencia de terceros.</p>
  <p>Asimismo, cualquier gasto adicional derivado de dicha exclusión será asumido en su totalidad por el Cliente.</p>`,
)}

${clause(
  "DÉCIMO QUINTO: DERECHOS Y OBLIGACIONES DE LUCITOURS.",
  `<p>Lucitours se obliga, entre otros, a ejecutar el Tour contratado; contratar y pagar a proveedores del servicio; brindar acompañamiento contractual y soporte operativo; y gestionar check in cuando corresponda.</p>`,
)}

${clause(
  "DÉCIMO SEXTO: EXONERACIÓN Y LIMITACIÓN DE RESPONSABILIDAD.",
  `<p>El Cliente reconoce y acepta que la participación en el tour implica riesgos inherentes propios de los viajes nacionales e internacionales, incluyendo, pero no limitado a, condiciones climáticas adversas, retrasos, cancelaciones, accidentes, enfermedades, situaciones políticas, sociales o sanitarias, y cualquier otro evento fuera del control razonable de la Agencia.</p>
  <p>En consecuencia, el Cliente exonera expresa e irrevocablemente a LUCI TOURS TURISMO INTERNACIONAL S.A. de toda responsabilidad por daños, pérdidas, lesiones, gastos médicos, retrasos, modificaciones de itinerario, pérdida de equipaje, o cualquier otra contingencia que pueda surgir durante el desarrollo del tour, cuando estos no sean atribuibles directamente a dolo o culpa grave comprobada de la Agencia.</p>
  <p>Asimismo, el Cliente acepta que la Agencia no garantiza resultados subjetivos del viaje, tales como satisfacción personal, experiencias individuales, condiciones climáticas específicas, calidad percibida de servicios de terceros, ni expectativas personales no estipuladas expresamente en el presente contrato.</p>
  <p>La responsabilidad total de la Agencia, en cualquier caso comprobado, se limitará exclusivamente al monto efectivamente pagado por el Cliente por los servicios contratados.</p>`,
)}

${clause(
  "DÉCIMO SÉPTIMO: INTERMEDIACIÓN Y RESPONSABILIDAD DE TERCEROS.",
  `<p>El Cliente reconoce que LUCI TOURS TURISMO INTERNACIONAL S.A. actúa exclusivamente como intermediario entre el Cliente y los distintos proveedores de servicios turísticos, incluyendo, pero no limitado a, aerolíneas, hoteles, operadores turísticos, empresas de transporte y otros prestadores.</p>
  <p>En consecuencia, la Agencia no será responsable por actos, omisiones, incumplimientos, retrasos, cancelaciones, sobreventas, cambios de itinerario, pérdidas, daños o cualquier otra situación atribuible a dichos proveedores.</p>
  <p>El Cliente acepta que cualquier reclamación derivada de servicios prestados por terceros deberá dirigirse directamente contra el proveedor correspondiente, conforme a sus propias políticas, términos y condiciones.</p>`,
)}

${clause(
  "DÉCIMO OCTAVO: EMISIÓN DE TIQUETES AÉREOS.",
  `<p>El Cliente reconoce y acepta que la emisión de los tiquetes aéreos forma parte de la gestión operativa del Tour, la cual será realizada por Lucitours conforme a criterios de disponibilidad, condiciones de mercado y coordinación con proveedores.</p>
  <p>En ese sentido, la emisión de los tiquetes aéreos no necesariamente se realizará de forma inmediata al momento del pago de la reserva, pagos parciales o incluso la cancelación total del Tour, pudiendo efectuarse en cualquier momento hasta un plazo máximo de cuarenta y ocho (48) horas previas al inicio del viaje.</p>
  <p>El Cliente entiende y acepta que la confirmación de su espacio dentro del Tour es independiente del momento de emisión de los tiquetes aéreos, y que estos podrán ser adquiridos en una fecha posterior según condiciones operativas y comerciales.</p>
  <p>Lucitours garantiza la prestación del servicio de transporte aéreo conforme a lo contratado, por lo que el Cliente renuncia a cualquier reclamo relacionado exclusivamente con el momento de emisión de los tiquetes, siempre que los mismos sean entregados dentro del plazo indicado y el servicio sea efectivamente brindado.</p>`,
)}

${clause(
  "DÉCIMO NOVENO: MODIFICACIONES AL CONTRATO.",
  `<p>Toda modificación deberá formalizarse por escrito mediante adenda firmada por las Partes.</p>`,
)}

${clause(
  "VIGÉSIMO: RESOLUCIÓN ALTERNA DE CONFLICTOS Y LEY APLICABLE.",
  `<p>Este Contrato se regirá por la legislación de la República de Costa Rica. Cualquier controversia intentará resolverse primero por vía conciliatoria antes de acudir a la vía judicial.</p>`,
)}

${clause(
  "VIGÉSIMO PRIMERO: CONFIDENCIALIDAD.",
  `<p>Toda información comercial, operativa y documental conocida con ocasión del Contrato será tratada como confidencial durante su vigencia y por un año adicional a su terminación.</p>`,
)}

${clause(
  "VIGÉSIMO SEGUNDO: NOTIFICACIONES Y COMUNICACIONES.",
  `<ul>
    <li><strong>Lucitours:</strong> contratos@lucitour.com y WhatsApp 6015-9906.</li>
    <li><strong>Cliente:</strong> Dirección ${v(data.clientAddress)}, correo ${v(data.clientEmail)} y teléfono ${v(data.clientPhone)}.</li>
  </ul>`,
)}

${clause(
  "VIGÉSIMO TERCERO: INTEGRIDAD CONTRACTUAL.",
  `<p>Las Partes aceptan que este Contrato y sus anexos constituyen el acuerdo total entre ellas respecto del Tour contratado.</p>`,
)}

${clause(
  "VIGÉSIMO CUARTO: AUTORIZACIÓN DE USO DE IMAGEN.",
  `<p>El Cliente autoriza de forma expresa, voluntaria y gratuita a LUCI TOURS TURISMO INTERNACIONAL S.A. para captar, reproducir, publicar y utilizar su imagen, voz y/o apariencia en fotografías, videos o cualquier material audiovisual generado durante el desarrollo del tour.</p>
  <p>Dicho material podrá ser utilizado con fines comerciales, publicitarios y promocionales en redes sociales, sitios web, campañas de marketing y cualquier otro medio de difusión de la Agencia, sin limitación territorial ni temporal.</p>
  <p>El Cliente renuncia a cualquier compensación económica derivada del uso de su imagen en los términos aquí establecidos.</p>
  <p>En caso de no estar de acuerdo, el Cliente deberá manifestarlo por escrito previo al inicio del tour.</p>`,
)}

<section class="clause">
  <p>En fe de lo anterior, las Partes declaran haber leído y comprendido integralmente el presente Contrato, aceptándolo en todas sus cláusulas.</p>
</section>

<!-- ── Signature page ── -->
<section class="sig-page">
  <h2 class="sig-page-title">Firmas — Contrato N.° ${escapeHtml(data.contractNumber)}</h2>
  <div class="sig-grid">
    ${signerBlocks}
    ${erickBlock}
  </div>
</section>

<!-- ── Minor annex pages (one per minor, each on its own page) ── -->
${minorAnnexPages}

</body>
</html>`;
};

const apiFetchMultipart = async (path, formData, token) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") {
      invalidateSessionFromServer("Tu sesion fue cerrada porque se inicio en otra maquina.");
    }
    const msg = payload.message || "No se pudo completar la solicitud.";
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }

  return payload;
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

if (previewButton) {
  previewButton.addEventListener("click", () => {
    try {
      ensureValidForm();
      renderPreview();
    } catch (error) {
      statusText.textContent = error.message || "No se pudo generar la vista previa.";
    }
  });
}

if (sendAndDownloadButton) {
  sendAndDownloadButton.addEventListener("click", () => {
    withBusyButton(sendAndDownloadButton, async () => {
      try {
        hideSigningLinkActions();
        ensureValidForm();
        const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
          throw new Error("Tu sesion no esta activa. Inicia sesion nuevamente.");
        }

        statusText.textContent = "Construyendo contrato...";
        const data = renderPreview();
        const [_logoSrc, _erickSrc] = await Promise.all([
          loadAssetDataUri("./assets/logo-lucitour.png"),
          loadAssetDataUri("./assets/firmaerick.png"),
        ]);
        const contractHtml = buildContractPdfHtml(data, { logoSrc: _logoSrc, erickSrc: _erickSrc });
        const payloadData = { ...data };

        statusText.textContent = "Guardando contrato en base de datos...";
        let archived = false;
        let archivedContractId = "";
        let pdfUrl = "";
        try {
          const archivePayload = new FormData();
          archivePayload.append("contractNumber", String(data.contractNumber));
          archivePayload.append("clientFullName", String(data.clientFullName || ""));
          archivePayload.append("clientIdNumber", String(data.clientIdNumber || ""));
          archivePayload.append("clientEmail", String(data.clientEmail || ""));
          archivePayload.append("destination", String(data.destination || ""));
          archivePayload.append("issuedAt", String(data.issuedAt || ""));
          archivePayload.append("startDate", String(data.startDate || ""));
          archivePayload.append("endDate", String(data.endDate || ""));
          archivePayload.append("payloadJson", JSON.stringify(payloadData));
          archivePayload.append("contractHtml", contractHtml);

          const extraDocs = await collectAllContractDocuments();
          extraDocs.forEach((docFile) => {
            archivePayload.append("documents", docFile, docFile.name);
          });

          const archiveResult = await apiFetchMultipart("/contracts/archive", archivePayload, token);
          archivedContractId = String(archiveResult?.id || "").trim();
          pdfUrl = String(archiveResult?.pdfUrl || "").trim();
          archived = true;
        } catch (archiveError) {
          debugError("Error guardando contrato", archiveError);
        }

        if (pdfUrl) {
          statusText.textContent = "Descargando PDF...";
          window.open(pdfUrl, "_blank", "noopener,noreferrer");
        }

        let signingUrl = "";
        let signingLinks = [];
        if (archived && archivedContractId) {
          statusText.textContent = "Generando enlaces de firma...";
          try {
            const linkResult = await apiFetch(`/contracts/${archivedContractId}/signing-link`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ttlMinutes: 1440 }),
            });
            signingUrl = String(linkResult?.signingUrl || "").trim();
            signingLinks = Array.isArray(linkResult?.signingLinks) ? linkResult.signingLinks : [];
            showSigningLinkActions(signingUrl, signingLinks);
          } catch (linkError) {
            debugError("No se pudo generar el enlace de firma", linkError);
          }
        }

        let emailSentCount = 0;
        if (signingUrl) {
          const normalizedSigningLinks = signingLinks.length
            ? signingLinks
            : [{ signerKey: "client", signerName: data.clientFullName, signerEmail: data.clientEmail, signingUrl }];

          const emailableTargets = normalizedSigningLinks.filter(
            (item) => String(item?.signerEmail || "").trim() && String(item?.signingUrl || "").trim(),
          );

          if (emailableTargets.length > 0) {
            statusText.textContent = "Enviando correos de firma...";
          }

          for (const target of emailableTargets) {
            try {
              await apiFetch("/contracts/send-signing-email", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  toEmail: String(target.signerEmail || "").trim(),
                  clientName: String(target.signerName || "").trim() || "Firmante",
                  contractNumber: String(data.contractNumber),
                  signingUrl: String(target.signingUrl || "").trim(),
                }),
              });
              emailSentCount += 1;
            } catch (emailError) {
              debugError("Error enviando correo de firma", emailError);
            }
          }
        }

        resetContractWorkspace();

        try {
          await reserveContractNumber(token);
        } catch (reserveError) {
          debugError("No se pudo reservar el siguiente numero", reserveError);
        }

        statusText.textContent = archived
          ? emailSentCount > 0
            ? "Contrato guardado y enlaces de firma enviados."
            : signingUrl
              ? "Contrato guardado. No se pudieron enviar todos los correos, pero puedes compartir los enlaces de firma."
              : "Contrato guardado. No se pudieron generar enlaces de firma."
          : "No se pudo guardar el contrato en base de datos.";
        await loadContractHistory(historySearchInput?.value || "");
        debugLog("Flujo completado");
      } catch (error) {
        debugError("Error en flujo de envio", error);
        statusText.textContent = error.message || "No se pudo completar el envio.";
      }
    });
  });
}


if (copySigningLinkButton) {
  copySigningLinkButton.addEventListener("click", async () => {
    const link = String(latestSigningLinkUrl || "").trim();
    if (!link) {
      statusText.textContent = "No hay enlace de firma para copiar todavia.";
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const tmp = document.createElement("textarea");
        tmp.value = link;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        tmp.remove();
      }
      statusText.textContent = "Enlace de firma copiado al portapapeles.";
    } catch {
      statusText.textContent = "No se pudo copiar automaticamente. Copialo desde Abrir link de firma.";
    }
  });
}

if (companionSigningLinksEl) {
  companionSigningLinksEl.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (!target.matches('[data-action="copy-companion-link"]')) {
      return;
    }

    const signingUrl = String(target.getAttribute("data-signing-url") || "").trim();
    if (!signingUrl) {
      statusText.textContent = "No hay link para copiar.";
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(signingUrl);
      } else {
        const tmp = document.createElement("textarea");
        tmp.value = signingUrl;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        tmp.remove();
      }
      statusText.textContent = "Link del acompanante copiado al portapapeles.";
    } catch {
      statusText.textContent = "No se pudo copiar automaticamente el link del acompanante.";
    }
  });
}

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

  const clientNationalityOtherInput = form.elements.clientNationalityOther;
  if (clientNationalityOtherInput) {
    clientNationalityOtherInput.required = isOther;
    if (!isOther) {
      clientNationalityOtherInput.value = "";
      clientNationalityOtherInput.setCustomValidity("");
      markFieldValidity(clientNationalityOtherInput);
    }
  }
});

if (clientNationalitySelect) {
  clientNationalitySelect.dispatchEvent(new Event("change"));
}

form.addEventListener(
  "invalid",
  (event) => {
    form.classList.add("was-validated");
    markFieldValidity(event.target);
  },
  true,
);

form.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches("input, select, textarea")) {
    markFieldValidity(target);
  }
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
  syncItineraryDateBounds(true);
  recalcPaymentDueDate();
});

form.elements.endDate.addEventListener("change", () => {
  const lastDateInput = itineraryContainer.querySelector('[data-kind="closing"] [data-field="date"]');
  if (lastDateInput) {
    lastDateInput.value = form.elements.endDate.value;
  }
  syncItineraryDateBounds(true);
});

itineraryContainer.addEventListener("change", (event) => {
  const target = event.target;
  if (target && target.matches('[data-field="date"]')) {
    syncItineraryDateBounds(true);
  }
});

form.elements.totalAmount.addEventListener("input", () => {
  enforceReservationLimit(true);
  recalcBalance();
});

form.elements.totalAmount.addEventListener("change", () => {
  hardClampReservation();
});

form.elements.reservationAmount.addEventListener("input", () => {
  enforceReservationLimit(true);
  recalcBalance();
});

form.elements.reservationAmount.addEventListener("change", () => {
  hardClampReservation();
});

form.elements.reservationAmount.addEventListener("blur", () => {
  hardClampReservation();
});

form.elements.installmentCount.addEventListener("input", () => {
  recalcBalance();
});

const bootstrap = () => {
  setUnauthenticatedUi("Ingresa tus credenciales.");
  if (sendAndDownloadButton) {
    sendAndDownloadButton.removeAttribute("disabled");
    sendAndDownloadButton.disabled = false;
  }
  resetContractWorkspace();
  statusText.textContent =
      "Lista para uso temporal. El número de contrato se genera desde el backend al iniciar sesión.";
  if (historyList) {
    historyList.innerHTML = '<p class="history-empty">Inicia sesion para ver historial.</p>';
  }
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
    startSessionStream(result.accessToken);
    await prepareNextContract(result.accessToken);
    await loadContractHistory(historySearchInput?.value || "");
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

if (historySearchButton) {
  historySearchButton.addEventListener("click", () => {
    void loadContractHistory(historySearchInput?.value || "");
  });
}

if (historySearchInput) {
  historySearchInput.addEventListener("input", () => {
    if (historySearchDebounce) {
      clearTimeout(historySearchDebounce);
    }
    historySearchDebounce = setTimeout(() => {
      void loadContractHistory(historySearchInput.value || "");
    }, 280);
  });
}

if (historyList) {
  historyList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches('button[data-action="files"]')) {
      const contractId = target.getAttribute("data-contract-id");
      if (!contractId) {
        return;
      }

      target.setAttribute("disabled", "true");
      const oldText = target.textContent;
      target.textContent = "Abriendo...";

      void openContractFiles(contractId)
        .catch((error) => {
          debugError("No se pudo abrir archivos del contrato", error);
          statusText.textContent = "No se pudieron abrir los archivos del contrato.";
        })
        .finally(() => {
          target.removeAttribute("disabled");
          target.textContent = oldText;
        });
      return;
    }

    if (target.matches('button[data-action="resend-signed"]')) {
      const contractId = target.getAttribute("data-contract-id");
      if (!contractId) {
        return;
      }

      target.setAttribute("disabled", "true");
      const oldText = target.textContent;
      target.textContent = "Reenviando...";

      void resendSignedContract(contractId)
        .then((result) => {
          const sent = Number(result?.sentCount || 0);
          const failed = Number(result?.failedCount || 0);
          statusText.textContent =
            failed > 0
              ? `Contrato reenviado a ${sent} destinatario(s). ${failed} fallo(aron).`
              : `Contrato reenviado correctamente a ${sent} destinatario(s).`;
          showResendSignedSummary(result);
          
          // Cambiar botón a estado "Enviado" en verde
          if (failed === 0 && sent > 0) {
            target.textContent = "✓ Enviado";
            target.style.backgroundColor = "#10b981";
            target.style.color = "white";
            target.style.borderColor = "#10b981";
            
            // Guardar info de envío para tooltip
            const now = new Date().toLocaleString("es-CR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            });
            const emails = Array.isArray(result?.sentTo) ? result.sentTo.join("\n") : "";
            const tooltipText = `✓ Enviado exitosamente\n\n📅 ${now}\n\n📧 Correos:\n${emails}`;
            
            target.setAttribute("data-tooltip", tooltipText);
            target.dataset.sent = "true";
            target.dataset.sentAt = now;
            target.dataset.sentEmails = emails;
          }
        })
        .catch((error) => {
          debugError("No se pudo reenviar contrato firmado", error);
          statusText.textContent =
            error?.message || "No se pudo reenviar el contrato firmado.";
          target.removeAttribute("disabled");
          target.textContent = oldText;
        })
        .finally(() => {
          if (!target.dataset.sent) {
            target.removeAttribute("disabled");
          }
        });
    }
  });
}

setupPasswordToggle();

if (DEBUG_ENABLED) {
  window.addEventListener("error", (event) => {
    debugError("window.error", event.error || event.message || event);
  });

  window.addEventListener("unhandledrejection", (event) => {
    debugError("unhandledrejection", event.reason || event);
  });
}

bootstrap();
setupAuth();
