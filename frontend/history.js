const historySearchInput = document.getElementById("historySearch");
const historySearchButton = document.getElementById("historySearchButton");
const historyTableBody = document.getElementById("historyTableBody");
const viewerModal = document.getElementById("viewerModal");
const viewerPanel = document.getElementById("viewerPanel");
const viewerTitle = document.getElementById("viewerTitle");
const viewerBody = document.getElementById("viewerBody");
const viewerCloseButton = document.getElementById("viewerCloseButton");

const AUTH_TOKEN_KEY = "contractsTempAuthToken";
const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const LOCAL_DEVELOPMENT_API_BASE = "http://localhost:3001";
const API_BASE = configuredApiBase || (isLocalHost ? LOCAL_DEVELOPMENT_API_BASE : "");
const STATUS_PENDING_SIGNATURE = "PENDING_SIGNATURE";
const STATUS_SIGNED = "SIGNED";

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

const statusLabel = (status) => {
  const normalized = String(status || STATUS_PENDING_SIGNATURE).trim().toUpperCase();
  if (normalized === STATUS_SIGNED) {
    return { text: "Firmado", className: "status-signed" };
  }
  return { text: "Pendiente", className: "status-pending" };
};

const getDocKind = (doc) => {
  const name = String(doc?.originalFileName || "").toLowerCase();
  
  // Detectar persona y tipo de documento
  if (name.includes("titular-")) {
    if (name.includes("cedula-frente") || name.includes("cedula_front")) return "titular-cedula-front";
    if (name.includes("cedula-reverso") || name.includes("cedula_back")) return "titular-cedula-back";
    if (name.includes("pasaporte") || name.includes("passport")) return "titular-passport";
  }
  
  // Acompañantes (acompanante1, acompanante2, etc.)
  const companionMatch = name.match(/acompanante(\d+)/);
  if (companionMatch) {
    const num = companionMatch[1];
    if (name.includes("cedula-frente") || name.includes("cedula_front")) return `companion${num}-cedula-front`;
    if (name.includes("cedula-reverso") || name.includes("cedula_back")) return `companion${num}-cedula-back`;
    if (name.includes("pasaporte") || name.includes("passport")) return `companion${num}-passport`;
  }
  
  // Menores y tutores (menor1-tutor-cedula-frente, menor1-cedula-frente, etc.)
  const minorMatch = name.match(/menor(\d+)/);
  if (minorMatch) {
    const num = minorMatch[1];
    if (name.includes("tutor-")) {
      if (name.includes("cedula-frente") || name.includes("cedula_front")) return `minor${num}-tutor-cedula-front`;
      if (name.includes("cedula-reverso") || name.includes("cedula_back")) return `minor${num}-tutor-cedula-back`;
      if (name.includes("pasaporte") || name.includes("passport")) return `minor${num}-tutor-passport`;
    } else {
      if (name.includes("cedula-frente") || name.includes("cedula_front")) return `minor${num}-cedula-front`;
      if (name.includes("cedula-reverso") || name.includes("cedula_back")) return `minor${num}-cedula-back`;
      if (name.includes("pasaporte") || name.includes("passport")) return `minor${num}-passport`;
    }
  }
  
  // Documentos viejos (compatibilidad)
  if (name.includes("cedula-frente") || name.includes("cedula_front")) return "cedula-front";
  if (name.includes("cedula-reverso") || name.includes("cedula_back")) return "cedula-back";
  if (name.includes("pasaporte") || name.includes("passport")) return "passport";
  
  return "other";
};

const renderHistory = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="6"><p class="history-empty">No se encontraron contratos.</p></td>
      </tr>
    `;
    return;
  }

  historyTableBody.innerHTML = items
    .map((item) => {
      const state = statusLabel(item.status);
      const isSigned = String(item?.status || "").trim().toUpperCase() === STATUS_SIGNED;
      return `
        <tr>
          <td>
            <div class="history-col-name">${escapeHtml(item.clientFullName)}</div>
            <div class="history-col-muted">${escapeHtml(formatDateTime(item.createdAt))}</div>
          </td>
          <td>${escapeHtml(item.clientIdNumber)}</td>
          <td>${escapeHtml(item.clientEmail)}</td>
          <td>${escapeHtml(item.contractNumber)}</td>
          <td><span class="contract-status ${escapeHtml(state.className)}">${escapeHtml(state.text)}</span></td>
          <td>
            <div class="history-actions">
              <button type="button" class="ghost" data-action="contract" data-contract-id="${escapeAttr(item.id)}">Contrato</button>
              <button type="button" class="ghost" data-action="documents" data-contract-id="${escapeAttr(item.id)}">Documentos</button>
              ${
                isSigned
                  ? `<button type="button" class="ghost" data-action="resend-signed" data-contract-id="${escapeAttr(item.id)}">Reenviar firmado</button>
                     <button type="button" class="ghost" data-action="send-billing" data-contract-id="${escapeAttr(item.id)}">📤 Enviar a Facturación</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
};

const closeViewer = () => {
  viewerModal.classList.add("hidden");
  viewerModal.setAttribute("aria-hidden", "true");
  viewerBody.innerHTML = "";
  document.body.classList.remove("viewer-open");
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
  document.body.classList.add("viewer-open");
};

const loadContractHistory = async (query = "") => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    window.location.href = "./index.html";
    return;
  }

  historyTableBody.innerHTML = `
    <tr>
      <td colspan="6"><p class="history-empty">Cargando historial...</p></td>
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
        <td colspan="6"><p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p></td>
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
          <td colspan="6"><p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p></td>
        </tr>
      `;
    });
  }, 260);
});

const openDocumentsByPerson = (docsWithKind) => {
  // Agrupar documentos por persona
  const titular = {
    name: "Titular",
    docs: docsWithKind.filter((doc) => doc.kind.startsWith("titular-")),
  };
  
  const companions = {};
  const minors = {};
  
  docsWithKind.forEach((doc) => {
    const companionMatch = doc.kind.match(/^companion(\d+)-/);
    if (companionMatch) {
      const num = companionMatch[1];
      if (!companions[num]) companions[num] = [];
      companions[num].push(doc);
    }
    
    const minorMatch = doc.kind.match(/^minor(\d+)-/);
    if (minorMatch) {
      const num = minorMatch[1];
      if (!minors[num]) minors[num] = { minor: [], tutor: [] };
      if (doc.kind.includes("-tutor-")) {
        minors[num].tutor.push(doc);
      } else {
        minors[num].minor.push(doc);
      }
    }
  });
  
  // Documentos viejos sin categorizar por persona
  const otherDocs = docsWithKind.filter((doc) => 
    doc.kind === "cedula-front" || doc.kind === "cedula-back" || 
    doc.kind === "passport" || doc.kind === "other"
  );
  
  // Construir HTML
  let html = "";
  
  if (titular.docs.length > 0) {
    html += `<div class="doc-person-group">
      <h4>Titular</h4>
      <div class="doc-grid">
        ${titular.docs.map((doc) => renderDocumentCard(doc)).join("")}
      </div>
    </div>`;
  }
  
  Object.keys(companions).sort().forEach((num) => {
    html += `<div class="doc-person-group">
      <h4>Acompañante ${num}</h4>
      <div class="doc-grid">
        ${companions[num].map((doc) => renderDocumentCard(doc)).join("")}
      </div>
    </div>`;
  });
  
  Object.keys(minors).sort().forEach((num) => {
    const minor = minors[num];
    html += `<div class="doc-person-group">
      <h4>Menor ${num}</h4>`;
    
    if (minor.minor.length > 0) {
      html += `<h5>Documentos del menor</h5>
        <div class="doc-grid">
          ${minor.minor.map((doc) => renderDocumentCard(doc)).join("")}
        </div>`;
    }
    
    if (minor.tutor.length > 0) {
      html += `<h5>Documentos del tutor</h5>
        <div class="doc-grid">
          ${minor.tutor.map((doc) => renderDocumentCard(doc)).join("")}
        </div>`;
    }
    
    html += `</div>`;
  });
  
  if (otherDocs.length > 0) {
    html += `<div class="doc-person-group">
      <h4>Otros documentos</h4>
      <div class="doc-grid">
        ${otherDocs.map((doc) => renderDocumentCard(doc)).join("")}
      </div>
    </div>`;
  }
  
  if (!html) {
    html = '<p class="history-empty">No hay documentos disponibles.</p>';
  }
  
  viewerTitle.textContent = "Documentos del contrato";
  viewerBody.innerHTML = html;
  viewerModal.classList.remove("hidden");
  viewerModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("viewer-open");
};

const renderDocumentCard = (doc) => {
  const mime = String(doc.mimeType || "").toLowerCase();
  const label = escapeHtml(doc.originalFileName || "Documento");
  
  if (mime.startsWith("image/")) {
    return `
      <article class="viewer-doc-card">
        <p class="viewer-doc-card-title">${label}</p>
        <img src="${escapeAttr(doc.url)}" alt="${label}" loading="lazy" />
      </article>`;
  }
  
  if (mime === "application/pdf") {
    return `
      <article class="viewer-doc-card">
        <p class="viewer-doc-card-title">${label}</p>
        <embed src="${escapeAttr(doc.url)}" type="application/pdf" />
      </article>`;
  }
  
  return `
    <article class="viewer-doc-card">
      <p class="viewer-doc-card-title">${label}</p>
      <a href="${escapeAttr(doc.url)}" target="_blank" rel="noopener noreferrer">Ver documento</a>
    </article>`;
};

const prepareContractBillingData = (contractId) => {
  // Obtener los datos necesarios del localStorage o de la tabla
  // Para esto, necesitamos tener acceso a los datos del contrato
  // Vamos a agregar un atributo data- a la fila con los datos necesarios
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  
  return fetch(`${API_BASE}/contracts/${contractId}/files`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo obtener los datos del contrato");
      return response.json();
    })
    .then((contract) => {
      // Retornar los datos en el formato esperado
      return {
        clientName: contract?.clientFullName || "",
        clientId: contract?.clientIdNumber || "",
        clientEmail: contract?.clientEmail || "",
        contractNumber: contract?.contractNumber || "",
        status: contract?.status || "",
      };
    });
};

const sendContractToBilling = async (contractId) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error("No hay sesión activa");
  }

  // Obtener datos del contrato desde history
  const rows = Array.from(historyTableBody.querySelectorAll("tr"));
  let contractData = null;
  
  for (const row of rows) {
    const button = row.querySelector(`[data-contract-id="${contractId}"]`);
    if (button) {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 5) {
        // Extraer datos de las celdas
        const nameCell = cells[0].textContent;
        const idCell = cells[1].textContent.trim();
        const emailCell = cells[2].textContent.trim();
        const contractNumberCell = cells[3].textContent.trim();
        
        contractData = {
          clientName: nameCell,
          clientId: idCell,
          clientEmail: emailCell,
          contractNumber: contractNumberCell,
          contractId: contractId,
        };
      }
      break;
    }
  }

  if (!contractData) {
    throw new Error("No se pudo obtener los datos del contrato");
  }

  // Aquí es donde enviarías a tu sistema de facturación
  // Por ahora, preparamos los datos y los mostramos
  // En una implementación real, esto se podría enviar a un endpoint del backend
  // que luego envíe a facturación

  return {
    success: true,
    billingUrl: `${window.location.origin}/facturacion?contract=${escapeAttr(contractData.contractNumber)}&client=${escapeAttr(contractData.clientName)}&email=${escapeAttr(contractData.clientEmail)}`,
    data: contractData,
  };
};


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

    if (action === "resend-signed") {
      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        window.location.href = "./index.html";
        return;
      }

      const oldLabel = target.textContent;
      target.setAttribute("disabled", "true");
      target.textContent = "Enviando...";

      void apiFetch(`/contracts/${contractId}/resend-signed-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((result) => {
          const sentCount = Number(result?.sentCount || 0);
          const failedCount = Number(result?.failedCount || 0);
          const sentTo = Array.isArray(result?.sentTo) ? result.sentTo : [];
          const failedTo = Array.isArray(result?.failedTo) ? result.failedTo : [];
          const loggedAtRaw = String(result?.dispatchLogEntry?.createdAt || "").trim();
          const loggedAt = loggedAtRaw ? formatDateTime(loggedAtRaw) : "-";

          const sentList = sentTo.length
            ? `<p><strong>Enviado a:</strong> ${escapeHtml(sentTo.join(", "))}</p>`
            : "";
          const failedList = failedTo.length
            ? `<p><strong>No enviado:</strong> ${escapeHtml(failedTo.join(", "))}</p>`
            : "";

          viewerTitle.textContent = "Reenvio de contrato firmado";
          viewerBody.innerHTML = `
            <article class="viewer-doc">
              <p class="viewer-doc-title">Resultado</p>
              <p>Se enviaron <strong>${sentCount}</strong> correos.</p>
              <p>Fallaron <strong>${failedCount}</strong> correos.</p>
              <p><strong>Registro guardado:</strong> ${escapeHtml(loggedAt)}</p>
              ${sentList}
              ${failedList}
            </article>
          `;
          viewerModal.classList.remove("hidden");
          viewerModal.setAttribute("aria-hidden", "false");
          document.body.classList.add("viewer-open");
        })
        .catch((error) => {
          viewerTitle.textContent = "Error reenviando contrato";
          viewerBody.innerHTML = `<p class="history-empty">${escapeHtml(error.message || "No se pudo reenviar el contrato firmado.")}</p>`;
          viewerModal.classList.remove("hidden");
          viewerModal.setAttribute("aria-hidden", "false");
          document.body.classList.add("viewer-open");
        })
        .finally(() => {
          target.removeAttribute("disabled");
          target.textContent = oldLabel;
        });

      return;
    }

    if (action === "send-billing") {
      const oldLabel = target.textContent;
      target.setAttribute("disabled", "true");
      target.textContent = "Preparando...";

      void sendContractToBilling(contractId)
        .then((result) => {
          viewerTitle.textContent = "Envío a Sistema de Facturación";
          viewerBody.innerHTML = `
            <article class="viewer-doc">
              <p class="viewer-doc-title">✅ Datos preparados para facturación</p>
              <div class="detail-grid" style="margin-top: 16px;">
                <div class="detail-item">
                  <label>Cliente:</label>
                  <p>${escapeHtml(result.data.clientName)}</p>
                </div>
                <div class="detail-item">
                  <label>Identificación:</label>
                  <p>${escapeHtml(result.data.clientId)}</p>
                </div>
                <div class="detail-item">
                  <label>Correo:</label>
                  <p>${escapeHtml(result.data.clientEmail)}</p>
                </div>
                <div class="detail-item">
                  <label>Nº Contrato:</label>
                  <p>${escapeHtml(result.data.contractNumber)}</p>
                </div>
              </div>
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--line);">
                <p><strong>Próximo paso:</strong> Los datos están listos. Dirígete al sistema de facturación para completar el proceso de pago y generar la factura.</p>
                <button type="button" class="btn btn-primary" style="margin-top: 16px;" onclick="window.open('${escapeAttr(result.billingUrl)}', '_blank')">
                  📤 Ir a Facturación
                </button>
              </div>
            </article>
          `;
          viewerModal.classList.remove("hidden");
          viewerModal.setAttribute("aria-hidden", "false");
          document.body.classList.add("viewer-open");
        })
        .catch((error) => {
          viewerTitle.textContent = "Error al preparar datos";
          viewerBody.innerHTML = `<p class="history-empty">${escapeHtml(error.message || "No se pudieron preparar los datos para facturación.")}</p>`;
          viewerModal.classList.remove("hidden");
          viewerModal.setAttribute("aria-hidden", "false");
          document.body.classList.add("viewer-open");
        })
        .finally(() => {
          target.removeAttribute("disabled");
          target.textContent = oldLabel;
        });

      return;
    }

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
          openViewer("Contrato", files.signedPdf?.url ? [files.signedPdf] : files.pdf?.url ? [files.pdf] : []);
          return;
        }

        if (action === "documents") {
          openDocumentsByPerson(docsWithKind);
          return;
        }

        // Mantener compatibilidad con botones viejos
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
        document.body.classList.add("viewer-open");
      })
      .finally(() => {
        target.removeAttribute("disabled");
        target.textContent = oldLabel;
      });
  }
});

if (viewerCloseButton) {
  viewerCloseButton.addEventListener("click", closeViewer);
}

if (viewerModal) {
  viewerModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (viewerPanel && !viewerPanel.contains(target)) {
      closeViewer();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !viewerModal.classList.contains("hidden")) {
    closeViewer();
  }
});

void loadContractHistory("").catch((error) => {
  historyTableBody.innerHTML = `
    <tr>
      <td colspan="6"><p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p></td>
    </tr>
  `;
});
