const bcrypt = require("bcrypt");
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

  // Создаём демо-модули для каталога, если таблица modules пустая
  const modulesCount = await client.query(`SELECT COUNT(1)::int AS cnt FROM modules`);
  const cnt = modulesCount.rows?.[0]?.cnt ?? 0;
  if (cnt === 0) {
    const bottomCategory = await client.query(
      `SELECT id FROM module_categories WHERE code = 'bottom' LIMIT 1`
    );
    const topCategory = await client.query(
      `SELECT id FROM module_categories WHERE code = 'top' LIMIT 1`
    );

    const bottomCategoryId = bottomCategory.rows?.[0]?.id ?? null;
    const topCategoryId = topCategory.rows?.[0]?.id ?? null;

    const demoModules = [
      {
        sku: "NMR1-600",
        base_sku: "НМР1",
        name: "Нижний модуль распашной 600",
        module_category_id: bottomCategoryId,
        length_mm: 600,
        depth_mm: 560,
        height_mm: 720,
        final_price: 4990,
      },
      {
        sku: "NMR2-800",
        base_sku: "НМР2",
        name: "Нижний модуль распашной 800",
        module_category_id: bottomCategoryId,
        length_mm: 800,
        depth_mm: 560,
        height_mm: 720,
        final_price: 6490,
      },
      {
        sku: "NMY2-600",
        base_sku: "НМЯ.2",
        name: "Нижний модуль с ящиками 600",
        module_category_id: bottomCategoryId,
        length_mm: 600,
        depth_mm: 560,
        height_mm: 720,
        final_price: 7990,
      },
      {
        sku: "VMR1-600",
        base_sku: "ВМР1",
        name: "Верхний модуль распашной 600",
        module_category_id: topCategoryId,
        length_mm: 600,
        depth_mm: 320,
        height_mm: 720,
        final_price: 3990,
      },
      {
        sku: "VMR2-800",
        base_sku: "ВМР2",
        name: "Верхний модуль распашной 800",
        module_category_id: topCategoryId,
        length_mm: 800,
        depth_mm: 320,
        height_mm: 720,
        final_price: 4990,
      },
    ];

    for (const m of demoModules) {
      await client.query(
        `INSERT INTO modules (
          public_id,
          sku, name, base_sku,
          module_category_id,
          length_mm, depth_mm, height_mm,
          final_price,
          is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
        ON CONFLICT (sku) DO NOTHING`,
        [
          crypto.randomUUID(),
          m.sku,
          m.name,
          m.base_sku,
          m.module_category_id,
          m.length_mm,
          m.depth_mm,
          m.height_mm,
          m.final_price,
        ]
      );
    }
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