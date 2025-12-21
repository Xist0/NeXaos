const { query } = require("../config/db");
const logger = require("../utils/logger");
const ApiError = require("../utils/api-error");

/**
 * Сервис для работы с готовыми решениями (комплектами кухни)
 */

/**
 * Получить готовое решение с полной информацией о модулях
 * @param {number} kitSolutionId - ID готового решения
 * @returns {Promise<Object>} Готовое решение с модулями
 */
const getKitSolutionWithModules = async (kitSolutionId) => {
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
     kt.name as kitchen_type_name
     FROM kit_solutions ks
     LEFT JOIN colors c1 ON ks.primary_color_id = c1.id
     LEFT JOIN colors c2 ON ks.secondary_color_id = c2.id
     LEFT JOIN materials m ON ks.material_id = m.id
     LEFT JOIN kitchen_types kt ON ks.kitchen_type_id = kt.id
     WHERE ks.id = $1 AND ks.is_active = true`,
    [kitSolutionId]
  );

  if (kitRows.length === 0) {
    throw new Error("Готовое решение не найдено");
  }

  const kitSolution = kitRows[0];

  // Получаем модули готового решения, сгруппированные по типам
  const { rows: moduleRows } = await query(
    `SELECT 
     ksm.*,
     m.*,
     mc.code as category_code,
     mc.name as category_name,
     mt.code as type_code,
     mt.name as type_name
     FROM kit_solution_modules ksm
     JOIN modules m ON ksm.module_id = m.id
     LEFT JOIN module_categories mc ON m.module_category_id = mc.id
     LEFT JOIN module_types mt ON m.module_type_id = mt.id
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

  moduleRows.forEach(module => {
    const type = module.position_type || module.category_code || 'bottom';
    if (modulesByType[type]) {
      modulesByType[type].push({
        id: module.module_id,
        sku: module.sku,
        name: module.name,
        lengthMm: module.length_mm,
        depthMm: module.depth_mm,
        heightMm: module.height_mm,
        facadeColor: module.facade_color,
        corpusColor: module.corpus_color,
        finalPrice: module.final_price,
        categoryCode: module.category_code,
        categoryName: module.category_name,
        typeCode: module.type_code,
        typeName: module.type_name,
        positionOrder: module.position_order,
      });
    }
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
  const {
    id,
    name,
    sku,
    description,
    primary_color_id,
    secondary_color_id,
    material_id,
    countertop_length_mm,
    countertop_depth_mm,
    base_price,
    final_price,
    preview_url,
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

  let kitSolutionId;

  if (id) {
    // Обновление существующего решения
    await query(
      `UPDATE kit_solutions 
       SET name = $1, sku = $2, description = $3, 
           primary_color_id = $4, secondary_color_id = $5, material_id = $6,
           countertop_length_mm = $7, countertop_depth_mm = $8,
           base_price = $9, final_price = $10, preview_url = $11,
           updated_at = now()
       WHERE id = $12`,
      [name, sku, description, primary_color_id, secondary_color_id, normalizedMaterialId,
       countertop_length_mm, countertop_depth_mm, base_price, final_price, preview_url, id]
    );
    kitSolutionId = id;

    // Удаляем старые связи с модулями
    await query(`DELETE FROM kit_solution_modules WHERE kit_solution_id = $1`, [id]);
  } else {
    // Создание нового решения
    const { rows } = await query(
      `INSERT INTO kit_solutions 
       (name, sku, description, primary_color_id, secondary_color_id, material_id,
        countertop_length_mm, countertop_depth_mm, base_price, final_price, preview_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [name, sku, description, primary_color_id, secondary_color_id, normalizedMaterialId,
       countertop_length_mm, countertop_depth_mm, base_price, final_price, preview_url]
    );
    kitSolutionId = rows[0].id;
  }

  // Добавляем связи с модулями
  if (Array.isArray(moduleIds) && moduleIds.length > 0) {
    // Получаем информацию о модулях для определения их категорий
    const { rows: modulesInfo } = await query(
      `SELECT m.id, mc.code as category_code
       FROM modules m
       LEFT JOIN module_categories mc ON m.module_category_id = mc.id
       WHERE m.id = ANY($1::int[])`,
      [moduleIds]
    );

    const moduleMap = new Map(modulesInfo.map(m => [m.id, m.category_code || 'bottom']));

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
  return await getKitSolutionWithModules(kitSolutionId);
};

/**
 * Получить список готовых решений с краткой информацией
 * @param {Object} filters - Фильтры для поиска
 * @returns {Promise<Array>} Список готовых решений
 */
const listKitSolutions = async (filters = {}) => {
  const { search, colorId, minPrice, maxPrice } = filters;
  const conditions = ['ks.is_active = true'];
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

  const sql = `
    SELECT 
     ks.*,
     c1.name as primary_color_name,
     c2.name as secondary_color_name,
     kt.name as kitchen_type_name,
     (SELECT COUNT(*) FROM kit_solution_modules WHERE kit_solution_id = ks.id) as modules_count
     FROM kit_solutions ks
     LEFT JOIN colors c1 ON ks.primary_color_id = c1.id
     LEFT JOIN colors c2 ON ks.secondary_color_id = c2.id
     LEFT JOIN kitchen_types kt ON ks.kitchen_type_id = kt.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ks.id DESC
  `;

  const { rows } = await query(sql, params);
  return rows;
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
     (SELECT COUNT(*) FROM kit_solution_modules WHERE kit_solution_id = ks.id) as modules_count
     FROM kit_solutions ks
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

    return {
      ...kit,
      similarityScore,
      matches,
      similarityPercent: Math.min(100, Math.round((similarityScore / 100) * 100)),
    };
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
  listKitSolutions,
  findSimilarKitSolutions,
};

