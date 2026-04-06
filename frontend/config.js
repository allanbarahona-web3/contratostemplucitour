window.APP_CONFIG = {
  API_BASE: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : "https://contractstemporal-f8too.ondigitalocean.app",
  DEBUG: false,
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
  },
};
