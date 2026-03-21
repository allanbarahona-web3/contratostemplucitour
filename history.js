const historySearchInput = document.getElementById("historySearch");
const historySearchButton = document.getElementById("historySearchButton");
const historyTableBody = document.getElementById("historyTableBody");
const viewerModal = document.getElementById("viewerModal");
const viewerTitle = document.getElementById("viewerTitle");
const viewerBody = document.getElementById("viewerBody");
const viewerCloseButton = document.getElementById("viewerCloseButton");

const AUTH_TOKEN_KEY = "contractsTempAuthToken";
const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const LOCAL_DEVELOPMENT_API_BASE = "http://localhost:3001";
const API_BASE = configuredApiBase || (isLocalHost ? LOCAL_DEVELOPMENT_API_BASE : "");

let searchDebounce = null;
const filesCache = new Map();

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

const apiFetch = async (path, options = {}) => {
  if (!API_BASE) {
    throw new Error("No hay API configurada.");
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
    const msg = payload.message || "No se pudo completar la solicitud.";
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }

  return payload;
};

const getDocKind = (doc) => {
  const name = String(doc?.originalFileName || "").toLowerCase();
  if (name.includes("cedula-frente") || name.includes("cedula_front")) return "cedula-front";
  if (name.includes("cedula-reverso") || name.includes("cedula_back") || name.includes("cedula-reverso")) {
    return "cedula-back";
  }
  if (name.includes("pasaporte") || name.includes("passport")) return "passport";
  return "other";
};

const renderHistory = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5"><p class="history-empty">No se encontraron contratos.</p></td>
      </tr>
    `;
    return;
  }

  historyTableBody.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td>
            <div class="history-col-name">${escapeHtml(item.clientFullName)}</div>
            <div class="history-col-muted">${escapeHtml(formatDateTime(item.createdAt))}</div>
          </td>
          <td>${escapeHtml(item.clientIdNumber)}</td>
          <td>${escapeHtml(item.clientEmail)}</td>
          <td>${escapeHtml(item.contractNumber)}</td>
          <td>
            <div class="history-actions">
              <button type="button" class="ghost" data-action="contract" data-contract-id="${escapeAttr(item.id)}">Contrato</button>
              <button type="button" class="ghost" data-action="cedula" data-contract-id="${escapeAttr(item.id)}">Cedula</button>
              <button type="button" class="ghost" data-action="passport" data-contract-id="${escapeAttr(item.id)}">Pasaporte</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
};

const closeViewer = () => {
  viewerModal.classList.add("hidden");
  viewerModal.setAttribute("aria-hidden", "true");
  viewerBody.innerHTML = "";
};

const openViewer = (title, docs = []) => {
  viewerTitle.textContent = title;

  if (!docs.length) {
    viewerBody.innerHTML = '<p class="history-empty">No hay documentos disponibles para esta opcion.</p>';
  } else {
    viewerBody.innerHTML = docs
      .map((doc) => {
        const mime = String(doc.mimeType || "").toLowerCase();
        const label = escapeHtml(doc.originalFileName || "Documento");
        if (mime.startsWith("image/")) {
          return `
            <article class="viewer-doc">
              <p class="viewer-doc-title">${label}</p>
              <img src="${escapeAttr(doc.url)}" alt="${label}" loading="lazy" />
            </article>
          `;
        }

        return `
          <article class="viewer-doc">
            <p class="viewer-doc-title">${label}</p>
            <iframe src="${escapeAttr(doc.url)}" title="${label}"></iframe>
          </article>
        `;
      })
      .join("");
  }

  viewerModal.classList.remove("hidden");
  viewerModal.setAttribute("aria-hidden", "false");
};

const loadContractHistory = async (query = "") => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    window.location.href = "./index.html";
    return;
  }

  historyTableBody.innerHTML = `
    <tr>
      <td colspan="5"><p class="history-empty">Cargando historial...</p></td>
    </tr>
  `;

  const params = new URLSearchParams();
  const q = String(query || "").trim();
  if (q) params.set("q", q);
  params.set("limit", "60");

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const result = await apiFetch(`/contracts${suffix}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  renderHistory(result.items || []);
};

const openContractFiles = async (contractId) => {
  if (filesCache.has(contractId)) {
    return filesCache.get(contractId);
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    window.location.href = "./index.html";
    return null;
  }

  const files = await apiFetch(`/contracts/${contractId}/files`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  filesCache.set(contractId, files);
  return files;
};

historySearchButton.addEventListener("click", () => {
  void loadContractHistory(historySearchInput.value || "").catch((error) => {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5"><p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p></td>
      </tr>
    `;
  });
});

historySearchInput.addEventListener("input", () => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
  searchDebounce = setTimeout(() => {
    void loadContractHistory(historySearchInput.value || "").catch((error) => {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5"><p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p></td>
        </tr>
      `;
    });
  }, 260);
});

historyTableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches("button[data-action]")) {
    const contractId = target.getAttribute("data-contract-id");
    if (!contractId) {
      return;
    }

    const action = target.getAttribute("data-action");

    const oldLabel = target.textContent;
    target.setAttribute("disabled", "true");
    target.textContent = "Abriendo...";

    void openContractFiles(contractId)
      .then((files) => {
        if (!files) {
          return;
        }

        const docs = Array.isArray(files.documents) ? files.documents : [];
        const docsWithKind = docs.map((doc) => ({ ...doc, kind: getDocKind(doc) }));

        if (action === "contract") {
          openViewer("Contrato", files.pdf?.url ? [files.pdf] : []);
          return;
        }

        if (action === "cedula") {
          const idDocs = docsWithKind.filter((doc) => doc.kind === "cedula-front" || doc.kind === "cedula-back");
          openViewer("Cedula (frente y reverso)", idDocs);
          return;
        }

        if (action === "passport") {
          const passDocs = docsWithKind.filter((doc) => doc.kind === "passport");
          openViewer("Pasaporte", passDocs);
        }
      })
      .catch((error) => {
        viewerBody.innerHTML = `<p class="history-empty">${escapeHtml(error.message || "No se pudieron abrir los archivos.")}</p>`;
        viewerModal.classList.remove("hidden");
        viewerModal.setAttribute("aria-hidden", "false");
      })
      .finally(() => {
        target.removeAttribute("disabled");
        target.textContent = oldLabel;
      });
  }
});

viewerCloseButton.addEventListener("click", closeViewer);
viewerModal.addEventListener("click", (event) => {
  if (event.target === viewerModal) {
    closeViewer();
  }
});

void loadContractHistory("").catch((error) => {
  historyTableBody.innerHTML = `
    <tr>
      <td colspan="5"><p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p></td>
    </tr>
  `;
});
