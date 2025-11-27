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

const list = async (entity, { limit = 100, offset = 0 }) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 0, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const fields =
    entity.selectFields && entity.selectFields.length
      ? entity.selectFields.join(", ")
      : "*";

  const { rows } = await query(
    `SELECT ${fields} FROM ${entity.table} ORDER BY ${entity.idColumn} DESC LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );
  return rows;
};

const getById = async (entity, id) => {
  const fields =
    entity.selectFields && entity.selectFields.length
      ? entity.selectFields.join(", ")
      : "*";

  const { rows } = await query(
    `SELECT ${fields} FROM ${entity.table} WHERE ${entity.idColumn} = $1`,
    [id]
  );
  if (!rows[0]) {
    throw ApiError.notFound(`${entity.table} record not found`);
  }
  return rows[0];
};

const create = async (entity, payload) => {
  const data = sanitizePayload(entity, payload);
  if (!Object.keys(data).length) {
    throw ApiError.badRequest("No fields provided for create");
  }
  const { text, values } = buildInsertQuery(entity.table, data);
  const { rows } = await query(text, values);
  return rows[0];
};

const update = async (entity, id, payload) => {
  const data = sanitizePayload(entity, payload);
  if (!Object.keys(data).length) {
    throw ApiError.badRequest("No fields provided for update");
  }
  const { text, values } = buildUpdateQuery(entity.table, entity.idColumn, data, id);
  const { rows } = await query(text, values);
  if (!rows[0]) {
    throw ApiError.notFound(`${entity.table} record not found`);
  }
  return rows[0];
};

const remove = async (entity, id) => {
  const { rows } = await query(
    `DELETE FROM ${entity.table} WHERE ${entity.idColumn} = $1 RETURNING ${entity.idColumn}`,
    [id]
  );
  if (!rows[0]) {
    throw ApiError.notFound(`${entity.table} record not found`);
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};

