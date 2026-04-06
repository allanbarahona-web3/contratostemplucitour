// ─── DOM references ──────────────────────────────────────────────────────────
const loadingStateEl   = document.getElementById("loadingState");
const errorStateEl     = document.getElementById("errorState");
const errorMessageEl   = document.getElementById("errorMessage");
const readStepEl       = document.getElementById("readStep");
const signStepEl       = document.getElementById("signStep");
const successStepEl    = document.getElementById("successStep");
const successMessageEl = document.getElementById("successMessage");

const contractNumberEl  = document.getElementById("publicContractNumber");
const clientNameEl      = document.getElementById("publicClientName");
const contractStateEl   = document.getElementById("publicContractState");
const contractFrameEl   = document.getElementById("publicContractFrame");
const readStatusEl      = document.getElementById("publicSignStatus");

const goToSignButton  = document.getElementById("goToSignButton");
const backToReadButton = document.getElementById("backToReadButton");

const signatureCanvas = document.getElementById("publicSignatureCanvas");
const clearButton     = document.getElementById("publicSignatureClear");
const submitButton    = document.getElementById("publicSignatureSubmit");
const signStatusEl    = document.getElementById("signStepStatus");

// ─── Config ───────────────────────────────────────────────────────────────────
const normalizeBase = (v) => String(v || "").trim().replace(/\/+$/, "");
const configuredApiBase = normalizeBase(window.APP_CONFIG?.API_BASE);
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = configuredApiBase || (isLocal ? "http://localhost:3001" : "");

// ─── State ────────────────────────────────────────────────────────────────────
let sessionToken = null;
let sessionData  = null;
let signatureDirty = false;
let isDrawing = false;
let lastPoint = null;

// ─── UI helpers ───────────────────────────────────────────────────────────────
const showEl  = (el) => el?.classList.remove("hidden");
const hideEl  = (el) => el?.classList.add("hidden");

const setReadStatus = (msg, type = "") => {
  if (!readStatusEl) return;
  readStatusEl.textContent = msg;
  readStatusEl.className = "sign-status" + (type ? ` sign-status--${type}` : "");
};

const setSignStatus = (msg, type = "") => {
  if (!signStatusEl) return;
  signStatusEl.textContent = msg;
  signStatusEl.className = "sign-status" + (type ? ` sign-status--${type}` : "");
};

const showLoading = () => {
  showEl(loadingStateEl);
  hideEl(errorStateEl);
  hideEl(readStepEl);
  hideEl(signStepEl);
  hideEl(successStepEl);
};

const showError = (msg) => {
  hideEl(loadingStateEl);
  showEl(errorStateEl);
  if (errorMessageEl) errorMessageEl.textContent = msg || "Ocurrio un error.";
  hideEl(readStepEl);
  hideEl(signStepEl);
  hideEl(successStepEl);
};

const showReadStep = () => {
  hideEl(loadingStateEl);
  hideEl(errorStateEl);
  showEl(readStepEl);
  hideEl(signStepEl);
  hideEl(successStepEl);
};

const showSignStep = () => {
  hideEl(loadingStateEl);
  hideEl(errorStateEl);
  hideEl(readStepEl);
  showEl(signStepEl);
  hideEl(successStepEl);
};

const showSuccessStep = (msg = "") => {
  hideEl(loadingStateEl);
  hideEl(errorStateEl);
  hideEl(readStepEl);
  hideEl(signStepEl);
  showEl(successStepEl);
  if (successMessageEl && msg) successMessageEl.textContent = msg;
};

// ─── URL helpers ─────────────────────────────────────────────────────────────
const getTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
};

// ─── API fetch ────────────────────────────────────────────────────────────────
const apiFetch = async (path, options = {}) => {
  if (!API_BASE) throw new Error("No hay API configurada. Define APP_CONFIG.API_BASE en config.js.");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = payload.message || "No se pudo completar la solicitud.";
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }
  return payload;
};

// ─── Canvas ───────────────────────────────────────────────────────────────────
const resizeSignatureCanvas = () => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) return;
  const wrap = signatureCanvas.parentElement;
  const w = wrap ? wrap.clientWidth || wrap.offsetWidth : 320;
  signatureCanvas.width  = Math.max(w - 2, 280);
  signatureCanvas.height = 200;
  const ctx = signatureCanvas.getContext("2d");
  if (ctx) {
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#123f79";
  }
};

const clearCanvas = () => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) return;
  const ctx = signatureCanvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  signatureDirty = false;
};

const getCanvasPoint = (e) => {
  const rect = signatureCanvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
};

const drawSegment = (from, to) => {
  if (!(signatureCanvas instanceof HTMLCanvasElement)) return;
  const ctx = signatureCanvas.getContext("2d");
  if (!ctx) return;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

const beginDraw = (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  isDrawing = true;
  signatureDirty = true;
  lastPoint = getCanvasPoint(e);
  if (typeof e.setPointerCapture === "function" && e.pointerId !== undefined) {
    signatureCanvas.setPointerCapture(e.pointerId);
  }
};

const moveDraw = (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  const current = getCanvasPoint(e);
  if (lastPoint) drawSegment(lastPoint, current);
  lastPoint = current;
};

const endDraw = (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  isDrawing = false;
  lastPoint = null;
};

const findInkBounds = (canvas) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  let found = false;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) return null;
  const pad = 6;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(canvas.width,  maxX + pad + 1) - Math.max(0, minX - pad),
    h: Math.min(canvas.height, maxY + pad + 1) - Math.max(0, minY - pad),
  };
};

const canvasToPngBase64 = (canvas) =>
  new Promise((resolve, reject) => {
    const bounds = findInkBounds(canvas);
    if (!bounds) {
      reject(new Error("No hay firma dibujada."));
      return;
    }
    const out = document.createElement("canvas");
    out.width  = bounds.w;
    out.height = bounds.h;
    const ctx = out.getContext("2d");
    if (!ctx) { reject(new Error("No se pudo preparar la firma.")); return; }
    ctx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    const dataUrl = out.toDataURL("image/png");
    // strip data:image/png;base64, prefix
    const base64 = dataUrl.split(",")[1];
    if (!base64) { reject(new Error("No se pudo exportar la firma.")); return; }
    resolve(base64);
  });

// ─── Session ──────────────────────────────────────────────────────────────────
const loadSigningSession = async () => {
  sessionToken = getTokenFromUrl();
  if (!sessionToken) throw new Error("El enlace de firma no contiene token.");

  const data = await apiFetch(
    `/contracts/public/signing-session?token=${encodeURIComponent(sessionToken)}`,
    { method: "GET" },
  );

  sessionData = data;

  if (contractNumberEl) contractNumberEl.textContent = data.contractNumber || "–";
  if (clientNameEl)     clientNameEl.textContent     = data.signerName || data.clientName || "–";
  if (contractStateEl)  contractStateEl.textContent  = data.status || "–";

  const statusUp = String(data.status || "").toUpperCase();
  if (statusUp === "SIGNED") {
    showReadStep();
    if (contractFrameEl && data.contractHtmlUrl) contractFrameEl.src = data.contractHtmlUrl;
    if (goToSignButton) goToSignButton.setAttribute("disabled", "true");
    setReadStatus("Este contrato ya fue firmado por todas las partes.", "info");
    return;
  }

  if (!data.contractHtmlUrl) {
    throw new Error("No se encontro el documento del contrato. Contacta a Lucitours.");
  }

  contractFrameEl.src = data.contractHtmlUrl;

  // Enable sign button once iframe loads
  contractFrameEl.addEventListener("load", () => {
    if (goToSignButton) goToSignButton.removeAttribute("disabled");
    setReadStatus("Contrato cargado. Revísalo y presiona Firmar cuando estés listo.");
  }, { once: true });

  showReadStep();
  setReadStatus("Cargando contrato…");
};

// ─── Mark viewed ─────────────────────────────────────────────────────────────
const markViewed = async () => {
  if (!sessionToken) return;
  try {
    await apiFetch("/contracts/public/mark-viewed", {
      method: "POST",
      body: JSON.stringify({ token: sessionToken }),
    });
  } catch { /* non-blocking */ }
};

// ─── Submit signature ────────────────────────────────────────────────────────
const submitSignature = async () => {
  if (!signatureDirty) throw new Error("Debes dibujar tu firma antes de enviar.");
  const signer = String(sessionData?.signerName || sessionData?.clientName || "").trim();
  if (!signer) throw new Error("No se pudo resolver el nombre del firmante.");

  setSignStatus("Exportando firma…");
  const signatureImageBase64 = await canvasToPngBase64(signatureCanvas);

  setSignStatus("Enviando firma…");
  const result = await apiFetch("/contracts/public/finalize-signature", {
    method: "POST",
    body: JSON.stringify({
      token: sessionToken,
      signedByName: signer,
      signatureImageBase64,
    }),
  });

  const nextStatus = String(result?.status || "").toUpperCase();
  if (contractStateEl) contractStateEl.textContent = nextStatus || "–";

  let msg = "Tu firma fue registrada correctamente.";
  if (nextStatus === "SIGNED") {
    msg = "¡Contrato firmado! Todas las partes han completado el proceso.";
  } else {
    const signed = Number(result?.signedCount || 0);
    const total  = Number(result?.totalSigners || 0);
    if (signed && total) msg = `Firma registrada (${signed}/${total} firmantes completados).`;
  }

  showSuccessStep(msg);
};

// ─── Event listeners ─────────────────────────────────────────────────────────
if (goToSignButton) {
  goToSignButton.addEventListener("click", () => {
    void markViewed();
    resizeSignatureCanvas();
    clearCanvas();
    showSignStep();
    setSignStatus("Dibuja tu firma y presiona Enviar firma.");
  });
}

if (backToReadButton) {
  backToReadButton.addEventListener("click", () => {
    showReadStep();
    setReadStatus("");
  });
}

if (clearButton) {
  clearButton.addEventListener("click", () => {
    clearCanvas();
  });
}

if (submitButton) {
  submitButton.addEventListener("click", () => {
    const label = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Enviando…";
    void submitSignature()
      .catch((err) => {
        setSignStatus(err.message || "No se pudo enviar la firma.", "error");
      })
      .finally(() => {
        submitButton.textContent = label || "Enviar firma";
        if (String(contractStateEl?.textContent || "").toUpperCase() !== "SIGNED") {
          submitButton.disabled = false;
        }
      });
  });
}

if (signatureCanvas instanceof HTMLCanvasElement) {
  signatureCanvas.addEventListener("pointerdown",  beginDraw);
  signatureCanvas.addEventListener("pointermove",  moveDraw);
  signatureCanvas.addEventListener("pointerup",    endDraw);
  signatureCanvas.addEventListener("pointerleave", endDraw);
  signatureCanvas.addEventListener("pointercancel",endDraw);
}

window.addEventListener("resize", () => {
  if (!signStepEl?.classList.contains("hidden")) {
    resizeSignatureCanvas();
    clearCanvas();
  }
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
showLoading();
void loadSigningSession().catch((err) => {
  showError(err.message || "No se pudo cargar la sesion de firma.");
});
