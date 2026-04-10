(() => {
  const normalizeBase = (value) => String(value || "").trim().replace(/\/+$/, "");
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const productionFallbackByHost = {
    "contratos.lucitour.com": "https://contratostempapi-h5ppc.ondigitalocean.app",
    "www.contratos.lucitour.com": "https://contratostempapi-h5ppc.ondigitalocean.app",
  };

  // Runtime sources (first non-empty wins):
  // 1) window.__APP_ENV__.API_BASE (injected at deploy/runtime)
  // 2) <meta name="api-base" content="..."> (optional per-page override)
  // 3) localStorage CONTRACTS_API_BASE (manual emergency override)
  // 4) localhost fallback for local dev
  const runtimeApiBase = normalizeBase(
    (window.__APP_ENV__ && window.__APP_ENV__.API_BASE) ||
    document.querySelector('meta[name="api-base"]')?.getAttribute("content") ||
    window.localStorage.getItem("CONTRACTS_API_BASE") ||
    "",
  );

  const hostFallback = normalizeBase(
    productionFallbackByHost[String(window.location.hostname || "").toLowerCase()] || "",
  );
  const localFallback = isLocalHost ? "http://localhost:3001" : "";
  const apiBase = runtimeApiBase || hostFallback || localFallback;

  window.APP_CONFIG = {
    ...(window.APP_CONFIG || {}),
    API_BASE: apiBase,
    DEBUG: Boolean(window.__APP_ENV__?.DEBUG) || false,
    SIGNATURE_PLACEMENT: {
      ANCHOR_OFFSET_X: 8,
      ANCHOR_OFFSET_Y: 34,
      FALLBACK_X_RATIO: 0.1,
      FALLBACK_Y_RATIO: 0.085,
      WIDTH_RATIO: 0.34,
      MAX_WIDTH: 220,
      PAGE_PADDING: 24,
      BOX_SCALE: 0.9,
      BOX_INSET: 4,
      BOX_OFFSET_X: 0,
      BOX_OFFSET_Y: 0,
      ...(window.APP_CONFIG?.SIGNATURE_PLACEMENT || {}),
    },
  };
})();
