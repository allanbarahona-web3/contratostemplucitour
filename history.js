const historySearchInput = document.getElementById("historySearch");
const historySearchButton = document.getElementById("historySearchButton");
const historyTableBody = document.getElementById("historyTableBody");
const viewerModal = document.getElementById("viewerModal");
const viewerPanel = document.getElementById("viewerPanel");
const viewerTitle = document.getElementById("viewerTitle");
const viewerBody = document.getElementById("viewerBody");
const viewerCloseButton = document.getElementById("viewerCloseButton");
const signatureModal = document.getElementById("signatureModal");
const signaturePanel = document.getElementById("signaturePanel");
const signatureCloseButton = document.getElementById("signatureCloseButton");
const signatureClearButton = document.getElementById("signatureClearButton");
const signatureSaveButton = document.getElementById("signatureSaveButton");
const signatureCanvas = document.getElementById("signatureCanvas");
const signedByNameInput = document.getElementById("signedByName");

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
let signingContractId = null;
let signatureDirty = false;
let isDrawingSignature = false;
let signatureLastPoint = null;

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

const apiFetchMultipart = async (path, formData, token) => {
  if (!API_BASE) {
    throw new Error("No hay API configurada.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
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
        <td colspan="6"><p class="history-empty">No se encontraron contratos.</p></td>
      </tr>
    `;
    return;
  }

  historyTableBody.innerHTML = items
    .map((item) => {
      const state = statusLabel(item.status);
      const canSign = String(item.status || "").toUpperCase() !== STATUS_SIGNED;
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
              <button type="button" class="ghost" data-action="cedula" data-contract-id="${escapeAttr(item.id)}">Cedula</button>
              <button type="button" class="ghost" data-action="passport" data-contract-id="${escapeAttr(item.id)}">Pasaporte</button>
              ${
                canSign
                  ? `<button type="button" class="ghost" data-action="sign" data-contract-id="${escapeAttr(item.id)}" data-client-name="${escapeAttr(item.clientFullName)}">Firmar cliente</button>`
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

const closeSignatureModal = () => {
  if (signatureModal) {
    signatureModal.classList.add("hidden");
    signatureModal.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("viewer-open");
  signingContractId = null;
  signatureDirty = false;
  if (signedByNameInput) {
    signedByNameInput.value = "";
  }
  clearSignatureCanvas();
};

const openSignatureModal = (contractId, clientName = "") => {
  signingContractId = contractId;
  signatureDirty = false;
  clearSignatureCanvas();
  if (signedByNameInput) {
    signedByNameInput.value = clientName || "";
  }
  if (signatureModal) {
    signatureModal.classList.remove("hidden");
    signatureModal.setAttribute("aria-hidden", "false");
  }
  document.body.classList.add("viewer-open");
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

const clearSignatureCanvas = () => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) {
    return;
  }
  const ctx = signatureCanvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
};

const getCanvasPoint = (event) => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) {
    return { x: 0, y: 0 };
  }
  const rect = signatureCanvas.getBoundingClientRect();
  const touch = event.touches?.[0] || event.changedTouches?.[0] || null;
  const clientX = touch ? touch.clientX : event.clientX;
  const clientY = touch ? touch.clientY : event.clientY;
  const x = ((clientX - rect.left) / rect.width) * signatureCanvas.width;
  const y = ((clientY - rect.top) / rect.height) * signatureCanvas.height;
  return { x, y };
};

const drawSignatureSegment = (from, to) => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) {
    return;
  }
  const ctx = signatureCanvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#123f79";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

const beginSignatureDraw = (event) => {
  isDrawingSignature = true;
  signatureLastPoint = getCanvasPoint(event);
  signatureDirty = true;
};

const moveSignatureDraw = (event) => {
  if (!isDrawingSignature) {
    return;
  }
  event.preventDefault();
  const nextPoint = getCanvasPoint(event);
  drawSignatureSegment(signatureLastPoint, nextPoint);
  signatureLastPoint = nextPoint;
};

const endSignatureDraw = () => {
  isDrawingSignature = false;
  signatureLastPoint = null;
};

const signatureCanvasToPngBytes = async () => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) {
    throw new Error("No se encontro el lienzo de firma.");
  }

  const blob = await new Promise((resolve, reject) => {
    signatureCanvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("No se pudo preparar la firma."));
          return;
        }
        resolve(result);
      },
      "image/png",
      1,
    );
  });

  return new Uint8Array(await blob.arrayBuffer());
};

const buildSignedPdfBlob = async (pdfUrl) => {
  if (!window.PDFLib) {
    throw new Error("No se cargo la libreria de firma PDF.");
  }

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error("No se pudo cargar el PDF base para firma.");
  }

  const pdfBytes = new Uint8Array(await response.arrayBuffer());
  const { PDFDocument, rgb } = window.PDFLib;
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const signaturePng = await signatureCanvasToPngBytes();
  const signatureImage = await pdfDoc.embedPng(signaturePng);

  const page = pdfDoc.getPages()[0];
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const signWidth = Math.min(180, pageWidth * 0.28);
  const signHeight = (signatureImage.height / signatureImage.width) * signWidth;
  const signX = Math.max(40, pageWidth * 0.08);
  const signY = Math.max(70, pageHeight * 0.12);

  page.drawImage(signatureImage, {
    x: signX,
    y: signY,
    width: signWidth,
    height: signHeight,
  });

  page.drawText("Firma cliente", {
    x: signX,
    y: Math.max(52, signY - 14),
    size: 9,
    color: rgb(0.2, 0.29, 0.42),
  });

  const signedBytes = await pdfDoc.save();
  return new Blob([signedBytes], { type: "application/pdf" });
};

const finalizeContractSignature = async () => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error("Tu sesion no esta activa.");
  }

  if (!signingContractId) {
    throw new Error("No hay contrato seleccionado para firmar.");
  }

  const signedByName = String(signedByNameInput?.value || "").trim();
  if (!signedByName) {
    throw new Error("Debes indicar el nombre de la persona que firma.");
  }

  if (!signatureDirty) {
    throw new Error("Debes dibujar la firma del cliente antes de guardar.");
  }

  const files = await openContractFiles(signingContractId);
  const sourcePdfUrl = files?.signedPdf?.url || files?.pdf?.url;
  if (!sourcePdfUrl) {
    throw new Error("No se encontro el PDF base del contrato.");
  }

  const signedPdfBlob = await buildSignedPdfBlob(sourcePdfUrl);
  const uploadPayload = new FormData();
  uploadPayload.append("signedByName", signedByName);
  uploadPayload.append("signedPdfFile", signedPdfBlob, `${files.contractNumber || "contrato"}-signed.pdf`);

  await apiFetchMultipart(`/contracts/${signingContractId}/finalize-signature`, uploadPayload, token);
  filesCache.delete(signingContractId);
  closeSignatureModal();
  await loadContractHistory(historySearchInput.value || "");
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
          openViewer("Contrato", (files.signedPdf?.url ? [files.signedPdf] : files.pdf?.url ? [files.pdf] : []));
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
          return;
        }

        if (action === "sign") {
          openSignatureModal(contractId, target.getAttribute("data-client-name") || "");
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

if (signatureCanvas instanceof HTMLCanvasElement) {
  signatureCanvas.addEventListener("mousedown", beginSignatureDraw);
  signatureCanvas.addEventListener("mousemove", moveSignatureDraw);
  signatureCanvas.addEventListener("mouseup", endSignatureDraw);
  signatureCanvas.addEventListener("mouseleave", endSignatureDraw);
  signatureCanvas.addEventListener("touchstart", beginSignatureDraw, { passive: false });
  signatureCanvas.addEventListener("touchmove", moveSignatureDraw, { passive: false });
  signatureCanvas.addEventListener("touchend", endSignatureDraw);
}

if (signatureClearButton) {
  signatureClearButton.addEventListener("click", () => {
    signatureDirty = false;
    clearSignatureCanvas();
  });
}

if (signatureCloseButton) {
  signatureCloseButton.addEventListener("click", closeSignatureModal);
}

if (signatureModal) {
  signatureModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (signaturePanel && !signaturePanel.contains(target)) {
      closeSignatureModal();
    }
  });
}

if (signatureSaveButton) {
  signatureSaveButton.addEventListener("click", () => {
    const oldLabel = signatureSaveButton.textContent;
    signatureSaveButton.textContent = "Guardando...";
    signatureSaveButton.setAttribute("disabled", "true");

    void finalizeContractSignature()
      .catch((error) => {
        viewerBody.innerHTML = `<p class="history-empty">${escapeHtml(error.message || "No se pudo guardar la firma.")}</p>`;
        viewerTitle.textContent = "Firma de contrato";
        viewerModal.classList.remove("hidden");
        viewerModal.setAttribute("aria-hidden", "false");
      })
      .finally(() => {
        signatureSaveButton.textContent = oldLabel;
        signatureSaveButton.removeAttribute("disabled");
      });
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !viewerModal.classList.contains("hidden")) {
    closeViewer();
  }

  if (event.key === "Escape" && signatureModal && !signatureModal.classList.contains("hidden")) {
    closeSignatureModal();
  }
});

void loadContractHistory("").catch((error) => {
  historyTableBody.innerHTML = `
    <tr>
      <td colspan="6"><p class="history-empty">${escapeHtml(error.message || "Error cargando historial.")}</p></td>
    </tr>
  `;
});
