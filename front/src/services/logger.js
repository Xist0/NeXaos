import { API_BASE_URL } from "../utils/constants";

const emit = (level, message, meta = {}) => {
  const payload = {
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
  };

  if (level === "error") {
    console.error("[NeXaos]", payload);
  } else if (level === "warn") {
    console.warn("[NeXaos]", payload);
  } else {
    console.log("[NeXaos]", payload);
  }

  try {
    navigator.sendBeacon?.(`${API_BASE_URL}/logs`, JSON.stringify(payload));
  } catch (err) {
    // swallow telemetry errors
  }
};

const logger = {
  info: (message, meta) => emit("info", message, meta),
  warn: (message, meta) => emit("warn", message, meta),
  error: (message, meta) => emit("error", message, meta),
};

export default logger;

