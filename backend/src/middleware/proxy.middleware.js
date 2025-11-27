const { createProxyMiddleware } = require("http-proxy-middleware");
const config = require("../config/env");
const logger = require("../utils/logger");

const applyProxy = (app) => {
  if (!config.proxy?.target) {
    return;
  }

  const path = config.proxy.path || "/proxy";

  logger.info("Proxy gateway enabled", {
    path,
    target: config.proxy.target,
  });

  app.use(
    path,
    createProxyMiddleware({
      target: config.proxy.target,
      changeOrigin: true,
      secure: false,
      logLevel: config.env === "development" ? "debug" : "warn",
      pathRewrite: (proxyPath, req) =>
        proxyPath.replace(path, "") || req.url,
      onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader("x-nexaos-proxy", "true");
        proxyReq.setHeader("x-forwarded-host", req.headers.host);
      },
    })
  );
};

module.exports = applyProxy;

