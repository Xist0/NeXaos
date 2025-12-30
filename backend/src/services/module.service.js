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
  const { moduleId, limit = 10, weights = {} } = params;

  if (!moduleId) {
    throw new Error("Необходимо указать ID модуля для поиска похожих");
  }

  // Получаем данные исходного модуля с цветами
  const { rows: sourceModule } = await query(
    `SELECT m.*, 
     mc.code as category_code,
     m.facade_color,
     m.corpus_color,
     m.primary_color_id,
     m.secondary_color_id,
     c1.id as primary_color_id_val,
     c2.id as secondary_color_id_val,
     m.length_mm,
     m.depth_mm,
     m.height_mm
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

  // Веса параметров по умолчанию (чем выше вес, тем важнее параметр)
  const defaultWeights = {
    category: 30,      // Категория модуля (нижний/верхний)
    facadeColor: 20,  // Цвет фасада
    corpusColor: 15,  // Цвет корпуса
    length: 10,       // Длина (с учетом допустимого отклонения)
  };

  const finalWeights = { ...defaultWeights, ...weights };

  // Получаем все активные модули кроме исходного с цветами
  const { rows: allModules } = await query(
    `SELECT m.*, 
     mc.code as category_code,
     m.primary_color_id,
     m.secondary_color_id
     FROM modules m
     LEFT JOIN module_categories mc ON m.module_category_id = mc.id
     WHERE m.id != $1 AND m.is_active = true
     ORDER BY m.id`,
    [moduleId]
  );

  // Вычисляем схожесть для каждого модуля
  const similarModules = allModules.map(module => {
    let similarityScore = 0;
    const matches = [];

    // Сравнение категории (30 баллов)
    if (source.category_code === module.category_code) {
      similarityScore += finalWeights.category;
      matches.push("category");
    }

    // Сравнение цвета фасада (20 баллов) - сначала по primary_color_id, затем по facade_color
    if (source.primary_color_id && module.primary_color_id && 
        source.primary_color_id === module.primary_color_id) {
      similarityScore += finalWeights.facadeColor;
      matches.push("primaryColor");
    } else if (source.facade_color && module.facade_color && 
        source.facade_color === module.facade_color) {
      similarityScore += finalWeights.facadeColor * 0.8; // Немного меньше баллов за текстовое совпадение
      matches.push("facadeColor");
    }

    // Сравнение цвета корпуса (15 баллов) - сначала по secondary_color_id, затем по corpus_color
    if (source.secondary_color_id && module.secondary_color_id && 
        source.secondary_color_id === module.secondary_color_id) {
      similarityScore += finalWeights.corpusColor;
      matches.push("secondaryColor");
    } else if (source.corpus_color && module.corpus_color && 
        source.corpus_color === module.corpus_color) {
      similarityScore += finalWeights.corpusColor * 0.8; // Немного меньше баллов за текстовое совпадение
      matches.push("corpusColor");
    }

    // Сравнение длины (10 баллов, с учетом отклонения ±50мм)
    if (source.length_mm && module.length_mm) {
      const lengthDiff = Math.abs(source.length_mm - module.length_mm);
      if (lengthDiff <= 50) {
        const lengthScore = finalWeights.length * (1 - lengthDiff / 50);
        similarityScore += lengthScore;
        matches.push("length");
      }
    }

    // Бонус за наличие пенала в обоих случаях
    if (source.category_code === 'tall' && module.category_code === 'tall') {
      similarityScore += 5;
      matches.push("tallModule");
    }

    return {
      ...module,
      similarityScore,
      matches,
      similarityPercent: Math.min(100, Math.round((similarityScore / 100) * 100)),
    };
  });

  // Сортируем по убыванию схожести и ограничиваем количество
  const sorted = similarModules
    .filter(m => m.similarityScore > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  logger.info("Найдены похожие модули", {
    sourceModuleId: moduleId,
    foundCount: sorted.length,
    limit,
  });

  return sorted;
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

