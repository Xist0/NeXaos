const router = require("express").Router();
const asyncHandler = require("../utils/async-handler");
const { authGuard } = require("../middleware/auth.middleware");
const entities = require("../modules/entities.config");
const createCrudController = require("../controllers/crud.controller");

entities.forEach((entity) => {
  const controller = createCrudController(entity);
  const basePath = `/${entity.route}`;

  router.get(basePath, asyncHandler(controller.list));
  router.get(`${basePath}/:id`, asyncHandler(controller.getById));
  router.post(basePath, authGuard, asyncHandler(controller.create));
  router.put(`${basePath}/:id`, authGuard, asyncHandler(controller.update));
  router.delete(`${basePath}/:id`, authGuard, asyncHandler(controller.remove));
  router.post("/logs", (req, res) => {
    const { level, message, meta, timestamp } = req.body;
    console.log(`[FRONT LOG] [${level}] ${message}`, meta);
    res.status(204).end(); // No Content
  });
});

module.exports = router;
