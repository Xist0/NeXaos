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

  const includeInactive = req.user?.roleName === "admin" || req.user?.roleName === "manager";
  const kitSolution = await kitSolutionService.getKitSolutionWithModules(kitSolutionId, { includeInactive });

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
    categoryGroup: req.query.categoryGroup,
    category: req.query.category,
    parameterCategoryIds: req.query.parameterCategoryIds,
    sort: req.query.sort,
    limit: req.query.limit,
    offset: req.query.offset,
  };

  const includeInactiveRequested =
    req.query.includeInactive === "true" || req.query.includeInactive === true;
  const canIncludeInactive = req.user?.roleName === "admin" || req.user?.roleName === "manager";
  if (includeInactiveRequested && canIncludeInactive) {
    filters.includeInactive = true;
  }

  const kitSolutions = await kitSolutionService.listKitSolutions(filters);

  res.status(200).json({ data: kitSolutions });
});

/**
 * Удалить готовое решение
 * DELETE /api/kit-solutions/:id
 */
const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const kitSolutionId = parseInt(id, 10);

  if (isNaN(kitSolutionId) || kitSolutionId <= 0) {
    throw ApiError.badRequest("Некорректный ID готового решения");
  }

  await kitSolutionService.removeKitSolution(kitSolutionId);
  res.status(204).send();
});

/**
 * Создать готовое решение
 * POST /api/kit-solutions
 */
const create = asyncHandler(async (req, res) => {
  const { moduleIds, moduleItems, componentItems, ...kitData } = req.body;

  const kitSolution = await kitSolutionService.saveKitSolutionWithModules(kitData, moduleIds, moduleItems, componentItems);

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
  const { moduleIds, moduleItems, componentItems, ...kitData } = req.body;

  const kitSolutionId = parseInt(id, 10);
  if (isNaN(kitSolutionId) || kitSolutionId <= 0) {
    throw ApiError.badRequest("Некорректный ID готового решения");
  }

  kitData.id = kitSolutionId;
  const kitSolution = await kitSolutionService.saveKitSolutionWithModules(kitData, moduleIds, moduleItems, componentItems);

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
  remove,
  findSimilar,
};

