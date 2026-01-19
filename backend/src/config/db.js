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

const sequential =
  (() => {
    let chain = Promise.resolve();
    return (task) => {
      const run = chain.then(task);
      chain = run.catch(() => {});
      return run;
    };
  })();

const MAX_QUERY_RETRIES = 1;
const RETRYABLE_ERROR_CODES = new Set(["40001", "40P01"]);
const RETRYABLE_SYSTEM_ERRORS = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
]);

const shouldRetry = (error) => {
  if (!error) return false;
  if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) {
    return true;
  }
  if (RETRYABLE_SYSTEM_ERRORS.has(error.code)) {
    return true;
  }
  return false;
};

const runQuery = async (text, params = []) => {
  let attempt = 0;
  while (attempt <= MAX_QUERY_RETRIES) {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        logger.warn("Slow query detected", { text, duration });
      }
      return result;
    } catch (error) {
      if (attempt < MAX_QUERY_RETRIES && shouldRetry(error)) {
        attempt += 1;
        continue;
      }
      formatDbError(error, text);
    }
  }
};

const query = (text, params = []) => sequential(() => runQuery(text, params));

const withClient = async (callback) => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
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

module.exports = { query, withClient, withTransaction };
