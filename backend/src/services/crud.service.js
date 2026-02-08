const { query } = require("../config/db");
const ApiError = require("../utils/api-error");
const { buildInsertQuery, buildUpdateQuery } = require("../utils/sql-builder");
const fs = require("fs").promises;
const path = require("path");
const config = require("../config/env");

const sanitizePayload = (entity, payload) => {
  const allowedFields = Object.entries(entity.columns)
    .filter(([, config]) => !config.virtual)
    .map(([key]) => key);

  return Object.keys(payload)
    .filter((key) => allowedFields.includes(key))
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
};

const list = async (entity, queryParams = {}) => {
  const { limit, offset, search, sort } = queryParams;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const fields =
    entity.selectFields && entity.selectFields.length
      ? entity.selectFields.join(", ")
      : "*";

  let sql = `SELECT ${fields} FROM ${entity.table}`;
  const params = [];
  const conditions = [];
  
  // Фильтрация для модулей
  if (entity.table === "modules") {
    const baseFields =
      entity.selectFields && entity.selectFields.length
        ? entity.selectFields.map((f) => `modules.${f}`).join(", ")
        : "modules.*";

    sql = `SELECT ${baseFields}, pop.popularity_qty
      FROM modules
      LEFT JOIN module_descriptions md ON modules.description_id = md.id
      LEFT JOIN (
        SELECT entity_type, entity_id, SUM(COALESCE(qty, 0))::int AS popularity_qty
        FROM order_items
        WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL
        GROUP BY entity_type, entity_id
      ) pop ON pop.entity_type = 'modules' AND pop.entity_id = modules.id`;

    // Поиск по названию и артикулу
    if (search) {
      const p = `$${params.length + 1}`;
      conditions.push(
        `(
          to_tsvector('russian',
            COALESCE(modules.name, '') || ' ' ||
            COALESCE(modules.sku, '') || ' ' ||
            COALESCE(modules.short_desc, '') || ' ' ||
            COALESCE(md.description, '') || ' ' ||
            COALESCE(md.characteristics::text, '')
          ) @@ websearch_to_tsquery('russian', ${p})
          OR modules.name % ${p}
          OR modules.sku % ${p}
          OR COALESCE(md.description, '') % ${p}
          OR EXISTS (
            SELECT 1
            FROM product_parameter_links ppl
            JOIN product_parameters pp ON pp.id = ppl.parameter_id
            WHERE ppl.entity_type = 'modules'
              AND ppl.entity_id = modules.id
              AND (pp.name ILIKE ('%' || ${p} || '%') OR pp.name % ${p})
          )
          OR EXISTS (
            SELECT 1
            FROM product_parameter_category_links ppcl
            JOIN product_parameter_categories ppc ON ppc.id = ppcl.category_id
            WHERE ppcl.entity_type = 'modules'
              AND ppcl.entity_id = modules.id
              AND (ppc.name ILIKE ('%' || ${p} || '%') OR ppc.name % ${p})
          )
        )`
      );
      params.push(String(search));
    }
    
    // Фильтр по цвету фасада
    if (queryParams.facadeColor) {
      conditions.push(`modules.facade_color = $${params.length + 1}`);
      params.push(queryParams.facadeColor);
    }
    
    // Фильтр по цвету корпуса
    if (queryParams.corpusColor) {
      conditions.push(`modules.corpus_color = $${params.length + 1}`);
      params.push(queryParams.corpusColor);
    }
    
    // Фильтр по цене (от)
    if (queryParams.priceFrom) {
      conditions.push(`modules.final_price >= $${params.length + 1}`);
      params.push(parseFloat(queryParams.priceFrom));
    }
    
    // Фильтр по цене (до)
    if (queryParams.priceTo) {
      conditions.push(`modules.final_price <= $${params.length + 1}`);
      params.push(parseFloat(queryParams.priceTo));
    }
    
    // Фильтр по длине (от)
    if (queryParams.lengthFrom) {
      conditions.push(`modules.length_mm >= $${params.length + 1}`);
      params.push(parseInt(queryParams.lengthFrom, 10));
    }
    
    // Фильтр по длине (до)
    if (queryParams.lengthTo) {
      conditions.push(`modules.length_mm <= $${params.length + 1}`);
      params.push(parseInt(queryParams.lengthTo, 10));
    }
    
    // Фильтр по глубине (от)
    if (queryParams.depthFrom) {
      conditions.push(`modules.depth_mm >= $${params.length + 1}`);
      params.push(parseInt(queryParams.depthFrom, 10));
    }
    
    // Фильтр по глубине (до)
    if (queryParams.depthTo) {
      conditions.push(`modules.depth_mm <= $${params.length + 1}`);
      params.push(parseInt(queryParams.depthTo, 10));
    }
    
    // Фильтр по высоте (от)
    if (queryParams.heightFrom) {
      conditions.push(`modules.height_mm >= $${params.length + 1}`);
      params.push(parseInt(queryParams.heightFrom, 10));
    }
    
    // Фильтр по высоте (до)
    if (queryParams.heightTo) {
      conditions.push(`modules.height_mm <= $${params.length + 1}`);
      params.push(parseInt(queryParams.heightTo, 10));
    }
    
    // Фильтр по категории
    if (queryParams.categoryId) {
      conditions.push(`modules.module_category_id = $${params.length + 1}`);
      params.push(parseInt(queryParams.categoryId, 10));
    }
    
    // Фильтр по основе артикула (НМР1, НМР2, НМР.М1 и т.д.)
    if (queryParams.baseSku) {
      conditions.push(`modules.base_sku = $${params.length + 1}`);
      params.push(queryParams.baseSku);
    }

    // Фильтр по категориям параметров изделия (multi)
    if (queryParams.parameterCategoryIds) {
      const ids = String(queryParams.parameterCategoryIds)
        .split(",")
        .map((x) => Number(String(x).trim()))
        .filter((x) => Number.isFinite(x) && x > 0);
      if (ids.length > 0) {
        conditions.push(
          `EXISTS (
            SELECT 1
            FROM product_parameter_category_links ppcl
            WHERE ppcl.entity_type = 'modules'
              AND ppcl.entity_id = modules.id
              AND ppcl.category_id = ANY($${params.length + 1}::int[])
          )`
        );
        params.push(ids);
      }
    }
    // Фильтр по активности
    if (queryParams.isActive !== undefined) {
      conditions.push(`modules.is_active = $${params.length + 1}`);
      params.push(queryParams.isActive === 'true' || queryParams.isActive === true);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    let orderBy = `modules.${entity.idColumn} DESC`;
    if (sort === "price_desc") orderBy = `modules.final_price DESC NULLS LAST, modules.${entity.idColumn} DESC`;
    if (sort === "price_asc") orderBy = `modules.final_price ASC NULLS LAST, modules.${entity.idColumn} DESC`;
    if (sort === "popular_desc") orderBy = `pop.popularity_qty DESC NULLS LAST, modules.${entity.idColumn} DESC`;

    sql += ` ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(safeLimit, safeOffset);
  } else if (entity.table === "catalog_items") {
    sql = `SELECT ${fields}, pop.popularity_qty
      FROM catalog_items
      LEFT JOIN (
        SELECT entity_type, entity_id, SUM(COALESCE(qty, 0))::int AS popularity_qty
        FROM order_items
        WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL
        GROUP BY entity_type, entity_id
      ) pop ON pop.entity_type = 'catalog-items' AND pop.entity_id = catalog_items.id`;

    // Поиск по названию и артикулу
    if (search) {
      const p = `$${params.length + 1}`;
      conditions.push(
        `(
          to_tsvector('russian',
            COALESCE(catalog_items.name, '') || ' ' ||
            COALESCE(catalog_items.sku, '') || ' ' ||
            COALESCE(catalog_items.description, '')
          ) @@ websearch_to_tsquery('russian', ${p})
          OR catalog_items.name % ${p}
          OR catalog_items.sku % ${p}
          OR COALESCE(catalog_items.description, '') % ${p}
          OR EXISTS (
            SELECT 1
            FROM product_parameter_links ppl
            JOIN product_parameters pp ON pp.id = ppl.parameter_id
            WHERE ppl.entity_type = 'catalog-items'
              AND ppl.entity_id = catalog_items.id
              AND (pp.name ILIKE ('%' || ${p} || '%') OR pp.name % ${p})
          )
          OR EXISTS (
            SELECT 1
            FROM product_parameter_category_links ppcl
            JOIN product_parameter_categories ppc ON ppc.id = ppcl.category_id
            WHERE ppcl.entity_type = 'catalog-items'
              AND ppcl.entity_id = catalog_items.id
              AND (ppc.name ILIKE ('%' || ${p} || '%') OR ppc.name % ${p})
          )
        )`
      );
      params.push(String(search));
    }

    if (queryParams.categoryGroup) {
      conditions.push(`LOWER(TRIM(COALESCE(category_group, ''))) = LOWER(TRIM($${params.length + 1}))`);
      params.push(String(queryParams.categoryGroup));
    }

    if (queryParams.category) {
      conditions.push(`LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM($${params.length + 1}))`);
      params.push(String(queryParams.category));
    }

    if (queryParams.collectionId) {
      conditions.push(`collection_id = $${params.length + 1}`);
      params.push(parseInt(queryParams.collectionId, 10));
    }

    if (queryParams.isActive !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`);
      params.push(queryParams.isActive === 'true' || queryParams.isActive === true);
    }

    // Фильтр по категориям параметров изделия (multi)
    if (queryParams.parameterCategoryIds) {
      const ids = String(queryParams.parameterCategoryIds)
        .split(",")
        .map((x) => Number(String(x).trim()))
        .filter((x) => Number.isFinite(x) && x > 0);
      if (ids.length > 0) {
        conditions.push(
          `EXISTS (
            SELECT 1
            FROM product_parameter_category_links ppcl
            WHERE ppcl.entity_type = 'catalog-items'
              AND ppcl.entity_id = catalog_items.id
              AND ppcl.category_id = ANY($${params.length + 1}::int[])
          )`
        );
        params.push(ids);
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    let orderBy = `catalog_items.${entity.idColumn} DESC`;
    if (sort === "price_desc") orderBy = `final_price DESC NULLS LAST, catalog_items.${entity.idColumn} DESC`;
    if (sort === "price_asc") orderBy = `final_price ASC NULLS LAST, catalog_items.${entity.idColumn} DESC`;
    if (sort === "popular_desc") orderBy = `pop.popularity_qty DESC NULLS LAST, catalog_items.${entity.idColumn} DESC`;

    sql += ` ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(safeLimit, safeOffset);
  } else {
    // Для других таблиц
    if (search) {
      sql += ` WHERE name ILIKE $1`;
      params.push(`%${search}%`);
      sql += ` ORDER BY ${entity.idColumn} DESC LIMIT $2 OFFSET $3`;
      params.push(safeLimit, safeOffset);
    } else {
      sql += ` ORDER BY ${entity.idColumn} DESC LIMIT $1 OFFSET $2`;
      params.push(safeLimit, safeOffset);
    }
  }
  
  const { rows } = await query(sql, params);
  return rows;
};

const getById = async (entity, id) => {
  if (!id || id === "undefined" || id === "null") {
    throw ApiError.badRequest("Не указан ID записи");
  }
  
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID записи");
  }

  const fields =
    entity.selectFields && entity.selectFields.length
      ? entity.selectFields.join(", ")
      : "*";

  const { rows } = await query(
    `SELECT ${fields} FROM ${entity.table} WHERE ${entity.idColumn} = $1`,
    [parsedId]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Запись не найдена");
  }
  return rows[0];
};

const create = async (entity, payload) => {
  const data = sanitizePayload(entity, payload);
  if (!Object.keys(data).length) {
    throw ApiError.badRequest("Не переданы данные для создания записи");
  }
  const { text, values } = buildInsertQuery(entity.table, data);
  const { rows } = await query(text, values);
  return rows[0];
};

const update = async (entity, id, payload) => {
  if (!id || id === "undefined" || id === "null") {
    throw ApiError.badRequest("Не указан ID записи");
  }
  
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID записи");
  }

  const data = sanitizePayload(entity, payload);
  if (!Object.keys(data).length) {
    throw ApiError.badRequest("Не переданы данные для обновления записи");
  }
  const { text, values } = buildUpdateQuery(entity.table, entity.idColumn, data, parsedId);
  const { rows } = await query(text, values);
  if (!rows[0]) {
    throw ApiError.notFound("Запись не найдена");
  }
  return rows[0];
};

const remove = async (entity, id) => {
  if (!id || id === "undefined" || id === "null") {
    throw ApiError.badRequest("Не указан ID записи");
  }

  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID записи");
  }

  // Await does not work with a try-catch block
  await query("BEGIN");

  try {
    const { rows: images } = await query(
      `SELECT url FROM images WHERE entity_type = $1 AND entity_id = $2`,
      [entity.table, parsedId]
    );

    if (images.length > 0) {
      for (const image of images) {
        const relative = String(image.url || "")
          .replace(/^\//, "")
          .replace(/^uploads\//, "");

        const imagePath = path.join(config.uploadsDir, relative);
        const legacyPath = config.legacyUploadsDir
          ? path.join(config.legacyUploadsDir, relative)
          : null;
        try {
          await fs.unlink(imagePath);
        } catch (error) {
          if (error.code !== "ENOENT") {
            // ENOENT means file not found, which is fine, we can ignore it.
            // For other errors, we log them but proceed with DB deletion.
            console.error(
              `Error deleting file ${imagePath}:`,
              error
            );
          }
        }

        if (legacyPath) {
          try {
            await fs.unlink(legacyPath);
          } catch {
            // ignore
          }
        }
      }

      await query(
        `DELETE FROM images WHERE entity_type = $1 AND entity_id = $2`,
        [entity.table, parsedId]
      );
    }

    const { rows: deletedRows } = await query(
      `DELETE FROM ${entity.table} WHERE ${entity.idColumn} = $1 RETURNING ${entity.idColumn}`,
      [parsedId]
    );

    if (deletedRows.length === 0) {
      throw ApiError.notFound("Запись не найдена");
    }

    await query("COMMIT");
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
