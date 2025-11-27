// src/config/db.js
const { Pool } = require("pg");
const config = require("./env");
const logger = require("../utils/logger");
const ApiError = require("../utils/api-error");

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL error", { message: err.message });
});

const formatDbError = (err, text) => {
  logger.error("DB Query Error", {
    message: err.message,
    text,
  });
  if (err.code === "23505") {
    throw ApiError.conflict("Database constraint violation", {
      code: err.code,
      detail: err.detail,
    });
  }
  throw err;
};

const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn("Slow query detected", { text, duration });
    }
    return result;
  } catch (error) {
    formatDbError(error, text);
  }
};

const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { query, withTransaction };
