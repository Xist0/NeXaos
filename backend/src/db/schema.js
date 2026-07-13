const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { withClient } = require("../config/db");
const logger = require("../utils/logger");
const migrations = require("../migrations");

const runMigrations = async (client) => {
  console.log("🔍 Запускаем миграции базы данных...");
  for (const migration of migrations) {
    await migration.up((text, params) => client.query(text, params));
  }
  console.log("✅ Все миграции применены");
};

const seedBasicData = async (client) => {
  console.log("🌱 Наполняем базу начальными данными...");

  await client.query(
    `INSERT INTO roles (name, description) 
     VALUES ($1, $2), ($3, $4), ($5, $6) 
     ON CONFLICT (name) DO NOTHING`,
    ["user", "Обычный покупатель", "admin", "Администратор магазина", "manager", "Менеджер"]
  );

  const units = [
    ["m2", "Квадратный метр"],
    ["m", "Погонный метр"],
    ["шт", "Штука"],
    ["компл", "Комплект"],
  ];

  for (const [code, name] of units) {
    await client.query(
      `INSERT INTO units (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      [code, name]
    );
  }

  // Создаём тестового админа (опционально)
  const adminEmail = process.env.ADMIN_EMAIL || "admin@nexaos.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const adminFullName = process.env.ADMIN_FULL_NAME || "Test Admin";

  const existingAdmin = await client.query(`SELECT 1 FROM users WHERE email = $1`, [adminEmail]);
  if (existingAdmin.rowCount === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await client.query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone, is_active)
       SELECT r.id, $1, $2, $3, $4, true
       FROM roles r
       WHERE r.name = 'admin'
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, passwordHash, adminFullName, "+7 (000) 000-00-00"]
    );
  logger.info("Создан тестовый администратор", { email: adminEmail });
  }

  console.log("✅ Начальные данные добавлены");
};

const initDatabase = async () => {
  // Advisory lock: гарантирует, что миграции/сид выполнятся только один раз
  // даже при запуске нескольких инстансов (pm2 cluster, несколько dev процессов).
  const LOCK_ID = 786497123;
  await withClient(async (client) => {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    try {
      await runMigrations(client);
      await seedBasicData(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
    }
  });
};

module.exports = { initDatabase };