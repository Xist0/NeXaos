// src/config/env.js
const dotenv = require("dotenv");
const path = require("path");

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

const isProd = process.env.NODE_ENV === "production";
const backendRootDir = path.resolve(__dirname, "..", "..");
const legacyUploadsDir = path.resolve(path.join(backendRootDir, "src", "public", "uploads"));
const defaultUploadsDir = isProd ? legacyUploadsDir : path.resolve(path.join(backendRootDir, "uploads"));
const uploadsDirFromEnv = process.env.UPLOADS_DIR
  ? (path.isAbsolute(process.env.UPLOADS_DIR)
      ? process.env.UPLOADS_DIR
      : path.resolve(path.join(backendRootDir, process.env.UPLOADS_DIR)))
  : defaultUploadsDir;

// Валидация обязательных переменных (строго только в production).
// В dev даём разумные дефолты, чтобы проект можно было поднять сразу после git clone.
const requiredEnvVars = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET"];

if (process.env.NODE_ENV === "production") {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
} else {
  process.env.DB_HOST = process.env.DB_HOST || "localhost";
  process.env.DB_PORT = process.env.DB_PORT || "5432";
  process.env.DB_NAME = process.env.DB_NAME || "nexaos";
  process.env.DB_USER = process.env.DB_USER || "postgres";
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me_min32chars";
}

module.exports = {
  env: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: isProd ? (process.env.PORT || 5000) : (process.env.DEV_PORT || 5001),
  cors: {
    origins: parseCsv(process.env.CORS_ORIGINS, [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://130.49.148.245",
      "https://130.49.148.245",
      "http://nexaos.ru",
      "https://nexaos.ru",
    ]),
  },
  proxy: {
    target: process.env.PROXY_TARGET || null,
    path: process.env.PROXY_PATH || "/proxy",
  },
  uploadsDir: path.resolve(uploadsDirFromEnv),
  legacyUploadsDir,
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },
};
