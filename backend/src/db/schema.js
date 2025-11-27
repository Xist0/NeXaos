const bcrypt = require("bcrypt");
const { query } = require("../config/db");
const logger = require("../utils/logger");
const migrations = require("../migrations");

const runMigrations = async () => {
  console.log("🔍 Running database migrations...");
  for (const migration of migrations) {
    await migration.up(query);
  }
  console.log("✅ All migrations applied");
};

const seedBasicData = async () => {
  console.log("🌱 Seeding basic data...");

  await query(
    `INSERT INTO roles (name, description) 
     VALUES ($1, $2), ($3, $4) 
     ON CONFLICT (name) DO NOTHING`,
    ["user", "Обычный покупатель", "admin", "Администратор магазина"]
  );

  const units = [
    ["m2", "Квадратный метр"],
    ["m", "Погонный метр"],
    ["шт", "Штука"],
    ["компл", "Комплект"],
  ];

  for (const [code, name] of units) {
    await query(
      `INSERT INTO units (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      [code, name]
    );
  }

  // Создаём тестового админа (опционально)
  const adminEmail = process.env.ADMIN_EMAIL || "admin@nexaos.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const adminFullName = process.env.ADMIN_FULL_NAME || "Test Admin";

  const existingAdmin = await query(`SELECT 1 FROM users WHERE email = $1`, [adminEmail]);
  if (existingAdmin.rowCount === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone, is_active)
       SELECT r.id, $1, $2, $3, $4, true
       FROM roles r
       WHERE r.name = 'admin'
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, passwordHash, adminFullName, "+7 (000) 000-00-00"]
    );
    logger.info("Test admin user created", { email: adminEmail });
  }

  console.log("✅ Basic data seeded");
};

const initDatabase = async () => {
  await runMigrations();
  await seedBasicData();
};

module.exports = { initDatabase };