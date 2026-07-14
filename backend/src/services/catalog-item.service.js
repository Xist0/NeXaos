const { query } = require("../config/db");
const logger = require("../utils/logger");

/**
 * Находит похожие catalog-items: приоритет по подкатегории (category),
 * затем по категории (category_group). Товары из других category_group не попадают.
 */
const findSimilarCatalogItems = async (params) => {
  const { catalogItemId, limit = 10 } = params;

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

  // Получаем все активные catalog-items той же category_group (исключаем другие группы)
  const { rows: sameGroupItems } = await query(
    `SELECT ci.*
     FROM catalog_items ci
     WHERE ci.id != $1 AND ci.is_active = true
       AND LOWER(TRIM(COALESCE(ci.category_group, ''))) = LOWER(TRIM($2))
     ORDER BY ci.id`,
    [catalogItemId, source.category_group || ""]
  );

  // Разделяем на товары той же подкатегории (category) и той же группы
  const sourceCategory = String(source.category || "").trim().toLowerCase();
  const sameSubCategory = sameGroupItems.filter((i) =>
    String(i.category || "").trim().toLowerCase() === sourceCategory
  );
  const sameGroupOnly = sameGroupItems.filter((i) =>
    String(i.category || "").trim().toLowerCase() !== sourceCategory
  );

  // Сортировка внутри каждой группы — по близости цвета и размера
  const scoreItem = (i) => {
    let score = 0;
    if (source.primary_color_id && i.primary_color_id && source.primary_color_id === i.primary_color_id) score += 20;
    if (source.secondary_color_id && i.secondary_color_id && source.secondary_color_id === i.secondary_color_id) score += 15;
    if (source.length_mm && i.length_mm) {
      const diff = Math.abs(Number(source.length_mm) - Number(i.length_mm));
      if (Number.isFinite(diff) && diff <= 50) score += 10 * (1 - diff / 50);
    }
    if (source.depth_mm && i.depth_mm) {
      const diff = Math.abs(Number(source.depth_mm) - Number(i.depth_mm));
      if (Number.isFinite(diff) && diff <= 50) score += 8 * (1 - diff / 50);
    }
    if (source.height_mm && i.height_mm) {
      const diff = Math.abs(Number(source.height_mm) - Number(i.height_mm));
      if (Number.isFinite(diff) && diff <= 50) score += 7 * (1 - diff / 50);
    }
    return score;
  };

  sameSubCategory.sort((a, b) => scoreItem(b) - scoreItem(a));
  sameGroupOnly.sort((a, b) => scoreItem(b) - scoreItem(a));

  // Сначала товары той же подкатегории, затем — той же категории
  const combined = [...sameSubCategory, ...sameGroupOnly].slice(0, limit);

  // Обогащение
  for (const item of combined) {
    item.__type = "catalogItem";
    item._matchGroup = String(item.category || "").trim().toLowerCase() === sourceCategory ? "subCategory" : "category";
  }

  const colorIds = Array.from(
    new Set(
      combined
        .flatMap((x) => [x.primary_color_id, x.secondary_color_id])
        .filter(Boolean)
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    )
  );

  if (colorIds.length > 0) {
    const { rows: colorRows } = await query(
      `SELECT id, name, sku, hex, image_url
       FROM colors
       WHERE id = ANY($1::int[])`,
      [colorIds]
    );
    const byId = new Map(colorRows.map((row) => [row.id, row]));
    for (const item of combined) {
      if (item.primary_color_id) item.primary_color = byId.get(Number(item.primary_color_id));
      if (item.secondary_color_id) item.secondary_color = byId.get(Number(item.secondary_color_id));
    }
  }

  const itemIds = combined.map((x) => x.id);
  if (itemIds.length > 0) {
    const { rows: imgRows } = await query(
      `SELECT id, url, alt, sort_order, entity_id,
       (sort_order = 0) as is_preview
       FROM images
       WHERE entity_type = 'catalog-items' AND entity_id = ANY($1::int[])
       ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
      [itemIds]
    );
    const imgsByEntity = new Map();
    for (const img of imgRows) {
      if (!imgsByEntity.has(img.entity_id)) imgsByEntity.set(img.entity_id, []);
      imgsByEntity.get(img.entity_id).push(img);
    }
    for (const item of combined) {
      item.images = imgsByEntity.get(item.id) || [];
      if (!item.preview_url && item.images[0]?.url) item.preview_url = item.images[0].url;
    }
  }

  logger.info("Найдены похожие элементы каталога", {
    sourceCatalogItemId: catalogItemId,
    sameSubCategoryCount: sameSubCategory.length,
    sameGroupOnlyCount: sameGroupOnly.length,
    returnedCount: combined.length,
    limit,
  });

  return combined;
};

module.exports = {
  findSimilarCatalogItems,
};
