const ApiError = require("../utils/api-error");
const { verifyAccessToken } = require("../services/token.service");
const { query } = require("../config/db");

const extractAccessToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
};

// Обязательная авторизация - возвращает ошибку если нет токена
const authGuard = async (req, res, next) => {
  const token = extractAccessToken(req);
  
  if (!token) {
    return next(ApiError.unauthorized("Токен доступа не предоставлен"));
  }

  const decoded = verifyAccessToken(token);
  
  if (!decoded) {
    return next(ApiError.unauthorized("Токен доступа недействителен или истек"));
  }

  // Получаем актуальные данные пользователя из БД
  const { rows } = await query(
    `SELECT u.id, u.role_id, r.name AS role_name, u.email, u.full_name, u.is_active
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1 AND u.is_active = true`,
    [decoded.userId]
  );

  if (!rows[0]) {
    return next(ApiError.unauthorized("Пользователь не найден или деактивирован"));
  }

  req.user = {
    id: rows[0].id,
    roleId: rows[0].role_id,
    roleName: rows[0].role_name || "user",
    email: rows[0].email,
    fullName: rows[0].full_name,
  };
  req.isGuest = false;

  return next();
};

// Опциональная авторизация - работает как гость если нет токена
const optionalAuth = async (req, res, next) => {
  const token = extractAccessToken(req);
  
  if (!token) {
    req.user = null;
    req.isGuest = true;
    return next();
  }

  const decoded = verifyAccessToken(token);
  
  if (!decoded) {
    req.user = null;
    req.isGuest = true;
    return next();
  }

  // Получаем актуальные данные пользователя из БД
  const { rows } = await query(
    `SELECT u.id, u.role_id, r.name AS role_name, u.email, u.full_name, u.is_active
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1 AND u.is_active = true`,
    [decoded.userId]
  );

  if (rows[0]) {
    req.user = {
      id: rows[0].id,
      roleId: rows[0].role_id,
      roleName: rows[0].role_name || "user",
      email: rows[0].email,
      fullName: rows[0].full_name,
    };
    req.isGuest = false;
  } else {
    req.user = null;
    req.isGuest = true;
  }

  return next();
};

module.exports = {
  authGuard,
  optionalAuth,
};

