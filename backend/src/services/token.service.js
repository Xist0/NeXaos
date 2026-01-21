const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const logger = require("../utils/logger");

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "your-access-secret-change-in-production";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "your-refresh-secret-change-in-production";

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "1d";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 1);

// Генерация refresh token (случайная строка)
const generateRefreshToken = () => crypto.randomBytes(64).toString("hex");

// Создание access token (JWT)
const createAccessToken = (userId, roleId, roleName) => {
  return jwt.sign(
    { userId, roleId, roleName, type: "access" },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
};

// Создание refresh token
const createRefreshTokenRecord = async (userId) => {
  const token = generateRefreshToken();
  const ttlDays = Number.isFinite(REFRESH_TOKEN_TTL_DAYS) && REFRESH_TOKEN_TTL_DAYS > 0 ? REFRESH_TOKEN_TTL_DAYS : 1;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, token, expires_at`,
    [userId, token, expiresAt]
  );

  logger.info("Refresh token created", { userId, tokenId: rows[0].id });
  return rows[0];
};

// Проверка и получение данных из access token
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    if (decoded.type !== "access") {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

// Проверка refresh token
const verifyRefreshToken = async (token) => {
  if (!token) return null;

  const ttlDays = Number.isFinite(REFRESH_TOKEN_TTL_DAYS) && REFRESH_TOKEN_TTL_DAYS > 0 ? REFRESH_TOKEN_TTL_DAYS : 1;

  const { rows } = await query(
    `SELECT rt.*, u.id AS user_id, u.role_id, r.name AS role_name, u.email, u.full_name, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE rt.token = $1 
       AND rt.revoked = false 
       AND rt.expires_at > NOW()
       AND rt.expires_at <= NOW() + ($2 || ' days')::interval
       AND u.is_active = true`,
    [token, ttlDays]
  );

  return rows[0] || null;
};

// Отозвать refresh token
const revokeRefreshToken = async (token) => {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE token = $1`,
    [token]
  );
};

// Отозвать все refresh tokens пользователя
const revokeAllUserRefreshTokens = async (userId) => {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
    [userId]
  );
};

module.exports = {
  createAccessToken,
  createRefreshTokenRecord,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
};

