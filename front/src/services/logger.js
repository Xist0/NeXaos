import { API_BASE_URL } from "../utils/constants";

let lastBeaconAt = 0;
let lastBeaconKey = "";

const IS_PROD = Boolean(import.meta?.env?.PROD);

const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "token",
  "refreshToken",
  "accessToken",
  "authorization",
  "cookie",
  "set-cookie",
]);

const redact = (value, depth = 0) => {
  if (depth > 6) return "[REDACTED]";
  if (!value) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value !== "object") return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = redact(v, depth + 1);
  }
  return out;
};

const shouldSendBeacon = (payload) => {
  const now = Date.now();
  const key = `${payload.level}|${payload.message}`;

  // Не отправляем info-логи на сервер, чтобы не спамить /logs
  if (payload.level === "info") return false;

  // В dev не отправляем telemetry
  if (!IS_PROD) return false;

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
  const safeMeta = meta && typeof meta === "object" ? redact(meta) : {};
  
  const payload = {
    level: level || "info",
    message: safeMessage,
    meta: safeMeta,
    timestamp: new Date().toISOString(),
  };

  // В production не логируем в консоль, чтобы не светить данные.
  // В dev — оставляем для отладки.
  if (!IS_PROD) {
    if (level === "error") console.error("[NeXaos]", payload);
    else if (level === "warn") console.warn("[NeXaos]", payload);
    else console.log("[NeXaos]", payload);
  }

  try {
    if (navigator.sendBeacon && shouldSendBeacon(payload)) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(`${API_BASE_URL}/logs`, blob);
    }
  } catch (_err) {
    // swallow telemetry errors
  }
};

const logger = {
  info: (message, meta) => emit("info", message, meta),
  warn: (message, meta) => emit("warn", message, meta),
  error: (message, meta) => emit("error", message, meta),
};

export default logger;

