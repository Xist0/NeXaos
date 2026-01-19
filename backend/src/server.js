// src/server.js
const app = require("./app");
const config = require("./config/env");
const { initDatabase } = require("./db/schema");

const PORT = Number(config.port);
const HOST = config.host;

let currentServer = null;

const shutdown = (signal) => {
  console.log(`Получен ${signal}. Корректное завершение...`);
  if (!currentServer) {
    process.exit(0);
  }
  currentServer.close(() => {
    console.log("✅ Сервер остановлен");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const startServer = async () => {
  try {
    // Инициализация БД при старте
    await initDatabase();

    const basePort = Number.isFinite(PORT) ? PORT : 5000;
    const maxAttempts = config.env === "production" ? 1 : 20;

    const listenOnPort = (port, attempt = 1) => {
      const server = app.listen(port, HOST, () => {
        console.log(`🚀 Сервер запущен в режиме ${config.env} на порту ${port}`);
        const healthHost = HOST === "0.0.0.0" ? "localhost" : HOST;
        console.log(`🔗 Проверка работоспособности: http://${healthHost}:${port}/api/health`);
      });

      currentServer = server;

      server.on("error", (err) => {
        if (err && err.code === "EADDRINUSE") {
          if (config.env !== "production" && attempt < maxAttempts) {
            const nextPort = port + 1;
            console.warn(`⚠️ Порт ${port} занят. Пробуем ${nextPort}...`);
            return listenOnPort(nextPort, attempt + 1);
          }
          console.error(`❌ Порт ${port} уже занят. Укажи другой PORT или останови процесс, который слушает этот порт.`);
          process.exit(1);
        }

        console.error("❌ Ошибка запуска сервера:", err);
        process.exit(1);
      });
    };

    listenOnPort(basePort);

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
