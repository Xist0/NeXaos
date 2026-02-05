const ApiError = require("../utils/api-error");
const asyncHandler = require("../utils/async-handler");
const catalogItemService = require("../services/catalog-item.service");
const logger = require("../utils/logger");

/**
 * Найти похожие элементы каталога
 * POST /api/catalog-items/:id/similar
 */
const findSimilar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit, weights } = req.body;

  const catalogItemId = parseInt(id, 10);
  if (isNaN(catalogItemId) || catalogItemId <= 0) {
    throw ApiError.badRequest("Некорректный ID элемента каталога");
  }

  const similarItems = await catalogItemService.findSimilarCatalogItems({
    catalogItemId,
    limit: limit || 10,
    weights: weights || {},
  });

  logger.info("Выполнен поиск похожих элементов каталога", {
    sourceCatalogItemId: catalogItemId,
    foundCount: similarItems.length,
    user: req.user?.id,
  });

  res.status(200).json({ data: similarItems });
});

module.exports = {
  findSimilar,
};
