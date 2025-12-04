const { query } = require("../config/db");
const ApiError = require("../utils/api-error");
const { buildInsertQuery, buildUpdateQuery } = require("../utils/sql-builder");

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
  
  if (search && entity.table === "modules") {
    sql += ` WHERE (name ILIKE $1 OR sku ILIKE $1)`;
    params.push(`%${search}%`);
    sql += ` ORDER BY ${entity.idColumn} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(safeLimit, safeOffset);
  } else {
    sql += ` ORDER BY ${entity.idColumn} DESC LIMIT $1 OFFSET $2`;
    params.push(safeLimit, safeOffset);
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

  const { rows } = await query(
    `DELETE FROM ${entity.table} WHERE ${entity.idColumn} = $1 RETURNING ${entity.idColumn}`,
    [parsedId]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Запись не найдена");
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};

