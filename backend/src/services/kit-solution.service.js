const ApiError = require("../utils/api-error");
const { query } = require("../config/db");
const logger = require("../utils/logger");
const crypto = require("crypto");
const { buildArticle } = require("../utils/article");
const { resolveCategoryGroupCode, resolveCategoryCode } = require("../utils/category-codes");
const productParametersService = require("./product-parameters.service");
const fs = require("fs");
const path = require("path");
const config = require("../config/env");

const normalizeSkuPart = (value) => {
  const s = String(value || "").trim();
  return s.replace(/\s+/g, "");
};

const shortColorPartFromSku = (colorSku) => {
  const lettersOnly = String(colorSku || "")
    .replace(/[^\p{L}]+/gu, "")
    .trim();
  if (!lettersOnly) return "";
  const part = lettersOnly.slice(0, 3);
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
};

const buildAutoSku = ({ baseSku, colorSku, size }) => {
  const base = normalizeSkuPart(baseSku);
  const color = normalizeSkuPart(colorSku);
  const sizePart = normalizeSkuPart(size);
  if (!base || !color || !sizePart) return null;
  const own = `${base}${shortColorPartFromSku(color)}${sizePart}`;
  return `${base}-${color}-${sizePart}-${own}`;
};

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

  // Получаем компоненты готового решения (универсально: modules + catalog_items)
  const { rows: componentRows } = await query(
    `SELECT
      ksc.id as link_id,
      ksc.kit_solution_id,
      ksc.component_type,
      ksc.module_id as link_module_id,
      ksc.catalog_item_id as link_catalog_item_id,
      ksc.position_order,
      ksc.position_type,
      ksc.position_uid,

      m.id as module_id,
      m.sku as module_sku,
      m.name as module_name,
      m.preview_url as module_preview_url_fallback,
      m.length_mm as module_length_mm,
      m.depth_mm as module_depth_mm,
      m.height_mm as module_height_mm,
      m.facade_color as module_facade_color,
      m.corpus_color as module_corpus_color,
      m.final_price as module_final_price,
      m.base_sku as module_base_sku,
      mc.code as module_category_code,
      mc.name as module_category_name,
      imgm.url as module_preview_url,

      ci.id as catalog_item_id,
      ci.sku as catalog_item_sku,
      ci.name as catalog_item_name,
      ci.preview_url as catalog_item_preview_url_fallback,
      ci.length_mm as catalog_item_length_mm,
      ci.depth_mm as catalog_item_depth_mm,
      ci.height_mm as catalog_item_height_mm,
      ci.final_price as catalog_item_final_price,
      imgci.url as catalog_item_preview_url
    FROM kit_solution_components ksc
    LEFT JOIN modules m ON ksc.module_id = m.id
    LEFT JOIN module_categories mc ON m.module_category_id = mc.id
    LEFT JOIN LATERAL (
      SELECT url
      FROM images
      WHERE entity_type = 'modules' AND entity_id = m.id
      ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC
      LIMIT 1
    ) imgm ON true
    LEFT JOIN catalog_items ci ON ksc.catalog_item_id = ci.id
    LEFT JOIN LATERAL (
      SELECT url
      FROM images
      WHERE entity_type = 'catalog-items' AND entity_id = ci.id
      ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC
      LIMIT 1
    ) imgci ON true
    WHERE ksc.kit_solution_id = $1
    ORDER BY (ksc.position_type IS NULL) ASC, ksc.position_type, ksc.position_order, ksc.id`,
    [kitSolutionId]
  );

  const components = [];

  // Группируем модульные компоненты по типам позиций (для кухни)
  const modulesByType = {
    bottom: [],
    top: [],
    tall: [],
    filler: [],
    accessory: [],
  };

  componentRows.forEach((row) => {
    const componentType = String(row.component_type || "").trim();
    if (componentType === "module" && row.module_id) {
      const inferred = inferPositionTypeFromBaseSku(row.module_base_sku);
      const type = row.position_type || row.module_category_code || inferred || "bottom";

      const item = {
        id: row.module_id,
        __type: "module",
        positionUid: row.position_uid || null,
        sku: row.module_sku,
        name: row.module_name,
        preview_url: row.module_preview_url || row.module_preview_url_fallback,
        lengthMm: row.module_length_mm,
        depthMm: row.module_depth_mm,
        heightMm: row.module_height_mm,
        facadeColor: row.module_facade_color,
        corpusColor: row.module_corpus_color,
        finalPrice: row.module_final_price,
        categoryCode: row.module_category_code,
        categoryName: row.module_category_name,
        positionOrder: row.position_order,
        positionType: row.position_type,
      };

      components.push(item);
      if (modulesByType[type]) {
        modulesByType[type].push(item);
      }
      return;
    }

    if (componentType === "catalogItem" && row.catalog_item_id) {
      components.push({
        id: row.catalog_item_id,
        __type: "catalogItem",
        positionUid: row.position_uid || null,
        sku: row.catalog_item_sku,
        name: row.catalog_item_name,
        preview_url: row.catalog_item_preview_url || row.catalog_item_preview_url_fallback,
        lengthMm: row.catalog_item_length_mm,
        depthMm: row.catalog_item_depth_mm,
        heightMm: row.catalog_item_height_mm,
        finalPrice: row.catalog_item_final_price,
        positionOrder: row.position_order,
        positionType: row.position_type,
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
    parameters: await productParametersService.getEntityParameters({ entityType: "kit-solutions", entityId: kitSolutionId }),
    components,
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
const saveKitSolutionWithModules = async (payload) => {
  const {
    id,
    public_id,
    name,
    base_sku,
    sku,
    description,
    parameters,
    category_group,
    category,
    kitchen_type_id,
    collection_id,
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

  const normalizedCategoryGroup = category_group != null && String(category_group).trim()
    ? String(category_group).trim()
    : null;
  const normalizedCategory = category != null && String(category).trim()
    ? String(category).trim()
    : null;

  let resolvedSku = sku;
  if (!resolvedSku) {
    let primaryColor = null;
    if (primary_color_id) {
      const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [primary_color_id]);
      primaryColor = rows?.[0]?.sku || null;
    }
    let secondaryColor = null;
    if (secondary_color_id) {
      const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [secondary_color_id]);
      secondaryColor = rows?.[0]?.sku || null;
    }

    const articleName = base_sku != null && String(base_sku).trim() ? String(base_sku).trim() : name;
    const generated = buildArticle({
      category: null,
      section: null,
      subcategory: null,
      name: articleName,
      size1: total_length_mm,
      size2: total_depth_mm,
      size3: total_height_mm,
      primaryColor,
      secondaryColor,
    });
    if (generated) resolvedSku = generated;
  }

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
       SET name = $1, base_sku = $2, sku = $3, description = $4,
           category_group = $5, category = $6,
           kitchen_type_id = $7,
           collection_id = $8,
           primary_color_id = $9, secondary_color_id = $10, material_id = $11,
           total_length_mm = $12, total_depth_mm = $13, total_height_mm = $14,
           countertop_length_mm = $15, countertop_depth_mm = $16,
           base_price = $17, final_price = $18, preview_url = $19,
           is_active = $20,
           updated_at = now()
       WHERE id = $21`,
      [
        name,
        base_sku != null && String(base_sku).trim() ? String(base_sku).trim() : null,
        resolvedSku,
        description,
        normalizedCategoryGroup,
        normalizedCategory,
        normalizedKitchenTypeId,
        collection_id ?? null,
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
    const nextPublicId = String(public_id || "").trim() || crypto.randomUUID();
    const { rows } = await query(
      `INSERT INTO kit_solutions 
       (public_id, name, base_sku, sku, description, category_group, category, kitchen_type_id, collection_id,
        primary_color_id, secondary_color_id, material_id,
        total_length_mm, total_depth_mm, total_height_mm,
        countertop_length_mm, countertop_depth_mm, base_price, final_price, preview_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id`,
      [
        nextPublicId,
        name,
        base_sku != null && String(base_sku).trim() ? String(base_sku).trim() : null,
        resolvedSku,
        description,
        normalizedCategoryGroup,
        normalizedCategory,
        normalizedKitchenTypeId,
        collection_id ?? null,
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

  if (Array.isArray(parameters)) {
    await productParametersService.setEntityParameters({
      entityType: "kit-solutions",
      entityId: kitSolutionId,
      items: parameters,
    });
  }

  const normalizedModuleItems = Array.isArray(moduleItems)
    ? moduleItems
        .map((x) => {
          const moduleId = Number(x?.module_id ?? x?.moduleId);
          if (!Number.isFinite(moduleId) || moduleId <= 0) return null;
          const positionUid = String(x?.position_uid ?? x?.positionUid ?? "").trim() || null;
          const positionOrder = Number.isFinite(Number(x?.position_order ?? x?.positionOrder))
            ? Number(x?.position_order ?? x?.positionOrder)
            : null;
          const positionType = String(x?.position_type ?? x?.positionType ?? "").trim() || null;
          return {
            moduleId,
            positionUid,
            positionOrder,
            positionType,
          };
        })
        .filter(Boolean)
    : null;

  const normalizedModuleIds = Array.isArray(moduleIds)
    ? moduleIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : [];

  const normalizedComponentItems = Array.isArray(componentItems)
    ? componentItems
        .map((x) => {
          const rawType = String(x?.component_type ?? x?.componentType ?? "").trim();
          const componentType = rawType === "catalogItem" || rawType === "module" ? rawType : null;
          if (!componentType) return null;

          const moduleId = componentType === "module" ? Number(x?.module_id ?? x?.moduleId) : null;
          const catalogItemId = componentType === "catalogItem" ? Number(x?.catalog_item_id ?? x?.catalogItemId) : null;
          if (componentType === "module" && (!Number.isFinite(moduleId) || moduleId <= 0)) return null;
          if (componentType === "catalogItem" && (!Number.isFinite(catalogItemId) || catalogItemId <= 0)) return null;

          const positionUid = String(x?.position_uid ?? x?.positionUid ?? "").trim() || null;
          const positionOrder = Number.isFinite(Number(x?.position_order ?? x?.positionOrder))
            ? Number(x?.position_order ?? x?.positionOrder)
            : null;
          const positionType = String(x?.position_type ?? x?.positionType ?? "").trim() || null;

          return {
            componentType,
            moduleId,
            catalogItemId,
            positionUid,
            positionOrder,
            positionType,
          };
        })
        .filter(Boolean)
    : null;

  const resolvedComponentItems =
    normalizedComponentItems && normalizedComponentItems.length > 0
      ? normalizedComponentItems
      : normalizedModuleItems && normalizedModuleItems.length > 0
        ? normalizedModuleItems.map((x) => ({
            componentType: "module",
            moduleId: x.moduleId,
            catalogItemId: null,
            positionUid: x.positionUid,
            positionOrder: x.positionOrder,
            positionType: x.positionType,
          }))
        : normalizedModuleIds.length > 0
          ? normalizedModuleIds.map((moduleId, i) => ({
              componentType: "module",
              moduleId,
              catalogItemId: null,
              positionUid: null,
              positionOrder: i,
              positionType: null,
            }))
          : [];

  // Обновляем состав в универсальной таблице
  await query(`DELETE FROM kit_solution_components WHERE kit_solution_id = $1`, [kitSolutionId]);

  // Для обратной совместимости также обновляем старую таблицу связей с модулями
  await query(`DELETE FROM kit_solution_modules WHERE kit_solution_id = $1`, [kitSolutionId]);

  const moduleIdsToResolve = Array.from(
    new Set(resolvedComponentItems.filter((x) => x.componentType === "module").map((x) => x.moduleId))
  ).filter((x) => Number.isFinite(x) && x > 0);

  const moduleTypeMap = new Map();
  if (moduleIdsToResolve.length > 0) {
    const { rows: modulesInfo } = await query(
      `SELECT m.id, mc.code as category_code, m.base_sku
       FROM modules m
       LEFT JOIN module_categories mc ON m.module_category_id = mc.id
       WHERE m.id = ANY($1::int[])`,
      [moduleIdsToResolve]
    );

    modulesInfo.forEach((m) => {
      const inferred = inferPositionTypeFromBaseSku(m.base_sku);
      const type = m.category_code || inferred || "bottom";
      moduleTypeMap.set(m.id, type);
    });
  }

  for (let i = 0; i < resolvedComponentItems.length; i++) {
    const it = resolvedComponentItems[i];
    const positionOrder = Number.isFinite(it.positionOrder) ? it.positionOrder : i;
    const positionUid = it.positionUid || crypto.randomUUID();

    if (it.componentType === "module") {
      const inferredType = moduleTypeMap.get(it.moduleId) || "bottom";
      const positionType = it.positionType || inferredType;

      await query(
        `INSERT INTO kit_solution_components (kit_solution_id, component_type, module_id, catalog_item_id, position_order, position_type, position_uid)
         VALUES ($1, 'module', $2, NULL, $3, $4, $5)`,
        [kitSolutionId, it.moduleId, positionOrder, positionType, positionUid]
      );

      await query(
        `INSERT INTO kit_solution_modules (kit_solution_id, module_id, position_order, position_type, position_uid)
         VALUES ($1, $2, $3, $4, $5)`,
        [kitSolutionId, it.moduleId, positionOrder, positionType, positionUid]
      );
      continue;
    }

    if (it.componentType === "catalogItem") {
      const positionType = it.positionType || "component";
      await query(
        `INSERT INTO kit_solution_components (kit_solution_id, component_type, module_id, catalog_item_id, position_order, position_type, position_uid)
         VALUES ($1, 'catalogItem', NULL, $2, $3, $4, $5)`,
        [kitSolutionId, it.catalogItemId, positionOrder, positionType, positionUid]
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
  const { search, colorId, minPrice, maxPrice, categoryGroup, category, includeInactive, limit, offset } = filters;
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

  if (categoryGroup) {
    conditions.push(`LOWER(TRIM(COALESCE(ks.category_group, ''))) = LOWER(TRIM($${paramIndex}))`);
    params.push(String(categoryGroup));
    paramIndex++;
  }

  if (category) {
    conditions.push(`LOWER(TRIM(COALESCE(ks.category, ''))) = LOWER(TRIM($${paramIndex}))`);
    params.push(String(category));
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

