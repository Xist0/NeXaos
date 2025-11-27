// src/server.js
const app = require("./app");
const config = require("./config/env");
const { initDatabase } = require("./db/schema");

const PORT = config.port;

const startServer = async () => {
  try {
    // Инициализация БД при старте
    await initDatabase();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${config.env} mode on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Ловим необработанные ошибки
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥 Shutting down...");
  console.error(err);
  process.exit(1);
});

startServer();
