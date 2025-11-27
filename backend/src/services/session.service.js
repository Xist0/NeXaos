// src/services/session.service.js
const crypto = require("crypto");
const { query } = require("../config/db");
const logger = require("../utils/logger");

const generateToken = () => crypto.randomBytes(64).toString("hex");

const createSession = async (userId, userAgent = "", ip = null) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { rows } = await query(
    `INSERT INTO sessions (user_id, token, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, token, expires_at`,
    [userId, token, userAgent.slice(0, 255), ip, expiresAt] // ← добавлен expiresAt как $5
  );

  logger.info("Session created", { userId, sessionId: rows[0].id });

  return rows[0];
};

const findSessionByToken = async (token) => {
  if (!token) {
    return null;
  }
  const { rows } = await query(
    `SELECT s.*, u.id AS user_id, u.role_id, r.name AS role_name, u.email, u.full_name
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE s.token = $1 
       AND s.revoked = false 
       AND s.expires_at > NOW()`,
    [token]
  );
  return rows[0] || null;
};

const revokeSession = async (sessionId) => {
  await query(`UPDATE sessions SET revoked = true WHERE id = $1`, [sessionId]);
};

const revokeAllUserSessions = async (userId) => {
  await query(`UPDATE sessions SET revoked = true WHERE user_id = $1`, [
    userId,
  ]);
};

module.exports = {
  createSession,
  findSessionByToken,
  revokeSession,
  revokeAllUserSessions,
};
