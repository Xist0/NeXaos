// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const applySecurityMiddleware = require("./middleware/security.middleware");
const errorHandler = require("./middleware/error.middleware");
const authRoutes = require("./routes/auth.routes");
const crudRoutes = require("./routes/crud.routes");

const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
applySecurityMiddleware(app);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api", crudRoutes);

app.use("*", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

module.exports = app;
