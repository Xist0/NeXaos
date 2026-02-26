const { createLogger, format, transports } = require("winston");

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

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, stack, ...rest }) => {
          const safeRest = redact(rest);
          const restString = Object.keys(safeRest).length
            ? ` ${JSON.stringify(safeRest)}`
            : "";
          return `${timestamp} [${level}]: ${stack || message}${restString}`;
        })
      ),
    }),
  ],
});

module.exports = logger;

