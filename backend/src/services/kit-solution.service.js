const ApiError = require("../utils/api-error");
const { query } = require("../config/db");
const logger = require("../utils/logger");
const fs = require("fs");
const path = require("path");
const config = require("../config/env");

/**
 * Сервис для работы с готовыми решениями (комплектами кухни)
 */

/**
 * Получить готовое решение с полной информацией о модулях
 * @param {number} kitSolutionId - ID готового решения
 * @returns {Promise<Object>} Готовое решение с модулями
 */
const getKitSolutionWithModules = async (kitSolutionId, options = {}) => {
  const includeInactive = !!options.includeInactive;

  const inferPositionTypeFromBaseSku = (baseSku) => {
    const s = String(baseSku || "").trim();
    if (/^В/i.test(s)) return "top";
    if (/^Н/i.test(s)) return "bottom";
    return null;
  };

  // Получаем основную информацию о готовом решении
  const { rows: kitRows } = await query(
    `SELECT 
      ks.*,
      c1.name as primary_color_name,
      c1.sku as primary_color_sku,
      c1.image_url as primary_color_image,
      c2.name as secondary_color_name,
      c2.sku as secondary_color_sku,
      c2.image_url as secondary_color_image,
      m.name as material_name,
      kt.name as kitchen_type_name,
      img.url as image_preview_url
    FROM kit_solutions ks
    LEFT JOIN colors c1 ON ks.primary_color_id = c1.id
    LEFT JOIN colors c2 ON ks.secondary_color_id = c2.id
    LEFT JOIN materials m ON ks.material_id = m.id
    LEFT JOIN kitchen_types kt ON ks.kitchen_type_id = kt.id
    LEFT JOIN LATERAL (
      SELECT url
      FROM images
      WHERE entity_type = 'kit-solutions' AND entity_id = ks.id
      ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC
      LIMIT 1
    ) img ON true
    WHERE ks.id = $1${includeInactive ? "" : " AND ks.is_active = true"}`,
    [kitSolutionId]
  );

  if (kitRows.length === 0) {
    throw ApiError.notFound("Запись не найдена");
  }

  const kitSolution = kitRows[0];
  if (kitSolution.image_preview_url) {
    kitSolution.preview_url = kitSolution.image_preview_url;
  }
  delete kitSolution.image_preview_url;

  const { rows: allImages } = await query(
    `SELECT id, url, alt, sort_order,
     (sort_order = 0) as is_preview
     FROM images
     WHERE entity_type = 'kit-solutions' AND entity_id = $1
     ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
    [kitSolutionId]
  );
  kitSolution.images = allImages;

  // Получаем модули готового решения, сгруппированные по типам
  const { rows: moduleRows } = await query(
    `SELECT 
      ksm.*,
      m.*,
      mc.code as category_code,
      mc.name as category_name,
      imgm.url as module_preview_url
    FROM kit_solution_modules ksm
    JOIN modules m ON ksm.module_id = m.id
    LEFT JOIN module_categories mc ON m.module_category_id = mc.id
    LEFT JOIN LATERAL (
      SELECT url
      FROM images
      WHERE entity_type = 'modules' AND entity_id = m.id
      ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC
      LIMIT 1
    ) imgm ON true
    WHERE ksm.kit_solution_id = $1
    ORDER BY ksm.position_type, ksm.position_order`,
    [kitSolutionId]
  );

  // Группируем модули по типам позиций
  const modulesByType = {
    bottom: [],
    top: [],
    tall: [],
    filler: [],
    accessory: [],
  };

  moduleRows.forEach((module) => {
    const inferred = inferPositionTypeFromBaseSku(module.base_sku);
    const type = module.position_type || module.category_code || inferred || "bottom";
    if (!modulesByType[type]) return;

    modulesByType[type].push({
      id: module.module_id,
      sku: module.sku,
      name: module.name,
      preview_url: module.module_preview_url || module.preview_url,
      lengthMm: module.length_mm,
      depthMm: module.depth_mm,
      heightMm: module.height_mm,
      facadeColor: module.facade_color,
      corpusColor: module.corpus_color,
      finalPrice: module.final_price,
      categoryCode: module.category_code,
      categoryName: module.category_name,
      positionOrder: module.position_order,
    });
  });

  // Рассчитываем общие размеры и длину столешницы
  const bottomModules = modulesByType.bottom;
  const topModules = modulesByType.top;
  
  const bottomTotalLength = bottomModules.reduce((sum, m) => sum + (m.lengthMm || 0), 0);
  const topTotalLength = topModules.reduce((sum, m) => sum + (m.lengthMm || 0), 0);
  const maxDepth = Math.max(...bottomModules.map(m => m.depthMm || 0), 0);

  return {
    ...kitSolution,
    modules: modulesByType,
    modulesCount: {
      bottom: bottomModules.length,
      top: topModules.length,
      tall: modulesByType.tall.length,
      filler: modulesByType.filler.length,
      accessory: modulesByType.accessory.length,
    },
    calculatedDimensions: {
      bottomTotalLength,
      topTotalLength,
      maxDepth,
      countertopLength: bottomTotalLength,
      countertopDepth: maxDepth,
    },
  };
};

/**
 * Создать или обновить готовое решение с модулями
 * @param {Object} kitData - Данные готового решения
 * @param {Array<number>} moduleIds - Массив ID модулей
 * @returns {Promise<Object>} Созданное/обновленное готовое решение
 */
const saveKitSolutionWithModules = async (kitData, moduleIds = []) => {
  const inferPositionTypeFromBaseSku = (baseSku) => {
    const s = String(baseSku || "").trim();
    if (/^В/i.test(s)) return "top";
    if (/^Н/i.test(s)) return "bottom";
    return null;
  };

  const {
    id,
    name,
    sku,
    description,
    kitchen_type_id,
    primary_color_id,
    secondary_color_id,
    material_id,
    total_length_mm,
    total_depth_mm,
    total_height_mm,
    countertop_length_mm,
    countertop_depth_mm,
    base_price,
    final_price,
    preview_url,
    is_active,
  } = kitData;

  // Нормализуем material_id: если пусто/не число/не существует — сохраняем NULL
  let normalizedMaterialId = null;
  const parsedMaterialId = Number(material_id);
  if (Number.isFinite(parsedMaterialId) && parsedMaterialId > 0) {
    const { rows: materialRows } = await query(
      `SELECT id FROM materials WHERE id = $1`,
      [parsedMaterialId]
    );
    normalizedMaterialId = materialRows.length > 0 ? parsedMaterialId : null;
  }

  // Нормализуем kitchen_type_id
  let normalizedKitchenTypeId = null;
  const parsedKitchenTypeId = Number(kitchen_type_id);
  if (Number.isFinite(parsedKitchenTypeId) && parsedKitchenTypeId > 0) {
    const { rows: ktRows } = await query(
      `SELECT id FROM kitchen_types WHERE id = $1`,
      [parsedKitchenTypeId]
    );
    normalizedKitchenTypeId = ktRows.length > 0 ? parsedKitchenTypeId : null;
  }

  let kitSolutionId;

  if (id) {
    // Обновление существующего решения
    await query(
      `UPDATE kit_solutions 
       SET name = $1, sku = $2, description = $3,
           kitchen_type_id = $4,
           primary_color_id = $5, secondary_color_id = $6, material_id = $7,
           total_length_mm = $8, total_depth_mm = $9, total_height_mm = $10,
           countertop_length_mm = $11, countertop_depth_mm = $12,
           base_price = $13, final_price = $14, preview_url = $15,
           is_active = $16,
           updated_at = now()
       WHERE id = $17`,
      [
        name,
        sku,
        description,
        normalizedKitchenTypeId,
        primary_color_id,
        secondary_color_id,
        normalizedMaterialId,
        total_length_mm,
        total_depth_mm,
        total_height_mm,
        countertop_length_mm,
        countertop_depth_mm,
        base_price,
        final_price,
        preview_url,
        is_active,
        id,
      ]
    );
    kitSolutionId = id;

    // Удаляем старые связи с модулями
    await query(`DELETE FROM kit_solution_modules WHERE kit_solution_id = $1`, [id]);
  } else {
    // Создание нового решения
    const { rows } = await query(
      `INSERT INTO kit_solutions 
       (name, sku, description, kitchen_type_id,
        primary_color_id, secondary_color_id, material_id,
        total_length_mm, total_depth_mm, total_height_mm,
        countertop_length_mm, countertop_depth_mm, base_price, final_price, preview_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        name,
        sku,
        description,
        normalizedKitchenTypeId,
        primary_color_id,
        secondary_color_id,
        normalizedMaterialId,
        total_length_mm,
        total_depth_mm,
        total_height_mm,
        countertop_length_mm,
        countertop_depth_mm,
        base_price,
        final_price,
        preview_url,
        is_active,
      ]
    );
    kitSolutionId = rows[0].id;
  }

  // Добавляем связи с модулями
  if (Array.isArray(moduleIds) && moduleIds.length > 0) {
    // Получаем информацию о модулях для определения их категорий
    const { rows: modulesInfo } = await query(
      `SELECT m.id, mc.code as category_code
            , m.base_sku
       FROM modules m
       LEFT JOIN module_categories mc ON m.module_category_id = mc.id
       WHERE m.id = ANY($1::int[])`,
      [moduleIds]
    );

    const moduleMap = new Map(
      modulesInfo.map((m) => {
        const inferred = inferPositionTypeFromBaseSku(m.base_sku);
        const type = m.category_code || inferred || "bottom";
        return [m.id, type];
      })
    );

    // Вставляем связи с модулями
    for (let i = 0; i < moduleIds.length; i++) {
      const moduleId = moduleIds[i];
      const categoryCode = moduleMap.get(moduleId) || 'bottom';
      
      await query(
        `INSERT INTO kit_solution_modules (kit_solution_id, module_id, position_order, position_type)
         VALUES ($1, $2, $3, $4)`,
        [kitSolutionId, moduleId, i, categoryCode]
      );
    }
  }

  // Получаем обновленное решение
  return await getKitSolutionWithModules(kitSolutionId, { includeInactive: true });
};

const removeKitSolution = async (kitSolutionId) => {
  const parsedId = Number(kitSolutionId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID готового решения");
  }

  const { rows: imgRows } = await query(
    `SELECT id, url FROM images WHERE entity_type = 'kit-solutions' AND entity_id = $1`,
    [parsedId]
  );

  for (const img of imgRows) {
    const url = img.url;
    if (!url) continue;
    const urlPath = url.startsWith("/") ? url.slice(1) : url;
    const relative = urlPath.replace(/^uploads\//, "");
    const filePath = path.join(config.uploadsDir, relative);
    const legacyPath = config.legacyUploadsDir ? path.join(config.legacyUploadsDir, relative) : null;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }

    if (legacyPath && fs.existsSync(legacyPath)) {
      try {
        fs.unlinkSync(legacyPath);
      } catch {
        // ignore
      }
    }
  }

  if (imgRows.length > 0) {
    await query(
      `DELETE FROM images WHERE entity_type = 'kit-solutions' AND entity_id = $1`,
      [parsedId]
    );
  }

  const { rows } = await query(
    `DELETE FROM kit_solutions WHERE id = $1 RETURNING id`,
    [parsedId]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Запись не найдена");
  }
};

/**
 * Получить список готовых решений с краткой информацией
 * @param {Object} filters - Фильтры для поиска
 * @returns {Promise<Array>} Список готовых решений
 */
const listKitSolutions = async (filters = {}) => {
  const { search, colorId, minPrice, maxPrice, includeInactive, limit, offset } = filters;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const conditions = [];
  if (!includeInactive) {
    conditions.push('ks.is_active = true');
  }
  const params = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(`(ks.name ILIKE $${paramIndex} OR ks.sku ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (colorId) {
    conditions.push(`(ks.primary_color_id = $${paramIndex} OR ks.secondary_color_id = $${paramIndex})`);
    params.push(parseInt(colorId, 10));
    paramIndex++;
  }

  if (minPrice) {
    conditions.push(`ks.final_price >= $${paramIndex}`);
    params.push(parseFloat(minPrice));
    paramIndex++;
  }

  if (maxPrice) {
    conditions.push(`ks.final_price <= $${paramIndex}`);
    params.push(parseFloat(maxPrice));
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT 
      ks.*,
      c1.id as primary_color_id,
      c1.name as primary_color_name,
      c1.sku as primary_color_sku,
      c1.image_url as primary_color_image,
      c2.id as secondary_color_id,
      c2.name as secondary_color_name,
      c2.sku as secondary_color_sku,
      c2.image_url as secondary_color_image,
      kt.name as kitchen_type_name,
      img.url as image_preview_url,
      (SELECT COUNT(*) FROM kit_solution_modules WHERE kit_solution_id = ks.id) as modules_count
    FROM kit_solutions ks
    LEFT JOIN colors c1 ON ks.primary_color_id = c1.id
    LEFT JOIN colors c2 ON ks.secondary_color_id = c2.id
    LEFT JOIN kitchen_types kt ON ks.kitchen_type_id = kt.id
    LEFT JOIN LATERAL (
      SELECT url
      FROM images
      WHERE entity_type = 'kit-solutions' AND entity_id = ks.id
      ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC
      LIMIT 1
    ) img ON true
    ${whereClause}
    ORDER BY ks.id DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(safeLimit, safeOffset);

  const { rows } = await query(sql, params);
  return rows.map((row) => {
    if (row.image_preview_url) {
      row.preview_url = row.image_preview_url;
    }
    delete row.image_preview_url;

    if (row.primary_color_id && row.primary_color_name) {
      row.primary_color = {
        id: row.primary_color_id,
        name: row.primary_color_name,
        sku: row.primary_color_sku,
        image_url: row.primary_color_image,
      };
    }
    if (row.secondary_color_id && row.secondary_color_name) {
      row.secondary_color = {
        id: row.secondary_color_id,
        name: row.secondary_color_name,
        sku: row.secondary_color_sku,
        image_url: row.secondary_color_image,
      };
    }

    return row;
  });
};

/**
 * Найти похожие готовые решения на основе параметров
 * @param {Object} params - Параметры для поиска
 * @param {number} params.kitSolutionId - ID готового решения для сравнения
 * @param {number} params.limit - Максимальное количество результатов
 * @returns {Promise<Array>} Массив похожих готовых решений
 */
const findSimilarKitSolutions = async (params) => {
  const { kitSolutionId, limit = 10 } = params;

  if (!kitSolutionId) {
    throw new Error("Необходимо указать ID готового решения для поиска похожих");
  }

  // Получаем данные исходного готового решения
  const sourceKit = await getKitSolutionWithModules(kitSolutionId);

  // Веса параметров
  const weights = {
    primaryColor: 30,
    secondaryColor: 25,
    material: 20,
    totalLength: 15,
    hasTallModule: 10,
  };

  // Получаем все активные готовые решения кроме исходного
  const { rows: allKits } = await query(
    `SELECT ks.*,
      img.url as image_preview_url,
      (SELECT COUNT(*) FROM kit_solution_modules WHERE kit_solution_id = ks.id) as modules_count
     FROM kit_solutions ks
     LEFT JOIN LATERAL (
       SELECT url
       FROM images
       WHERE entity_type = 'kit-solutions' AND entity_id = ks.id
       ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC
       LIMIT 1
     ) img ON true
     WHERE ks.id != $1 AND ks.is_active = true
     ORDER BY ks.id`,
    [kitSolutionId]
  );

  // Вычисляем схожесть для каждого готового решения
  const similarKits = await Promise.all(allKits.map(async (kit) => {
    let similarityScore = 0;
    const matches = [];

    // Сравнение основного цвета (30 баллов)
    if (sourceKit.primary_color_id && kit.primary_color_id && 
        sourceKit.primary_color_id === kit.primary_color_id) {
      similarityScore += weights.primaryColor;
      matches.push("primaryColor");
    }

    // Сравнение дополнительного цвета (25 баллов)
    if (sourceKit.secondary_color_id && kit.secondary_color_id && 
        sourceKit.secondary_color_id === kit.secondary_color_id) {
      similarityScore += weights.secondaryColor;
      matches.push("secondaryColor");
    }

    // Сравнение материала (20 баллов)
    if (sourceKit.material_id && kit.material_id && 
        sourceKit.material_id === kit.material_id) {
      similarityScore += weights.material;
      matches.push("material");
    }

    // Сравнение общей длины (15 баллов, с учетом отклонения ±100мм)
    if (sourceKit.total_length_mm && kit.total_length_mm) {
      const lengthDiff = Math.abs(sourceKit.total_length_mm - kit.total_length_mm);
      if (lengthDiff <= 100) {
        const lengthScore = weights.totalLength * (1 - lengthDiff / 100);
        similarityScore += lengthScore;
        matches.push("totalLength");
      }
    }

    // Проверяем наличие пенала в обоих решениях
    const { rows: kitModules } = await query(
      `SELECT mc.code as category_code
       FROM kit_solution_modules ksm
       JOIN modules m ON ksm.module_id = m.id
       LEFT JOIN module_categories mc ON m.module_category_id = mc.id
       WHERE ksm.kit_solution_id = $1 AND mc.code = 'tall'`,
      [kit.id]
    );

    const sourceHasTall = sourceKit.modulesCount.tall > 0;
    const kitHasTall = kitModules.length > 0;

    if (sourceHasTall && kitHasTall) {
      similarityScore += weights.hasTallModule;
      matches.push("hasTallModule");
    }

    const out = {
      ...kit,
      similarityScore,
      matches,
      similarityPercent: Math.min(100, Math.round((similarityScore / 100) * 100)),
    };
    if (out.image_preview_url) {
      out.preview_url = out.image_preview_url;
    }
    delete out.image_preview_url;
    return out;
  }));

  // Сортируем по убыванию схожести
  const sorted = similarKits
    .filter(k => k.similarityScore > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  logger.info("Найдены похожие готовые решения", {
    sourceKitSolutionId: kitSolutionId,
    foundCount: sorted.length,
    limit,
  });

  return sorted;
};

module.exports = {
  getKitSolutionWithModules,
  saveKitSolutionWithModules,
  removeKitSolution,
  listKitSolutions,
  findSimilarKitSolutions,
};

