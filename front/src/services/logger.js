import { API_BASE_URL } from "../utils/constants";

const emit = (level, message, meta = {}) => {
  // Убеждаемся, что message всегда строка
  const safeMessage = typeof message === "string" && message.trim() ? message : "Лог без сообщения";
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  
  const payload = {
    level: level || "info",
    message: safeMessage,
    meta: safeMeta,
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
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    navigator.sendBeacon?.(`${API_BASE_URL}/logs`, blob);
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

