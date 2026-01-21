const Joi = require("joi");
const ApiError = require("../utils/api-error");
const {
  createAccessToken,
  createRefreshTokenRecord,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} = require("../services/token.service");
const {
  findByEmail,
  verifyPassword,
  toSafeUser,
} = require("../services/user.service");

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const login = async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw ApiError.badRequest("Ошибка валидации", error.details);
  }

  const user = await findByEmail(value.email);

  if (!user || !user.is_active) {
    throw ApiError.unauthorized("Неверные учетные данные");
  }

  const passwordOk = await verifyPassword(value.password, user.password_hash);

  if (!passwordOk) {
    throw ApiError.unauthorized("Неверные учетные данные");
  }

  // Создаем refresh token (30 дней)
  const refreshTokenRecord = await createRefreshTokenRecord(user.id);
  
  // Создаем access token (3 дня)
  const accessToken = createAccessToken(
    user.id,
    user.role_id,
    user.role_name || "user"
  );

  res.cookie("nexaos_refresh_token", refreshTokenRecord.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.app.get("env") === "production",
    path: "/api/auth",
    expires: refreshTokenRecord.expires_at,
  });

  res.status(200).json({
    accessToken,
    refreshToken: refreshTokenRecord.token,
    expiresAt: refreshTokenRecord.expires_at,
    user: toSafeUser(user),
  });
};

const refresh = async (req, res) => {
  const refreshToken = req.cookies?.nexaos_refresh_token || req.body?.refreshToken;

  if (!refreshToken) {
    throw ApiError.badRequest("Refresh token не указан");
  }

  const tokenRecord = await verifyRefreshToken(refreshToken);

  if (!tokenRecord) {
    throw ApiError.unauthorized("Refresh token недействителен или истек");
  }

  // Создаем новый access token
  const accessToken = createAccessToken(
    tokenRecord.user_id,
    tokenRecord.role_id,
    tokenRecord.role_name || "user"
  );

  res.status(200).json({
    accessToken,
    user: {
      id: tokenRecord.user_id,
      email: tokenRecord.email,
      fullName: tokenRecord.full_name,
      roleId: tokenRecord.role_id,
      roleName: tokenRecord.role_name,
    },
  });
};

const logout = async (req, res) => {
  const refreshToken = req.cookies?.nexaos_refresh_token || req.body?.refreshToken;

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  if (req.user?.id) {
    await revokeAllUserRefreshTokens(req.user.id);
  }

  res.clearCookie("nexaos_refresh_token", { path: "/api/auth" });

  res.status(204).send();
};

const getProfile = async (req, res) => {
  res.status(200).json({
    user: req.user,
  });
};

module.exports = {
  login,
  logout,
  refresh,
  getProfile,
};

