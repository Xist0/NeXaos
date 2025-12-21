import { API_BASE_URL } from "../utils/constants";

let lastBeaconAt = 0;
let lastBeaconKey = "";

const shouldSendBeacon = (payload) => {
  const now = Date.now();
  const key = `${payload.level}|${payload.message}`;

  // Не отправляем info-логи на сервер, чтобы не спамить /logs
  if (payload.level === "info") return false;

  // Дедупликация одинаковых сообщений
  if (key === lastBeaconKey && now - lastBeaconAt < 3000) return false;

  // Глобальный rate-limit
  if (now - lastBeaconAt < 500) return false;

  lastBeaconKey = key;
  lastBeaconAt = now;
  return true;
};

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
    if (navigator.sendBeacon && shouldSendBeacon(payload)) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(`${API_BASE_URL}/logs`, blob);
    }
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

