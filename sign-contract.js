const statusEl = document.getElementById("publicSignStatus");
const contractNumberEl = document.getElementById("publicContractNumber");
const clientNameEl = document.getElementById("publicClientName");
const contractStateEl = document.getElementById("publicContractState");
const readStep = document.getElementById("publicReadStep");
const signStep = document.getElementById("publicSignStep");
const viewContractButton = document.getElementById("publicViewContractButton");
const goToSignButton = document.getElementById("publicGoToSignButton");
const backToReadButton = document.getElementById("publicBackToReadButton");
const contractViewer = document.getElementById("publicContractViewer");
const contractFrame = document.getElementById("publicContractFrame");
const signedByNameLabel = document.getElementById("publicSignedByNameLabel");
const signatureCanvas = document.getElementById("publicSignatureCanvas");
const clearButton = document.getElementById("publicSignatureClear");
const submitButton = document.getElementById("publicSignatureSubmit");

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBaseUrl(window.APP_CONFIG?.API_BASE);
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = configuredApiBase || (isLocalHost ? "http://localhost:3001" : "");

const getSignaturePlacementConfig = () => {
  const cfg = window.APP_CONFIG?.SIGNATURE_PLACEMENT || {};
  const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    anchorOffsetX: toNumber(cfg.ANCHOR_OFFSET_X, 8),
    anchorOffsetY: toNumber(cfg.ANCHOR_OFFSET_Y, 34),
    fallbackXRatio: toNumber(cfg.FALLBACK_X_RATIO, 0.1),
    fallbackYRatio: toNumber(cfg.FALLBACK_Y_RATIO, 0.085),
    widthRatio: toNumber(cfg.WIDTH_RATIO, 0.34),
    maxWidth: toNumber(cfg.MAX_WIDTH, 220),
    pagePadding: toNumber(cfg.PAGE_PADDING, 24),
    boxScale: toNumber(cfg.BOX_SCALE, 0.9),
    boxInset: toNumber(cfg.BOX_INSET, 4),
    boxOffsetX: toNumber(cfg.BOX_OFFSET_X, 0),
    boxOffsetY: toNumber(cfg.BOX_OFFSET_Y, 0),
  };
};

const getSessionSignatureAnchor = () => {
  const anchor = sessionData?.signatureAnchor;
  if (!anchor || typeof anchor !== "object") {
    return null;
  }

  const pageIndex = Number(anchor.pageIndex);
  const box = anchor.box;
  if (!box || typeof box !== "object") {
    return null;
  }

  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![pageIndex, x, y, width, height].every(Number.isFinite)) {
    return null;
  }
  if (width <= 0 || height <= 0 || pageIndex < 0) {
    return null;
  }

  return {
    pageIndex,
    box: { x, y, width, height },
  };
};

let sessionToken = "";
let sessionData = null;
let signatureDirty = false;
let isDrawing = false;
let lastPoint = null;
let contractPdfObjectUrl = "";
let sourcePdfBytesCache = null;

const toStatusClass = (kind) => {
  if (kind === "success") return "status-ok";
  if (kind === "error") return "status-error";
  return "";
};

const setStatus = (message, kind = "info") => {
  statusEl.textContent = String(message || "");
  statusEl.classList.remove("status-ok", "status-error");
  const className = toStatusClass(kind);
  if (className) {
    statusEl.classList.add(className);
  }
};

const finishSigningExperience = () => {
  const finalMessage = "Muchas gracias por enviarnos tu contrato firmado. Estaremos en contacto pronto.";
  setStatus(finalMessage, "success");

  const appRoot = document.querySelector("main");
  if (appRoot) {
    appRoot.innerHTML = `
      <section class="panel history-main-panel public-sign-finish-panel">
        <div class="public-sign-finish-accent" aria-hidden="true"></div>
        <header class="panel-header public-sign-finish-header">
          <p class="kicker">Contrato recibido</p>
          <h1>Gracias por firmar</h1>
          <p class="public-sign-finish-message">${finalMessage}</p>
          <p class="public-sign-finish-submessage">Nuestro equipo validara el documento y te contactaremos en breve.</p>
        </header>
        <div class="public-sign-finish-actions">
          <button id="publicSignCloseButton" type="button">Cerrar ventana</button>
          <p id="publicSignCloseHint" class="public-sign-finish-hint">Si tu navegador no permite cerrar la pestaña automaticamente, puedes cerrarla manualmente.</p>
        </div>
      </section>
    `;

    const closeButton = document.getElementById("publicSignCloseButton");
    const closeHint = document.getElementById("publicSignCloseHint");
    closeButton?.addEventListener("click", () => {
      try {
        window.close();
      } catch {
        // ignore close errors on manually-opened tabs
      }

      setTimeout(() => {
        if (closeHint) {
          closeHint.textContent =
            "Tu navegador bloqueo el cierre automatico. Puedes cerrar esta pestaña manualmente.";
        }
      }, 500);
    });
  }
};

const revokeContractPdfObjectUrl = () => {
  if (contractPdfObjectUrl) {
    URL.revokeObjectURL(contractPdfObjectUrl);
    contractPdfObjectUrl = "";
  }
};

const PDFJS_VERSION = "4.5.136";
const PDFJS_MODULE_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

const configurePdfJsWorker = (pdfjs) => {
  if (pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }
  return pdfjs;
};

const getPdfJs = async () => {
  if (window.pdfjsLib) {
    return configurePdfJsWorker(window.pdfjsLib);
  }

  const moduleNs = await import(PDFJS_MODULE_URL);
  const pdfjs = configurePdfJsWorker(moduleNs?.default || moduleNs);
  window.pdfjsLib = pdfjs;
  return pdfjs;
};

const renderPdfInViewer = async (pdfBytes) => {
  if (!contractViewer) {
    throw new Error("No se pudo inicializar el visor de contrato.");
  }

  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  contractViewer.innerHTML = "";

  const measuredWidth =
    contractViewer.clientWidth ||
    contractViewer.parentElement?.clientWidth ||
    Math.floor(window.innerWidth * 0.92);
  const containerWidth = Math.max(280, measuredWidth - 16);
  const deviceScale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * deviceScale);
    canvas.height = Math.floor(viewport.height * deviceScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }

    await page.render({
      canvasContext: context,
      viewport,
      transform: deviceScale > 1 ? [deviceScale, 0, 0, deviceScale, 0, 0] : null,
    }).promise;

    const pageWrap = document.createElement("div");
    pageWrap.className = "public-pdf-page";
    pageWrap.appendChild(canvas);
    contractViewer.appendChild(pageWrap);
  }
};

const getSourcePdfBytes = async () => {
  if (sourcePdfBytesCache) {
    return sourcePdfBytesCache;
  }

  return fetchSourcePdfBytes({ forceRefresh: false });
};

const fetchSourcePdfBytes = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && sourcePdfBytesCache) {
    return sourcePdfBytesCache;
  }

  const sourcePdfUrl = getSigningPdfUrl();
  if (!sourcePdfUrl) {
    throw new Error("No se encontro el PDF para firmar.");
  }

  const sourceResponse = await fetch(sourcePdfUrl, {
    cache: forceRefresh ? "no-store" : "default",
  });
  if (!sourceResponse.ok) {
    throw new Error("No se pudo cargar el PDF original.");
  }

  const responseContentType = String(sourceResponse.headers.get("content-type") || "").toLowerCase();
  if (!responseContentType.includes("application/pdf")) {
    throw new Error("El archivo origen no vino en formato PDF. Recarga el enlace de firma.");
  }

  const sourceBytes = new Uint8Array(await sourceResponse.arrayBuffer());
  if (!sourceBytes.length) {
    throw new Error("El PDF original viene vacio. Recarga el enlace de firma.");
  }

  const pdfHeader = new TextDecoder().decode(sourceBytes.slice(0, 5));
  if (pdfHeader !== "%PDF-") {
    throw new Error("No se pudo leer el PDF original. Intenta recargar el enlace de firma.");
  }

  sourcePdfBytesCache = sourceBytes;
  return sourcePdfBytesCache;
};

const resizeSignatureCanvas = () => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) {
    return;
  }

  const wrap = signatureCanvas.parentElement;
  const visualWidth = Math.max(220, Math.floor((wrap?.clientWidth || signatureCanvas.clientWidth || 300) - 2));
  const visualHeight = 220;

  signatureCanvas.style.width = `${visualWidth}px`;
  signatureCanvas.style.height = `${visualHeight}px`;
  signatureCanvas.width = visualWidth;
  signatureCanvas.height = visualHeight;

  const ctx = signatureCanvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#123f79";
  }

  signatureDirty = false;
};

const showReadStep = () => {
  readStep?.classList.remove("hidden");
  signStep?.classList.add("hidden");
};

const showSignStep = () => {
  readStep?.classList.add("hidden");
  signStep?.classList.remove("hidden");
};

const getTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("token") || "").trim();
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

const apiFetchMultipart = async (path, formData) => {
  if (!API_BASE) {
    throw new Error("No hay API configurada.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = payload.message || "No se pudo completar la solicitud.";
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }

  return payload;
};

const getSigningPdfUrl = () => {
  if (!sessionToken) {
    return "";
  }

  return `${API_BASE}/contracts/public/signing-pdf?token=${encodeURIComponent(sessionToken)}`;
};

const clearCanvas = () => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) return;
  const ctx = signatureCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
};

const getCanvasPoint = (event) => {
  const rect = signatureCanvas.getBoundingClientRect();
  const clientX = event.clientX;
  const clientY = event.clientY;

  return {
    x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
    y: Math.max(0, Math.min(rect.height, clientY - rect.top)),
  };
};

const drawSegment = (from, to) => {
  const ctx = signatureCanvas.getContext("2d");
  if (!ctx) return;

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#123f79";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

const beginDraw = (event) => {
  if (signStep?.classList.contains("hidden")) {
    return;
  }

  event.preventDefault();
  signatureCanvas.setPointerCapture?.(event.pointerId);
  isDrawing = true;
  lastPoint = getCanvasPoint(event);
  signatureDirty = true;
};

const moveDraw = (event) => {
  if (!isDrawing) return;
  event.preventDefault();
  const next = getCanvasPoint(event);
  drawSegment(lastPoint, next);
  lastPoint = next;
};

const endDraw = () => {
  isDrawing = false;
  lastPoint = null;
};

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const findInkBounds = () => {
  const ctx = signatureCanvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const { width, height } = signatureCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
};

const locateClientSignatureAnchor = async (pdfBytes, signerName) => {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const normalizedSigner = normalizeSearchText(signerName);
  const candidates = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const pdfPage = await doc.getPage(pageNumber);
    const textContent = await pdfPage.getTextContent();
    for (const item of textContent.items || []) {
      const text = normalizeSearchText(item.str);
      if (!text) {
        continue;
      }

      const isNameMatch =
        normalizedSigner.length >= 4 && (text.includes(normalizedSigner) || normalizedSigner.includes(text));
      if (!isNameMatch) {
        continue;
      }

      const [, , , , x = 0, y = 0] = Array.isArray(item.transform) ? item.transform : [];
      candidates.push({
        pageIndex: pageNumber - 1,
        x,
        y,
      });
    }
  }

  if (!candidates.length) {
    return null;
  }

  const maxPageIndex = Math.max(...candidates.map((entry) => entry.pageIndex));
  const pageCandidates = candidates.filter((entry) => entry.pageIndex === maxPageIndex);
  const chosen = pageCandidates.reduce((best, current) => {
    if (!best) return current;
    return current.y < best.y ? current : best;
  }, null);

  if (!chosen) {
    return null;
  }

  return chosen;
};

const canvasToPngBytes = async () => {
  const bounds = findInkBounds();
  if (!bounds) {
    throw new Error("Debes dibujar tu firma antes de enviar.");
  }

  const padding = 10;
  const cropX = Math.max(0, bounds.minX - padding);
  const cropY = Math.max(0, bounds.minY - padding);
  const cropRight = Math.min(signatureCanvas.width, bounds.maxX + padding + 1);
  const cropBottom = Math.min(signatureCanvas.height, bounds.maxY + padding + 1);
  const cropWidth = Math.max(1, cropRight - cropX);
  const cropHeight = Math.max(1, cropBottom - cropY);

  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = cropWidth;
  trimmedCanvas.height = cropHeight;
  const trimmedCtx = trimmedCanvas.getContext("2d");
  if (!trimmedCtx) {
    throw new Error("No se pudo preparar la firma para el PDF.");
  }

  trimmedCtx.drawImage(signatureCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const blob = await new Promise((resolve, reject) => {
    trimmedCanvas.toBlob((value) => {
      if (!value) {
        reject(new Error("No se pudo convertir la firma."));
        return;
      }
      resolve(value);
    }, "image/png", 1);
  });

  return new Uint8Array(await blob.arrayBuffer());
};

const buildSignedPdfBlob = async () => {
  if (!window.PDFLib) {
    throw new Error("No se pudo cargar la libreria de firma.");
  }

  let pdfBytes = await getSourcePdfBytes();
  const { PDFDocument } = window.PDFLib;
  let pdfDoc;

  try {
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch {
    // If a proxy/cache edge returned non-PDF content, force one fresh fetch before failing.
    sourcePdfBytesCache = null;
    pdfBytes = await fetchSourcePdfBytes({ forceRefresh: true });
    try {
      pdfDoc = await PDFDocument.load(pdfBytes);
    } catch {
      throw new Error("No se pudo procesar el PDF original. Recarga el enlace de firma y vuelve a intentar.");
    }
  }

  const signaturePng = await canvasToPngBytes();
  const signatureImage = await pdfDoc.embedPng(signaturePng);

  const pages = pdfDoc.getPages();
  const placement = getSignaturePlacementConfig();
  const storedAnchor = getSessionSignatureAnchor();
  const textAnchor = storedAnchor ? null : await locateClientSignatureAnchor(pdfBytes, sessionData?.clientName || "");
  const activeAnchor = storedAnchor || textAnchor;
  const page = pages[activeAnchor?.pageIndex ?? pages.length - 1];
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  let signWidth = Math.min(placement.maxWidth, pageWidth * placement.widthRatio);
  let signHeight = (signatureImage.height / signatureImage.width) * signWidth;
  let signX;
  let signY;

  if (storedAnchor && storedAnchor.pageIndex < pages.length) {
    const box = storedAnchor.box;
    const maxWidthInsideBox = Math.max(1, box.width * placement.boxScale - placement.boxInset * 2);
    const maxHeightInsideBox = Math.max(1, box.height * placement.boxScale - placement.boxInset * 2);

    signWidth = Math.min(signWidth, maxWidthInsideBox);
    signHeight = (signatureImage.height / signatureImage.width) * signWidth;
    if (signHeight > maxHeightInsideBox) {
      signHeight = maxHeightInsideBox;
      signWidth = signHeight * (signatureImage.width / signatureImage.height);
    }

    const centeredX = box.x + (box.width - signWidth) / 2 + placement.boxOffsetX;
    const centeredY = box.y + (box.height - signHeight) / 2 + placement.boxOffsetY;
    const minBoxX = box.x + placement.boxInset;
    const maxBoxX = box.x + box.width - signWidth - placement.boxInset;
    const minBoxY = box.y + placement.boxInset;
    const maxBoxY = box.y + box.height - signHeight - placement.boxInset;

    signX = Math.max(minBoxX, Math.min(centeredX, maxBoxX));
    signY = Math.max(minBoxY, Math.min(centeredY, maxBoxY));
  } else {
    const defaultX = Math.max(42, pageWidth * placement.fallbackXRatio);
    const defaultY = Math.max(84, pageHeight * placement.fallbackYRatio);
    const anchoredX = textAnchor ? textAnchor.x + placement.anchorOffsetX : defaultX;
    const anchoredY = textAnchor ? textAnchor.y + placement.anchorOffsetY : defaultY;
    signX = Math.max(
      placement.pagePadding,
      Math.min(anchoredX, pageWidth - signWidth - placement.pagePadding),
    );
    signY = Math.max(
      placement.pagePadding,
      Math.min(anchoredY, pageHeight - signHeight - placement.pagePadding),
    );
  }

  page.drawImage(signatureImage, {
    x: signX,
    y: signY,
    width: signWidth,
    height: signHeight,
  });

  const signedBytes = await pdfDoc.save();
  return new Blob([signedBytes], { type: "application/pdf" });
};

const loadSigningSession = async () => {
  sessionToken = getTokenFromUrl();
  if (!sessionToken) {
    throw new Error("El enlace de firma no contiene token.");
  }

  const data = await apiFetch(`/contracts/public/signing-session?token=${encodeURIComponent(sessionToken)}`, {
    method: "GET",
  });

  sessionData = data;
  contractNumberEl.textContent = data.contractNumber || "-";
  clientNameEl.textContent = data.clientName || "-";
  contractStateEl.textContent = data.status || "-";
  if (signedByNameLabel) {
    signedByNameLabel.textContent = data.clientName || "-";
  }

  if (contractFrame) {
    revokeContractPdfObjectUrl();
    contractFrame.src = "";
    contractFrame.style.display = "none";
  }

  if (contractViewer) {
    contractViewer.innerHTML = "";
    contractViewer.classList.add("hidden");
  }

  sourcePdfBytesCache = null;

  showReadStep();

  if (String(data.status || "").toUpperCase() === "SIGNED") {
    submitButton?.setAttribute("disabled", "true");
    goToSignButton?.setAttribute("disabled", "true");
    viewContractButton?.setAttribute("disabled", "true");
    setStatus("Este contrato ya fue firmado y registrado.");
    return;
  }

  setStatus("Paso 1: presiona Ver contrato. Al terminar, presiona Firmar.");
};

const submitSignedContract = async () => {
  const signer = String(sessionData?.clientName || "").trim();
  if (!signer) {
    throw new Error("No se pudo resolver el nombre del firmante desde el contrato.");
  }

  if (!signatureDirty) {
    throw new Error("Debes dibujar tu firma antes de enviar.");
  }

  setStatus("Generando PDF firmado...");
  const signedPdfBlob = await buildSignedPdfBlob();

  setStatus("Enviando contrato firmado...");
  const payload = new FormData();
  payload.append("token", sessionToken);
  payload.append("signedByName", signer);
  payload.append("signedPdfFile", signedPdfBlob, `${sessionData.contractNumber || "contrato"}-signed.pdf`);

  await apiFetchMultipart("/contracts/public/finalize-signature", payload);
  contractStateEl.textContent = "SIGNED";
  setStatus("Contrato firmado enviado correctamente. Proceso finalizado.", "success");
  submitButton.setAttribute("disabled", "true");
  clearButton?.setAttribute("disabled", "true");
  backToReadButton?.setAttribute("disabled", "true");
  goToSignButton?.setAttribute("disabled", "true");
  viewContractButton?.setAttribute("disabled", "true");
  finishSigningExperience();
};

if (signatureCanvas instanceof HTMLCanvasElement) {
  signatureCanvas.addEventListener("pointerdown", beginDraw);
  signatureCanvas.addEventListener("pointermove", moveDraw);
  signatureCanvas.addEventListener("pointerup", endDraw);
  signatureCanvas.addEventListener("pointerleave", endDraw);
  signatureCanvas.addEventListener("pointercancel", endDraw);
}

if (viewContractButton) {
  viewContractButton.addEventListener("click", () => {
    setStatus("Cargando contrato...");
    viewContractButton.setAttribute("disabled", "true");
    contractViewer?.classList.remove("hidden");

    void getSourcePdfBytes()
      .then((bytes) => renderPdfInViewer(bytes))
      .then(() => {
        if (contractViewer) {
          contractViewer.classList.remove("hidden");
        }
        contractFrame.style.display = "none";
        contractFrame.src = "";
        goToSignButton?.removeAttribute("disabled");
        setStatus("Contrato abierto. Cuando termines de leer, presiona Firmar.");
      })
      .catch((error) => {
        setStatus(error.message || "No se pudo abrir el contrato.", "error");
      })
      .finally(() => {
        if (String(contractStateEl.textContent || "").toUpperCase() !== "SIGNED") {
          viewContractButton.removeAttribute("disabled");
        }
      });
  });
}

if (goToSignButton) {
  goToSignButton.addEventListener("click", () => {
    resizeSignatureCanvas();
    clearCanvas();
    showSignStep();
    setStatus("Paso 2: firma en el recuadro y presiona Enviar contrato firmado.");
  });
}

if (backToReadButton) {
  backToReadButton.addEventListener("click", () => {
    showReadStep();
    setStatus("Regresaste a lectura del contrato.");
  });
}

if (clearButton) {
  clearButton.addEventListener("click", () => {
    signatureDirty = false;
    clearCanvas();
  });
}

if (submitButton) {
  submitButton.addEventListener("click", () => {
    const oldLabel = submitButton.textContent;
    submitButton.textContent = "Enviando...";
    submitButton.setAttribute("disabled", "true");

    void submitSignedContract()
      .catch((error) => {
        setStatus(error.message || "No se pudo enviar el contrato firmado.", "error");
        window.alert(error.message || "No se pudo enviar el contrato firmado.");
      })
      .finally(() => {
        if (oldLabel) {
          submitButton.textContent = oldLabel;
        }
        if (String(contractStateEl.textContent || "").toUpperCase() !== "SIGNED") {
          submitButton.removeAttribute("disabled");
        }
      });
  });
}

window.addEventListener("resize", () => {
  if (!signStep?.classList.contains("hidden")) {
    resizeSignatureCanvas();
    clearCanvas();
  }
});

window.addEventListener("beforeunload", () => {
  revokeContractPdfObjectUrl();
});

void loadSigningSession().catch((error) => {
  setStatus(error.message || "No se pudo cargar la sesion de firma.", "error");
  submitButton?.setAttribute("disabled", "true");
});
