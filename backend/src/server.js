// src/server.js
const app = require("./app");
const config = require("./config/env");
const { initDatabase } = require("./db/schema");

const PORT = config.port;
const HOST = config.host;

const startServer = async () => {
  try {
    // Инициализация БД при старте
    await initDatabase();

    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Сервер запущен в режиме ${config.env} на порту ${PORT}`);
      console.log(`🔗 Проверка работоспособности: http://localhost:${PORT}/api/health`);
    });

    // Корректное завершение
    process.on("SIGTERM", () => {
      console.log("Получен SIGTERM. Корректное завершение...");
      server.close(() => {
        console.log("✅ Сервер остановлен");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Не удалось запустить сервер:", error);
    process.exit(1);
  }
};

// Ловим необработанные ошибки
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥 Приложение будет остановлено...");
  console.error(err);
  process.exit(1);
});

startServer();
