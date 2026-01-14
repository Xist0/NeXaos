// src/config/env.js
const dotenv = require("dotenv");

// В production переменные должны приходить из systemd EnvironmentFile.
// Дополнительно поддерживаем явное указание ENV_FILE для удобства.
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE });
} else if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const parseCsv = (value, fallback = []) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

// Валидация обязательных переменных
const requiredEnvVars = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

module.exports = {
  env: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: process.env.PORT || 5000,
  cors: {
    origins: parseCsv(process.env.CORS_ORIGINS, [
      "http://localhost:5173",
      "http://localhost:3000",
    ]),
  },
  proxy: {
    target: process.env.PROXY_TARGET || null,
    path: process.env.PROXY_PATH || "/proxy",
  },
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },
};
