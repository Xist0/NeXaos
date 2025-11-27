const Joi = require("joi");
const ApiError = require("../utils/api-error");
const {
  createSession,
  revokeSession,
  findSessionByToken,
} = require("../services/session.service");
const {
  findByEmail,
  verifyPassword,
  toSafeUser,
} = require("../services/user.service");
const { SESSION_COOKIE_NAME } = require("../middleware/auth.middleware");

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
    throw ApiError.badRequest("Validation failed", error.details);
  }

  const user = await findByEmail(value.email);

  if (!user || !user.is_active) {
    throw ApiError.unauthorized("Invalid credentials");
  }

  const passwordOk = await verifyPassword(value.password, user.password_hash);

  if (!passwordOk) {
    throw ApiError.unauthorized("Invalid credentials");
  }

  const session = await createSession(
    user.id,
    req.get("user-agent") || "unknown",
    req.ip
  );

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  res.cookie(SESSION_COOKIE_NAME, session.token, cookieOptions);

  res.status(200).json({
    token: session.token,
    expiresAt: session.expires_at,
    user: toSafeUser(user),
  });
};

const logout = async (req, res) => {
  if (req.sessionId) {
    await revokeSession(req.sessionId);
  } else if (req.sessionToken) {
    const session = await findSessionByToken(req.sessionToken);
    if (session) {
      await revokeSession(session.id);
    }
  }

  res.clearCookie(SESSION_COOKIE_NAME);
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
  getProfile,
};

