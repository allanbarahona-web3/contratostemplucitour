const historySearchInput = document.getElementById("historySearch");
const historySearchButton = document.getElementById("historySearchButton");
const historyList = document.getElementById("historyList");

const AUTH_TOKEN_KEY = "contractsTempAuthToken";
const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const LOCAL_DEVELOPMENT_API_BASE = "http://localhost:3001";
const API_BASE = configuredApiBase || (isLocalHost ? LOCAL_DEVELOPMENT_API_BASE : "");

let searchDebounce = null;

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

const renderHistory = (items = []) => {
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
            <span>Agente: ${escapeHtml(item.generatedByName || "-")}</span>
            <span>Adjuntos: ${escapeHtml(String(item.documentCount || 0))}</span>
          </div>
          <div class="history-item-actions">
            <button type="button" class="ghost" data-action="files" data-contract-id="${escapeAttr(item.id)}">Ver archivos</button>
          </div>
        </article>
      `,
    )
    .join("");
};

const loadContractHistory = async (query = "") => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    window.location.href = "./index.html";
    return;
  }

  historyList.innerHTML = '<p class="history-empty">Cargando historial...</p>';

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
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    window.location.href = "./index.html";
    return;
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

historySearchButton.addEventListener("click", () => {
  void loadContractHistory(historySearchInput.value || "").catch((error) => {
    historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p>`;
  });
});

historySearchInput.addEventListener("input", () => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
  searchDebounce = setTimeout(() => {
    void loadContractHistory(historySearchInput.value || "").catch((error) => {
      historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p>`;
    });
  }, 260);
});

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

    const oldLabel = target.textContent;
    target.setAttribute("disabled", "true");
    target.textContent = "Abriendo...";

    void openContractFiles(contractId)
      .catch((error) => {
        historyList.insertAdjacentHTML(
          "afterbegin",
          `<p class="history-empty">${escapeHtml(error.message || "No se pudieron abrir los archivos.")}</p>`,
        );
      })
      .finally(() => {
        target.removeAttribute("disabled");
        target.textContent = oldLabel;
      });
  }
});

void loadContractHistory("").catch((error) => {
  historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p>`;
});
