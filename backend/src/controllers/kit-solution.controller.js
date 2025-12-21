const ApiError = require("../utils/api-error");
const asyncHandler = require("../utils/async-handler");
const kitSolutionService = require("../services/kit-solution.service");
const logger = require("../utils/logger");

/**
 * Контроллер для работы с готовыми решениями (комплектами кухни)
 */

/**
 * Получить готовое решение с модулями
 * GET /api/kit-solutions/:id
 */
const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const kitSolutionId = parseInt(id, 10);

  if (isNaN(kitSolutionId) || kitSolutionId <= 0) {
    throw ApiError.badRequest("Некорректный ID готового решения");
  }

  const kitSolution = await kitSolutionService.getKitSolutionWithModules(kitSolutionId);

  res.status(200).json({ data: kitSolution });
});

/**
 * Получить список готовых решений
 * GET /api/kit-solutions
 */
const list = asyncHandler(async (req, res) => {
  const filters = {
    search: req.query.search,
    colorId: req.query.colorId,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
  };

  const kitSolutions = await kitSolutionService.listKitSolutions(filters);

  res.status(200).json({ data: kitSolutions });
});

/**
 * Создать готовое решение
 * POST /api/kit-solutions
 */
const create = asyncHandler(async (req, res) => {
  const { moduleIds, ...kitData } = req.body;

  const kitSolution = await kitSolutionService.saveKitSolutionWithModules(kitData, moduleIds);

  logger.info("Создано готовое решение", {
    kitSolutionId: kitSolution.id,
    name: kitData.name,
    modulesCount: moduleIds?.length || 0,
    user: req.user?.id,
  });

  res.status(201).json({ data: kitSolution });
});

/**
 * Обновить готовое решение
 * PUT /api/kit-solutions/:id
 */
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { moduleIds, ...kitData } = req.body;

  const kitSolutionId = parseInt(id, 10);
  if (isNaN(kitSolutionId) || kitSolutionId <= 0) {
    throw ApiError.badRequest("Некорректный ID готового решения");
  }

  kitData.id = kitSolutionId;
  const kitSolution = await kitSolutionService.saveKitSolutionWithModules(kitData, moduleIds);

  logger.info("Обновлено готовое решение", {
    kitSolutionId,
    name: kitData.name,
    modulesCount: moduleIds?.length || 0,
    user: req.user?.id,
  });

  res.status(200).json({ data: kitSolution });
});

/**
 * Найти похожие готовые решения
 * POST /api/kit-solutions/:id/similar
 */
const findSimilar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit } = req.body;

  const kitSolutionId = parseInt(id, 10);
  if (isNaN(kitSolutionId) || kitSolutionId <= 0) {
    throw ApiError.badRequest("Некорректный ID готового решения");
  }

  const similarKits = await kitSolutionService.findSimilarKitSolutions({
    kitSolutionId,
    limit: limit || 10,
  });

  logger.info("Выполнен поиск похожих готовых решений", {
    sourceKitSolutionId: kitSolutionId,
    foundCount: similarKits.length,
    user: req.user?.id,
  });

  res.status(200).json({ data: similarKits });
});

module.exports = {
  getById,
  list,
  create,
  update,
  findSimilar,
};

