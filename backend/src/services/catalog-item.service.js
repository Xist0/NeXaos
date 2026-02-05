const { query } = require("../config/db");
const logger = require("../utils/logger");

/**
 * Находит похожие catalog-items на основе заданных параметров
 * @param {Object} params
 * @param {number} params.catalogItemId
 * @param {number} params.limit
 * @param {Object} params.weights
 * @returns {Promise<Array>}
 */
const findSimilarCatalogItems = async (params) => {
  const { catalogItemId, limit = 10, weights = {} } = params;

  if (!catalogItemId) {
    throw new Error("Необходимо указать ID элемента каталога для поиска похожих");
  }

  const { rows: sourceRows } = await query(
    `SELECT ci.*
     FROM catalog_items ci
     WHERE ci.id = $1 AND ci.is_active = true`,
    [catalogItemId]
  );

  if (!sourceRows.length) {
    throw new Error("Элемент каталога не найден");
  }

  const source = sourceRows[0];

  const defaultWeights = {
    categoryGroup: 25,
    category: 15,
    primaryColor: 20,
    secondaryColor: 15,
    length: 10,
    depth: 8,
    height: 7,
  };

  const finalWeights = { ...defaultWeights, ...weights };

  const { rows: allItems } = await query(
    `SELECT ci.*
     FROM catalog_items ci
     WHERE ci.id != $1 AND ci.is_active = true
     ORDER BY ci.id`,
    [catalogItemId]
  );

  const similar = allItems
    .map((item) => {
      let similarityScore = 0;
      const matches = [];

      if (source.category_group && item.category_group && source.category_group === item.category_group) {
        similarityScore += finalWeights.categoryGroup;
        matches.push("categoryGroup");
      }

      if (source.category && item.category && source.category === item.category) {
        similarityScore += finalWeights.category;
        matches.push("category");
      }

      if (source.primary_color_id && item.primary_color_id && source.primary_color_id === item.primary_color_id) {
        similarityScore += finalWeights.primaryColor;
        matches.push("primaryColor");
      }

      if (source.secondary_color_id && item.secondary_color_id && source.secondary_color_id === item.secondary_color_id) {
        similarityScore += finalWeights.secondaryColor;
        matches.push("secondaryColor");
      }

      const scoreByDiff = (src, val, weight, tolerance) => {
        if (!src || !val) return 0;
        const diff = Math.abs(Number(src) - Number(val));
        if (!Number.isFinite(diff) || diff > tolerance) return 0;
        return weight * (1 - diff / tolerance);
      };

      const lengthScore = scoreByDiff(source.length_mm, item.length_mm, finalWeights.length, 50);
      if (lengthScore > 0) {
        similarityScore += lengthScore;
        matches.push("length");
      }

      const depthScore = scoreByDiff(source.depth_mm, item.depth_mm, finalWeights.depth, 50);
      if (depthScore > 0) {
        similarityScore += depthScore;
        matches.push("depth");
      }

      const heightScore = scoreByDiff(source.height_mm, item.height_mm, finalWeights.height, 50);
      if (heightScore > 0) {
        similarityScore += heightScore;
        matches.push("height");
      }

      return {
        ...item,
        similarityScore,
        matches,
        similarityPercent: Math.min(100, Math.round((similarityScore / 100) * 100)),
      };
    })
    .filter((x) => x.similarityScore > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  const colorIds = Array.from(
    new Set(
      similar
        .flatMap((x) => [x.primary_color_id, x.secondary_color_id])
        .filter(Boolean)
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    )
  );

  if (colorIds.length > 0) {
    const { rows: colorRows } = await query(
      `SELECT id, name, sku, image_url
       FROM colors
       WHERE id = ANY($1::int[])`,
      [colorIds]
    );
    const byId = new Map(colorRows.map((row) => [row.id, row]));
    for (const item of similar) {
      if (item.primary_color_id) item.primary_color = byId.get(Number(item.primary_color_id));
      if (item.secondary_color_id) item.secondary_color = byId.get(Number(item.secondary_color_id));
    }
  }

  logger.info("Найдены похожие элементы каталога", {
    sourceCatalogItemId: catalogItemId,
    foundCount: similar.length,
    limit,
  });

  return similar;
};

module.exports = {
  findSimilarCatalogItems,
};
