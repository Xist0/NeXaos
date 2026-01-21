const rateLimit = require("express-rate-limit");
const xssClean = require("xss-clean");
const hpp = require("hpp");

const createRateLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

const applySecurityMiddleware = (app) => {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    app.set("trust proxy", 1);
    app.use(
      createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 400,
        message: "Too many requests, please try again later.",
      })
    );
    app.use(
      "/api/auth",
      createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 60,
        message: "Too many auth requests, please try again later.",
      })
    );
    app.use(
      "/api/upload",
      createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 120,
        message: "Too many upload requests, please try again later.",
      })
    );
    app.use(
      "/api/logs",
      createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 120,
        message: "Too many log requests, please try again later.",
      })
    );
  }

  app.use(xssClean());
  app.use(
    hpp({
      checkBody: true,
    })
  );
};

module.exports = applySecurityMiddleware;
