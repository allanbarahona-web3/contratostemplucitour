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

  const containerWidth = Math.max(280, contractViewer.clientWidth - 16);
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }
    await page.render({ canvasContext: context, viewport }).promise;

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

  const sourcePdfUrl = getSigningPdfUrl();
  if (!sourcePdfUrl) {
    throw new Error("No se encontro el PDF para firmar.");
  }

  const sourceResponse = await fetch(sourcePdfUrl);
  if (!sourceResponse.ok) {
    throw new Error("No se pudo cargar el PDF original.");
  }

  sourcePdfBytesCache = new Uint8Array(await sourceResponse.arrayBuffer());
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

const canvasToPngBytes = async () => {
  const blob = await new Promise((resolve, reject) => {
    signatureCanvas.toBlob((value) => {
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

  const pdfBytes = await getSourcePdfBytes();
  const { PDFDocument, rgb } = window.PDFLib;
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const signaturePng = await canvasToPngBytes();
  const signatureImage = await pdfDoc.embedPng(signaturePng);

  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const signWidth = Math.min(180, pageWidth * 0.26);
  const signHeight = (signatureImage.height / signatureImage.width) * signWidth;
  const signX = Math.max(42, pageWidth * 0.1);
  const signY = Math.max(84, pageHeight * 0.085);

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
  window.alert("Contrato firmado enviado correctamente.");
  submitButton.setAttribute("disabled", "true");
  clearButton?.setAttribute("disabled", "true");
  backToReadButton?.setAttribute("disabled", "true");
  goToSignButton?.setAttribute("disabled", "true");
  viewContractButton?.setAttribute("disabled", "true");
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
