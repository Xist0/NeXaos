const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const asyncHandler = require("../utils/async-handler");
const { authGuard, optionalAuth } = require("../middleware/auth.middleware");
const entities = require("../modules/entities.config");
const createCrudController = require("../controllers/crud.controller");
const orderController = require("../controllers/order.controller");
const imageController = require("../controllers/image.controller");

// Кастомные роуты для orders
router.get("/orders", asyncHandler(orderController.list));
router.get("/orders/:id", asyncHandler(orderController.getById));
router.put("/orders/:id", authGuard, asyncHandler(createCrudController(entities.find(e => e.route === "orders")).update));

entities.forEach((entity) => {
  // Пропускаем orders, так как у них кастомные роуты
  if (entity.route === "orders") return;

  const controller = createCrudController(entity);
  const basePath = `/${entity.route}`;

  router.get(basePath, optionalAuth, asyncHandler(controller.list));
  router.get(`${basePath}/:id`, optionalAuth, asyncHandler(controller.getById));
  router.post(basePath, authGuard, asyncHandler(controller.create));
  router.put(`${basePath}/:id`, authGuard, asyncHandler(controller.update));
  router.delete(`${basePath}/:id`, authGuard, asyncHandler(controller.remove));
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
const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/[^a-z0-9_-]/gi, "_");
    cb(null, `${safeBase}-${Date.now()}${ext || ".bin"}`);
  },
});

const upload = multer({ storage });

router.post("/upload", upload.single("file"), (req, res) => {
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

// Роуты для работы с изображениями
router.get("/images/:entityType/:entityId", optionalAuth, asyncHandler(imageController.getImages));
router.post("/images/upload", authGuard, upload.single("file"), asyncHandler(imageController.uploadImage));
router.delete("/images/:id", authGuard, asyncHandler(imageController.deleteImage));
router.put("/images/reorder", authGuard, asyncHandler(imageController.reorderImages));
router.put("/images/:id/preview", authGuard, asyncHandler(imageController.setPreview));

module.exports = router;
