// src/app.js
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const config = require("./config/env");
const sharp = require("sharp");
const applySecurityMiddleware = require("./middleware/security.middleware");
const applyProxy = require("./middleware/proxy.middleware");
const errorHandler = require("./middleware/error.middleware");
const authRoutes = require("./routes/auth.routes");
const crudRoutes = require("./routes/crud.routes");

const app = express();

app.disable("x-powered-by");

app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const requestId = typeof incoming === "string" && incoming.trim() ? incoming.trim() : crypto.randomBytes(16).toString("hex");
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// Настраиваем Helmet для разрешения загрузки изображений
const allowedOrigins = new Set([
  ...config.cors.origins,
  config.proxy?.target,
].filter(Boolean));

const helmetCspImgSrc = ["'self'", "data:", "https:", ...Array.from(allowedOrigins)];

// 2. Helmet (твой код)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: helmetCspImgSrc,
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    if (config.env !== "production") {
      const devAllowed = [
        /^https?:\/\/localhost(?::\d+)?$/i,
        /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
        /^https?:\/\/10\.(?:\d{1,3}\.){2}\d{1,3}(?::\d+)?$/i,
        /^https?:\/\/192\.168\.(?:\d{1,3}\.)\d{1,3}(?::\d+)?$/i,
        /^https?:\/\/172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}(?::\d+)?$/i,
      ];

      if (devAllowed.some((re) => re.test(origin))) {
        callback(null, true);
        return;
      }
    }

    callback(new Error(`Источник не разрешён: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// Статика для загруженных файлов с CORS заголовками
// Должна быть до security middleware и proxy, чтобы не блокировалась
app.get("/uploads/thumb", async (req, res, next) => {
  try {
    const rawSrc = typeof req.query.src === "string" ? req.query.src : "";
    if (!rawSrc || !rawSrc.startsWith("/uploads/")) {
      res.status(400).json({ message: "Invalid src" });
      return;
    }

    const w = Math.min(2000, Math.max(1, Number(req.query.w) || 0)) || 0;
    const h = Math.min(2000, Math.max(1, Number(req.query.h) || 0)) || 0;
    const q = Math.min(95, Math.max(30, Number(req.query.q) || 70));
    const fit = String(req.query.fit || "cover");
    const allowedFits = new Set(["cover", "contain", "fill", "inside", "outside"]);
    const safeFit = allowedFits.has(fit) ? fit : "cover";
    const withoutPrefix = rawSrc.replace(/^\/uploads\//, "");
    const rel = withoutPrefix.replace(/\\/g, "/");
    const relSafe = rel.replace(/\.+\//g, "");

    const candidates = [config.uploadsDir, config.legacyUploadsDir].filter(Boolean);
    let originalPath = null;
    for (const baseDir of candidates) {
      const full = path.resolve(path.join(baseDir, relSafe));
      const base = path.resolve(baseDir);
      if (!full.startsWith(base + path.sep) && full !== base) continue;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        originalPath = full;
        break;
      }
    }

    if (!originalPath) {
      res.status(404).end();
      return;
    }

    const cacheDir = path.join(config.uploadsDir, ".thumbs");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const key = crypto
      .createHash("sha1")
      .update(`${rawSrc}|${w}|${h}|${q}|${safeFit}`)
      .digest("hex");
    const cachedPath = path.join(cacheDir, `${key}.webp`);

    if (fs.existsSync(cachedPath)) {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.sendFile(cachedPath);
      return;
    }

    const transformer = sharp(originalPath).rotate();
    const resized = w || h ? transformer.resize({ width: w || undefined, height: h || undefined, fit: safeFit }) : transformer;
    const buf = await resized.webp({ quality: q }).toBuffer();

    try {
      fs.writeFileSync(cachedPath, buf);
    } catch {
      // ignore cache write errors
    }

    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buf);
  } catch (e) {
    next(e);
  }
});

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
  express.static(config.uploadsDir, {
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

if (config.legacyUploadsDir && path.resolve(config.legacyUploadsDir) !== path.resolve(config.uploadsDir)) {
  app.use(
    "/uploads",
    (req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.has(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
      } else {
        res.header("Access-Control-Allow-Origin", "*");
      }
      res.header("Cross-Origin-Resource-Policy", "cross-origin");
      res.header("Cross-Origin-Embedder-Policy", "unsafe-none");
      res.header("Cache-Control", "public, max-age=31536000");
      next();
    },
    express.static(config.legacyUploadsDir, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        const origin = res.req.headers.origin;
        if (origin && allowedOrigins.has(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
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
}
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

