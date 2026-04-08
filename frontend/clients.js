const DEBUG_TAG = "[ClientsCRM]";
const DEBUG_ENABLED = Boolean(window.APP_CONFIG?.DEBUG);
const log = (...args) => DEBUG_ENABLED && console.log(DEBUG_TAG, ...args);

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const LOCAL_DEVELOPMENT_API_BASE = "http://localhost:3001";
const API_BASE = configuredApiBase || (isLocalHost ? LOCAL_DEVELOPMENT_API_BASE : "");
const AUTH_TOKEN_KEY = "contractsTempAuthToken";

// DOM Elements
const loginGate = document.getElementById("loginGate");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");
const loginPasswordInput = document.getElementById("loginPassword");
const toggleLoginPasswordButton = document.getElementById("toggleLoginPassword");
const layoutEl = document.querySelector("main.main-container");
const sessionControlsEl = document.getElementById("sessionControls");
const badgeEl = document.getElementById("agentBadge");
const logoutButton = document.getElementById("logoutButton");
const clientsTableBody = document.getElementById("clientsTableBody");
const clientSearch = document.getElementById("clientSearch");
const clientSearchButton = document.getElementById("clientSearchButton");
const filterOnlyWithDocuments = document.getElementById("filterOnlyWithDocuments");
const filterOnlySigned = document.getElementById("filterOnlySigned");
const clientDetailModal = document.getElementById("clientDetailModal");
const clientDocumentsModal = document.getElementById("clientDocumentsModal");
const clientDetailBody = document.getElementById("clientDetailBody");
const clientDocumentsBody = document.getElementById("clientDocumentsBody");

let allClients = [];
let filteredClients = [];

// Utilidades
const escapeHtml = (text) =>
  String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const escapeAttr = (text) =>
  String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Auth Setup
const setupAuth = async () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    setUnauthenticatedUi();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUnauthenticatedUi();
      return;
    }

    const data = await response.json();
    setAuthenticatedUi(data);
    await loadClients();
  } catch (error) {
    log("Error verifying token:", error);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUnauthenticatedUi();
  }
};

const setUnauthenticatedUi = () => {
  loginGate.classList.remove("hidden");
  layoutEl.classList.add("hidden");
  if (sessionControlsEl) {
    sessionControlsEl.classList.add("hidden");
  }
};

const setAuthenticatedUi = (user) => {
  loginGate.classList.add("hidden");
  layoutEl.classList.remove("hidden");
  if (sessionControlsEl) {
    sessionControlsEl.classList.remove("hidden");
    
    // Mark active tab based on current page
    const navTabs = sessionControlsEl.querySelectorAll(".nav-tab");
    const currentPage = window.location.pathname.split("/").pop() || "clientes.html";
    navTabs.forEach((tab) => {
      const href = tab.getAttribute("href");
      const tabPage = href ? href.split("/").pop() : "clientes.html";
      if (tabPage === currentPage || (currentPage === "" && tabPage === "clientes.html")) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }
  if (badgeEl) {
    badgeEl.textContent = `Agente activo: ${user.fullName} (${user.email})`;
  }
};

const handleLogout = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  location.reload();
};

const handleLogin = async (e) => {
  e.preventDefault();
  loginButton.disabled = true;
  loginStatus.textContent = "Ingresando...";

  const email = document.getElementById("loginEmail").value.trim();
  const password = loginPasswordInput.value;

  if (!email || !password) {
    loginStatus.textContent = "Correo y contraseña requeridos.";
    loginButton.disabled = false;
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      loginStatus.textContent = error.message || "Error al ingresar.";
      loginButton.disabled = false;
      return;
    }

    const data = await response.json();
    localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    setAuthenticatedUi(data.user);
    await loadClients();
  } catch (error) {
    log("Login error:", error);
    loginStatus.textContent = "Error al conectarse al servidor.";
    loginButton.disabled = false;
  }
};

// API Calls
const loadClients = async () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/contracts/crm/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      log("Error loading clients:", response.status);
      return;
    }

    const data = await response.json();
    allClients = data.items || [];
    filteredClients = [...allClients];
    renderClientsTable();
  } catch (error) {
    log("Error loading clients:", error);
  }
};

// Rendering
const renderClientsTable = () => {
  if (filteredClients.length === 0) {
    clientsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px">
          No hay clientes que coincidan con los filtros.
        </td>
      </tr>
    `;
    return;
  }

  clientsTableBody.innerHTML = filteredClients
    .map((client) => {
      const contractCount = client.contracts.length;
      const firstContract = client.contracts[0];
      const firstContractDate = firstContract
        ? new Date(firstContract.createdAt).toLocaleDateString("es-CR")
        : "-";
      const hasDocuments = client.contracts.some((c) => c.documents.length > 0);

      return `
        <tr>
          <td><strong>${escapeHtml(client.fullName)}</strong></td>
          <td>${escapeHtml(client.idNumber || "-")}</td>
          <td>${escapeHtml(client.email || "-")}</td>
          <td>${escapeHtml(client.phone || "-")}</td>
          <td style="text-align: center">${contractCount}</td>
          <td>${firstContractDate}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-small btn-info" data-action="details" data-client-id="${escapeAttr(client.id)}">
                👁️ Ver
              </button>
              ${hasDocuments ? `<button class="btn btn-small btn-accent" data-action="documents" data-client-id="${escapeAttr(client.id)}">📄 Docs</button>` : ""}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
};

const openClientDetail = (clientId) => {
  const client = allClients.find((c) => c.id === clientId);
  if (!client) return;

  const contractsList = client.contracts
    .map((contract) => {
      const status = contract.status === "SIGNED" ? "✅ Firmado" : "⏳ " + contract.status;
      const signedDate = contract.signedAt
        ? new Date(contract.signedAt).toLocaleDateString("es-CR")
        : "-";

      return `
        <tr>
          <td>${escapeHtml(contract.contractNumber)}</td>
          <td>${escapeHtml(contract.destination || "-")}</td>
          <td>${status}</td>
          <td>${signedDate}</td>
          <td style="text-align: center">${contract.documentCount}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div class="client-detail-panel">
      <div class="detail-section">
        <h3>Información del Cliente</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Nombre Completo:</label>
            <p>${escapeHtml(client.fullName)}</p>
          </div>
          <div class="detail-item">
            <label>Cédula:</label>
            <p>${escapeHtml(client.idNumber)}</p>
          </div>
          <div class="detail-item">
            <label>Correo:</label>
            <p>${escapeHtml(client.email)}</p>
          </div>
          <div class="detail-item">
            <label>Teléfono:</label>
            <p>${escapeHtml(client.phone || "-")}</p>
          </div>
          <div class="detail-item">
            <label>Contacto Emergencia:</label>
            <p>${escapeHtml(client.emergencyContactName || "-")}</p>
          </div>
          <div class="detail-item">
            <label>Teléfono Emergencia:</label>
            <p>${escapeHtml(client.emergencyContactPhone || "-")}</p>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Contratos (${client.contracts.length})</h3>
        <div class="table-wrapper">
          <table class="details-table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Destino</th>
                <th>Estado</th>
                <th>Fecha Firma</th>
                <th>Documentos</th>
              </tr>
            </thead>
            <tbody>
              ${contractsList}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("clientDetailTitle").textContent = `Detalles de: ${escapeHtml(client.fullName)}`;
  clientDetailBody.innerHTML = html;
  clientDetailModal.classList.remove("hidden");
  clientDetailModal.setAttribute("aria-hidden", "false");
};

const openClientDocuments = async (clientId) => {
  const client = allClients.find((c) => c.id === clientId);
  if (!client) return;

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;

  // Obtener los documentos de todos los contratos del cliente
  let allDocuments = [];
  for (const contract of client.contracts) {
    try {
      const response = await fetch(`${API_BASE}/contracts/${contract.id}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        allDocuments.push(...(data.documents || []));
      }
    } catch (error) {
      log("Error loading contract files:", error);
    }
  }

  if (allDocuments.length === 0) {
    clientDocumentsBody.innerHTML = `
      <p class="history-empty">Este cliente no tiene documentos registrados.</p>
    `;
    clientDocumentsModal.classList.remove("hidden");
    clientDocumentsModal.setAttribute("aria-hidden", "false");
    return;
  }

  // Agrupar documentos por tipo
  const documentsByType = {};
  allDocuments.forEach((doc) => {
    const type = doc.originalFileName?.split("-")[0] || "otros";
    if (!documentsByType[type]) documentsByType[type] = [];
    documentsByType[type].push(doc);
  });

  let html = "";
  Object.entries(documentsByType).forEach(([type, docs]) => {
    html += `
      <div class="doc-person-group">
        <h4>${escapeHtml(type.toUpperCase())}</h4>
        <div class="doc-grid">
          ${docs
            .map((doc) => {
              const mime = String(doc.mimeType || "").toLowerCase();
              const label = escapeHtml(doc.originalFileName || "Documento");

              if (mime.startsWith("image/")) {
                return `
                  <article class="viewer-doc-card">
                    <p class="viewer-doc-card-title">${label}</p>
                    <img src="${escapeAttr(doc.url)}" alt="${label}" loading="lazy" />
                  </article>
                `;
              }

              if (mime === "application/pdf") {
                return `
                  <article class="viewer-doc-card">
                    <p class="viewer-doc-card-title">${label}</p>
                    <embed src="${escapeAttr(doc.url)}" type="application/pdf" />
                  </article>
                `;
              }

              return `
                <article class="viewer-doc-card">
                  <p class="viewer-doc-card-title">${label}</p>
                  <a href="${escapeAttr(doc.url)}" target="_blank" rel="noopener noreferrer">Ver documento</a>
                </article>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  });

  document.getElementById("clientDocumentsTitle").textContent = `Documentos de ${escapeHtml(client.fullName)}`;
  clientDocumentsBody.innerHTML = html;
  clientDocumentsModal.classList.remove("hidden");
  clientDocumentsModal.setAttribute("aria-hidden", "false");
};

// Filtering
const applyFilters = () => {
  const searchTerm = clientSearch.value.toLowerCase();
  const onlyWithDocs = filterOnlyWithDocuments.checked;
  const onlySigned = filterOnlySigned.checked;

  filteredClients = allClients.filter((client) => {
    // Filter por búsqueda
    if (searchTerm) {
      const matchName = client.fullName.toLowerCase().includes(searchTerm);
      const matchId = client.idNumber.toLowerCase().includes(searchTerm);
      const matchEmail = (client.email || "").toLowerCase().includes(searchTerm);
      const matchContract = client.contracts.some((c) =>
        c.contractNumber.toLowerCase().includes(searchTerm)
      );

      if (!matchName && !matchId && !matchEmail && !matchContract) return false;
    }

    // Filter por documentos
    if (onlyWithDocs) {
      const hasDocuments = client.contracts.some((c) => c.documentCount > 0);
      if (!hasDocuments) return false;
    }

    // Filter por contratos firmados
    if (onlySigned) {
      const hasSigned = client.contracts.some((c) => c.status === "SIGNED");
      if (!hasSigned) return false;
    }

    return true;
  });

  renderClientsTable();
};

// Event Listeners
loginForm.addEventListener("submit", handleLogin);
toggleLoginPasswordButton.addEventListener("click", (e) => {
  e.preventDefault();
  if (loginPasswordInput.type === "password") {
    loginPasswordInput.type = "text";
    toggleLoginPasswordButton.textContent = "🙈";
  } else {
    loginPasswordInput.type = "password";
    toggleLoginPasswordButton.textContent = "👁️";
  }
});

clientSearchButton.addEventListener("click", applyFilters);
clientSearch.addEventListener("keyup", (e) => {
  if (e.key === "Enter") applyFilters();
});

filterOnlyWithDocuments.addEventListener("change", applyFilters);
filterOnlySigned.addEventListener("change", applyFilters);

clientsTableBody.addEventListener("click", (event) => {
  const action = event.target.getAttribute("data-action");
  const clientId = event.target.getAttribute("data-client-id");

  if (action === "details") {
    openClientDetail(clientId);
  } else if (action === "documents") {
    openClientDocuments(clientId);
  }
});

// Modal close handlers
document.querySelectorAll("[data-action='close']").forEach((btn) => {
  btn.addEventListener("click", () => {
    clientDetailModal.classList.add("hidden");
    clientDetailModal.setAttribute("aria-hidden", "true");
    clientDocumentsModal.classList.add("hidden");
    clientDocumentsModal.setAttribute("aria-hidden", "true");
  });
});

document.getElementById("logoutButton").addEventListener("click", handleLogout);

// Initialize
setupAuth();
