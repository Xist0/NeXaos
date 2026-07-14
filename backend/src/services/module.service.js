const { query } = require("../config/db");
const logger = require("../utils/logger");

/**
 * Сервис для работы с модулями кухни
 * Включает расчет столешницы, проверку соответствия модулей и поиск похожих
 */

/**
 * Рассчитывает длину столешницы на основе нижних модулей
 * @param {Array<number>} moduleIds - Массив ID нижних модулей
 * @returns {Promise<Object>} Результат расчета с общей длиной и деталями
 */
const calculateCountertop = async (moduleIds) => {
  if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
    throw new Error("Необходимо указать хотя бы один модуль");
  }

  // Получаем данные модулей для расчета.
  // Важно: не фильтруем по category_code (bottom), т.к. категории редактируемые,
  // а расчет столешницы должен работать по переданным ID.
  const { rows: modules } = await query(
    `SELECT m.id, m.sku, m.name, m.length_mm, m.depth_mm, mc.code as category_code
     FROM modules m
     LEFT JOIN module_categories mc ON m.module_category_id = mc.id
     WHERE m.id = ANY($1::int[]) 
     AND m.is_active = true`,
    [moduleIds]
  );

  if (modules.length === 0) {
    throw new Error("Не найдено модулей для расчета");
  }

  // Суммируем длину всех модулей
  const totalLength = modules.reduce((sum, module) => {
    return sum + (module.length_mm || 0);
  }, 0);

  // Определяем максимальную глубину
  const maxDepth = Math.max(...modules.map(m => m.depth_mm || 0));

  // Группируем модули по длине для анализа
  const modulesByLength = modules.reduce((acc, module) => {
    const length = module.length_mm || 0;
    if (!acc[length]) {
      acc[length] = [];
    }
    acc[length].push(module);
    return acc;
  }, {});

  logger.info("Рассчитана столешница", {
    moduleIds,
    totalLength,
    maxDepth,
    modulesCount: modules.length,
  });

  return {
    totalLengthMm: totalLength,
    totalLengthM: (totalLength / 1000).toFixed(2),
    maxDepthMm: maxDepth,
    modulesCount: modules.length,
    modules: modules.map(m => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      lengthMm: m.length_mm,
      depthMm: m.depth_mm,
    })),
    modulesByLength,
  };
};

/**
 * Проверяет соответствие длины нижних и верхних модулей
 * @param {Array<number>} bottomModuleIds - Массив ID нижних модулей
 * @param {Array<number>} topModuleIds - Массив ID верхних модулей
 * @returns {Promise<Object>} Результат проверки с предупреждениями
 */
const checkModuleCompatibility = async (bottomModuleIds, topModuleIds) => {
  const bottomIds = Array.isArray(bottomModuleIds) ? bottomModuleIds : [];
  const topIds = Array.isArray(topModuleIds) ? topModuleIds : [];

  if (bottomIds.length === 0 && topIds.length === 0) {
    return {
      compatible: true,
      warnings: [],
      bottomTotalLength: 0,
      topTotalLength: 0,
    };
  }

  // Получаем данные нижних модулей
  let bottomTotalLength = 0;
  let bottomModules = [];
  
  if (bottomIds.length > 0) {
    const { rows } = await query(
      `SELECT m.id, m.sku, m.name, m.length_mm, mc.code as category_code
       FROM modules m
       LEFT JOIN module_categories mc ON m.module_category_id = mc.id
       WHERE m.id = ANY($1::int[]) 
       AND (mc.code = 'bottom' OR m.module_category_id IS NULL)
       AND m.is_active = true`,
      [bottomIds]
    );
    bottomModules = rows;
    bottomTotalLength = rows.reduce((sum, m) => sum + (m.length_mm || 0), 0);
  }

  // Получаем данные верхних модулей
  let topTotalLength = 0;
  let topModules = [];
  
  if (topIds.length > 0) {
    const { rows } = await query(
      `SELECT m.id, m.sku, m.name, m.length_mm, mc.code as category_code
       FROM modules m
       LEFT JOIN module_categories mc ON m.module_category_id = mc.id
       WHERE m.id = ANY($1::int[]) 
       AND (mc.code = 'top' OR m.module_category_id IS NULL)
       AND m.is_active = true`,
      [topIds]
    );
    topModules = rows;
    topTotalLength = rows.reduce((sum, m) => sum + (m.length_mm || 0), 0);
  }

  const warnings = [];
  const lengthDiff = Math.abs(bottomTotalLength - topTotalLength);
  const tolerance = 50; // Допустимое отклонение в мм

  // Проверяем соответствие общей длины
  if (bottomTotalLength > 0 && topTotalLength > 0) {
    if (lengthDiff > tolerance) {
      warnings.push({
        type: "length_mismatch",
        message: `Несоответствие длины: нижние модули ${bottomTotalLength}мм, верхние модули ${topTotalLength}мм (разница ${lengthDiff}мм)`,
        bottomTotalLength,
        topTotalLength,
        difference: lengthDiff,
      });
    }
  }

  // Проверяем наличие пенала (высокого модуля)
  const hasTallModule = [...bottomModules, ...topModules].some(
    m => m.category_code === 'tall'
  );

  logger.info("Проверена совместимость модулей", {
    bottomModuleIds: bottomIds,
    topModuleIds: topIds,
    bottomTotalLength,
    topTotalLength,
    lengthDiff,
    hasTallModule,
    warningsCount: warnings.length,
  });

  return {
    compatible: warnings.length === 0,
    warnings,
    bottomTotalLength,
    topTotalLength,
    lengthDifference: lengthDiff,
    hasTallModule,
    bottomModules: bottomModules.map(m => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      lengthMm: m.length_mm,
    })),
    topModules: topModules.map(m => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      lengthMm: m.length_mm,
    })),
  };
};

/**
 * Находит похожие модули на основе заданных параметров
 * @param {Object} params - Параметры для поиска похожих модулей
 * @param {number} params.moduleId - ID модуля для сравнения
 * @param {number} params.limit - Максимальное количество результатов (по умолчанию 10)
 * @param {Object} params.weights - Веса параметров для сравнения
 * @returns {Promise<Array>} Массив похожих модулей с оценкой схожести
 */
const findSimilarModules = async (params) => {
  const { moduleId, limit = 10 } = params;

  if (!moduleId) {
    throw new Error("Необходимо указать ID модуля для поиска похожих");
  }

  // Получаем данные исходного модуля
  const { rows: sourceModule } = await query(
    `SELECT m.id, m.base_sku, m.module_category_id,
     mc.code as category_code,
     m.primary_color_id, m.secondary_color_id,
     m.facade_color, m.corpus_color,
     m.length_mm, m.depth_mm, m.height_mm,
     c1.name as primary_color_name, c1.sku as primary_color_sku,
     c2.name as secondary_color_name, c2.sku as secondary_color_sku
     FROM modules m
     LEFT JOIN module_categories mc ON m.module_category_id = mc.id
     LEFT JOIN colors c1 ON m.primary_color_id = c1.id
     LEFT JOIN colors c2 ON m.secondary_color_id = c2.id
     WHERE m.id = $1 AND m.is_active = true`,
    [moduleId]
  );

  if (sourceModule.length === 0) {
    throw new Error("Модуль не найден");
  }

  const source = sourceModule[0];

  // Получаем все активные модули той же категории (исключаем другие категории полностью)
  const { rows: sameCategoryModules } = await query(
    `SELECT m.*, mc.code as category_code, m.primary_color_id, m.secondary_color_id
     FROM modules m
     LEFT JOIN module_categories mc ON m.module_category_id = mc.id
     WHERE m.id != $1 AND m.is_active = true AND m.module_category_id = $2
     ORDER BY m.id`,
    [moduleId, source.module_category_id]
  );

  // Разделяем на товары той же подкатегории (base_sku) и той же категории
  const sameSubCategory = sameCategoryModules.filter(m => m.base_sku === source.base_sku);
  const sameCategoryOnly = sameCategoryModules.filter(m => m.base_sku !== source.base_sku);

  // Сортировка внутри каждой группы — по близости цвета и размера
  const scoreModule = (m) => {
    let score = 0;
    // Совпадение цвета фасада
    if (source.primary_color_id && m.primary_color_id && source.primary_color_id === m.primary_color_id) score += 20;
    else if (source.facade_color && m.facade_color && source.facade_color === m.facade_color) score += 16;
    // Совпадение цвета корпуса
    if (source.secondary_color_id && m.secondary_color_id && source.secondary_color_id === m.secondary_color_id) score += 15;
    else if (source.corpus_color && m.corpus_color && source.corpus_color === m.corpus_color) score += 12;
    // Близость размера
    if (source.length_mm && m.length_mm) {
      const diff = Math.abs(source.length_mm - m.length_mm);
      if (diff <= 50) score += 10 * (1 - diff / 50);
    }
    return score;
  };

  sameSubCategory.sort((a, b) => scoreModule(b) - scoreModule(a));
  sameCategoryOnly.sort((a, b) => scoreModule(b) - scoreModule(a));

  // Сначала товары той же подкатегории, затем — той же категории
  const combined = [...sameSubCategory, ...sameCategoryOnly].slice(0, limit);

  // Обогащаем цвета и изображения
  const colorIds = new Set();
  const moduleIds = combined.map(m => m.id);
  for (const m of combined) {
    if (m.primary_color_id) colorIds.add(Number(m.primary_color_id));
    if (m.secondary_color_id) colorIds.add(Number(m.secondary_color_id));
    m.__type = "module";
    m._matchGroup = m.base_sku === source.base_sku ? "subCategory" : "category";
  }
  if (colorIds.size > 0) {
    const { rows: colorRows } = await query(
      `SELECT id, name, sku, hex, image_url FROM colors WHERE id = ANY($1::int[])`,
      [Array.from(colorIds)]
    );
    const colorMap = new Map(colorRows.map(r => [r.id, r]));
    for (const m of combined) {
      if (m.primary_color_id) m.primary_color = colorMap.get(Number(m.primary_color_id));
      if (m.secondary_color_id) m.secondary_color = colorMap.get(Number(m.secondary_color_id));
    }
  }
  if (moduleIds.length > 0) {
    const { rows: imgRows } = await query(
      `SELECT id, url, alt, sort_order, entity_id,
       (sort_order = 0) as is_preview
       FROM images
       WHERE entity_type = 'modules' AND entity_id = ANY($1::int[])
       ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
      [moduleIds]
    );
    const imgsByEntity = new Map();
    for (const img of imgRows) {
      if (!imgsByEntity.has(img.entity_id)) imgsByEntity.set(img.entity_id, []);
      imgsByEntity.get(img.entity_id).push(img);
    }
    for (const m of combined) {
      m.images = imgsByEntity.get(m.id) || [];
      if (!m.preview_url && m.images[0]?.url) m.preview_url = m.images[0].url;
    }
  }

  logger.info("Найдены похожие модули", {
    sourceModuleId: moduleId,
    sameSubCategoryCount: sameSubCategory.length,
    sameCategoryOnlyCount: sameCategoryOnly.length,
    returnedCount: combined.length,
    limit,
  });

  return combined;
};

/**
 * Получает описание модуля по основе артикула
 * @param {string} baseSku - Основа артикула (например, "НМР")
 * @returns {Promise<Object|null>} Описание модуля или null
 */
const getModuleDescriptionByBaseSku = async (baseSku) => {
  if (!baseSku) {
    return null;
  }

  const { rows } = await query(
    `SELECT * FROM module_descriptions WHERE base_sku = $1`,
    [baseSku]
  );

  return rows[0] || null;
};

/**
 * Получает модули с описаниями и характеристиками
 * @param {Array<number>} moduleIds - Массив ID модулей
 * @returns {Promise<Array>} Массив модулей с расширенной информацией
 */
const getModulesWithDescriptions = async (moduleIds) => {
  if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
    return [];
  }

  const { rows } = await query(
    `SELECT 
     m.*,
     mc.code as category_code,
     mc.name as category_name,
     md.base_sku,
     md.description as module_description,
     md.characteristics
     FROM modules m
     LEFT JOIN module_categories mc ON m.module_category_id = mc.id
     LEFT JOIN module_descriptions md ON m.description_id = md.id
     WHERE m.id = ANY($1::int[])
     AND m.is_active = true
     ORDER BY m.id`,
    [moduleIds]
  );

  return rows;
};

module.exports = {
  calculateCountertop,
  checkModuleCompatibility,
  findSimilarModules,
  getModuleDescriptionByBaseSku,
  getModulesWithDescriptions,
};

