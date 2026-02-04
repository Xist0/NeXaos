const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const ApiError = require("../utils/api-error");
const asyncHandler = require("../utils/async-handler");
const { authGuard, optionalAuth, requireAdminOrManager } = require("../middleware/auth.middleware");
const config = require("../config/env");
const entities = require("../modules/entities.config");
const createCrudController = require("../controllers/crud.controller");
const orderController = require("../controllers/order.controller");
const imageController = require("../controllers/image.controller");
const moduleController = require("../controllers/module.controller");
const kitSolutionController = require("../controllers/kit-solution.controller");

// Кастомные роуты для orders
router.get("/orders", authGuard, asyncHandler(orderController.list));
router.get("/orders/:id", authGuard, asyncHandler(orderController.getById));
router.get("/orders/:id/notes", authGuard, asyncHandler(orderController.listNotes));
router.post("/orders/:id/notes", authGuard, asyncHandler(orderController.addNote));
router.put(
  "/orders/:id",
  authGuard,
  requireAdminOrManager,
  asyncHandler(createCrudController(entities.find((e) => e.route === "orders")).update)
);

entities.forEach((entity) => {
  // Пропускаем orders, так как у них кастомные роуты
  if (entity.route === "orders") return;
  if (entity.route === "images") return;
  if (entity.route === "kit-solutions") return;

  const controller = createCrudController(entity);
  const basePath = `/${entity.route}`;

  // Заметки к заказам: только для админа/менеджера
  const isOrderNotes = entity.route === "order-notes";
  const auth = isOrderNotes ? [authGuard, requireAdminOrManager] : [authGuard];

  router.get(basePath, optionalAuth, asyncHandler(controller.list));
  router.get(`${basePath}/:id`, optionalAuth, asyncHandler(controller.getById));
  router.post(basePath, ...auth, asyncHandler(controller.create));
  router.put(`${basePath}/:id`, ...auth, asyncHandler(controller.update));
  router.delete(`${basePath}/:id`, ...auth, asyncHandler(controller.remove));
});

router.post("/logs", (req, res) => {
  try {
    const body = req.body || {};
    const { level = "info", message = "Лог без сообщения", meta = {} } = body;
    const metaStr = meta && typeof meta === "object" && Object.keys(meta).length > 0 
      ? JSON.stringify(meta) 
      : "";
    console.log(`[ЛОГ КЛИЕНТА] [${level}] ${message}${metaStr ? " " + metaStr : ""}`);
    res.status(204).end(); // No Content
  } catch (err) {
    console.log(`[ЛОГ КЛИЕНТА] [error] Ошибка обработки лога:`, err.message);
    res.status(204).end();
  }
});

// Загрузка файлов (изображения и др.)
const uploadsDir = config.uploadsDir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/[^a-z0-9_-]/gi, "_");
    // Добавляем entityId и timestamp для уникальности
    const entityId = req.body?.entityId || "temp";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    cb(null, `${entityId}-${safeBase}-${timestamp}-${random}${ext || ".bin"}`);
  },
});

// Валидация типов файлов для изображений
const imageFileFilter = (req, file, cb) => {
  // Разрешенные типы изображений
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только изображения (JPEG, PNG, GIF, WebP, SVG)'), false);
  }
};

const mediaFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
  ];

  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.mp4',
    '.webm',
    '.ogg',
    '.mov',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены изображения и видео (JPEG, PNG, GIF, WebP, SVG, MP4, WebM, OGG, MOV)'), false);
  }
};

// Настройка multer для загрузки изображений с валидацией
const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB максимум
  },
});

const uploadMedia = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB максимум
  },
});

const handleMulterErrorUpload = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const apiError = ApiError.badRequest('Размер файла превышает допустимый (30MB)');
      return next(apiError);
    }
    const apiError = ApiError.badRequest(`Ошибка загрузки файла: ${err.message}`);
    return next(apiError);
  }
  if (err) {
    const apiError = ApiError.badRequest(err.message || 'Ошибка загрузки файла');
    return next(apiError);
  }
  next();
};

router.post("/upload", authGuard, requireAdminOrManager, upload.single("file"), handleMulterErrorUpload, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Файл не получен" });
  }

  const urlPath = `/uploads/${req.file.filename}`;
  res.status(201).json({
    url: urlPath,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// Обработка ошибок multer для валидации файлов
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const apiError = ApiError.badRequest('Размер файла превышает допустимый (30MB)');
      return next(apiError);
    }
    const apiError = ApiError.badRequest(`Ошибка загрузки файла: ${err.message}`);
    return next(apiError);
  }
  if (err) {
    // Ошибка валидации типа файла из fileFilter
    const apiError = ApiError.badRequest(err.message || 'Ошибка загрузки файла');
    return next(apiError);
  }
  next();
};

// Роуты для работы с изображениями согласно спецификации
// GET /api/images/:entityType/:entityId - получить все изображения для сущности
router.get("/images/:entityType/:entityId", optionalAuth, asyncHandler(imageController.getImages));

// POST /api/images - загрузить новое изображение (multipart/form-data)
router.post("/images", authGuard, requireAdminOrManager, uploadMedia.single("file"), handleMulterError, asyncHandler(imageController.uploadImage));

// DELETE /api/images/:id - удалить изображение
router.delete("/images/:id", authGuard, requireAdminOrManager, asyncHandler(imageController.deleteImage));

// POST /api/images/reorder - изменить порядок изображений (JSON)
router.post("/images/reorder", authGuard, requireAdminOrManager, asyncHandler(imageController.reorderImages));

// POST /api/images/:id/set-preview - назначить изображение превью
router.post("/images/:id/set-preview", authGuard, requireAdminOrManager, asyncHandler(imageController.setPreview));

router.get("/public/hero-slides", optionalAuth, asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const now = new Date().toISOString();
  const { rows: slides } = await require("../config/db").query(
    `SELECT id, title, description, publish_at, sort_order, is_active, created_at
     FROM hero_slides
     WHERE is_active = TRUE
       AND (publish_at IS NULL OR publish_at <= $1)
     ORDER BY sort_order ASC, id ASC`,
    [now]
  );

  const ids = slides.map((s) => s.id);
  let mediaByEntityId = {};
  if (ids.length) {
    const { rows: media } = await require("../config/db").query(
      `SELECT id, entity_id, url, alt, sort_order, media_type, mime_type
       FROM images
       WHERE entity_type IN ('hero_slides', 'hero-slides')
         AND entity_id = ANY($1::int[])
       ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
      [ids]
    );

    mediaByEntityId = media.reduce((acc, row) => {
      acc[row.entity_id] = acc[row.entity_id] || [];
      acc[row.entity_id].push(row);
      return acc;
    }, {});
  }

  res.status(200).json({
    data: slides.map((slide) => ({
      ...slide,
      media: mediaByEntityId[slide.id] || [],
    })),
  });
}));

router.get("/public/works", optionalAuth, asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const now = new Date().toISOString();
  const { rows: works } = await require("../config/db").query(
    `SELECT id, title, description, publish_at, sort_order, is_active, created_at
     FROM works
     WHERE is_active = TRUE
       AND (publish_at IS NULL OR publish_at <= $1)
     ORDER BY sort_order ASC, id ASC`,
    [now]
  );

  const ids = works.map((w) => w.id);
  let mediaByEntityId = {};
  if (ids.length) {
    const { rows: media } = await require("../config/db").query(
      `SELECT id, entity_id, url, alt, sort_order, media_type, mime_type
       FROM images
       WHERE entity_type = 'works'
         AND entity_id = ANY($1::int[])
       ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
      [ids]
    );

    mediaByEntityId = media.reduce((acc, row) => {
      acc[row.entity_id] = acc[row.entity_id] || [];
      acc[row.entity_id].push(row);
      return acc;
    }, {});
  }

  res.status(200).json({
    data: works.map((work) => ({
      ...work,
      media: mediaByEntityId[work.id] || [],
    })),
  });
}));

// Роуты для работы с модулями
// POST /api/modules/calculate-countertop - рассчитать длину столешницы
router.post("/modules/calculate-countertop", optionalAuth, asyncHandler(moduleController.calculateCountertop));

// POST /api/modules/check-compatibility - проверить совместимость модулей
router.post("/modules/check-compatibility", optionalAuth, asyncHandler(moduleController.checkCompatibility));

// POST /api/modules/:id/similar - найти похожие модули
router.post("/modules/:id/similar", optionalAuth, asyncHandler(moduleController.findSimilar));

// POST /api/modules/with-descriptions - получить модули с описаниями
router.post("/modules/with-descriptions", optionalAuth, asyncHandler(moduleController.getModulesWithDescriptions));

// GET /api/modules/descriptions/:baseSku - получить описание по основе артикула
router.get("/modules/descriptions/:baseSku", optionalAuth, asyncHandler(moduleController.getDescriptionByBaseSku));

// Роуты для готовых решений
// GET /api/kit-solutions - получить список готовых решений
router.get("/kit-solutions", optionalAuth, asyncHandler(kitSolutionController.list));

// GET /api/kit-solutions/:id - получить готовое решение с модулями
router.get("/kit-solutions/:id", optionalAuth, asyncHandler(kitSolutionController.getById));

// POST /api/kit-solutions - создать готовое решение
router.post("/kit-solutions", authGuard, requireAdminOrManager, asyncHandler(kitSolutionController.create));

// PUT /api/kit-solutions/:id - обновить готовое решение
router.put("/kit-solutions/:id", authGuard, requireAdminOrManager, asyncHandler(kitSolutionController.update));

// DELETE /api/kit-solutions/:id - удалить готовое решение
router.delete("/kit-solutions/:id", authGuard, requireAdminOrManager, asyncHandler(kitSolutionController.remove));

// POST /api/kit-solutions/:id/similar - найти похожие готовые решения
router.post("/kit-solutions/:id/similar", optionalAuth, asyncHandler(kitSolutionController.findSimilar));

module.exports = router;
