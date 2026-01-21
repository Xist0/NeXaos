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
  const { limit, offset, search } = queryParams;
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
    // Поиск по названию и артикулу
    if (search) {
      conditions.push(`(name ILIKE $${params.length + 1} OR sku ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    // Фильтр по цвету фасада
    if (queryParams.facadeColor) {
      conditions.push(`facade_color = $${params.length + 1}`);
      params.push(queryParams.facadeColor);
    }
    
    // Фильтр по цвету корпуса
    if (queryParams.corpusColor) {
      conditions.push(`corpus_color = $${params.length + 1}`);
      params.push(queryParams.corpusColor);
    }
    
    // Фильтр по цене (от)
    if (queryParams.priceFrom) {
      conditions.push(`final_price >= $${params.length + 1}`);
      params.push(parseFloat(queryParams.priceFrom));
    }
    
    // Фильтр по цене (до)
    if (queryParams.priceTo) {
      conditions.push(`final_price <= $${params.length + 1}`);
      params.push(parseFloat(queryParams.priceTo));
    }
    
    // Фильтр по длине (от)
    if (queryParams.lengthFrom) {
      conditions.push(`length_mm >= $${params.length + 1}`);
      params.push(parseInt(queryParams.lengthFrom, 10));
    }
    
    // Фильтр по длине (до)
    if (queryParams.lengthTo) {
      conditions.push(`length_mm <= $${params.length + 1}`);
      params.push(parseInt(queryParams.lengthTo, 10));
    }
    
    // Фильтр по глубине (от)
    if (queryParams.depthFrom) {
      conditions.push(`depth_mm >= $${params.length + 1}`);
      params.push(parseInt(queryParams.depthFrom, 10));
    }
    
    // Фильтр по глубине (до)
    if (queryParams.depthTo) {
      conditions.push(`depth_mm <= $${params.length + 1}`);
      params.push(parseInt(queryParams.depthTo, 10));
    }
    
    // Фильтр по высоте (от)
    if (queryParams.heightFrom) {
      conditions.push(`height_mm >= $${params.length + 1}`);
      params.push(parseInt(queryParams.heightFrom, 10));
    }
    
    // Фильтр по высоте (до)
    if (queryParams.heightTo) {
      conditions.push(`height_mm <= $${params.length + 1}`);
      params.push(parseInt(queryParams.heightTo, 10));
    }
    
    // Фильтр по категории
    if (queryParams.categoryId) {
      conditions.push(`module_category_id = $${params.length + 1}`);
      params.push(parseInt(queryParams.categoryId, 10));
    }
    
    // Фильтр по основе артикула (НМР1, НМР2, НМР.М1 и т.д.)
    if (queryParams.baseSku) {
      conditions.push(`base_sku = $${params.length + 1}`);
      params.push(queryParams.baseSku);
    }
    
    // Фильтр по активности
    if (queryParams.isActive !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`);
      params.push(queryParams.isActive === 'true' || queryParams.isActive === true);
    }
    
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    sql += ` ORDER BY ${entity.idColumn} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
