const statusEl = document.getElementById("publicSignStatus");
const contractNumberEl = document.getElementById("publicContractNumber");
const clientNameEl = document.getElementById("publicClientName");
const contractStateEl = document.getElementById("publicContractState");
const readStep = document.getElementById("publicReadStep");
const signStep = document.getElementById("publicSignStep");
const viewContractButton = document.getElementById("publicViewContractButton");
const goToSignButton = document.getElementById("publicGoToSignButton");
const backToReadButton = document.getElementById("publicBackToReadButton");
const contractFrame = document.getElementById("publicContractFrame");
const signedByNameInput = document.getElementById("publicSignedByName");
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

const setStatus = (message) => {
  statusEl.textContent = String(message || "");
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
    x: ((clientX - rect.left) / rect.width) * signatureCanvas.width,
    y: ((clientY - rect.top) / rect.height) * signatureCanvas.height,
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

  const sourcePdfUrl = getSigningPdfUrl();
  if (!sourcePdfUrl) {
    throw new Error("No se encontro el PDF para firmar.");
  }

  const sourceResponse = await fetch(sourcePdfUrl);
  if (!sourceResponse.ok) {
    throw new Error("No se pudo cargar el PDF original.");
  }

  const pdfBytes = new Uint8Array(await sourceResponse.arrayBuffer());
  const { PDFDocument, rgb } = window.PDFLib;
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const signaturePng = await canvasToPngBytes();
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
  signedByNameInput.value = data.clientName || "";

  if (contractFrame) {
    contractFrame.src = "";
    contractFrame.style.display = "none";
  }

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
  const signer = String(signedByNameInput.value || "").trim();
  if (!signer) {
    throw new Error("Ingresa tu nombre completo.");
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
  setStatus("Contrato firmado enviado correctamente. Proceso finalizado.");
  submitButton.setAttribute("disabled", "true");
  clearButton?.setAttribute("disabled", "true");
  backToReadButton?.setAttribute("disabled", "true");
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
    const sourcePdfUrl = getSigningPdfUrl();
    if (!sourcePdfUrl) {
      setStatus("No se encontro el contrato para visualizacion.");
      return;
    }

    contractFrame.style.display = "block";
    contractFrame.src = sourcePdfUrl;
    goToSignButton?.removeAttribute("disabled");
    setStatus("Contrato abierto. Cuando termines de leer, presiona Firmar.");
  });
}

if (goToSignButton) {
  goToSignButton.addEventListener("click", () => {
    signatureDirty = false;
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
        setStatus(error.message || "No se pudo enviar el contrato firmado.");
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

void loadSigningSession().catch((error) => {
  setStatus(error.message || "No se pudo cargar la sesion de firma.");
  submitButton?.setAttribute("disabled", "true");
});
