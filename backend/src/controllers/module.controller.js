const ApiError = require("../utils/api-error");
const asyncHandler = require("../utils/async-handler");
const moduleService = require("../services/module.service");
const logger = require("../utils/logger");

/**
 * Контроллер для работы с модулями кухни
 * Включает расчет столешницы, проверку совместимости и поиск похожих модулей
 */

/**
 * Рассчитать длину столешницы по нижним модулям
 * POST /api/modules/calculate-countertop
 */
const calculateCountertop = asyncHandler(async (req, res) => {
  const { moduleIds } = req.body;

  if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
    throw ApiError.badRequest("Необходимо указать массив ID модулей");
  }

  const result = await moduleService.calculateCountertop(moduleIds);

  logger.info("Выполнен расчет столешницы", {
    moduleIds,
    totalLength: result.totalLengthMm,
    user: req.user?.id,
  });

  res.status(200).json({ data: result });
});

/**
 * Проверить соответствие длины нижних и верхних модулей
 * POST /api/modules/check-compatibility
 */
const checkCompatibility = asyncHandler(async (req, res) => {
  const { bottomModuleIds, topModuleIds } = req.body;

  const bottomIds = Array.isArray(bottomModuleIds) ? bottomModuleIds : [];
  const topIds = Array.isArray(topModuleIds) ? topModuleIds : [];

  const result = await moduleService.checkModuleCompatibility(bottomIds, topIds);

  logger.info("Выполнена проверка совместимости модулей", {
    bottomModuleIds: bottomIds,
    topModuleIds: topIds,
    compatible: result.compatible,
    warningsCount: result.warnings.length,
    user: req.user?.id,
  });

  res.status(200).json({ data: result });
});

/**
 * Найти похожие модули
 * POST /api/modules/:id/similar
 */
const findSimilar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit, weights } = req.body;

  const moduleId = parseInt(id, 10);
  if (isNaN(moduleId) || moduleId <= 0) {
    throw ApiError.badRequest("Некорректный ID модуля");
  }

  const similarModules = await moduleService.findSimilarModules({
    moduleId,
    limit: limit || 10,
    weights: weights || {},
  });

  logger.info("Выполнен поиск похожих модулей", {
    sourceModuleId: moduleId,
    foundCount: similarModules.length,
    user: req.user?.id,
  });

  res.status(200).json({ data: similarModules });
});

/**
 * Получить модули с описаниями и характеристиками
 * POST /api/modules/with-descriptions
 */
const getModulesWithDescriptions = asyncHandler(async (req, res) => {
  const { moduleIds } = req.body;

  if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
    throw ApiError.badRequest("Необходимо указать массив ID модулей");
  }

  const modules = await moduleService.getModulesWithDescriptions(moduleIds);

  res.status(200).json({ data: modules });
});

/**
 * Получить описание модуля по основе артикула
 * GET /api/modules/descriptions/:baseSku
 */
const getDescriptionByBaseSku = asyncHandler(async (req, res) => {
  const { baseSku } = req.params;

  if (!baseSku) {
    throw ApiError.badRequest("Не указана основа артикула");
  }

  const description = await moduleService.getModuleDescriptionByBaseSku(baseSku);

  if (!description) {
    throw ApiError.notFound("Описание для данной основы артикула не найдено");
  }

  res.status(200).json({ data: description });
});

module.exports = {
  calculateCountertop,
  checkCompatibility,
  findSimilar,
  getModulesWithDescriptions,
  getDescriptionByBaseSku,
};

