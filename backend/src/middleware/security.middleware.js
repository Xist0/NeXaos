const rateLimit = require("express-rate-limit");
const xssClean = require("xss-clean");
const hpp = require("hpp");

const createRateLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Too many requests, please try again later.",
    },
  });

const applySecurityMiddleware = (app) => {
  app.set("trust proxy", 1);
  app.use(createRateLimiter());
  app.use(xssClean());
  app.use(
    hpp({
      checkBody: true,
    })
  );
};

module.exports = applySecurityMiddleware;

