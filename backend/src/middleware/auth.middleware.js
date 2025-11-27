const ApiError = require("../utils/api-error");
const {
  findSessionByToken,
  revokeSession,
} = require("../services/session.service");

const SESSION_COOKIE_NAME = "nexaos_session";

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }

  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

const authGuard = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return next(ApiError.unauthorized("Missing session token"));
  }

  const session = await findSessionByToken(token);

  if (!session) {
    return next(ApiError.unauthorized("Session is invalid or expired"));
  }

  if (session.revoked) {
    await revokeSession(session.id);
    return next(ApiError.unauthorized("Session has been revoked"));
  }

  req.sessionId = session.id;
  req.sessionToken = session.token;
  req.user = {
    id: session.user_id,
    roleId: session.role_id,
    roleName: session.role_name,
    email: session.email,
    fullName: session.full_name,
  };

  return next();
};

module.exports = {
  authGuard,
  SESSION_COOKIE_NAME,
};

