// src/app.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const config = require("./config/env");
const applySecurityMiddleware = require("./middleware/security.middleware");
const applyProxy = require("./middleware/proxy.middleware");
const errorHandler = require("./middleware/error.middleware");
const authRoutes = require("./routes/auth.routes");
const crudRoutes = require("./routes/crud.routes");

const app = express();

app.disable("x-powered-by");

// Настраиваем Helmet для разрешения загрузки изображений
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "http://localhost:5000", "http://localhost:5173", "https:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

const allowedOrigins = new Set([
  ...config.cors.origins,
  config.proxy?.target,
].filter(Boolean));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Источник не разрешён: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Статика для загруженных файлов с CORS заголовками
// Должна быть до security middleware и proxy, чтобы не блокировалась
app.use(
  "/uploads",
  (req, res, next) => {
    // Добавляем CORS заголовки для статических файлов
    const origin = req.headers.origin;
    // Для изображений с crossOrigin="anonymous" разрешаем все источники
    if (origin && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    } else {
      // Разрешаем загрузку из любого источника для изображений
      res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Cross-Origin-Embedder-Policy", "unsafe-none");
    res.header("Cache-Control", "public, max-age=31536000");
    next();
  },
  express.static(path.join(__dirname, "public", "uploads"), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Убеждаемся, что статические файлы не блокируются
      const origin = res.req.headers.origin;
      if (origin && allowedOrigins.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      } else {
        // Разрешаем загрузку из любого источника для изображений
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
      // Устанавливаем правильный Content-Type для изображений
      if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (filePath.endsWith('.png')) {
        res.setHeader("Content-Type", "image/png");
      } else if (filePath.endsWith('.gif')) {
        res.setHeader("Content-Type", "image/gif");
      } else if (filePath.endsWith('.webp')) {
        res.setHeader("Content-Type", "image/webp");
      }
    },
  })
);
applySecurityMiddleware(app);
applyProxy(app);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api", crudRoutes);

app.use("*", (req, res) => {
  res.status(404).json({ message: "Маршрут не найден" });
});

app.use(errorHandler);

module.exports = app;

