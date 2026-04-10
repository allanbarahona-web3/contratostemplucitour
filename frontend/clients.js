const DEBUG_TAG = "[ClientsCRM]";
const DEBUG_ENABLED = Boolean(window.APP_CONFIG?.DEBUG);
const log = (...args) => DEBUG_ENABLED && console.log(DEBUG_TAG, ...args);

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const LOCAL_DEVELOPMENT_API_BASE = "http://localhost:3001";
const API_BASE = configuredApiBase || (isLocalHost ? LOCAL_DEVELOPMENT_API_BASE : "");
const AUTH_TOKEN_KEY = "contractsTempAuthToken";

// Log configuration for debugging
console.log("[ClientsCRM] Configuration:", {
  hostname: window.location.hostname,
  isLocalHost,
  configuredApiBase,
  API_BASE
});

// DOM Elements
const sessionControlsEl = document.getElementById("sessionControls");
const badgeEl = document.getElementById("agentBadge");
const logoutButton = document.getElementById("logoutButton");
const clientsTableBody = document.getElementById("clientsTableBody");
const clientSearch = document.getElementById("clientSearch");
const clientSearchButton = document.getElementById("clientSearchButton");
const filterOnlyWithDocuments = document.getElementById("filterOnlyWithDocuments");
const filterOnlySigned = document.getElementById("filterOnlySigned");
const documentsModal = document.getElementById("documentsModal");
const documentsModalTitle = document.getElementById("documentsModalTitle");
const documentsModalBody = document.getElementById("documentsModalBody");
const contractModal = document.getElementById("contractModal");
const contractModalTitle = document.getElementById("contractModalTitle");
const contractModalBody = document.getElementById("contractModalBody");

let allClients = [];
let filteredClients = [];
let clientDocumentsCache = new Map(); // Cache de documentos por cliente
let contractDetailsCache = new Map(); // Cache de detalles de contratos

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

// Check authentication and load data
const initializePage = async () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    window.location.href = "./index.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.location.href = "./index.html";
      return;
    }

    const data = await response.json();
    setupUI(data);
    await loadClients();
  } catch (error) {
    log("Error verifying token:", error);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    window.location.href = "./index.html";
  }
};

const setupUI = (user) => {
  if (sessionControlsEl) {
    sessionControlsEl.classList.remove("hidden");
    
    // Mark active tab
    const navTabs = sessionControlsEl.querySelectorAll(".nav-tab");
    const currentPage = window.location.pathname.split("/").pop() || "clientes.html";
    navTabs.forEach((tab) => {
      const href = tab.getAttribute("href");
      const tabPage = href ? href.split("/").pop() : "index.html";
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
  window.location.href = "./index.html";
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
      clientsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px">
            Error al cargar clientes. Intenta recargar la página.
          </td>
        </tr>
      `;
      return;
    }

    const data = await response.json();
    allClients = data.items || [];
    filteredClients = [...allClients];
    renderClientsTable();
  } catch (error) {
    log("Error loading clients:", error);
    clientsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px">
          Error de conexión. Verifica tu red e intenta de nuevo.
        </td>
      </tr>
    `;
  }
};

// Rendering
const renderClientsTable = () => {
  if (!clientsTableBody) return;
  
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
      // Generar lista de contratos como botones clickeables
      const contractLinks = client.contracts
        .map((c) => `<button class="contract-link" data-action="view-contract" data-contract-id="${escapeAttr(c.id)}" data-contract-number="${escapeAttr(c.contractNumber)}">${escapeHtml(c.contractNumber)}</button>`)
        .join(", ");

      // Verificar si tiene documentos de cédula
      const hasCedula = client.contracts.some((c) => 
        c.documents.some((d) => 
          (d.originalFileName || "").toLowerCase().includes("cedula") ||
          (d.originalFileName || "").toLowerCase().includes("cédula")
        )
      );

      // Verificar si tiene documentos de pasaporte
      const hasPasaporte = client.contracts.some((c) => 
        c.documents.some((d) => 
          (d.originalFileName || "").toLowerCase().includes("pasaporte") ||
          (d.originalFileName || "").toLowerCase().includes("passport")
        )
      );

      return `
        <tr>
          <td><strong>${escapeHtml(client.fullName)}</strong></td>
          <td>${escapeHtml(client.idNumber || "-")}</td>
          <td>${escapeHtml(client.email || "-")}</td>
          <td>${escapeHtml(client.phone || "-")}</td>
          <td>${contractLinks || "-"}</td>
          <td style="text-align: center">
            ${hasCedula ? `<button class="btn-icon" data-action="view-cedula" data-client-id="${escapeAttr(client.id)}" title="Ver cédula">👁️</button>` : "-"}
          </td>
          <td style="text-align: center">
            ${hasPasaporte ? `<button class="btn-icon" data-action="view-pasaporte" data-client-id="${escapeAttr(client.id)}" title="Ver pasaporte">👁️</button>` : "-"}
          </td>
        </tr>
      `;
    })
    .join("");
};

// Cargar documentos de un cliente (con caché)
const loadClientDocuments = async (clientId) => {
  if (clientDocumentsCache.has(clientId)) {
    return clientDocumentsCache.get(clientId);
  }

  const client = allClients.find((c) => c.id === clientId);
  if (!client) return [];

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return [];

  let allDocuments = [];
  const seenUrls = new Set(); // Deduplicar por URL
  
  for (const contract of client.contracts) {
    try {
      const response = await fetch(`${API_BASE}/contracts/${contract.id}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const docs = data.documents || [];
        
        // Solo agregar documentos únicos
        for (const doc of docs) {
          if (doc.url && !seenUrls.has(doc.url)) {
            seenUrls.add(doc.url);
            allDocuments.push(doc);
          }
        }
      }
    } catch (error) {
      log("Error loading contract files:", error);
    }
  }

  clientDocumentsCache.set(clientId, allDocuments);
  return allDocuments;
};

// Ver documentos de cédula
const viewCedulaDocuments = async (clientId) => {
  const client = allClients.find((c) => c.id === clientId);
  if (!client) return;

  const allDocs = await loadClientDocuments(clientId);
  const cedulaDocs = allDocs.filter((doc) => 
    (doc.originalFileName || "").toLowerCase().includes("cedula") ||
    (doc.originalFileName || "").toLowerCase().includes("cédula")
  );

  if (cedulaDocs.length === 0) {
    documentsModalBody.innerHTML = `<p class="history-empty">No hay documentos de cédula para este cliente.</p>`;
  } else {
    documentsModalBody.innerHTML = renderDocuments(cedulaDocs);
  }

  documentsModalTitle.textContent = `Cédula - ${client.fullName}`;
  documentsModal.classList.remove("hidden");
  documentsModal.setAttribute("aria-hidden", "false");
};

// Ver documentos de pasaporte
const viewPasaporteDocuments = async (clientId) => {
  const client = allClients.find((c) => c.id === clientId);
  if (!client) return;

  const allDocs = await loadClientDocuments(clientId);
  const pasaporteDocs = allDocs.filter((doc) => 
    (doc.originalFileName || "").toLowerCase().includes("pasaporte") ||
    (doc.originalFileName || "").toLowerCase().includes("passport")
  );

  if (pasaporteDocs.length === 0) {
    documentsModalBody.innerHTML = `<p class="history-empty">No hay documentos de pasaporte para este cliente.</p>`;
  } else {
    documentsModalBody.innerHTML = renderDocuments(pasaporteDocs);
  }

  documentsModalTitle.textContent = `Pasaporte - ${client.fullName}`;
  documentsModal.classList.remove("hidden");
  documentsModal.setAttribute("aria-hidden", "false");
};

// Renderizar documentos
const renderDocuments = (docs) => {
  return `
    <div class="doc-grid">
      ${docs
        .map((doc) => {
          const mime = String(doc.mimeType || "").toLowerCase();
          const label = escapeHtml(doc.originalFileName || "Documento");

          if (mime.startsWith("image/")) {
            return `
              <article class="viewer-doc-card">
                <p class="viewer-doc-card-title">${label}</p>
                <img src="${escapeAttr(doc.url)}" alt="${label}" loading="lazy" style="max-width: 100%; height: auto; border-radius: 8px;" />
              </article>
            `;
          }

          if (mime === "application/pdf") {
            return `
              <article class="viewer-doc-card">
                <p class="viewer-doc-card-title">${label}</p>
                <embed src="${escapeAttr(doc.url)}" type="application/pdf" style="width: 100%; height: 600px;" />
              </article>
            `;
          }

          return `
            <article class="viewer-doc-card">
              <p class="viewer-doc-card-title">${label}</p>
              <a href="${escapeAttr(doc.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Ver documento</a>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
};

// Ver detalles de un contrato
const viewContractDetails = async (contractId, contractNumber) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;

  // Mostrar loading
  contractModalTitle.textContent = `Contrato ${contractNumber}`;
  contractModalBody.innerHTML = `<p class="history-empty">Cargando detalles del contrato...</p>`;
  contractModal.classList.remove("hidden");
  contractModal.setAttribute("aria-hidden", "false");

  // Check cache
  if (contractDetailsCache.has(contractId)) {
    const details = contractDetailsCache.get(contractId);
    renderContractDetails(details, contractNumber);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/contracts/${contractId}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      contractModalBody.innerHTML = `<p class="history-empty">Error al cargar el contrato.</p>`;
      return;
    }

    const details = await response.json();
    contractDetailsCache.set(contractId, details);
    renderContractDetails(details, contractNumber);
  } catch (error) {
    log("Error loading contract details:", error);
    contractModalBody.innerHTML = `<p class="history-empty">Error de conexión al cargar el contrato.</p>`;
  }
};

// Renderizar detalles del contrato en el modal
const renderContractDetails = (details, contractNumber) => {
  const contract = details;
  const status = contract.status === "SIGNED" ? "✅ Firmado" : "⏳ Pendiente de firma";
  const signedDate = contract.signedAt 
    ? new Date(contract.signedAt).toLocaleDateString("es-CR", { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : "-";

  const signedPdfUrl = contract.signedPdf?.url || null;

  let html = `
    <div class="contract-detail-panel">
      <div class="detail-section">
        <h3>Información del Contrato</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Número:</label>
            <p><strong>${escapeHtml(contractNumber)}</strong></p>
          </div>
          <div class="detail-item">
            <label>Estado:</label>
            <p>${status}</p>
          </div>
          ${signedDate !== "-" ? `
          <div class="detail-item">
            <label>Fecha de Firma:</label>
            <p>${signedDate}</p>
          </div>
          ` : ""}
        </div>
      </div>

      ${signedPdfUrl ? `
      <div class="detail-section">
        <div class="contract-docs-actions">
          <a href="${escapeAttr(signedPdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-accent" style="font-size: 1.1rem; padding: 12px 24px;">✅ Ver Contrato Firmado</a>
        </div>
      </div>
      ` : `
      <div class="detail-section">
        <p class="history-empty">Este contrato aún no ha sido firmado.</p>
      </div>
      `}
    </div>
  `;

  contractModalBody.innerHTML = html;
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
if (clientSearchButton) clientSearchButton.addEventListener("click", applyFilters);
if (clientSearch) {
  clientSearch.addEventListener("keyup", (e) => {
    if (e.key === "Enter") applyFilters();
  });
}

if (filterOnlyWithDocuments) filterOnlyWithDocuments.addEventListener("change", applyFilters);
if (filterOnlySigned) filterOnlySigned.addEventListener("change", applyFilters);

if (clientsTableBody) {
  clientsTableBody.addEventListener("click", (event) => {
    const action = event.target.getAttribute("data-action");
    const clientId = event.target.getAttribute("data-client-id");
    const contractId = event.target.getAttribute("data-contract-id");
    const contractNumber = event.target.getAttribute("data-contract-number");

    if (action === "view-cedula") {
      viewCedulaDocuments(clientId);
    } else if (action === "view-pasaporte") {
      viewPasaporteDocuments(clientId);
    } else if (action === "view-contract") {
      viewContractDetails(contractId, contractNumber);
    }
  });
}

// Modal close handlers
if (documentsModal) {
  const closeDocumentsBtn = documentsModal.querySelector("[data-action='close']");
  if (closeDocumentsBtn) {
    closeDocumentsBtn.addEventListener("click", () => {
      documentsModal.classList.add("hidden");
      documentsModal.setAttribute("aria-hidden", "true");
    });
  }
  
  const overlay = documentsModal.querySelector(".modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", () => {
      documentsModal.classList.add("hidden");
      documentsModal.setAttribute("aria-hidden", "true");
    });
  }
}

if (contractModal) {
  const closeContractBtn = contractModal.querySelector("[data-action='close-contract']");
  if (closeContractBtn) {
    closeContractBtn.addEventListener("click", () => {
      contractModal.classList.add("hidden");
      contractModal.setAttribute("aria-hidden", "true");
    });
  }
  
  const overlay = contractModal.querySelector(".modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", () => {
      contractModal.classList.add("hidden");
      contractModal.setAttribute("aria-hidden", "true");
    });
  }
}

if (logoutButton) {
  logoutButton.addEventListener("click", handleLogout);
}

// Initialize page
initializePage();

initializePage